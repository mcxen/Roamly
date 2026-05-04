import UIKit

struct RegionSelection {
  var country: String
  var province: String
  var city: String
  var district: String
}

final class RegionPickerSheetViewController: UIViewController, UIPickerViewDataSource, UIPickerViewDelegate, UITextFieldDelegate {
  private static let clearSelectionID = "__clear__"

  enum Level: Int, CaseIterable {
    case country
    case province
    case city
    case district

    var title: String {
      switch self {
      case .country:
        return "国家"
      case .province:
        return "省州"
      case .city:
        return "城市"
      case .district:
        return "区县"
      }
    }
  }

  private let regionCatalog: RegionCatalog
  private let onSave: (RegionSelection) -> Void

  private var selection: RegionSelection
  private var currentLevel: Level
  private var searchQuery = ""

  private let summaryLabel = UILabel()
  private let hintLabel = UILabel()
  private let segmentedControl = UISegmentedControl(items: Level.allCases.map(\.title))
  private let searchField = UITextField()
  private let pickerView = UIPickerView()

  init(
    title: String,
    regionCatalog: RegionCatalog,
    selection: RegionSelection,
    startingLevel: Level = .country,
    onSave: @escaping (RegionSelection) -> Void
  ) {
    self.regionCatalog = regionCatalog
    self.selection = selection
    self.currentLevel = startingLevel
    self.onSave = onSave
    super.init(nibName: nil, bundle: nil)
    self.title = title
    modalPresentationStyle = .pageSheet
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground
    navigationItem.leftBarButtonItem = UIBarButtonItem(
      barButtonSystemItem: .cancel,
      target: self,
      action: #selector(cancelSelection)
    )
    navigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "完成",
      style: .done,
      target: self,
      action: #selector(commitSelection)
    )

    summaryLabel.translatesAutoresizingMaskIntoConstraints = false
    summaryLabel.font = .systemFont(ofSize: 20, weight: .bold)
    summaryLabel.textColor = .label
    summaryLabel.numberOfLines = 2

    hintLabel.translatesAutoresizingMaskIntoConstraints = false
    hintLabel.font = .systemFont(ofSize: 13, weight: .medium)
    hintLabel.textColor = .secondaryLabel
    hintLabel.numberOfLines = 0
    hintLabel.text = "滚轮选择当前层级，切换上方迷你菜单可继续选下一级。"

    segmentedControl.translatesAutoresizingMaskIntoConstraints = false
    segmentedControl.selectedSegmentIndex = currentLevel.rawValue
    segmentedControl.addTarget(self, action: #selector(levelChanged), for: .valueChanged)

    searchField.translatesAutoresizingMaskIntoConstraints = false
    searchField.borderStyle = .roundedRect
    searchField.clearButtonMode = .whileEditing
    searchField.returnKeyType = .done
    searchField.autocorrectionType = .no
    searchField.autocapitalizationType = .none
    searchField.delegate = self
    searchField.addTarget(self, action: #selector(searchFieldChanged), for: .editingChanged)
    let iconView = UIImageView(image: UIImage(systemName: "magnifyingglass"))
    iconView.tintColor = .secondaryLabel
    searchField.leftView = iconView
    searchField.leftViewMode = .always

    pickerView.translatesAutoresizingMaskIntoConstraints = false
    pickerView.dataSource = self
    pickerView.delegate = self
    pickerView.backgroundColor = .secondarySystemGroupedBackground
    pickerView.layer.cornerRadius = 18
    pickerView.layer.cornerCurve = .continuous

    view.addSubview(summaryLabel)
    view.addSubview(hintLabel)
    view.addSubview(segmentedControl)
    view.addSubview(searchField)
    view.addSubview(pickerView)

    NSLayoutConstraint.activate([
      summaryLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
      summaryLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      summaryLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

      hintLabel.topAnchor.constraint(equalTo: summaryLabel.bottomAnchor, constant: 8),
      hintLabel.leadingAnchor.constraint(equalTo: summaryLabel.leadingAnchor),
      hintLabel.trailingAnchor.constraint(equalTo: summaryLabel.trailingAnchor),

      segmentedControl.topAnchor.constraint(equalTo: hintLabel.bottomAnchor, constant: 18),
      segmentedControl.leadingAnchor.constraint(equalTo: summaryLabel.leadingAnchor),
      segmentedControl.trailingAnchor.constraint(equalTo: summaryLabel.trailingAnchor),

      searchField.topAnchor.constraint(equalTo: segmentedControl.bottomAnchor, constant: 12),
      searchField.leadingAnchor.constraint(equalTo: summaryLabel.leadingAnchor),
      searchField.trailingAnchor.constraint(equalTo: summaryLabel.trailingAnchor),
      searchField.heightAnchor.constraint(equalToConstant: 36),

      pickerView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 12),
      pickerView.leadingAnchor.constraint(equalTo: summaryLabel.leadingAnchor),
      pickerView.trailingAnchor.constraint(equalTo: summaryLabel.trailingAnchor),
      pickerView.heightAnchor.constraint(equalToConstant: 220),
      pickerView.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20)
    ])

    preferredContentSize = CGSize(width: 540, height: 420)
    syncUI(animated: false)
  }

  func numberOfComponents(in pickerView: UIPickerView) -> Int { 1 }

  func pickerView(_ pickerView: UIPickerView, numberOfRowsInComponent component: Int) -> Int {
    max(displayedOptions.count, 1)
  }

  func pickerView(_ pickerView: UIPickerView, rowHeightForComponent component: Int) -> CGFloat {
    40
  }

  func pickerView(_ pickerView: UIPickerView, widthForComponent component: Int) -> CGFloat {
    pickerView.bounds.width - 24
  }

  func pickerView(_ pickerView: UIPickerView, attributedTitleForRow row: Int, forComponent component: Int) -> NSAttributedString? {
    let title = displayedOptions.isEmpty ? emptyStateText : displayedOptions[row].title
    return NSAttributedString(
      string: title,
      attributes: [
        .font: UIFont.systemFont(ofSize: 19, weight: .semibold),
        .foregroundColor: UIColor.label
      ]
    )
  }

  func pickerView(_ pickerView: UIPickerView, didSelectRow row: Int, inComponent component: Int) {
    guard !displayedOptions.isEmpty, displayedOptions.indices.contains(row) else { return }
    applySelection(displayedOptions[row])
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    guard textField === searchField else { return true }
    textField.resignFirstResponder()
    if let first = displayedOptions.first {
      applySelection(first)
    }
    return true
  }

  private func applySelection(_ option: SelectionOption) {
    if option.id == Self.clearSelectionID {
      switch currentLevel {
      case .country:
        break
      case .province:
        selection.province = ""
        selection.city = ""
        selection.district = ""
      case .city:
        selection.city = ""
        selection.district = ""
      case .district:
        selection.district = ""
      }
      searchQuery = ""
      searchField.text = ""
      Haptics.shared.selectionChanged()
      syncUI(animated: false)
      return
    }

    switch currentLevel {
    case .country:
      selection.country = option.title
      selection.province = ""
      selection.city = ""
      selection.district = ""
    case .province:
      selection.province = option.title
      selection.city = ""
      selection.district = ""
    case .city:
      selection.city = option.title
      selection.district = ""
    case .district:
      selection.district = option.title
    }

    searchQuery = ""
    searchField.text = ""
    Haptics.shared.selectionChanged()
    moveToNextAvailableLevelIfNeeded()
    syncUI(animated: false)
  }

  private var levelOptions: [SelectionOption] {
    let base: [SelectionOption]
    switch currentLevel {
    case .country:
      base = regionCatalog.countryOptions()
    case .province:
      base = regionCatalog.provinceOptions(forCountryName: selection.country)
    case .city:
      base = regionCatalog.cityOptions(forCountryName: selection.country, province: selection.province)
    case .district:
      base = regionCatalog.districtOptions(
        forCountryName: selection.country,
        province: selection.province,
        city: selection.city
      )
    }

    guard let clearOption = clearOptionForCurrentLevel else {
      return base
    }
    return [clearOption] + base
  }

  private var clearOptionForCurrentLevel: SelectionOption? {
    switch currentLevel {
    case .country:
      return nil
    case .province:
      return SelectionOption(
        id: Self.clearSelectionID,
        title: "不填写省/州（仅国家）",
        subtitle: nil,
        searchTokens: ["不填写", "仅国家", "clear"]
      )
    case .city:
      return SelectionOption(
        id: Self.clearSelectionID,
        title: "不填写城市（到省/州）",
        subtitle: nil,
        searchTokens: ["不填写", "到省州", "clear"]
      )
    case .district:
      return SelectionOption(
        id: Self.clearSelectionID,
        title: "不填写区县（到城市）",
        subtitle: nil,
        searchTokens: ["不填写", "到城市", "clear"]
      )
    }
  }

  private var displayedOptions: [SelectionOption] {
    let normalizedQuery = normalizeSearchText(searchQuery)
    guard !normalizedQuery.isEmpty else { return levelOptions }
    return levelOptions.filter { option in
      let tokens = [option.title, option.subtitle].compactMap { $0 } + option.searchTokens
      return tokens.contains(where: { normalizeSearchText($0).contains(normalizedQuery) })
    }
  }

  private var emptyStateText: String {
    switch currentLevel {
    case .country:
      return "暂无国家数据"
    case .province:
      return selection.country.isEmpty ? "请先选择国家" : "当前国家没有省州数据"
    case .city:
      return selection.province.isEmpty ? "请先选择省州" : "当前没有城市数据"
    case .district:
      return selection.city.isEmpty ? "请先选择城市" : "当前没有区县数据"
    }
  }

  private func syncUI(animated: Bool) {
    syncSegmentAvailability()
    segmentedControl.selectedSegmentIndex = currentLevel.rawValue
    searchField.placeholder = "输入\(currentLevel.title)快速匹配"
    pickerView.reloadAllComponents()
    alignPickerSelection(animated: animated)
    updateSummary()
  }

  private func syncSegmentAvailability() {
    segmentedControl.setEnabled(true, forSegmentAt: Level.country.rawValue)
    segmentedControl.setEnabled(!selection.country.isEmpty, forSegmentAt: Level.province.rawValue)
    segmentedControl.setEnabled(!selection.country.isEmpty && !selection.province.isEmpty, forSegmentAt: Level.city.rawValue)
    segmentedControl.setEnabled(!selection.country.isEmpty && !selection.province.isEmpty && !selection.city.isEmpty, forSegmentAt: Level.district.rawValue)

    if !segmentedControl.isEnabledForSegment(at: currentLevel.rawValue) {
      currentLevel = highestEnabledLevel()
    }
  }

  private func highestEnabledLevel() -> Level {
    if !selection.country.isEmpty && !selection.province.isEmpty && !selection.city.isEmpty {
      return .district
    }
    if !selection.country.isEmpty && !selection.province.isEmpty {
      return .city
    }
    if !selection.country.isEmpty {
      return .province
    }
    return .country
  }

  private func alignPickerSelection(animated: Bool) {
    guard !displayedOptions.isEmpty else { return }
    let selectedValue: String = {
      switch currentLevel {
      case .country: return selection.country
      case .province: return selection.province
      case .city: return selection.city
      case .district: return selection.district
      }
    }()

    let targetRow = displayedOptions.firstIndex(where: { $0.title == selectedValue }) ?? 0
    pickerView.selectRow(targetRow, inComponent: 0, animated: animated)
  }

  private func updateSummary() {
    let path = [selection.country, selection.province, selection.city, selection.district]
      .filter { !$0.isEmpty }
    summaryLabel.text = path.isEmpty ? "未选择地区" : path.joined(separator: " / ")
  }

  private func moveToNextAvailableLevelIfNeeded() {
    switch currentLevel {
    case .country:
      if !regionCatalog.provinceOptions(forCountryName: selection.country).isEmpty {
        currentLevel = .province
      }
    case .province:
      if !regionCatalog.cityOptions(forCountryName: selection.country, province: selection.province).isEmpty {
        currentLevel = .city
      }
    case .city:
      if !regionCatalog.districtOptions(
        forCountryName: selection.country,
        province: selection.province,
        city: selection.city
      ).isEmpty {
        currentLevel = .district
      }
    case .district:
      break
    }
  }

  @objc private func levelChanged() {
    guard let level = Level(rawValue: segmentedControl.selectedSegmentIndex) else { return }
    currentLevel = level
    searchQuery = ""
    searchField.text = ""
    Haptics.shared.selectionChanged()
    syncUI(animated: false)
  }

  @objc private func searchFieldChanged() {
    searchQuery = searchField.text ?? ""
    pickerView.reloadAllComponents()
    alignPickerSelection(animated: false)
  }

  private func normalizeSearchText(_ value: String?) -> String {
    String(value ?? "")
      .lowercased()
      .replacingOccurrences(of: " ", with: "")
      .replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  @objc private func cancelSelection() {
    dismiss(animated: true)
  }

  @objc private func commitSelection() {
    onSave(selection)
    dismiss(animated: true)
  }
}
