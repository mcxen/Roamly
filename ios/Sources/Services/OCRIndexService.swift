import UIKit
@preconcurrency
import Vision

final class OCRIndexService {
  struct IndexedResult {
    let updatedRecords: [MapRecord]
    let processedCount: Int
  }

  private let store: LocalLibraryStore
  private let regionCatalog: RegionCatalog

  init(store: LocalLibraryStore, regionCatalog: RegionCatalog) {
    self.store = store
    self.regionCatalog = regionCatalog
  }

  func indexRecordsNeedingOCR(
    progress: @escaping (String) -> Void = { _ in }
  ) async throws -> IndexedResult {
    try await indexRecords(ids: nil, progress: progress)
  }

  func indexRecords(
    ids: Set<String>?,
    progress: @escaping (String) -> Void = { _ in }
  ) async throws -> IndexedResult {
    let records = store.loadRecords()
    let targets = records.filter { record in
      let inScope = ids?.contains(record.id) ?? true
      return inScope && needsOCR(for: record)
    }
    guard !targets.isEmpty else {
      return IndexedResult(updatedRecords: records, processedCount: 0)
    }

    progress("正在建立本地 OCR 索引…")

    var updatedRecords = records
    var processedCount = 0

    for (index, record) in targets.enumerated() {
      progress("正在识别 \(index + 1)/\(targets.count)：\(record.title)")
      guard let image = loadImage(for: record) else { continue }

      let text = try await recognizeText(in: image)
      let excerpt = Self.makeExcerpt(from: text)
      let detected = regionCatalog.detectedRegion(fromRecognizedText: text)

      let updated = record.withOCRContent(
        text: text,
        excerpt: excerpt,
        status: text.isEmpty ? "empty" : "complete",
        countryName: detected?.countryName,
        province: detected?.province,
        city: detected?.city,
        district: detected?.district
      )

      try store.updateRecord(updated)
      if let idx = updatedRecords.firstIndex(where: { $0.id == updated.id }) {
        updatedRecords[idx] = updated
      }
      processedCount += 1
    }

    progress("OCR 索引完成，已更新 \(processedCount) 张地图")
    return IndexedResult(updatedRecords: updatedRecords, processedCount: processedCount)
  }

  private func needsOCR(for record: MapRecord) -> Bool {
    if let text = record.ocrText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return false
    }
    return store.hasLocalThumbnail(for: record) || store.hasLocalOriginal(for: record)
  }

  private func loadImage(for record: MapRecord) -> UIImage? {
    let candidateURLs = [
      store.localThumbnailURL(for: record),
      store.localOriginalURL(for: record)
    ]

    for url in candidateURLs where FileManager.default.fileExists(atPath: url.path) {
      if let image = UIImage(contentsOfFile: url.path) {
        return image
      }
    }
    return nil
  }

  private func recognizeText(in image: UIImage) async throws -> String {
    guard let cgImage = image.cgImage else { return "" }

    return try await withCheckedThrowingContinuation { continuation in
      let request = VNRecognizeTextRequest { request, error in
        if let error {
          continuation.resume(throwing: error)
          return
        }

        let text = (request.results as? [VNRecognizedTextObservation] ?? [])
          .compactMap { $0.topCandidates(1).first?.string }
          .joined(separator: "\n")
          .trimmingCharacters(in: .whitespacesAndNewlines)
        continuation.resume(returning: text)
      }
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      request.recognitionLanguages = ["zh-Hans", "en-US"]

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private static func makeExcerpt(from text: String) -> String {
    let normalized = text
      .replacingOccurrences(of: "\n", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalized.isEmpty else { return "" }
    return String(normalized.prefix(120))
  }
}
