import Foundation

struct MapRecordFiles: Codable, Hashable {
  let original: String
  let thumbnail: String
}

struct MapRecord: Codable, Hashable {
  let id: String
  let fileName: String
  let title: String
  let description: String
  let tags: [String]
  let collectionUnit: String?
  let scopeLevel: String?
  let countryCode: String?
  let countryName: String?
  let province: String?
  let relatedCountries: [String]
  let relatedProvinces: [String]
  let city: String?
  let district: String?
  let latitude: Double?
  let longitude: Double?
  let northLatitude: Double?
  let southLatitude: Double?
  let eastLongitude: Double?
  let westLongitude: Double?
  let yearLabel: String?
  let campaign: String?
  let teachingUse: String?
  let teachingNote: String?
  let securityLevel: String?
  let favorite: Bool
  let mime: String?
  let width: Int?
  let height: Int?
  let sizeBytes: Int?
  let mtimeMs: Int64?
  let updatedAt: String
  let createdAt: String?
  let source: String?
  let ocrStatus: String?
  let ocrExcerpt: String
  let ocrText: String?
  let importedAt: String
  let files: MapRecordFiles

  enum CodingKeys: String, CodingKey {
    case id
    case fileName = "file_name"
    case title
    case description
    case tags
    case collectionUnit = "collection_unit"
    case scopeLevel = "scope_level"
    case countryCode = "country_code"
    case countryName = "country_name"
    case province
    case relatedCountries = "related_countries"
    case relatedProvinces = "related_provinces"
    case city
    case district
    case latitude
    case longitude
    case northLatitude = "north_latitude"
    case southLatitude = "south_latitude"
    case eastLongitude = "east_longitude"
    case westLongitude = "west_longitude"
    case yearLabel = "year_label"
    case campaign
    case teachingUse = "teaching_use"
    case teachingNote = "teaching_note"
    case securityLevel = "security_level"
    case favorite
    case mime
    case width
    case height
    case sizeBytes = "size_bytes"
    case mtimeMs = "mtime_ms"
    case updatedAt = "updated_at"
    case createdAt = "created_at"
    case source
    case ocrStatus = "ocr_status"
    case ocrExcerpt = "ocr_excerpt"
    case ocrText = "ocr_text"
    case importedAt = "imported_at"
    case files
  }

  var subtitleText: String {
    let parts = [countryName, province, city, yearLabel].compactMap { value -> String? in
      guard let value, !value.isEmpty else { return nil }
      return value
    }
    if !parts.isEmpty {
      return parts.joined(separator: " · ")
    }
    return fileName
  }

  var searchableText: String {
    var tokens: [String] = []
    tokens.append(title)
    tokens.append(fileName)
    tokens.append(description)
    tokens.append(countryName ?? "")
    tokens.append(province ?? "")
    tokens.append(city ?? "")
    tokens.append(district ?? "")
    tokens.append(yearLabel ?? "")
    tokens.append(campaign ?? "")
    tokens.append(teachingUse ?? "")
    tokens.append(teachingNote ?? "")
    tokens.append(securityLevel ?? "")
    tokens.append(tags.joined(separator: " "))
    tokens.append(ocrExcerpt)
    tokens.append(ocrText ?? "")
    return tokens.joined(separator: " ").lowercased()
  }

  static func makeImportedLocalRecord(fileName: String, sizeBytes: Int?, mime: String?) -> MapRecord {
    let now = ISO8601DateFormatter().string(from: Date())
    let title = URL(fileURLWithPath: fileName).deletingPathExtension().lastPathComponent

    return MapRecord(
      id: "local-\(UUID().uuidString.lowercased())",
      fileName: fileName,
      title: title.isEmpty ? fileName : title,
      description: "",
      tags: ["本地导入"],
      collectionUnit: nil,
      scopeLevel: nil,
      countryCode: nil,
      countryName: nil,
      province: nil,
      relatedCountries: [],
      relatedProvinces: [],
      city: nil,
      district: nil,
      latitude: nil,
      longitude: nil,
      northLatitude: nil,
      southLatitude: nil,
      eastLongitude: nil,
      westLongitude: nil,
      yearLabel: nil,
      campaign: nil,
      teachingUse: nil,
      teachingNote: nil,
      securityLevel: nil,
      favorite: false,
      mime: mime,
      width: nil,
      height: nil,
      sizeBytes: sizeBytes,
      mtimeMs: nil,
      updatedAt: now,
      createdAt: now,
      source: "ios-local-import",
      ocrStatus: nil,
      ocrExcerpt: "",
      ocrText: nil,
      importedAt: now,
      files: MapRecordFiles(original: "", thumbnail: "")
    )
  }

  func withImportedAt(_ value: String) -> MapRecord {
    MapRecord(
      id: id,
      fileName: fileName,
      title: title,
      description: description,
      tags: tags,
      collectionUnit: collectionUnit,
      scopeLevel: scopeLevel,
      countryCode: countryCode,
      countryName: countryName,
      province: province,
      relatedCountries: relatedCountries,
      relatedProvinces: relatedProvinces,
      city: city,
      district: district,
      latitude: latitude,
      longitude: longitude,
      northLatitude: northLatitude,
      southLatitude: southLatitude,
      eastLongitude: eastLongitude,
      westLongitude: westLongitude,
      yearLabel: yearLabel,
      campaign: campaign,
      teachingUse: teachingUse,
      teachingNote: teachingNote,
      securityLevel: securityLevel,
      favorite: favorite,
      mime: mime,
      width: width,
      height: height,
      sizeBytes: sizeBytes,
      mtimeMs: mtimeMs,
      updatedAt: updatedAt,
      createdAt: createdAt,
      source: source,
      ocrStatus: ocrStatus,
      ocrExcerpt: ocrExcerpt,
      ocrText: ocrText,
      importedAt: value,
      files: files
    )
  }

  func withEditableMetadata(
    title: String,
    description: String,
    yearLabel: String,
    campaign: String,
    teachingUse: String,
    teachingNote: String,
    securityLevel: String,
    countryCode: String? = nil,
    countryName: String,
    province: String,
    city: String,
    district: String,
    tags: [String]
  ) -> MapRecord {
    MapRecord(
      id: id,
      fileName: fileName,
      title: title,
      description: description,
      tags: tags,
      collectionUnit: collectionUnit,
      scopeLevel: scopeLevel,
      countryCode: countryCode?.isEmpty == false ? countryCode : self.countryCode,
      countryName: countryName.isEmpty ? nil : countryName,
      province: province.isEmpty ? nil : province,
      relatedCountries: relatedCountries,
      relatedProvinces: relatedProvinces,
      city: city.isEmpty ? nil : city,
      district: district.isEmpty ? nil : district,
      latitude: latitude,
      longitude: longitude,
      northLatitude: northLatitude,
      southLatitude: southLatitude,
      eastLongitude: eastLongitude,
      westLongitude: westLongitude,
      yearLabel: yearLabel.isEmpty ? nil : yearLabel,
      campaign: campaign.isEmpty ? nil : campaign,
      teachingUse: teachingUse.isEmpty ? nil : teachingUse,
      teachingNote: teachingNote.isEmpty ? nil : teachingNote,
      securityLevel: securityLevel.isEmpty ? nil : securityLevel,
      favorite: favorite,
      mime: mime,
      width: width,
      height: height,
      sizeBytes: sizeBytes,
      mtimeMs: mtimeMs,
      updatedAt: ISO8601DateFormatter().string(from: Date()),
      createdAt: createdAt,
      source: source,
      ocrStatus: ocrStatus,
      ocrExcerpt: ocrExcerpt,
      ocrText: ocrText,
      importedAt: importedAt,
      files: files
    )
  }

  func withOCRContent(
    text: String,
    excerpt: String,
    status: String = "complete",
    countryName: String? = nil,
    province: String? = nil,
    city: String? = nil,
    district: String? = nil
  ) -> MapRecord {
    MapRecord(
      id: id,
      fileName: fileName,
      title: title,
      description: description,
      tags: tags,
      collectionUnit: collectionUnit,
      scopeLevel: scopeLevel,
      countryCode: countryCode,
      countryName: countryName ?? self.countryName,
      province: province ?? self.province,
      relatedCountries: relatedCountries,
      relatedProvinces: relatedProvinces,
      city: city ?? self.city,
      district: district ?? self.district,
      latitude: latitude,
      longitude: longitude,
      northLatitude: northLatitude,
      southLatitude: southLatitude,
      eastLongitude: eastLongitude,
      westLongitude: westLongitude,
      yearLabel: yearLabel,
      campaign: campaign,
      teachingUse: teachingUse,
      teachingNote: teachingNote,
      securityLevel: securityLevel,
      favorite: favorite,
      mime: mime,
      width: width,
      height: height,
      sizeBytes: sizeBytes,
      mtimeMs: mtimeMs,
      updatedAt: ISO8601DateFormatter().string(from: Date()),
      createdAt: createdAt,
      source: source,
      ocrStatus: status,
      ocrExcerpt: excerpt,
      ocrText: text,
      importedAt: importedAt,
      files: files
    )
  }
}

struct ManifestResponse: Codable {
  let ok: Bool
  let revision: String
  let total: Int
  let items: [MapRecord]
}

struct MobileSearchResponse: Codable {
  let ok: Bool
  let q: String
  let total: Int
  let items: [MapRecord]
}

struct MobileMapDetailResponse: Codable {
  let ok: Bool
  let item: MapRecord
}
