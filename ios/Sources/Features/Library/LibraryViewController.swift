import PhotosUI
import UIKit
import UniformTypeIdentifiers
import ImageIO

final class LibraryViewController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegate, PHPickerViewControllerDelegate, UICollectionViewDelegateFlowLayout, UICollectionViewDataSourcePrefetching, UIDocumentPickerDelegate {
  private enum LibraryLayoutMode: Equatable {
    case list
    case square
  }

  private enum LibraryFilter: Int, CaseIterable {
    case all
    case local
    case cloud
    case needsWork
    case favorite

    var title: String {
      switch self {
      case .all: return "全部"
      case .local: return "本地"
      case .cloud: return "云端"
      case .needsWork: return "未整理"
      case .favorite: return "收藏"
      }
    }
  }

  fileprivate enum AssetState {
    case localOriginal
    case localThumbnail
    case cloudOnly

    var title: String {
      switch self {
      case .localOriginal:
        return "原图"
      case .localThumbnail:
        return "缩略图"
      case .cloudOnly:
        return "云端"
      }
    }

    var tintColor: UIColor {
      switch self {
      case .localOriginal:
        return .systemBlue
      case .localThumbnail:
        return .systemTeal
      case .cloudOnly:
        return .systemOrange
      }
    }
  }

  private let container: AppContainer
  private var allRecords: [MapRecord] = []
  private var visibleRecords: [MapRecord] = []
  private var activeFilter: LibraryFilter = .all
  private var layoutMode: LibraryLayoutMode = .list
  private var activeRegionFilter: String?

  private let headerStack = UIStackView()
  private let searchBarView = UIView()
  private let searchField = UITextField()
  private let filterStack = UIStackView()
  private let summaryRow = UIStackView()
  private let countLabel = UILabel()
  private let sortLabel = UILabel()
  private let syncBadge = UILabel()
  private let regionButton = UIButton(type: .system)
  private let layoutModeButton = UIButton(type: .system)
  private var filterButtons: [UIButton] = []
  private let collectionView: UICollectionView
  private let imageCache = NSCache<NSString, UIImage>()
  private let emptyLabel = UILabel()
  private var pendingRestoreOffset: CGPoint?
  private var pendingRestoreRecordID: String?
  private var imageLoadTasks: [String: Task<UIImage?, Never>] = [:]
  private var thumbnailGenerationTasks: [String: Task<Bool, Never>] = [:]
  private var thumbnailWarmupTask: Task<Void, Never>?
  private var lastResolvedLayoutWidth: CGFloat = 0

  init(container: AppContainer) {
    self.container = container
    let layout = UICollectionViewFlowLayout()
    layout.minimumInteritemSpacing = 0
    layout.minimumLineSpacing = 12
    layout.sectionInset = UIEdgeInsets(top: 10, left: 14, bottom: 120, right: 14)
    self.collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    super.init(nibName: nil, bundle: nil)
    title = "图库"
    tabBarItem.title = "图库"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    thumbnailWarmupTask?.cancel()
    thumbnailGenerationTasks.values.forEach { $0.cancel() }
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor.roamlyCanvas
    navigationItem.largeTitleDisplayMode = .never
    let importItem = UIBarButtonItem(image: UIImage(systemName: "plus.circle.fill"), style: .plain, target: self, action: #selector(importImages))
    importItem.accessibilityLabel = "导入图片"
    navigationItem.rightBarButtonItem = importItem
    configureHeader()
    configureCollectionView()
    configureEmptyState()
    NotificationCenter.default.addObserver(self, selector: #selector(settingsChanged), name: .appSettingsDidChange, object: nil)
    reloadLibrary()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    reloadLibrary()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let width = collectionView.bounds.width.rounded(.down)
    guard width > 0, width != lastResolvedLayoutWidth else { return }
    lastResolvedLayoutWidth = width
    collectionView.collectionViewLayout.invalidateLayout()
  }

  @objc private func settingsChanged() {
    view.window?.overrideUserInterfaceStyle = interfaceStyle(for: container.settings.interfaceStyle)
    lastResolvedLayoutWidth = 0
    collectionView.collectionViewLayout.invalidateLayout()
    collectionView.reloadData()
    restoreScrollPositionIfNeeded()
  }

  private func interfaceStyle(for style: AppSettings.InterfaceStyle) -> UIUserInterfaceStyle {
    switch style {
    case .system:
      return .unspecified
    case .light:
      return .light
    case .dark:
      return .dark
    }
  }

  private func configureHeader() {
    [headerStack, searchBarView, searchField, filterStack, summaryRow, countLabel, sortLabel, syncBadge, regionButton, layoutModeButton].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
    }

    headerStack.axis = .vertical
    headerStack.spacing = 10
    view.addSubview(headerStack)

    searchBarView.backgroundColor = .systemBackground
    searchBarView.layer.cornerRadius = 16
    searchBarView.layer.cornerCurve = .continuous
    searchBarView.layer.borderWidth = 1
    searchBarView.layer.borderColor = UIColor.roamlyHairline.cgColor
    searchBarView.heightAnchor.constraint(equalToConstant: 46).isActive = true

    let searchIcon = UIImageView(image: UIImage(systemName: "magnifyingglass"))
    searchIcon.translatesAutoresizingMaskIntoConstraints = false
    searchIcon.tintColor = .secondaryLabel
    searchIcon.contentMode = .scaleAspectFit
    searchBarView.addSubview(searchIcon)
    searchBarView.addSubview(searchField)

    searchField.font = .systemFont(ofSize: 15, weight: .semibold)
    searchField.textColor = .label
    searchField.tintColor = UIColor.roamlyOlive
    searchField.attributedPlaceholder = NSAttributedString(
      string: "搜索地图名称、地区、年代、来源、标签...",
      attributes: [.foregroundColor: UIColor.secondaryLabel]
    )
    searchField.backgroundColor = .clear
    searchField.borderStyle = .none
    searchField.clearButtonMode = .whileEditing
    searchField.returnKeyType = .search
    searchField.addTarget(self, action: #selector(searchTextChanged), for: .editingChanged)

    NSLayoutConstraint.activate([
      searchIcon.leadingAnchor.constraint(equalTo: searchBarView.leadingAnchor, constant: 14),
      searchIcon.centerYAnchor.constraint(equalTo: searchBarView.centerYAnchor),
      searchIcon.widthAnchor.constraint(equalToConstant: 18),
      searchIcon.heightAnchor.constraint(equalToConstant: 18),
      searchField.leadingAnchor.constraint(equalTo: searchIcon.trailingAnchor, constant: 10),
      searchField.trailingAnchor.constraint(equalTo: searchBarView.trailingAnchor, constant: -12),
      searchField.topAnchor.constraint(equalTo: searchBarView.topAnchor),
      searchField.bottomAnchor.constraint(equalTo: searchBarView.bottomAnchor)
    ])

    filterStack.axis = .horizontal
    filterStack.spacing = 8
    filterStack.distribution = .fillProportionally
    filterButtons = LibraryFilter.allCases.map { filter in
      let button = UIButton(type: .system)
      button.translatesAutoresizingMaskIntoConstraints = false
      button.tag = filter.rawValue
      button.addTarget(self, action: #selector(filterTapped(_:)), for: .touchUpInside)
      button.heightAnchor.constraint(equalToConstant: 34).isActive = true
      filterStack.addArrangedSubview(button)
      return button
    }

    countLabel.font = .systemFont(ofSize: 13, weight: .semibold)
    countLabel.textColor = .secondaryLabel
    sortLabel.font = .systemFont(ofSize: 13, weight: .semibold)
    sortLabel.textColor = .label
    sortLabel.textAlignment = .right
    sortLabel.text = "最新导入 ↓"

    syncBadge.font = .systemFont(ofSize: 13, weight: .semibold)
    syncBadge.textAlignment = .center
    syncBadge.layer.cornerRadius = 14
    syncBadge.layer.cornerCurve = .continuous
    syncBadge.layer.masksToBounds = true
    syncBadge.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.72)
    syncBadge.layer.borderWidth = 1
    syncBadge.layer.borderColor = UIColor.roamlyHairline.cgColor

    configureHeaderButton(regionButton, title: "地区", symbol: "mappin.and.ellipse")
    regionButton.addTarget(self, action: #selector(showRegionFilter), for: .touchUpInside)
    configureHeaderButton(layoutModeButton, title: "平铺", symbol: "square.grid.2x2")
    layoutModeButton.addTarget(self, action: #selector(toggleLayoutMode), for: .touchUpInside)

    summaryRow.axis = .horizontal
    summaryRow.alignment = .center
    summaryRow.spacing = 10
    summaryRow.addArrangedSubview(countLabel)
    summaryRow.addArrangedSubview(UIView())
    summaryRow.addArrangedSubview(regionButton)
    summaryRow.addArrangedSubview(layoutModeButton)

    headerStack.addArrangedSubview(searchBarView)
    headerStack.addArrangedSubview(filterStack)
    headerStack.addArrangedSubview(summaryRow)
    refreshFilterButtons()
    refreshRegionButton()
    refreshLayoutModeButton()
  }

  private func configureHeaderButton(_ button: UIButton, title: String, symbol: String) {
    var config = UIButton.Configuration.filled()
    config.image = UIImage(systemName: symbol)
    config.title = title
    config.imagePadding = 4
    config.cornerStyle = .capsule
    config.contentInsets = NSDirectionalEdgeInsets(top: 7, leading: 10, bottom: 7, trailing: 10)
    config.baseBackgroundColor = UIColor.systemBackground
    config.baseForegroundColor = .label
    button.configuration = config
    button.layer.cornerRadius = 15
    button.layer.cornerCurve = .continuous
    button.layer.borderWidth = 1
    button.layer.borderColor = UIColor.roamlyHairline.cgColor
    button.heightAnchor.constraint(equalToConstant: 30).isActive = true
  }

  private func configureCollectionView() {
    collectionView.translatesAutoresizingMaskIntoConstraints = false
    collectionView.backgroundColor = UIColor.roamlyCanvas
    collectionView.alwaysBounceVertical = true
    collectionView.contentInsetAdjustmentBehavior = .always
    collectionView.dataSource = self
    collectionView.delegate = self
    collectionView.prefetchDataSource = self
    collectionView.register(MapGridCell.self, forCellWithReuseIdentifier: "MapGridCell")
    collectionView.register(SquareMapCell.self, forCellWithReuseIdentifier: "SquareMapCell")
    view.addSubview(collectionView)

    NSLayoutConstraint.activate([
      headerStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
      headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
      headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),

      collectionView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 6),
      collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
  }

  private func configureEmptyState() {
    emptyLabel.translatesAutoresizingMaskIntoConstraints = false
    emptyLabel.font = .systemFont(ofSize: 15, weight: .medium)
    emptyLabel.textColor = .secondaryLabel
    emptyLabel.numberOfLines = 0
    emptyLabel.textAlignment = .center
    emptyLabel.text = "没有符合条件的地图"
    view.addSubview(emptyLabel)

    NSLayoutConstraint.activate([
      emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      emptyLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      emptyLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 32),
      emptyLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -32)
    ])
  }

  private func reloadLibrary() {
    captureScrollPosition()
    allRecords = container.store.loadRecords().sorted { $0.importedAt > $1.importedAt }
    applySearch()
    warmupMissingThumbnails()
  }

  private func applySearch() {
    let query = String(searchField.text ?? "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()

    let filtered = allRecords.filter { record in
      let filterMatches: Bool
      switch activeFilter {
      case .all:
        filterMatches = true
      case .local:
        filterMatches = container.store.hasLocalOriginal(for: record) || container.store.hasLocalThumbnail(for: record)
      case .cloud:
        filterMatches = !container.store.hasLocalOriginal(for: record)
      case .needsWork:
        filterMatches = record.needsLibraryWork
      case .favorite:
        filterMatches = record.favorite
      }
      guard filterMatches else { return false }
      guard let activeRegionFilter else { return true }
      return record.regionTokens.contains(activeRegionFilter)
    }

    visibleRecords = query.isEmpty ? filtered : filtered.filter { $0.searchableText.contains(query) }

    collectionView.reloadData()
    emptyLabel.isHidden = !visibleRecords.isEmpty
    refreshHeaderSummary()
    restoreScrollPositionIfNeeded()
  }

  private func refreshHeaderSummary() {
    countLabel.text = "共 \(allRecords.count) 张地图"
    let local = allRecords.filter { container.store.hasLocalOriginal(for: $0) || container.store.hasLocalThumbnail(for: $0) }.count
    let synced = allRecords.filter { !$0.id.hasPrefix("local-") || $0.source == "local-seed" }.count
    syncBadge.text = "  同步 \(min(synced, allRecords.count))/\(max(allRecords.count, 1))  "
    if activeFilter != .all || activeRegionFilter != nil || !(searchField.text ?? "").isEmpty {
      countLabel.text = "显示 \(visibleRecords.count) / \(allRecords.count) 张，本地 \(local)"
    }
    refreshFilterButtons()
    refreshRegionButton()
    refreshLayoutModeButton()
  }

  private func refreshFilterButtons() {
    for button in filterButtons {
      guard let filter = LibraryFilter(rawValue: button.tag) else { continue }
      var config = UIButton.Configuration.filled()
      config.cornerStyle = .capsule
      config.title = filter.title
      config.contentInsets = NSDirectionalEdgeInsets(top: 7, leading: 14, bottom: 7, trailing: 14)
      config.baseBackgroundColor = filter == activeFilter ? UIColor.roamlyOlive : UIColor.systemBackground.withAlphaComponent(0.78)
      config.baseForegroundColor = filter == activeFilter ? .white : .label
      button.configuration = config
      button.layer.cornerRadius = 17
      button.layer.cornerCurve = .continuous
      button.layer.borderWidth = filter == activeFilter ? 0 : 1
      button.layer.borderColor = UIColor.roamlyHairline.cgColor
      button.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
    }
  }

  private func assetState(for record: MapRecord) -> AssetState {
    if container.store.hasLocalOriginal(for: record) {
      return .localOriginal
    }
    if container.store.hasLocalThumbnail(for: record) {
      return .localThumbnail
    }
    return .cloudOnly
  }

  private func cacheKey(for record: MapRecord, targetSize: CGSize) -> NSString {
    let scale = view.window?.screen.scale ?? UIScreen.main.scale
    let pixelWidth = Int((targetSize.width * scale).rounded())
    let pixelHeight = Int((targetSize.height * scale).rounded())
    return NSString(string: "\(record.id)-\(max(pixelWidth, 1))x\(max(pixelHeight, 1))")
  }

  private func previewImage(for record: MapRecord, targetSize: CGSize) -> UIImage? {
    let key = cacheKey(for: record, targetSize: targetSize)
    if let cached = imageCache.object(forKey: key) {
      return cached
    }

    return nil
  }

  private func preferredImageURL(for record: MapRecord) -> URL? {
    let thumbnailURL = container.store.localThumbnailURL(for: record)
    guard FileManager.default.fileExists(atPath: thumbnailURL.path) else {
      return nil
    }
    return thumbnailURL
  }

  private func loadImageIfNeeded(for record: MapRecord, targetSize: CGSize, completion: @escaping (UIImage?) -> Void) {
    let key = cacheKey(for: record, targetSize: targetSize)
    if let cached = imageCache.object(forKey: key) {
      completion(cached)
      return
    }

    if let existingTask = imageLoadTasks[record.id] {
      Task { completion(await existingTask.value) }
      return
    }

    guard let imageURL = preferredImageURL(for: record) else {
      ensureThumbnailGeneration(for: record, reloadOnCompletion: true)
      completion(nil)
      return
    }

    let scale = view.window?.screen.scale ?? UIScreen.main.scale
    let maxPixelSize = max(targetSize.width, targetSize.height, 1) * scale * 1.8
    let task = Task(priority: .userInitiated) {
      autoreleasepool {
        Self.downsampledImage(at: imageURL, maxPixelSize: maxPixelSize)
      }
    }

    imageLoadTasks[record.id] = task
    Task { [weak self] in
      let image = await task.value
      await MainActor.run {
        if let image {
          self?.imageCache.setObject(image, forKey: key)
        }
        self?.imageLoadTasks[record.id] = nil
        completion(image)
      }
    }
  }

  private func requestImage(for cell: MapGridCell, record: MapRecord, at indexPath: IndexPath) {
    let size = resolvedGridLayout(for: collectionView.bounds.width)
    let targetSize = CGSize(width: 120, height: size.imageHeight)
    if let image = previewImage(for: record, targetSize: targetSize) {
      cell.apply(image: image)
      return
    }

    cell.apply(image: nil)
    loadImageIfNeeded(for: record, targetSize: targetSize) { [weak self, weak cell] image in
      guard
        let self,
        let cell,
        cell.representedRecordID == record.id,
        self.collectionView.indexPath(for: cell) == indexPath
      else { return }
      cell.apply(image: image)
    }
  }

  nonisolated private static func downsampledImage(at url: URL, maxPixelSize: CGFloat) -> UIImage? {
    let options = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, options) else { return nil }

    let downsampleOptions = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: max(Int(maxPixelSize.rounded()), 1)
    ] as CFDictionary

    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, downsampleOptions) else {
      return nil
    }

    return UIImage(cgImage: cgImage)
  }

  @objc private func importImages() {
    let alert = UIAlertController(title: "导入地图", message: nil, preferredStyle: .actionSheet)
    alert.addAction(UIAlertAction(title: "从相册选择", style: .default) { [weak self] _ in
      self?.pickFromPhotos()
    })
    alert.addAction(UIAlertAction(title: "从文件选择", style: .default) { [weak self] _ in
      self?.pickFromFiles()
    })
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.barButtonItem = navigationItem.rightBarButtonItem
    }
    present(alert, animated: true)
  }

  private func pickFromPhotos() {
    var configuration = PHPickerConfiguration(photoLibrary: .shared())
    configuration.selectionLimit = 0
    configuration.filter = .images
    let picker = PHPickerViewController(configuration: configuration)
    picker.delegate = self
    present(picker, animated: true)
  }

  private func pickFromFiles() {
    let supportedTypes: [UTType] = [.image, .jpeg, .png, .heic, .gif, .webP, .tiff, .bmp]
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: supportedTypes, asCopy: true)
    picker.allowsMultipleSelection = true
    picker.delegate = self
    present(picker, animated: true)
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard !urls.isEmpty else { return }
    container.haptics.mediumTap()

    Task { [weak self] in
      guard let self else { return }
      do {
        let validURLs = urls.filter { url in
          let ext = url.pathExtension.lowercased()
          return ["jpg", "jpeg", "png", "heic", "gif", "webp", "tiff", "tif", "bmp"].contains(ext)
        }
        guard !validURLs.isEmpty else {
          self.showMessage(title: "无法导入", message: "所选文件不包含支持的图片格式（JPG、PNG、HEIC、GIF、WebP、TIFF）。")
          return
        }
        _ = try self.container.store.importLocalImages(fileURLs: validURLs)
        _ = try await self.container.ocrIndexService.indexRecordsNeedingOCR()
        self.container.haptics.success()
        self.reloadLibrary()
      } catch {
        self.container.haptics.error()
        self.showMessage(title: "导入失败", message: error.localizedDescription)
      }
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    // No action needed
  }

  @objc private func filterTapped(_ sender: UIButton) {
    guard let filter = LibraryFilter(rawValue: sender.tag) else { return }
    container.haptics.selectionChanged()
    activeFilter = filter
    applySearch()
  }

  @objc private func searchTextChanged() {
    applySearch()
  }

  @objc private func toggleLayoutMode() {
    container.haptics.selectionChanged()
    layoutMode = layoutMode == .list ? .square : .list
    updateCollectionLayoutForMode()
    refreshLayoutModeButton()
    collectionView.reloadData()
  }

  private func updateCollectionLayoutForMode() {
    guard let layout = collectionView.collectionViewLayout as? UICollectionViewFlowLayout else { return }
    switch layoutMode {
    case .list:
      layout.minimumInteritemSpacing = 0
      layout.minimumLineSpacing = 12
      layout.sectionInset = UIEdgeInsets(top: 10, left: 14, bottom: 120, right: 14)
    case .square:
      layout.minimumInteritemSpacing = 10
      layout.minimumLineSpacing = 10
      layout.sectionInset = UIEdgeInsets(top: 10, left: 14, bottom: 120, right: 14)
    }
    lastResolvedLayoutWidth = 0
    layout.invalidateLayout()
  }

  private func refreshLayoutModeButton() {
    var config = layoutModeButton.configuration ?? UIButton.Configuration.filled()
    config.title = layoutMode == .list ? "平铺" : "列表"
    config.image = UIImage(systemName: layoutMode == .list ? "square.grid.2x2" : "list.bullet")
    layoutModeButton.configuration = config
  }

  @objc private func showRegionFilter() {
    let alert = UIAlertController(title: "地区筛选", message: nil, preferredStyle: .actionSheet)
    alert.addAction(UIAlertAction(title: "全部地区", style: .default) { [weak self] _ in
      self?.setRegionFilter(nil)
    })

    let countries = orderedRegionValues { $0.countryName }
    if !countries.isEmpty {
      alert.addAction(UIAlertAction(title: "按国家/地区", style: .default) { [weak self] _ in
        self?.showRegionOptions(title: "国家/地区", values: countries)
      })
    }

    let provinces = orderedRegionValues { $0.province }
    if !provinces.isEmpty {
      alert.addAction(UIAlertAction(title: "按省/州", style: .default) { [weak self] _ in
        self?.showRegionOptions(title: "省/州", values: provinces)
      })
    }

    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.sourceView = regionButton
      popover.sourceRect = regionButton.bounds
    }
    present(alert, animated: true)
  }

  private func showRegionOptions(title: String, values: [String]) {
    let alert = UIAlertController(title: title, message: nil, preferredStyle: .actionSheet)
    values.prefix(18).forEach { value in
      alert.addAction(UIAlertAction(title: value, style: .default) { [weak self] _ in
        self?.setRegionFilter(value)
      })
    }
    if values.count > 18 {
      alert.message = "仅显示当前图库中数量最多的 18 个地区"
    }
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.sourceView = regionButton
      popover.sourceRect = regionButton.bounds
    }
    present(alert, animated: true)
  }

  private func setRegionFilter(_ value: String?) {
    container.haptics.selectionChanged()
    activeRegionFilter = value
    applySearch()
  }

  private func refreshRegionButton() {
    var config = regionButton.configuration ?? UIButton.Configuration.filled()
    config.title = activeRegionFilter ?? "地区"
    config.baseBackgroundColor = activeRegionFilter == nil ? UIColor.systemBackground : UIColor.roamlyOlive
    config.baseForegroundColor = activeRegionFilter == nil ? .label : .white
    regionButton.configuration = config
  }

  private func orderedRegionValues(_ keyPath: (MapRecord) -> String?) -> [String] {
    let counts = Dictionary(grouping: allRecords.compactMap { record -> String? in
      let value = keyPath(record)?.trimmingCharacters(in: .whitespacesAndNewlines)
      return value?.isEmpty == false ? value : nil
    }, by: { $0 }).mapValues(\.count)

    return counts.keys.sorted {
      let lhsCount = counts[$0] ?? 0
      let rhsCount = counts[$1] ?? 0
      if lhsCount != rhsCount { return lhsCount > rhsCount }
      return $0.localizedStandardCompare($1) == .orderedAscending
    }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    dismiss(animated: true)
    guard !results.isEmpty else { return }

    Task { [weak self] in
      guard let self else { return }
      do {
        let fileURLs = try await self.loadImageFiles(results: results)
        _ = try self.container.store.importLocalImages(fileURLs: fileURLs)
        _ = try await self.container.ocrIndexService.indexRecordsNeedingOCR()
        self.reloadLibrary()
      } catch {
        self.showMessage(title: "导入失败", message: error.localizedDescription)
      }
    }
  }

  private func loadImageFiles(results: [PHPickerResult]) async throws -> [URL] {
    try await withThrowingTaskGroup(of: URL.self) { group in
      for result in results {
        group.addTask { try await Self.copyPickedFile(result: result) }
      }
      var urls: [URL] = []
      for try await url in group {
        urls.append(url)
      }
      return urls
    }
  }

  private static func copyPickedFile(result: PHPickerResult) async throws -> URL {
    let provider = result.itemProvider
    return try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }
        guard let url else {
          continuation.resume(throwing: APIClient.APIError.invalidResponse)
          return
        }
        let ext = url.pathExtension.isEmpty ? "jpg" : url.pathExtension
        let target = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
        do {
          if FileManager.default.fileExists(atPath: target.path) {
            try FileManager.default.removeItem(at: target)
          }
          try FileManager.default.copyItem(at: url, to: target)
          continuation.resume(returning: target)
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
    visibleRecords.count
  }

  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    let record = visibleRecords[indexPath.item]
    let size = resolvedGridLayout(for: collectionView.bounds.width)
    if layoutMode == .square {
      guard let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "SquareMapCell", for: indexPath) as? SquareMapCell else {
        return UICollectionViewCell()
      }
      cell.configure(record: record, state: assetState(for: record))
      cell.apply(image: previewImage(for: record, targetSize: CGSize(width: size.width, height: size.imageHeight)))
      loadImageIfNeeded(for: record, targetSize: CGSize(width: size.width, height: size.imageHeight)) { [weak self, weak cell] image in
        guard
          let self,
          let cell,
          cell.representedRecordID == record.id,
          self.collectionView.indexPath(for: cell) == indexPath
        else { return }
        cell.apply(image: image)
      }
      return cell
    }

    guard let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "MapGridCell", for: indexPath) as? MapGridCell else {
      return UICollectionViewCell()
    }
    cell.configure(
      record: record,
      state: assetState(for: record),
      subtitle: record.subtitleText,
      imageHeight: size.imageHeight,
      showMetadata: container.settings.showTitlesOnLibrary
    )
    cell.onMoreTapped = { [weak self] sourceView in
      self?.showRecordActions(for: record, sourceView: sourceView)
    }
    cell.apply(image: previewImage(for: record, targetSize: CGSize(width: 120, height: size.imageHeight)))
    requestImage(for: cell, record: record, at: indexPath)
    return cell
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    container.haptics.softTap()
    openDetail(for: visibleRecords[indexPath.item])
  }

  func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
    let boundsWidth = collectionView.bounds.width
    let size = resolvedGridLayout(for: boundsWidth)
    return CGSize(width: size.width, height: size.itemHeight)
  }

  private func resolvedGridLayout(for availableWidth: CGFloat) -> (width: CGFloat, imageHeight: CGFloat, itemHeight: CGFloat) {
    let layout = collectionView.collectionViewLayout as? UICollectionViewFlowLayout
    let sectionInset = layout?.sectionInset ?? .zero
    if layoutMode == .square {
      let columns: CGFloat = traitCollection.userInterfaceIdiom == .pad ? 4 : 2
      let spacing = layout?.minimumInteritemSpacing ?? 10
      let itemWidth = floor((availableWidth - sectionInset.left - sectionInset.right - spacing * (columns - 1)) / columns)
      return (itemWidth, itemWidth, itemWidth + 68)
    }
    let itemWidth = floor(availableWidth - sectionInset.left - sectionInset.right)
    let isPad = traitCollection.userInterfaceIdiom == .pad
    let itemHeight: CGFloat = isPad ? 238 : 180
    return (itemWidth, isPad ? 170 : 126, itemHeight)
  }

  private func captureScrollPosition() {
    pendingRestoreOffset = collectionView.contentOffset
    let sortedVisible = collectionView.indexPathsForVisibleItems.sorted()
    if let anchorIndexPath = sortedVisible.first, visibleRecords.indices.contains(anchorIndexPath.item) {
      pendingRestoreRecordID = visibleRecords[anchorIndexPath.item].id
    }
  }

  private func restoreScrollPositionIfNeeded() {
    guard pendingRestoreOffset != nil || pendingRestoreRecordID != nil else { return }

    collectionView.layoutIfNeeded()

    if let recordID = pendingRestoreRecordID,
       let item = visibleRecords.firstIndex(where: { $0.id == recordID }) {
      let indexPath = IndexPath(item: item, section: 0)
      collectionView.scrollToItem(at: indexPath, at: .top, animated: false)
    }

    if let offset = pendingRestoreOffset {
      let maxOffsetY = max(collectionView.contentSize.height - collectionView.bounds.height + collectionView.adjustedContentInset.bottom, -collectionView.adjustedContentInset.top)
      let clampedOffset = CGPoint(
        x: max(-collectionView.adjustedContentInset.left, offset.x),
        y: min(max(offset.y, -collectionView.adjustedContentInset.top), maxOffsetY)
      )
      collectionView.setContentOffset(clampedOffset, animated: false)
    }

    pendingRestoreOffset = nil
    pendingRestoreRecordID = nil
  }

  func collectionView(_ collectionView: UICollectionView, contextMenuConfigurationForItemAt indexPath: IndexPath, point: CGPoint) -> UIContextMenuConfiguration? {
    let record = visibleRecords[indexPath.item]
    let size = resolvedGridLayout(for: collectionView.bounds.width)
    return UIContextMenuConfiguration(identifier: nil, previewProvider: { [weak self] in
      guard let self else { return nil }
      return ImagePreviewViewController(
        image: self.previewImage(for: record, targetSize: CGSize(width: size.width, height: size.imageHeight)),
        title: record.title
      )
    }, actionProvider: { [weak self] _ in
      guard let self else { return nil }

      let edit = UIAction(title: "编辑", image: UIImage(systemName: "slider.horizontal.3")) { _ in
        self.container.haptics.selectionChanged()
        self.openDetail(for: record)
      }

      let aiExtract = UIAction(title: "AI 提取", image: UIImage(systemName: "sparkles")) { _ in
        self.container.haptics.mediumTap()
        self.runAIExtract(for: record)
      }

      let favorite = UIAction(
        title: record.favorite ? "取消收藏" : "加入收藏",
        image: UIImage(systemName: record.favorite ? "star.slash" : "star.fill")
      ) { _ in
        self.container.haptics.selectionChanged()
        self.toggleFavorite(for: record)
      }

      let delete = UIAction(title: "删除", image: UIImage(systemName: "trash"), attributes: .destructive) { _ in
        self.container.haptics.warning()
        self.confirmDelete(record: record)
      }

      return UIMenu(title: "", children: [edit, aiExtract, favorite, delete])
    })
  }

  private func openDetail(for record: MapRecord) {
    captureScrollPosition()
    container.haptics.prepare()
    let detail = MapDetailViewController(container: container, record: record) { [weak self] updated in
      guard let self else { return }
      if let index = self.allRecords.firstIndex(where: { $0.id == updated.id }) {
        self.allRecords[index] = updated
      }
      self.allRecords.sort { $0.importedAt > $1.importedAt }
      self.pendingRestoreRecordID = updated.id
      self.applySearch()
    }
    navigationController?.pushViewController(detail, animated: true)
  }

  private func confirmDelete(record: MapRecord) {
    let alert = UIAlertController(title: record.title, message: nil, preferredStyle: .actionSheet)
    alert.addAction(UIAlertAction(title: "编辑", style: .default) { [weak self] _ in
      self?.openDetail(for: record)
    })
    alert.addAction(UIAlertAction(title: "删除", style: .destructive) { [weak self] _ in
      self?.delete(record: record)
    })
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.sourceView = view
      popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
    }
    present(alert, animated: true)
  }

  private func showRecordActions(for record: MapRecord, sourceView: UIView) {
    container.haptics.selectionChanged()
    let alert = UIAlertController(title: record.title, message: nil, preferredStyle: .actionSheet)
    alert.addAction(UIAlertAction(title: "编辑信息", style: .default) { [weak self] _ in
      self?.openDetail(for: record)
    })
    alert.addAction(UIAlertAction(title: "AI 提取元数据", style: .default) { [weak self] _ in
      self?.runAIExtract(for: record)
    })
    alert.addAction(UIAlertAction(title: record.favorite ? "取消收藏" : "加入收藏", style: .default) { [weak self] _ in
      self?.toggleFavorite(for: record)
    })
    alert.addAction(UIAlertAction(title: "删除", style: .destructive) { [weak self] _ in
      self?.delete(record: record)
    })
    alert.addAction(UIAlertAction(title: "取消", style: .cancel))
    if let popover = alert.popoverPresentationController {
      popover.sourceView = sourceView
      popover.sourceRect = sourceView.bounds
    }
    present(alert, animated: true)
  }

  private func runAIExtract(for record: MapRecord) {
    Task { [weak self] in
      guard let self else { return }
      do {
        let updated = try await self.container.aiMetadataService.organizeRecord(record) { message in
          Task { @MainActor in
            // Progress is shown via the AI progress center
          }
        }
        self.container.haptics.success()
        if let index = self.allRecords.firstIndex(where: { $0.id == updated.id }) {
          self.allRecords[index] = updated
        }
        self.applySearch()
      } catch {
        self.container.haptics.error()
        self.showMessage(title: "AI 提取失败", message: error.localizedDescription)
      }
    }
  }

  private func toggleFavorite(for record: MapRecord) {
    let updated = record.withEditableMetadata(
      title: record.title,
      description: record.description,
      yearLabel: record.yearLabel ?? "",
      campaign: record.campaign ?? "",
      teachingUse: record.teachingUse ?? "",
      teachingNote: record.teachingNote ?? "",
      securityLevel: record.securityLevel ?? "",
      scopeLevel: record.scopeLevel,
      countryCode: record.countryCode,
      countryName: record.countryName ?? "",
      province: record.province ?? "",
      city: record.city ?? "",
      district: record.district ?? "",
      tags: record.tags
    )
    // Toggle favorite by creating a new record with toggled value
    let toggled = MapRecord(
      id: updated.id,
      fileName: updated.fileName,
      title: updated.title,
      description: updated.description,
      tags: updated.tags,
      collectionUnit: updated.collectionUnit,
      scopeLevel: updated.scopeLevel,
      countryCode: updated.countryCode,
      countryName: updated.countryName,
      province: updated.province,
      relatedCountries: updated.relatedCountries,
      relatedProvinces: updated.relatedProvinces,
      city: updated.city,
      district: updated.district,
      latitude: updated.latitude,
      longitude: updated.longitude,
      northLatitude: updated.northLatitude,
      southLatitude: updated.southLatitude,
      eastLongitude: updated.eastLongitude,
      westLongitude: updated.westLongitude,
      coverageOutline: updated.coverageOutline,
      yearLabel: updated.yearLabel,
      campaign: updated.campaign,
      teachingUse: updated.teachingUse,
      teachingNote: updated.teachingNote,
      securityLevel: updated.securityLevel,
      favorite: !record.favorite,
      mime: updated.mime,
      width: updated.width,
      height: updated.height,
      sizeBytes: updated.sizeBytes,
      mtimeMs: updated.mtimeMs,
      updatedAt: ISO8601DateFormatter().string(from: Date()),
      createdAt: updated.createdAt,
      source: updated.source,
      ocrStatus: updated.ocrStatus,
      ocrExcerpt: updated.ocrExcerpt,
      ocrText: updated.ocrText,
      importedAt: updated.importedAt,
      files: updated.files
    )
    do {
      try container.store.updateRecord(toggled)
      container.haptics.success()
      if let index = allRecords.firstIndex(where: { $0.id == toggled.id }) {
        allRecords[index] = toggled
      }
      applySearch()
    } catch {
      container.haptics.error()
      showMessage(title: "操作失败", message: error.localizedDescription)
    }
  }

  private func delete(record: MapRecord) {
    do {
      try container.store.deleteRecord(record)
      imageCache.removeAllObjects()
      container.haptics.success()
      reloadLibrary()
    } catch {
      container.haptics.error()
      showMessage(title: "删除失败", message: error.localizedDescription)
    }
  }

  private func showMessage(title: String, message: String) {
    let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "知道了", style: .default))
    present(alert, animated: true)
  }

  func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
    let size = resolvedGridLayout(for: collectionView.bounds.width)
    let targetSize = CGSize(width: size.width, height: size.imageHeight)
    for indexPath in indexPaths where visibleRecords.indices.contains(indexPath.item) {
      let record = visibleRecords[indexPath.item]
      ensureThumbnailGeneration(for: record, reloadOnCompletion: false)
      loadImageIfNeeded(for: record, targetSize: targetSize) { _ in }
    }
  }

  func collectionView(_ collectionView: UICollectionView, cancelPrefetchingForItemsAt indexPaths: [IndexPath]) {
    for indexPath in indexPaths where visibleRecords.indices.contains(indexPath.item) {
      let record = visibleRecords[indexPath.item]
      imageLoadTasks[record.id]?.cancel()
      imageLoadTasks[record.id] = nil
    }
  }

  private func warmupMissingThumbnails() {
    thumbnailWarmupTask?.cancel()
    let records = allRecords
    guard !records.isEmpty else { return }

    thumbnailWarmupTask = Task(priority: .utility) { [weak self] in
      guard let self else { return }
      var generatedCount = 0

      for record in records {
        if Task.isCancelled { return }
        if self.container.store.hasLocalThumbnail(for: record) {
          continue
        }

        let generated = await self.ensureThumbnailGenerationTask(for: record).value
        if generated {
          generatedCount += 1
          if generatedCount % 24 == 0 {
            await MainActor.run {
              self.collectionView.reloadData()
            }
          }
        }
      }

      if generatedCount > 0 {
        await MainActor.run {
          self.imageCache.removeAllObjects()
          self.collectionView.reloadData()
        }
      }
    }
  }

  private func ensureThumbnailGeneration(for record: MapRecord, reloadOnCompletion: Bool) {
    guard !container.store.hasLocalThumbnail(for: record) else { return }
    let task = ensureThumbnailGenerationTask(for: record)
    guard reloadOnCompletion else { return }

    Task { [weak self] in
      guard let self else { return }
      let generated = await task.value
      guard generated else { return }
      await MainActor.run {
        self.imageCache.removeAllObjects()
        if let index = self.visibleRecords.firstIndex(where: { $0.id == record.id }) {
          let indexPath = IndexPath(item: index, section: 0)
          if self.collectionView.indexPathsForVisibleItems.contains(indexPath) {
            self.collectionView.reloadItems(at: [indexPath])
          }
        }
      }
    }
  }

  private func ensureThumbnailGenerationTask(for record: MapRecord) -> Task<Bool, Never> {
    if let existing = thumbnailGenerationTasks[record.id] {
      return existing
    }

    let task = Task(priority: .utility) { [weak self] in
      guard let self else { return false }
      return self.container.store.generateThumbnailIfNeeded(for: record, maxPixelSize: 1280)
    }
    thumbnailGenerationTasks[record.id] = task

    Task { [weak self] in
      _ = await task.value
      await MainActor.run {
        self?.thumbnailGenerationTasks[record.id] = nil
      }
    }

    return task
  }
}

private final class MapGridCell: UICollectionViewCell {
  private let imageView = UIImageView()
  private let imageContainerView = UIView()
  private let favoriteBadge = UIImageView(image: UIImage(systemName: "star.fill"))
  private let contentStack = UIStackView()
  private let metadataStack = UIStackView()
  private let titleLabel = UILabel()
  private let detailLabel = UILabel()
  private let ocrBadge = UILabel()
  private let localBadge = UILabel()
  private let syncBadge = UILabel()
  private let tagStack = UIStackView()
  private let outlineView = CoverageOutlineView()
  private let rangeLabel = UILabel()
  private let moreButton = UIButton(type: .system)
  private var imageHeightConstraint: NSLayoutConstraint?
  private var imageWidthConstraint: NSLayoutConstraint?
  fileprivate private(set) var representedRecordID: String?
  var onMoreTapped: ((UIView) -> Void)?

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentView.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
    contentView.layer.cornerRadius = 8
    contentView.layer.cornerCurve = .continuous
    contentView.layer.masksToBounds = true

    contentView.layer.borderWidth = 1
    contentView.layer.borderColor = UIColor.roamlyHairline.cgColor

    [imageContainerView, contentStack, outlineView, rangeLabel, moreButton].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      contentView.addSubview($0)
    }

    imageContainerView.layer.cornerRadius = 7
    imageContainerView.layer.cornerCurve = .continuous
    imageContainerView.layer.masksToBounds = true
    imageContainerView.backgroundColor = UIColor(red: 0.84, green: 0.86, blue: 0.78, alpha: 1)
    imageHeightConstraint = imageContainerView.heightAnchor.constraint(equalToConstant: 126)
    imageWidthConstraint = imageContainerView.widthAnchor.constraint(equalToConstant: 170)
    imageHeightConstraint?.isActive = true
    imageWidthConstraint?.isActive = true

    imageView.translatesAutoresizingMaskIntoConstraints = false
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.backgroundColor = .secondarySystemFill
    imageContainerView.addSubview(imageView)

    favoriteBadge.translatesAutoresizingMaskIntoConstraints = false
    favoriteBadge.tintColor = UIColor(red: 0.88, green: 0.67, blue: 0.12, alpha: 1)
    favoriteBadge.backgroundColor = UIColor.roamlyOlive.withAlphaComponent(0.84)
    favoriteBadge.layer.cornerRadius = 7
    favoriteBadge.layer.cornerCurve = .continuous
    favoriteBadge.contentMode = .center
    favoriteBadge.clipsToBounds = true
    imageContainerView.addSubview(favoriteBadge)

    contentStack.axis = .vertical
    contentStack.spacing = 6
    contentStack.alignment = .fill

    metadataStack.axis = .vertical
    metadataStack.spacing = 5

    titleLabel.font = .systemFont(ofSize: 15, weight: .bold)
    titleLabel.textColor = .label
    titleLabel.numberOfLines = 1
    titleLabel.adjustsFontSizeToFitWidth = true
    titleLabel.minimumScaleFactor = 0.82

    detailLabel.font = .systemFont(ofSize: 12, weight: .medium)
    detailLabel.textColor = .secondaryLabel
    detailLabel.numberOfLines = 3

    metadataStack.addArrangedSubview(titleLabel)
    metadataStack.addArrangedSubview(detailLabel)

    [ocrBadge, localBadge, syncBadge].forEach {
      $0.font = .systemFont(ofSize: 10, weight: .bold)
      $0.textAlignment = .center
      $0.layer.cornerRadius = 6
      $0.layer.cornerCurve = .continuous
      $0.layer.masksToBounds = true
      $0.heightAnchor.constraint(equalToConstant: 24).isActive = true
    }

    let badgeRow = UIStackView(arrangedSubviews: [ocrBadge, localBadge, syncBadge, UIView()])
    badgeRow.axis = .horizontal
    badgeRow.spacing = 6
    badgeRow.alignment = .center

    tagStack.axis = .horizontal
    tagStack.spacing = 6
    tagStack.alignment = .leading
    tagStack.distribution = .fillProportionally

    contentStack.addArrangedSubview(metadataStack)
    contentStack.addArrangedSubview(badgeRow)
    contentStack.addArrangedSubview(tagStack)

    outlineView.backgroundColor = UIColor(red: 0.98, green: 0.98, blue: 0.95, alpha: 1)
    outlineView.layer.cornerRadius = 6
    outlineView.layer.cornerCurve = .continuous
    outlineView.layer.borderWidth = 1
    outlineView.layer.borderColor = UIColor.roamlyHairline.cgColor
    outlineView.clipsToBounds = true

    rangeLabel.font = .systemFont(ofSize: 10, weight: .medium)
    rangeLabel.textColor = .secondaryLabel
    rangeLabel.numberOfLines = 3

    var moreConfig = UIButton.Configuration.plain()
    moreConfig.image = UIImage(systemName: "ellipsis")
    moreConfig.baseForegroundColor = .label
    moreButton.configuration = moreConfig
    moreButton.addTarget(self, action: #selector(moreTapped), for: .touchUpInside)

    NSLayoutConstraint.activate([
      imageContainerView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 14),
      imageContainerView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),

      imageView.topAnchor.constraint(equalTo: imageContainerView.topAnchor),
      imageView.leadingAnchor.constraint(equalTo: imageContainerView.leadingAnchor),
      imageView.trailingAnchor.constraint(equalTo: imageContainerView.trailingAnchor),
      imageView.bottomAnchor.constraint(equalTo: imageContainerView.bottomAnchor),

      favoriteBadge.topAnchor.constraint(equalTo: imageContainerView.topAnchor),
      favoriteBadge.leadingAnchor.constraint(equalTo: imageContainerView.leadingAnchor),
      favoriteBadge.widthAnchor.constraint(equalToConstant: 30),
      favoriteBadge.heightAnchor.constraint(equalToConstant: 30),

      contentStack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 14),
      contentStack.leadingAnchor.constraint(equalTo: imageContainerView.trailingAnchor, constant: 12),
      contentStack.trailingAnchor.constraint(equalTo: outlineView.leadingAnchor, constant: -10),

      outlineView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 50),
      outlineView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
      outlineView.widthAnchor.constraint(equalToConstant: 74),
      outlineView.heightAnchor.constraint(equalToConstant: 56),

      rangeLabel.topAnchor.constraint(equalTo: outlineView.bottomAnchor, constant: 6),
      rangeLabel.leadingAnchor.constraint(equalTo: outlineView.leadingAnchor),
      rangeLabel.trailingAnchor.constraint(equalTo: outlineView.trailingAnchor),

      moreButton.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
      moreButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -4),
      moreButton.widthAnchor.constraint(equalToConstant: 34),
      moreButton.heightAnchor.constraint(equalToConstant: 34),

      imageContainerView.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -14),
      contentStack.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -12)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    representedRecordID = nil
    onMoreTapped = nil
    imageView.image = nil
    tagStack.arrangedSubviews.forEach {
      tagStack.removeArrangedSubview($0)
      $0.removeFromSuperview()
    }
  }

  func configure(record: MapRecord, state: LibraryViewController.AssetState, subtitle: String, imageHeight: CGFloat, showMetadata: Bool) {
    representedRecordID = record.id
    imageHeightConstraint?.constant = imageHeight
    imageWidthConstraint?.constant = 120
    titleLabel.text = record.title
    detailLabel.text = [
      iconLine("calendar", record.yearLabel ?? "年代待补"),
      iconLine("mappin.and.ellipse", subtitle),
      iconLine("doc.text", record.sourceDisplayText)
    ].joined(separator: "\n")

    favoriteBadge.isHidden = !record.favorite
    configureBadge(ocrBadge, text: "OCR \(record.ocrDisplayText)", color: record.ocrTintColor)
    configureBadge(localBadge, text: state == .cloudOnly ? "云端" : "本地", color: state == .cloudOnly ? .systemBlue : UIColor.roamlyGreen)
    configureBadge(syncBadge, text: record.id.hasPrefix("local-") ? "未同步" : "已同步", color: record.id.hasPrefix("local-") ? .systemRed : UIColor.roamlyGreen)

    let visibleTags = Array(record.tags.prefix(4))
    for tag in visibleTags {
      tagStack.addArrangedSubview(makeTagLabel(tag))
    }

    outlineView.configure(record: record)
    rangeLabel.text = record.coverageRangeText
  }

  func apply(image: UIImage?) {
    imageView.image = image
  }

  private func iconLine(_ systemName: String, _ text: String) -> String {
    text
  }

  private func configureBadge(_ label: UILabel, text: String, color: UIColor) {
    label.text = " \(text) "
    label.textColor = color
    label.backgroundColor = color.withAlphaComponent(0.12)
  }

  private func makeTagLabel(_ text: String) -> UILabel {
    let label = UILabel()
    label.font = .systemFont(ofSize: 10, weight: .semibold)
    label.textColor = .secondaryLabel
    label.textAlignment = .center
    label.text = " \(text) "
    label.backgroundColor = UIColor.secondarySystemGroupedBackground
    label.layer.cornerRadius = 6
    label.layer.cornerCurve = .continuous
    label.layer.masksToBounds = true
    label.heightAnchor.constraint(equalToConstant: 24).isActive = true
    return label
  }

  @objc private func moreTapped() {
    onMoreTapped?(moreButton)
  }
}

private final class SquareMapCell: UICollectionViewCell {
  private let imageView = UIImageView()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let stateBadge = UILabel()
  fileprivate private(set) var representedRecordID: String?

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentView.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.94)
    contentView.layer.cornerRadius = 8
    contentView.layer.cornerCurve = .continuous
    contentView.layer.borderWidth = 1
    contentView.layer.borderColor = UIColor.roamlyHairline.cgColor
    contentView.clipsToBounds = true

    [imageView, titleLabel, subtitleLabel, stateBadge].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      contentView.addSubview($0)
    }

    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.backgroundColor = .secondarySystemFill

    titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
    titleLabel.textColor = .label
    titleLabel.numberOfLines = 1
    titleLabel.lineBreakMode = .byTruncatingTail

    subtitleLabel.font = .systemFont(ofSize: 10, weight: .semibold)
    subtitleLabel.textColor = .secondaryLabel
    subtitleLabel.numberOfLines = 1
    subtitleLabel.lineBreakMode = .byTruncatingTail

    stateBadge.font = .systemFont(ofSize: 9, weight: .bold)
    stateBadge.textAlignment = .center
    stateBadge.layer.cornerRadius = 6
    stateBadge.layer.cornerCurve = .continuous
    stateBadge.clipsToBounds = true

    NSLayoutConstraint.activate([
      imageView.topAnchor.constraint(equalTo: contentView.topAnchor),
      imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      imageView.heightAnchor.constraint(equalTo: contentView.widthAnchor),

      stateBadge.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
      stateBadge.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
      stateBadge.heightAnchor.constraint(equalToConstant: 22),

      titleLabel.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 8),
      titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
      titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),

      subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 3),
      subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
      subtitleLabel.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -8)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    representedRecordID = nil
    imageView.image = nil
  }

  func configure(record: MapRecord, state: LibraryViewController.AssetState) {
    representedRecordID = record.id
    titleLabel.text = record.title
    subtitleLabel.text = record.shortRegionText
    let isCloudOnly: Bool
    switch state {
    case .cloudOnly:
      isCloudOnly = true
    case .localOriginal, .localThumbnail:
      isCloudOnly = false
    }
    stateBadge.text = isCloudOnly ? " 云端 " : " 本地 "
    let color = isCloudOnly ? UIColor.systemBlue : UIColor.roamlyGreen
    stateBadge.textColor = color
    stateBadge.backgroundColor = color.withAlphaComponent(0.14)
  }

  func apply(image: UIImage?) {
    imageView.image = image
  }
}

private final class CoverageOutlineView: UIView {
  private var points: [CGPoint] = []
  private var isEstimated = false

  func configure(record: MapRecord) {
    points = record.outlinePoints
    isEstimated = !record.hasPreciseCoverageShape
    setNeedsDisplay()
  }

  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }
    let gridColor = UIColor.roamlyHairline.withAlphaComponent(0.42)
    context.setStrokeColor(gridColor.cgColor)
    context.setLineWidth(0.5)
    for i in 1..<4 {
      let x = rect.minX + rect.width * CGFloat(i) / 4
      context.move(to: CGPoint(x: x, y: rect.minY))
      context.addLine(to: CGPoint(x: x, y: rect.maxY))
      let y = rect.minY + rect.height * CGFloat(i) / 4
      context.move(to: CGPoint(x: rect.minX, y: y))
      context.addLine(to: CGPoint(x: rect.maxX, y: y))
    }
    context.strokePath()

    let inset = rect.insetBy(dx: 12, dy: 9)
    guard points.count >= 3 else {
      drawEstimatedBox(in: inset)
      return
    }

    let path = UIBezierPath()
    let mapped = points.map { CGPoint(x: inset.minX + $0.x * inset.width, y: inset.minY + $0.y * inset.height) }
    path.move(to: mapped[0])
    mapped.dropFirst().forEach { path.addLine(to: $0) }
    path.close()

    UIColor.roamlyOlive.withAlphaComponent(isEstimated ? 0.08 : 0.12).setFill()
    UIColor.label.withAlphaComponent(isEstimated ? 0.42 : 0.68).setStroke()
    path.lineWidth = isEstimated ? 1 : 1.2
    if isEstimated {
      path.setLineDash([4, 3], count: 2, phase: 0)
    }
    path.fill()
    path.stroke()
  }

  private func drawEstimatedBox(in rect: CGRect) {
    let path = UIBezierPath(roundedRect: rect, cornerRadius: 3)
    path.lineWidth = 1
    path.setLineDash([4, 3], count: 2, phase: 0)
    UIColor.secondaryLabel.withAlphaComponent(0.45).setStroke()
    path.stroke()
  }
}

private extension UIColor {
  static let roamlyCanvas = UIColor(red: 0.95, green: 0.96, blue: 0.93, alpha: 1)
  static let roamlyOlive = UIColor(red: 0.33, green: 0.38, blue: 0.24, alpha: 1)
  static let roamlyGreen = UIColor(red: 0.20, green: 0.52, blue: 0.15, alpha: 1)
  static let roamlyHairline = UIColor(red: 0.50, green: 0.52, blue: 0.44, alpha: 0.26)
}

private extension MapRecord {
  var needsLibraryWork: Bool {
    String(yearLabel ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
    [countryName, province, city, district].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.allSatisfy(\.isEmpty) ||
    String(ocrText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  var ocrDisplayText: String {
    let text = String(ocrText ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if !text.isEmpty { return "已完成" }
    switch String(ocrStatus ?? "").lowercased() {
    case "complete", "completed": return "已完成"
    case "partial": return "部分识别"
    default: return "待识别"
    }
  }

  var ocrTintColor: UIColor {
    switch ocrDisplayText {
    case "已完成": return UIColor.roamlyGreen
    case "部分识别": return .systemOrange
    default: return .systemRed
    }
  }

  var sourceDisplayText: String {
    let candidates = [collectionUnit, source, fileName]
    return candidates.compactMap { value in
      let trimmed = String(value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? nil : trimmed
    }.first ?? "本地导入"
  }

  var regionTokens: [String] {
    [countryName, province, city, district].compactMap { value in
      let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed?.isEmpty == false ? trimmed : nil
    }
  }

  var shortRegionText: String {
    let region = regionTokens.prefix(2).joined(separator: " · ")
    if !region.isEmpty { return region }
    return yearLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? yearLabel! : sourceDisplayText
  }

  var coverageRangeText: String {
    guard
      let westLongitude,
      let eastLongitude,
      let southLatitude,
      let northLatitude
    else {
      return "待校准"
    }
    return "\(Self.format(westLongitude))-\(Self.format(eastLongitude))E\n\(Self.format(southLatitude))-\(Self.format(northLatitude))N"
  }

  var hasPreciseCoverageShape: Bool {
    if coverageOutline?.count ?? 0 >= 3 {
      return true
    }
    let text = "\(title) \(countryName ?? "") \(province ?? "")".lowercased()
    return text.contains("中国") || text.contains("黑龙江") || text.contains("龙江") || text.contains("江西") || text.contains("菲律宾")
  }

  var outlinePoints: [CGPoint] {
    if let coverageOutline, coverageOutline.count >= 3 {
      return coverageOutline.map { point in
        CGPoint(
          x: min(max(point.x, 0), 1),
          y: min(max(point.y, 0), 1)
        )
      }
    }
    let text = "\(title) \(countryName ?? "") \(province ?? "")"
    if text.contains("菲律宾") {
      return [
        CGPoint(x: 0.42, y: 0.05), CGPoint(x: 0.52, y: 0.15), CGPoint(x: 0.47, y: 0.27),
        CGPoint(x: 0.56, y: 0.38), CGPoint(x: 0.50, y: 0.52), CGPoint(x: 0.62, y: 0.66),
        CGPoint(x: 0.52, y: 0.86), CGPoint(x: 0.36, y: 0.78), CGPoint(x: 0.30, y: 0.61),
        CGPoint(x: 0.38, y: 0.43), CGPoint(x: 0.31, y: 0.25)
      ]
    }
    if text.contains("黑龙江") || text.contains("龙江") {
      return [
        CGPoint(x: 0.22, y: 0.14), CGPoint(x: 0.52, y: 0.06), CGPoint(x: 0.82, y: 0.24),
        CGPoint(x: 0.76, y: 0.48), CGPoint(x: 0.58, y: 0.45), CGPoint(x: 0.49, y: 0.70),
        CGPoint(x: 0.26, y: 0.84), CGPoint(x: 0.13, y: 0.58), CGPoint(x: 0.20, y: 0.36)
      ]
    }
    if text.contains("江西") {
      return [
        CGPoint(x: 0.40, y: 0.06), CGPoint(x: 0.68, y: 0.16), CGPoint(x: 0.84, y: 0.43),
        CGPoint(x: 0.72, y: 0.70), CGPoint(x: 0.52, y: 0.91), CGPoint(x: 0.30, y: 0.80),
        CGPoint(x: 0.18, y: 0.55), CGPoint(x: 0.25, y: 0.28)
      ]
    }
    if text.contains("上海") {
      return [
        CGPoint(x: 0.38, y: 0.16), CGPoint(x: 0.68, y: 0.28), CGPoint(x: 0.58, y: 0.42),
        CGPoint(x: 0.76, y: 0.54), CGPoint(x: 0.55, y: 0.75), CGPoint(x: 0.30, y: 0.62),
        CGPoint(x: 0.22, y: 0.36)
      ]
    }
    if text.contains("中国") {
      return [
        CGPoint(x: 0.10, y: 0.42), CGPoint(x: 0.25, y: 0.18), CGPoint(x: 0.47, y: 0.16),
        CGPoint(x: 0.62, y: 0.28), CGPoint(x: 0.83, y: 0.23), CGPoint(x: 0.93, y: 0.43),
        CGPoint(x: 0.75, y: 0.55), CGPoint(x: 0.65, y: 0.76), CGPoint(x: 0.45, y: 0.82),
        CGPoint(x: 0.28, y: 0.66), CGPoint(x: 0.14, y: 0.62)
      ]
    }
    return [
      CGPoint(x: 0.18, y: 0.22), CGPoint(x: 0.82, y: 0.22), CGPoint(x: 0.82, y: 0.78), CGPoint(x: 0.18, y: 0.78)
    ]
  }

  private static func format(_ value: Double) -> String {
    String(format: "%.1f", value)
  }
}

private final class ImagePreviewViewController: UIViewController {
  private let image: UIImage?
  private let titleText: String

  init(image: UIImage?, title: String) {
    self.image = image
    self.titleText = title
    super.init(nibName: nil, bundle: nil)
    preferredContentSize = CGSize(width: 320, height: 380)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .secondarySystemBackground

    let imageView = UIImageView(image: image)
    let label = UILabel()
    imageView.translatesAutoresizingMaskIntoConstraints = false
    label.translatesAutoresizingMaskIntoConstraints = false

    imageView.contentMode = .scaleAspectFit
    imageView.layer.cornerRadius = 18
    imageView.clipsToBounds = true
    imageView.backgroundColor = .tertiarySystemFill

    label.text = titleText
    label.font = .systemFont(ofSize: 15, weight: .semibold)
    label.textColor = .label
    label.numberOfLines = 2

    view.addSubview(imageView)
    view.addSubview(label)

    NSLayoutConstraint.activate([
      imageView.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
      imageView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      imageView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      imageView.heightAnchor.constraint(equalToConstant: 300),

      label.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 12),
      label.leadingAnchor.constraint(equalTo: imageView.leadingAnchor),
      label.trailingAnchor.constraint(equalTo: imageView.trailingAnchor)
    ])
  }
}
