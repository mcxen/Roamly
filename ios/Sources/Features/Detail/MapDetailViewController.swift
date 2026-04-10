import UIKit
import Vision
import ImageIO

final class MapDetailViewController: UIViewController, UIScrollViewDelegate, UITextFieldDelegate, UITextViewDelegate {
  private let minimalDetailMode = false
  private let container: AppContainer
  private var record: MapRecord
  private let onSave: (MapRecord) -> Void

  private let scrollView = UIScrollView()
  private let stackView = UIStackView()
  private let imageCard = UIView()
  private let imageZoomScrollView = UIScrollView()
  private let imageContainerView = UIView()
  private let imageView = UIImageView()
  private let floatingActionRow = UIStackView()
  private let infoButton = UIButton(type: .system)
  private let infoPanel = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
  private let panelGrabber = UIView()
  private let statusCard = UIView()
  private let metadataCard = UIView()
  private let ocrCard = UIView()
  private let assetStatusLabel = UILabel()
  private let imageActionButton = UIButton(type: .system)
  private let ocrActionButton = UIButton(type: .system)
  private let titleField = UITextField()
  private let yearField = UITextField()
  private let campaignField = UITextField()
  private let teachingUseField = UITextField()
  private let securityLevelField = UITextField()
  private let countryButton = UIButton(type: .system)
  private let provinceButton = UIButton(type: .system)
  private let cityButton = UIButton(type: .system)
  private let districtButton = UIButton(type: .system)
  private let tagsField = UITextField()
  private let descriptionView = UITextView()
  private let teachingNoteView = UITextView()
  private let ocrLabel = UILabel()
  private var panelHeightConstraint: NSLayoutConstraint?
  private var panelWidthConstraint: NSLayoutConstraint?
  private var selectedCountryName = ""
  private var selectedProvinceName = ""
  private var selectedCityName = ""
  private var selectedDistrictName = ""
  private var isInfoPanelPresented = false
  private var panelPanStartTransform: CGAffineTransform = .identity
  private var previousStandardAppearance: UINavigationBarAppearance?
  private var previousScrollEdgeAppearance: UINavigationBarAppearance?
  private var previousCompactAppearance: UINavigationBarAppearance?
  private var previousTintColor: UIColor?
  private var imageLoadTask: Task<Void, Never>?
  private var currentImageRequestID = UUID()
  private var lastLayoutBounds: CGSize = .zero

  init(container: AppContainer, record: MapRecord, onSave: @escaping (MapRecord) -> Void) {
    self.container = container
    self.record = record
    self.onSave = onSave
    super.init(nibName: nil, bundle: nil)
    title = ""
    hidesBottomBarWhenPushed = true
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "保存", style: .done, target: self, action: #selector(saveMetadata))
    configureLayout()
    applyMinimalReadingMode()
    render()
    loadRemoteDetailIfNeeded()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    applyImmersiveNavigationAppearance()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    restoreNavigationAppearance()
  }

  deinit {
    imageLoadTask?.cancel()
  }

  private func configureLayout() {
    scrollView.translatesAutoresizingMaskIntoConstraints = false
    stackView.translatesAutoresizingMaskIntoConstraints = false
    imageCard.translatesAutoresizingMaskIntoConstraints = false
    imageZoomScrollView.translatesAutoresizingMaskIntoConstraints = false
    floatingActionRow.translatesAutoresizingMaskIntoConstraints = false
    statusCard.translatesAutoresizingMaskIntoConstraints = false
    metadataCard.translatesAutoresizingMaskIntoConstraints = false
    ocrCard.translatesAutoresizingMaskIntoConstraints = false
    infoButton.translatesAutoresizingMaskIntoConstraints = false
    infoPanel.translatesAutoresizingMaskIntoConstraints = false
    panelGrabber.translatesAutoresizingMaskIntoConstraints = false
    assetStatusLabel.translatesAutoresizingMaskIntoConstraints = false
    imageActionButton.translatesAutoresizingMaskIntoConstraints = false

    if minimalDetailMode {
      view.addSubview(imageCard)
      imageCard.addSubview(imageZoomScrollView)
      imageZoomScrollView.addSubview(imageContainerView)
      imageContainerView.addSubview(imageView)

      imageCard.backgroundColor = .clear
      imageCard.layer.cornerRadius = 0
      imageCard.layer.shadowOpacity = 0
      imageCard.clipsToBounds = false

      imageZoomScrollView.backgroundColor = .clear
      imageZoomScrollView.clipsToBounds = true
      imageZoomScrollView.showsVerticalScrollIndicator = false
      imageZoomScrollView.showsHorizontalScrollIndicator = false
      imageZoomScrollView.contentInsetAdjustmentBehavior = .never
      imageZoomScrollView.minimumZoomScale = 1
      imageZoomScrollView.maximumZoomScale = 20
      imageZoomScrollView.delegate = self
      let doubleTapGesture = UITapGestureRecognizer(target: self, action: #selector(handleImageDoubleTap(_:)))
      doubleTapGesture.numberOfTapsRequired = 2
      imageZoomScrollView.addGestureRecognizer(doubleTapGesture)

      imageContainerView.translatesAutoresizingMaskIntoConstraints = true
      imageView.translatesAutoresizingMaskIntoConstraints = true
      imageView.contentMode = .scaleAspectFit
      imageView.backgroundColor = .clear
      imageView.image = loadBestImage()

      NSLayoutConstraint.activate([
        imageCard.topAnchor.constraint(equalTo: view.topAnchor),
        imageCard.leadingAnchor.constraint(equalTo: view.leadingAnchor),
        imageCard.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        imageCard.bottomAnchor.constraint(equalTo: view.bottomAnchor),

        imageZoomScrollView.topAnchor.constraint(equalTo: imageCard.topAnchor),
        imageZoomScrollView.leadingAnchor.constraint(equalTo: imageCard.leadingAnchor),
        imageZoomScrollView.trailingAnchor.constraint(equalTo: imageCard.trailingAnchor),
        imageZoomScrollView.bottomAnchor.constraint(equalTo: imageCard.bottomAnchor)
      ])
      return
    }

    view.addSubview(imageCard)
    view.addSubview(floatingActionRow)
    view.addSubview(infoPanel)
    view.addSubview(infoButton)
    infoPanel.contentView.addSubview(panelGrabber)
    infoPanel.contentView.addSubview(scrollView)
    scrollView.addSubview(stackView)

    stackView.axis = .vertical
    stackView.spacing = 12
    scrollView.alwaysBounceVertical = true
    scrollView.showsVerticalScrollIndicator = false
    scrollView.contentInsetAdjustmentBehavior = .always

    [imageCard, statusCard, metadataCard, ocrCard].forEach(configureCard)

    imageCard.backgroundColor = .clear
    imageCard.layer.cornerRadius = 0
    imageCard.layer.shadowOpacity = 0
    imageCard.clipsToBounds = false

    imageZoomScrollView.backgroundColor = .clear
    imageZoomScrollView.clipsToBounds = true
    imageZoomScrollView.showsVerticalScrollIndicator = false
    imageZoomScrollView.showsHorizontalScrollIndicator = false
    imageZoomScrollView.contentInsetAdjustmentBehavior = .never
    imageZoomScrollView.minimumZoomScale = 1
    imageZoomScrollView.maximumZoomScale = 20
    imageZoomScrollView.delegate = self
    let doubleTapGesture = UITapGestureRecognizer(target: self, action: #selector(handleImageDoubleTap(_:)))
    doubleTapGesture.numberOfTapsRequired = 2
    imageZoomScrollView.addGestureRecognizer(doubleTapGesture)

    imageContainerView.translatesAutoresizingMaskIntoConstraints = true
    imageView.translatesAutoresizingMaskIntoConstraints = true
    imageView.contentMode = .scaleAspectFit
    imageView.backgroundColor = .clear
    imageView.image = loadBestImage()
    imageCard.addSubview(imageZoomScrollView)
    imageZoomScrollView.addSubview(imageContainerView)
    imageContainerView.addSubview(imageView)

    floatingActionRow.axis = .horizontal
    floatingActionRow.spacing = 8
    floatingActionRow.alignment = .center
    floatingActionRow.addArrangedSubview(ocrActionButton)
    floatingActionRow.addArrangedSubview(imageActionButton)

    infoPanel.layer.cornerRadius = 30
    infoPanel.layer.cornerCurve = .continuous
    infoPanel.layer.masksToBounds = true
    infoPanel.layer.borderWidth = 1
    infoPanel.layer.borderColor = UIColor.white.withAlphaComponent(0.12).cgColor

    panelGrabber.backgroundColor = UIColor.tertiaryLabel.withAlphaComponent(0.6)
    panelGrabber.layer.cornerRadius = 2.5
    panelGrabber.layer.cornerCurve = .continuous

    let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handleInfoPanelPan(_:)))
    infoPanel.addGestureRecognizer(panGesture)

    [titleField, yearField, campaignField, teachingUseField, securityLevelField, tagsField].forEach { field in
      styleField(field)
      field.delegate = self
    }
    titleField.placeholder = "标题"
    yearField.placeholder = "年代"
    campaignField.placeholder = "专题 / 战役"
    teachingUseField.placeholder = "教学用途"
    securityLevelField.placeholder = "密级"
    tagsField.placeholder = "标签，逗号分隔"
    [countryButton, provinceButton, cityButton, districtButton].forEach(styleSelectionButton)
    wireSelectionActions()

    descriptionView.translatesAutoresizingMaskIntoConstraints = false
    descriptionView.backgroundColor = .tertiarySystemBackground
    descriptionView.textColor = .label
    descriptionView.layer.cornerRadius = 14
    descriptionView.layer.borderWidth = 1
    descriptionView.layer.borderColor = UIColor.separator.cgColor
    descriptionView.font = .systemFont(ofSize: 15, weight: .medium)
    descriptionView.textContainerInset = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
    descriptionView.heightAnchor.constraint(equalToConstant: 132).isActive = true
    teachingNoteView.translatesAutoresizingMaskIntoConstraints = false
    teachingNoteView.backgroundColor = descriptionView.backgroundColor
    teachingNoteView.textColor = descriptionView.textColor
    teachingNoteView.layer.cornerRadius = 14
    teachingNoteView.layer.borderWidth = 1
    teachingNoteView.layer.borderColor = descriptionView.layer.borderColor
    teachingNoteView.font = .systemFont(ofSize: 15, weight: .medium)
    teachingNoteView.textContainerInset = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
    teachingNoteView.heightAnchor.constraint(equalToConstant: 110).isActive = true
    descriptionView.delegate = self
    teachingNoteView.delegate = self

    ocrLabel.numberOfLines = 0
    ocrLabel.textColor = .secondaryLabel
    ocrLabel.font = .systemFont(ofSize: 14, weight: .medium)

    assetStatusLabel.font = .systemFont(ofSize: 13, weight: .semibold)
    assetStatusLabel.textColor = .secondaryLabel
    assetStatusLabel.numberOfLines = 3

    var infoConfig = UIButton.Configuration.filled()
    infoConfig.image = UIImage(systemName: "info.circle.fill")
    infoConfig.baseBackgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.92)
    infoConfig.baseForegroundColor = .label
    infoConfig.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
    infoButton.configuration = infoConfig
    infoButton.layer.cornerRadius = 24
    infoButton.layer.cornerCurve = .continuous
    infoButton.layer.masksToBounds = true
    infoButton.addTarget(self, action: #selector(toggleInformationPanel), for: .touchUpInside)

    styleFloatingActionButton(
      imageActionButton,
      title: "原图",
      symbol: "arrow.down.circle"
    )
    imageActionButton.addTarget(self, action: #selector(handleImageAction), for: .touchUpInside)

    styleFloatingActionButton(
      ocrActionButton,
      title: "OCR",
      symbol: "text.viewfinder"
    )
    ocrActionButton.addTarget(self, action: #selector(runNativeOCR), for: .touchUpInside)

    let statusStack = UIStackView(arrangedSubviews: [assetStatusLabel])
    statusStack.translatesAutoresizingMaskIntoConstraints = false
    statusStack.axis = .vertical
    statusStack.alignment = .fill
    statusStack.spacing = 10
    statusCard.addSubview(statusStack)

    let metadataStack = UIStackView()
    metadataStack.translatesAutoresizingMaskIntoConstraints = false
    metadataStack.axis = .vertical
    metadataStack.spacing = 12
    metadataCard.addSubview(metadataStack)

    let titleGroup = makeFieldGroup(title: "地图名称", field: titleField)
    let yearCountryRow = makeDualFieldRow(
      leftTitle: "地图年代",
      leftField: yearField,
      rightTitle: "国家/地区",
      rightField: countryButton
    )
    let provinceRow = makeDualFieldRow(
      leftTitle: "省/州",
      leftField: provinceButton,
      rightTitle: "城市",
      rightField: cityButton
    )
    let teachingRow = makeDualFieldRow(
      leftTitle: "专题 / 战役",
      leftField: campaignField,
      rightTitle: "教学用途",
      rightField: teachingUseField
    )
    let securityTagsRow = makeDualFieldRow(
      leftTitle: "密级",
      leftField: securityLevelField,
      rightTitle: "标签",
      rightField: tagsField
    )
    let districtRow = makeFieldGroup(title: "区/县/行政区", field: districtButton)
    let descriptionGroup = makeTextViewGroup(title: "说明备注", textView: descriptionView)
    let teachingNoteGroup = makeTextViewGroup(title: "授课备注", textView: teachingNoteView)

    [makeSectionTitle("基础信息"), titleGroup, yearCountryRow, teachingRow, provinceRow, districtRow, securityTagsRow, descriptionGroup, teachingNoteGroup].forEach {
      metadataStack.addArrangedSubview($0)
    }

    let ocrStack = UIStackView()
    ocrStack.translatesAutoresizingMaskIntoConstraints = false
    ocrStack.axis = .vertical
    ocrStack.spacing = 10
    ocrCard.addSubview(ocrStack)
    [makeSectionTitle("OCR 摘要"), ocrLabel].forEach {
      ocrStack.addArrangedSubview($0)
    }

    [statusCard, metadataCard, ocrCard].forEach {
      stackView.addArrangedSubview($0)
    }
    panelHeightConstraint = infoPanel.heightAnchor.constraint(equalToConstant: 380)
    panelWidthConstraint = infoPanel.widthAnchor.constraint(equalToConstant: 400)

    NSLayoutConstraint.activate([
      imageCard.topAnchor.constraint(equalTo: view.topAnchor),
      imageCard.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      imageCard.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      imageCard.bottomAnchor.constraint(equalTo: view.bottomAnchor),

      infoPanel.topAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
      infoPanel.leadingAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
      infoPanel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
      infoPanel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),

      infoButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -18),
      infoButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -18),
      infoButton.widthAnchor.constraint(equalToConstant: 48),
      infoButton.heightAnchor.constraint(equalToConstant: 48),

      floatingActionRow.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
      floatingActionRow.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -18),

      imageZoomScrollView.topAnchor.constraint(equalTo: imageCard.topAnchor),
      imageZoomScrollView.leadingAnchor.constraint(equalTo: imageCard.leadingAnchor),
      imageZoomScrollView.trailingAnchor.constraint(equalTo: imageCard.trailingAnchor),
      imageZoomScrollView.bottomAnchor.constraint(equalTo: imageCard.bottomAnchor),

      panelGrabber.topAnchor.constraint(equalTo: infoPanel.contentView.topAnchor, constant: 10),
      panelGrabber.centerXAnchor.constraint(equalTo: infoPanel.contentView.centerXAnchor),
      panelGrabber.widthAnchor.constraint(equalToConstant: 42),
      panelGrabber.heightAnchor.constraint(equalToConstant: 5),

      scrollView.topAnchor.constraint(equalTo: panelGrabber.bottomAnchor, constant: 8),
      scrollView.leadingAnchor.constraint(equalTo: infoPanel.contentView.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: infoPanel.contentView.trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: infoPanel.contentView.bottomAnchor),

      stackView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 8),
      stackView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 12),
      stackView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -12),
      stackView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
      stackView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -24),

      statusStack.topAnchor.constraint(equalTo: statusCard.layoutMarginsGuide.topAnchor),
      statusStack.leadingAnchor.constraint(equalTo: statusCard.layoutMarginsGuide.leadingAnchor),
      statusStack.trailingAnchor.constraint(equalTo: statusCard.layoutMarginsGuide.trailingAnchor),
      statusStack.bottomAnchor.constraint(equalTo: statusCard.layoutMarginsGuide.bottomAnchor),

      metadataStack.topAnchor.constraint(equalTo: metadataCard.layoutMarginsGuide.topAnchor),
      metadataStack.leadingAnchor.constraint(equalTo: metadataCard.layoutMarginsGuide.leadingAnchor),
      metadataStack.trailingAnchor.constraint(equalTo: metadataCard.layoutMarginsGuide.trailingAnchor),
      metadataStack.bottomAnchor.constraint(equalTo: metadataCard.layoutMarginsGuide.bottomAnchor),

      ocrStack.topAnchor.constraint(equalTo: ocrCard.layoutMarginsGuide.topAnchor),
      ocrStack.leadingAnchor.constraint(equalTo: ocrCard.layoutMarginsGuide.leadingAnchor),
      ocrStack.trailingAnchor.constraint(equalTo: ocrCard.layoutMarginsGuide.trailingAnchor),
      ocrStack.bottomAnchor.constraint(equalTo: ocrCard.layoutMarginsGuide.bottomAnchor)
    ])
    panelHeightConstraint?.isActive = true
    updateAdaptiveLayout()
  }

  private func applyMinimalReadingMode() {
    // Keep editing path via info panel, but hide non-essential action chips.
    floatingActionRow.isHidden = true
    floatingActionRow.alpha = 0
    floatingActionRow.isUserInteractionEnabled = false

    statusCard.isHidden = true
    ocrCard.isHidden = true
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let boundsSize = view.bounds.size
    guard boundsSize != lastLayoutBounds else { return }
    lastLayoutBounds = boundsSize
    if minimalDetailMode {
      updateZoomScales()
      centerImage()
      return
    }
    updateAdaptiveLayout()
    updateZoomScales()
    centerImage()
  }

  private func render() {
    requestDisplayImage()
    titleField.text = record.title
    yearField.text = record.yearLabel
    campaignField.text = record.campaign
    teachingUseField.text = record.teachingUse
    securityLevelField.text = record.securityLevel
    selectedCountryName = container.regionCatalog.displayCountryName(for: record.countryName)
    selectedProvinceName = record.province ?? ""
    selectedCityName = record.city ?? ""
    selectedDistrictName = record.district ?? ""
    updateSelectionTitles()
    tagsField.text = record.tags.joined(separator: ", ")
    descriptionView.text = record.description
    teachingNoteView.text = record.teachingNote

    let excerpt = record.ocrText?.isEmpty == false ? record.ocrText! : record.ocrExcerpt
    ocrLabel.text = excerpt.isEmpty ? "无 OCR 文本" : "OCR 摘要\n\(excerpt)"
    assetStatusLabel.text = assetStatusText()
    updateImageActionButton()
  }

  private func updateAdaptiveLayout() {
    let usePadPanel = traitCollection.userInterfaceIdiom == .pad || traitCollection.horizontalSizeClass == .regular
    let safeHeight = max(view.bounds.height - view.safeAreaInsets.top - view.safeAreaInsets.bottom, 420)
    let safeWidth = max(view.bounds.width - view.safeAreaInsets.left - view.safeAreaInsets.right, 320)

    if usePadPanel {
      panelWidthConstraint?.isActive = true
      panelHeightConstraint?.constant = safeHeight - 24
      panelWidthConstraint?.constant = min(max(safeWidth * 0.34, 360), 440)
      panelGrabber.alpha = 0
      floatingActionRow.axis = .vertical
      floatingActionRow.alignment = .trailing
    } else {
      panelWidthConstraint?.isActive = false
      panelHeightConstraint?.constant = min(max(safeHeight * 0.46, 300), 430)
      panelGrabber.alpha = 1
      floatingActionRow.axis = .horizontal
      floatingActionRow.alignment = .center
    }
    applyInfoPanelState(animated: false)
  }

  @objc private func saveMetadata() {
    container.haptics.mediumTap()
    let tags = String(tagsField.text ?? "")
      .split(separator: ",")
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    let updated = record.withEditableMetadata(
      title: titleField.text?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? titleField.text!.trimmingCharacters(in: .whitespacesAndNewlines) : record.fileName,
      description: descriptionView.text ?? "",
      yearLabel: yearField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
      campaign: campaignField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
      teachingUse: teachingUseField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
      teachingNote: teachingNoteView.text ?? "",
      securityLevel: securityLevelField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
      countryName: selectedCountryName,
      province: selectedProvinceName,
      city: selectedCityName,
      district: selectedDistrictName,
      tags: tags
    )

    do {
      try container.store.updateRecord(updated)
      record = updated
      onSave(updated)
      Task { [weak self] in
        guard let self else { return }
        let message: String
        if self.container.settings.serverBaseURL != nil, !updated.id.hasPrefix("local-") {
          do {
            let remote = try await self.container.apiClient.saveMetadata(for: updated)
            let merged = remote.withImportedAt(updated.importedAt)
            self.record = merged
            try? self.container.store.updateRecord(merged)
            self.onSave(merged)
            self.container.haptics.success()
            message = "本地元数据已更新，并已同步到服务端。"
          } catch {
            self.container.haptics.warning()
            message = "本地元数据已更新，但服务端同步失败：\(error.localizedDescription)"
          }
        } else {
          self.container.haptics.success()
          message = "本地元数据已更新。"
        }

        let alert = UIAlertController(title: "已保存", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "知道了", style: .default))
        self.present(alert, animated: true)
      }
    } catch {
      container.haptics.error()
      let alert = UIAlertController(title: "保存失败", message: error.localizedDescription, preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "知道了", style: .default))
      present(alert, animated: true)
    }
  }

  private func loadRemoteDetailIfNeeded() {
    guard container.settings.serverBaseURL != nil, !record.id.hasPrefix("local-") else {
      return
    }

    Task { [weak self] in
      guard let self else { return }
      do {
        let remote = try await self.container.apiClient.fetchDetail(id: self.record.id)
        let merged = remote.withImportedAt(self.record.importedAt)
        self.record = merged
        try? self.container.store.updateRecord(merged)
        self.render()
      } catch {
        // Keep local detail if offline.
      }
    }
  }

  private func loadBestImage() -> UIImage? {
    guard let url = preferredImageURL() else { return nil }
    return UIImage(contentsOfFile: url.path)
  }

  private func preferredImageURL() -> URL? {
    let originalURL = container.store.localOriginalURL(for: record)
    if FileManager.default.fileExists(atPath: originalURL.path) {
      return originalURL
    }

    let thumbnailURL = container.store.localThumbnailURL(for: record)
    if FileManager.default.fileExists(atPath: thumbnailURL.path) {
      return thumbnailURL
    }
    return nil
  }

  private func requestDisplayImage() {
    imageLoadTask?.cancel()
    let requestID = UUID()
    currentImageRequestID = requestID

    guard let imageURL = preferredImageURL() else {
      imageView.image = nil
      updateZoomScales(resetZoom: true)
      return
    }

    let scale = view.window?.screen.scale ?? UIScreen.main.scale
    let viewportMax = max(view.bounds.width, view.bounds.height, 1)
    let isOriginal = imageURL == container.store.localOriginalURL(for: record)
    let targetPixelSize = min(
      max(viewportMax * scale * (isOriginal ? 5.5 : 3.0), isOriginal ? 2400 : 1400),
      isOriginal ? 4096 : 2048
    )

    imageLoadTask = Task.detached(priority: .userInitiated) { [weak self] in
      guard let self else { return }
      let image = autoreleasepool {
        Self.downsampledImage(at: imageURL, maxPixelSize: targetPixelSize)
      }
      guard !Task.isCancelled else { return }
      await MainActor.run {
        guard self.currentImageRequestID == requestID else { return }
        self.imageView.image = image
        self.imageZoomScrollView.zoomScale = 1
        self.updateZoomScales(resetZoom: true)
      }
    }
  }

  nonisolated private static func downsampledImage(at url: URL, maxPixelSize: CGFloat) -> UIImage? {
    let options = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, options) else { return nil }

    let downsampleOptions = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceShouldCacheImmediately: false,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: max(Int(maxPixelSize.rounded()), 1)
    ] as CFDictionary

    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, downsampleOptions) else {
      return nil
    }
    return UIImage(cgImage: cgImage)
  }

  private func updateZoomScales(resetZoom: Bool = false) {
    let boundsSize = imageZoomScrollView.bounds.size
    guard boundsSize.width > 0, boundsSize.height > 0, let image = imageView.image else { return }

    let widthScale = boundsSize.width / max(image.size.width, 1)
    let heightScale = boundsSize.height / max(image.size.height, 1)
    let minScale = min(widthScale, heightScale)
    let resolvedMinScale = max(minScale, 0.1)
    let nativeZoomScale = 1 / max(resolvedMinScale, 0.01)
    let expandedMaxScale = max(12, nativeZoomScale * 2.5)

    imageZoomScrollView.minimumZoomScale = resolvedMinScale
    imageZoomScrollView.maximumZoomScale = expandedMaxScale

    if resetZoom || imageZoomScrollView.zoomScale < resolvedMinScale || imageZoomScrollView.zoomScale == 1 {
      imageZoomScrollView.zoomScale = resolvedMinScale
    } else if imageZoomScrollView.zoomScale > expandedMaxScale {
      imageZoomScrollView.zoomScale = expandedMaxScale
    }
    updateImageLayout()
  }

  private func centerImage() {
    updateImageLayout()
  }

  private func updateImageLayout() {
    guard let image = imageView.image else {
      imageContainerView.frame = .zero
      imageView.frame = .zero
      imageZoomScrollView.contentSize = .zero
      return
    }

    let boundsSize = imageZoomScrollView.bounds.size
    guard boundsSize.width > 0, boundsSize.height > 0 else { return }

    let scaledWidth = image.size.width * imageZoomScrollView.zoomScale
    let scaledHeight = image.size.height * imageZoomScrollView.zoomScale
    let contentWidth = max(scaledWidth, boundsSize.width)
    let contentHeight = max(scaledHeight, boundsSize.height)
    let originX = max((contentWidth - scaledWidth) * 0.5, 0)
    let originY = max((contentHeight - scaledHeight) * 0.5, 0)

    imageZoomScrollView.contentSize = CGSize(width: contentWidth, height: contentHeight)
    imageContainerView.frame = CGRect(x: originX, y: originY, width: scaledWidth, height: scaledHeight)
    imageView.frame = imageContainerView.bounds
  }

  private func assetStatusText() -> String {
    if container.store.hasLocalOriginal(for: record) {
      return "图片状态：原图已下载，可离线查看和缩放。"
    }
    if container.store.hasLocalThumbnail(for: record) {
      if hasRemoteOriginalSource {
        return "图片状态：当前仅保存缩略图，可离线浏览；联网后可下载原图。"
      }
      return "图片状态：当前仅保存缩略图。本地模式下没有原图下载来源，但详情仍会以同样尺寸展示。"
    }
    if hasRemoteOriginalSource {
      return "图片状态：当前仅有云端记录，需要联网下载缩略图或原图。"
    }
    return "图片状态：当前没有可用的本地图像文件。"
  }

  private func updateImageActionButton() {
    var config = imageActionButton.configuration ?? UIButton.Configuration.plain()
    if container.store.hasLocalOriginal(for: record) {
      config.title = "缩略图"
      config.image = UIImage(systemName: "photo")
      imageActionButton.isEnabled = true
    } else if hasRemoteOriginalSource {
      config.title = "原图"
      config.image = UIImage(systemName: "arrow.down.circle")
      imageActionButton.isEnabled = true
    } else {
      config.title = "缩略图"
      config.image = UIImage(systemName: "photo")
      imageActionButton.isEnabled = false
    }
    imageActionButton.configuration = config
    imageActionButton.isHidden = !container.store.hasLocalOriginal(for: record) && !hasRemoteOriginalSource
    imageActionButton.alpha = imageActionButton.isEnabled ? 1 : 0.55
  }

  private func applyOCRResult(_ text: String) {
    let excerpt = String(text.replacingOccurrences(of: "\n", with: " ").prefix(120))
    ocrLabel.text = text.isEmpty ? "无 OCR 文本" : "OCR 摘要\n\(text)"

    let detected = container.regionCatalog.detectedRegion(fromRecognizedText: text)
    let updated = record.withOCRContent(
      text: text,
      excerpt: excerpt,
      status: text.isEmpty ? "empty" : "complete",
      countryName: detected?.countryName,
      province: detected?.province,
      city: detected?.city,
      district: detected?.district
    )

    record = updated
    try? container.store.updateRecord(updated)
    onSave(updated)
    assetStatusLabel.text = assetStatusText()
  }

  @objc private func runNativeOCR() {
    guard let image = imageView.image, let cgImage = image.cgImage else {
      container.haptics.warning()
      showAlert(title: "无法识别", message: "当前图片还没有可用于 OCR 的图像。")
      return
    }

    ocrActionButton.isEnabled = false
    let request = VNRecognizeTextRequest { [weak self] request, error in
      DispatchQueue.main.async {
        guard let self else { return }
        self.ocrActionButton.isEnabled = true

        if let error {
          self.container.haptics.error()
          self.showAlert(title: "OCR 失败", message: error.localizedDescription)
          return
        }

        let text = (request.results as? [VNRecognizedTextObservation] ?? [])
          .compactMap { $0.topCandidates(1).first?.string }
          .joined(separator: "\n")
          .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else {
          self.container.haptics.warning()
          self.showAlert(title: "未识别到地址", message: "图片里没有提取到明显的地区或地址文字。")
          return
        }

        self.applyOCRResult(text)
        if let detected = self.container.regionCatalog.detectedRegion(fromRecognizedText: text) {
          self.container.haptics.success()
          self.selectedCountryName = detected.countryName ?? self.selectedCountryName
          self.selectedProvinceName = detected.province ?? self.selectedProvinceName
          self.selectedCityName = detected.city ?? self.selectedCityName
          self.selectedDistrictName = detected.district ?? self.selectedDistrictName
          self.updateSelectionTitles()

          let summary = [
            detected.countryName,
            detected.province,
            detected.city,
            detected.district
          ]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " / ")
          self.showAlert(title: "已识别行政区", message: summary.isEmpty ? text : summary)
        } else {
          self.container.haptics.selectionChanged()
          self.showAlert(title: "已完成 OCR", message: "识别到了文字，但暂未匹配到内置行政区。你可以参考 OCR 摘要手动选择。")
        }
      }
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hans", "en-US"]

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
      } catch {
        DispatchQueue.main.async {
          self.ocrActionButton.isEnabled = true
          self.container.haptics.error()
          self.showAlert(title: "OCR 失败", message: error.localizedDescription)
        }
      }
    }
  }

  @objc private func handleImageAction() {
    if container.store.hasLocalOriginal(for: record) {
      container.store.removeLocalOriginal(for: record)
      container.haptics.selectionChanged()
      render()
      return
    }

    guard hasRemoteOriginalSource else {
      container.haptics.warning()
      showAlert(title: "无原图来源", message: "当前是本地模式，且这张图没有可用的服务器原图下载地址。")
      return
    }

    container.haptics.mediumTap()
    imageActionButton.isEnabled = false
    Task { [weak self] in
      guard let self else { return }
      defer { self.imageActionButton.isEnabled = true }
      do {
        let data = try await self.container.apiClient.downloadOriginal(for: self.record)
        try self.container.store.saveOriginalData(data, for: self.record)
        self.container.haptics.success()
        self.render()
      } catch {
        self.container.haptics.error()
        let alert = UIAlertController(title: "下载失败", message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "知道了", style: .default))
        self.present(alert, animated: true)
      }
    }
  }

  func viewForZooming(in scrollView: UIScrollView) -> UIView? {
    scrollView === imageZoomScrollView ? imageContainerView : nil
  }

  func scrollViewDidZoom(_ scrollView: UIScrollView) {
    guard scrollView === imageZoomScrollView else { return }
    centerImage()
  }

  @objc private func handleImageDoubleTap(_ gesture: UITapGestureRecognizer) {
    guard imageZoomScrollView.bounds.width > 0, imageZoomScrollView.bounds.height > 0 else { return }

    let minimumScale = imageZoomScrollView.minimumZoomScale
    let currentScale = imageZoomScrollView.zoomScale

    if currentScale > minimumScale * 1.02 {
      imageZoomScrollView.setZoomScale(minimumScale, animated: true)
      return
    }

    let targetScale = min(max(minimumScale * 2.2, minimumScale), imageZoomScrollView.maximumZoomScale)
    let tapPoint = gesture.location(in: imageView)
    let zoomRect = zoomRect(for: targetScale, centeredAt: tapPoint)
    imageZoomScrollView.zoom(to: zoomRect, animated: true)
  }

  private func zoomRect(for scale: CGFloat, centeredAt point: CGPoint) -> CGRect {
    let bounds = imageZoomScrollView.bounds
    let width = bounds.width / scale
    let height = bounds.height / scale
    return CGRect(
      x: point.x - width * 0.5,
      y: point.y - height * 0.5,
      width: width,
      height: height
    )
  }

  private func configureCard(_ view: UIView) {
    view.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.84)
    view.layer.cornerRadius = 20
    view.layer.cornerCurve = .continuous
    view.layer.borderWidth = 1
    view.layer.borderColor = UIColor.separator.withAlphaComponent(0.14).cgColor
    view.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
  }

  private func styleField(_ field: UITextField) {
    field.borderStyle = .none
    field.backgroundColor = .tertiarySystemBackground
    field.textColor = .label
    field.font = .systemFont(ofSize: 15, weight: .semibold)
    field.layer.cornerRadius = 12
    field.layer.borderWidth = 1
    field.layer.borderColor = UIColor.separator.cgColor
    field.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 12, height: 1))
    field.leftViewMode = .always
    field.heightAnchor.constraint(equalToConstant: 44).isActive = true
    if let placeholder = field.placeholder {
      field.attributedPlaceholder = NSAttributedString(
        string: placeholder,
        attributes: [.foregroundColor: UIColor.placeholderText]
      )
    }
  }

  private func styleSelectionButton(_ button: UIButton) {
    button.translatesAutoresizingMaskIntoConstraints = false
    var config = UIButton.Configuration.plain()
    config.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 36)
    button.configuration = config
    button.contentHorizontalAlignment = .left
    button.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
    button.layer.cornerRadius = 12
    button.layer.borderWidth = 1
    button.layer.borderColor = UIColor.separator.cgColor
    button.backgroundColor = .tertiarySystemBackground
    button.setTitleColor(.label, for: .normal)
    button.heightAnchor.constraint(equalToConstant: 44).isActive = true

    let chevron = UIImageView(image: UIImage(systemName: "chevron.down"))
    chevron.translatesAutoresizingMaskIntoConstraints = false
    chevron.tintColor = .secondaryLabel
    button.addSubview(chevron)
    NSLayoutConstraint.activate([
      chevron.centerYAnchor.constraint(equalTo: button.centerYAnchor),
      chevron.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -12)
    ])
  }

  private func styleFloatingActionButton(_ button: UIButton, title: String, symbol: String) {
    var config = UIButton.Configuration.filled()
    config.title = title
    config.image = UIImage(systemName: symbol)
    config.imagePadding = 6
    config.baseForegroundColor = .white
    config.baseBackgroundColor = UIColor.black.withAlphaComponent(0.28)
    config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
    button.configuration = config
    button.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
    button.layer.cornerRadius = 16
    button.layer.cornerCurve = .continuous
    button.layer.borderWidth = 1
    button.layer.borderColor = UIColor.white.withAlphaComponent(0.12).cgColor
    button.clipsToBounds = true
  }

  private func makeSectionTitle(_ text: String) -> UILabel {
    let label = UILabel()
    label.font = .systemFont(ofSize: 17, weight: .bold)
    label.textColor = .label
    label.text = text
    return label
  }

  private func makeFieldCaption(_ text: String) -> UILabel {
    let label = UILabel()
    label.font = .systemFont(ofSize: 12, weight: .semibold)
    label.textColor = .secondaryLabel
    label.text = text
    return label
  }

  private func makeFieldGroup(title: String, field: UIView) -> UIStackView {
    let stack = UIStackView(arrangedSubviews: [makeFieldCaption(title), field])
    stack.axis = .vertical
    stack.spacing = 6
    return stack
  }

  private func makeTextViewGroup(title: String, textView: UITextView) -> UIStackView {
    let stack = UIStackView(arrangedSubviews: [makeFieldCaption(title), textView])
    stack.axis = .vertical
    stack.spacing = 6
    return stack
  }

  private func makeDualFieldRow(
    leftTitle: String,
    leftField: UIView,
    rightTitle: String,
    rightField: UIView
  ) -> UIStackView {
    let row = UIStackView(arrangedSubviews: [
      makeFieldGroup(title: leftTitle, field: leftField),
      makeFieldGroup(title: rightTitle, field: rightField)
    ])
    row.axis = .horizontal
    row.spacing = 10
    row.distribution = .fillEqually
    row.alignment = .top
    return row
  }

  private func updateSelectionTitles() {
    applyTitle(selectedCountryName, placeholder: "选择国家/地区", for: countryButton)
    applyTitle(selectedProvinceName, placeholder: "选择省/州", for: provinceButton)
    applyTitle(selectedCityName, placeholder: "选择城市", for: cityButton)
    applyTitle(selectedDistrictName, placeholder: "选择区/县/行政区", for: districtButton)

    provinceButton.isEnabled = !selectedCountryName.isEmpty
    cityButton.isEnabled = !selectedCountryName.isEmpty && !selectedProvinceName.isEmpty
    districtButton.isEnabled = !selectedCountryName.isEmpty && !selectedProvinceName.isEmpty && !selectedCityName.isEmpty
    districtButton.alpha = districtButton.isEnabled ? 1 : 0.65
    cityButton.alpha = cityButton.isEnabled ? 1 : 0.65
    provinceButton.alpha = provinceButton.isEnabled ? 1 : 0.65
  }

  private func applyTitle(_ value: String, placeholder: String, for button: UIButton) {
    let text = value.isEmpty ? placeholder : value
    button.setTitle(text, for: .normal)
    let color = value.isEmpty ? UIColor.placeholderText : UIColor.label
    button.setTitleColor(color, for: .normal)
  }

  private func wireSelectionActions() {
    countryButton.addTarget(self, action: #selector(selectCountry), for: .touchUpInside)
    provinceButton.addTarget(self, action: #selector(selectProvince), for: .touchUpInside)
    cityButton.addTarget(self, action: #selector(selectCity), for: .touchUpInside)
    districtButton.addTarget(self, action: #selector(selectDistrict), for: .touchUpInside)
  }

  @objc private func selectCountry() {
    container.haptics.selectionChanged()
    let options = container.regionCatalog.countryOptions()
    presentSelection(title: "选择国家/地区", options: options) { [weak self] option in
      guard let self else { return }
      self.selectedCountryName = option.title
      self.selectedProvinceName = ""
      self.selectedCityName = ""
      self.selectedDistrictName = ""
      self.updateSelectionTitles()
    }
  }

  @objc private func selectProvince() {
    container.haptics.selectionChanged()
    let options = container.regionCatalog.provinceOptions(forCountryName: selectedCountryName)
    guard !options.isEmpty else {
      container.haptics.warning()
      showAlert(title: "暂无下级行政区", message: "当前国家未内置省/州数据。")
      return
    }
    presentSelection(title: "选择省/州", options: options) { [weak self] option in
      guard let self else { return }
      self.selectedProvinceName = option.title
      self.selectedCityName = ""
      self.selectedDistrictName = ""
      self.updateSelectionTitles()
    }
  }

  @objc private func selectCity() {
    container.haptics.selectionChanged()
    let options = container.regionCatalog.cityOptions(forCountryName: selectedCountryName, province: selectedProvinceName)
    guard !options.isEmpty else {
      container.haptics.warning()
      showAlert(title: "暂无城市列表", message: "当前内置城市下拉主要覆盖中国行政区，其他国家建议先选择州省，再用 OCR 辅助识别。")
      return
    }
    presentSelection(title: "选择城市", options: options) { [weak self] option in
      guard let self else { return }
      self.selectedCityName = option.title
      self.selectedDistrictName = ""
      self.updateSelectionTitles()
    }
  }

  @objc private func selectDistrict() {
    container.haptics.selectionChanged()
    let options = container.regionCatalog.districtOptions(
      forCountryName: selectedCountryName,
      province: selectedProvinceName,
      city: selectedCityName
    )
    guard !options.isEmpty else {
      container.haptics.warning()
      showAlert(title: "暂无区县列表", message: "当前选择下没有可用的区县行政区。")
      return
    }
    presentSelection(title: "选择区/县/行政区", options: options) { [weak self] option in
      guard let self else { return }
      self.selectedDistrictName = option.title
      self.updateSelectionTitles()
    }
  }

  private func presentSelection(title: String, options: [SelectionOption], onSelect: @escaping (SelectionOption) -> Void) {
    let controller = SelectionListViewController(title: title, options: options, onSelect: onSelect)
    let nav = UINavigationController(rootViewController: controller)
    if let sheet = nav.sheetPresentationController {
      sheet.detents = [.medium(), .large()]
      sheet.prefersGrabberVisible = true
    }
    present(nav, animated: true)
  }

  private func showAlert(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "知道了", style: .default))
    present(alert, animated: true)
  }

  func textFieldShouldBeginEditing(_ textField: UITextField) -> Bool {
    if textField === titleField {
      presentMetadataEditorSheet(title: "编辑标题", initialValue: titleField.text ?? "", placeholder: "标题") { [weak self] value in
        self?.titleField.text = value
      }
      return false
    }
    if textField === yearField {
      presentMetadataEditorSheet(title: "编辑年代", initialValue: yearField.text ?? "", placeholder: "例如：1938 / 清代 / 民国") { [weak self] value in
        self?.yearField.text = value
      }
      return false
    }
    if textField === campaignField {
      presentMetadataEditorSheet(title: "编辑专题 / 战役", initialValue: campaignField.text ?? "", placeholder: "专题 / 战役") { [weak self] value in
        self?.campaignField.text = value
      }
      return false
    }
    if textField === teachingUseField {
      presentMetadataEditorSheet(title: "编辑教学用途", initialValue: teachingUseField.text ?? "", placeholder: "教学用途") { [weak self] value in
        self?.teachingUseField.text = value
      }
      return false
    }
    if textField === securityLevelField {
      presentMetadataEditorSheet(title: "编辑密级", initialValue: securityLevelField.text ?? "", placeholder: "密级") { [weak self] value in
        self?.securityLevelField.text = value
      }
      return false
    }
    if textField === tagsField {
      presentMetadataEditorSheet(title: "编辑标签", initialValue: tagsField.text ?? "", placeholder: "标签，逗号分隔") { [weak self] value in
        self?.tagsField.text = value
      }
      return false
    }
    return true
  }

  func textViewShouldBeginEditing(_ textView: UITextView) -> Bool {
    if textView === descriptionView {
      presentMetadataEditorSheet(
        title: "编辑说明备注",
        initialValue: descriptionView.text ?? "",
        placeholder: "说明备注",
        multiline: true
      ) { [weak self] value in
        self?.descriptionView.text = value
      }
      return false
    }
    if textView === teachingNoteView {
      presentMetadataEditorSheet(
        title: "编辑授课备注",
        initialValue: teachingNoteView.text ?? "",
        placeholder: "授课备注",
        multiline: true
      ) { [weak self] value in
        self?.teachingNoteView.text = value
      }
      return false
    }
    return true
  }

  private func presentMetadataEditorSheet(
    title: String,
    initialValue: String,
    placeholder: String,
    multiline: Bool = false,
    onSave: @escaping (String) -> Void
  ) {
    let controller = MetadataTextEditorViewController(
      screenTitle: title,
      initialValue: initialValue,
      placeholder: placeholder,
      multiline: multiline,
      onSave: onSave
    )
    let nav = UINavigationController(rootViewController: controller)
    if let sheet = nav.sheetPresentationController {
      sheet.detents = multiline ? [.medium(), .large()] : [.medium(), .large()]
      sheet.selectedDetentIdentifier = .medium
      sheet.prefersGrabberVisible = true
      sheet.prefersScrollingExpandsWhenScrolledToEdge = false
      sheet.preferredCornerRadius = 24
    }
    present(nav, animated: true)
  }

  @objc private func toggleInformationPanel() {
    container.haptics.selectionChanged()
    isInfoPanelPresented.toggle()
    applyInfoPanelState(animated: true)
  }

  private var hasRemoteOriginalSource: Bool {
    container.settings.serverBaseURL != nil && !record.id.hasPrefix("local-") && !record.files.original.isEmpty
  }

  @objc private func handleInfoPanelPan(_ gesture: UIPanGestureRecognizer) {
    let usePadPanel = traitCollection.userInterfaceIdiom == .pad || traitCollection.horizontalSizeClass == .regular
    let translation = gesture.translation(in: view)
    let maxTravel = max(usePadPanel ? (panelWidthConstraint?.constant ?? 360) + 24 : (panelHeightConstraint?.constant ?? 360) - 24, 1)

    switch gesture.state {
    case .began:
      panelPanStartTransform = infoPanel.transform
    case .changed:
      if usePadPanel {
        let nextX = max(0, min(maxTravel, panelPanStartTransform.tx + translation.x))
        infoPanel.transform = CGAffineTransform(translationX: nextX, y: 0)
      } else {
        let nextY = max(0, min(maxTravel, panelPanStartTransform.ty + translation.y))
        infoPanel.transform = CGAffineTransform(translationX: 0, y: nextY)
      }
    case .ended, .cancelled:
      let velocity = gesture.velocity(in: view)
      let shouldHide: Bool
      if usePadPanel {
        shouldHide = velocity.x > 200 || infoPanel.transform.tx > maxTravel * 0.4
      } else {
        shouldHide = velocity.y > 220 || infoPanel.transform.ty > maxTravel * 0.35
      }
      isInfoPanelPresented = !shouldHide
      applyInfoPanelState(animated: true)
    default:
      break
    }
  }

  private func applyInfoPanelState(animated: Bool) {
    let usePadPanel = traitCollection.userInterfaceIdiom == .pad || traitCollection.horizontalSizeClass == .regular
    let hiddenTransform: CGAffineTransform
    if usePadPanel {
      let panelWidth = (panelWidthConstraint?.constant ?? 360) + 24
      hiddenTransform = CGAffineTransform(translationX: panelWidth, y: 0)
    } else {
      let panelHeight = (panelHeightConstraint?.constant ?? 340) + 20
      hiddenTransform = CGAffineTransform(translationX: 0, y: panelHeight)
    }

    let updates = {
      self.infoPanel.transform = self.isInfoPanelPresented ? .identity : hiddenTransform
      var config = self.infoButton.configuration ?? UIButton.Configuration.filled()
      config.baseBackgroundColor = self.isInfoPanelPresented
        ? UIColor.systemBlue.withAlphaComponent(0.88)
        : UIColor.secondarySystemBackground.withAlphaComponent(0.92)
      config.baseForegroundColor = self.isInfoPanelPresented ? .white : .label
      self.infoButton.configuration = config
    }

    if animated {
      UIView.animate(
        withDuration: 0.28,
        delay: 0,
        usingSpringWithDamping: 0.92,
        initialSpringVelocity: 0.3,
        options: [.beginFromCurrentState, .allowUserInteraction]
      ) {
        updates()
      }
    } else {
      updates()
    }
  }

  private func applyImmersiveNavigationAppearance() {
    guard let navigationBar = navigationController?.navigationBar else { return }
    previousStandardAppearance = navigationBar.standardAppearance
    previousScrollEdgeAppearance = navigationBar.scrollEdgeAppearance
    previousCompactAppearance = navigationBar.compactAppearance
    previousTintColor = navigationBar.tintColor

    let appearance = UINavigationBarAppearance()
    appearance.configureWithTransparentBackground()
    appearance.backgroundColor = .clear
    appearance.shadowColor = .clear
    appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
    appearance.largeTitleTextAttributes = [.foregroundColor: UIColor.white]

    navigationBar.standardAppearance = appearance
    navigationBar.scrollEdgeAppearance = appearance
    navigationBar.compactAppearance = appearance
    navigationBar.tintColor = .white
  }

  private func restoreNavigationAppearance() {
    guard let navigationBar = navigationController?.navigationBar else { return }
    if let previousStandardAppearance {
      navigationBar.standardAppearance = previousStandardAppearance
    }
    navigationBar.scrollEdgeAppearance = previousScrollEdgeAppearance
    navigationBar.compactAppearance = previousCompactAppearance
    navigationBar.tintColor = previousTintColor ?? view.tintColor
  }
}

private final class MetadataTextEditorViewController: UIViewController, UITextFieldDelegate, UITextViewDelegate {
  private let screenTitle: String
  private let initialValue: String
  private let fieldPlaceholder: String
  private let multiline: Bool
  private let onSave: (String) -> Void

  private let textField = UITextField()
  private let textView = UITextView()

  init(
    screenTitle: String,
    initialValue: String,
    placeholder: String,
    multiline: Bool,
    onSave: @escaping (String) -> Void
  ) {
    self.screenTitle = screenTitle
    self.initialValue = initialValue
    self.fieldPlaceholder = placeholder
    self.multiline = multiline
    self.onSave = onSave
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = screenTitle
    view.backgroundColor = .systemGroupedBackground
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "完成", style: .done, target: self, action: #selector(saveAndDismiss))
    navigationItem.leftBarButtonItem = UIBarButtonItem(title: "取消", style: .plain, target: self, action: #selector(closeSheet))

    if multiline {
      configureTextView()
    } else {
      configureTextField()
    }
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if multiline {
      textView.becomeFirstResponder()
    } else {
      textField.becomeFirstResponder()
    }
  }

  private func configureTextField() {
    textField.translatesAutoresizingMaskIntoConstraints = false
    textField.delegate = self
    textField.borderStyle = .roundedRect
    textField.font = .systemFont(ofSize: 17, weight: .semibold)
    textField.placeholder = fieldPlaceholder
    textField.text = initialValue
    textField.returnKeyType = .done
    if screenTitle.contains("年代") {
      textField.keyboardType = .numbersAndPunctuation
    }

    let container = UIView()
    container.translatesAutoresizingMaskIntoConstraints = false
    container.backgroundColor = .secondarySystemGroupedBackground
    container.layer.cornerRadius = 18
    container.layer.cornerCurve = .continuous
    container.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 20, leading: 16, bottom: 20, trailing: 16)

    view.addSubview(container)
    container.addSubview(textField)

    NSLayoutConstraint.activate([
      container.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
      container.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      container.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

      textField.topAnchor.constraint(equalTo: container.layoutMarginsGuide.topAnchor),
      textField.leadingAnchor.constraint(equalTo: container.layoutMarginsGuide.leadingAnchor),
      textField.trailingAnchor.constraint(equalTo: container.layoutMarginsGuide.trailingAnchor),
      textField.bottomAnchor.constraint(equalTo: container.layoutMarginsGuide.bottomAnchor),
      textField.heightAnchor.constraint(equalToConstant: 48)
    ])
  }

  private func configureTextView() {
    textView.translatesAutoresizingMaskIntoConstraints = false
    textView.delegate = self
    textView.font = .systemFont(ofSize: 16, weight: .medium)
    textView.backgroundColor = .tertiarySystemGroupedBackground
    textView.layer.cornerRadius = 16
    textView.layer.cornerCurve = .continuous
    textView.textContainerInset = UIEdgeInsets(top: 14, left: 12, bottom: 14, right: 12)
    textView.text = initialValue

    let hintLabel = UILabel()
    hintLabel.translatesAutoresizingMaskIntoConstraints = false
    hintLabel.font = .systemFont(ofSize: 12, weight: .semibold)
    hintLabel.textColor = .secondaryLabel
    hintLabel.text = fieldPlaceholder

    let container = UIView()
    container.translatesAutoresizingMaskIntoConstraints = false
    container.backgroundColor = .secondarySystemGroupedBackground
    container.layer.cornerRadius = 18
    container.layer.cornerCurve = .continuous
    container.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 18, leading: 16, bottom: 16, trailing: 16)

    view.addSubview(container)
    container.addSubview(hintLabel)
    container.addSubview(textView)

    NSLayoutConstraint.activate([
      container.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
      container.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      container.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      container.bottomAnchor.constraint(lessThanOrEqualTo: view.keyboardLayoutGuide.topAnchor, constant: -12),

      hintLabel.topAnchor.constraint(equalTo: container.layoutMarginsGuide.topAnchor),
      hintLabel.leadingAnchor.constraint(equalTo: container.layoutMarginsGuide.leadingAnchor),
      hintLabel.trailingAnchor.constraint(equalTo: container.layoutMarginsGuide.trailingAnchor),

      textView.topAnchor.constraint(equalTo: hintLabel.bottomAnchor, constant: 8),
      textView.leadingAnchor.constraint(equalTo: container.layoutMarginsGuide.leadingAnchor),
      textView.trailingAnchor.constraint(equalTo: container.layoutMarginsGuide.trailingAnchor),
      textView.bottomAnchor.constraint(equalTo: container.layoutMarginsGuide.bottomAnchor),
      textView.heightAnchor.constraint(greaterThanOrEqualToConstant: 220)
    ])
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    saveAndDismiss()
    return false
  }

  @objc private func closeSheet() {
    dismiss(animated: true)
  }

  @objc private func saveAndDismiss() {
    let value: String
    if multiline {
      value = textView.text.trimmingCharacters(in: .whitespacesAndNewlines)
    } else {
      value = textField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
    onSave(value)
    dismiss(animated: true)
  }
}
