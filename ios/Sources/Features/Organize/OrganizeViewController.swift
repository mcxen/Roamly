import UIKit

final class OrganizeViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
  private enum QueueFilter: Int, CaseIterable {
    case all
    case missingLocation
    case missingYear
    case missingOCR
    case missingAI

    var title: String {
      switch self {
      case .all:
        return "全部"
      case .missingLocation:
        return "待补地区"
      case .missingYear:
        return "待补年代"
      case .missingOCR:
        return "待OCR"
      case .missingAI:
        return "待AI"
      }
    }
  }

  private struct BatchRegionDraft {
    var country = ""
    var province = ""
    var city = ""
    var district = ""
  }

  private let container: AppContainer
  private var allRecords: [MapRecord] = []
  private var visibleRecords: [MapRecord] = []
  private var selectedIDs = Set<String>()
  private var filter: QueueFilter = .all
  private var batchRegionDraft = BatchRegionDraft()

  private let backgroundBlurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
  private let scrollView = UIScrollView()
  private let contentStack = UIStackView()
  private let filterControl = UISegmentedControl(items: QueueFilter.allCases.map(\.title))
  private let resultLabel = UILabel()
  private let progressLabel = UILabel()
  private let progressView = UIProgressView(progressViewStyle: .default)
  private let tableView = UITableView(frame: .zero, style: .insetGrouped)
  private let emptyLabel = UILabel()
  private let selectionBar = UIView()
  private let selectionLabel = UILabel()
  private let selectAllButton = UIButton(type: .system)
  private let ocrButton = UIButton(type: .system)
  private let aiButton = UIButton(type: .system)
  private let yearButton = UIButton(type: .system)
  private let regionButton = UIButton(type: .system)
  private let clearButton = UIButton(type: .system)
  private var tableHeightConstraint: NSLayoutConstraint?
  private var selectionBarHeightConstraint: NSLayoutConstraint?
  private weak var batchRegionNavigationController: UINavigationController?
  private var lastOCRStatusMessage = "OCR 待命"
  private var lastAIStatusMessage = "AI 编目待命"
  private var manualProgressValue: Float = 0

  init(container: AppContainer) {
    self.container = container
    super.init(nibName: nil, bundle: nil)
    title = "整理"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    navigationItem.largeTitleDisplayMode = .never
    navigationItem.rightBarButtonItem = editButtonItem
    configureLayout()
    setEditing(true, animated: false)
    reloadData()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    reloadData()
  }

  override func setEditing(_ editing: Bool, animated: Bool) {
    super.setEditing(editing, animated: animated)
    tableView.setEditing(editing, animated: animated)
    if !editing {
      selectedIDs.removeAll()
    }
    updateSelectionBar()
    tableView.reloadData()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    tableHeightConstraint?.constant = tableView.contentSize.height
  }

  private func configureLayout() {
    [backgroundBlurView, scrollView, contentStack, filterControl, resultLabel, progressLabel, progressView, tableView, emptyLabel, selectionBar, selectionLabel, selectAllButton, ocrButton, aiButton, yearButton, regionButton, clearButton].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
    }

    view.addSubview(backgroundBlurView)
    view.addSubview(scrollView)
    view.addSubview(selectionBar)
    scrollView.addSubview(contentStack)

    contentStack.axis = .vertical
    contentStack.spacing = 10

    filterControl.selectedSegmentIndex = filter.rawValue
    filterControl.apportionsSegmentWidthsByContent = true
    filterControl.selectedSegmentTintColor = .systemBlue
    filterControl.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .selected)
    filterControl.setTitleTextAttributes([.foregroundColor: UIColor.label, .font: UIFont.systemFont(ofSize: 12, weight: .semibold)], for: .normal)
    filterControl.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 12, weight: .semibold)], for: .selected)
    filterControl.addTarget(self, action: #selector(filterChanged), for: .valueChanged)

    resultLabel.font = .systemFont(ofSize: 12, weight: .semibold)
    resultLabel.textColor = .secondaryLabel
    progressLabel.font = .systemFont(ofSize: 11, weight: .medium)
    progressLabel.textColor = .secondaryLabel
    progressLabel.numberOfLines = 3
    progressLabel.text = "OCR 待命\nAI 编目待命"
    progressView.progressTintColor = .systemBlue
    progressView.trackTintColor = .separator
    progressView.progress = 0

    tableView.dataSource = self
    tableView.delegate = self
    tableView.register(CatalogRecordCell.self, forCellReuseIdentifier: "CatalogRecordCell")
    tableView.allowsMultipleSelectionDuringEditing = true
    tableView.isScrollEnabled = false
    tableView.backgroundColor = .clear
    tableView.separatorStyle = .none

    emptyLabel.font = .systemFont(ofSize: 15, weight: .medium)
    emptyLabel.textColor = .secondaryLabel
    emptyLabel.textAlignment = .center
    emptyLabel.numberOfLines = 0
    emptyLabel.text = "当前筛选下没有待整理的地图。"

    [filterControl, resultLabel, progressLabel, progressView, tableView, emptyLabel].forEach {
      contentStack.addArrangedSubview($0)
    }

    let selectionBlur = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterial))
    selectionBlur.translatesAutoresizingMaskIntoConstraints = false
    selectionBar.addSubview(selectionBlur)
    selectionBar.sendSubviewToBack(selectionBlur)
    selectionBar.backgroundColor = .secondarySystemGroupedBackground.withAlphaComponent(0.8)
    selectionBar.layer.cornerRadius = 18
    selectionBar.layer.cornerCurve = .continuous
    selectionBar.layer.borderWidth = 1
    selectionBar.layer.borderColor = UIColor.separator.cgColor

    selectionLabel.font = .systemFont(ofSize: 12, weight: .semibold)
    selectionLabel.textColor = .label

    stylePillButton(selectAllButton, title: "全选当前")
    stylePillButton(ocrButton, title: "批量OCR")
    stylePillButton(aiButton, title: "AI整理")
    stylePillButton(yearButton, title: "批量年代")
    stylePillButton(regionButton, title: "批量地区")
    stylePillButton(clearButton, title: "清空")

    selectAllButton.addTarget(self, action: #selector(selectAllVisible), for: .touchUpInside)
    ocrButton.addTarget(self, action: #selector(runBatchOCR), for: .touchUpInside)
    aiButton.addTarget(self, action: #selector(runBatchAI), for: .touchUpInside)
    yearButton.addTarget(self, action: #selector(editYearBatch), for: .touchUpInside)
    regionButton.addTarget(self, action: #selector(editRegionBatch), for: .touchUpInside)
    clearButton.addTarget(self, action: #selector(clearSelection), for: .touchUpInside)

    let topButtonRow = UIStackView(arrangedSubviews: [selectAllButton, clearButton, yearButton])
    topButtonRow.translatesAutoresizingMaskIntoConstraints = false
    topButtonRow.axis = .horizontal
    topButtonRow.spacing = 6
    topButtonRow.distribution = .fillEqually

    let bottomButtonRow = UIStackView(arrangedSubviews: [ocrButton, aiButton, regionButton])
    bottomButtonRow.translatesAutoresizingMaskIntoConstraints = false
    bottomButtonRow.axis = .horizontal
    bottomButtonRow.spacing = 6
    bottomButtonRow.distribution = .fillEqually

    let buttonStack = UIStackView(arrangedSubviews: [topButtonRow, bottomButtonRow])
    buttonStack.translatesAutoresizingMaskIntoConstraints = false
    buttonStack.axis = .vertical
    buttonStack.spacing = 6
    buttonStack.distribution = .fillEqually

    selectionBar.addSubview(selectionLabel)
    selectionBar.addSubview(buttonStack)

    NSLayoutConstraint.activate([
      backgroundBlurView.topAnchor.constraint(equalTo: view.topAnchor),
      backgroundBlurView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      backgroundBlurView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      backgroundBlurView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

      scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: selectionBar.topAnchor, constant: -10),

      contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 14),
      contentStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      contentStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
      contentStack.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -32),

      progressView.heightAnchor.constraint(equalToConstant: 4),
      emptyLabel.heightAnchor.constraint(equalToConstant: 88),

      selectionBar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      selectionBar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      selectionBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),

      selectionBlur.topAnchor.constraint(equalTo: selectionBar.topAnchor),
      selectionBlur.leadingAnchor.constraint(equalTo: selectionBar.leadingAnchor),
      selectionBlur.trailingAnchor.constraint(equalTo: selectionBar.trailingAnchor),
      selectionBlur.bottomAnchor.constraint(equalTo: selectionBar.bottomAnchor),

      selectionLabel.topAnchor.constraint(equalTo: selectionBar.topAnchor, constant: 10),
      selectionLabel.leadingAnchor.constraint(equalTo: selectionBar.leadingAnchor, constant: 12),
      selectionLabel.trailingAnchor.constraint(equalTo: selectionBar.trailingAnchor, constant: -12),

      buttonStack.topAnchor.constraint(equalTo: selectionLabel.bottomAnchor, constant: 8),
      buttonStack.leadingAnchor.constraint(equalTo: selectionBar.leadingAnchor, constant: 10),
      buttonStack.trailingAnchor.constraint(equalTo: selectionBar.trailingAnchor, constant: -10),
      buttonStack.bottomAnchor.constraint(equalTo: selectionBar.bottomAnchor, constant: -10)
    ])

    tableHeightConstraint = tableView.heightAnchor.constraint(equalToConstant: 0)
    tableHeightConstraint?.isActive = true
    selectionBarHeightConstraint = selectionBar.heightAnchor.constraint(equalToConstant: 0)
    selectionBarHeightConstraint?.isActive = true
    updateSelectionBar()
  }

  private func reloadData() {
    allRecords = container.store.loadRecords().sorted(by: sortRecords)
    refreshProgressSummary()
    applyFilter()
  }

  private func sortRecords(lhs: MapRecord, rhs: MapRecord) -> Bool {
    let lhsScore = priorityScore(for: lhs)
    let rhsScore = priorityScore(for: rhs)
    if lhsScore != rhsScore {
      return lhsScore > rhsScore
    }
    return lhs.importedAt > rhs.importedAt
  }

  private func priorityScore(for record: MapRecord) -> Int {
    var score = 0
    if isLocationMissing(record) { score += 4 }
    if isYearMissing(record) { score += 2 }
    if isOCRMissing(record) { score += 1 }
    if isAIPending(record) { score += 1 }
    return score
  }

  private func applyFilter() {
    visibleRecords = allRecords.filter { record in
      switch filter {
      case .all:
        return true
      case .missingLocation:
        return isLocationMissing(record)
      case .missingYear:
        return isYearMissing(record)
      case .missingOCR:
        return isOCRMissing(record)
      case .missingAI:
        return isAIPending(record)
      }
    }

    selectedIDs = selectedIDs.filter { id in allRecords.contains(where: { $0.id == id }) }
    resultLabel.text = "当前任务队列 \(visibleRecords.count) 张"
    tableView.reloadData()
    tableView.layoutIfNeeded()
    tableHeightConstraint?.constant = tableView.contentSize.height
    emptyLabel.isHidden = !visibleRecords.isEmpty
    tableView.isHidden = visibleRecords.isEmpty
    syncSelectedRows()
  }

  private func refreshProgressSummary() {
    let total = max(allRecords.count, 1)
    let pendingOCR = allRecords.filter(isOCRMissing).count
    let pendingAI = allRecords.filter(isAIPending).count
    let completed = max(total - pendingOCR - pendingAI, 0)
    let automaticProgress = Float(completed) / Float(total)
    if manualProgressValue <= 0 || manualProgressValue >= 1 {
      progressView.progress = automaticProgress
    } else {
      progressView.progress = max(progressView.progress, manualProgressValue)
    }
    progressLabel.text = """
    \(lastOCRStatusMessage)
    \(lastAIStatusMessage)
    当前待 OCR \(pendingOCR) 张，待 AI \(pendingAI) 张
    """
  }

  private func isLocationMissing(_ record: MapRecord) -> Bool {
    [record.countryName, record.province, record.city, record.district]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .allSatisfy(\.isEmpty)
  }

  private func isYearMissing(_ record: MapRecord) -> Bool {
    String(record.yearLabel ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private func isOCRMissing(_ record: MapRecord) -> Bool {
    String(record.ocrText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private func isAIPending(_ record: MapRecord) -> Bool {
    container.aiMetadataService.needsAI(for: record)
  }

  private var regionDraftSummary: String {
    [
      batchRegionDraft.country,
      batchRegionDraft.province,
      batchRegionDraft.city,
      batchRegionDraft.district
    ]
    .filter { !$0.isEmpty }
    .joined(separator: " / ")
  }

  private func syncSelectedRows() {
    guard isEditing else {
      updateSelectionBar()
      return
    }
    for (index, record) in visibleRecords.enumerated() {
      let indexPath = IndexPath(row: index, section: 0)
      if selectedIDs.contains(record.id) {
        tableView.selectRow(at: indexPath, animated: false, scrollPosition: .none)
      } else {
        tableView.deselectRow(at: indexPath, animated: false)
      }
    }
    updateSelectionBar()
  }

  private func updateSelectionBar() {
    let count = selectedIDs.count
    let hasVisibleRecords = !visibleRecords.isEmpty
    selectionBar.isHidden = !isEditing
    selectionBar.alpha = isEditing ? 1 : 0
    selectionBarHeightConstraint?.constant = isEditing ? 96 : 0
    selectionLabel.text = count == 0 ? "先勾选地图，再批量处理" : "已选 \(count) 张"
    ocrButton.isEnabled = isEditing && count > 0
    aiButton.isEnabled = isEditing && count > 0
    yearButton.isEnabled = isEditing && count > 0
    regionButton.isEnabled = isEditing && count > 0
    clearButton.isEnabled = isEditing && count > 0
    selectAllButton.isEnabled = isEditing && hasVisibleRecords
    [ocrButton, aiButton, yearButton, regionButton, clearButton, selectAllButton].forEach {
      $0.alpha = $0.isEnabled ? 1 : 0.45
    }
    view.setNeedsLayout()
  }

  private func stylePillButton(_ button: UIButton, title: String) {
    var config = UIButton.Configuration.filled()
    config.cornerStyle = .capsule
    config.baseBackgroundColor = .systemBlue
    config.baseForegroundColor = .white
    config.title = title
    config.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 8, bottom: 6, trailing: 8)
    button.configuration = config
    button.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
  }

  private func previewImage(for record: MapRecord) -> UIImage? {
    let candidates = [
      container.store.localThumbnailURL(for: record),
      container.store.localOriginalURL(for: record)
    ]
    for url in candidates where FileManager.default.fileExists(atPath: url.path) {
      if let image = UIImage(contentsOfFile: url.path) {
        return image
      }
    }
    return nil
  }

  private func openDetail(for record: MapRecord) {
    let detail = MapDetailViewController(container: container, record: record) { [weak self] updated in
      guard let self else { return }
      if let index = self.allRecords.firstIndex(where: { $0.id == updated.id }) {
        self.allRecords[index] = updated
      }
      self.allRecords.sort(by: self.sortRecords)
      self.applyFilter()
    }
    navigationController?.pushViewController(detail, animated: true)
  }

  @objc private func filterChanged() {
    container.haptics.selectionChanged()
    filter = QueueFilter(rawValue: filterControl.selectedSegmentIndex) ?? .all
    applyFilter()
  }

  @objc private func selectAllVisible() {
    container.haptics.softTap()
    visibleRecords.forEach { selectedIDs.insert($0.id) }
    syncSelectedRows()
  }

  @objc private func clearSelection() {
    container.haptics.selectionChanged()
    selectedIDs.removeAll()
    syncSelectedRows()
  }

  @objc private func runBatchOCR() {
    let ids = selectedIDs
    guard !ids.isEmpty else {
      container.haptics.warning()
      return
    }

    container.haptics.mediumTap()

    let alert = UIAlertController(title: "批量 OCR", message: "将对已选地图执行本地 OCR，并自动尝试识别地区。", preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "开始", style: .default) { [weak self] _ in
      guard let self else { return }
      Task { [weak self] in
        guard let self else { return }
        await self.performBatchOCR(ids: ids)
      }
    })
    present(alert, animated: true)
  }

  @MainActor
  private func performBatchOCR(ids: Set<String>) async {
    manualProgressValue = 0.05
    lastOCRStatusMessage = "正在执行批量 OCR…"
    refreshProgressSummary()
    let progress = UIAlertController(title: "正在 OCR", message: "准备中…", preferredStyle: .alert)
    present(progress, animated: true)

    do {
      let result = try await container.ocrIndexService.indexRecords(ids: ids) { message in
        Task { @MainActor in
          progress.message = message
          self.lastOCRStatusMessage = message
          self.manualProgressValue = min(self.manualProgressValue + 0.12, 0.92)
          self.refreshProgressSummary()
        }
      }
      progress.dismiss(animated: true) {
        self.container.haptics.success()
        self.lastOCRStatusMessage = "OCR 完成，已处理 \(result.processedCount) 张地图。"
        self.manualProgressValue = 1
        self.reloadData()
        let touched = result.updatedRecords.filter { ids.contains($0.id) }
        Task { [weak self] in
          guard let self else { return }
          await self.syncBatchMetadata(
            title: "OCR 完成",
            touchedRecords: touched,
            affectedCount: result.processedCount
          )
        }
      }
    } catch {
      progress.dismiss(animated: true) {
        self.container.haptics.error()
        self.lastOCRStatusMessage = "OCR 失败：\(error.localizedDescription)"
        self.manualProgressValue = 0
        self.refreshProgressSummary()
        let alert = UIAlertController(title: "OCR 失败", message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "知道了", style: .default))
        self.present(alert, animated: true)
      }
    }
  }

  @objc private func runBatchAI() {
    let ids = selectedIDs
    guard !ids.isEmpty else {
      container.haptics.warning()
      return
    }

    container.haptics.mediumTap()

    let alert = UIAlertController(title: "AI 批量整理", message: "将对已选地图执行 AI 元数据编目，并要求模型返回 JSON。", preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "开始", style: .default) { [weak self] _ in
      guard let self else { return }
      Task { [weak self] in
        guard let self else { return }
        await self.performBatchAI(ids: ids)
      }
    })
    present(alert, animated: true)
  }

  @MainActor
  private func performBatchAI(ids: Set<String>) async {
    manualProgressValue = 0.05
    lastAIStatusMessage = "正在执行 AI 编目…"
    refreshProgressSummary()
    let progress = UIAlertController(title: "正在 AI 整理", message: "准备中…", preferredStyle: .alert)
    present(progress, animated: true)

    do {
      let result = try await container.aiMetadataService.organizeRecords(ids: ids) { message in
        Task { @MainActor in
          progress.message = message
          self.lastAIStatusMessage = message
          self.manualProgressValue = min(self.manualProgressValue + 0.12, 0.92)
          self.refreshProgressSummary()
        }
      }
      progress.dismiss(animated: true) {
        self.container.haptics.success()
        self.lastAIStatusMessage = "AI 编目完成，已更新 \(result.processedCount) 张地图。"
        self.manualProgressValue = 1
        self.reloadData()
        let touched = result.updatedRecords.filter { ids.contains($0.id) }
        Task { [weak self] in
          guard let self else { return }
          await self.syncBatchMetadata(
            title: "AI 编目完成",
            touchedRecords: touched,
            affectedCount: result.processedCount
          )
        }
      }
    } catch {
      progress.dismiss(animated: true) {
        self.container.haptics.error()
        self.lastAIStatusMessage = "AI 编目失败：\(error.localizedDescription)"
        self.manualProgressValue = 0
        self.refreshProgressSummary()
        let alert = UIAlertController(title: "AI 编目失败", message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "知道了", style: .default))
        self.present(alert, animated: true)
      }
    }
  }

  @objc private func editYearBatch() {
    guard !selectedIDs.isEmpty else {
      container.haptics.warning()
      return
    }
    container.haptics.selectionChanged()
    let alert = UIAlertController(title: "批量更新年代", message: "为当前已选地图设置统一年代。", preferredStyle: .alert)
    alert.addTextField {
      $0.placeholder = "例如：清代 / 1930年代 / 2024"
    }
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "保存", style: .default) { [weak self, weak alert] _ in
      guard
        let self,
        let value = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines),
        !value.isEmpty
      else { return }
      self.applyBatchUpdate(title: "年代已更新") { record in
        record.withEditableMetadata(
          title: record.title,
          description: record.description,
          yearLabel: value,
          campaign: record.campaign ?? "",
          teachingUse: record.teachingUse ?? "",
          teachingNote: record.teachingNote ?? "",
          securityLevel: record.securityLevel ?? "",
          countryName: record.countryName ?? "",
          province: record.province ?? "",
          city: record.city ?? "",
          district: record.district ?? "",
          tags: record.tags
        )
      }
    })
    present(alert, animated: true)
  }

  @objc private func editRegionBatch() {
    guard !selectedIDs.isEmpty else {
      container.haptics.warning()
      return
    }
    container.haptics.selectionChanged()
    startBatchRegionFlow()
  }

  private func startBatchRegionFlow() {
    batchRegionDraft = BatchRegionDraft()
    let controller = makeCountryController()
    let navigationController = UINavigationController(rootViewController: controller)
    if let sheet = navigationController.sheetPresentationController {
      sheet.detents = [.medium(), .large()]
      sheet.prefersGrabberVisible = true
    }
    batchRegionNavigationController = navigationController
    present(navigationController, animated: true)
  }

  private func makeCountryController() -> SelectionListViewController {
    SelectionListViewController(
      title: "国家/地区",
      options: container.regionCatalog.countryOptions(),
      dismissOnSelection: false
    ) { [weak self] option in
      guard let self else { return }
      self.batchRegionDraft.country = option.title
      self.batchRegionDraft.province = ""
      self.batchRegionDraft.city = ""
      self.batchRegionDraft.district = ""
      self.batchRegionNavigationController?.pushViewController(self.makeProvinceController(), animated: true)
    }
  }

  private func makeProvinceController() -> UIViewController {
    let options = container.regionCatalog.provinceOptions(forCountryName: batchRegionDraft.country)
    guard !options.isEmpty else {
      return makeRegionReviewController()
    }

    let controller = SelectionListViewController(
      title: "省/州",
      options: options,
      dismissOnSelection: false
    ) { [weak self] option in
      guard let self else { return }
      self.batchRegionDraft.province = option.title
      self.batchRegionDraft.city = ""
      self.batchRegionDraft.district = ""
      self.batchRegionNavigationController?.pushViewController(self.makeCityController(), animated: true)
    }
    controller.navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "跳过",
      primaryAction: UIAction { [weak self] _ in
        guard let self else { return }
        self.batchRegionNavigationController?.pushViewController(self.makeRegionReviewController(), animated: true)
      }
    )
    return controller
  }

  private func makeCityController() -> UIViewController {
    let options = container.regionCatalog.cityOptions(forCountryName: batchRegionDraft.country, province: batchRegionDraft.province)
    guard !options.isEmpty else {
      return makeRegionReviewController()
    }

    let controller = SelectionListViewController(
      title: "城市",
      options: options,
      dismissOnSelection: false
    ) { [weak self] option in
      guard let self else { return }
      self.batchRegionDraft.city = option.title
      self.batchRegionDraft.district = ""
      self.batchRegionNavigationController?.pushViewController(self.makeDistrictController(), animated: true)
    }
    controller.navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "跳过",
      primaryAction: UIAction { [weak self] _ in
        guard let self else { return }
        self.batchRegionNavigationController?.pushViewController(self.makeRegionReviewController(), animated: true)
      }
    )
    return controller
  }

  private func makeDistrictController() -> UIViewController {
    let options = container.regionCatalog.districtOptions(
      forCountryName: batchRegionDraft.country,
      province: batchRegionDraft.province,
      city: batchRegionDraft.city
    )
    guard !options.isEmpty else {
      return makeRegionReviewController()
    }

    let controller = SelectionListViewController(
      title: "区县",
      options: options,
      dismissOnSelection: false
    ) { [weak self] option in
      guard let self else { return }
      self.batchRegionDraft.district = option.title
      self.batchRegionNavigationController?.pushViewController(self.makeRegionReviewController(), animated: true)
    }
    controller.navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "跳过",
      primaryAction: UIAction { [weak self] _ in
        guard let self else { return }
        self.batchRegionNavigationController?.pushViewController(self.makeRegionReviewController(), animated: true)
      }
    )
    return controller
  }

  private func makeRegionReviewController() -> UIViewController {
    let controller = UIViewController()
    controller.view.backgroundColor = .systemGroupedBackground
    controller.title = "确认地区"

    let summaryLabel = UILabel()
    summaryLabel.translatesAutoresizingMaskIntoConstraints = false
    summaryLabel.numberOfLines = 0
    summaryLabel.textAlignment = .center
    summaryLabel.font = .systemFont(ofSize: 18, weight: .semibold)
    summaryLabel.textColor = .label
    summaryLabel.text = regionDraftSummary.isEmpty ? "将保留当前地区信息" : regionDraftSummary

    let hintLabel = UILabel()
    hintLabel.translatesAutoresizingMaskIntoConstraints = false
    hintLabel.numberOfLines = 0
    hintLabel.textAlignment = .center
    hintLabel.font = .systemFont(ofSize: 14, weight: .medium)
    hintLabel.textColor = .secondaryLabel
    hintLabel.text = "保存后会批量回填到当前已选地图，并在可联网时同步到服务器。"

    let saveButton = UIButton(type: .system)
    saveButton.translatesAutoresizingMaskIntoConstraints = false
    var config = UIButton.Configuration.filled()
    config.cornerStyle = .large
    config.title = "保存地区"
    saveButton.configuration = config
    saveButton.addAction(UIAction { [weak self] _ in
      self?.confirmBatchRegionUpdate()
    }, for: .touchUpInside)

    controller.view.addSubview(summaryLabel)
    controller.view.addSubview(hintLabel)
    controller.view.addSubview(saveButton)

    NSLayoutConstraint.activate([
      summaryLabel.topAnchor.constraint(equalTo: controller.view.safeAreaLayoutGuide.topAnchor, constant: 36),
      summaryLabel.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor, constant: 24),
      summaryLabel.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor, constant: -24),

      hintLabel.topAnchor.constraint(equalTo: summaryLabel.bottomAnchor, constant: 12),
      hintLabel.leadingAnchor.constraint(equalTo: summaryLabel.leadingAnchor),
      hintLabel.trailingAnchor.constraint(equalTo: summaryLabel.trailingAnchor),

      saveButton.topAnchor.constraint(equalTo: hintLabel.bottomAnchor, constant: 24),
      saveButton.leadingAnchor.constraint(equalTo: summaryLabel.leadingAnchor),
      saveButton.trailingAnchor.constraint(equalTo: summaryLabel.trailingAnchor),
      saveButton.heightAnchor.constraint(equalToConstant: 50)
    ])

    return controller
  }

  private func confirmBatchRegionUpdate() {
    let summary = regionDraftSummary
    let presenter = batchRegionNavigationController ?? self
    let alert = UIAlertController(
      title: "批量更新地区",
      message: summary.isEmpty ? "当前没有填写新的地区信息，将保持原值不变。" : "将把已选地图统一更新为：\(summary)",
      preferredStyle: .alert
    )
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    alert.addAction(UIAlertAction(title: "保存", style: .default) { [weak self] _ in
      guard let self else { return }
      self.batchRegionNavigationController?.dismiss(animated: true) {
        self.applyBatchUpdate(title: "地区已更新") { record in
          record.withEditableMetadata(
            title: record.title,
            description: record.description,
            yearLabel: record.yearLabel ?? "",
            campaign: record.campaign ?? "",
            teachingUse: record.teachingUse ?? "",
            teachingNote: record.teachingNote ?? "",
            securityLevel: record.securityLevel ?? "",
            countryName: self.batchRegionDraft.country.isEmpty ? (record.countryName ?? "") : self.batchRegionDraft.country,
            province: self.batchRegionDraft.province.isEmpty ? (record.province ?? "") : self.batchRegionDraft.province,
            city: self.batchRegionDraft.city.isEmpty ? (record.city ?? "") : self.batchRegionDraft.city,
            district: self.batchRegionDraft.district.isEmpty ? (record.district ?? "") : self.batchRegionDraft.district,
            tags: record.tags
          )
        }
      }
    })
    presenter.present(alert, animated: true)
  }

  private func applyBatchUpdate(
    title: String,
    transform: (MapRecord) -> MapRecord
  ) {
    do {
      let affected = selectedIDs.count
      let records = try container.store.updateRecords(ids: selectedIDs, transform: transform)
      let touched = records.filter { selectedIDs.contains($0.id) }
      allRecords = records.sorted(by: sortRecords)
      setEditing(false, animated: true)
      selectedIDs.removeAll()
      applyFilter()
      container.haptics.success()

      Task { [weak self] in
        guard let self else { return }
        await self.syncBatchMetadata(title: title, touchedRecords: touched, affectedCount: affected)
      }
    } catch {
      container.haptics.error()
      let alert = UIAlertController(title: "批量更新失败", message: error.localizedDescription, preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "知道了", style: .default))
      present(alert, animated: true)
    }
  }

  @MainActor
  private func syncBatchMetadata(title: String, touchedRecords: [MapRecord], affectedCount: Int) async {
    let remoteRecords = touchedRecords.filter { !$0.id.hasPrefix("local-") && container.settings.serverBaseURL != nil }
    guard !remoteRecords.isEmpty else {
      showBatchCompletionMessage(title: title, message: "已更新 \(affectedCount) 张地图，仅保存在本地。")
      return
    }

    let progress = UIAlertController(title: title, message: "正在同步服务器…", preferredStyle: .alert)
    present(progress, animated: true)

    var syncedCount = 0
    var failedCount = 0

    for record in remoteRecords {
      do {
        let remote = try await container.apiClient.saveMetadata(for: record)
        let merged = remote.withImportedAt(record.importedAt)
        try? container.store.updateRecord(merged)
        if let index = allRecords.firstIndex(where: { $0.id == merged.id }) {
          allRecords[index] = merged
        }
        syncedCount += 1
      } catch {
        failedCount += 1
      }
    }

    allRecords.sort(by: sortRecords)
    applyFilter()
    progress.dismiss(animated: true) {
      if failedCount == 0 {
        self.showBatchCompletionMessage(
          title: title,
          message: "已更新 \(affectedCount) 张地图，并同步了 \(syncedCount) 张远端记录。"
        )
      } else {
        self.showBatchCompletionMessage(
          title: title,
          message: "已更新 \(affectedCount) 张地图；远端同步成功 \(syncedCount) 张，失败 \(failedCount) 张。"
        )
      }
    }
  }

  private func showBatchCompletionMessage(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "知道了", style: .default))
    present(alert, animated: true)
  }

  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    visibleRecords.count
  }

  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    guard let cell = tableView.dequeueReusableCell(withIdentifier: "CatalogRecordCell", for: indexPath) as? CatalogRecordCell else {
      return UITableViewCell()
    }
    let record = visibleRecords[indexPath.row]
    cell.configure(
      record: record,
      previewImage: previewImage(for: record),
      selected: selectedIDs.contains(record.id),
      editing: isEditing
    )
    return cell
  }

  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let record = visibleRecords[indexPath.row]
    if isEditing {
      container.haptics.selectionChanged()
      selectedIDs.insert(record.id)
      updateSelectionBar()
      if let cell = tableView.cellForRow(at: indexPath) as? CatalogRecordCell {
        cell.setBatchSelected(true)
      }
      return
    }
    container.haptics.softTap()
    tableView.deselectRow(at: indexPath, animated: true)
    openDetail(for: record)
  }

  func tableView(_ tableView: UITableView, didDeselectRowAt indexPath: IndexPath) {
    guard isEditing else { return }
    container.haptics.selectionChanged()
    let record = visibleRecords[indexPath.row]
    selectedIDs.remove(record.id)
    updateSelectionBar()
    if let cell = tableView.cellForRow(at: indexPath) as? CatalogRecordCell {
      cell.setBatchSelected(false)
    }
  }
}

private final class CatalogRecordCell: UITableViewCell {
  private let card = UIView()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let badgeStack = UIStackView()
  private let previewImageView = UIImageView()

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    backgroundColor = .clear
    selectionStyle = .none

    [card, titleLabel, subtitleLabel, badgeStack, previewImageView].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
    }

    contentView.addSubview(card)
    card.addSubview(titleLabel)
    card.addSubview(subtitleLabel)
    card.addSubview(badgeStack)
    card.addSubview(previewImageView)

    card.backgroundColor = .white
    card.backgroundColor = .secondarySystemGroupedBackground
    card.layer.cornerRadius = 16
    card.layer.cornerCurve = .continuous
    card.layer.borderWidth = 1
    card.layer.borderColor = UIColor.separator.cgColor

    titleLabel.font = .systemFont(ofSize: 14, weight: .bold)
    titleLabel.textColor = .label

    subtitleLabel.font = .systemFont(ofSize: 12, weight: .medium)
    subtitleLabel.textColor = .secondaryLabel
    subtitleLabel.numberOfLines = 2

    badgeStack.axis = .horizontal
    badgeStack.spacing = 5

    previewImageView.contentMode = .scaleAspectFill
    previewImageView.layer.cornerRadius = 10
    previewImageView.layer.cornerCurve = .continuous
    previewImageView.clipsToBounds = true
    previewImageView.backgroundColor = .tertiarySystemGroupedBackground
    previewImageView.tintColor = .secondaryLabel
    previewImageView.image = UIImage(systemName: "map")

    NSLayoutConstraint.activate([
      card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
      card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      card.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),

      previewImageView.centerYAnchor.constraint(equalTo: card.centerYAnchor),
      previewImageView.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
      previewImageView.widthAnchor.constraint(equalToConstant: 56),
      previewImageView.heightAnchor.constraint(equalTo: previewImageView.widthAnchor),

      titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
      titleLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
      titleLabel.trailingAnchor.constraint(equalTo: previewImageView.leadingAnchor, constant: -10),

      subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
      subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),

      badgeStack.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 8),
      badgeStack.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      badgeStack.trailingAnchor.constraint(lessThanOrEqualTo: titleLabel.trailingAnchor),
      badgeStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configure(record: MapRecord, previewImage: UIImage?, selected: Bool, editing: Bool) {
    titleLabel.text = record.title
    let area = [record.countryName, record.province, record.city, record.district]
      .compactMap { $0 }
      .filter { !$0.isEmpty }
      .joined(separator: " / ")
    let year = record.yearLabel ?? "未标年代"
    subtitleLabel.text = [
      area.isEmpty ? "未标地区" : area,
      year
    ].joined(separator: " · ")
    previewImageView.image = previewImage ?? UIImage(systemName: "map")

    badgeStack.arrangedSubviews.forEach {
      badgeStack.removeArrangedSubview($0)
      $0.removeFromSuperview()
    }

    if area.isEmpty {
      badgeStack.addArrangedSubview(makeBadge(text: "待补地区", color: UIColor(red: 0.92, green: 0.56, blue: 0.23, alpha: 1)))
    }
    if (record.yearLabel ?? "").isEmpty {
      badgeStack.addArrangedSubview(makeBadge(text: "待补年代", color: UIColor(red: 0.83, green: 0.33, blue: 0.29, alpha: 1)))
    }
    if (record.ocrText ?? "").isEmpty {
      badgeStack.addArrangedSubview(makeBadge(text: "待OCR", color: UIColor(red: 0.26, green: 0.53, blue: 0.9, alpha: 1)))
    }
    if !(record.ocrText ?? "").isEmpty && [
      record.yearLabel,
      record.countryName,
      record.province,
      record.city,
      record.campaign,
      record.teachingUse
    ]
    .compactMap({ $0?.trimmingCharacters(in: .whitespacesAndNewlines) })
    .filter({ !$0.isEmpty })
    .count < 4 {
      badgeStack.addArrangedSubview(makeBadge(text: "待AI", color: UIColor(red: 0.46, green: 0.36, blue: 0.85, alpha: 1)))
    }
    if badgeStack.arrangedSubviews.isEmpty {
      badgeStack.addArrangedSubview(makeBadge(text: "已编目", color: UIColor(red: 0.2, green: 0.67, blue: 0.54, alpha: 1)))
    }

    setBatchSelected(selected && editing)
    accessoryType = editing ? .none : .disclosureIndicator
  }

  func setBatchSelected(_ selected: Bool) {
    card.layer.borderColor = (selected ? UIColor.systemBlue : UIColor.separator).cgColor
    card.layer.borderWidth = selected ? 2 : 1
    card.backgroundColor = selected ? UIColor.systemBlue.withAlphaComponent(0.12) : .secondarySystemGroupedBackground
  }

  private func makeBadge(text: String, color: UIColor) -> UILabel {
    let label = UILabel()
    label.font = .systemFont(ofSize: 10, weight: .bold)
    label.textColor = .white
    label.textAlignment = .center
    label.backgroundColor = color
    label.layer.cornerRadius = 9
    label.layer.masksToBounds = true
    label.text = "  \(text)  "
    return label
  }
}
