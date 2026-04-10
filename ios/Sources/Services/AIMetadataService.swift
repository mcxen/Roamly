import Foundation
#if canImport(UIKit)
import UIKit
#endif

final class AIMetadataService {
  struct IndexedResult {
    let updatedRecords: [MapRecord]
    let processedCount: Int
  }

  struct AIResponse: Decodable {
    let title: String?
    let description: String?
    let yearLabel: String?
    let campaign: String?
    let teachingUse: String?
    let teachingNote: String?
    let securityLevel: String?
    let countryName: String?
    let province: String?
    let city: String?
    let district: String?
    let tags: [String]?

    enum CodingKeys: String, CodingKey {
      case title
      case description
      case yearLabel = "year_label"
      case campaign
      case teachingUse = "teaching_use"
      case teachingNote = "teaching_note"
      case securityLevel = "security_level"
      case countryName = "country_name"
      case province
      case city
      case district
      case tags
    }
  }

  private let settings: AppSettings
  private let store: LocalLibraryStore
  private let session: URLSession

  init(settings: AppSettings, store: LocalLibraryStore, session: URLSession = .shared) {
    self.settings = settings
    self.store = store
    self.session = session
  }

  func organizeRecords(
    ids: Set<String>?,
    progress: @escaping (String) -> Void = { _ in }
  ) async throws -> IndexedResult {
    guard let endpoint = makeEndpoint() else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI API URL。")
    }
    guard !settings.aiModel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI 模型名称。")
    }

    let records = store.loadRecords()
    let targets = records.filter { record in
      let inScope = ids?.contains(record.id) ?? true
      return inScope && needsAI(for: record)
    }
    guard !targets.isEmpty else {
      return IndexedResult(updatedRecords: records, processedCount: 0)
    }

    progress("正在建立 AI 编目任务…")

    var updatedRecords = records
    var processedCount = 0

    for (index, record) in targets.enumerated() {
      progress("AI 整理 \(index + 1)/\(targets.count)：\(record.title)")
      let result = try await requestMetadata(for: record, endpoint: endpoint)
      let updated = merge(record: record, with: result)
      try store.updateRecord(updated)
      if let recordIndex = updatedRecords.firstIndex(where: { $0.id == updated.id }) {
        updatedRecords[recordIndex] = updated
      }
      processedCount += 1
    }

    progress("AI 编目完成，已更新 \(processedCount) 张地图")
    return IndexedResult(updatedRecords: updatedRecords, processedCount: processedCount)
  }

  func measureLatency() async throws -> TimeInterval {
    guard let endpoint = makeEndpoint() else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI API URL。")
    }
    guard !settings.aiModel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI 模型名称。")
    }

    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if !settings.aiAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      request.setValue("Bearer \(settings.aiAPIKey)", forHTTPHeaderField: "Authorization")
    }

    let body: [String: Any] = [
      "model": settings.aiModel,
      "response_format": ["type": "json_object"],
      "messages": [
        ["role": "system", "content": "你只能返回 JSON。"],
        ["role": "user", "content": "返回 {\"ok\":true}"]
      ]
    ]
    request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])

    let start = Date()
    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIClient.APIError.invalidResponse
    }
    guard (200 ..< 300).contains(httpResponse.statusCode) else {
      let text = String(data: data, encoding: .utf8) ?? "AI request failed"
      throw APIClient.APIError.requestFailed(text)
    }
    return Date().timeIntervalSince(start)
  }

  func needsAI(for record: MapRecord) -> Bool {
    let hasOCR = !(record.ocrText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    guard hasOCR else { return false }
    return [
      record.yearLabel,
      record.countryName,
      record.province,
      record.city,
      record.campaign,
      record.teachingUse
    ]
    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
    .filter { !$0.isEmpty }
    .count < 4
  }

  private func makeEndpoint() -> URL? {
    guard let rawURL = settings.aiAPIURL else { return nil }
    let path = rawURL.path.lowercased()
    if path.hasSuffix("/chat/completions") {
      return rawURL
    }
    return rawURL.appendingPathComponent("chat").appendingPathComponent("completions")
  }

  private func requestMetadata(for record: MapRecord, endpoint: URL) async throws -> AIResponse {
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if !settings.aiAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      request.setValue("Bearer \(settings.aiAPIKey)", forHTTPHeaderField: "Authorization")
    }

    let userPrompt = makeUserPrompt(for: record)
    let userContent = makeUserContent(for: record, prompt: userPrompt)
    let body: [String: Any] = [
      "model": settings.aiModel,
      "response_format": ["type": "json_object"],
      "messages": [
        ["role": "system", "content": settings.aiSystemPrompt],
        ["role": "user", "content": userContent]
      ]
    ]
    request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIClient.APIError.invalidResponse
    }
    guard (200 ..< 300).contains(httpResponse.statusCode) else {
      let text = String(data: data, encoding: .utf8) ?? "AI request failed"
      throw APIClient.APIError.requestFailed(text)
    }

    let content = try extractContent(from: data)
    let jsonData = try normalizeJSONPayload(content)
    return try JSONDecoder().decode(AIResponse.self, from: jsonData)
  }

  private func extractContent(from data: Data) throws -> String {
    guard
      let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      let choices = root["choices"] as? [[String: Any]],
      let first = choices.first,
      let message = first["message"] as? [String: Any],
      let content = message["content"]
    else {
      throw APIClient.APIError.invalidResponse
    }

    if let text = content as? String {
      return text
    }

    if let parts = content as? [[String: Any]] {
      let text = parts.compactMap { $0["text"] as? String }.joined()
      if !text.isEmpty {
        return text
      }
    }

    throw APIClient.APIError.invalidResponse
  }

  private func normalizeJSONPayload(_ content: String) throws -> Data {
    let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
    let stripped: String
    if trimmed.hasPrefix("```") {
      stripped = trimmed
        .replacingOccurrences(of: "```json", with: "")
        .replacingOccurrences(of: "```", with: "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
    } else {
      stripped = trimmed
    }

    guard let data = stripped.data(using: .utf8) else {
      throw APIClient.APIError.invalidResponse
    }
    return data
  }

  private func makeUserPrompt(for record: MapRecord) -> String {
    """
    请整理这张历史地图的元数据。

    文件名：\(record.fileName)
    当前标题：\(record.title)
    当前描述：\(record.description)
    当前地区：\(record.countryName ?? "") \(record.province ?? "") \(record.city ?? "") \(record.district ?? "")
    当前年代：\(record.yearLabel ?? "")
    当前专题：\(record.campaign ?? "")
    当前教学用途：\(record.teachingUse ?? "")
    当前授课备注：\(record.teachingNote ?? "")
    当前密级：\(record.securityLevel ?? "")
    当前标签：\(record.tags.joined(separator: ", "))

    OCR 文本：
    \(record.ocrText ?? record.ocrExcerpt)
    """
  }

  private func makeUserContent(for record: MapRecord, prompt: String) -> [[String: Any]] {
    var content: [[String: Any]] = [
      [
        "type": "text",
        "text": prompt
      ]
    ]

    if let imageURL = makeCompressedImageDataURL(for: record) {
      content.append([
        "type": "image_url",
        "image_url": [
          "url": imageURL
        ]
      ])
    }

    return content
  }

  private func makeCompressedImageDataURL(for record: MapRecord) -> String? {
    #if canImport(UIKit)
      let candidateURLs = [
        store.localThumbnailURL(for: record),
        store.localOriginalURL(for: record)
      ]

      for url in candidateURLs where FileManager.default.fileExists(atPath: url.path) {
        guard let image = UIImage(contentsOfFile: url.path) else { continue }
        guard let data = compressedJPEGData(from: image) else { continue }
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
      }
    #endif
    return nil
  }

  #if canImport(UIKit)
    private func compressedJPEGData(from image: UIImage) -> Data? {
      let longestSide = max(image.size.width, image.size.height)
      let maxDimension: CGFloat = 1280
      let scale = min(maxDimension / max(longestSide, 1), 1)
      let targetSize = CGSize(
        width: max(image.size.width * scale, 1),
        height: max(image.size.height * scale, 1)
      )

      let renderer = UIGraphicsImageRenderer(size: targetSize)
      let rendered = renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: targetSize))
      }

      let qualities: [CGFloat] = [0.72, 0.58, 0.45]
      let maxBytes = 900_000
      for quality in qualities {
        if let data = rendered.jpegData(compressionQuality: quality), data.count <= maxBytes {
          return data
        }
      }

      return rendered.jpegData(compressionQuality: 0.35)
    }
  #endif

  private func merge(record: MapRecord, with response: AIResponse) -> MapRecord {
    let tags = (response.tags ?? record.tags)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    func resolved(_ incoming: String?, fallback: String?) -> String {
      let normalized = String(incoming ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      if !normalized.isEmpty { return normalized }
      return fallback ?? ""
    }

    return record.withEditableMetadata(
      title: resolved(response.title, fallback: record.title),
      description: resolved(response.description, fallback: record.description),
      yearLabel: resolved(response.yearLabel, fallback: record.yearLabel),
      campaign: resolved(response.campaign, fallback: record.campaign),
      teachingUse: resolved(response.teachingUse, fallback: record.teachingUse),
      teachingNote: resolved(response.teachingNote, fallback: record.teachingNote),
      securityLevel: resolved(response.securityLevel, fallback: record.securityLevel),
      countryName: resolved(response.countryName, fallback: record.countryName),
      province: resolved(response.province, fallback: record.province),
      city: resolved(response.city, fallback: record.city),
      district: resolved(response.district, fallback: record.district),
      tags: tags.isEmpty ? record.tags : tags
    )
  }
}
