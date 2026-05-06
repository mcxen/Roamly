import UIKit

final class RootTabBarController: UITabBarController, UITabBarControllerDelegate, UINavigationControllerDelegate {
  private let container: AppContainer
  private let navigationControllers: [UINavigationController]
  private let aiProgressView = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
  private let aiProgressFillView = UIView()
  private let aiProgressLabel = UILabel()
  private var aiProgressWidthConstraint: NSLayoutConstraint?

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
    delegate = self
    viewControllers = navigationControllers
    navigationControllers.forEach { $0.delegate = self }
    configureSystemBars()
    configureAIProgressView()
    updateAIProgressView(animated: false)
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(aiProgressChanged),
      name: .aiProgressCenterDidChange,
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
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

  private func configureAIProgressView() {
    aiProgressView.translatesAutoresizingMaskIntoConstraints = false
    aiProgressView.alpha = 0
    aiProgressView.isHidden = true
    aiProgressView.layer.borderColor = UIColor.separator.withAlphaComponent(0.18).cgColor
    aiProgressView.layer.borderWidth = 0.5
    view.addSubview(aiProgressView)

    let contentView = aiProgressView.contentView
    let trackView = UIView()
    trackView.translatesAutoresizingMaskIntoConstraints = false
    trackView.backgroundColor = UIColor.separator.withAlphaComponent(0.25)
    trackView.layer.cornerRadius = 1.5
    trackView.layer.cornerCurve = .continuous
    contentView.addSubview(trackView)

    aiProgressFillView.translatesAutoresizingMaskIntoConstraints = false
    aiProgressFillView.backgroundColor = UIColor(red: 0.33, green: 0.38, blue: 0.24, alpha: 1)
    aiProgressFillView.layer.cornerRadius = 1.5
    aiProgressFillView.layer.cornerCurve = .continuous
    trackView.addSubview(aiProgressFillView)

    aiProgressLabel.translatesAutoresizingMaskIntoConstraints = false
    aiProgressLabel.font = .systemFont(ofSize: 12, weight: .medium)
    aiProgressLabel.textColor = .secondaryLabel
    aiProgressLabel.numberOfLines = 1
    contentView.addSubview(aiProgressLabel)

    let tap = UITapGestureRecognizer(target: self, action: #selector(showAIProgressDetail))
    aiProgressView.addGestureRecognizer(tap)
    aiProgressView.isUserInteractionEnabled = true

    aiProgressWidthConstraint = aiProgressFillView.widthAnchor.constraint(equalToConstant: 1)
    aiProgressWidthConstraint?.isActive = true

    NSLayoutConstraint.activate([
      aiProgressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      aiProgressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      aiProgressView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),
      aiProgressView.heightAnchor.constraint(equalToConstant: 24),

      trackView.topAnchor.constraint(equalTo: contentView.topAnchor),
      trackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      trackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      trackView.heightAnchor.constraint(equalToConstant: 3),

      aiProgressFillView.topAnchor.constraint(equalTo: trackView.topAnchor),
      aiProgressFillView.leadingAnchor.constraint(equalTo: trackView.leadingAnchor),
      aiProgressFillView.bottomAnchor.constraint(equalTo: trackView.bottomAnchor),

      aiProgressLabel.topAnchor.constraint(equalTo: trackView.bottomAnchor, constant: 2),
      aiProgressLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
      aiProgressLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
      aiProgressLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -2)
    ])
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    updateAIProgressWidth()
  }

  @objc private func aiProgressChanged() {
    updateAIProgressView(animated: true)
  }

  private func updateAIProgressView(animated: Bool) {
    aiProgressLabel.text = "\(container.aiProgressCenter.title) · \(container.aiProgressCenter.message)"
    updateAIProgressWidth()
    let shouldShow = container.aiProgressCenter.isRunning && !isShowingFullMap()

    let changes = {
      self.aiProgressView.alpha = shouldShow ? 1 : 0
    }
    if shouldShow {
      aiProgressView.isHidden = false
    }
    if animated {
      UIView.animate(withDuration: 0.18, animations: changes) { _ in
        self.aiProgressView.isHidden = !shouldShow
      }
    } else {
      changes()
      aiProgressView.isHidden = !shouldShow
    }
  }

  private func updateAIProgressWidth() {
    let width = max(view.bounds.width * container.aiProgressCenter.progress, 1)
    aiProgressWidthConstraint?.constant = width
  }

  private func isShowingFullMap() -> Bool {
    guard let navigationController = selectedViewController as? UINavigationController else {
      return tabBar.isHidden
    }
    return tabBar.isHidden || navigationController.topViewController is MapDetailViewController
  }

  @objc private func showAIProgressDetail() {
    container.haptics.selectionChanged()
    let center = container.aiProgressCenter
    let details = center.detailLines.suffix(18).joined(separator: "\n")
    let message = details.isEmpty ? center.message : details
    let alert = UIAlertController(title: center.title.isEmpty ? "AI 进度" : center.title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "知道了", style: .default))
    selectedViewController?.present(alert, animated: true)
  }

  func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
    updateAIProgressView(animated: true)
  }

  func navigationController(_ navigationController: UINavigationController, didShow viewController: UIViewController, animated: Bool) {
    updateAIProgressView(animated: true)
  }
}
