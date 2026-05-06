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
  private let aiProviderKey = "roamly.mobile.ai.provider"
  private let aiConfigurationsKey = "roamly.mobile.ai.configurations"
  private let selectedAIConfigurationIDKey = "roamly.mobile.ai.selectedConfigurationID"

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

  enum AIProvider: String, CaseIterable {
    case deepseek
    case openAI
    case openAICompatible

    var title: String {
      switch self {
      case .deepseek:
        return "DeepSeek"
      case .openAI:
        return "OpenAI"
      case .openAICompatible:
        return "兼容接口"
      }
    }

    var defaultBaseURL: String {
      switch self {
      case .deepseek:
        return "https://api.deepseek.com"
      case .openAI:
        return "https://api.openai.com/v1"
      case .openAICompatible:
        return "https://api.openai.com/v1"
      }
    }

    var defaultModel: String {
      switch self {
      case .deepseek:
        return "deepseek-v4-flash"
      case .openAI:
        return "gpt-4.1-mini"
      case .openAICompatible:
        return ""
      }
    }
  }

  struct AIConfiguration: Codable, Equatable {
    var id: String
    var name: String
    var providerRawValue: String
    var apiURLString: String
    var apiKey: String
    var model: String
    var systemPrompt: String
    var updatedAt: Date

    var provider: AIProvider {
      AIProvider(rawValue: providerRawValue) ?? .deepseek
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
    get { UserDefaults.standard.string(forKey: aiAPIURLKey) ?? aiProvider.defaultBaseURL }
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
    get { UserDefaults.standard.string(forKey: aiModelKey) ?? aiProvider.defaultModel }
    set {
      UserDefaults.standard.set(newValue, forKey: aiModelKey)
      notifyUpdate()
    }
  }

  var aiProvider: AIProvider {
    get {
      let raw = UserDefaults.standard.string(forKey: aiProviderKey) ?? AIProvider.deepseek.rawValue
      return AIProvider(rawValue: raw) ?? .deepseek
    }
    set {
      UserDefaults.standard.set(newValue.rawValue, forKey: aiProviderKey)
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

  var selectedAIConfigurationID: String {
    get { UserDefaults.standard.string(forKey: selectedAIConfigurationIDKey) ?? "" }
    set {
      UserDefaults.standard.set(newValue, forKey: selectedAIConfigurationIDKey)
      notifyUpdate()
    }
  }

  var aiConfigurations: [AIConfiguration] {
    get {
      guard let data = UserDefaults.standard.data(forKey: aiConfigurationsKey),
            let values = try? JSONDecoder().decode([AIConfiguration].self, from: data)
      else {
        return []
      }
      return values.sorted { left, right in
        left.updatedAt > right.updatedAt
      }
    }
    set {
      let sorted = newValue.sorted { left, right in
        left.updatedAt > right.updatedAt
      }
      if let data = try? JSONEncoder().encode(sorted) {
        UserDefaults.standard.set(data, forKey: aiConfigurationsKey)
      }
      notifyUpdate()
    }
  }

  func currentAIConfiguration(named name: String? = nil) -> AIConfiguration {
    let trimmedName = String(name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let provider = aiProvider
    let model = aiModel.trimmingCharacters(in: .whitespacesAndNewlines)
    let fallbackName = [
      provider.title,
      model.isEmpty ? "未填模型" : model
    ].joined(separator: " · ")

    return AIConfiguration(
      id: selectedAIConfigurationID.isEmpty ? UUID().uuidString : selectedAIConfigurationID,
      name: trimmedName.isEmpty ? fallbackName : trimmedName,
      providerRawValue: provider.rawValue,
      apiURLString: aiAPIURLString,
      apiKey: aiAPIKey,
      model: model,
      systemPrompt: aiSystemPrompt,
      updatedAt: Date()
    )
  }

  @discardableResult
  func saveCurrentAIConfiguration(named name: String? = nil) -> AIConfiguration {
    var entry = currentAIConfiguration(named: name)
    var values = aiConfigurations
    if let index = values.firstIndex(where: { $0.id == entry.id }) {
      if String(name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        entry.name = values[index].name
      }
      values[index] = entry
    } else if let existingIndex = values.firstIndex(where: {
      $0.providerRawValue == entry.providerRawValue &&
        $0.apiURLString == entry.apiURLString &&
        $0.model == entry.model
    }) {
      entry.id = values[existingIndex].id
      if String(name ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        entry.name = values[existingIndex].name
      }
      values[existingIndex] = entry
    } else {
      values.insert(entry, at: 0)
    }
    selectedAIConfigurationID = entry.id
    aiConfigurations = Array(values.prefix(30))
    return entry
  }

  @discardableResult
  func saveAIConfiguration(_ configuration: AIConfiguration, select: Bool) -> AIConfiguration {
    var entry = configuration
    entry.updatedAt = Date()
    var values = aiConfigurations
    if let index = values.firstIndex(where: { $0.id == entry.id }) {
      values[index] = entry
    } else {
      values.insert(entry, at: 0)
    }
    aiConfigurations = Array(values.prefix(30))
    if select {
      applyAIConfiguration(entry)
    }
    return entry
  }

  func applyAIConfiguration(_ configuration: AIConfiguration) {
    aiProvider = configuration.provider
    aiAPIURLString = configuration.apiURLString
    aiAPIKey = configuration.apiKey
    aiModel = configuration.model
    aiSystemPrompt = configuration.systemPrompt
    selectedAIConfigurationID = configuration.id
  }

  func deleteAIConfiguration(id: String) {
    let remaining = aiConfigurations.filter { $0.id != id }
    aiConfigurations = remaining
    if selectedAIConfigurationID == id {
      if let next = remaining.first {
        applyAIConfiguration(next)
      } else {
        selectedAIConfigurationID = ""
      }
    }
  }

  func seedCurrentAIConfigurationIfNeeded() {
    guard aiConfigurations.isEmpty else { return }
    let hasLegacyValue = !aiAPIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
      !aiModel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
      !aiAPIURLString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    guard hasLegacyValue else { return }
    _ = saveCurrentAIConfiguration(named: aiProvider.title)
  }

  private func notifyUpdate() {
    NotificationCenter.default.post(name: .appSettingsDidChange, object: nil)
  }

  static let defaultAISystemPrompt = """
  你是军队内部历史地图编目助手。你只能返回 JSON，不要输出任何解释、Markdown 或代码块。
  请基于 OCR 文本、文件名和已有元数据，对地图进行编目整理，输出字段：
  title, description, year_label, campaign, teaching_use, teaching_note, security_level, scope_level, country_code, country_name, province, city, district, latitude, longitude, north_latitude, south_latitude, east_longitude, west_longitude, coverage_outline, tags。
  要求：
  1. 无法判断时返回空字符串或空数组，不要编造。
  2. latitude/longitude 是地图覆盖范围中心点；north_latitude/south_latitude/east_longitude/west_longitude 是图面覆盖外接框。若图上有经纬网，优先读取经纬网；否则按行政区大致边界估算。
  3. 经纬度用十进制度数字，东经/北纬为正，西经/南纬为负；无法判断时返回 null。
  4. coverage_outline 是缩略图上要画出的主体地图覆盖区轮廓，不是经纬度坐标。返回 3 到 12 个点的数组，每个点形如 {"x":0.12,"y":0.34}；坐标系为图像左上角 {"x":0,"y":0}、右下角 {"x":1,"y":1}。
  5. coverage_outline 点必须按顺时针或逆时针沿边界排列，优先贴合地图主体的行政边界、海岸线、图廓或覆盖区域边界；不要把 inset 小图当主体轮廓。
  6. 如果无法精确识别不规则轮廓，但能判断地图主体所在区域，必须返回包住主体地图的四点矩形作为保底，例如 [{"x":0.08,"y":0.12},{"x":0.92,"y":0.12},{"x":0.92,"y":0.88},{"x":0.08,"y":0.88}]；只有完全没有图像、OCR 和地名线索时才返回 []。
  7. scope_level 可取 world, country, province, city, district, region, unknown。
  8. tags 返回字符串数组，最多 8 个。
  9. 输出必须是单个合法 JSON 对象。
  """
}

extension Notification.Name {
  static let appSettingsDidChange = Notification.Name("roamly.mobile.settingsDidChange")
}
