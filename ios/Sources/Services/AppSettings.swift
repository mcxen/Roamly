import Foundation

final class AppSettings {
  private let serverURLKey = "roamly.mobile.serverURL"
  private let thumbnailSizeKey = "roamly.mobile.thumbnailSize"
  private let showTitlesOnLibraryKey = "roamly.mobile.showTitlesOnLibrary"
  private let interfaceStyleKey = "roamly.mobile.interfaceStyle"
  private let aiAPIURLKey = "roamly.mobile.ai.apiURL"
  private let aiAPIKeyKey = "roamly.mobile.ai.apiKey"
  private let aiModelKey = "roamly.mobile.ai.model"
  private let aiSystemPromptKey = "roamly.mobile.ai.systemPrompt"

  enum ThumbnailSize: String, CaseIterable {
    case compact
    case standard
    case large

    var title: String {
      switch self {
      case .compact:
        return "紧凑"
      case .standard:
        return "标准"
      case .large:
        return "大图"
      }
    }
  }

  enum InterfaceStyle: String, CaseIterable {
    case system
    case light
    case dark

    var title: String {
      switch self {
      case .system:
        return "跟随系统"
      case .light:
        return "浅色"
      case .dark:
        return "深色"
      }
    }
  }

  var serverURLString: String {
    get { UserDefaults.standard.string(forKey: serverURLKey) ?? "" }
    set { UserDefaults.standard.set(newValue, forKey: serverURLKey) }
  }

  var thumbnailSize: ThumbnailSize {
    get {
      let raw = UserDefaults.standard.string(forKey: thumbnailSizeKey) ?? ThumbnailSize.standard.rawValue
      return ThumbnailSize(rawValue: raw) ?? .standard
    }
    set {
      UserDefaults.standard.set(newValue.rawValue, forKey: thumbnailSizeKey)
      notifyUpdate()
    }
  }

  var showTitlesOnLibrary: Bool {
    get {
      if UserDefaults.standard.object(forKey: showTitlesOnLibraryKey) == nil {
        return true
      }
      return UserDefaults.standard.bool(forKey: showTitlesOnLibraryKey)
    }
    set {
      UserDefaults.standard.set(newValue, forKey: showTitlesOnLibraryKey)
      notifyUpdate()
    }
  }

  var interfaceStyle: InterfaceStyle {
    get {
      let raw = UserDefaults.standard.string(forKey: interfaceStyleKey) ?? InterfaceStyle.system.rawValue
      return InterfaceStyle(rawValue: raw) ?? .system
    }
    set {
      UserDefaults.standard.set(newValue.rawValue, forKey: interfaceStyleKey)
      notifyUpdate()
    }
  }

  var serverBaseURL: URL? {
    let raw = serverURLString.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !raw.isEmpty else { return nil }
    return URL(string: raw)
  }

  var aiAPIURLString: String {
    get { UserDefaults.standard.string(forKey: aiAPIURLKey) ?? "" }
    set {
      UserDefaults.standard.set(newValue, forKey: aiAPIURLKey)
      notifyUpdate()
    }
  }

  var aiAPIKey: String {
    get { UserDefaults.standard.string(forKey: aiAPIKeyKey) ?? "" }
    set {
      UserDefaults.standard.set(newValue, forKey: aiAPIKeyKey)
      notifyUpdate()
    }
  }

  var aiModel: String {
    get { UserDefaults.standard.string(forKey: aiModelKey) ?? "gpt-4.1-mini" }
    set {
      UserDefaults.standard.set(newValue, forKey: aiModelKey)
      notifyUpdate()
    }
  }

  var aiSystemPrompt: String {
    get {
      UserDefaults.standard.string(forKey: aiSystemPromptKey) ?? Self.defaultAISystemPrompt
    }
    set {
      UserDefaults.standard.set(newValue, forKey: aiSystemPromptKey)
      notifyUpdate()
    }
  }

  var aiAPIURL: URL? {
    let raw = aiAPIURLString.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !raw.isEmpty else { return nil }
    return URL(string: raw)
  }

  private func notifyUpdate() {
    NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
  }

  static let defaultAISystemPrompt = """
  你是军队内部历史地图编目助手。你只能返回 JSON，不要输出任何解释、Markdown 或代码块。
  请基于 OCR 文本、文件名和已有元数据，对地图进行编目整理，输出字段：
  title, description, year_label, campaign, teaching_use, teaching_note, security_level, country_name, province, city, district, tags。
  要求：
  1. 无法判断时返回空字符串或空数组，不要编造。
  2. tags 返回字符串数组，最多 8 个。
  3. 输出必须是单个合法 JSON 对象。
  """
}

extension Notification.Name {
  static let appSettingsDidChange = Notification.Name("roamly.mobile.settingsDidChange")
}
