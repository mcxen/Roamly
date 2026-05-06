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
    let scopeLevel: String?
    let countryCode: String?
    let countryName: String?
    let province: String?
    let city: String?
    let district: String?
    let latitude: Double?
    let longitude: Double?
    let northLatitude: Double?
    let southLatitude: Double?
    let eastLongitude: Double?
    let westLongitude: Double?
    let coverageOutline: [MapCoveragePoint]?
    let tags: [String]?

    enum CodingKeys: String, CodingKey {
      case title
      case description
      case yearLabel = "year_label"
      case campaign
      case teachingUse = "teaching_use"
      case teachingNote = "teaching_note"
      case securityLevel = "security_level"
      case scopeLevel = "scope_level"
      case countryCode = "country_code"
      case countryName = "country_name"
      case province
      case city
      case district
      case latitude
      case longitude
      case northLatitude = "north_latitude"
      case southLatitude = "south_latitude"
      case eastLongitude = "east_longitude"
      case westLongitude = "west_longitude"
      case coverageOutline = "coverage_outline"
      case tags
    }

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      title = try container.decodeStringIfPresent(forKey: .title)
      description = try container.decodeStringIfPresent(forKey: .description)
      yearLabel = try container.decodeStringIfPresent(forKey: .yearLabel)
      campaign = try container.decodeStringIfPresent(forKey: .campaign)
      teachingUse = try container.decodeStringIfPresent(forKey: .teachingUse)
      teachingNote = try container.decodeStringIfPresent(forKey: .teachingNote)
      securityLevel = try container.decodeStringIfPresent(forKey: .securityLevel)
      scopeLevel = try container.decodeStringIfPresent(forKey: .scopeLevel)
      countryCode = try container.decodeStringIfPresent(forKey: .countryCode)
      countryName = try container.decodeStringIfPresent(forKey: .countryName)
      province = try container.decodeStringIfPresent(forKey: .province)
      city = try container.decodeStringIfPresent(forKey: .city)
      district = try container.decodeStringIfPresent(forKey: .district)
      latitude = try container.decodeFlexibleDoubleIfPresent(forKey: .latitude)
      longitude = try container.decodeFlexibleDoubleIfPresent(forKey: .longitude)
      northLatitude = try container.decodeFlexibleDoubleIfPresent(forKey: .northLatitude)
      southLatitude = try container.decodeFlexibleDoubleIfPresent(forKey: .southLatitude)
      eastLongitude = try container.decodeFlexibleDoubleIfPresent(forKey: .eastLongitude)
      westLongitude = try container.decodeFlexibleDoubleIfPresent(forKey: .westLongitude)
      coverageOutline = try container.decodeIfPresent([MapCoveragePoint].self, forKey: .coverageOutline)
      tags = try container.decodeTagsIfPresent(forKey: .tags)
    }
  }

  private struct ModelsResponse: Decodable {
    let data: [ModelInfo]
  }

  private struct ModelInfo: Decodable {
    let id: String
  }

  private enum ExtractionStep: CaseIterable {
    case basicMetadata
    case coordinates
    case outline

    var title: String {
      switch self {
      case .basicMetadata:
        return "基础信息"
      case .coordinates:
        return "经纬度"
      case .outline:
        return "缩略图轮廓"
      }
    }

    var includesImage: Bool {
      switch self {
      case .basicMetadata:
        return false
      case .coordinates, .outline:
        return true
      }
    }
  }

  private let settings: AppSettings
  private let store: LocalLibraryStore
  private let logStore: AITaskLogStore
  private let session: URLSession

  init(settings: AppSettings, store: LocalLibraryStore, logStore: AITaskLogStore, session: URLSession = .shared) {
    self.settings = settings
    self.store = store
    self.logStore = logStore
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
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI 模型 ID。兼容接口必须使用供应商给出的精确模型 ID。")
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
      let updated = try await requestMetadataPipeline(for: record, endpoint: endpoint) { step in
        progress("AI 整理 \(index + 1)/\(targets.count) · \(step.title)：\(record.title)")
      }
      try store.updateRecord(updated)
      if let recordIndex = updatedRecords.firstIndex(where: { $0.id == updated.id }) {
        updatedRecords[recordIndex] = updated
      }
      processedCount += 1
    }

    progress("AI 编目完成，已更新 \(processedCount) 张地图")
    return IndexedResult(updatedRecords: updatedRecords, processedCount: processedCount)
  }

  func organizeRecord(
    _ record: MapRecord,
    progress: @escaping (String) -> Void = { _ in }
  ) async throws -> MapRecord {
    let endpoint = try validatedEndpoint()
    progress("正在请求 AI 分步提取…")
    let updated: MapRecord
    do {
      updated = try await requestMetadataPipeline(for: record, endpoint: endpoint) { step in
        progress("正在提取\(step.title)…")
      }
    } catch {
      progress("AI 请求不可用，正在使用本地范围估算…")
      updated = fallbackCoverageRecord(for: record)
    }
    try store.updateRecord(updated)
    progress("AI 提取完成")
    return updated
  }

  func measureLatency() async throws -> TimeInterval {
    guard let endpoint = makeEndpoint() else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI API URL。")
    }
    guard !settings.aiModel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI 模型 ID。兼容接口必须使用供应商给出的精确模型 ID。")
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

  func fetchAvailableModels() async throws -> [String] {
    guard let endpoint = makeModelsEndpoint() else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI API URL。")
    }
    guard !settings.aiAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw APIClient.APIError.requestFailed("请先填写 OpenAI API Key。")
    }

    var request = URLRequest(url: endpoint)
    request.httpMethod = "GET"
    request.setValue("Bearer \(settings.aiAPIKey)", forHTTPHeaderField: "Authorization")

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIClient.APIError.invalidResponse
    }
    guard (200 ..< 300).contains(httpResponse.statusCode) else {
      let text = String(data: data, encoding: .utf8) ?? "OpenAI model request failed"
      throw APIClient.APIError.requestFailed(text)
    }

    let decoded = try JSONDecoder().decode(ModelsResponse.self, from: data)
    let ids = decoded.data.map(\.id).filter { !$0.isEmpty }
    let chatModels = ids.filter(Self.isLikelyChatModel)
    return Self.sortedModelIDs(chatModels.isEmpty ? ids : chatModels)
  }

  func needsAI(for record: MapRecord) -> Bool {
    let hasOCR = !(record.ocrText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    let hasImage = FileManager.default.fileExists(atPath: store.localThumbnailURL(for: record).path) ||
      FileManager.default.fileExists(atPath: store.localOriginalURL(for: record).path)
    guard hasOCR || hasImage else { return false }
    let hasCoverageBounds = record.northLatitude != nil &&
      record.southLatitude != nil &&
      record.eastLongitude != nil &&
      record.westLongitude != nil
    let hasOutline = (record.coverageOutline?.count ?? 0) >= 3
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
    .count < 4 || !hasCoverageBounds || !hasOutline
  }

  private func validatedEndpoint() throws -> URL {
    guard let endpoint = makeEndpoint() else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI API URL。")
    }
    guard !settings.aiModel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw APIClient.APIError.requestFailed("请先在设置页填写 AI 模型 ID。兼容接口必须使用供应商给出的精确模型 ID。")
    }
    return endpoint
  }

  private func makeEndpoint() -> URL? {
    guard let rawURL = settings.aiAPIURL else { return nil }
    let path = rawURL.path.lowercased()
    if path.hasSuffix("/chat/completions") {
      return rawURL
    }
    return rawURL.appendingPathComponent("chat").appendingPathComponent("completions")
  }

  private func makeModelsEndpoint() -> URL? {
    guard let rawURL = settings.aiAPIURL else { return nil }
    let path = rawURL.path.lowercased()
    if path.hasSuffix("/models") {
      return rawURL
    }
    if path.hasSuffix("/chat/completions") {
      return rawURL
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appendingPathComponent("models")
    }
    return rawURL.appendingPathComponent("models")
  }

  private func requestMetadataPipeline(
    for record: MapRecord,
    endpoint: URL,
    progress: @escaping (ExtractionStep) -> Void
  ) async throws -> MapRecord {
    var current = record
    for step in ExtractionStep.allCases {
      progress(step)
      let response = try await requestMetadata(for: current, endpoint: endpoint, step: step)
      current = merge(record: current, with: response)
    }

    if (current.coverageOutline?.count ?? 0) < 3 {
      current = fallbackCoverageRecord(for: current)
    }
    return current
  }

  private func requestMetadata(for record: MapRecord, endpoint: URL, step: ExtractionStep) async throws -> AIResponse {
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if !settings.aiAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      request.setValue("Bearer \(settings.aiAPIKey)", forHTTPHeaderField: "Authorization")
    }

    let userPrompt = makeUserPrompt(for: record, step: step)
    let userContent = makeUserContent(for: record, prompt: userPrompt, includesImage: step.includesImage)
    let body: [String: Any] = [
      "model": settings.aiModel,
      "response_format": ["type": "json_object"],
      "messages": [
        ["role": "system", "content": systemPrompt(for: step)],
        ["role": "user", "content": userContent]
      ]
    ]
    let logID = logStore.start(
      title: "AI 编目·\(step.title)：\(record.title)",
      provider: settings.aiProvider.title,
      model: settings.aiModel,
      endpoint: endpoint.absoluteString,
      requestPreview: Self.prettyJSONString(Self.redactedAIBody(body))
    )
    request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])

    do {
      let (data, response) = try await session.data(for: request)
      guard let httpResponse = response as? HTTPURLResponse else {
        logStore.fail(id: logID, error: "AI 返回不是 HTTP 响应。", responsePreview: String(data: data, encoding: .utf8))
        throw APIClient.APIError.invalidResponse
      }
      let responseText = Self.truncated(String(data: data, encoding: .utf8) ?? "", limit: 12_000)
      guard (200 ..< 300).contains(httpResponse.statusCode) else {
        let text = responseText.isEmpty ? "AI request failed" : responseText
        logStore.fail(id: logID, httpStatus: httpResponse.statusCode, error: text, responsePreview: responseText)
        throw APIClient.APIError.requestFailed(text)
      }

      let content = try extractContent(from: data)
      let jsonData = try normalizeJSONPayload(content)
      let decoded = try JSONDecoder().decode(AIResponse.self, from: jsonData)
      logStore.succeed(
        id: logID,
        httpStatus: httpResponse.statusCode,
        responsePreview: responseText,
        parsedPreview: Self.truncated(content, limit: 12_000)
      )
      return decoded
    } catch {
      logStore.fail(id: logID, error: error.localizedDescription, responsePreview: nil)
      throw error
    }
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

  private func systemPrompt(for step: ExtractionStep) -> String {
    switch step {
    case .basicMetadata:
      return """
      你是军队内部历史地图编目助手。你只能返回 JSON，不要输出解释、Markdown 或代码块。
      当前步骤只提取基础编目信息，不提取经纬度或缩略图轮廓。
      无法判断时返回空字符串或空数组，不要编造。
      """
    case .coordinates:
      return """
      你是历史地图地理范围提取助手。你只能返回 JSON，不要输出解释、Markdown 或代码块。
      请优先读取地图边框、经纬网、地名、行政区名和 OCR 文本；没有明确经纬网时，可基于地名估算覆盖范围。
      """
    case .outline:
      return """
      你是历史地图缩略图轮廓提取助手。你只能返回 JSON，不要输出解释、Markdown 或代码块。
      \(Self.coverageExtractionSystemAppendix)
      """
    }
  }

  private func makeUserPrompt(for record: MapRecord, step: ExtractionStep) -> String {
    let context = makeRecordContext(for: record)
    switch step {
    case .basicMetadata:
      return """
      请只提取这张历史地图的基础编目信息，并严格返回单个 JSON 对象。

      \(context)

      必须返回的 JSON Schema：
      {
        "title": "string",
        "description": "string",
        "year_label": "string",
        "campaign": "string",
        "teaching_use": "string",
        "teaching_note": "string",
        "security_level": "string",
        "scope_level": "world|country|province|city|district|region|unknown",
        "country_code": "string",
        "country_name": "string",
        "province": "string",
        "city": "string",
        "district": "string",
        "tags": ["string"]
      }

      规则：
      1. 无法判断的字符串字段返回 ""，数组字段返回 []。
      2. 不要返回 latitude、longitude、north_latitude、south_latitude、east_longitude、west_longitude、coverage_outline。
      3. 不要输出 Schema 以外的字段。
      """
    case .coordinates:
      return """
      请只提取这张历史地图的经纬度覆盖范围，并严格返回单个 JSON 对象。

      \(context)

      必须返回的 JSON Schema：
      {
        "latitude": 0.0,
        "longitude": 0.0,
        "north_latitude": 0.0,
        "south_latitude": 0.0,
        "east_longitude": 0.0,
        "west_longitude": 0.0
      }

      规则：
      1. latitude/longitude 返回覆盖范围中心点；north_latitude/south_latitude/east_longitude/west_longitude 返回地图覆盖外接框。
      2. 若图上有经纬网、边框坐标、比例尺、行政边界或地名，优先结合这些信息判断。
      3. 如果没有明确经纬度，但能判断国家/省/市/区域，请按该行政区域的大致范围估算，不要因为缺少经纬网就返回 null。
      4. 经纬度用十进制度数字，东经/北纬为正，西经/南纬为负；完全无法判断时返回 null。
      5. 不要返回基础信息字段或 coverage_outline。
      """
    case .outline:
      return """
      请只提取这张历史地图在缩略图中的主体覆盖轮廓，并严格返回单个 JSON 对象。

      \(context)

      必须返回的 JSON Schema：
      {
        "coverage_outline": [{"x":0.0,"y":0.0}]
      }

      规则：
      1. coverage_outline 是“图像中的主体地图覆盖区域轮廓”，不是经纬度坐标。
      2. 坐标系固定为图像左上角 {"x":0,"y":0}，右下角 {"x":1,"y":1}。
      3. 优先沿地图主体的实际边界、行政边界、海岸线、图廓或覆盖区域边界给出 4 到 12 个点。
      4. 点必须按顺时针或逆时针沿边界排序，不能交叉，所有 x/y 必须在 0 到 1 之间。
      5. 不要把 inset 小图、图例、标题栏、空白边框当作主体轮廓。
      6. 不要把经纬度外接框、行政区经纬度范围或 OCR 推断范围投影成一个很小的矩形；轮廓必须贴合上传图片里真实可见的主体地图区域。
      7. 如果主体地图占据图片大部分，coverage_outline 的外接矩形也应覆盖图片大部分，不要只框住中间一小块。
      8. 如果无法精确识别不规则轮廓，但能判断地图主体所在区域，必须返回包住主体地图的四点矩形作为保底，例如 [{"x":0.08,"y":0.12},{"x":0.92,"y":0.12},{"x":0.92,"y":0.88},{"x":0.08,"y":0.88}]。
      9. 只有完全没有图像、OCR 和地名线索时，coverage_outline 才返回 []。
      10. 不要返回基础信息字段或经纬度字段。
      """
    }
  }

  private func makeRecordContext(for record: MapRecord) -> String {
    """
    原数据 JSON：
    {
      "file_name": \(Self.jsonString(record.fileName)),
      "title": \(Self.jsonString(record.title)),
      "description": \(Self.jsonString(record.description)),
      "scope_level": \(Self.jsonString(record.scopeLevel ?? "")),
      "country_code": \(Self.jsonString(record.countryCode ?? "")),
      "country_name": \(Self.jsonString(record.countryName ?? "")),
      "province": \(Self.jsonString(record.province ?? "")),
      "city": \(Self.jsonString(record.city ?? "")),
      "district": \(Self.jsonString(record.district ?? "")),
      "year_label": \(Self.jsonString(record.yearLabel ?? "")),
      "campaign": \(Self.jsonString(record.campaign ?? "")),
      "teaching_use": \(Self.jsonString(record.teachingUse ?? "")),
      "teaching_note": \(Self.jsonString(record.teachingNote ?? "")),
      "security_level": \(Self.jsonString(record.securityLevel ?? "")),
      "latitude": \(Self.jsonNumber(record.latitude)),
      "longitude": \(Self.jsonNumber(record.longitude)),
      "north_latitude": \(Self.jsonNumber(record.northLatitude)),
      "south_latitude": \(Self.jsonNumber(record.southLatitude)),
      "east_longitude": \(Self.jsonNumber(record.eastLongitude)),
      "west_longitude": \(Self.jsonNumber(record.westLongitude)),
      "coverage_outline": \(Self.jsonOutline(record.coverageOutline)),
      "tags": \(Self.jsonStringArray(record.tags))
    }

    OCR 文本：
    \(record.ocrText ?? record.ocrExcerpt)
    """
  }

  private func makeUserContent(for record: MapRecord, prompt: String, includesImage: Bool) -> Any {
    guard settings.aiProvider != .deepseek else {
      return "\(prompt)\n\n当前供应商 DeepSeek 仅使用文本消息。请基于 OCR、文件名和已有元数据尽力估算；无法判断时按本步骤规则返回。"
    }

    var content: [[String: Any]] = [
      [
        "type": "text",
        "text": prompt
      ]
    ]

    if includesImage, let imageURL = makeCompressedImageDataURL(for: record) {
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
      if !store.hasLocalThumbnail(for: record) {
        _ = store.generateThumbnailIfNeeded(for: record, maxPixelSize: 1600)
      }

      let thumbnailURL = store.localThumbnailURL(for: record)
      guard FileManager.default.fileExists(atPath: thumbnailURL.path),
            let image = UIImage(contentsOfFile: thumbnailURL.path),
            let data = compressedJPEGData(from: image)
      else { return nil }
      return "data:image/jpeg;base64,\(data.base64EncodedString())"
    #else
      return nil
    #endif
  }

  #if canImport(UIKit)
    private func compressedJPEGData(from image: UIImage) -> Data? {
      let longestSide = max(image.size.width, image.size.height)
      let maxBytes = 600_000
      let dimensions: [CGFloat] = [1280, 1024, 860, 720, 640]
      let qualities: [CGFloat] = [0.72, 0.60, 0.48, 0.36, 0.28]

      for maxDimension in dimensions {
        let scale = min(maxDimension / max(longestSide, 1), 1)
        let targetSize = CGSize(
          width: max(image.size.width * scale, 1),
          height: max(image.size.height * scale, 1)
        )
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let rendered = renderer.image { _ in
          image.draw(in: CGRect(origin: .zero, size: targetSize))
        }

        for quality in qualities {
          if let data = rendered.jpegData(compressionQuality: quality), data.count <= maxBytes {
            return data
          }
        }
      }

      return image.jpegData(compressionQuality: 0.22).flatMap { data in
        data.count <= maxBytes ? data : nil
      }
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
      scopeLevel: resolved(response.scopeLevel, fallback: record.scopeLevel),
      countryCode: resolved(response.countryCode, fallback: record.countryCode),
      countryName: resolved(response.countryName, fallback: record.countryName),
      province: resolved(response.province, fallback: record.province),
      city: resolved(response.city, fallback: record.city),
      district: resolved(response.district, fallback: record.district),
      tags: tags.isEmpty ? record.tags : tags,
      latitude: response.latitude,
      longitude: response.longitude,
      northLatitude: response.northLatitude,
      southLatitude: response.southLatitude,
      eastLongitude: response.eastLongitude,
      westLongitude: response.westLongitude,
      coverageOutline: normalizedOutline(response.coverageOutline, for: record)
    )
  }

  private func normalizedOutline(_ points: [MapCoveragePoint]?, for record: MapRecord? = nil) -> [MapCoveragePoint]? {
    guard let points, points.count >= 3 else { return nil }
    let clamped = Array(points.prefix(12)).map { point in
      MapCoveragePoint(
        x: min(max(point.x, 0), 1),
        y: min(max(point.y, 0), 1)
      )
    }
    guard !isDegenerateOutline(clamped) else {
      if let record {
        return fallbackOutline(for: record)
      }
      return nil
    }
    let centerX = clamped.map(\.x).reduce(0, +) / Double(clamped.count)
    let centerY = clamped.map(\.y).reduce(0, +) / Double(clamped.count)
    return clamped.sorted { left, right in
      atan2(left.y - centerY, left.x - centerX) < atan2(right.y - centerY, right.x - centerX)
    }
  }

  private func isDegenerateOutline(_ points: [MapCoveragePoint]) -> Bool {
    guard points.count >= 3 else { return true }
    let xs = points.map(\.x)
    let ys = points.map(\.y)
    guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else {
      return true
    }
    let width = maxX - minX
    let height = maxY - minY
    let area = polygonArea(points)
    return width < 0.30 || height < 0.24 || area < 0.08
  }

  private func polygonArea(_ points: [MapCoveragePoint]) -> Double {
    guard points.count >= 3 else { return 0 }
    var area = 0.0
    for index in points.indices {
      let next = points.index(after: index) == points.endIndex ? points.startIndex : points.index(after: index)
      area += points[index].x * points[next].y - points[next].x * points[index].y
    }
    return abs(area) / 2
  }

  private func fallbackCoverageRecord(for record: MapRecord) -> MapRecord {
    let bounds = fallbackBounds(for: record)
    let centerLatitude = record.latitude ?? bounds.map { ($0.north + $0.south) / 2 }
    let centerLongitude = record.longitude ?? bounds.map { ($0.east + $0.west) / 2 }
    let outline = normalizedOutline(record.coverageOutline, for: record) ?? fallbackOutline(for: record)

    return record.withEditableMetadata(
      title: record.title,
      description: record.description,
      yearLabel: record.yearLabel ?? "",
      campaign: record.campaign ?? "",
      teachingUse: record.teachingUse ?? "",
      teachingNote: record.teachingNote ?? "",
      securityLevel: record.securityLevel ?? "",
      scopeLevel: record.scopeLevel ?? "province",
      countryCode: record.countryCode,
      countryName: record.countryName ?? "",
      province: record.province ?? "",
      city: record.city ?? "",
      district: record.district ?? "",
      tags: record.tags,
      latitude: centerLatitude,
      longitude: centerLongitude,
      northLatitude: record.northLatitude ?? bounds?.north,
      southLatitude: record.southLatitude ?? bounds?.south,
      eastLongitude: record.eastLongitude ?? bounds?.east,
      westLongitude: record.westLongitude ?? bounds?.west,
      coverageOutline: outline
    )
  }

  private func fallbackOutline(for record: MapRecord) -> [MapCoveragePoint] {
    let key = [
      record.title,
      record.countryName,
      record.province,
      record.city,
      record.fileName
    ]
    .compactMap { $0 }
    .joined(separator: " ")

    if key.contains("菲律宾") {
      return [
        MapCoveragePoint(x: 0.42, y: 0.05), MapCoveragePoint(x: 0.52, y: 0.15), MapCoveragePoint(x: 0.47, y: 0.27),
        MapCoveragePoint(x: 0.56, y: 0.38), MapCoveragePoint(x: 0.50, y: 0.52), MapCoveragePoint(x: 0.62, y: 0.66),
        MapCoveragePoint(x: 0.52, y: 0.86), MapCoveragePoint(x: 0.36, y: 0.78), MapCoveragePoint(x: 0.30, y: 0.61),
        MapCoveragePoint(x: 0.38, y: 0.43), MapCoveragePoint(x: 0.31, y: 0.25)
      ]
    }
    if key.contains("黑龙江") || key.contains("龙江") {
      return [
        MapCoveragePoint(x: 0.22, y: 0.14), MapCoveragePoint(x: 0.52, y: 0.06), MapCoveragePoint(x: 0.82, y: 0.24),
        MapCoveragePoint(x: 0.76, y: 0.48), MapCoveragePoint(x: 0.58, y: 0.45), MapCoveragePoint(x: 0.49, y: 0.70),
        MapCoveragePoint(x: 0.26, y: 0.84), MapCoveragePoint(x: 0.13, y: 0.58), MapCoveragePoint(x: 0.20, y: 0.36)
      ]
    }
    if key.contains("江西") {
      return [
        MapCoveragePoint(x: 0.40, y: 0.06), MapCoveragePoint(x: 0.68, y: 0.16), MapCoveragePoint(x: 0.84, y: 0.43),
        MapCoveragePoint(x: 0.72, y: 0.70), MapCoveragePoint(x: 0.52, y: 0.91), MapCoveragePoint(x: 0.30, y: 0.80),
        MapCoveragePoint(x: 0.18, y: 0.55), MapCoveragePoint(x: 0.25, y: 0.28)
      ]
    }
    if key.contains("中国") {
      return [
        MapCoveragePoint(x: 0.10, y: 0.42), MapCoveragePoint(x: 0.25, y: 0.18), MapCoveragePoint(x: 0.47, y: 0.16),
        MapCoveragePoint(x: 0.62, y: 0.28), MapCoveragePoint(x: 0.83, y: 0.23), MapCoveragePoint(x: 0.93, y: 0.43),
        MapCoveragePoint(x: 0.75, y: 0.55), MapCoveragePoint(x: 0.65, y: 0.76), MapCoveragePoint(x: 0.45, y: 0.82),
        MapCoveragePoint(x: 0.28, y: 0.66), MapCoveragePoint(x: 0.14, y: 0.62)
      ]
    }
    return [
      MapCoveragePoint(x: 0.08, y: 0.12),
      MapCoveragePoint(x: 0.92, y: 0.12),
      MapCoveragePoint(x: 0.92, y: 0.88),
      MapCoveragePoint(x: 0.08, y: 0.88)
    ]
  }

  private func fallbackBounds(for record: MapRecord) -> (north: Double, south: Double, east: Double, west: Double)? {
    if let north = record.northLatitude,
       let south = record.southLatitude,
       let east = record.eastLongitude,
       let west = record.westLongitude {
      return (north, south, east, west)
    }

    let key = [
      record.countryName,
      record.province,
      record.city,
      record.title,
      record.fileName
    ]
    .compactMap { $0 }
    .joined(separator: " ")

    let knownBounds: [(String, (Double, Double, Double, Double))] = [
      ("贵州", (29.25, 24.62, 109.58, 103.60)),
      ("湖北", (33.28, 29.05, 116.13, 108.37)),
      ("江西", (30.08, 24.48, 118.48, 113.57)),
      ("黑龙江", (53.56, 43.42, 135.09, 121.18)),
      ("菲律宾", (21.30, 4.50, 127.00, 116.00))
    ]
    if let match = knownBounds.first(where: { key.contains($0.0) }) {
      return (match.1.0, match.1.1, match.1.2, match.1.3)
    }

    if let latitude = record.latitude, let longitude = record.longitude {
      return (latitude + 1.5, latitude - 1.5, longitude + 1.5, longitude - 1.5)
    }
    return nil
  }

  private static let coverageExtractionSystemAppendix = """
  你还必须尽力提取地图覆盖范围与缩略轮廓字段：
  - latitude/longitude：覆盖范围中心点，十进制度数字或 null。
  - north_latitude/south_latitude/east_longitude/west_longitude：覆盖范围外接框，十进制度数字或 null。
  - coverage_outline：3 到 12 个图像相对坐标点数组，点形如 {"x":0.12,"y":0.34}。这是缩略图上要画出的主体地图覆盖区轮廓，不是经纬度坐标。
  - coverage_outline 的坐标系固定为左上角 {"x":0,"y":0}，右下角 {"x":1,"y":1}；所有点必须在 0 到 1 之间，并沿边界顺时针或逆时针排列。
  - 如果能看到或推断主体地图范围，但无法精确描出不规则边界，必须返回包住主体地图的四点矩形作为保底，不要返回 []。
  - 只有完全没有图像、OCR 和地名线索时，coverage_outline 才允许返回 []。
  """

  private static func jsonNumber(_ value: Double?) -> String {
    guard let value else { return "null" }
    return String(value)
  }

  private static func jsonString(_ value: String) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: [value], options: []),
          let text = String(data: data, encoding: .utf8)
    else { return "\"\"" }
    return text
      .dropFirst()
      .dropLast()
      .description
  }

  private static func jsonStringArray(_ values: [String]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: values, options: []),
          let text = String(data: data, encoding: .utf8)
    else { return "[]" }
    return text
  }

  private static func jsonOutline(_ points: [MapCoveragePoint]?) -> String {
    guard let points else { return "[]" }
    let objects = points.map { ["x": $0.x, "y": $0.y] }
    guard let data = try? JSONSerialization.data(withJSONObject: objects, options: []),
          let text = String(data: data, encoding: .utf8)
    else { return "[]" }
    return text
  }

  private static func isLikelyChatModel(_ id: String) -> Bool {
    let lower = id.lowercased()
    let include = lower.hasPrefix("gpt-") ||
      lower.hasPrefix("o1") ||
      lower.hasPrefix("o3") ||
      lower.hasPrefix("o4") ||
      lower.hasPrefix("chatgpt-")
    let blockedTerms = [
      "audio",
      "realtime",
      "tts",
      "transcribe",
      "whisper",
      "embedding",
      "moderation",
      "image",
      "dall-e",
      "sora"
    ]
    return include && !blockedTerms.contains { lower.contains($0) }
  }

  private static func sortedModelIDs(_ ids: [String]) -> [String] {
    Array(Set(ids)).sorted { left, right in
      let leftRank = modelRank(left)
      let rightRank = modelRank(right)
      if leftRank != rightRank {
        return leftRank < rightRank
      }
      return left.localizedStandardCompare(right) == .orderedAscending
    }
  }

  private static func modelRank(_ id: String) -> Int {
    let lower = id.lowercased()
    if lower.hasPrefix("gpt-5.4") { return 0 }
    if lower.hasPrefix("gpt-5.2") { return 1 }
    if lower.hasPrefix("gpt-5.1") { return 2 }
    if lower.hasPrefix("gpt-5") { return 3 }
    if lower.hasPrefix("gpt-4.1") { return 4 }
    if lower.hasPrefix("gpt-4o") { return 5 }
    if lower.hasPrefix("o4") { return 6 }
    if lower.hasPrefix("o3") { return 7 }
    if lower.hasPrefix("o1") { return 8 }
    return 20
  }

  private static func redactedAIBody(_ body: [String: Any]) -> [String: Any] {
    var copy = body
    if let messages = body["messages"] as? [[String: Any]] {
      copy["messages"] = messages.map(redactedMessage)
    }
    return copy
  }

  private static func redactedMessage(_ message: [String: Any]) -> [String: Any] {
    var copy = message
    if let content = message["content"] as? String {
      copy["content"] = truncated(content, limit: 6000)
    } else if let parts = message["content"] as? [[String: Any]] {
      copy["content"] = parts.map { part in
        var item = part
        if let type = item["type"] as? String, type == "image_url" {
          item["image_url"] = ["url": "[压缩图片已省略，实际请求会上传约 600KB 以内的 data URL，避免兼容接口 1MB 限制]"]
        }
        if let text = item["text"] as? String {
          item["text"] = truncated(text, limit: 6000)
        }
        return item
      }
    }
    return copy
  }

  private static func prettyJSONString(_ object: Any) -> String {
    guard JSONSerialization.isValidJSONObject(object),
          let data = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]),
          let text = String(data: data, encoding: .utf8)
    else {
      return "\(object)"
    }
    return truncated(text, limit: 18_000)
  }

  private static func truncated(_ text: String, limit: Int) -> String {
    guard text.count > limit else { return text }
    return String(text.prefix(limit)) + "\n...[已截断 \(text.count - limit) 字]"
  }
}

final class AITaskLogStore {
  struct Entry: Codable {
    var id: String
    var title: String
    var provider: String
    var model: String
    var endpoint: String
    var status: String
    var httpStatus: Int?
    var startedAt: Date
    var updatedAt: Date
    var requestPreview: String
    var responsePreview: String?
    var parsedPreview: String?
    var errorMessage: String?

    var statusTitle: String {
      switch status {
      case "running":
        return "进行中"
      case "succeeded":
        return "成功"
      case "failed":
        return "失败"
      default:
        return status
      }
    }
  }

  private let defaultsKey = "roamly.mobile.ai.taskLogs"
  private let lock = NSLock()
  private let maxEntries = 80

  func entries() -> [Entry] {
    lock.lock()
    defer { lock.unlock() }
    return readUnlocked()
  }

  @discardableResult
  func start(title: String, provider: String, model: String, endpoint: String, requestPreview: String) -> String {
    let now = Date()
    let id = UUID().uuidString
    var entries = readLocked()
    entries.insert(
      Entry(
        id: id,
        title: title,
        provider: provider,
        model: model,
        endpoint: endpoint,
        status: "running",
        httpStatus: nil,
        startedAt: now,
        updatedAt: now,
        requestPreview: requestPreview,
        responsePreview: nil,
        parsedPreview: nil,
        errorMessage: nil
      ),
      at: 0
    )
    saveLocked(Array(entries.prefix(maxEntries)))
    return id
  }

  func succeed(id: String, httpStatus: Int?, responsePreview: String?, parsedPreview: String?) {
    update(id: id) { entry in
      entry.status = "succeeded"
      entry.httpStatus = httpStatus
      entry.responsePreview = responsePreview
      entry.parsedPreview = parsedPreview
      entry.errorMessage = nil
    }
  }

  func fail(id: String, httpStatus: Int? = nil, error: String, responsePreview: String?) {
    update(id: id) { entry in
      entry.status = "failed"
      entry.httpStatus = httpStatus ?? entry.httpStatus
      entry.errorMessage = error
      if let responsePreview {
        entry.responsePreview = responsePreview
      }
    }
  }

  func clear() {
    lock.lock()
    UserDefaults.standard.removeObject(forKey: defaultsKey)
    lock.unlock()
    notify()
  }

  private func update(id: String, mutate: (inout Entry) -> Void) {
    lock.lock()
    var entries = readUnlocked()
    if let index = entries.firstIndex(where: { $0.id == id }) {
      mutate(&entries[index])
      entries[index].updatedAt = Date()
      saveUnlocked(entries)
    }
    lock.unlock()
    notify()
  }

  private func readLocked() -> [Entry] {
    lock.lock()
    defer { lock.unlock() }
    return readUnlocked()
  }

  private func readUnlocked() -> [Entry] {
    guard let data = UserDefaults.standard.data(forKey: defaultsKey),
          let entries = try? JSONDecoder().decode([Entry].self, from: data)
    else { return [] }
    return entries
  }

  private func saveLocked(_ entries: [Entry]) {
    lock.lock()
    saveUnlocked(entries)
    lock.unlock()
    notify()
  }

  private func saveUnlocked(_ entries: [Entry]) {
    guard let data = try? JSONEncoder().encode(entries) else { return }
    UserDefaults.standard.set(data, forKey: defaultsKey)
  }

  private func notify() {
    DispatchQueue.main.async {
      NotificationCenter.default.post(name: .aiTaskLogStoreDidChange, object: self)
    }
  }
}

extension Notification.Name {
  static let aiTaskLogStoreDidChange = Notification.Name("roamly.mobile.aiTaskLogStoreDidChange")
}

private extension KeyedDecodingContainer {
  func decodeStringIfPresent(forKey key: Key) throws -> String? {
    guard contains(key) else {
      return nil
    }
    if try decodeNil(forKey: key) {
      return nil
    }
    if let value = try? decode(String.self, forKey: key) {
      return value
    }
    if let value = try? decode(Double.self, forKey: key) {
      return String(value)
    }
    if let value = try? decode(Int.self, forKey: key) {
      return String(value)
    }
    return nil
  }

  func decodeFlexibleDoubleIfPresent(forKey key: Key) throws -> Double? {
    guard contains(key) else {
      return nil
    }
    if try decodeNil(forKey: key) {
      return nil
    }
    if let value = try? decode(Double.self, forKey: key) {
      return value
    }
    if let value = try? decode(Int.self, forKey: key) {
      return Double(value)
    }
    if let text = try? decode(String.self, forKey: key) {
      let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? nil : Double(trimmed)
    }
    return nil
  }

  func decodeTagsIfPresent(forKey key: Key) throws -> [String]? {
    guard contains(key) else {
      return nil
    }
    if try decodeNil(forKey: key) {
      return nil
    }
    if let values = try? decode([String].self, forKey: key) {
      return values
    }
    if let text = try? decode(String.self, forKey: key) {
      return text
        .split { character in
          character == "," || character == "，" || character == ";" || character == "；"
        }
        .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
    }
    return nil
  }
}
