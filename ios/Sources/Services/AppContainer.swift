import Foundation

final class AppContainer {
  static let shared = AppContainer()

  let settings = AppSettings()
  let store = LocalLibraryStore()
  let regionCatalog = RegionCatalog()
  let haptics = Haptics.shared
  lazy var apiClient = APIClient(settings: settings)
  lazy var syncService = SyncService(apiClient: apiClient, store: store)
  lazy var ocrIndexService = OCRIndexService(store: store, regionCatalog: regionCatalog)
  lazy var aiMetadataService = AIMetadataService(settings: settings, store: store)

  private init() {}
}
