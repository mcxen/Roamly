import UIKit

final class RootTabBarController: UITabBarController {
  private let container: AppContainer
  private let navigationControllers: [UINavigationController]

  init(container: AppContainer) {
    self.container = container
    let mapWorkbench = UINavigationController(rootViewController: MapWorkbenchViewController(container: container))
    let library = UINavigationController(rootViewController: LibraryViewController(container: container))
    let organize = UINavigationController(rootViewController: OrganizeViewController(container: container))
    let backup = UINavigationController(rootViewController: BackupViewController(container: container))
    let settings = UINavigationController(rootViewController: SettingsViewController(container: container))
    self.navigationControllers = [mapWorkbench, library, organize, backup, settings]
    super.init(nibName: nil, bundle: nil)

    mapWorkbench.tabBarItem = UITabBarItem(title: "地图", image: UIImage(systemName: "map"), selectedImage: UIImage(systemName: "map.fill"))
    library.tabBarItem = UITabBarItem(title: "图库", image: UIImage(systemName: "list.bullet.rectangle"), selectedImage: UIImage(systemName: "list.bullet.rectangle.fill"))
    organize.tabBarItem = UITabBarItem(title: "整理", image: UIImage(systemName: "checklist"), selectedImage: UIImage(systemName: "checklist.checked"))
    backup.tabBarItem = UITabBarItem(title: "备份", image: UIImage(systemName: "icloud.and.arrow.up"), selectedImage: UIImage(systemName: "icloud.and.arrow.up.fill"))
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
    let selectedTint = UIColor(red: 0.33, green: 0.38, blue: 0.24, alpha: 1)
    let surfaceColor = UIColor(red: 0.96, green: 0.97, blue: 0.94, alpha: 0.94)

    let navigationAppearance = UINavigationBarAppearance()
    navigationAppearance.configureWithDefaultBackground()
    navigationAppearance.backgroundEffect = UIBlurEffect(style: .systemChromeMaterial)
    navigationAppearance.backgroundColor = surfaceColor
    navigationAppearance.shadowColor = UIColor.separator.withAlphaComponent(0.12)
    navigationAppearance.titleTextAttributes = [.foregroundColor: UIColor.label]
    navigationAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor.label]

    navigationControllers.forEach { navigationController in
      navigationController.navigationBar.prefersLargeTitles = true
      navigationController.navigationBar.standardAppearance = navigationAppearance
      navigationController.navigationBar.scrollEdgeAppearance = navigationAppearance
      navigationController.navigationBar.compactAppearance = navigationAppearance
      navigationController.navigationBar.compactScrollEdgeAppearance = navigationAppearance
      navigationController.navigationBar.tintColor = selectedTint
    }

    let appearance = UITabBarAppearance()
    appearance.configureWithDefaultBackground()
    appearance.backgroundEffect = UIBlurEffect(style: .systemChromeMaterial)
    appearance.backgroundColor = surfaceColor
    appearance.shadowColor = UIColor.separator.withAlphaComponent(0.1)
    appearance.stackedLayoutAppearance.normal.iconColor = .secondaryLabel
    appearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor.secondaryLabel]
    appearance.stackedLayoutAppearance.selected.iconColor = selectedTint
    appearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: selectedTint]

    tabBar.standardAppearance = appearance
    tabBar.scrollEdgeAppearance = appearance
    tabBar.tintColor = selectedTint
    tabBar.unselectedItemTintColor = .secondaryLabel
    tabBar.isTranslucent = true
  }
}
