import PhotosUI
import UIKit
import UniformTypeIdentifiers

final class BackupViewController: UIViewController, PHPickerViewControllerDelegate {
  private let container: AppContainer

  private let scrollView = UIScrollView()
  private let contentStack = UIStackView()
  private let summaryCard = UIView()
  private let syncCard = UIView()
  private let statsTopRow = UIStackView()
  private let statsBottomRow = UIStackView()
  private let summaryLabel = UILabel()
  private let statusLabel = UILabel()
  private let syncButton = UIButton(type: .system)
  private let backupButton = UIButton(type: .system)

  init(container: AppContainer) {
    self.container = container
    super.init(nibName: nil, bundle: nil)
    title = "备份"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    configureLayout()
    refreshSummary()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    refreshSummary()
  }

  private func configureLayout() {
    [scrollView, contentStack, summaryCard, syncCard, statsTopRow, statsBottomRow, summaryLabel, statusLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
    }

    view.addSubview(scrollView)
    scrollView.addSubview(contentStack)

    contentStack.axis = .vertical
    contentStack.spacing = 16

    [summaryCard, syncCard].forEach(configureCard)
    [statsTopRow, statsBottomRow].forEach {
      $0.axis = .horizontal
      $0.spacing = 10
      $0.distribution = .fillEqually
    }

    summaryLabel.font = .systemFont(ofSize: 14, weight: .medium)
    summaryLabel.textColor = .secondaryLabel
    summaryLabel.numberOfLines = 0

    statusLabel.font = .systemFont(ofSize: 14, weight: .medium)
    statusLabel.textColor = .secondaryLabel
    statusLabel.numberOfLines = 0

    configureButton(syncButton, title: "同步服务端地图", action: #selector(startSync))
    configureButton(backupButton, title: "选择图片备份到服务器", action: #selector(pickPhotos))

    let summaryStack = makeSectionStack(title: "库存统计")
    [summaryLabel, statsTopRow, statsBottomRow].forEach { summaryStack.addArrangedSubview($0) }
    summaryCard.addSubview(summaryStack)

    let syncStack = makeSectionStack(title: "备份与同步")
    [statusLabel, syncButton, backupButton].forEach { syncStack.addArrangedSubview($0) }
    syncCard.addSubview(syncStack)

    [summaryCard, syncCard].forEach { contentStack.addArrangedSubview($0) }

    NSLayoutConstraint.activate([
      scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

      contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 18),
      contentStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      contentStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
      contentStack.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -32),

      summaryStack.topAnchor.constraint(equalTo: summaryCard.layoutMarginsGuide.topAnchor),
      summaryStack.leadingAnchor.constraint(equalTo: summaryCard.layoutMarginsGuide.leadingAnchor),
      summaryStack.trailingAnchor.constraint(equalTo: summaryCard.layoutMarginsGuide.trailingAnchor),
      summaryStack.bottomAnchor.constraint(equalTo: summaryCard.layoutMarginsGuide.bottomAnchor),

      syncStack.topAnchor.constraint(equalTo: syncCard.layoutMarginsGuide.topAnchor),
      syncStack.leadingAnchor.constraint(equalTo: syncCard.layoutMarginsGuide.leadingAnchor),
      syncStack.trailingAnchor.constraint(equalTo: syncCard.layoutMarginsGuide.trailingAnchor),
      syncStack.bottomAnchor.constraint(equalTo: syncCard.layoutMarginsGuide.bottomAnchor)
    ])
  }

  private func configureCard(_ view: UIView) {
    view.backgroundColor = .secondarySystemGroupedBackground
    view.layer.cornerRadius = 22
    view.layer.cornerCurve = .continuous
    view.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 18, leading: 16, bottom: 18, trailing: 16)
  }

  private func makeSectionStack(title: String) -> UIStackView {
    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 14

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
    titleLabel.textColor = .label
    titleLabel.text = title
    stack.addArrangedSubview(titleLabel)
    return stack
  }

  private func configureButton(_ button: UIButton, title: String, action: Selector) {
    var config = UIButton.Configuration.filled()
    config.cornerStyle = .large
    config.title = title
    button.configuration = config
    button.addTarget(self, action: action, for: .touchUpInside)
  }

  private func refreshSummary() {
    let records = container.store.loadRecords()
    let total = records.count
    let localOriginal = records.filter { container.store.hasLocalOriginal(for: $0) }.count
    let thumbnailOnly = records.filter {
      !container.store.hasLocalOriginal(for: $0) && container.store.hasLocalThumbnail(for: $0)
    }.count
    let cloudOnly = max(total - localOriginal - thumbnailOnly, 0)
    let pendingOCR = records.filter { String($0.ocrText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.count
    let pendingAI = records.filter(container.aiMetadataService.needsAI).count

    let serverState = container.settings.serverBaseURL == nil ? "未配置服务端" : "已配置服务端"
    summaryLabel.text = "这里负责库存统计、同步和备份。整理任务已移动到整理页。当前服务端状态：\(serverState)。"
    statusLabel.text = "服务端用于同步备份、导入和 OCR 搜索。主图库与整理流程优先使用本地缓存。"

    renderStats(top: [
      ("总地图", "\(total)"),
      ("原图本地", "\(localOriginal)"),
      ("缩略图", "\(thumbnailOnly)")
    ], bottom: [
      ("仅云端", "\(cloudOnly)"),
      ("待OCR", "\(pendingOCR)"),
      ("待AI", "\(pendingAI)")
    ])
  }

  private func renderStats(top: [(String, String)], bottom: [(String, String)]) {
    [statsTopRow, statsBottomRow].forEach { row in
      row.arrangedSubviews.forEach {
        row.removeArrangedSubview($0)
        $0.removeFromSuperview()
      }
    }

    top.forEach { statsTopRow.addArrangedSubview(BackupStatCard(title: $0.0, value: $0.1)) }
    bottom.forEach { statsBottomRow.addArrangedSubview(BackupStatCard(title: $0.0, value: $0.1)) }
  }

  @objc private func startSync() {
    container.haptics.mediumTap()
    Task { [weak self] in
      guard let self else { return }
      do {
        self.statusLabel.text = "同步中…"
        let records = try await self.container.syncService.syncAll { message in
          Task { @MainActor in
            self.statusLabel.text = message
          }
        }
        self.container.haptics.success()
        self.statusLabel.text = "同步完成，共 \(records.count) 张地图。"
        self.refreshSummary()
      } catch {
        self.container.haptics.error()
        self.statusLabel.text = "同步失败：\(error.localizedDescription)"
      }
    }
  }

  @objc private func pickPhotos() {
    container.haptics.selectionChanged()
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
        try await self.container.apiClient.uploadImages(fileURLs: fileURLs)
        self.container.haptics.success()
        self.statusLabel.text = "上传完成，共 \(fileURLs.count) 张图片。"
        self.refreshSummary()
      } catch {
        self.container.haptics.error()
        self.statusLabel.text = "上传失败：\(error.localizedDescription)"
      }
    }
  }

  private func loadImageFiles(results: [PHPickerResult]) async throws -> [URL] {
    try await withThrowingTaskGroup(of: URL.self) { group in
      for result in results {
        group.addTask {
          try await self.copyPickedFile(result: result)
        }
      }
      var urls: [URL] = []
      for try await url in group {
        urls.append(url)
      }
      return urls
    }
  }

  private func copyPickedFile(result: PHPickerResult) async throws -> URL {
    let provider = result.itemProvider
    let identifier = UTType.image.identifier
    return try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: identifier) { url, error in
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
}

private final class BackupStatCard: UIView {
  init(title: String, value: String) {
    super.init(frame: .zero)
    translatesAutoresizingMaskIntoConstraints = false
    backgroundColor = .tertiarySystemGroupedBackground
    layer.cornerRadius = 18
    layer.cornerCurve = .continuous

    let titleLabel = UILabel()
    let valueLabel = UILabel()
    [titleLabel, valueLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }

    titleLabel.font = .systemFont(ofSize: 11, weight: .semibold)
    titleLabel.textColor = .secondaryLabel
    titleLabel.text = title

    valueLabel.font = .systemFont(ofSize: 24, weight: .bold)
    valueLabel.textColor = .label
    valueLabel.text = value

    NSLayoutConstraint.activate([
      heightAnchor.constraint(equalToConstant: 78),
      titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
      titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
      valueLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      valueLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
      valueLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}
