import UIKit

final class SettingsViewController: UITableViewController {
  private enum Section: Int, CaseIterable {
    case connection
    case library
    case appearance

    var title: String {
      switch self {
      case .connection:
        return "连接"
      case .library:
        return "图库"
      case .appearance:
        return "外观"
      }
    }

    var rows: [SettingsDetailViewController.Kind] {
      switch self {
      case .connection:
        return [.server, .ai, .aiHistory]
      case .library:
        return [.library]
      case .appearance:
        return [.appearance]
      }
    }
  }

  private let container: AppContainer

  init(container: AppContainer) {
    self.container = container
    super.init(style: .insetGrouped)
    title = "设置"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    tableView.backgroundColor = .systemGroupedBackground
    tableView.register(UITableViewCell.self, forCellReuseIdentifier: "settings-cell")
    navigationItem.largeTitleDisplayMode = .never
    configureHeader()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
    tableView.reloadData()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    navigationController?.setNavigationBarHidden(false, animated: animated)
  }

  private func configureHeader() {
    let headerView = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 104))
    headerView.backgroundColor = .systemGroupedBackground

    let titleLabel = UILabel()
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.text = "设置"
    titleLabel.textColor = .label
    titleLabel.font = .systemFont(ofSize: 34, weight: .bold)
    headerView.addSubview(titleLabel)

    NSLayoutConstraint.activate([
      titleLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
      titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: headerView.trailingAnchor, constant: -16),
      titleLabel.bottomAnchor.constraint(equalTo: headerView.bottomAnchor, constant: -10)
    ])

    tableView.tableHeaderView = headerView
  }

  override func numberOfSections(in tableView: UITableView) -> Int {
    Section.allCases.count
  }

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    Section(rawValue: section)?.rows.count ?? 0
  }

  override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
    Section(rawValue: section)?.title
  }

  override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
    guard let section = Section(rawValue: section) else { return nil }
    switch section {
    case .connection:
      return "联网能力只在需要备份、同步或 AI 编目时使用；地图浏览和基础编辑保持本地优先。"
    case .library:
      return "控制首页卡片密度、位置摘要和缩略图缓存。"
    case .appearance:
      return nil
    }
  }

  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "settings-cell", for: indexPath)
    guard let row = Section(rawValue: indexPath.section)?.rows[indexPath.row] else {
      return cell
    }

    var content = cell.defaultContentConfiguration()
    content.text = row.title
    content.secondaryText = row.summary(settings: container.settings)
    content.image = UIImage(systemName: row.iconName)
    content.imageProperties.tintColor = row.tintColor
    content.textProperties.font = .systemFont(ofSize: 17, weight: .regular)
    content.secondaryTextProperties.color = .secondaryLabel
    cell.contentConfiguration = content
    cell.accessoryType = .disclosureIndicator
    return cell
  }

  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    guard let row = Section(rawValue: indexPath.section)?.rows[indexPath.row] else { return }
    container.haptics.selectionChanged()
    if row == .aiHistory {
      navigationController?.pushViewController(AITaskHistoryViewController(logStore: container.aiTaskLogStore), animated: true)
    } else if row == .ai {
      navigationController?.pushViewController(AIProviderListViewController(container: container), animated: true)
    } else {
      navigationController?.pushViewController(SettingsDetailViewController(container: container, kind: row), animated: true)
    }
  }
}

private final class SettingsDetailViewController: UIViewController {
  enum Kind: Equatable {
    case server
    case ai
    case aiHistory
    case library
    case appearance

    var title: String {
      switch self {
      case .server:
        return "服务端"
      case .ai:
        return "AI 服务商"
      case .aiHistory:
        return "AI 对话历史"
      case .library:
        return "首页显示"
      case .appearance:
        return "界面外观"
      }
    }

    var iconName: String {
      switch self {
      case .server:
        return "server.rack"
      case .ai:
        return "sparkles"
      case .aiHistory:
        return "clock.arrow.circlepath"
      case .library:
        return "photo.on.rectangle.angled"
      case .appearance:
        return "circle.lefthalf.filled"
      }
    }

    var tintColor: UIColor {
      switch self {
      case .server:
        return .systemBlue
      case .ai:
        return .systemPurple
      case .aiHistory:
        return .systemOrange
      case .library:
        return .systemGreen
      case .appearance:
        return .systemGray
      }
    }

    func summary(settings: AppSettings) -> String {
      switch self {
      case .server:
        let value = settings.serverURLString.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? "未配置" : value
      case .ai:
        let configurations = settings.aiConfigurations
        let selected = configurations.first { $0.id == settings.selectedAIConfigurationID }
        if let selected {
          return "\(selected.name) · \(selected.model.isEmpty ? "未填模型" : selected.model)"
        }
        return configurations.isEmpty ? "未配置" : "\(configurations.count) 个终端"
      case .aiHistory:
        return "请求、返回和错误"
      case .library:
        return "\(settings.thumbnailSize.title) · \(settings.showTitlesOnLibrary ? "显示位置" : "隐藏位置")"
      case .appearance:
        return settings.interfaceStyle.title
      }
    }
  }

  private let container: AppContainer
  private let kind: Kind

  private let scrollView = UIScrollView()
  private let stackView = UIStackView()

  private let urlField = UITextField()
  private let aiURLField = UITextField()
  private let aiKeyField = UITextField()
  private let aiModelField = UITextField()
  private let aiPromptView = UITextView()
  private let aiProviderControl = UISegmentedControl(items: AppSettings.AIProvider.allCases.map(\.title))
  private let aiProfileButton = UIButton(type: .system)
  private let aiProfileSaveButton = UIButton(type: .system)
  private let aiProfileStatusLabel = UILabel()
  private let aiModelFetchButton = UIButton(type: .system)
  private let aiModelStatusLabel = UILabel()
  private let sizeControl = UISegmentedControl(items: AppSettings.ThumbnailSize.allCases.map(\.title))
  private let titleSwitch = UISwitch()
  private let thumbnailBuildButton = UIButton(type: .system)
  private let thumbnailBuildLabel = UILabel()
  private let interfaceStyleControl = UISegmentedControl(items: AppSettings.InterfaceStyle.allCases.map(\.title))
  private let serverLatencyLabel = UILabel()
  private let aiLatencyLabel = UILabel()
  private let saveButton = UIButton(type: .system)

  init(container: AppContainer, kind: Kind) {
    self.container = container
    self.kind = kind
    super.init(nibName: nil, bundle: nil)
    title = kind.title
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    configureBaseLayout()
    configureSharedControls()
    configureContent()
    loadSettings()
  }

  private func configureBaseLayout() {
    [scrollView, stackView].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
    }
    view.addSubview(scrollView)
    scrollView.addSubview(stackView)

    stackView.axis = .vertical
    stackView.spacing = 24

    NSLayoutConstraint.activate([
      scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

      stackView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
      stackView.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 16),
      stackView.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -16),
      stackView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -36)
    ])
  }

  private func configureSharedControls() {
    configureTextField(urlField, placeholder: "http://192.168.1.8:4173", keyboardType: .URL, secure: false)
    configureTextField(aiURLField, placeholder: "https://api.deepseek.com", keyboardType: .URL, secure: false)
    configureTextField(aiKeyField, placeholder: "sk-...", keyboardType: .default, secure: true)
    configureTextField(aiModelField, placeholder: "deepseek-v4-flash", keyboardType: .default, secure: false)

    let olive = UIColor(red: 0.33, green: 0.38, blue: 0.24, alpha: 1)
    [aiProviderControl, sizeControl, interfaceStyleControl].forEach {
      $0.selectedSegmentTintColor = olive
    }
    titleSwitch.onTintColor = olive

    aiProviderControl.addTarget(self, action: #selector(aiProviderChanged), for: .valueChanged)
    sizeControl.addTarget(self, action: #selector(previewSelectionHaptic), for: .valueChanged)
    titleSwitch.addTarget(self, action: #selector(previewSelectionHaptic), for: .valueChanged)
    interfaceStyleControl.addTarget(self, action: #selector(previewInterfaceStyleChange), for: .valueChanged)

    aiPromptView.backgroundColor = .secondarySystemGroupedBackground
    aiPromptView.layer.cornerRadius = 10
    aiPromptView.layer.cornerCurve = .continuous
    aiPromptView.font = .systemFont(ofSize: 14, weight: .regular)
    aiPromptView.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)
    aiPromptView.heightAnchor.constraint(equalToConstant: 220).isActive = true

    [serverLatencyLabel, aiLatencyLabel, thumbnailBuildLabel, aiModelStatusLabel, aiProfileStatusLabel].forEach {
      $0.numberOfLines = 0
      $0.font = .systemFont(ofSize: 13, weight: .regular)
      $0.textColor = .secondaryLabel
    }
    serverLatencyLabel.text = "未测试"
    aiLatencyLabel.text = "未测试"
    thumbnailBuildLabel.text = "未执行"

    var modelConfig = UIButton.Configuration.tinted()
    modelConfig.cornerStyle = .medium
    modelConfig.title = "获取模型"
    modelConfig.image = UIImage(systemName: "list.bullet.rectangle")
    modelConfig.imagePadding = 6
    aiModelFetchButton.configuration = modelConfig
    aiModelFetchButton.addTarget(self, action: #selector(fetchAIModels), for: .touchUpInside)

    var profileConfig = UIButton.Configuration.tinted()
    profileConfig.cornerStyle = .medium
    profileConfig.title = "选择配置"
    profileConfig.image = UIImage(systemName: "rectangle.stack")
    profileConfig.imagePadding = 6
    aiProfileButton.configuration = profileConfig
    aiProfileButton.addTarget(self, action: #selector(selectAIConfiguration), for: .touchUpInside)

    var saveProfileConfig = UIButton.Configuration.tinted()
    saveProfileConfig.cornerStyle = .medium
    saveProfileConfig.title = "保存当前配置"
    saveProfileConfig.image = UIImage(systemName: "tray.and.arrow.down")
    saveProfileConfig.imagePadding = 6
    aiProfileSaveButton.configuration = saveProfileConfig
    aiProfileSaveButton.addTarget(self, action: #selector(saveAIConfigurationEntry), for: .touchUpInside)

    var thumbConfig = UIButton.Configuration.tinted()
    thumbConfig.cornerStyle = .medium
    thumbConfig.title = "补齐缩略图"
    thumbConfig.image = UIImage(systemName: "photo.stack")
    thumbConfig.imagePadding = 6
    thumbnailBuildButton.configuration = thumbConfig
    thumbnailBuildButton.addTarget(self, action: #selector(buildLibraryThumbnails), for: .touchUpInside)

    var buttonConfig = UIButton.Configuration.filled()
    buttonConfig.cornerStyle = .medium
    buttonConfig.title = "保存"
    buttonConfig.baseBackgroundColor = olive
    buttonConfig.baseForegroundColor = .white
    saveButton.configuration = buttonConfig
    saveButton.addTarget(self, action: #selector(saveSettings), for: .touchUpInside)
    saveButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
  }

  private func configureContent() {
    switch kind {
    case .server:
      stackView.addArrangedSubview(makeGroup(rows: [
        makeTextRow(title: "服务端地址", detail: "用于备份、同步和元数据管理。", control: urlField),
        makeValueActionRow(title: "服务端延迟", valueLabel: serverLatencyLabel, symbolName: "bolt.fill", action: #selector(testServerLatency))
      ]))
      stackView.addArrangedSubview(makeFooterText("""
      首页、图库和地图编辑默认使用本地数据；服务端为空时不会阻塞本地功能。
      """))
      stackView.addArrangedSubview(saveButton)

    case .ai:
      stackView.addArrangedSubview(makeGroup(rows: [
        makeAIProfileRow(),
        aiProfileStatusLabel,
        makeSegmentRow(title: "供应商", control: aiProviderControl),
        makeTextRow(title: "AI API URL", detail: nil, control: aiURLField),
        makeTextRow(title: "AI API Key", detail: nil, control: aiKeyField),
        makeModelRow(),
        aiModelStatusLabel
      ]))
      stackView.addArrangedSubview(makeGroup(rows: [
        makeTextAreaRow(title: "系统提示词", control: aiPromptView),
        makeValueActionRow(title: "AI 延迟", valueLabel: aiLatencyLabel, symbolName: "bolt.fill", action: #selector(testAILatency))
      ]))
      stackView.addArrangedSubview(saveButton)

    case .aiHistory:
      break

    case .library:
      stackView.addArrangedSubview(makeGroup(rows: [
        makeSegmentRow(title: "图片尺寸", control: sizeControl),
        makeSwitchRow(title: "显示位置信息", subtitle: "首页卡片下方显示地区与年代摘要。", toggle: titleSwitch),
        makeThumbnailBuildRow()
      ]))
      stackView.addArrangedSubview(saveButton)

    case .appearance:
      stackView.addArrangedSubview(makeGroup(rows: [
        makeSegmentRow(title: "主题模式", control: interfaceStyleControl)
      ]))
      stackView.addArrangedSubview(saveButton)
    }
  }

  private func configureTextField(_ field: UITextField, placeholder: String, keyboardType: UIKeyboardType, secure: Bool) {
    field.borderStyle = .none
    field.placeholder = placeholder
    field.keyboardType = keyboardType
    field.autocapitalizationType = .none
    field.autocorrectionType = .no
    field.isSecureTextEntry = secure
    field.clearButtonMode = .whileEditing
    field.backgroundColor = .secondarySystemGroupedBackground
    field.layer.cornerRadius = 10
    field.layer.cornerCurve = .continuous
    field.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 12, height: 1))
    field.leftViewMode = .always
    field.heightAnchor.constraint(equalToConstant: 46).isActive = true
  }

  private func makeGroup(rows: [UIView]) -> UIView {
    let group = UIStackView(arrangedSubviews: rows)
    group.axis = .vertical
    group.spacing = 14
    group.isLayoutMarginsRelativeArrangement = true
    group.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16)
    group.backgroundColor = .systemBackground
    group.layer.cornerRadius = 12
    group.layer.cornerCurve = .continuous
    return group
  }

  private func makeFooterText(_ text: String) -> UILabel {
    let label = UILabel()
    label.text = text
    label.textColor = .secondaryLabel
    label.font = .systemFont(ofSize: 13, weight: .regular)
    label.numberOfLines = 0
    return label
  }

  private func makeTitleLabel(_ text: String) -> UILabel {
    let label = UILabel()
    label.text = text
    label.textColor = .label
    label.font = .systemFont(ofSize: 16, weight: .regular)
    return label
  }

  private func makeDetailLabel(_ text: String?) -> UILabel {
    let label = UILabel()
    label.text = text
    label.textColor = .secondaryLabel
    label.font = .systemFont(ofSize: 12, weight: .regular)
    label.numberOfLines = 0
    return label
  }

  private func makeTextRow(title: String, detail: String?, control: UIView) -> UIView {
    let textStack = UIStackView(arrangedSubviews: detail == nil ? [makeTitleLabel(title)] : [makeTitleLabel(title), makeDetailLabel(detail)])
    textStack.axis = .vertical
    textStack.spacing = 3

    let stack = UIStackView(arrangedSubviews: [textStack, control])
    stack.axis = .vertical
    stack.spacing = 8
    return stack
  }

  private func makeTextAreaRow(title: String, control: UIView) -> UIView {
    let stack = UIStackView(arrangedSubviews: [makeTitleLabel(title), control])
    stack.axis = .vertical
    stack.spacing = 8
    return stack
  }

  private func makeSegmentRow(title: String, control: UIView) -> UIView {
    let stack = UIStackView(arrangedSubviews: [makeTitleLabel(title), control])
    stack.axis = .vertical
    stack.spacing = 10
    return stack
  }

  private func makeSwitchRow(title: String, subtitle: String, toggle: UISwitch) -> UIView {
    let textStack = UIStackView(arrangedSubviews: [makeTitleLabel(title), makeDetailLabel(subtitle)])
    textStack.axis = .vertical
    textStack.spacing = 3
    let row = UIStackView(arrangedSubviews: [textStack, toggle])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 12
    return row
  }

  private func makeValueActionRow(title: String, valueLabel: UILabel, symbolName: String, action: Selector) -> UIView {
    let button = UIButton(type: .system)
    var config = UIButton.Configuration.plain()
    config.image = UIImage(systemName: symbolName)
    config.baseForegroundColor = .systemYellow
    config.contentInsets = .zero
    button.configuration = config
    button.addTarget(self, action: action, for: .touchUpInside)
    button.widthAnchor.constraint(equalToConstant: 34).isActive = true
    button.heightAnchor.constraint(equalToConstant: 34).isActive = true

    let valueStack = UIStackView(arrangedSubviews: [valueLabel, button])
    valueStack.axis = .horizontal
    valueStack.alignment = .center
    valueStack.spacing = 8

    let row = UIStackView(arrangedSubviews: [makeTitleLabel(title), valueStack])
    row.axis = .horizontal
    row.alignment = .center
    row.distribution = .equalSpacing
    row.spacing = 12
    return row
  }

  private func makeModelRow() -> UIView {
    let row = UIStackView(arrangedSubviews: [aiModelField, aiModelFetchButton])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 10
    aiModelField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    aiModelFetchButton.setContentCompressionResistancePriority(.required, for: .horizontal)
    return makeTextRow(title: "模型 ID", detail: "DeepSeek/OpenAI 可用默认模型；兼容接口必须填写供应商给出的精确模型 ID。", control: row)
  }

  private func makeAIProfileRow() -> UIView {
    let row = UIStackView(arrangedSubviews: [aiProfileButton, aiProfileSaveButton])
    row.axis = .horizontal
    row.alignment = .fill
    row.distribution = .fillEqually
    row.spacing = 10
    return makeTextRow(title: "配置条目", detail: "保存后可在多个供应商和模型之间快速切换。", control: row)
  }

  private func makeThumbnailBuildRow() -> UIView {
    let row = UIStackView(arrangedSubviews: [thumbnailBuildLabel, thumbnailBuildButton])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 10
    let stack = UIStackView(arrangedSubviews: [
      makeTitleLabel("缩略图缓存"),
      row
    ])
    stack.axis = .vertical
    stack.spacing = 8
    return stack
  }

  private func loadSettings() {
    urlField.text = container.settings.serverURLString
    aiURLField.text = container.settings.aiAPIURLString
    aiKeyField.text = container.settings.aiAPIKey
    aiProviderControl.selectedSegmentIndex = AppSettings.AIProvider.allCases.firstIndex(of: container.settings.aiProvider) ?? 0
    let provider = selectedAIProvider()
    let savedModel = container.settings.aiModel.trimmingCharacters(in: .whitespacesAndNewlines)
    aiModelField.text = normalizedModel(savedModel, for: provider)
    updateAIModelStatus(for: provider)
    let savedPrompt = container.settings.aiSystemPrompt
    aiPromptView.text = savedPrompt.contains("coverage_outline") ? savedPrompt : AppSettings.defaultAISystemPrompt
    updateAIProfileStatus()
    sizeControl.selectedSegmentIndex = AppSettings.ThumbnailSize.allCases.firstIndex(of: container.settings.thumbnailSize) ?? 1
    titleSwitch.isOn = container.settings.showTitlesOnLibrary
    interfaceStyleControl.selectedSegmentIndex = AppSettings.InterfaceStyle.allCases.firstIndex(of: container.settings.interfaceStyle) ?? 0
  }

  @objc private func saveSettings() {
    container.haptics.mediumTap()
    switch kind {
    case .server:
      applyServerFormSettings()
      showMessage(title: "已保存", message: "服务端设置已更新。")
    case .ai:
      applyAIFormSettings()
      guard validateAIModelForSelectedProvider() else { return }
      let entry = container.settings.saveCurrentAIConfiguration(named: nil)
      updateAIProfileStatus()
      showMessage(title: "已保存", message: "AI 编目设置已更新，并已保存配置条目：\(entry.name)。")
    case .aiHistory:
      return
    case .library:
      container.settings.thumbnailSize = AppSettings.ThumbnailSize.allCases[sizeControl.selectedSegmentIndex]
      container.settings.showTitlesOnLibrary = titleSwitch.isOn
      showMessage(title: "已保存", message: "首页显示设置已更新。")
    case .appearance:
      container.settings.interfaceStyle = AppSettings.InterfaceStyle.allCases[interfaceStyleControl.selectedSegmentIndex]
      applyInterfaceStyle(selection: container.settings.interfaceStyle)
      showMessage(title: "已保存", message: "界面外观设置已更新。")
    }
    container.haptics.success()
  }

  @objc private func aiProviderChanged() {
    container.haptics.selectionChanged()
    let provider = selectedAIProvider()
    aiURLField.text = provider.defaultBaseURL
    let current = aiModelField.text ?? ""
    if provider == .openAICompatible {
      let knownDefaults = [AppSettings.AIProvider.deepseek.defaultModel, AppSettings.AIProvider.openAI.defaultModel]
      if knownDefaults.contains(current) {
        aiModelField.text = ""
      }
    } else if current.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
      AppSettings.AIProvider.allCases.map(\.defaultModel).filter({ !$0.isEmpty }).contains(current) {
      aiModelField.text = provider.defaultModel
    }
    updateAIModelStatus(for: provider)
    updateAIProfileStatus()
  }

  @objc private func selectAIConfiguration() {
    container.haptics.selectionChanged()
    let configurations = container.settings.aiConfigurations
    guard !configurations.isEmpty else {
      showMessage(title: "暂无配置", message: "先填写供应商、API URL、Key 和模型 ID，然后点“保存当前配置”。")
      return
    }

    let alert = UIAlertController(title: "选择 AI 配置", message: "切换后会立即填入该配置。", preferredStyle: .actionSheet)
    for configuration in configurations {
      let model = configuration.model.isEmpty ? "未填模型" : configuration.model
      alert.addAction(UIAlertAction(title: "\(configuration.name)  ·  \(configuration.provider.title)  ·  \(model)", style: .default) { [weak self] _ in
        guard let self else { return }
        self.container.settings.applyAIConfiguration(configuration)
        self.loadSettings()
        self.container.haptics.success()
      })
    }
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.sourceView = aiProfileButton
      popover.sourceRect = aiProfileButton.bounds
    }
    present(alert, animated: true)
  }

  @objc private func saveAIConfigurationEntry() {
    container.haptics.selectionChanged()
    applyAIFormSettings()
    guard validateAIModelForSelectedProvider() else { return }

    let suggestedName = suggestedAIConfigurationName()
    let alert = UIAlertController(title: "保存 AI 配置", message: "保存后可在“选择配置”中切换。", preferredStyle: .alert)
    alert.addTextField { textField in
      textField.placeholder = "配置名称"
      textField.text = suggestedName
      textField.clearButtonMode = .whileEditing
    }
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "保存", style: .default) { [weak self, weak alert] _ in
      guard let self else { return }
      let name = alert?.textFields?.first?.text ?? suggestedName
      let entry = self.container.settings.saveCurrentAIConfiguration(named: name)
      self.updateAIProfileStatus()
      self.container.haptics.success()
      self.showMessage(title: "配置已保存", message: "已保存：\(entry.name)")
    })
    present(alert, animated: true)
  }

  @objc private func fetchAIModels() {
    container.haptics.selectionChanged()
    applyAIFormSettings()
    aiModelFetchButton.isEnabled = false
    aiModelStatusLabel.text = "正在从 /models 获取可用模型..."

    Task { [weak self] in
      guard let self else { return }
      do {
        let models = try await self.container.aiMetadataService.fetchAvailableModels()
        await MainActor.run {
          self.aiModelFetchButton.isEnabled = true
          guard !models.isEmpty else {
            self.container.haptics.warning()
            self.aiModelStatusLabel.text = "未返回可用模型，请检查账号权限。"
            return
          }
          self.container.haptics.success()
          self.aiModelStatusLabel.text = "已获取 \(models.count) 个模型，选择一个用于 AI 编目。"
          if self.shouldReplaceCurrentModel(with: models), let first = models.first {
            self.aiModelField.text = first
            self.applyAIFormSettings()
          }
          self.presentModelPicker(models: models)
        }
      } catch {
        await MainActor.run {
          self.aiModelFetchButton.isEnabled = true
          self.container.haptics.warning()
          self.aiModelStatusLabel.text = "获取失败：\(error.localizedDescription)"
        }
      }
    }
  }

  @objc private func testServerLatency() {
    container.haptics.selectionChanged()
    applyServerFormSettings()
    serverLatencyLabel.text = "测试中..."
    Task { [weak self] in
      guard let self else { return }
      do {
        let latency = try await self.container.apiClient.measureServerLatency()
        await MainActor.run {
          self.container.haptics.success()
          self.serverLatencyLabel.text = String(format: "%.0f ms", latency * 1000)
        }
      } catch {
        await MainActor.run {
          self.container.haptics.warning()
          self.serverLatencyLabel.text = "失败：\(error.localizedDescription)"
        }
      }
    }
  }

  @objc private func testAILatency() {
    container.haptics.selectionChanged()
    applyAIFormSettings()
    guard validateAIModelForSelectedProvider() else { return }
    aiLatencyLabel.text = "测试中..."
    Task { [weak self] in
      guard let self else { return }
      do {
        let latency = try await self.container.aiMetadataService.measureLatency()
        await MainActor.run {
          self.container.haptics.success()
          self.aiLatencyLabel.text = String(format: "%.0f ms", latency * 1000)
        }
      } catch {
        await MainActor.run {
          self.container.haptics.warning()
          self.aiLatencyLabel.text = "失败：\(error.localizedDescription)"
        }
      }
    }
  }

  @objc private func previewSelectionHaptic() {
    container.haptics.selectionChanged()
  }

  @objc private func previewInterfaceStyleChange() {
    container.haptics.selectionChanged()
    let selection = AppSettings.InterfaceStyle.allCases[interfaceStyleControl.selectedSegmentIndex]
    applyInterfaceStyle(selection: selection)
  }

  @objc private func buildLibraryThumbnails() {
    container.haptics.selectionChanged()
    thumbnailBuildButton.isEnabled = false
    thumbnailBuildLabel.text = "处理中..."

    Task { [weak self] in
      guard let self else { return }
      let store = self.container.store
      let generated = await Task.detached(priority: .utility) {
        store.generateMissingThumbnails(maxPixelSize: 1280)
      }.value

      await MainActor.run {
        self.thumbnailBuildButton.isEnabled = true
        self.thumbnailBuildLabel.text = generated == 0 ? "已是最新" : "新增 \(generated) 张"
        if generated > 0 {
          self.container.haptics.success()
          NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
        } else {
          self.container.haptics.selectionChanged()
        }
      }
    }
  }

  private func applyInterfaceStyle(selection: AppSettings.InterfaceStyle) {
    let style: UIUserInterfaceStyle
    switch selection {
    case .system:
      style = .unspecified
    case .light:
      style = .light
    case .dark:
      style = .dark
    }

    UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow }
      .forEach { $0.overrideUserInterfaceStyle = style }
  }

  private func applyServerFormSettings() {
    container.settings.serverURLString = urlField.text ?? ""
  }

  private func applyAIFormSettings() {
    let provider = selectedAIProvider()
    let apiURL = String(aiURLField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let model = String(aiModelField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let prompt = String(aiPromptView.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let resolvedModel = normalizedModel(model, for: provider)

    container.settings.aiProvider = provider
    container.settings.aiAPIURLString = apiURL.isEmpty ? provider.defaultBaseURL : apiURL
    container.settings.aiAPIKey = aiKeyField.text ?? ""
    container.settings.aiModel = resolvedModel
    container.settings.aiSystemPrompt = prompt.isEmpty ? AppSettings.defaultAISystemPrompt : prompt

    if apiURL.isEmpty {
      aiURLField.text = provider.defaultBaseURL
    }
    if model != resolvedModel {
      aiModelField.text = resolvedModel
    }
    if prompt.isEmpty || !prompt.contains("coverage_outline") {
      aiPromptView.text = AppSettings.defaultAISystemPrompt
      container.settings.aiSystemPrompt = AppSettings.defaultAISystemPrompt
    }
  }

  private func selectedAIProvider() -> AppSettings.AIProvider {
    let index = aiProviderControl.selectedSegmentIndex
    guard AppSettings.AIProvider.allCases.indices.contains(index) else {
      return .deepseek
    }
    return AppSettings.AIProvider.allCases[index]
  }

  private func normalizedModel(_ model: String, for provider: AppSettings.AIProvider) -> String {
    if model.isEmpty {
      return provider.defaultModel
    }
    if provider == .openAICompatible {
      return model
    }
    let builtInDefaults = AppSettings.AIProvider.allCases.map(\.defaultModel).filter { !$0.isEmpty }
    if model != provider.defaultModel && builtInDefaults.contains(model) {
      return provider.defaultModel
    }
    return model
  }

  private func validateAIModelForSelectedProvider() -> Bool {
    let provider = selectedAIProvider()
    let model = String(aiModelField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard provider == .openAICompatible, model.isEmpty else {
      return true
    }
    container.haptics.warning()
    aiModelStatusLabel.text = "兼容接口必须填写模型 ID，例如供应商控制台给出的 qwen-vl-max、moonshot-v1-8k、claude-3-5-sonnet 等。"
    showMessage(title: "缺少模型 ID", message: "兼容接口不会自动使用 OpenAI 默认模型。请填写供应商要求的精确模型 ID 后再保存或测试。")
    return false
  }

  private func updateAIProfileStatus() {
    let selectedID = container.settings.selectedAIConfigurationID
    let configurations = container.settings.aiConfigurations
    if let selected = configurations.first(where: { $0.id == selectedID }) {
      aiProfileStatusLabel.text = "当前配置：\(selected.name) · 共 \(configurations.count) 个配置"
    } else if configurations.isEmpty {
      aiProfileStatusLabel.text = "尚未保存配置。保存后可在 DeepSeek、OpenAI 和兼容接口之间切换。"
    } else {
      aiProfileStatusLabel.text = "当前为未保存改动 · 已保存 \(configurations.count) 个配置"
    }
  }

  private func suggestedAIConfigurationName() -> String {
    let provider = selectedAIProvider()
    let model = String(aiModelField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if model.isEmpty {
      return provider.title
    }
    return "\(provider.title) · \(model)"
  }

  private func updateAIModelStatus(for provider: AppSettings.AIProvider) {
    switch provider {
    case .deepseek:
      aiModelStatusLabel.text = "DeepSeek 默认使用 deepseek-v4-flash；也可以手动填写 deepseek-v4-pro。"
    case .openAI:
      aiModelStatusLabel.text = "填写 OpenAI API Key 后，可从 OpenAI /v1/models 获取账号可用模型。ChatGPT 登录态不能直接给第三方 App 授权，需要使用 API Key。"
    case .openAICompatible:
      aiModelStatusLabel.text = "兼容接口必须填写精确模型 ID；若服务实现 /models，也可尝试获取后选择。"
    }
  }

  private func shouldReplaceCurrentModel(with models: [String]) -> Bool {
    let current = String(aiModelField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    return current.isEmpty || !models.contains(current)
  }

  private func presentModelPicker(models: [String]) {
    let alert = UIAlertController(title: "选择模型", message: "显示前 \(min(models.count, 40)) 个可用模型", preferredStyle: .actionSheet)
    for model in models.prefix(40) {
      alert.addAction(UIAlertAction(title: model, style: .default) { [weak self] _ in
        guard let self else { return }
        self.aiModelField.text = model
        self.applyAIFormSettings()
        self.aiModelStatusLabel.text = "已选择模型：\(model)"
      })
    }
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.sourceView = aiModelFetchButton
      popover.sourceRect = aiModelFetchButton.bounds
    }
    present(alert, animated: true)
  }

  private func showMessage(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "知道了", style: .default))
    present(alert, animated: true)
  }
}

private final class AIProviderListViewController: UITableViewController {
  private let container: AppContainer
  private let providers = AppSettings.AIProvider.allCases

  init(container: AppContainer) {
    self.container = container
    super.init(style: .insetGrouped)
    title = "AI 服务商"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    tableView.backgroundColor = .systemGroupedBackground
    tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ai-provider-cell")
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .add,
      target: self,
      action: #selector(addProvider)
    )
    container.settings.seedCurrentAIConfigurationIfNeeded()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    tableView.reloadData()
  }

  override func numberOfSections(in tableView: UITableView) -> Int {
    providers.count
  }

  override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
    providers[section].title
  }

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    let count = configurations(for: providers[section]).count
    return max(count, 1)
  }

  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "ai-provider-cell", for: indexPath)
    let provider = providers[indexPath.section]
    let configurations = configurations(for: provider)
    var content = cell.defaultContentConfiguration()

    guard !configurations.isEmpty else {
      content.text = "暂无服务商"
      content.secondaryText = "点右上角 + 新增 \(provider.title) 终端"
      content.textProperties.color = .secondaryLabel
      content.secondaryTextProperties.color = .tertiaryLabel
      content.image = UIImage(systemName: "circle")
      content.imageProperties.tintColor = .tertiaryLabel
      cell.contentConfiguration = content
      cell.accessoryType = .none
      return cell
    }

    let configuration = configurations[indexPath.row]
    let isSelected = configuration.id == container.settings.selectedAIConfigurationID
    content.text = configuration.name
    content.secondaryText = "\(configuration.apiKey.isEmpty ? "未填写 Key" : "API Key · \(Self.maskedKey(configuration.apiKey))")\n\(configuration.model.isEmpty ? "未填模型" : configuration.model)"
    content.secondaryTextProperties.numberOfLines = 2
    content.image = UIImage(systemName: isSelected ? "checkmark.circle.fill" : "circle.fill")
    content.imageProperties.tintColor = isSelected ? .systemGreen : .systemGray3
    cell.contentConfiguration = content
    cell.accessoryType = .disclosureIndicator
    return cell
  }

  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    let provider = providers[indexPath.section]
    let configurations = configurations(for: provider)
    guard !configurations.isEmpty else {
      pushEditor(configuration: makeNewConfiguration(provider: provider), isNew: true)
      return
    }
    container.haptics.selectionChanged()
    pushEditor(configuration: configurations[indexPath.row], isNew: false)
  }

  override func tableView(
    _ tableView: UITableView,
    trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath
  ) -> UISwipeActionsConfiguration? {
    let provider = providers[indexPath.section]
    let configurations = configurations(for: provider)
    guard !configurations.isEmpty else { return nil }
    let configuration = configurations[indexPath.row]

    let delete = UIContextualAction(style: .destructive, title: "删除") { [weak self] _, _, completion in
      guard let self else {
        completion(false)
        return
      }
      self.confirmDelete(configuration: configuration)
      completion(true)
    }
    return UISwipeActionsConfiguration(actions: [delete])
  }

  @objc private func addProvider() {
    container.haptics.selectionChanged()
    let alert = UIAlertController(title: "新增服务商", message: nil, preferredStyle: .actionSheet)
    for provider in providers {
      alert.addAction(UIAlertAction(title: provider.title, style: .default) { [weak self] _ in
        guard let self else { return }
        self.pushEditor(configuration: self.makeNewConfiguration(provider: provider), isNew: true)
      })
    }
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController, let item = navigationItem.rightBarButtonItem {
      popover.barButtonItem = item
    }
    present(alert, animated: true)
  }

  private func pushEditor(configuration: AppSettings.AIConfiguration, isNew: Bool) {
    let editor = AIProviderDetailViewController(container: container, configuration: configuration, isNew: isNew)
    navigationController?.pushViewController(editor, animated: true)
  }

  private func configurations(for provider: AppSettings.AIProvider) -> [AppSettings.AIConfiguration] {
    container.settings.aiConfigurations
      .filter { $0.provider == provider }
      .sorted { left, right in
        left.name.localizedStandardCompare(right.name) == .orderedAscending
      }
  }

  private func makeNewConfiguration(provider: AppSettings.AIProvider) -> AppSettings.AIConfiguration {
    AppSettings.AIConfiguration(
      id: UUID().uuidString,
      name: provider.title,
      providerRawValue: provider.rawValue,
      apiURLString: provider.defaultBaseURL,
      apiKey: "",
      model: provider.defaultModel,
      systemPrompt: container.settings.aiSystemPrompt.contains("coverage_outline") ? container.settings.aiSystemPrompt : AppSettings.defaultAISystemPrompt,
      updatedAt: Date()
    )
  }

  private func confirmDelete(configuration: AppSettings.AIConfiguration) {
    let alert = UIAlertController(title: "删除 AI 服务商", message: "将删除 \(configuration.name)，不会影响 AI 对话历史。", preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "删除", style: .destructive) { [weak self] _ in
      guard let self else { return }
      self.container.settings.deleteAIConfiguration(id: configuration.id)
      self.container.haptics.success()
      self.tableView.reloadData()
    })
    present(alert, animated: true)
  }

  private static func maskedKey(_ key: String) -> String {
    let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.count > 8 else { return "••••" }
    return "\(trimmed.prefix(5))...\(trimmed.suffix(4))"
  }
}

private final class AIProviderDetailViewController: UITableViewController {
  private enum Section: Int, CaseIterable {
    case label
    case credential
    case endpoint
    case model
    case prompt
    case status
    case danger
  }

  private let container: AppContainer
  private var configuration: AppSettings.AIConfiguration
  private let isNew: Bool
  private let nameField = UITextField()
  private let apiKeyField = UITextField()
  private let apiURLField = UITextField()
  private let modelField = UITextField()
  private let promptView = UITextView()
  private let enabledSwitch = UISwitch()
  private let modelStatusLabel = UILabel()
  private var fetchedModels: [String] = []

  init(container: AppContainer, configuration: AppSettings.AIConfiguration, isNew: Bool) {
    self.container = container
    self.configuration = configuration
    self.isNew = isNew
    super.init(style: .insetGrouped)
    title = configuration.name
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    tableView.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "保存", style: .done, target: self, action: #selector(save))
    configureFields()
    loadConfiguration()
  }

  override func numberOfSections(in tableView: UITableView) -> Int {
    isNew ? Section.allCases.count - 1 : Section.allCases.count
  }

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    guard let section = Section(rawValue: section) else { return 0 }
    switch section {
    case .endpoint:
      return 2
    case .model:
      return 3
    case .danger:
      return isNew ? 0 : 1
    default:
      return 1
    }
  }

  override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
    guard let section = Section(rawValue: section) else { return nil }
    switch section {
    case .label:
      return "标签"
    case .credential:
      return "凭证"
    case .endpoint:
      return "自定义 API 地址"
    case .model:
      return "模型"
    case .prompt:
      return "系统提示词"
    case .status:
      return "状态"
    case .danger:
      return nil
    }
  }

  override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
    guard let section = Section(rawValue: section) else { return nil }
    switch section {
    case .credential:
      return "API Key 安全存储在本机 iOS 设置数据中。"
    case .endpoint:
      return "留空则使用默认端点；请求时会自动补齐 /chat/completions。"
    case .model:
      return configuration.provider == .openAICompatible ? "兼容接口必须填写供应商给出的精确模型 ID。" : nil
    case .status:
      return "启用后会立即切换为当前 AI 请求使用的配置。"
    default:
      return nil
    }
  }

  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    guard let section = Section(rawValue: indexPath.section) else { return UITableViewCell() }
    switch section {
    case .label:
      return fieldCell(title: nil, field: nameField)
    case .credential:
      return fieldCell(title: nil, field: apiKeyField, trailingSymbol: "eye")
    case .endpoint:
      if indexPath.row == 0 {
        return fieldCell(title: nil, field: apiURLField)
      }
      return switchCell(title: "自动补齐请求路径", isOn: true, enabled: false)
    case .model:
      if indexPath.row == 0 {
        return fieldCell(title: nil, field: modelField)
      }
      if indexPath.row == 1 {
        return actionCell(title: "刷新模型", symbol: "arrow.clockwise", color: .systemBlue)
      }
      return statusCell(text: modelStatusLabel.text ?? "")
    case .prompt:
      return textViewCell(promptView)
    case .status:
      return switchCell(title: "已启用", isOn: enabledSwitch.isOn, enabled: true)
    case .danger:
      return destructiveCell(title: "删除 AI 服务商")
    }
  }

  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    guard let section = Section(rawValue: indexPath.section) else { return }
    if section == .model, indexPath.row == 1 {
      fetchModels()
    } else if section == .danger {
      confirmDelete()
    }
  }

  private func configureFields() {
    configureField(nameField, placeholder: "例如 lajjiao", secure: false, keyboardType: .default)
    configureField(apiKeyField, placeholder: "sk-...", secure: true, keyboardType: .default)
    configureField(apiURLField, placeholder: configuration.provider.defaultBaseURL, secure: false, keyboardType: .URL)
    configureField(modelField, placeholder: configuration.provider.defaultModel.isEmpty ? "供应商模型 ID" : configuration.provider.defaultModel, secure: false, keyboardType: .default)
    promptView.font = .systemFont(ofSize: 14)
    promptView.backgroundColor = .clear
    promptView.textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
    promptView.heightAnchor.constraint(equalToConstant: 180).isActive = true
    enabledSwitch.onTintColor = .systemGreen
    enabledSwitch.addTarget(self, action: #selector(toggleEnabled), for: .valueChanged)
    modelStatusLabel.textColor = .secondaryLabel
    modelStatusLabel.font = .systemFont(ofSize: 13)
    modelStatusLabel.numberOfLines = 0
  }

  private func configureField(_ field: UITextField, placeholder: String, secure: Bool, keyboardType: UIKeyboardType) {
    field.placeholder = placeholder
    field.isSecureTextEntry = secure
    field.keyboardType = keyboardType
    field.autocapitalizationType = .none
    field.autocorrectionType = .no
    field.clearButtonMode = .whileEditing
  }

  private func loadConfiguration() {
    nameField.text = configuration.name
    apiKeyField.text = configuration.apiKey
    apiURLField.text = configuration.apiURLString
    modelField.text = configuration.model
    promptView.text = configuration.systemPrompt.contains("coverage_outline") ? configuration.systemPrompt : AppSettings.defaultAISystemPrompt
    enabledSwitch.isOn = configuration.id == container.settings.selectedAIConfigurationID
    updateModelStatus()
  }

  @objc private func toggleEnabled() {
    container.haptics.selectionChanged()
  }

  @objc private func save() {
    container.haptics.mediumTap()
    view.endEditing(true)
    guard let updated = makeUpdatedConfiguration() else { return }
    let select = enabledSwitch.isOn || container.settings.selectedAIConfigurationID == updated.id
    let saved = container.settings.saveAIConfiguration(updated, select: select)
    configuration = saved
    title = saved.name
    enabledSwitch.isOn = saved.id == container.settings.selectedAIConfigurationID
    container.haptics.success()
    navigationController?.popViewController(animated: true)
  }

  private func makeUpdatedConfiguration() -> AppSettings.AIConfiguration? {
    let name = String(nameField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let apiURL = String(apiURLField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let model = String(modelField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let prompt = String(promptView.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if configuration.provider == .openAICompatible && model.isEmpty {
      showMessage(title: "缺少模型 ID", message: "兼容接口必须填写供应商给出的精确模型 ID。")
      return nil
    }

    configuration.name = name.isEmpty ? configuration.provider.title : name
    configuration.apiURLString = apiURL.isEmpty ? configuration.provider.defaultBaseURL : apiURL
    configuration.apiKey = apiKeyField.text ?? ""
    configuration.model = model.isEmpty ? configuration.provider.defaultModel : model
    configuration.systemPrompt = prompt.isEmpty ? AppSettings.defaultAISystemPrompt : prompt
    configuration.updatedAt = Date()
    return configuration
  }

  private func fetchModels() {
    guard let updated = makeUpdatedConfiguration() else { return }
    configuration = container.settings.saveAIConfiguration(updated, select: true)
    modelStatusLabel.text = "正在从 /models 获取可用模型..."
    tableView.reloadSections(IndexSet(integer: Section.model.rawValue), with: .none)

    Task { [weak self] in
      guard let self else { return }
      do {
        let models = try await self.container.aiMetadataService.fetchAvailableModels()
        await MainActor.run {
          self.fetchedModels = models
          self.modelStatusLabel.text = models.isEmpty ? "未返回可用模型，请检查账号权限。" : "已获取 \(models.count) 个模型。"
          self.tableView.reloadSections(IndexSet(integer: Section.model.rawValue), with: .none)
          self.container.haptics.success()
          self.presentModelPicker(models: models)
        }
      } catch {
        await MainActor.run {
          self.modelStatusLabel.text = "获取失败：\(error.localizedDescription)"
          self.tableView.reloadSections(IndexSet(integer: Section.model.rawValue), with: .none)
          self.container.haptics.warning()
        }
      }
    }
  }

  private func presentModelPicker(models: [String]) {
    guard !models.isEmpty else { return }
    let alert = UIAlertController(title: "选择模型", message: "显示前 \(min(models.count, 40)) 个可用模型", preferredStyle: .actionSheet)
    for model in models.prefix(40) {
      alert.addAction(UIAlertAction(title: model, style: .default) { [weak self] _ in
        guard let self else { return }
        self.modelField.text = model
        self.modelStatusLabel.text = "已选择模型：\(model)"
        self.tableView.reloadSections(IndexSet(integer: Section.model.rawValue), with: .none)
      })
    }
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.sourceView = tableView
      popover.sourceRect = tableView.rectForRow(at: IndexPath(row: 1, section: Section.model.rawValue))
    }
    present(alert, animated: true)
  }

  private func updateModelStatus() {
    switch configuration.provider {
    case .deepseek:
      modelStatusLabel.text = "DeepSeek 默认使用 deepseek-v4-flash；也可以手动填写 deepseek-v4-pro。"
    case .openAI:
      modelStatusLabel.text = "可从 OpenAI /v1/models 获取账号可用模型。"
    case .openAICompatible:
      modelStatusLabel.text = "若服务实现 /models，可尝试获取后选择。"
    }
  }

  private func confirmDelete() {
    let alert = UIAlertController(title: "删除 AI 服务商", message: "将删除 \(configuration.name)，不会影响 AI 对话历史。", preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "删除", style: .destructive) { [weak self] _ in
      guard let self else { return }
      self.container.settings.deleteAIConfiguration(id: self.configuration.id)
      self.container.haptics.success()
      self.navigationController?.popViewController(animated: true)
    })
    present(alert, animated: true)
  }

  private func fieldCell(title: String?, field: UITextField, trailingSymbol: String? = nil) -> UITableViewCell {
    let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
    cell.selectionStyle = .none
    field.translatesAutoresizingMaskIntoConstraints = false
    cell.contentView.addSubview(field)
    var trailingAnchor = cell.contentView.trailingAnchor
    if let trailingSymbol {
      let button = UIButton(type: .system)
      button.translatesAutoresizingMaskIntoConstraints = false
      button.setImage(UIImage(systemName: trailingSymbol), for: .normal)
      button.tintColor = .secondaryLabel
      button.addTarget(self, action: #selector(toggleKeyVisibility), for: .touchUpInside)
      cell.contentView.addSubview(button)
      trailingAnchor = button.leadingAnchor
      NSLayoutConstraint.activate([
        button.centerYAnchor.constraint(equalTo: cell.contentView.centerYAnchor),
        button.trailingAnchor.constraint(equalTo: cell.contentView.trailingAnchor, constant: -16),
        button.widthAnchor.constraint(equalToConstant: 34),
        button.heightAnchor.constraint(equalToConstant: 34)
      ])
    }

    NSLayoutConstraint.activate([
      field.topAnchor.constraint(equalTo: cell.contentView.topAnchor, constant: 8),
      field.leadingAnchor.constraint(equalTo: cell.contentView.leadingAnchor, constant: 16),
      field.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
      field.bottomAnchor.constraint(equalTo: cell.contentView.bottomAnchor, constant: -8),
      field.heightAnchor.constraint(greaterThanOrEqualToConstant: 34)
    ])
    return cell
  }

  @objc private func toggleKeyVisibility() {
    apiKeyField.isSecureTextEntry.toggle()
  }

  private func switchCell(title: String, isOn: Bool, enabled: Bool) -> UITableViewCell {
    let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
    cell.textLabel?.text = title
    if title == "已启用" {
      cell.accessoryView = enabledSwitch
    } else {
      let toggle = UISwitch()
      toggle.isOn = isOn
      toggle.isEnabled = enabled
      cell.accessoryView = toggle
    }
    cell.selectionStyle = .none
    return cell
  }

  private func actionCell(title: String, symbol: String, color: UIColor) -> UITableViewCell {
    let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
    var content = cell.defaultContentConfiguration()
    content.text = title
    content.textProperties.color = color
    content.image = UIImage(systemName: symbol)
    content.imageProperties.tintColor = color
    cell.contentConfiguration = content
    return cell
  }

  private func statusCell(text: String) -> UITableViewCell {
    let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
    var content = cell.defaultContentConfiguration()
    content.text = text
    content.textProperties.color = .secondaryLabel
    content.textProperties.font = .systemFont(ofSize: 13)
    content.textProperties.numberOfLines = 0
    cell.contentConfiguration = content
    cell.selectionStyle = .none
    return cell
  }

  private func textViewCell(_ textView: UITextView) -> UITableViewCell {
    let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
    cell.selectionStyle = .none
    textView.translatesAutoresizingMaskIntoConstraints = false
    cell.contentView.addSubview(textView)
    NSLayoutConstraint.activate([
      textView.topAnchor.constraint(equalTo: cell.contentView.topAnchor, constant: 8),
      textView.leadingAnchor.constraint(equalTo: cell.contentView.leadingAnchor, constant: 12),
      textView.trailingAnchor.constraint(equalTo: cell.contentView.trailingAnchor, constant: -12),
      textView.bottomAnchor.constraint(equalTo: cell.contentView.bottomAnchor, constant: -8)
    ])
    return cell
  }

  private func destructiveCell(title: String) -> UITableViewCell {
    let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
    cell.textLabel?.text = title
    cell.textLabel?.textColor = .systemRed
    return cell
  }

  private func showMessage(title: String, message: String) {
    container.haptics.warning()
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "知道了", style: .default))
    present(alert, animated: true)
  }
}

private final class AITaskHistoryViewController: UITableViewController {
  private let logStore: AITaskLogStore
  private var entries: [AITaskLogStore.Entry] = []
  private let formatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "MM-dd HH:mm:ss"
    return formatter
  }()

  init(logStore: AITaskLogStore) {
    self.logStore = logStore
    super.init(style: .insetGrouped)
    title = "AI 对话历史"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    tableView.backgroundColor = .systemGroupedBackground
    tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ai-task-cell")
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "清空", style: .plain, target: self, action: #selector(clearHistory))
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(reloadEntries),
      name: .aiTaskLogStoreDidChange,
      object: nil
    )
    reloadEntries()
  }

  override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    max(entries.count, 1)
  }

  override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "ai-task-cell", for: indexPath)
    var content = cell.defaultContentConfiguration()

    guard !entries.isEmpty else {
      content.text = "暂无 AI 对话"
      content.secondaryText = "执行 AI 提取或 AI 整理后，这里会显示请求和返回数据。"
      content.image = UIImage(systemName: "clock")
      content.imageProperties.tintColor = .secondaryLabel
      cell.contentConfiguration = content
      cell.accessoryType = .none
      return cell
    }

    let entry = entries[indexPath.row]
    content.text = entry.title
    let status = entry.httpStatus.map { "\(entry.statusTitle) · HTTP \($0)" } ?? entry.statusTitle
    content.secondaryText = "\(status) · \(entry.provider) · \(entry.model.isEmpty ? "未填模型" : entry.model)\n\(formatter.string(from: entry.updatedAt))"
    content.secondaryTextProperties.numberOfLines = 2
    content.image = UIImage(systemName: iconName(for: entry.status))
    content.imageProperties.tintColor = tintColor(for: entry.status)
    cell.contentConfiguration = content
    cell.accessoryType = .disclosureIndicator
    return cell
  }

  override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    guard !entries.isEmpty else { return }
    navigationController?.pushViewController(AITaskLogDetailViewController(entry: entries[indexPath.row]), animated: true)
  }

  @objc private func reloadEntries() {
    entries = logStore.entries()
    tableView.reloadData()
  }

  @objc private func clearHistory() {
    let alert = UIAlertController(title: "清空 AI 历史", message: "这只会删除本机调试记录，不影响地图数据。", preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "清空", style: .destructive) { [weak self] _ in
      self?.logStore.clear()
    })
    present(alert, animated: true)
  }

  private func iconName(for status: String) -> String {
    switch status {
    case "running":
      return "hourglass"
    case "succeeded":
      return "checkmark.circle.fill"
    case "failed":
      return "exclamationmark.triangle.fill"
    default:
      return "circle"
    }
  }

  private func tintColor(for status: String) -> UIColor {
    switch status {
    case "running":
      return .systemBlue
    case "succeeded":
      return .systemGreen
    case "failed":
      return .systemRed
    default:
      return .secondaryLabel
    }
  }
}

private final class AITaskLogDetailViewController: UIViewController {
  private let entry: AITaskLogStore.Entry
  private let textView = UITextView()

  init(entry: AITaskLogStore.Entry) {
    self.entry = entry
    super.init(nibName: nil, bundle: nil)
    title = entry.statusTitle
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    textView.translatesAutoresizingMaskIntoConstraints = false
    textView.backgroundColor = .systemBackground
    textView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
    textView.isEditable = false
    textView.alwaysBounceVertical = true
    textView.textContainerInset = UIEdgeInsets(top: 16, left: 12, bottom: 24, right: 12)
    view.addSubview(textView)

    NSLayoutConstraint.activate([
      textView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      textView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      textView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      textView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])

    textView.text = makeDetailText()
  }

  private func makeDetailText() -> String {
    var parts: [String] = []
    parts.append("状态: \(entry.statusTitle)")
    parts.append("任务: \(entry.title)")
    parts.append("供应商: \(entry.provider)")
    parts.append("模型 ID: \(entry.model.isEmpty ? "未填写" : entry.model)")
    parts.append("Endpoint: \(entry.endpoint)")
    if let httpStatus = entry.httpStatus {
      parts.append("HTTP: \(httpStatus)")
    }
    parts.append("开始: \(entry.startedAt)")
    parts.append("更新: \(entry.updatedAt)")
    if let error = entry.errorMessage, !error.isEmpty {
      parts.append("\n错误:\n\(error)")
    }
    parts.append("\n请求对话:\n\(entry.requestPreview)")
    if let parsed = entry.parsedPreview, !parsed.isEmpty {
      parts.append("\n模型返回内容:\n\(parsed)")
    }
    if let response = entry.responsePreview, !response.isEmpty {
      parts.append("\n原始响应:\n\(response)")
    }
    return parts.joined(separator: "\n")
  }
}
