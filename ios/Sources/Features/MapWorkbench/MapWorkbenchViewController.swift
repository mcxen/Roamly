import MapKit
import UIKit

final class MapWorkbenchViewController: UIViewController, MKMapViewDelegate {
  private enum WorkbenchFilter: Int, CaseIterable {
    case pending
    case located
    case pendingOCR
    case favorite

    var title: String {
      switch self {
      case .pending: return "待整"
      case .located: return "已定位"
      case .pendingOCR: return "待OCR"
      case .favorite: return "收藏"
      }
    }
  }

  private enum WorkbenchFacet: Int, CaseIterable {
    case coverage
    case reliable
    case authorization
    case wgs84

    var title: String {
      switch self {
      case .coverage: return "覆盖"
      case .reliable: return "可信"
      case .authorization: return "授权"
      case .wgs84: return "WGS84"
      }
    }
  }

  private let container: AppContainer
  private var records: [MapRecord] = []
  private var queueRecords: [MapRecord] = []
  private var selectedFilter: WorkbenchFilter = .pending
  private var selectedFacet: WorkbenchFacet = .coverage
  private var isWorkbenchCollapsed = false
  private var chipButtons: [FilterChipButton] = []
  private var facetButtons: [FilterChipButton] = []
  private var collapsibleWorkbenchViews: [UIView] = []

  private let mapView = MKMapView()
  private let searchCard = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
  private let searchTitleLabel = UILabel()
  private let searchSubtitleLabel = UILabel()
  private let chipStack = UIStackView()
  private let zoomStack = UIStackView()
  private let toolStack = UIStackView()
  private let workbenchPanel = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
  private let metricStack = UIStackView()
  private let filterStack = UIStackView()
  private let queueStack = UIStackView()
  private let dataGrid = UIStackView()
  private let progressBar = UIProgressView(progressViewStyle: .bar)
  private let progressLabel = UILabel()
  private let progressCard = UIView()
  private let collapseButton = UIButton(type: .system)
  private let syncBadge = UILabel()

  init(container: AppContainer) {
    self.container = container
    super.init(nibName: nil, bundle: nil)
    title = "地图"
    tabBarItem.title = "地图"
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.90, green: 0.94, blue: 0.92, alpha: 1)
    navigationItem.largeTitleDisplayMode = .never
    navigationController?.setNavigationBarHidden(true, animated: false)
    configureMapView()
    configureLayout()
    reloadData()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
    reloadData()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    navigationController?.setNavigationBarHidden(false, animated: animated)
  }

  private func configureLayout() {
    [mapView, searchCard, chipStack, zoomStack, toolStack, workbenchPanel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
    }

    view.addSubview(mapView)
    view.addSubview(searchCard)
    view.addSubview(chipStack)
    view.addSubview(zoomStack)
    view.addSubview(toolStack)
    view.addSubview(workbenchPanel)

    configureSearchCard()
    configureChips()
    configureMapControls()
    configureWorkbenchPanel()

    NSLayoutConstraint.activate([
      mapView.topAnchor.constraint(equalTo: view.topAnchor),
      mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

      searchCard.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
      searchCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
      searchCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
      searchCard.heightAnchor.constraint(equalToConstant: 48),

      chipStack.topAnchor.constraint(equalTo: searchCard.bottomAnchor, constant: 8),
      chipStack.leadingAnchor.constraint(equalTo: searchCard.leadingAnchor),
      chipStack.trailingAnchor.constraint(lessThanOrEqualTo: searchCard.trailingAnchor),
      chipStack.heightAnchor.constraint(equalToConstant: 30),

      zoomStack.topAnchor.constraint(equalTo: chipStack.bottomAnchor, constant: 24),
      zoomStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      zoomStack.widthAnchor.constraint(equalToConstant: 38),

      toolStack.topAnchor.constraint(equalTo: chipStack.bottomAnchor, constant: 24),
      toolStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
      toolStack.widthAnchor.constraint(equalToConstant: 42),

      workbenchPanel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
      workbenchPanel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
      workbenchPanel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10)
    ])
  }

  private func configureMapView() {
    mapView.delegate = self
    mapView.mapType = .mutedStandard
    mapView.pointOfInterestFilter = .excludingAll
    mapView.showsCompass = false
    mapView.showsScale = true
    mapView.isRotateEnabled = false
    updateMapLayoutMargins()
    mapView.setRegion(
      MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 35.8617, longitude: 104.1954),
        span: MKCoordinateSpan(latitudeDelta: 28, longitudeDelta: 38)
      ),
      animated: false
    )
  }

  private func configureSearchCard() {
    searchCard.layer.cornerRadius = 18
    searchCard.layer.cornerCurve = .continuous
    searchCard.clipsToBounds = true
    searchCard.layer.borderWidth = 1
    searchCard.layer.borderColor = UIColor.separator.withAlphaComponent(0.16).cgColor

    let iconView = IconBadgeView(symbol: "globe.asia.australia", tint: .label, background: .tertiarySystemGroupedBackground)

    searchTitleLabel.font = .systemFont(ofSize: 17, weight: .bold)
    searchTitleLabel.textColor = .label
    searchTitleLabel.text = "自由地图库"
    searchSubtitleLabel.font = .systemFont(ofSize: 10, weight: .medium)
    searchSubtitleLabel.textColor = .secondaryLabel
    searchSubtitleLabel.text = "全球 213 区域 · 16 来源 · 离线 42.8GB"

    let labelStack = UIStackView(arrangedSubviews: [searchTitleLabel, searchSubtitleLabel])
    labelStack.axis = .vertical
    labelStack.spacing = 1

    let content = UIStackView(arrangedSubviews: [iconView, labelStack])
    content.translatesAutoresizingMaskIntoConstraints = false
    content.axis = .horizontal
    content.alignment = .center
    content.spacing = 9
    searchCard.contentView.addSubview(content)

    NSLayoutConstraint.activate([
      iconView.widthAnchor.constraint(equalToConstant: 30),
      iconView.heightAnchor.constraint(equalToConstant: 30),
      content.topAnchor.constraint(equalTo: searchCard.contentView.topAnchor, constant: 8),
      content.leadingAnchor.constraint(equalTo: searchCard.contentView.leadingAnchor, constant: 10),
      content.trailingAnchor.constraint(equalTo: searchCard.contentView.trailingAnchor, constant: -10),
      content.bottomAnchor.constraint(equalTo: searchCard.contentView.bottomAnchor, constant: -8)
    ])
  }

  private func configureChips() {
    chipStack.axis = .horizontal
    chipStack.alignment = .fill
    chipStack.spacing = 6
    WorkbenchFilter.allCases.forEach { filter in
      let button = FilterChipButton(title: filter.title, selected: filter == selectedFilter)
      button.tag = filter.rawValue
      button.addTarget(self, action: #selector(filterTapped(_:)), for: .touchUpInside)
      chipButtons.append(button)
      chipStack.addArrangedSubview(button)
    }
  }

  private func configureMapControls() {
    zoomStack.axis = .vertical
    zoomStack.spacing = 7
    let zoomIn = MapToolButton(symbol: "plus")
    zoomIn.addTarget(self, action: #selector(zoomInMap), for: .touchUpInside)
    let zoomOut = MapToolButton(symbol: "minus")
    zoomOut.addTarget(self, action: #selector(zoomOutMap), for: .touchUpInside)
    zoomStack.addArrangedSubview(zoomIn)
    zoomStack.addArrangedSubview(zoomOut)

    toolStack.axis = .vertical
    toolStack.spacing = 8
    let center = MapToolButton(symbol: "scope")
    center.addTarget(self, action: #selector(centerMap), for: .touchUpInside)
    let layer = MapToolButton(symbol: "square.2.layers.3d")
    layer.addTarget(self, action: #selector(toggleMapType), for: .touchUpInside)
    [center, layer].forEach { toolStack.addArrangedSubview($0) }
  }

  private func configureWorkbenchPanel() {
    workbenchPanel.layer.cornerRadius = 24
    workbenchPanel.layer.cornerCurve = .continuous
    workbenchPanel.clipsToBounds = true
    workbenchPanel.layer.borderWidth = 1
    workbenchPanel.layer.borderColor = UIColor.separator.withAlphaComponent(0.16).cgColor
    searchCard.contentView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(openLibraryFromWorkbench)))

    let grabber = UIView()
    grabber.translatesAutoresizingMaskIntoConstraints = false
    grabber.backgroundColor = .tertiaryLabel
    grabber.layer.cornerRadius = 2.5
    grabber.isUserInteractionEnabled = true
    grabber.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(toggleWorkbenchCollapsed)))

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
    titleLabel.text = "收集整理台"
    titleLabel.textColor = .label

    let subtitleLabel = UILabel()
    subtitleLabel.font = .systemFont(ofSize: 10, weight: .medium)
    subtitleLabel.textColor = .secondaryLabel
    subtitleLabel.text = "按覆盖、来源、版权、坐标系与清晰度聚合"
    subtitleLabel.adjustsFontSizeToFitWidth = true
    subtitleLabel.minimumScaleFactor = 0.85

    let titleStack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
    titleStack.axis = .vertical
    titleStack.spacing = 2

    syncBadge.font = .systemFont(ofSize: 10, weight: .bold)
    syncBadge.textAlignment = .center
    syncBadge.textColor = UIColor(red: 0.05, green: 0.37, blue: 0.28, alpha: 1)
    syncBadge.backgroundColor = UIColor(red: 0.84, green: 0.94, blue: 0.89, alpha: 1)
    syncBadge.layer.cornerRadius = 11
    syncBadge.layer.cornerCurve = .continuous
    syncBadge.clipsToBounds = true
    syncBadge.text = "同步中"

    var collapseConfig = UIButton.Configuration.filled()
    collapseConfig.image = UIImage(systemName: "chevron.down")
    collapseConfig.baseBackgroundColor = .tertiarySystemGroupedBackground
    collapseConfig.baseForegroundColor = .label
    collapseConfig.cornerStyle = .large
    collapseButton.configuration = collapseConfig
    collapseButton.accessibilityLabel = "收起地图工作台"
    collapseButton.addTarget(self, action: #selector(toggleWorkbenchCollapsed), for: .touchUpInside)

    let header = UIStackView(arrangedSubviews: [titleStack, syncBadge, collapseButton])
    header.translatesAutoresizingMaskIntoConstraints = false
    header.axis = .horizontal
    header.alignment = .center
    header.spacing = 8

    metricStack.axis = .horizontal
    metricStack.distribution = .fillEqually
    metricStack.spacing = 1
    metricStack.backgroundColor = UIColor.separator.withAlphaComponent(0.12)
    metricStack.layer.cornerRadius = 10
    metricStack.layer.cornerCurve = .continuous
    metricStack.clipsToBounds = true

    filterStack.axis = .horizontal
    filterStack.distribution = .fillEqually
    filterStack.spacing = 5
    WorkbenchFacet.allCases.forEach { facet in
      let button = FilterChipButton(title: facet.title, selected: facet == selectedFacet, compact: true)
      button.tag = facet.rawValue
      button.addTarget(self, action: #selector(facetTapped(_:)), for: .touchUpInside)
      facetButtons.append(button)
      filterStack.addArrangedSubview(button)
    }

    queueStack.axis = .vertical
    queueStack.spacing = 6

    dataGrid.axis = .vertical
    dataGrid.spacing = 6

    progressLabel.font = .systemFont(ofSize: 10, weight: .bold)
    progressLabel.textColor = .white
    progressLabel.numberOfLines = 1
    progressLabel.adjustsFontSizeToFitWidth = true
    progressLabel.minimumScaleFactor = 0.75
    progressLabel.text = "校准完成 66%"
    progressBar.progress = 0.66
    progressBar.progressTintColor = UIColor(red: 0.44, green: 0.82, blue: 0.65, alpha: 1)
    progressBar.trackTintColor = UIColor.white.withAlphaComponent(0.20)
    progressCard.translatesAutoresizingMaskIntoConstraints = false
    progressCard.backgroundColor = UIColor(red: 0.07, green: 0.16, blue: 0.20, alpha: 1)
    progressCard.layer.cornerRadius = 12
    progressCard.layer.cornerCurve = .continuous
    progressCard.isUserInteractionEnabled = true
    progressCard.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(openOrganizeFromWorkbench)))

    let progressStack = UIStackView(arrangedSubviews: [progressLabel, progressBar])
    progressStack.translatesAutoresizingMaskIntoConstraints = false
    progressStack.axis = .vertical
    progressStack.spacing = 6
    progressCard.addSubview(progressStack)

    let rightTitle = UILabel()
    rightTitle.font = .systemFont(ofSize: 11, weight: .bold)
    rightTitle.text = "数据域"
    let sourceBadge = UILabel()
    sourceBadge.font = .systemFont(ofSize: 9, weight: .bold)
    sourceBadge.textColor = .secondaryLabel
    sourceBadge.textAlignment = .center
    sourceBadge.text = "16源"
    sourceBadge.backgroundColor = .tertiarySystemGroupedBackground
    sourceBadge.layer.cornerRadius = 8
    sourceBadge.clipsToBounds = true

    let rightHeader = UIStackView(arrangedSubviews: [rightTitle, sourceBadge])
    rightHeader.axis = .horizontal
    rightHeader.alignment = .center
    rightHeader.distribution = .equalSpacing

    let dataColumn = UIStackView(arrangedSubviews: [rightHeader, dataGrid, progressCard])
    dataColumn.axis = .vertical
    dataColumn.spacing = 7
    dataColumn.widthAnchor.constraint(equalToConstant: 110).isActive = true

    let leftColumn = UIStackView(arrangedSubviews: [filterStack, queueStack])
    leftColumn.axis = .vertical
    leftColumn.spacing = 6

    let body = UIStackView(arrangedSubviews: [leftColumn, dataColumn])
    body.translatesAutoresizingMaskIntoConstraints = false
    body.axis = .horizontal
    body.alignment = .fill
    body.spacing = 8

    let content = UIStackView(arrangedSubviews: [grabber, header, metricStack, body])
    content.translatesAutoresizingMaskIntoConstraints = false
    content.axis = .vertical
    content.spacing = 8
    workbenchPanel.contentView.addSubview(content)
    collapsibleWorkbenchViews = [metricStack, body]

    NSLayoutConstraint.activate([
      grabber.widthAnchor.constraint(equalToConstant: 42),
      grabber.heightAnchor.constraint(equalToConstant: 5),
      grabber.centerXAnchor.constraint(equalTo: content.centerXAnchor),
      syncBadge.widthAnchor.constraint(equalToConstant: 50),
      syncBadge.heightAnchor.constraint(equalToConstant: 28),
      collapseButton.widthAnchor.constraint(equalToConstant: 38),
      collapseButton.heightAnchor.constraint(equalToConstant: 38),
      metricStack.heightAnchor.constraint(equalToConstant: 51),
      filterStack.heightAnchor.constraint(equalToConstant: 30),
      dataGrid.heightAnchor.constraint(equalToConstant: 101),
      body.heightAnchor.constraint(greaterThanOrEqualToConstant: 168),
      sourceBadge.widthAnchor.constraint(equalToConstant: 34),
      progressCard.heightAnchor.constraint(equalToConstant: 38),
      progressStack.leadingAnchor.constraint(equalTo: progressCard.leadingAnchor, constant: 7),
      progressStack.trailingAnchor.constraint(equalTo: progressCard.trailingAnchor, constant: -7),
      progressStack.centerYAnchor.constraint(equalTo: progressCard.centerYAnchor),
      progressBar.heightAnchor.constraint(equalToConstant: 5),
      content.topAnchor.constraint(equalTo: workbenchPanel.contentView.topAnchor, constant: 8),
      content.leadingAnchor.constraint(equalTo: workbenchPanel.contentView.leadingAnchor, constant: 10),
      content.trailingAnchor.constraint(equalTo: workbenchPanel.contentView.trailingAnchor, constant: -10),
      content.bottomAnchor.constraint(equalTo: workbenchPanel.contentView.bottomAnchor, constant: -10)
    ])
  }

  @objc private func toggleWorkbenchCollapsed() {
    setWorkbenchCollapsed(!isWorkbenchCollapsed, animated: true)
  }

  private func setWorkbenchCollapsed(_ collapsed: Bool, animated: Bool) {
    guard collapsed != isWorkbenchCollapsed else { return }
    isWorkbenchCollapsed = collapsed
    container.haptics.selectionChanged()
    updateWorkbenchCollapseState(animated: animated)
  }

  private func updateWorkbenchCollapseState(animated: Bool) {
    let changes = {
      self.collapsibleWorkbenchViews.forEach { $0.isHidden = self.isWorkbenchCollapsed }
      self.updateCollapseButton()
      self.updateMapLayoutMargins()
      self.view.layoutIfNeeded()
    }
    if animated {
      UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseInOut, .allowUserInteraction], animations: changes) { _ in
        self.fitAnnotationsIfNeededAfterPanelChange()
      }
    } else {
      changes()
      fitAnnotationsIfNeededAfterPanelChange()
    }
  }

  private func updateCollapseButton() {
    var config = collapseButton.configuration ?? UIButton.Configuration.filled()
    config.image = UIImage(systemName: isWorkbenchCollapsed ? "chevron.up" : "chevron.down")
    collapseButton.configuration = config
    collapseButton.accessibilityLabel = isWorkbenchCollapsed ? "展开地图工作台" : "收起地图工作台"
  }

  private func updateMapLayoutMargins() {
    mapView.layoutMargins = UIEdgeInsets(top: 0, left: 0, bottom: isWorkbenchCollapsed ? 82 : 260, right: 0)
  }

  private func fitAnnotationsIfNeededAfterPanelChange() {
    guard !mapView.annotations.isEmpty || !mapView.overlays.isEmpty else { return }
    fitAnnotations(animated: true)
  }

  private func reloadData() {
    records = container.store.loadRecords()
    queueRecords = facetedRecords(from: filteredRecords()).sorted(by: prioritySort).prefix(3).map { $0 }
    updateMetrics()
    updateChips()
    updateFacets()
    updateQueue()
    updateDataGrid()
    updateMapAnnotations()
  }

  private func updateMetrics() {
    metricStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let total = records.count
    let located = records.filter { $0.latitude != nil || hasRegion($0) }.count
    let pendingOCR = records.filter(isOCRMissing).count
    let conflicts = records.filter { isLocationMissing($0) && isYearMissing($0) }.count
    let locatedPercent = total == 0 ? 0 : Int((Double(located) / Double(total) * 100).rounded())

    let metricItems = [
      ("\(compact(total))", "地图条目"),
      ("\(locatedPercent)%", "已定位"),
      ("\(pendingOCR)", "待 OCR"),
      ("\(conflicts)", "冲突集")
    ]
    metricItems.enumerated().forEach { index, item in
      let tile = MetricTileView(value: item.0, label: item.1)
      tile.tag = index
      tile.addTarget(self, action: #selector(metricTapped(_:)), for: .touchUpInside)
      metricStack.addArrangedSubview(tile)
    }
  }

  private func updateChips() {
    let counts: [WorkbenchFilter: Int] = [
      .pending: records.filter(priorityRecord).count,
      .located: records.filter { !isLocationMissing($0) }.count,
      .pendingOCR: records.filter(isOCRMissing).count,
      .favorite: records.filter(\.favorite).count
    ]
    for button in chipButtons {
      guard let filter = WorkbenchFilter(rawValue: button.tag) else { continue }
      button.setSelected(filter == selectedFilter)
      button.updateTitle("\(filter.title) \(counts[filter] ?? 0)")
    }
  }

  private func updateFacets() {
    let base = filteredRecords()
    for button in facetButtons {
      guard let facet = WorkbenchFacet(rawValue: button.tag) else { continue }
      button.setSelected(facet == selectedFacet)
      let count = facetedRecords(from: base, facet: facet).count
      button.updateTitle("\(facet.title) \(count)")
    }
  }

  private func updateQueue() {
    queueStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    if queueRecords.isEmpty {
      queueStack.addArrangedSubview(QueueRowView(title: "暂无匹配地图", subtitle: "切换上方筛选，或到图库导入/整理地图元数据", badge: "空", priority: false))
      let spacer = UIView()
      spacer.setContentHuggingPriority(.defaultLow, for: .vertical)
      queueStack.addArrangedSubview(spacer)
      return
    }

    for record in queueRecords {
      let row = QueueRowView(
        title: record.title,
        subtitle: queueSubtitle(for: record),
        badge: queueBadge(for: record),
        priority: priorityScore(for: record) >= 5
      )
      row.addAction(UIAction { [weak self, weak row] _ in
        guard let self, let row, let index = self.queueStack.arrangedSubviews.firstIndex(of: row), self.queueRecords.indices.contains(index) else { return }
        self.openDetail(for: self.queueRecords[index])
      }, for: .touchUpInside)
      queueStack.addArrangedSubview(row)
    }
  }

  private func updateDataGrid() {
    dataGrid.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let countries = Set(records.compactMap(\.countryName).filter { !$0.isEmpty }).count
    let regions = Set(records.flatMap { [$0.province, $0.city, $0.district].compactMap { $0 }.filter { !$0.isEmpty } }).count
    let localBytes = records.compactMap(\.sizeBytes).reduce(0, +)
    let gb = max(Int((Double(localBytes) / 1_073_741_824).rounded()), records.isEmpty ? 0 : 1)
    let calibrationProgress = records.isEmpty ? 0 : Double(records.filter { !isLocationMissing($0) && !isOCRMissing($0) }.count) / Double(records.count)
    progressLabel.text = records.isEmpty ? "等待导入" : "校准完成 \(Int((calibrationProgress * 100).rounded()))%"
    progressBar.progress = Float(calibrationProgress)

    let countryTile = DataTileView(value: "\(max(countries, records.isEmpty ? 0 : 1))", label: "国家")
    countryTile.addTarget(self, action: #selector(openLibraryFromWorkbench), for: .touchUpInside)
    let regionTile = DataTileView(value: "\(max(regions, records.isEmpty ? 0 : 1))", label: "区域")
    regionTile.addTarget(self, action: #selector(selectLocatedFromDataTile), for: .touchUpInside)
    let coordinateTile = DataTileView(value: "9", label: "坐标系")
    coordinateTile.addTarget(self, action: #selector(selectWGS84FromDataTile), for: .touchUpInside)
    let offlineTile = DataTileView(value: records.isEmpty ? "0G" : "\(gb)G", label: "离线包")
    offlineTile.addTarget(self, action: #selector(openLibraryFromWorkbench), for: .touchUpInside)

    let row1 = UIStackView(arrangedSubviews: [countryTile, regionTile])
    let row2 = UIStackView(arrangedSubviews: [coordinateTile, offlineTile])
    [row1, row2].forEach {
      $0.axis = .horizontal
      $0.distribution = .fillEqually
      $0.spacing = 5
      dataGrid.addArrangedSubview($0)
    }
  }

  private func updateMapAnnotations() {
    mapView.removeAnnotations(mapView.annotations)
    mapView.removeOverlays(mapView.overlays)
    let visibleMapRecords = filteredRecords()
    let annotations = visibleMapRecords.compactMap { record -> MapRecordAnnotation? in
      guard let center = coverageCenter(for: record) else { return nil }
      if let polygon = coveragePolygon(for: record) {
        mapView.addOverlay(polygon)
        return MapRecordAnnotation(record: record, coordinate: center, representsCoverageArea: true)
      }
      return MapRecordAnnotation(record: record, coordinate: center, representsCoverageArea: false)
    }
    mapView.addAnnotations(annotations)
    if annotations.isEmpty {
      resetMapRegion(animated: false)
    } else {
      fitAnnotations(animated: false)
    }
  }

  private func filteredRecords() -> [MapRecord] {
    switch selectedFilter {
    case .pending:
      return records.filter(priorityRecord)
    case .located:
      return records.filter { !isLocationMissing($0) }
    case .pendingOCR:
      return records.filter(isOCRMissing)
    case .favorite:
      return records.filter(\.favorite)
    }
  }

  private func facetedRecords(from source: [MapRecord], facet: WorkbenchFacet? = nil) -> [MapRecord] {
    let facet = facet ?? selectedFacet
    switch facet {
    case .coverage:
      return source.filter { isLocationMissing($0) || ($0.coverageOutline?.count ?? 0) < 3 }
    case .reliable:
      return source.filter { isOCRMissing($0) || String($0.description).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    case .authorization:
      return source.filter { String($0.securityLevel ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    case .wgs84:
      return source.filter { coverageBounds(for: $0) == nil || $0.latitude == nil || $0.longitude == nil }
    }
  }

  private func queueSubtitle(for record: MapRecord) -> String {
    var parts: [String] = []
    if isLocationMissing(record) { parts.append("缺地区") }
    if isYearMissing(record) { parts.append("缺年代") }
    if isOCRMissing(record) { parts.append("待 OCR") }
    if parts.isEmpty { parts.append(record.subtitleText) }
    if let source = record.source, !source.isEmpty { parts.append(source) }
    return parts.prefix(2).joined(separator: " · ")
  }

  private func queueBadge(for record: MapRecord) -> String {
    if isLocationMissing(record) { return "定位" }
    if isOCRMissing(record) { return "OCR" }
    if isYearMissing(record) { return "年代" }
    return "复核"
  }

  private func prioritySort(lhs: MapRecord, rhs: MapRecord) -> Bool {
    let lhsScore = priorityScore(for: lhs)
    let rhsScore = priorityScore(for: rhs)
    if lhsScore != rhsScore { return lhsScore > rhsScore }
    return lhs.importedAt > rhs.importedAt
  }

  private func priorityRecord(_ record: MapRecord) -> Bool {
    priorityScore(for: record) > 0
  }

  private func priorityScore(for record: MapRecord) -> Int {
    var score = 0
    if isLocationMissing(record) { score += 4 }
    if isYearMissing(record) { score += 2 }
    if isOCRMissing(record) { score += 1 }
    return score
  }

  private func hasRegion(_ record: MapRecord) -> Bool {
    if coverageBounds(for: record) != nil {
      return true
    }
    return ![record.countryName, record.province, record.city, record.district]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .isEmpty
  }

  private func isLocationMissing(_ record: MapRecord) -> Bool {
    !hasRegion(record)
  }

  private func isYearMissing(_ record: MapRecord) -> Bool {
    String(record.yearLabel ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private func isOCRMissing(_ record: MapRecord) -> Bool {
    String(record.ocrText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private func compact(_ value: Int) -> String {
    if value >= 10_000 {
      return String(format: "%.1fk", Double(value) / 1000)
    }
    if value >= 1000 {
      return String(format: "%.1fk", Double(value) / 1000)
    }
    return "\(value)"
  }

  private func openDetail(for record: MapRecord) {
    container.haptics.softTap()
    let detail = MapDetailViewController(container: container, record: record) { [weak self] _ in
      self?.reloadData()
    }
    navigationController?.pushViewController(detail, animated: true)
  }

  @objc private func filterTapped(_ sender: UIButton) {
    guard let filter = WorkbenchFilter(rawValue: sender.tag) else { return }
    selectedFilter = filter
    container.haptics.selectionChanged()
    reloadData()
  }

  @objc private func facetTapped(_ sender: UIButton) {
    guard let facet = WorkbenchFacet(rawValue: sender.tag) else { return }
    selectedFacet = facet
    container.haptics.selectionChanged()
    reloadData()
  }

  @objc private func metricTapped(_ sender: UIControl) {
    switch sender.tag {
    case 0:
      openLibraryFromWorkbench()
    case 1:
      selectedFilter = .located
      selectedFacet = .coverage
      container.haptics.selectionChanged()
      reloadData()
    case 2:
      selectedFilter = .pendingOCR
      selectedFacet = .reliable
      container.haptics.selectionChanged()
      reloadData()
    default:
      selectedFilter = .pending
      selectedFacet = .coverage
      container.haptics.selectionChanged()
      reloadData()
    }
  }

  @objc private func selectLocatedFromDataTile() {
    selectedFilter = .located
    container.haptics.selectionChanged()
    reloadData()
  }

  @objc private func selectWGS84FromDataTile() {
    selectedFilter = .pending
    selectedFacet = .wgs84
    container.haptics.selectionChanged()
    reloadData()
  }

  @objc private func openLibraryFromWorkbench() {
    container.haptics.softTap()
    tabBarController?.selectedIndex = 1
  }

  @objc private func openOrganizeFromWorkbench() {
    container.haptics.softTap()
    tabBarController?.selectedIndex = 2
  }

  @objc private func zoomInMap() {
    setMapSpanScale(0.55)
  }

  @objc private func zoomOutMap() {
    setMapSpanScale(1.8)
  }

  private func setMapSpanScale(_ scale: CLLocationDegrees) {
    container.haptics.softTap()
    let region = mapView.region
    let span = MKCoordinateSpan(
      latitudeDelta: max(min(region.span.latitudeDelta * scale, 160), 0.02),
      longitudeDelta: max(min(region.span.longitudeDelta * scale, 180), 0.02)
    )
    mapView.setRegion(MKCoordinateRegion(center: region.center, span: span), animated: true)
  }

  @objc private func centerMap() {
    container.haptics.softTap()
    if !mapView.overlays.isEmpty || !mapView.annotations.isEmpty {
      fitAnnotations(animated: true)
    } else {
      resetMapRegion(animated: true)
    }
  }

  private func resetMapRegion(animated: Bool) {
    mapView.setRegion(
      MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 35.8617, longitude: 104.1954),
        span: MKCoordinateSpan(latitudeDelta: 28, longitudeDelta: 38)
      ),
      animated: animated
    )
  }

  @objc private func toggleMapType() {
    container.haptics.selectionChanged()
    mapView.mapType = mapView.mapType == .mutedStandard ? .hybridFlyover : .mutedStandard
  }

  private func fitAnnotations(animated: Bool) {
    let annotations = mapView.annotations
    var rect = MKMapRect.null
    for overlay in mapView.overlays {
      rect = rect.union(overlay.boundingMapRect)
    }
    for annotation in annotations {
      let point = MKMapPoint(annotation.coordinate)
      rect = rect.union(MKMapRect(x: point.x, y: point.y, width: 1, height: 1))
    }
    guard !rect.isNull else {
      centerMap()
      return
    }
    mapView.setVisibleMapRect(
      rect,
      edgePadding: UIEdgeInsets(top: 170, left: 64, bottom: isWorkbenchCollapsed ? 150 : 420, right: 88),
      animated: animated
    )
  }

  func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
    guard let annotation = annotation as? MapRecordAnnotation else { return nil }
    if annotation.representsCoverageArea {
      let identifier = "MapCoverageLabelAnnotation"
      let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? CoverageLabelAnnotationView ?? CoverageLabelAnnotationView(annotation: annotation, reuseIdentifier: identifier)
      view.annotation = annotation
      view.configure(title: annotation.record.title)
      view.canShowCallout = true
      view.rightCalloutAccessoryView = UIButton(type: .detailDisclosure)
      return view
    }
    let identifier = "MapRecordAnnotation"
    let view = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? MKMarkerAnnotationView ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: identifier)
    view.annotation = annotation
    view.canShowCallout = true
    view.markerTintColor = UIColor(red: 0.06, green: 0.16, blue: 0.20, alpha: 1)
    view.glyphImage = UIImage(systemName: "map")
    view.rightCalloutAccessoryView = UIButton(type: .detailDisclosure)
    return view
  }

  func mapView(_ mapView: MKMapView, annotationView view: MKAnnotationView, calloutAccessoryControlTapped control: UIControl) {
    guard let annotation = view.annotation as? MapRecordAnnotation else { return }
    openDetail(for: annotation.record)
  }

  func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
    guard let polygon = overlay as? MKPolygon else {
      return MKOverlayRenderer(overlay: overlay)
    }
    let renderer = MKPolygonRenderer(polygon: polygon)
    renderer.fillColor = UIColor(red: 0.02, green: 0.48, blue: 0.78, alpha: 0.16)
    renderer.strokeColor = UIColor(red: 0.03, green: 0.22, blue: 0.28, alpha: 0.85)
    renderer.lineWidth = 2
    renderer.lineDashPattern = [8, 5]
    return renderer
  }

  private func coverageBounds(for record: MapRecord) -> (north: CLLocationDegrees, south: CLLocationDegrees, east: CLLocationDegrees, west: CLLocationDegrees)? {
    guard
      let north = record.northLatitude,
      let south = record.southLatitude,
      let east = record.eastLongitude,
      let west = record.westLongitude,
      north > south,
      east > west
    else {
      return nil
    }
    return (north, south, east, west)
  }

  private func coverageCenter(for record: MapRecord) -> CLLocationCoordinate2D? {
    if let bounds = coverageBounds(for: record) {
      return CLLocationCoordinate2D(
        latitude: (bounds.north + bounds.south) / 2,
        longitude: (bounds.east + bounds.west) / 2
      )
    }
    guard let latitude = record.latitude, let longitude = record.longitude else { return nil }
    return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
  }

  private func coveragePolygon(for record: MapRecord) -> MKPolygon? {
    guard let bounds = coverageBounds(for: record) else { return nil }
    let coordinates = [
      CLLocationCoordinate2D(latitude: bounds.north, longitude: bounds.west),
      CLLocationCoordinate2D(latitude: bounds.north, longitude: bounds.east),
      CLLocationCoordinate2D(latitude: bounds.south, longitude: bounds.east),
      CLLocationCoordinate2D(latitude: bounds.south, longitude: bounds.west)
    ]
    return MKPolygon(coordinates: coordinates, count: coordinates.count)
  }
}

private final class MapRecordAnnotation: NSObject, MKAnnotation {
  let record: MapRecord
  let coordinate: CLLocationCoordinate2D
  let representsCoverageArea: Bool
  var title: String? { record.title }
  var subtitle: String? { record.subtitleText }

  init(record: MapRecord, coordinate: CLLocationCoordinate2D, representsCoverageArea: Bool) {
    self.record = record
    self.coordinate = coordinate
    self.representsCoverageArea = representsCoverageArea
  }
}

private final class CoverageLabelAnnotationView: MKAnnotationView {
  private let label = UILabel()

  override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
    super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
    backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
    layer.cornerRadius = 14
    layer.cornerCurve = .continuous
    layer.borderWidth = 1
    layer.borderColor = UIColor(red: 0.03, green: 0.22, blue: 0.28, alpha: 0.24).cgColor
    layer.shadowColor = UIColor.black.cgColor
    layer.shadowOpacity = 0.16
    layer.shadowRadius = 8
    layer.shadowOffset = CGSize(width: 0, height: 4)

    label.translatesAutoresizingMaskIntoConstraints = false
    label.font = .systemFont(ofSize: 12, weight: .bold)
    label.textColor = UIColor(red: 0.03, green: 0.22, blue: 0.28, alpha: 1)
    label.lineBreakMode = .byTruncatingTail
    addSubview(label)

    NSLayoutConstraint.activate([
      label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
      label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
      label.topAnchor.constraint(equalTo: topAnchor, constant: 6),
      label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configure(title: String) {
    label.text = title
    frame.size = CGSize(width: min(max(CGFloat(title.count) * 13 + 28, 128), 220), height: 34)
    centerOffset = CGPoint(x: 0, y: -17)
  }
}

private final class IconBadgeView: UIView {
  init(symbol: String, tint: UIColor, background: UIColor) {
    super.init(frame: .zero)
    self.backgroundColor = background
    layer.cornerRadius = 10
    layer.cornerCurve = .continuous
    let imageView = UIImageView(image: UIImage(systemName: symbol))
    imageView.translatesAutoresizingMaskIntoConstraints = false
    imageView.tintColor = tint
    imageView.contentMode = .scaleAspectFit
    addSubview(imageView)
    NSLayoutConstraint.activate([
      imageView.centerXAnchor.constraint(equalTo: centerXAnchor),
      imageView.centerYAnchor.constraint(equalTo: centerYAnchor),
      imageView.widthAnchor.constraint(equalToConstant: 14),
      imageView.heightAnchor.constraint(equalToConstant: 14)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

private final class MapToolButton: UIButton {
  init(symbol: String) {
    super.init(frame: .zero)
    translatesAutoresizingMaskIntoConstraints = false
    tintColor = .label
    backgroundColor = UIColor.systemBackground.withAlphaComponent(0.88)
    layer.cornerRadius = 14
    layer.cornerCurve = .continuous
    layer.borderWidth = 1
    layer.borderColor = UIColor.separator.withAlphaComponent(0.15).cgColor
    setImage(UIImage(systemName: symbol), for: .normal)
    NSLayoutConstraint.activate([
      widthAnchor.constraint(equalToConstant: 40),
      heightAnchor.constraint(equalToConstant: 40)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

private final class FilterChipButton: UIButton {
  private let compact: Bool

  init(title: String, selected: Bool, compact: Bool = false) {
    self.compact = compact
    super.init(frame: .zero)
    var config = UIButton.Configuration.filled()
    config.attributedTitle = AttributedString(title, attributes: AttributeContainer([.font: UIFont.systemFont(ofSize: compact ? 9 : 10, weight: .bold)]))
    config.cornerStyle = .capsule
    config.baseBackgroundColor = selected ? UIColor(red: 0.07, green: 0.16, blue: 0.20, alpha: 1) : .systemBackground.withAlphaComponent(0.86)
    config.baseForegroundColor = selected ? .white : .label
    config.contentInsets = NSDirectionalEdgeInsets(top: compact ? 5 : 6, leading: compact ? 8 : 10, bottom: compact ? 5 : 6, trailing: compact ? 8 : 10)
    configuration = config
    titleLabel?.adjustsFontSizeToFitWidth = true
    titleLabel?.minimumScaleFactor = 0.7
    titleLabel?.numberOfLines = 1
    titleLabel?.lineBreakMode = .byClipping
    setContentCompressionResistancePriority(.required, for: .horizontal)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func updateTitle(_ title: String) {
    var config = configuration ?? UIButton.Configuration.filled()
    config.attributedTitle = AttributedString(title, attributes: AttributeContainer([.font: UIFont.systemFont(ofSize: compact ? 9 : 10, weight: .bold)]))
    configuration = config
  }

  func setSelected(_ selected: Bool) {
    var config = configuration ?? UIButton.Configuration.filled()
    config.baseBackgroundColor = selected ? UIColor(red: 0.07, green: 0.16, blue: 0.20, alpha: 1) : .systemBackground.withAlphaComponent(0.86)
    config.baseForegroundColor = selected ? .white : .label
    configuration = config
  }
}

private final class MetricTileView: UIControl {
  init(value: String, label: String) {
    super.init(frame: .zero)
    backgroundColor = .systemBackground.withAlphaComponent(0.72)
    let valueLabel = UILabel()
    valueLabel.font = .systemFont(ofSize: 16, weight: .bold)
    valueLabel.text = value
    let captionLabel = UILabel()
    captionLabel.font = .systemFont(ofSize: 9, weight: .medium)
    captionLabel.textColor = .secondaryLabel
    captionLabel.text = label
    let stack = UIStackView(arrangedSubviews: [valueLabel, captionLabel])
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 4
    stack.isUserInteractionEnabled = false
    addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
      stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
      stack.centerYAnchor.constraint(equalTo: centerYAnchor)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var isHighlighted: Bool {
    didSet {
      alpha = isHighlighted ? 0.72 : 1
    }
  }
}

private final class QueueRowView: UIControl {
  init(title: String, subtitle: String, badge: String, priority: Bool) {
    super.init(frame: .zero)
    backgroundColor = .secondarySystemGroupedBackground.withAlphaComponent(0.86)
    layer.cornerRadius = 13
    layer.cornerCurve = .continuous
    layer.borderWidth = 1
    layer.borderColor = UIColor.separator.withAlphaComponent(0.10).cgColor

    let thumb = UIView()
    thumb.translatesAutoresizingMaskIntoConstraints = false
    thumb.backgroundColor = UIColor(patternImage: Self.thumbnailPattern())
    thumb.layer.cornerRadius = 9
    thumb.layer.cornerCurve = .continuous
    thumb.clipsToBounds = true

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 11, weight: .bold)
    titleLabel.text = title
    titleLabel.lineBreakMode = .byTruncatingTail

    let subtitleLabel = UILabel()
    subtitleLabel.font = .systemFont(ofSize: 8.5, weight: .medium)
    subtitleLabel.textColor = .secondaryLabel
    subtitleLabel.text = subtitle
    subtitleLabel.lineBreakMode = .byTruncatingTail

    let labelStack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
    labelStack.axis = .vertical
    labelStack.spacing = 2

    let badgeLabel = UILabel()
    badgeLabel.font = .systemFont(ofSize: 9, weight: .bold)
    badgeLabel.textAlignment = .center
    badgeLabel.text = badge
    badgeLabel.textColor = priority ? UIColor(red: 0.58, green: 0.25, blue: 0.11, alpha: 1) : .secondaryLabel
    badgeLabel.backgroundColor = priority ? UIColor(red: 1.0, green: 0.90, blue: 0.84, alpha: 1) : .tertiarySystemGroupedBackground
    badgeLabel.layer.cornerRadius = 9
    badgeLabel.layer.cornerCurve = .continuous
    badgeLabel.clipsToBounds = true

    let stack = UIStackView(arrangedSubviews: [thumb, labelStack, badgeLabel])
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 7
    stack.isUserInteractionEnabled = false
    addSubview(stack)

    NSLayoutConstraint.activate([
      heightAnchor.constraint(equalToConstant: 49),
      thumb.widthAnchor.constraint(equalToConstant: 36),
      thumb.heightAnchor.constraint(equalToConstant: 36),
      badgeLabel.widthAnchor.constraint(equalToConstant: 38),
      badgeLabel.heightAnchor.constraint(equalToConstant: 26),
      stack.topAnchor.constraint(equalTo: topAnchor, constant: 5),
      stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 5),
      stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -5),
      stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -5)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  private static func thumbnailPattern() -> UIImage {
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 36, height: 36))
    return renderer.image { context in
      UIColor(red: 0.58, green: 0.72, blue: 0.53, alpha: 1).setFill()
      context.fill(CGRect(x: 0, y: 0, width: 18, height: 36))
      UIColor(red: 0.42, green: 0.61, blue: 0.70, alpha: 1).setFill()
      context.fill(CGRect(x: 18, y: 0, width: 18, height: 36))
      UIColor(red: 0.83, green: 0.69, blue: 0.39, alpha: 1).setStroke()
      let path = UIBezierPath()
      path.move(to: CGPoint(x: 0, y: 30))
      path.addLine(to: CGPoint(x: 30, y: 0))
      path.lineWidth = 7
      path.stroke()
      UIColor.white.withAlphaComponent(0.65).setStroke()
      let road = UIBezierPath()
      road.move(to: CGPoint(x: 0, y: 8))
      road.addLine(to: CGPoint(x: 36, y: 36))
      road.lineWidth = 3
      road.stroke()
    }
  }
}

private final class DataTileView: UIControl {
  init(value: String, label: String) {
    super.init(frame: .zero)
    backgroundColor = .secondarySystemGroupedBackground.withAlphaComponent(0.78)
    layer.cornerRadius = 12
    layer.cornerCurve = .continuous
    layer.borderWidth = 1
    layer.borderColor = UIColor.separator.withAlphaComponent(0.10).cgColor

    let valueLabel = UILabel()
    valueLabel.font = .systemFont(ofSize: 14, weight: .bold)
    valueLabel.text = value
    let labelLabel = UILabel()
    labelLabel.font = .systemFont(ofSize: 8, weight: .medium)
    labelLabel.textColor = .secondaryLabel
    labelLabel.text = label
    let stack = UIStackView(arrangedSubviews: [valueLabel, labelLabel])
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 5
    stack.isUserInteractionEnabled = false
    addSubview(stack)

    NSLayoutConstraint.activate([
      heightAnchor.constraint(equalToConstant: 48),
      stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 7),
      stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -5),
      stack.centerYAnchor.constraint(equalTo: centerYAnchor)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var isHighlighted: Bool {
    didSet {
      alpha = isHighlighted ? 0.72 : 1
    }
  }
}
