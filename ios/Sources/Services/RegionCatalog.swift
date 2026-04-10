import Foundation

struct SelectionOption: Hashable {
  let id: String
  let title: String
  let subtitle: String?
  let searchTokens: [String]
}

struct RegionDetection {
  let countryName: String?
  let province: String?
  let city: String?
  let district: String?
  let matchedText: String
}

final class RegionCatalog {
  private struct CountryEntry: Decodable {
    let countryName: String
    let countryShortCode: String
    let regions: [CountryRegionEntry]
  }

  private struct CountryRegionEntry: Decodable {
    let name: String
    let shortCode: String
  }

  private struct ChinaProvinceEntry: Decodable {
    let code: String
    let name: String
    let province: String
  }

  private struct ChinaCityEntry: Decodable {
    let code: String
    let name: String
    let province: String
    let city: String
  }

  private struct ChinaAreaEntry: Decodable {
    let code: String
    let name: String
    let province: String
    let city: String
    let area: String
  }

  private let bundle: Bundle
  private let chineseLocale = Locale(identifier: "zh_Hans")
  private let countryAliasMap: [String: [String]] = [
    "BN": ["文莱", "汶莱", "Brunei"],
    "CN": ["中国", "中华人民共和国", "China"],
    "ID": ["印度尼西亚", "印尼", "Indonesia"],
    "KH": ["柬埔寨", "Cambodia"],
    "LA": ["老挝", "Laos"],
    "MY": ["马来西亚", "马来", "大马", "Malaysia"],
    "SG": ["新加坡", "狮城", "Singapore"],
    "TH": ["泰国", "Thailand"],
    "TW": ["台湾", "Taiwan"],
    "VN": ["越南", "Vietnam"]
  ]
  private let regionAliasMap: [String: [String: [String]]] = [
    "MY": [
      "Johor": ["柔佛"],
      "Kedah": ["吉打"],
      "Kelantan": ["吉兰丹"],
      "Melaka": ["马六甲"],
      "Negeri Sembilan": ["森美兰"],
      "Pahang": ["彭亨"],
      "Perak": ["霹雳"],
      "Perlis": ["玻璃市"],
      "Pulau Pinang": ["槟城", "槟榔屿"],
      "Sabah": ["沙巴"],
      "Sarawak": ["砂拉越"],
      "Selangor": ["雪兰莪"],
      "Terengganu": ["登嘉楼"],
      "Kuala Lumpur": ["吉隆坡"],
      "Labuan": ["纳闽"],
      "Putrajaya": ["布城"]
    ]
  ]

  private lazy var countries: [CountryEntry] = loadJSON("country-region-data", as: [CountryEntry].self)
  private lazy var chinaProvinces: [ChinaProvinceEntry] = loadJSON("china-province", as: [ChinaProvinceEntry].self)
  private lazy var chinaCities: [ChinaCityEntry] = loadJSON("china-city", as: [ChinaCityEntry].self)
  private lazy var chinaAreas: [ChinaAreaEntry] = loadJSON("china-area", as: [ChinaAreaEntry].self)

  init(bundle: Bundle = .main) {
    self.bundle = bundle
  }

  func countryOptions() -> [SelectionOption] {
    countries.map { item in
      let localized = localizedCountryName(code: item.countryShortCode, fallback: item.countryName)
      return SelectionOption(
        id: item.countryShortCode,
        title: localized,
        subtitle: localized == item.countryName ? nil : item.countryName,
        searchTokens: countrySearchTokens(for: item)
      )
    }
    .sorted { $0.title.localizedCompare($1.title) == .orderedAscending }
  }

  func displayCountryName(for raw: String?) -> String {
    guard let entry = countryEntry(for: raw) else {
      return String(raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return localizedCountryName(code: entry.countryShortCode, fallback: entry.countryName)
  }

  func provinceOptions(forCountryName rawCountry: String?) -> [SelectionOption] {
    guard let country = countryEntry(for: rawCountry) else { return [] }

    if country.countryShortCode == "CN" {
      return chinaProvinces.map {
        return SelectionOption(
          id: $0.code,
          title: normalizeChineseDivisionName($0.name),
          subtitle: nil,
          searchTokens: [$0.name, normalizeChineseDivisionName($0.name)]
        )
      }
    }

    return country.regions
      .map {
        let title = localizedRegionName($0.name, countryCode: country.countryShortCode)
        return SelectionOption(
          id: $0.shortCode,
          title: title,
          subtitle: title == $0.name ? nil : $0.name,
          searchTokens: regionSearchTokens(for: $0.name, countryCode: country.countryShortCode)
        )
      }
      .sorted { $0.title.localizedCompare($1.title) == .orderedAscending }
  }

  func cityOptions(forCountryName rawCountry: String?, province rawProvince: String?) -> [SelectionOption] {
    guard resolveCountryCode(for: rawCountry) == "CN" else { return [] }
    let provinceCode = resolveChinaProvinceCode(name: rawProvince)
    guard let provinceCode else { return [] }

    return chinaCities
      .filter { $0.province == provinceCode }
      .map {
        return SelectionOption(
          id: $0.code,
          title: normalizeChineseDivisionName($0.name),
          subtitle: nil,
          searchTokens: [$0.name, normalizeChineseDivisionName($0.name)]
        )
      }
  }

  func districtOptions(
    forCountryName rawCountry: String?,
    province rawProvince: String?,
    city rawCity: String?
  ) -> [SelectionOption] {
    guard resolveCountryCode(for: rawCountry) == "CN" else { return [] }
    let provinceCode = resolveChinaProvinceCode(name: rawProvince)
    let cityCode = resolveChinaCityCode(provinceName: rawProvince, cityName: rawCity)
    guard let provinceCode, let cityCode else { return [] }

    return chinaAreas
      .filter { $0.province == provinceCode && $0.city == cityCode }
      .map {
        return SelectionOption(
          id: $0.code,
          title: normalizeChineseDivisionName($0.name),
          subtitle: nil,
          searchTokens: [$0.name, normalizeChineseDivisionName($0.name)]
        )
      }
  }

  func detectedRegion(fromRecognizedText text: String) -> RegionDetection? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let normalizedText = normalize(trimmed)
    let country = bestCountryMatch(in: normalizedText)

    if let area = bestChinaAreaMatch(in: normalizedText) {
      let province = chinaProvinces.first(where: { $0.province == area.province })
      let city = chinaCities.first(where: { $0.province == area.province && $0.city == area.city })
      return RegionDetection(
        countryName: displayCountryName(for: "China"),
        province: normalizeChineseDivisionName(province?.name ?? ""),
        city: normalizeChineseDivisionName(city?.name ?? ""),
        district: normalizeChineseDivisionName(area.name),
        matchedText: trimmed
      )
    }

    if let city = bestChinaCityMatch(in: normalizedText) {
      let province = chinaProvinces.first(where: { $0.province == city.province })
      return RegionDetection(
        countryName: displayCountryName(for: "China"),
        province: normalizeChineseDivisionName(province?.name ?? ""),
        city: normalizeChineseDivisionName(city.name),
        district: nil,
        matchedText: trimmed
      )
    }

    if let province = bestChinaProvinceMatch(in: normalizedText) {
      return RegionDetection(
        countryName: displayCountryName(for: "China"),
        province: normalizeChineseDivisionName(province.name),
        city: nil,
        district: nil,
        matchedText: trimmed
      )
    }

    if let country {
      let matchedRegion = bestRegionMatch(in: normalizedText, country: country)
      return RegionDetection(
        countryName: localizedCountryName(code: country.countryShortCode, fallback: country.countryName),
        province: matchedRegion.map { localizedRegionName($0.name, countryCode: country.countryShortCode) },
        city: nil,
        district: nil,
        matchedText: trimmed
      )
    }

    return nil
  }

  func resolveCountryCode(for rawCountry: String?) -> String? {
    countryEntry(for: rawCountry)?.countryShortCode
  }

  private func countryEntry(for rawCountry: String?) -> CountryEntry? {
    let raw = String(rawCountry ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !raw.isEmpty else { return nil }
    let normalizedRaw = normalize(raw)

    return countries.first(where: { item in
      return normalize(item.countryShortCode) == normalizedRaw
        || countryMatchCandidates(for: item).contains(where: { normalize($0) == normalizedRaw })
    })
  }

  private func countryMatchCandidates(for item: CountryEntry) -> [String] {
    uniqueStrings([
      item.countryName,
      localizedCountryName(code: item.countryShortCode, fallback: item.countryName)
    ] + (countryAliasMap[item.countryShortCode] ?? []))
  }

  private func countrySearchTokens(for item: CountryEntry) -> [String] {
    uniqueStrings(countryMatchCandidates(for: item) + [item.countryShortCode])
  }

  private func localizedRegionName(_ regionName: String, countryCode: String) -> String {
    (regionAliasMap[countryCode]?[regionName]?.first ?? regionName)
  }

  private func regionSearchTokens(for regionName: String, countryCode: String) -> [String] {
    uniqueStrings([regionName] + (regionAliasMap[countryCode]?[regionName] ?? []))
  }

  private func uniqueStrings(_ values: [String]) -> [String] {
    Array(Set(values.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }))
  }

  private func resolveChinaProvinceCode(name rawName: String?) -> String? {
    let normalizedName = normalize(rawName)
    guard !normalizedName.isEmpty else { return nil }
    return chinaProvinces.first(where: {
      normalize($0.name) == normalizedName || normalize(normalizeChineseDivisionName($0.name)) == normalizedName
    })?.province
  }

  private func resolveChinaCityCode(provinceName rawProvince: String?, cityName rawCity: String?) -> String? {
    let provinceCode = resolveChinaProvinceCode(name: rawProvince)
    let normalizedCity = normalize(rawCity)
    guard let provinceCode, !normalizedCity.isEmpty else { return nil }

    return chinaCities.first(where: {
      $0.province == provinceCode
        && (normalize($0.name) == normalizedCity || normalize(normalizeChineseDivisionName($0.name)) == normalizedCity)
    })?.city
  }

  private func bestCountryMatch(in normalizedText: String) -> CountryEntry? {
    countries
      .sorted {
        countryMatchCandidates(for: $0).map(\.count).max() ?? 0
          > countryMatchCandidates(for: $1).map(\.count).max() ?? 0
      }
      .first(where: { item in
        countryMatchCandidates(for: item).contains { normalizedText.contains(normalize($0)) }
      })
  }

  private func bestRegionMatch(in normalizedText: String, country: CountryEntry) -> CountryRegionEntry? {
    country.regions
      .sorted {
        regionSearchTokens(for: $0.name, countryCode: country.countryShortCode).map(\.count).max() ?? 0
          > regionSearchTokens(for: $1.name, countryCode: country.countryShortCode).map(\.count).max() ?? 0
      }
      .first(where: { region in
        regionSearchTokens(for: region.name, countryCode: country.countryShortCode)
          .contains { normalizedText.contains(normalize($0)) }
      })
  }

  private func bestChinaProvinceMatch(in normalizedText: String) -> ChinaProvinceEntry? {
    chinaProvinces
      .sorted { $0.name.count > $1.name.count }
      .first(where: {
        normalizedText.contains(normalize($0.name))
          || normalizedText.contains(normalize(normalizeChineseDivisionName($0.name)))
      })
  }

  private func bestChinaCityMatch(in normalizedText: String) -> ChinaCityEntry? {
    chinaCities
      .sorted { $0.name.count > $1.name.count }
      .first(where: {
        normalizedText.contains(normalize($0.name))
          || normalizedText.contains(normalize(normalizeChineseDivisionName($0.name)))
      })
  }

  private func bestChinaAreaMatch(in normalizedText: String) -> ChinaAreaEntry? {
    chinaAreas
      .sorted { $0.name.count > $1.name.count }
      .first(where: {
        normalizedText.contains(normalize($0.name))
          || normalizedText.contains(normalize(normalizeChineseDivisionName($0.name)))
      })
  }

  private func localizedCountryName(code: String, fallback: String) -> String {
    chineseLocale.localizedString(forRegionCode: code) ?? fallback
  }

  private func normalizeChineseDivisionName(_ value: String) -> String {
    String(value)
      .replacingOccurrences(of: "特别行政区", with: "")
      .replacingOccurrences(of: "维吾尔自治区", with: "")
      .replacingOccurrences(of: "壮族自治区", with: "")
      .replacingOccurrences(of: "回族自治区", with: "")
      .replacingOccurrences(of: "自治区", with: "")
      .replacingOccurrences(of: "省", with: "")
      .replacingOccurrences(of: "市", with: "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func normalize(_ value: String?) -> String {
    String(value ?? "")
      .lowercased()
      .replacingOccurrences(of: " ", with: "")
      .replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "")
      .replacingOccurrences(of: "特别行政区", with: "")
      .replacingOccurrences(of: "维吾尔自治区", with: "")
      .replacingOccurrences(of: "壮族自治区", with: "")
      .replacingOccurrences(of: "回族自治区", with: "")
      .replacingOccurrences(of: "自治区", with: "")
      .replacingOccurrences(of: "省", with: "")
      .replacingOccurrences(of: "市", with: "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func loadJSON<T: Decodable>(_ name: String, as type: T.Type) -> T {
    guard let url = bundle.url(forResource: name, withExtension: "json") else {
      NSLog("RegionCatalog missing resource: %@.json", name)
      return emptyValue(for: type)
    }

    do {
      let data = try Data(contentsOf: url)
      return try JSONDecoder().decode(T.self, from: data)
    } catch {
      NSLog("RegionCatalog failed to decode %@.json: %@", name, String(describing: error))
      return emptyValue(for: type)
    }
  }

  private func emptyValue<T>(for type: T.Type) -> T {
    if let emptyArray = [] as? T {
      return emptyArray
    }
    preconditionFailure("Unsupported empty fallback for \(type)")
  }
}
