import UIKit

final class SettingsViewController: UIViewController {
  private let container: AppContainer

  private let scrollView = UIScrollView()
  private let stackView = UIStackView()
  private let serverCard = UIView()
  private let libraryCard = UIView()
  private let aiCard = UIView()
  private let appearanceCard = UIView()
  private let urlField = UITextField()
  private let aiURLField = UITextField()
  private let aiKeyField = UITextField()
  private let aiModelField = UITextField()
  private let aiPromptView = UITextView()
  private let sizeControl = UISegmentedControl(items: AppSettings.ThumbnailSize.allCases.map(\.title))
  private let titleSwitch = UISwitch()
  private let thumbnailBuildButton = UIButton(type: .system)
  private let thumbnailBuildLabel = UILabel()
  private let interfaceStyleControl = UISegmentedControl(items: AppSettings.InterfaceStyle.allCases.map(\.title))
  private let statusLabel = UILabel()
  private let serverLatencyLabel = UILabel()
  private let aiLatencyLabel = UILabel()
  private let saveButton = UIButton(type: .system)

  init(container: AppContainer) {
    self.container = container
    super.init(nibName: nil, bundle: nil)
    title = "设置"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.95, green: 0.96, blue: 0.93, alpha: 1)
    configureLayout()
    loadSettings()
  }

  private func configureLayout() {
    [scrollView, stackView].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
    }
    view.addSubview(scrollView)
    scrollView.addSubview(stackView)

    stackView.axis = .vertical
    stackView.spacing = 16

    [serverCard, libraryCard, aiCard, appearanceCard].forEach(configureCard)

    urlField.borderStyle = .none
    urlField.placeholder = "服务端地址，例如 http://192.168.1.8:4173"
    urlField.keyboardType = .URL
    urlField.autocapitalizationType = .none
    urlField.autocorrectionType = .no
    styleField(urlField)
    aiURLField.borderStyle = .none
    aiURLField.placeholder = "AI API URL，例如 https://api.openai.com/v1"
    aiURLField.keyboardType = .URL
    aiURLField.autocapitalizationType = .none
    aiURLField.autocorrectionType = .no
    styleField(aiURLField)

    aiKeyField.borderStyle = .none
    aiKeyField.placeholder = "AI API Key"
    aiKeyField.autocapitalizationType = .none
    aiKeyField.autocorrectionType = .no
    aiKeyField.isSecureTextEntry = true
    styleField(aiKeyField)

    aiModelField.borderStyle = .none
    aiModelField.placeholder = "模型名称，例如 gpt-4.1-mini"
    aiModelField.autocapitalizationType = .none
    aiModelField.autocorrectionType = .no
    styleField(aiModelField)

    aiPromptView.backgroundColor = .tertiarySystemGroupedBackground
    aiPromptView.layer.cornerRadius = 8
    aiPromptView.layer.cornerCurve = .continuous
    aiPromptView.font = .systemFont(ofSize: 14, weight: .medium)
    aiPromptView.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)
    aiPromptView.heightAnchor.constraint(equalToConstant: 180).isActive = true

    let olive = UIColor(red: 0.33, green: 0.38, blue: 0.24, alpha: 1)
    sizeControl.selectedSegmentTintColor = olive
    titleSwitch.onTintColor = olive
    interfaceStyleControl.selectedSegmentTintColor = olive
    sizeControl.addTarget(self, action: #selector(previewSelectionHaptic), for: .valueChanged)
    titleSwitch.addTarget(self, action: #selector(previewSelectionHaptic), for: .valueChanged)
    interfaceStyleControl.addTarget(self, action: #selector(previewInterfaceStyleChange), for: .valueChanged)

    statusLabel.numberOfLines = 0
    statusLabel.textColor = .secondaryLabel
    statusLabel.font = .systemFont(ofSize: 13, weight: .medium)
    [serverLatencyLabel, aiLatencyLabel].forEach {
      $0.numberOfLines = 1
      $0.font = .systemFont(ofSize: 12, weight: .medium)
      $0.textColor = .secondaryLabel
      $0.text = "未测试"
    }
    thumbnailBuildLabel.numberOfLines = 1
    thumbnailBuildLabel.font = .systemFont(ofSize: 12, weight: .medium)
    thumbnailBuildLabel.textColor = .secondaryLabel
    thumbnailBuildLabel.text = "未执行"

    var thumbConfig = UIButton.Configuration.tinted()
    thumbConfig.cornerStyle = .medium
    thumbConfig.title = "补齐首页缩略图"
    thumbConfig.image = UIImage(systemName: "photo.stack")
    thumbConfig.imagePadding = 6
    thumbnailBuildButton.configuration = thumbConfig
    thumbnailBuildButton.addTarget(self, action: #selector(buildLibraryThumbnails), for: .touchUpInside)

    var buttonConfig = UIButton.Configuration.filled()
    buttonConfig.cornerStyle = .medium
    buttonConfig.title = "保存设置"
    buttonConfig.baseBackgroundColor = olive
    buttonConfig.baseForegroundColor = .white
    saveButton.configuration = buttonConfig
    saveButton.addTarget(self, action: #selector(saveSettings), for: .touchUpInside)

    let serverStack = makeSectionStack(title: "服务端")
    [
      makeLabeledField(title: "服务端地址", view: urlField),
      statusLabel,
      makeLabeledField(title: "服务端延迟", view: makeLatencyRow(label: serverLatencyLabel, action: #selector(testServerLatency)))
    ].forEach { serverStack.addArrangedSubview($0) }
    serverCard.addSubview(serverStack)

    let libraryStack = makeSectionStack(title: "首页显示")
    libraryStack.addArrangedSubview(makeLabeledField(title: "图片尺寸", view: sizeControl))
    libraryStack.addArrangedSubview(makeSwitchRow(title: "显示位置信息", subtitle: "在首页卡片下方显示地区与年代信息，不显示图片文件标题", toggle: titleSwitch))
    libraryStack.addArrangedSubview(makeLabeledField(title: "缩略图缓存", view: makeThumbnailBuildRow()))
    libraryCard.addSubview(libraryStack)
    let aiStack = makeSectionStack(title: "AI 编目")
    [
      makeLabeledField(title: "AI API URL", view: aiURLField),
      makeLabeledField(title: "AI API Key", view: aiKeyField),
      makeLabeledField(title: "模型", view: aiModelField),
      makeLabeledField(title: "系统提示词", view: aiPromptView),
      makeLabeledField(title: "AI 延迟", view: makeLatencyRow(label: aiLatencyLabel, action: #selector(testAILatency)))
    ].forEach { aiStack.addArrangedSubview($0) }
    aiCard.addSubview(aiStack)

    let appearanceStack = makeSectionStack(title: "界面外观")
    appearanceStack.addArrangedSubview(makeLabeledField(title: "主题模式", view: interfaceStyleControl))
    appearanceStack.addArrangedSubview(saveButton)
    appearanceCard.addSubview(appearanceStack)

    [serverCard, libraryCard, aiCard, appearanceCard].forEach { stackView.addArrangedSubview($0) }

    NSLayoutConstraint.activate([
      scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),

      stackView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 18),
      stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      stackView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -32),
      stackView.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -32),

      serverStack.topAnchor.constraint(equalTo: serverCard.layoutMarginsGuide.topAnchor),
      serverStack.leadingAnchor.constraint(equalTo: serverCard.layoutMarginsGuide.leadingAnchor),
      serverStack.trailingAnchor.constraint(equalTo: serverCard.layoutMarginsGuide.trailingAnchor),
      serverStack.bottomAnchor.constraint(equalTo: serverCard.layoutMarginsGuide.bottomAnchor),

      libraryStack.topAnchor.constraint(equalTo: libraryCard.layoutMarginsGuide.topAnchor),
      libraryStack.leadingAnchor.constraint(equalTo: libraryCard.layoutMarginsGuide.leadingAnchor),
      libraryStack.trailingAnchor.constraint(equalTo: libraryCard.layoutMarginsGuide.trailingAnchor),
      libraryStack.bottomAnchor.constraint(equalTo: libraryCard.layoutMarginsGuide.bottomAnchor),

      aiStack.topAnchor.constraint(equalTo: aiCard.layoutMarginsGuide.topAnchor),
      aiStack.leadingAnchor.constraint(equalTo: aiCard.layoutMarginsGuide.leadingAnchor),
      aiStack.trailingAnchor.constraint(equalTo: aiCard.layoutMarginsGuide.trailingAnchor),
      aiStack.bottomAnchor.constraint(equalTo: aiCard.layoutMarginsGuide.bottomAnchor),

      appearanceStack.topAnchor.constraint(equalTo: appearanceCard.layoutMarginsGuide.topAnchor),
      appearanceStack.leadingAnchor.constraint(equalTo: appearanceCard.layoutMarginsGuide.leadingAnchor),
      appearanceStack.trailingAnchor.constraint(equalTo: appearanceCard.layoutMarginsGuide.trailingAnchor),
      appearanceStack.bottomAnchor.constraint(equalTo: appearanceCard.layoutMarginsGuide.bottomAnchor)
    ])
  }

  private func configureCard(_ view: UIView) {
    view.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
    view.layer.cornerRadius = 8
    view.layer.cornerCurve = .continuous
    view.layer.borderWidth = 1
    view.layer.borderColor = UIColor(red: 0.50, green: 0.52, blue: 0.44, alpha: 0.26).cgColor
    view.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 18, leading: 16, bottom: 18, trailing: 16)
  }

  private func styleField(_ field: UITextField) {
    field.backgroundColor = .tertiarySystemGroupedBackground
    field.layer.cornerRadius = 8
    field.layer.cornerCurve = .continuous
    field.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 12, height: 1))
    field.leftViewMode = .always
    field.heightAnchor.constraint(equalToConstant: 46).isActive = true
  }

  private func makeSectionStack(title: String) -> UIStackView {
    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 14

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
    titleLabel.textColor = .label
    titleLabel.text = title
    stack.addArrangedSubview(titleLabel)
    return stack
  }

  private func makeLabeledField(title: String, view: UIView) -> UIStackView {
    let label = UILabel()
    label.font = .systemFont(ofSize: 13, weight: .semibold)
    label.textColor = .secondaryLabel
    label.text = title

    let stack = UIStackView(arrangedSubviews: [label, view])
    stack.axis = .vertical
    stack.spacing = 8
    return stack
  }

  private func makeSwitchRow(title: String, subtitle: String, toggle: UISwitch) -> UIView {
    let titleLabel = UILabel()
    let subtitleLabel = UILabel()
    let textStack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
    let row = UIStackView(arrangedSubviews: [textStack, toggle])

    titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
    titleLabel.textColor = .label
    titleLabel.text = title

    subtitleLabel.font = .systemFont(ofSize: 12, weight: .medium)
    subtitleLabel.textColor = .secondaryLabel
    subtitleLabel.numberOfLines = 0
    subtitleLabel.text = subtitle

    textStack.axis = .vertical
    textStack.spacing = 4

    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 12
    return row
  }

  private func makeLatencyRow(label: UILabel, action: Selector) -> UIView {
    let button = UIButton(type: .system)
    button.translatesAutoresizingMaskIntoConstraints = false
    var config = UIButton.Configuration.plain()
    config.image = UIImage(systemName: "bolt.fill")
    config.baseForegroundColor = .systemYellow
    config.contentInsets = .zero
    button.configuration = config
    button.addTarget(self, action: action, for: .touchUpInside)
    button.widthAnchor.constraint(equalToConstant: 28).isActive = true
    button.heightAnchor.constraint(equalToConstant: 28).isActive = true

    let row = UIStackView(arrangedSubviews: [label, button])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 8
    return row
  }

  private func makeThumbnailBuildRow() -> UIView {
    let row = UIStackView(arrangedSubviews: [thumbnailBuildLabel, thumbnailBuildButton])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 10
    return row
  }

  private func loadSettings() {
    urlField.text = container.settings.serverURLString
    aiURLField.text = container.settings.aiAPIURLString
    aiKeyField.text = container.settings.aiAPIKey
    aiModelField.text = container.settings.aiModel
    aiPromptView.text = container.settings.aiSystemPrompt
    sizeControl.selectedSegmentIndex = AppSettings.ThumbnailSize.allCases.firstIndex(of: container.settings.thumbnailSize) ?? 1
    titleSwitch.isOn = container.settings.showTitlesOnLibrary
    interfaceStyleControl.selectedSegmentIndex = AppSettings.InterfaceStyle.allCases.firstIndex(of: container.settings.interfaceStyle) ?? 0
    statusLabel.text = """
    本地优先：
    1. 首页只负责搜索和浏览地图图片
    2. 整理页负责批量 OCR、AI 编目、地区与年代整理
    3. AI 接口需返回 JSON，用于自动回填元数据
    4. 服务端只用于备份、同步和元数据管理
    """
  }

  @objc private func saveSettings() {
    container.haptics.mediumTap()
    container.settings.serverURLString = urlField.text ?? ""
    container.settings.aiAPIURLString = aiURLField.text ?? ""
    container.settings.aiAPIKey = aiKeyField.text ?? ""
    container.settings.aiModel = aiModelField.text ?? ""
    container.settings.aiSystemPrompt = aiPromptView.text ?? AppSettings.defaultAISystemPrompt
    container.settings.thumbnailSize = AppSettings.ThumbnailSize.allCases[sizeControl.selectedSegmentIndex]
    container.settings.showTitlesOnLibrary = titleSwitch.isOn
    container.settings.interfaceStyle = AppSettings.InterfaceStyle.allCases[interfaceStyleControl.selectedSegmentIndex]
    applyInterfaceStyle(selection: container.settings.interfaceStyle)
    container.haptics.success()
    showMessage(title: "已保存", message: "首页显示和主题设置已更新。")
  }

  @objc private func testServerLatency() {
    container.haptics.selectionChanged()
    serverLatencyLabel.text = "测试中…"
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
    aiLatencyLabel.text = "测试中…"
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
    thumbnailBuildLabel.text = "处理中…"

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

  private func showMessage(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "知道了", style: .default))
    present(alert, animated: true)
  }
}
