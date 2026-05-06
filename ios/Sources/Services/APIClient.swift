import Foundation

final class APIClient {
  enum APIError: LocalizedError {
    case missingServerURL
    case invalidResponse
    case requestFailed(String)

    var errorDescription: String? {
      switch self {
      case .missingServerURL:
        return "请先设置服务端地址。"
      case .invalidResponse:
        return "服务端响应格式不正确。"
      case .requestFailed(let message):
        return message
      }
    }
  }

  private let settings: AppSettings
  private let decoder: JSONDecoder

  init(settings: AppSettings) {
    self.settings = settings
    self.decoder = JSONDecoder()
  }

  private func makeURL(path: String, queryItems: [URLQueryItem] = []) throws -> URL {
    guard let baseURL = settings.serverBaseURL else {
      throw APIError.missingServerURL
    }

    guard let url = URL(string: path, relativeTo: baseURL) else {
      throw APIError.invalidResponse
    }

    guard !queryItems.isEmpty else { return url }
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: true) else {
      throw APIError.invalidResponse
    }
    components.queryItems = queryItems
    guard let finalURL = components.url else {
      throw APIError.invalidResponse
    }
    return finalURL
  }

  func fetchManifest() async throws -> ManifestResponse {
    let url = try makeURL(path: "/api/mobile/manifest")
    let (data, response) = try await URLSession.shared.data(from: url)
    try validate(response: response, data: data)
    return try decoder.decode(ManifestResponse.self, from: data)
  }

  func search(keyword: String) async throws -> [MapRecord] {
    let url = try makeURL(
      path: "/api/mobile/search",
      queryItems: [URLQueryItem(name: "q", value: keyword)]
    )
    let (data, response) = try await URLSession.shared.data(from: url)
    try validate(response: response, data: data)
    return try decoder.decode(MobileSearchResponse.self, from: data).items
  }

  func fetchDetail(id: String) async throws -> MapRecord {
    let url = try makeURL(path: "/api/mobile/maps/\(id)")
    let (data, response) = try await URLSession.shared.data(from: url)
    try validate(response: response, data: data)
    return try decoder.decode(MobileMapDetailResponse.self, from: data).item
  }

  func saveMetadata(for record: MapRecord) async throws -> MapRecord {
    let url = try makeURL(path: "/api/maps/\(record.id)")
    var request = URLRequest(url: url)
    request.httpMethod = "PUT"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    var payload: [String: Any] = [:]
    payload["title"] = record.title
    payload["description"] = record.description
    payload["tags"] = record.tags
    payload["collection_unit"] = record.collectionUnit ?? ""
    payload["scope_level"] = record.scopeLevel ?? ""
    payload["country_code"] = record.countryCode ?? ""
    payload["country_name"] = record.countryName ?? ""
    payload["province"] = record.province ?? ""
    payload["related_countries"] = record.relatedCountries
    payload["related_provinces"] = record.relatedProvinces
    payload["city"] = record.city ?? ""
    payload["district"] = record.district ?? ""
    payload["latitude"] = record.latitude as Any
    payload["longitude"] = record.longitude as Any
    payload["north_latitude"] = record.northLatitude as Any
    payload["south_latitude"] = record.southLatitude as Any
    payload["east_longitude"] = record.eastLongitude as Any
    payload["west_longitude"] = record.westLongitude as Any
    payload["coverage_outline"] = record.coverageOutline?.map { ["x": $0.x, "y": $0.y] } as Any
    payload["year_label"] = record.yearLabel ?? ""
    payload["campaign"] = record.campaign ?? ""
    payload["teaching_use"] = record.teachingUse ?? ""
    payload["teaching_note"] = record.teachingNote ?? ""
    payload["security_level"] = record.securityLevel ?? ""
    request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])
    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)
    return try decoder.decode(MapRecord.self, from: data)
  }

  func downloadOriginal(for record: MapRecord) async throws -> Data {
    let url = try makeURL(path: record.files.original)
    let (data, response) = try await URLSession.shared.data(from: url)
    try validate(response: response, data: data)
    return data
  }

  func downloadThumbnail(for record: MapRecord) async throws -> Data {
    let path = record.files.thumbnail.isEmpty ? record.files.original : record.files.thumbnail
    let url = try makeURL(path: path)
    let (data, response) = try await URLSession.shared.data(from: url)
    try validate(response: response, data: data)
    return data
  }

  func uploadImages(fileURLs: [URL], folder: String = "mobile-backup/ios") async throws {
    guard !fileURLs.isEmpty else { return }
    let boundary = "Boundary-\(UUID().uuidString)"
    let url = try makeURL(path: "/api/maps/upload")
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

    var body = Data()

    func append(_ string: String) {
      if let data = string.data(using: .utf8) {
        body.append(data)
      }
    }

    append("--\(boundary)\r\n")
    append("Content-Disposition: form-data; name=\"folder\"\r\n\r\n")
    append("\(folder)\r\n")

    for fileURL in fileURLs {
      let data = try Data(contentsOf: fileURL)
      let name = fileURL.lastPathComponent
      let mimeType = Self.mimeType(for: fileURL.pathExtension)
      append("--\(boundary)\r\n")
      append("Content-Disposition: form-data; name=\"files\"; filename=\"\(name)\"\r\n")
      append("Content-Type: \(mimeType)\r\n\r\n")
      body.append(data)
      append("\r\n")
    }

    append("--\(boundary)--\r\n")
    request.httpBody = body

    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response: response, data: data)
  }

  func measureServerLatency() async throws -> TimeInterval {
    let start = Date()
    _ = try await fetchManifest()
    return Date().timeIntervalSince(start)
  }

  private func validate(response: URLResponse, data: Data) throws {
    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIError.invalidResponse
    }

    guard (200 ..< 300).contains(httpResponse.statusCode) else {
      let text = String(data: data, encoding: .utf8) ?? "Request failed"
      throw APIError.requestFailed(text)
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
}
