package com.craftmine.pe;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * Сетевая игра по Wi-Fi (локальная сеть). Доступна из JS как window.CMNet.
 * Хозяин мира открывает TCP-сервер и раз в секунду рассылает по UDP объявление «здесь идёт игра».
 * Остальные слушают объявления (список игр) и подключаются по TCP. Сообщения — строки JSON, по одной на строку.
 * Всё, что происходит в сети, складывается в очередь событий; игра забирает её каждый кадр через poll().
 */
public class Net {
    static final int UDP_PORT = 19133, TCP_PORT = 19134;

    private final Context ctx;
    private final ConcurrentLinkedQueue<String> events = new ConcurrentLinkedQueue<String>();
    private WifiManager.MulticastLock lock;

    // Хозяин
    private volatile ServerSocket server;
    private final Map<Integer, Peer> peers = new ConcurrentHashMap<Integer, Peer>();
    private int nextId = 1;
    private volatile String announce;

    // Клиент
    private volatile Peer host;

    // Поиск игр
    private volatile DatagramSocket discSock;

    Net(Context ctx) { this.ctx = ctx.getApplicationContext(); }

    /** Одно соединение: отдельные потоки чтения и записи, чтобы JS никогда не ждал сеть. */
    private class Peer {
        final int id;
        final Socket sock;
        final LinkedBlockingQueue<String> outQ = new LinkedBlockingQueue<String>();
        volatile boolean closed;

        Peer(int id, Socket sock) { this.id = id; this.sock = sock; }

        void start() {
            new Thread(new Runnable() {
                public void run() {
                    try {
                        BufferedReader in = new BufferedReader(new InputStreamReader(sock.getInputStream(), "UTF-8"), 1 << 16);
                        String line;
                        while ((line = in.readLine()) != null) {
                            JSONObject o = new JSONObject();
                            o.put("e", "msg"); o.put("id", id); o.put("d", line);
                            events.add(o.toString());
                        }
                    } catch (Exception ignored) { }
                    close();
                }
            }, "cm-net-read-" + id).start();
            new Thread(new Runnable() {
                public void run() {
                    try {
                        BufferedWriter out = new BufferedWriter(new OutputStreamWriter(sock.getOutputStream(), "UTF-8"), 1 << 16);
                        while (!closed) {
                            String s = outQ.take();
                            if (closed) break;
                            out.write(s);
                            out.write('\n');
                            if (outQ.isEmpty()) out.flush();
                        }
                    } catch (Exception ignored) { }
                    close();
                }
            }, "cm-net-write-" + id).start();
        }

        void send(String s) { if (!closed) outQ.offer(s); }

        void close() {
            if (closed) return;
            closed = true;
            outQ.offer("");
            try { sock.close(); } catch (Exception ignored) { }
            if (peers.remove(id) != null) event("leave", "id", id);
            if (host == this) { host = null; event("closed", null, 0); }
        }
    }

    private void event(String type, String key, Object val) {
        try {
            JSONObject o = new JSONObject();
            o.put("e", type);
            if (key != null) o.put(key, val);
            events.add(o.toString());
        } catch (JSONException ignored) { }
    }

    // ---------- Хозяин ----------

    /** Открыть мир для игры по сети. name — ник хозяина, world — название мира. */
    @JavascriptInterface
    public boolean host(String name, String world) {
        stopHost();
        try {
            final ServerSocket ss = new ServerSocket();
            ss.setReuseAddress(true);
            ss.bind(new InetSocketAddress(TCP_PORT));
            server = ss;
            JSONObject a = new JSONObject();
            a.put("cm", 1); a.put("name", name); a.put("world", world); a.put("port", TCP_PORT);
            announce = a.toString();
        } catch (Exception e) {
            event("error", "m", "Не удалось открыть мир: " + e.getMessage());
            return false;
        }
        new Thread(new Runnable() {
            public void run() {
                ServerSocket ss = server;
                while (ss != null && !ss.isClosed()) {
                    try {
                        Socket s = ss.accept();
                        s.setTcpNoDelay(true);
                        Peer p;
                        synchronized (Net.this) { p = new Peer(nextId++, s); }
                        peers.put(p.id, p);
                        p.start();
                        event("join", "id", p.id);
                    } catch (Exception e) { break; }
                }
            }
        }, "cm-net-accept").start();
        new Thread(new Runnable() {
            public void run() {
                DatagramSocket ds = null;
                try {
                    ds = new DatagramSocket();
                    ds.setBroadcast(true);
                    while (server != null && announce != null) {
                        byte[] b = announce.getBytes("UTF-8");
                        for (InetAddress addr : broadcastAddresses()) {
                            try { ds.send(new DatagramPacket(b, b.length, addr, UDP_PORT)); } catch (Exception ignored) { }
                        }
                        Thread.sleep(1000);
                    }
                } catch (Exception ignored) {
                } finally { if (ds != null) ds.close(); }
            }
        }, "cm-net-announce").start();
        return true;
    }

    @JavascriptInterface
    public void stopHost() {
        announce = null;
        ServerSocket ss = server;
        server = null;
        if (ss != null) try { ss.close(); } catch (Exception ignored) { }
        for (Peer p : new ArrayList<Peer>(peers.values())) p.close();
        peers.clear();
    }

    @JavascriptInterface
    public boolean isHosting() { return server != null; }

    // ---------- Поиск игр ----------

    @JavascriptInterface
    public void discover(boolean on) {
        DatagramSocket old = discSock;
        discSock = null;
        if (old != null) old.close();
        if (lock != null && lock.isHeld()) lock.release();
        if (!on) return;
        try {
            WifiManager wm = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                lock = wm.createMulticastLock("craftmine");
                lock.setReferenceCounted(false);
                lock.acquire();
            }
        } catch (Exception ignored) { }
        try {
            final DatagramSocket ds = new DatagramSocket(null);
            ds.setReuseAddress(true);
            ds.setBroadcast(true);
            ds.bind(new InetSocketAddress(UDP_PORT));
            discSock = ds;
            new Thread(new Runnable() {
                public void run() {
                    byte[] buf = new byte[2048];
                    while (discSock == ds) {
                        try {
                            DatagramPacket p = new DatagramPacket(buf, buf.length);
                            ds.receive(p);
                            JSONObject a = new JSONObject(new String(p.getData(), 0, p.getLength(), "UTF-8"));
                            if (a.optInt("cm") != 1) continue;
                            JSONObject o = new JSONObject();
                            o.put("e", "found");
                            o.put("ip", p.getAddress().getHostAddress());
                            o.put("name", a.optString("name"));
                            o.put("world", a.optString("world"));
                            events.add(o.toString());
                        } catch (Exception e) {
                            if (discSock != ds) break;
                        }
                    }
                }
            }, "cm-net-discover").start();
        } catch (Exception e) {
            event("error", "m", "Поиск игр не работает: " + e.getMessage());
        }
    }

    // ---------- Клиент ----------

    @JavascriptInterface
    public void join(final String ip) {
        leave();
        new Thread(new Runnable() {
            public void run() {
                try {
                    Socket s = new Socket();
                    s.connect(new InetSocketAddress(ip, TCP_PORT), 6000);
                    s.setTcpNoDelay(true);
                    Peer p = new Peer(0, s);
                    host = p;
                    p.start();
                    event("connected", "ip", ip);
                } catch (Exception e) {
                    event("error", "m", "Не удалось подключиться к " + ip + ": " + e.getMessage());
                }
            }
        }, "cm-net-join").start();
    }

    @JavascriptInterface
    public void leave() {
        Peer p = host;
        host = null;
        if (p != null) p.close();
    }

    // ---------- Сообщения ----------

    /** Хозяин: всем игрокам; клиент: хозяину. */
    @JavascriptInterface
    public void send(String msg) {
        Peer h = host;
        if (h != null) { h.send(msg); return; }
        for (Peer p : peers.values()) p.send(msg);
    }

    /** Хозяин: одному игроку. */
    @JavascriptInterface
    public void sendTo(int id, String msg) {
        Peer p = peers.get(id);
        if (p != null) p.send(msg);
    }

    /** Хозяин: всем, кроме одного (пересылка чужих изменений). */
    @JavascriptInterface
    public void sendExcept(int id, String msg) {
        for (Peer p : peers.values()) if (p.id != id) p.send(msg);
    }

    @JavascriptInterface
    public void kick(int id) {
        Peer p = peers.get(id);
        if (p != null) p.close();
    }

    /** Забрать накопившиеся события: JSON-массив. */
    @JavascriptInterface
    public String poll() {
        if (events.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder("[");
        String s;
        boolean first = true;
        while ((s = events.poll()) != null) {
            if (!first) sb.append(',');
            sb.append(s);
            first = false;
        }
        return sb.append(']').toString();
    }

    @JavascriptInterface
    public String localIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) return a.getHostAddress();
                }
            }
        } catch (Exception ignored) { }
        return "";
    }

    private static List<InetAddress> broadcastAddresses() {
        List<InetAddress> list = new ArrayList<InetAddress>();
        try {
            list.add(InetAddress.getByName("255.255.255.255"));
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && !list.contains(b)) list.add(b);
                }
            }
        } catch (Exception ignored) { }
        return list;
    }

    /** Закрыть всё (выход из приложения или перезапуск WebView). */
    void shutdown() {
        stopHost();
        leave();
        discover(false);
        events.clear();
    }
}
