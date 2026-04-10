import Foundation

final class SyncService {
  private let apiClient: APIClient
  private let store: LocalLibraryStore

  init(apiClient: APIClient, store: LocalLibraryStore) {
    self.apiClient = apiClient
    self.store = store
  }

  func syncAll(progress: @escaping (String) -> Void) async throws -> [MapRecord] {
    progress("正在获取服务端清单…")
    let manifest = try await apiClient.fetchManifest()
    let current = Dictionary(uniqueKeysWithValues: store.loadRecords().map { ($0.id, $0) })

    for (index, item) in manifest.items.enumerated() {
      let old = current[item.id]
      let needsThumbnail = old?.updatedAt != item.updatedAt || !store.hasLocalThumbnail(for: item)
      if needsThumbnail {
        progress("正在同步缩略图 \(index + 1)/\(manifest.items.count)：\(item.title)")
        let data = try await apiClient.downloadThumbnail(for: item)
        try store.saveThumbnailData(data, for: item)
      }

      let keepsOriginal = store.hasLocalOriginal(for: item)
      if keepsOriginal && old?.updatedAt != item.updatedAt {
        progress("正在更新原图 \(index + 1)/\(manifest.items.count)：\(item.title)")
        let data = try await apiClient.downloadOriginal(for: item)
        try store.saveOriginalData(data, for: item)
      }
    }

    store.removeStaleFiles(keeping: manifest.items)
    let merged = try store.upsertSyncedRecords(manifest.items)
    progress("同步完成，共 \(merged.count) 张地图")
    return merged
  }
}
