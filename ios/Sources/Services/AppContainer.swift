import Foundation

final class AppContainer {
  static let shared = AppContainer()

  let settings = AppSettings()
  let store = LocalLibraryStore()
  let regionCatalog = RegionCatalog()
  let haptics = Haptics.shared
  let aiTaskLogStore = AITaskLogStore()
  let aiProgressCenter = AIProgressCenter()
  lazy var apiClient = APIClient(settings: settings)
  lazy var syncService = SyncService(apiClient: apiClient, store: store)
  lazy var ocrIndexService = OCRIndexService(store: store, regionCatalog: regionCatalog)
  lazy var aiMetadataService = AIMetadataService(settings: settings, store: store, logStore: aiTaskLogStore)

  private init() {}
}

final class AIProgressCenter {
  private(set) var isRunning = false
  private(set) var title = ""
  private(set) var message = ""
  private(set) var progress: Double = 0
  private(set) var detailLines: [String] = []
  private var totalUnits = 1

  func start(title: String, totalUnits: Int) {
    self.isRunning = true
    self.title = title
    self.message = "准备中..."
    self.progress = 0.02
    self.detailLines = []
    self.totalUnits = max(totalUnits, 1)
    notify()
  }

  func update(message: String, completedUnits: Int? = nil) {
    self.message = message
    if let completedUnits {
      progress = min(max(Double(completedUnits) / Double(totalUnits), 0.02), 0.98)
    } else {
      progress = min(progress + 0.02, 0.98)
    }
    detailLines.append(message)
    if detailLines.count > 80 {
      detailLines.removeFirst(detailLines.count - 80)
    }
    notify()
  }

  func finish(message: String) {
    self.isRunning = false
    self.message = message
    self.progress = 1
    detailLines.append(message)
    notify()
  }

  func fail(message: String) {
    self.isRunning = false
    self.message = message
    self.progress = 0
    detailLines.append(message)
    notify()
  }

  private func notify() {
    NotificationCenter.default.post(name: .aiProgressCenterDidChange, object: self)
  }
}

extension Notification.Name {
  static let aiProgressCenterDidChange = Notification.Name("roamly.mobile.aiProgressCenterDidChange")
}
