import Foundation
import Network
import WebKit

/// Сетевая игра по Wi-Fi для iOS. Игра видит тот же window.CMNet, что и на Android:
/// JS-прослойка (shim) отправляет команды сюда, а события сетевого слоя возвращаются в очередь JS.
/// Протокол совместим с Android: TCP-порт 19134, сообщения — строки JSON по одной на строку.
/// Поиск игр — Bonjour (_craftmine._tcp): так iPhone видит игры на Android и наоборот.
/// (Широковещательный UDP iOS без особого разрешения Apple не позволяет; подключение по IP работает всегда.)
final class NetBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    static let port: NWEndpoint.Port = 19134
    static let service = "_craftmine._tcp"

    private let queue = DispatchQueue(label: "craftmine.net")
    private var listener: NWListener?
    private var peers: [Int: Peer] = [:]
    private var nextId = 1
    private var host: Peer?
    private var browser: NWBrowser?
    private var found: [String: NWEndpoint] = [:]
    private var myServiceName = ""

    final class Peer {
        let id: Int
        let conn: NWConnection
        var buffer = Data()
        var ready = false
        init(id: Int, conn: NWConnection) { self.id = id; self.conn = conn }
    }

    /// JS: window.CMNet. Синхронные вызовы игры (poll, localIp, isHosting) отвечают из локального состояния.
    static let shim = """
    (function () {
      var q = [], hosting = false, ip = '';
      function post(o) { try { window.webkit.messageHandlers.cmnet.postMessage(o); } catch (e) {} }
      window.__cmnetPush = function (e) {
        if (e.e === 'ip') { ip = e.ip || ''; return; }
        if (e.e === 'hosting') { hosting = !!e.v; return; }
        q.push(e);
      };
      window.CMNet = {
        host: function (name, world) { hosting = true; post({ cmd: 'host', name: String(name), world: String(world) }); return true; },
        stopHost: function () { hosting = false; post({ cmd: 'stopHost' }); },
        isHosting: function () { return hosting; },
        discover: function (on) { post({ cmd: 'discover', on: !!on }); },
        join: function (ip) { post({ cmd: 'join', ip: String(ip) }); },
        leave: function () { post({ cmd: 'leave' }); },
        send: function (m) { post({ cmd: 'send', m: String(m) }); },
        sendTo: function (id, m) { post({ cmd: 'sendTo', id: id, m: String(m) }); },
        sendExcept: function (id, m) { post({ cmd: 'sendExcept', id: id, m: String(m) }); },
        kick: function (id) { post({ cmd: 'kick', id: id }); },
        poll: function () { if (!q.length) return '[]'; var s = JSON.stringify(q); q.length = 0; return s; },
        localIp: function () { return ip; }
      };
      post({ cmd: 'ip' });
    })();
    """

    // MARK: - Команды из JS

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let d = message.body as? [String: Any], let cmd = d["cmd"] as? String else { return }
        queue.async {
            switch cmd {
            case "host": self.startHost(name: d["name"] as? String ?? "Игрок", world: d["world"] as? String ?? "Мир")
            case "stopHost": self.stopHost()
            case "discover": self.discover((d["on"] as? Bool) ?? false)
            case "join": self.join(d["ip"] as? String ?? "")
            case "leave": self.leave()
            case "send": self.send(d["m"] as? String ?? "")
            case "sendTo": if let id = d["id"] as? Int, let p = self.peers[id] { self.write(p, d["m"] as? String ?? "") }
            case "sendExcept":
                let id = d["id"] as? Int ?? -1
                for (pid, p) in self.peers where pid != id { self.write(p, d["m"] as? String ?? "") }
            case "kick": if let id = d["id"] as? Int, let p = self.peers[id] { self.close(p) }
            case "ip": self.push(["e": "ip", "ip": NetBridge.localIPv4()])
            default: break
            }
        }
    }

    private func push(_ event: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: event),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.__cmnetPush && window.__cmnetPush(\(json))", completionHandler: nil)
        }
    }

    // MARK: - Хозяин

    private func startHost(name: String, world: String) {
        stopHost()
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            let l = try NWListener(using: params, on: NetBridge.port)
            var txt = NWTXTRecord()
            txt["name"] = name
            txt["world"] = String(world.prefix(60))
            myServiceName = "CraftMine " + String(name.prefix(30))
            l.service = NWListener.Service(name: myServiceName, type: NetBridge.service, domain: nil, txtRecord: txt.data)
            l.newConnectionHandler = { [weak self] conn in self?.accept(conn) }
            l.stateUpdateHandler = { [weak self] state in
                if case .failed(let err) = state {
                    self?.push(["e": "error", "m": "Не удалось открыть мир: \(err)"])
                    self?.push(["e": "hosting", "v": false])
                }
            }
            l.start(queue: queue)
            listener = l
            push(["e": "hosting", "v": true])
        } catch {
            push(["e": "error", "m": "Не удалось открыть мир: \(error)"])
            push(["e": "hosting", "v": false])
        }
    }

    private func stopHost() {
        listener?.cancel()
        listener = nil
        for p in Array(peers.values) { close(p) }
        peers.removeAll()
    }

    private func accept(_ conn: NWConnection) {
        let p = Peer(id: nextId, conn: conn)
        nextId += 1
        peers[p.id] = p
        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                p.ready = true
                self.push(["e": "join", "id": p.id])
            case .failed, .cancelled:
                self.close(p)
            default: break
            }
        }
        conn.start(queue: queue)
        receive(p)
    }

    // MARK: - Клиент

    private func join(_ ip: String) {
        leave()
        let endpoint: NWEndpoint
        if let svc = found[ip] { endpoint = svc }
        else { endpoint = .hostPort(host: NWEndpoint.Host(ip), port: NetBridge.port) }
        let conn = NWConnection(to: endpoint, using: .tcp)
        let p = Peer(id: 0, conn: conn)
        host = p
        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                if !p.ready { p.ready = true; self.push(["e": "connected", "ip": ip]) }
            case .failed(let err):
                if !p.ready { self.push(["e": "error", "m": "Не удалось подключиться: \(err)"]) }
                self.close(p)
            case .cancelled:
                self.close(p)
            default: break
            }
        }
        conn.start(queue: queue)
        receive(p)
        // если за 6 секунд не подключились — ошибка
        queue.asyncAfter(deadline: .now() + 6) { [weak self] in
            guard let self = self, self.host === p, !p.ready else { return }
            self.push(["e": "error", "m": "Не удалось подключиться к \(ip)"])
            self.host = nil
            p.conn.cancel()
        }
    }

    private func leave() {
        let p = host
        host = nil
        p?.conn.cancel()
    }

    // MARK: - Сообщения

    private func send(_ msg: String) {
        if let h = host { write(h, msg); return }
        for p in peers.values { write(p, msg) }
    }

    private func write(_ p: Peer, _ msg: String) {
        guard let data = (msg + "\n").data(using: .utf8) else { return }
        p.conn.send(content: data, completion: .contentProcessed { _ in })
    }

    private func receive(_ p: Peer) {
        p.conn.receive(minimumIncompleteLength: 1, maximumLength: 1 << 16) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if let data = data, !data.isEmpty {
                p.buffer.append(data)
                while let nl = p.buffer.firstIndex(of: 10) {
                    let line = p.buffer.subdata(in: p.buffer.startIndex..<nl)
                    p.buffer.removeSubrange(p.buffer.startIndex...nl)
                    if let s = String(data: line, encoding: .utf8) { self.push(["e": "msg", "id": p.id, "d": s]) }
                }
            }
            if isComplete || error != nil { self.close(p) } else { self.receive(p) }
        }
    }

    private func close(_ p: Peer) {
        if p.id == 0 {
            if host === p { host = nil; push(["e": "closed"]) }
        } else if peers.removeValue(forKey: p.id) != nil {
            if p.ready { push(["e": "leave", "id": p.id]) }
        }
        p.conn.cancel()
    }

    // MARK: - Поиск игр (Bonjour)

    private func discover(_ on: Bool) {
        browser?.cancel()
        browser = nil
        guard on else { return }
        let b = NWBrowser(for: .bonjourWithTXTRecord(type: NetBridge.service, domain: nil), using: .tcp)
        b.browseResultsChangedHandler = { [weak self] results, _ in
            guard let self = self else { return }
            for r in results {
                guard case let .service(name, _, _, _) = r.endpoint else { continue }
                if self.listener != nil && name == self.myServiceName { continue } // свой мир не показываем
                let key = "svc-\(abs(name.hashValue) % 1_000_000)"
                self.found[key] = r.endpoint
                var player = name, world = ""
                if case let .bonjour(txt) = r.metadata {
                    player = txt["name"] ?? name
                    world = txt["world"] ?? ""
                }
                self.push(["e": "found", "ip": key, "name": player, "world": world])
            }
        }
        b.stateUpdateHandler = { [weak self] state in
            if case .failed(let err) = state { self?.push(["e": "error", "m": "Поиск игр не работает: \(err)"]) }
        }
        b.start(queue: queue)
        browser = b
    }

    // MARK: - IP

    static func localIPv4() -> String {
        var result = ""
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return "" }
        defer { freeifaddrs(ifaddr) }
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let p = ptr {
            let ifa = p.pointee
            if let addr = ifa.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET) {
                let name = String(cString: ifa.ifa_name)
                if name == "en0" || (result.isEmpty && name.hasPrefix("en")) || (result.isEmpty && name.hasPrefix("bridge")) {
                    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    if getnameinfo(addr, socklen_t(addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                        let ip = String(cString: host)
                        if name == "en0" { return ip }
                        result = ip
                    }
                }
            }
            ptr = ifa.ifa_next
        }
        return result
    }
}
