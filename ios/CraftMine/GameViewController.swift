import UIKit
import WebKit

/// Экран игры: WKWebView на весь экран, альбомная ориентация, без статус-бара.
/// Сворачивание приложения ставит игру на паузу и сохраняет мир (CMPause), падение процесса веба — перезагрузка.
final class GameViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private let net = NetBridge()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.106, green: 0.106, blue: 0.106, alpha: 1)

        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        // по этой метке игра понимает, что запущена в приложении
        cfg.applicationNameForUserAgent = "CraftMinePE/0.1.0 CraftMineIOS"
        let uc = WKUserContentController()
        // сетевая игра: window.CMNet поверх Network.framework
        uc.addUserScript(WKUserScript(source: NetBridge.shim, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        uc.add(net, name: "cmnet")
        cfg.userContentController = uc

        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = self
        web.uiDelegate = self
        view.addSubview(web)
        net.webView = web

        if let www = Bundle.main.url(forResource: "www", withExtension: nil) {
            web.loadFileURL(www.appendingPathComponent("index.html"), allowingReadAccessTo: www)
        }

        NotificationCenter.default.addObserver(self, selector: #selector(appWillResign),
                                               name: UIApplication.willResignActiveNotification, object: nil)
    }

    @objc private func appWillResign() {
        web.evaluateJavaScript("window.CMPause && CMPause()", completionHandler: nil)
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    // Система выгрузила процесс веба (мало памяти) — загружаем игру заново, мир сохранён
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // alert и confirm из игры (например, «Удалить мир?»)
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Отмена", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "Да", style: .destructive) { _ in completionHandler(true) })
        present(a, animated: true)
    }
}
