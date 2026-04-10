import PhotosUI
import UIKit
import UniformTypeIdentifiers
import ImageIO

final class LibraryViewController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegate, UISearchResultsUpdating, PHPickerViewControllerDelegate, UICollectionViewDelegateFlowLayout, UICollectionViewDataSourcePrefetching {
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

  private let collectionView: UICollectionView
  private let imageCache = NSCache<NSString, UIImage>()
  private let searchController = UISearchController(searchResultsController: nil)
  private let emptyLabel = UILabel()
  private var pendingRestoreOffset: CGPoint?
  private var pendingRestoreRecordID: String?
  private var imageLoadTasks: [String: Task<UIImage?, Never>] = [:]
  private var lastResolvedLayoutWidth: CGFloat = 0

  init(container: AppContainer) {
    self.container = container
    let layout = UICollectionViewFlowLayout()
    layout.minimumInteritemSpacing = 14
    layout.minimumLineSpacing = 14
    layout.sectionInset = UIEdgeInsets(top: 16, left: 20, bottom: 120, right: 20)
    self.collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    super.init(nibName: nil, bundle: nil)
    title = "地图"
    tabBarItem.title = "地图"
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
    navigationItem.largeTitleDisplayMode = .automatic
    navigationItem.rightBarButtonItem = UIBarButtonItem(title: "导入", style: .plain, target: self, action: #selector(importImages))
    configureSearch()
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

  private func configureSearch() {
    searchController.obscuresBackgroundDuringPresentation = false
    searchController.searchResultsUpdater = self
    searchController.searchBar.placeholder = "搜索 OCR、标题、地区、专题"
    navigationItem.searchController = searchController
    navigationItem.hidesSearchBarWhenScrolling = false
    definesPresentationContext = true
  }

  private func configureCollectionView() {
    collectionView.translatesAutoresizingMaskIntoConstraints = false
    collectionView.backgroundColor = .clear
    collectionView.alwaysBounceVertical = true
    collectionView.contentInsetAdjustmentBehavior = .always
    collectionView.dataSource = self
    collectionView.delegate = self
    collectionView.prefetchDataSource = self
    collectionView.register(MapGridCell.self, forCellWithReuseIdentifier: "MapGridCell")
    view.addSubview(collectionView)

    NSLayoutConstraint.activate([
      collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
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
  }

  private func applySearch() {
    let query = String(searchController.searchBar.text ?? "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()

    if query.isEmpty {
      visibleRecords = allRecords
    } else {
      visibleRecords = allRecords.filter { $0.searchableText.contains(query) }
    }

    collectionView.reloadData()
    emptyLabel.isHidden = !visibleRecords.isEmpty
    restoreScrollPositionIfNeeded()
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
    let candidateURLs = [
      container.store.localThumbnailURL(for: record),
      container.store.localOriginalURL(for: record)
    ]

    return candidateURLs.first { FileManager.default.fileExists(atPath: $0.path) }
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
    let targetSize = CGSize(width: size.width, height: size.imageHeight)
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
    var configuration = PHPickerConfiguration(photoLibrary: .shared())
    configuration.selectionLimit = 0
    configuration.filter = .images
    let picker = PHPickerViewController(configuration: configuration)
    picker.delegate = self
    present(picker, animated: true)
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

  func updateSearchResults(for searchController: UISearchController) {
    applySearch()
  }

  func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
    visibleRecords.count
  }

  func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
    guard let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "MapGridCell", for: indexPath) as? MapGridCell else {
      return UICollectionViewCell()
    }
    let record = visibleRecords[indexPath.item]
    let size = resolvedGridLayout(for: collectionView.bounds.width)
    cell.configure(
      record: record,
      state: assetState(for: record),
      subtitle: record.subtitleText,
      imageHeight: size.imageHeight,
      showTitle: false
    )
    cell.apply(image: previewImage(for: record, targetSize: CGSize(width: size.width, height: size.imageHeight)))
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
    let columns: CGFloat

    let isPad = traitCollection.userInterfaceIdiom == .pad
    switch (container.settings.thumbnailSize, isPad) {
    case (.compact, true):
      columns = availableWidth > 1100 ? 6 : 5
    case (.standard, true):
      columns = availableWidth > 1100 ? 4 : 3
    case (.large, true):
      columns = 2
    case (.compact, false):
      columns = 3
    case (.standard, false):
      columns = 2
    case (.large, false):
      columns = 1
    }

    let layout = collectionView.collectionViewLayout as? UICollectionViewFlowLayout
    let spacing = layout?.minimumInteritemSpacing ?? 10
    let sectionInset = layout?.sectionInset ?? .zero
    let contentWidth = availableWidth - sectionInset.left - sectionInset.right - spacing * (columns - 1)
    let itemWidth = floor(contentWidth / columns)
    let imageHeight = container.settings.thumbnailSize == .large ? floor(itemWidth * 0.7) : floor(itemWidth * 0.86)
    let metadataHeight: CGFloat = container.settings.showTitlesOnLibrary ? 78 : 54
    return (itemWidth, imageHeight, imageHeight + metadataHeight)
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

      let delete = UIAction(title: "删除", image: UIImage(systemName: "trash"), attributes: .destructive) { _ in
        self.container.haptics.warning()
        self.confirmDelete(record: record)
      }

      return UIMenu(title: "", children: [edit, delete])
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
    let alert = UIAlertController(title: "删除地图", message: "将删除这张地图的本地记录、缩略图和原图。", preferredStyle: .actionSheet)
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
}

private final class MapGridCell: UICollectionViewCell {
  private let imageView = UIImageView()
  private let imageContainerView = UIView()
  private let metadataStack = UIStackView()
  private let titleLabel = UILabel()
  private let subtitleLabel = UILabel()
  private let statusLabel = UILabel()
  private var imageHeightConstraint: NSLayoutConstraint?
  fileprivate private(set) var representedRecordID: String?

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentView.backgroundColor = .secondarySystemGroupedBackground
    contentView.layer.cornerRadius = 22
    contentView.layer.cornerCurve = .continuous
    contentView.layer.masksToBounds = true

    contentView.layer.borderWidth = 1
    contentView.layer.borderColor = UIColor.separator.withAlphaComponent(0.18).cgColor

    [imageContainerView, metadataStack, statusLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      contentView.addSubview($0)
    }

    imageContainerView.layer.cornerRadius = 18
    imageContainerView.layer.cornerCurve = .continuous
    imageContainerView.layer.masksToBounds = true
    imageContainerView.backgroundColor = .tertiarySystemFill
    imageHeightConstraint = imageContainerView.heightAnchor.constraint(equalToConstant: 180)
    imageHeightConstraint?.isActive = true

    imageView.translatesAutoresizingMaskIntoConstraints = false
    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true
    imageView.backgroundColor = .secondarySystemFill
    imageContainerView.addSubview(imageView)

    metadataStack.axis = .vertical
    metadataStack.spacing = 4

    titleLabel.font = .systemFont(ofSize: 15, weight: .semibold)
    titleLabel.textColor = .label
    titleLabel.numberOfLines = 2

    subtitleLabel.font = .systemFont(ofSize: 12, weight: .medium)
    subtitleLabel.textColor = .secondaryLabel
    subtitleLabel.numberOfLines = 2

    metadataStack.addArrangedSubview(titleLabel)
    metadataStack.addArrangedSubview(subtitleLabel)

    statusLabel.font = .systemFont(ofSize: 11, weight: .semibold)
    statusLabel.textAlignment = .center
    statusLabel.layer.cornerRadius = 11
    statusLabel.layer.cornerCurve = .continuous
    statusLabel.layer.masksToBounds = true

    NSLayoutConstraint.activate([
      imageContainerView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
      imageContainerView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
      imageContainerView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),

      imageView.topAnchor.constraint(equalTo: imageContainerView.topAnchor),
      imageView.leadingAnchor.constraint(equalTo: imageContainerView.leadingAnchor),
      imageView.trailingAnchor.constraint(equalTo: imageContainerView.trailingAnchor),
      imageView.bottomAnchor.constraint(equalTo: imageContainerView.bottomAnchor),

      statusLabel.topAnchor.constraint(equalTo: imageContainerView.topAnchor, constant: 10),
      statusLabel.trailingAnchor.constraint(equalTo: imageContainerView.trailingAnchor, constant: -10),
      statusLabel.heightAnchor.constraint(equalToConstant: 22),
      statusLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 52),

      metadataStack.topAnchor.constraint(equalTo: imageContainerView.bottomAnchor, constant: 12),
      metadataStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
      metadataStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
      metadataStack.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -12),
      contentView.bottomAnchor.constraint(greaterThanOrEqualTo: metadataStack.bottomAnchor, constant: 12)
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

  func configure(record: MapRecord, state: LibraryViewController.AssetState, subtitle: String, imageHeight: CGFloat, showTitle: Bool) {
    representedRecordID = record.id
    imageHeightConstraint?.constant = imageHeight
    titleLabel.text = showTitle ? record.title : nil
    titleLabel.isHidden = !showTitle
    subtitleLabel.text = subtitle
    subtitleLabel.numberOfLines = showTitle ? 2 : 3
    statusLabel.text = " \(state.title) "
    statusLabel.backgroundColor = state.tintColor.withAlphaComponent(0.14)
    statusLabel.textColor = state.tintColor
  }

  func apply(image: UIImage?) {
    imageView.image = image
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
