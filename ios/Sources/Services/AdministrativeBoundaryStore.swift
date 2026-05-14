import CoreLocation
import Foundation

enum AdministrativeBoundaryLevel: String, Decodable {
  case country
  case province
}

struct AdministrativeBoundary {
  let level: AdministrativeBoundaryLevel
  let country: String
  let name: String
  let displayName: String
  let center: CLLocationCoordinate2D?
  let polygons: [[CLLocationCoordinate2D]]
}

final class AdministrativeBoundaryStore {
  private struct BoundaryPayload: Decodable {
    let regions: [BoundaryEntry]
  }

  private struct BoundaryEntry: Decodable {
    let level: AdministrativeBoundaryLevel
    let country: String
    let name: String
    let displayName: String
    let center: [Double]?
    let polygons: [[[Double]]]
  }

  private let bundle: Bundle
  private lazy var boundaries: [AdministrativeBoundary] = loadBoundaries()

  init(bundle: Bundle = .main) {
    self.bundle = bundle
  }

  func boundary(countryName: String?, provinceName: String?) -> AdministrativeBoundary? {
    let country = normalizedCountryName(countryName)
    let province = normalizedRegionName(provinceName)
    guard !country.isEmpty else { return nil }

    if !province.isEmpty {
      return boundaries.first {
        $0.level == .province &&
          normalizedCountryName($0.country) == country &&
          normalizedRegionName($0.name) == province
      }
    }

    return boundaries.first {
      $0.level == .country &&
        normalizedCountryName($0.country) == country
    }
  }

  private func loadBoundaries() -> [AdministrativeBoundary] {
    guard let url = bundle.url(forResource: "admin-boundaries-cn", withExtension: "json") else {
      return []
    }
    do {
      let data = try Data(contentsOf: url)
      let payload = try JSONDecoder().decode(BoundaryPayload.self, from: data)
      return payload.regions.map { entry in
        AdministrativeBoundary(
          level: entry.level,
          country: entry.country,
          name: entry.name,
          displayName: entry.displayName,
          center: entry.center.flatMap { values in
            guard values.count == 2 else { return nil }
            return CLLocationCoordinate2D(latitude: values[1], longitude: values[0])
          },
          polygons: entry.polygons.map { ring in
            ring.compactMap { values in
              guard values.count == 2 else { return nil }
              return CLLocationCoordinate2D(latitude: values[1], longitude: values[0])
            }
          }.filter { $0.count >= 3 }
        )
      }
    } catch {
      return []
    }
  }

  private func normalizedCountryName(_ value: String?) -> String {
    let raw = normalizedRegionName(value).lowercased()
    switch raw {
    case "china", "cn", "中华人民共和国":
      return "中国"
    default:
      return raw
    }
  }

  private func normalizedRegionName(_ value: String?) -> String {
    var result = String(value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let suffixes = ["壮族自治区", "回族自治区", "维吾尔自治区", "特别行政区", "自治区", "省", "市"]
    for suffix in suffixes where result.hasSuffix(suffix) {
      result.removeLast(suffix.count)
      break
    }
    return result
  }
}
