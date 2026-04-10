import UIKit

final class SelectionListViewController: UIViewController, UITableViewDataSource, UITableViewDelegate, UISearchResultsUpdating {
  private let options: [SelectionOption]
  private var filtered: [SelectionOption]
  private let onSelect: (SelectionOption) -> Void
  private let dismissOnSelection: Bool

  private let tableView = UITableView(frame: .zero, style: .insetGrouped)
  private let searchController = UISearchController(searchResultsController: nil)
  private let emptyLabel = UILabel()

  init(
    title: String,
    options: [SelectionOption],
    dismissOnSelection: Bool = true,
    onSelect: @escaping (SelectionOption) -> Void
  ) {
    self.options = options
    self.filtered = options
    self.dismissOnSelection = dismissOnSelection
    self.onSelect = onSelect
    super.init(nibName: nil, bundle: nil)
    self.title = title
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemGroupedBackground

    navigationItem.searchController = searchController
    navigationItem.hidesSearchBarWhenScrolling = false
    searchController.obscuresBackgroundDuringPresentation = false
    searchController.searchResultsUpdater = self
    searchController.searchBar.placeholder = "搜索"

    tableView.translatesAutoresizingMaskIntoConstraints = false
    tableView.dataSource = self
    tableView.delegate = self
    tableView.register(UITableViewCell.self, forCellReuseIdentifier: "SelectionCell")
    tableView.backgroundColor = .systemGroupedBackground

    emptyLabel.font = .systemFont(ofSize: 14, weight: .medium)
    emptyLabel.textColor = .secondaryLabel
    emptyLabel.textAlignment = .center
    emptyLabel.numberOfLines = 0
    emptyLabel.text = "没有匹配结果"

    view.addSubview(tableView)
    NSLayoutConstraint.activate([
      tableView.topAnchor.constraint(equalTo: view.topAnchor),
      tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
  }

  func updateSearchResults(for searchController: UISearchController) {
    let keyword = normalizedSearchText(searchController.searchBar.text)

    guard !keyword.isEmpty else {
      filtered = options
      updateEmptyState()
      tableView.reloadData()
      return
    }

    filtered = options.filter { option in
      searchableText(for: option).contains(keyword)
    }
    updateEmptyState()
    tableView.reloadData()
  }

  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
    filtered.count
  }

  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "SelectionCell", for: indexPath)
    var content = cell.defaultContentConfiguration()
    let option = filtered[indexPath.row]
    content.text = option.title
    content.secondaryText = option.subtitle
    content.prefersSideBySideTextAndSecondaryText = false
    cell.contentConfiguration = content
    cell.accessoryType = dismissOnSelection ? .disclosureIndicator : .none
    return cell
  }

  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let option = filtered[indexPath.row]
    Haptics.shared.selectionChanged()
    tableView.deselectRow(at: indexPath, animated: true)
    if dismissOnSelection {
      dismiss(animated: true) {
        self.onSelect(option)
      }
    } else {
      onSelect(option)
    }
  }

  private func updateEmptyState() {
    tableView.backgroundView = filtered.isEmpty ? emptyLabel : nil
  }

  private func searchableText(for option: SelectionOption) -> String {
    let parts = [option.title, option.subtitle].compactMap { $0 } + option.searchTokens
    return normalizedSearchText(parts.joined(separator: " "))
  }

  private func normalizedSearchText(_ value: String?) -> String {
    String(value ?? "")
      .lowercased()
      .replacingOccurrences(of: " ", with: "")
      .replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
