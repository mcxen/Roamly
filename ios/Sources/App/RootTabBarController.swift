import UIKit

final class RootTabBarController: UITabBarController {
  private let container: AppContainer
  private let navigationControllers: [UINavigationController]

  init(container: AppContainer) {
    self.container = container
    let library = UINavigationController(rootViewController: LibraryViewController(container: container))
    let organize = UINavigationController(rootViewController: OrganizeViewController(container: container))
    let backup = UINavigationController(rootViewController: BackupViewController(container: container))
    let settings = UINavigationController(rootViewController: SettingsViewController(container: container))
    self.navigationControllers = [library, organize, backup, settings]
    super.init(nibName: nil, bundle: nil)

    library.tabBarItem = UITabBarItem(title: "地图", image: UIImage(systemName: "photo.on.rectangle"), selectedImage: UIImage(systemName: "photo.on.rectangle.fill"))
    organize.tabBarItem = UITabBarItem(title: "整理", image: UIImage(systemName: "hand.tap"), selectedImage: UIImage(systemName: "hand.tap.fill"))
    backup.tabBarItem = UITabBarItem(title: "备份", image: UIImage(systemName: "arrow.down.to.line"), selectedImage: UIImage(systemName: "arrow.down.to.line.circle.fill"))
    settings.tabBarItem = UITabBarItem(title: "设置", image: UIImage(systemName: "gearshape"), selectedImage: UIImage(systemName: "gearshape.fill"))
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    viewControllers = navigationControllers
    configureSystemBars()
  }

  private func configureSystemBars() {
    let navigationAppearance = UINavigationBarAppearance()
    navigationAppearance.configureWithDefaultBackground()
    navigationAppearance.backgroundEffect = UIBlurEffect(style: .systemChromeMaterial)
    navigationAppearance.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.86)
    navigationAppearance.shadowColor = UIColor.separator.withAlphaComponent(0.12)
    navigationAppearance.titleTextAttributes = [.foregroundColor: UIColor.label]
    navigationAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor.label]

    navigationControllers.forEach { navigationController in
      navigationController.navigationBar.prefersLargeTitles = true
      navigationController.navigationBar.standardAppearance = navigationAppearance
      navigationController.navigationBar.scrollEdgeAppearance = navigationAppearance
      navigationController.navigationBar.compactAppearance = navigationAppearance
      navigationController.navigationBar.compactScrollEdgeAppearance = navigationAppearance
      navigationController.navigationBar.tintColor = view.tintColor
    }

    let appearance = UITabBarAppearance()
    appearance.configureWithDefaultBackground()
    appearance.backgroundEffect = UIBlurEffect(style: .systemChromeMaterial)
    appearance.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.9)
    appearance.shadowColor = UIColor.separator.withAlphaComponent(0.1)
    appearance.stackedLayoutAppearance.normal.iconColor = .secondaryLabel
    appearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor.secondaryLabel]
    appearance.stackedLayoutAppearance.selected.iconColor = view.tintColor
    appearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: view.tintColor]

    tabBar.standardAppearance = appearance
    tabBar.scrollEdgeAppearance = appearance
    tabBar.tintColor = view.tintColor
    tabBar.unselectedItemTintColor = .secondaryLabel
    tabBar.isTranslucent = true
  }
}
