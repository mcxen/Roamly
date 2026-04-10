import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    let container = AppContainer.shared
    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = RootTabBarController(container: container)
    window.tintColor = UIColor(named: "AccentColor") ?? .systemBlue
    window.overrideUserInterfaceStyle = Self.interfaceStyle(for: container.settings.interfaceStyle)
    self.window = window
    window.makeKeyAndVisible()
  }

  private static func interfaceStyle(for style: AppSettings.InterfaceStyle) -> UIUserInterfaceStyle {
    switch style {
    case .system:
      return .unspecified
    case .light:
      return .light
    case .dark:
      return .dark
    }
  }
}
