import UIKit

/// CraftMine: Pocket Edition для iOS — игра работает внутри полноэкранного WKWebView из папки www.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.rootViewController = GameViewController()
        w.backgroundColor = UIColor(red: 0.106, green: 0.106, blue: 0.106, alpha: 1)
        w.makeKeyAndVisible()
        window = w
        return true
    }
}
