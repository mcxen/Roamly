import Foundation
#if canImport(UIKit)
import UIKit
#endif

final class LocalLibraryStore {
  private let fileManager = FileManager.default
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  private lazy var rootDirectory: URL = {
    let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
    let root = docs.appendingPathComponent("RoamlyLibrary", isDirectory: true)
    try? fileManager.createDirectory(at: root, withIntermediateDirectories: true)
    return root
  }()

  private lazy var manifestURL: URL = rootDirectory.appendingPathComponent("manifest.json")
  private lazy var filesDirectory: URL = {
    let dir = rootDirectory.appendingPathComponent("files", isDirectory: true)
    try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }()
  private lazy var originalsDirectory: URL = {
    let dir = filesDirectory.appendingPathComponent("originals", isDirectory: true)
    try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }()
  private lazy var thumbnailsDirectory: URL = {
    let dir = filesDirectory.appendingPathComponent("thumbnails", isDirectory: true)
    try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }()

  func loadRecords() -> [MapRecord] {
    guard
      let data = try? Data(contentsOf: manifestURL),
      let records = try? decoder.decode([MapRecord].self, from: data)
    else {
      return []
    }
    return records
  }

  func saveRecords(_ records: [MapRecord]) throws {
    let data = try encoder.encode(records)
    try data.write(to: manifestURL, options: .atomic)
  }

  func upsertSyncedRecords(_ remoteRecords: [MapRecord]) throws -> [MapRecord] {
    let existing = Dictionary(uniqueKeysWithValues: loadRecords().map { ($0.id, $0) })
    let now = ISO8601DateFormatter().string(from: Date())
    let merged = remoteRecords.map { remote in
      if let current = existing[remote.id] {
        return remote.withImportedAt(current.importedAt)
      }
      return remote.withImportedAt(now)
    }
    try saveRecords(merged)
    return merged
  }

  func updateRecord(_ record: MapRecord) throws {
    var records = loadRecords()
    guard let index = records.firstIndex(where: { $0.id == record.id }) else { return }
    records[index] = record
    try saveRecords(records)
  }

  func updateRecords(
    ids: Set<String>,
    transform: (MapRecord) -> MapRecord
  ) throws -> [MapRecord] {
    guard !ids.isEmpty else { return loadRecords() }
    let updated = loadRecords().map { record in
      guard ids.contains(record.id) else { return record }
      return transform(record)
    }
    try saveRecords(updated)
    return updated
  }

  func deleteRecord(_ record: MapRecord) throws {
    var records = loadRecords()
    records.removeAll { $0.id == record.id }
    try saveRecords(records)

    let originalURL = localOriginalURL(for: record)
    let thumbnailURL = localThumbnailURL(for: record)
    if fileManager.fileExists(atPath: originalURL.path) {
      try? fileManager.removeItem(at: originalURL)
    }
    if fileManager.fileExists(atPath: thumbnailURL.path) {
      try? fileManager.removeItem(at: thumbnailURL)
    }
  }

  func localOriginalURL(for record: MapRecord) -> URL {
    let ext = URL(fileURLWithPath: record.fileName).pathExtension
    let suffix = ext.isEmpty ? "img" : ext
    return originalsDirectory.appendingPathComponent("\(record.id).\(suffix)")
  }

  func localThumbnailURL(for record: MapRecord) -> URL {
    thumbnailsDirectory.appendingPathComponent("\(record.id).jpg")
  }

  func localFileURL(for record: MapRecord) -> URL {
    localOriginalURL(for: record)
  }

  func hasLocalOriginal(for record: MapRecord) -> Bool {
    fileManager.fileExists(atPath: localOriginalURL(for: record).path)
  }

  func hasLocalThumbnail(for record: MapRecord) -> Bool {
    fileManager.fileExists(atPath: localThumbnailURL(for: record).path)
  }

  func hasLocalFile(for record: MapRecord) -> Bool {
    hasLocalOriginal(for: record)
  }

  func saveOriginalData(_ data: Data, for record: MapRecord) throws {
    try data.write(to: localOriginalURL(for: record), options: .atomic)
  }

  func saveThumbnailData(_ data: Data, for record: MapRecord) throws {
    try data.write(to: localThumbnailURL(for: record), options: .atomic)
  }

  func removeLocalOriginal(for record: MapRecord) {
    let url = localOriginalURL(for: record)
    guard fileManager.fileExists(atPath: url.path) else { return }
    try? fileManager.removeItem(at: url)
  }

  @discardableResult
  func importLocalImages(fileURLs: [URL]) throws -> [MapRecord] {
    guard !fileURLs.isEmpty else { return [] }

    var existing = loadRecords()
    var imported: [MapRecord] = []

    for fileURL in fileURLs {
      let data = try Data(contentsOf: fileURL)
      let mime = Self.mimeType(for: fileURL.pathExtension)
      let record = MapRecord.makeImportedLocalRecord(
        fileName: fileURL.lastPathComponent,
        sizeBytes: data.count,
        mime: mime
      )
      try saveOriginalData(data, for: record)
      if let thumbnailData = Self.makeThumbnailData(from: data) {
        try saveThumbnailData(thumbnailData, for: record)
      }
      imported.append(record)
    }

    existing = imported + existing
    try saveRecords(existing)
    return imported
  }

  func removeStaleFiles(keeping records: [MapRecord]) {
    let keepOriginals = Set(records.map { localOriginalURL(for: $0).lastPathComponent })
    let keepThumbnails = Set(records.map { localThumbnailURL(for: $0).lastPathComponent })
    removeStaleFiles(in: originalsDirectory, keeping: keepOriginals)
    removeStaleFiles(in: thumbnailsDirectory, keeping: keepThumbnails)
  }

  private func removeStaleFiles(in directory: URL, keeping fileNames: Set<String>) {
    let urls = (try? fileManager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
    for url in urls where !fileNames.contains(url.lastPathComponent) {
      try? fileManager.removeItem(at: url)
    }
  }

  private static func mimeType(for fileExtension: String) -> String {
    switch fileExtension.lowercased() {
    case "jpg", "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "heic":
      return "image/heic"
    case "gif":
      return "image/gif"
    case "webp":
      return "image/webp"
    default:
      return "application/octet-stream"
    }
  }

  private static func makeThumbnailData(from data: Data) -> Data? {
    #if canImport(UIKit)
      guard let image = UIImage(data: data) else { return nil }
      let maxSide: CGFloat = 720
      let scale = min(maxSide / max(image.size.width, 1), maxSide / max(image.size.height, 1), 1)
      let targetSize = CGSize(width: max(image.size.width * scale, 1), height: max(image.size.height * scale, 1))
      let renderer = UIGraphicsImageRenderer(size: targetSize)
      let rendered = renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: targetSize))
      }
      return rendered.jpegData(compressionQuality: 0.82)
    #else
      return nil
    #endif
  }
}
