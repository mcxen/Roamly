import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import marker from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { MapChart } from 'echarts/charts';
import { TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import chinaGeoDataRaw from 'china-map-geojson/lib/china.js';
import { api } from './api.js';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker,
  shadowUrl: shadow
});

echarts.use([MapChart, TooltipComponent, VisualMapComponent, CanvasRenderer]);

const chinaGeoData = chinaGeoDataRaw?.default || chinaGeoDataRaw;
if (chinaGeoData && !echarts.getMap('china')) {
  echarts.registerMap('china', chinaGeoData);
}

const CHINA_MAP_FEATURE_NAMES = (chinaGeoData?.features || [])
  .map((item) => item?.properties?.name)
  .filter(Boolean);

const DEFAULT_FILTERS = {
  q: '',
  scope: '',
  country: '',
  province: '',
  city: '',
  source: '',
  favorite: ''
};

const emptyForm = {
  title: '',
  description: '',
  tags: '',
  collection_unit: '',
  scope_level: '',
  country_code: '',
  country_name: '',
  province: '',
  city: '',
  district: '',
  latitude: '',
  longitude: '',
  year_label: ''
};

const formatBytes = (size) => {
  if (!size && size !== 0) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
};

const normalizeProvinceName = (name) => {
  return String(name || '')
    .replace(/特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市/g, '')
    .trim();
};

function App() {
  const [status, setStatus] = useState(null);
  const [ocrStatus, setOcrStatus] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [queryInput, setQueryInput] = useState('');
  const [maps, setMaps] = useState([]);
  const [facets, setFacets] = useState({ scope: [], country: [], province: [], city: [] });
  const [chinaDistribution, setChinaDistribution] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedMap, setSelectedMap] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [locationHints, setLocationHints] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadFolder, setUploadFolder] = useState('');
  const [folderOptions, setFolderOptions] = useState(['']);
  const [libraryPathInput, setLibraryPathInput] = useState('');
  const [browserState, setBrowserState] = useState({
    currentPath: '',
    parentPath: '',
    children: []
  });
  const [activeTab, setActiveTab] = useState('content');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedSummary = useMemo(() => maps.find((item) => item.id === selectedId) || null, [maps, selectedId]);

  const chinaMapOption = useMemo(() => {
    if (!CHINA_MAP_FEATURE_NAMES.length) return null;

    const counts = new Map();
    for (const item of chinaDistribution) {
      if (!item?.province || item.province === 'Unknown') continue;
      const key = normalizeProvinceName(item.province);
      counts.set(key, (counts.get(key) || 0) + Number(item.count || 0));
    }

    const seriesData = CHINA_MAP_FEATURE_NAMES.map((name) => {
      const key = normalizeProvinceName(name);
      return {
        name,
        value: counts.get(key) || 0
      };
    });

    const maxValue = Math.max(...seriesData.map((item) => item.value), 1);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => `${params.name}: ${params.value || 0} 张`
      },
      visualMap: {
        left: 10,
        bottom: 4,
        orient: 'vertical',
        pieces: [
          { min: 40, label: '>=40' },
          { min: 30, max: 39, label: '30-39' },
          { min: 20, max: 29, label: '20-29' },
          { min: 10, max: 19, label: '10-19' },
          { min: 1, max: 9, label: '1-9' },
          { value: 0, label: '0' }
        ],
        inRange: {
          color: ['#eef5fb', '#9fc1ef', '#5e8ddf', '#2f5dd1', '#1d36c8']
        },
        textStyle: {
          fontSize: 11
        }
      },
      series: [
        {
          type: 'map',
          map: 'china',
          roam: false,
          zoom: 1.06,
          label: {
            show: true,
            fontSize: 11,
            color: '#24313f',
            formatter: (params) => {
              const count = params.value || 0;
              const shortName = normalizeProvinceName(params.name);
              return `${shortName}\n${count}`;
            }
          },
          itemStyle: {
            borderColor: '#b8c6d7',
            borderWidth: 1,
            areaColor: '#eef5fb'
          },
          emphasis: {
            label: {
              color: '#09142a',
              fontWeight: 'bold'
            },
            itemStyle: {
              areaColor: '#72a0eb'
            }
          },
          data: seriesData
        }
      ],
      aria: {
        enabled: false
      },
      max: maxValue
    };
  }, [chinaDistribution]);

  const refreshStatus = async () => {
    const data = await api.status();
    setStatus(data);
    setOcrStatus(data.ocr || null);
    setLibraryPathInput(data.mapLibraryDir || '');
    return data;
  };

  const refreshOcrStatus = async () => {
    try {
      const data = await api.ocrStatus();
      setOcrStatus(data);
    } catch (_err) {
      // ignore
    }
  };

  const loadLocalFolders = async (driver = status?.storageDriver) => {
    if (driver !== 'local') return;
    try {
      const data = await api.listLocalFolders(6);
      setFolderOptions(Array.isArray(data.folders) && data.folders.length ? data.folders : ['']);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadBrowser = async (targetPath, driver = status?.storageDriver) => {
    if (driver !== 'local') return;
    try {
      const data = await api.browseLocal(targetPath);
      setBrowserState({
        currentPath: data.currentPath || '',
        parentPath: data.parentPath || '',
        children: data.children || []
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const loadFacets = async (source) => {
    try {
      const data = await api.facets(source || undefined);
      setFacets(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadChinaDistribution = async (source) => {
    try {
      const data = await api.chinaDistribution(source || undefined);
      setChinaDistribution(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadMaps = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.listMaps({ ...filters, page, limit: 24 });
      setMaps(data.items);
      setTotal(data.total);
      setHasMore(Boolean(data.hasMore));

      if (!data.items.length) {
        setSelectedId('');
        setSelectedMap(null);
      } else if (!data.items.some((item) => item.id === selectedId)) {
        setSelectedId(data.items[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refreshStatus()
      .then(async (data) => {
        if (data.storageDriver === 'local') {
          await loadBrowser(data.mapLibraryDir || '', data.storageDriver);
          await loadLocalFolders(data.storageDriver);
        }
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  useEffect(() => {
    loadFacets(filters.source || undefined);
    loadChinaDistribution(filters.source || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.source]);

  useEffect(() => {
    if (!selectedId) return;
    api.map(selectedId)
      .then((data) => {
        setSelectedMap(data);
        setForm({
          title: data.title || '',
          description: data.description || '',
          tags: (data.tags || []).join(', '),
          collection_unit: data.collection_unit || '',
          scope_level: data.scope_level || '',
          country_code: data.country_code || '',
          country_name: data.country_name || '',
          province: data.province || '',
          city: data.city || '',
          district: data.district || '',
          latitude: data.latitude ?? '',
          longitude: data.longitude ?? '',
          year_label: data.year_label || ''
        });
      })
      .catch((err) => setError(err.message));
  }, [selectedId]);

  useEffect(() => {
    const keyword = form.city?.trim();
    if (!keyword) {
      setLocationHints([]);
      return;
    }

    const timer = setTimeout(() => {
      api.suggestLocations(keyword)
        .then((data) => setLocationHints(data.items || []))
        .catch(() => {});
    }, 350);

    return () => clearTimeout(timer);
  }, [form.city]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2800);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 3500);
    return () => clearTimeout(timer);
  }, [error]);

  const patchFilters = (patch) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const setFilter = (name, value) => {
    patchFilters({ [name]: value });
  };

  const applySearch = () => {
    setFilter('q', queryInput);
  };

  const resetFilters = () => {
    setPage(1);
    setQueryInput('');
    setFilters(DEFAULT_FILTERS);
  };

  const handleSetLibraryPath = async () => {
    if (!libraryPathInput.trim()) {
      setError('请先输入目录路径');
      return;
    }

    setBusy(true);
    try {
      const data = await api.setLocalDirectory(libraryPathInput.trim());
      setStatus((prev) => ({ ...prev, mapLibraryDir: data.mapLibraryDir }));
      setLibraryPathInput(data.mapLibraryDir || '');
      setFolderOptions(Array.isArray(data.folders) && data.folders.length ? data.folders : ['']);
      await loadBrowser(data.mapLibraryDir);
      await loadMaps();
      await loadFacets(filters.source || undefined);
      await loadChinaDistribution(filters.source || undefined);
      await refreshOcrStatus();
      setMessage(`目录已切换，已扫描 ${data.scan?.scanned || 0} 张图片`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.saveMap(selectedId, {
        ...form,
        tags: form.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      });
      setMessage('已保存元数据');
      await loadMaps();
      const data = await api.map(selectedId);
      setSelectedMap(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async () => {
    if (!selectedId || !selectedSummary) return;
    try {
      await api.toggleFavorite(selectedId, !selectedSummary.favorite);
      await loadMaps();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleScan = async () => {
    setBusy(true);
    try {
      const data = await api.scan();
      setMessage(`扫描完成: ${data.scanned} 张`);
      await loadMaps();
      await loadFacets(filters.source || undefined);
      await loadChinaDistribution(filters.source || undefined);
      await loadLocalFolders();
      await refreshOcrStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    setBusy(true);
    try {
      const result = await api.upload(uploadFiles, uploadFolder);
      setUploadFiles([]);
      setMessage(`上传并复制完成: ${result.count} 张`);
      await loadMaps();
      await loadFacets(filters.source || undefined);
      await loadChinaDistribution(filters.source || undefined);
      await loadLocalFolders();
      await refreshOcrStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleOcrReindex = async () => {
    setBusy(true);
    try {
      const result = await api.ocrReindex(true, 6000);
      await refreshOcrStatus();
      setMessage(`OCR 重建任务已入队: ${result.queued} 张`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const applyHint = (item) => {
    setForm((prev) => ({
      ...prev,
      country_code: item.country_code || prev.country_code,
      country_name: item.country_name || prev.country_name,
      province: item.province || prev.province,
      city: item.city || prev.city,
      latitude: item.latitude,
      longitude: item.longitude,
      scope_level: item.country_code === 'CN' ? 'national' : 'international'
    }));
  };

  const handleChinaProvinceClick = (params) => {
    const shortName = normalizeProvinceName(params?.name || '');
    if (!shortName) return;
    patchFilters({
      scope: 'national',
      country: '中国',
      province: shortName
    });
  };

  return (
    <div className="page-root">
      <header className="topbar">
        <div className="brand">Roamly 地图库</div>
        <div className="status">
          <span>存储: {status?.storageDriver || '-'}</span>
          <span>目录: {status?.mapLibraryDir || '未设置'}</span>
          <span>
            OCR: {ocrStatus?.available ? `可用(队列${ocrStatus.queueSize || 0})` : '不可用'}
          </span>
        </div>
        <div className="actions">
          <button onClick={() => setSettingsOpen(true)}>设置</button>
          <button onClick={handleScan} disabled={busy}>重扫目录</button>
        </div>
      </header>

      <main className="layout">
        <aside className="left-pane pane">
          <div className="pane-title">目录分类</div>
          <div className="facet-group">
            <h4>范围</h4>
            {facets.scope.map((item) => (
              <button
                key={`scope-${item.value}`}
                className={filters.scope === item.value ? 'facet active' : 'facet'}
                onClick={() => setFilter('scope', filters.scope === item.value ? '' : item.value)}
              >
                <span>{item.value}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
          <div className="facet-group">
            <h4>国家</h4>
            {facets.country.slice(0, 20).map((item) => (
              <button
                key={`country-${item.value}`}
                className={filters.country === item.value ? 'facet active' : 'facet'}
                onClick={() => setFilter('country', filters.country === item.value ? '' : item.value)}
              >
                <span>{item.value}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
          <div className="facet-group">
            <h4>城市</h4>
            {facets.city.slice(0, 24).map((item) => (
              <button
                key={`city-${item.value}`}
                className={filters.city === item.value ? 'facet active' : 'facet'}
                onClick={() => setFilter('city', filters.city === item.value ? '' : item.value)}
              >
                <span>{item.value}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
          <div className="facet-group china-dist-wrap">
            <h4>中国分布</h4>
            {chinaMapOption ? (
              <ReactECharts
                option={chinaMapOption}
                style={{ height: 320, width: '100%' }}
                onEvents={{ click: handleChinaProvinceClick }}
              />
            ) : (
              <div className="geo-empty">暂无中国地图分布数据</div>
            )}
            <div className="china-tip">点击省份可筛选对应地图</div>
          </div>
        </aside>

        <section className="center-pane pane">
          <div className="toolbar">
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              placeholder="搜索标题/文件名/城市/OCR文字"
            />
            <select value={filters.source} onChange={(e) => setFilter('source', e.target.value)}>
              <option value="">全部来源</option>
              <option value="local">本地文件夹</option>
              <option value="webdav">WebDAV</option>
            </select>
            <button onClick={applySearch}>检索</button>
            <button onClick={resetFilters}>清空</button>
            <button onClick={() => setFilter('favorite', filters.favorite ? '' : 'true')}>
              {filters.favorite ? '取消收藏筛选' : '仅收藏'}
            </button>
          </div>

          <div className="upload-row">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
            />
            <select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>
              {folderOptions.map((item) => (
                <option key={item || '__root__'} value={item}>
                  {item || '/ (根目录)'}
                </option>
              ))}
            </select>
            <button onClick={handleUpload} disabled={!uploadFiles.length || busy}>上传并复制</button>
          </div>

          <div className="count-line">共 {total} 张，当前第 {page} 页</div>

          <div className="card-grid">
            {maps.map((item) => (
              <article
                key={item.id}
                className={selectedId === item.id ? 'map-card active' : 'map-card'}
                onClick={() => setSelectedId(item.id)}
              >
                <img src={`/api/files/${item.id}`} alt={item.title || item.file_name} loading="lazy" />
                <div className="map-card-body">
                  <div className="map-card-title">{item.title || item.file_name}</div>
                  <div className="map-card-meta">
                    <span>{item.city || item.country_name || '未定位'}</span>
                    <span>{item.favorite ? '★' : ''}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="pager">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</button>
            <span>第 {page} 页</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>下一页</button>
          </div>
        </section>

        <aside className="right-pane pane">
          <div className="detail-header">
            <h3>{selectedSummary?.title || '未选择地图'}</h3>
            <button onClick={toggleFavorite} disabled={!selectedSummary}>
              {selectedSummary?.favorite ? '取消收藏' : '加入收藏'}
            </button>
          </div>

          {selectedMap ? (
            <>
              <div className="tab-row">
                <button
                  className={activeTab === 'content' ? 'active' : ''}
                  onClick={() => setActiveTab('content')}
                >内容</button>
                <button
                  className={activeTab === 'geo' ? 'active' : ''}
                  onClick={() => setActiveTab('geo')}
                >定位</button>
              </div>

              <div className="preview-wrap" onClick={() => setViewerOpen(true)}>
                <img className="preview" src={`/api/files/${selectedMap.id}`} alt={selectedMap.title || selectedMap.file_name} />
                <div className="preview-tip">点击放大查看</div>
              </div>

              <div className="file-meta">
                <span>ID: {selectedMap.id.slice(0, 12)}</span>
                <span>{selectedMap.width || '-'} x {selectedMap.height || '-'}</span>
                <span>{selectedMap.mime || '-'}</span>
                <span>{formatBytes(selectedMap.size_bytes)}</span>
                <span>{formatDate(selectedMap.mtime_ms)}</span>
                <span>OCR: {selectedMap.ocr_status || 'pending'}</span>
              </div>

              {activeTab === 'content' ? (
                <div className="form-grid">
                  <label>
                    标题
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </label>
                  <label>
                    收藏单位
                    <input value={form.collection_unit} onChange={(e) => setForm({ ...form, collection_unit: e.target.value })} />
                  </label>
                  <label>
                    年代
                    <input value={form.year_label} onChange={(e) => setForm({ ...form, year_label: e.target.value })} />
                  </label>
                  <label>
                    标签
                    <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="多个标签用逗号分隔" />
                  </label>
                  <label className="full">
                    简介
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
                  </label>
                </div>
              ) : (
                <div className="form-grid">
                  <label>
                    范围
                    <select value={form.scope_level} onChange={(e) => setForm({ ...form, scope_level: e.target.value })}>
                      <option value="">未设置</option>
                      <option value="national">国家级</option>
                      <option value="international">国际</option>
                    </select>
                  </label>
                  <label>
                    国家代码
                    <input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} />
                  </label>
                  <label>
                    国家
                    <input value={form.country_name} onChange={(e) => setForm({ ...form, country_name: e.target.value })} />
                  </label>
                  <label>
                    省/州
                    <input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                  </label>
                  <label>
                    市
                    <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </label>
                  <label>
                    区县
                    <input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
                  </label>
                  <label>
                    纬度
                    <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                  </label>
                  <label>
                    经度
                    <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                  </label>

                  {locationHints.length > 0 ? (
                    <div className="full hints">
                      {locationHints.map((item) => (
                        <button key={`${item.country_code}-${item.city}-${item.latitude}`} onClick={() => applyHint(item)}>
                          {item.country_name} / {item.province} / {item.city}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="full geo-map">
                    {form.latitude && form.longitude ? (
                      <MapContainer
                        center={[Number(form.latitude), Number(form.longitude)]}
                        zoom={8}
                        scrollWheelZoom
                        style={{ height: 220, width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; OpenStreetMap contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[Number(form.latitude), Number(form.longitude)]}>
                          <Popup>{form.city || form.country_name || '地图定位'}</Popup>
                        </Marker>
                      </MapContainer>
                    ) : (
                      <div className="geo-empty">填写经纬度后显示定位</div>
                    )}
                  </div>
                </div>
              )}

              <button className="save-btn" onClick={handleSave} disabled={busy}>保存地图信息</button>
            </>
          ) : (
            <div className="empty-detail">从中间选择一张地图查看详情</div>
          )}
        </aside>
      </main>

      {settingsOpen ? (
        <div className="settings-mask" onClick={() => setSettingsOpen(false)}>
          <aside className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-head">
              <h3>系统设置</h3>
              <button onClick={() => setSettingsOpen(false)}>关闭</button>
            </div>

            {status?.storageDriver === 'local' ? (
              <div className="settings-block">
                <h4>目录设置</h4>
                <div className="library-row">
                  <input
                    value={libraryPathInput}
                    onChange={(e) => setLibraryPathInput(e.target.value)}
                    placeholder="输入本地地图目录"
                  />
                  <button onClick={handleSetLibraryPath} disabled={busy}>设置目录</button>
                  <button onClick={() => loadBrowser(browserState.currentPath || libraryPathInput)} disabled={busy}>刷新浏览</button>
                </div>

                <div className="browser-row">
                  <button onClick={() => loadBrowser(browserState.parentPath)} disabled={!browserState.parentPath}>上级</button>
                  <span className="browser-path" title={browserState.currentPath}>{browserState.currentPath || '-'}</span>
                </div>
                <div className="browser-list">
                  {browserState.children.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => {
                        setLibraryPathInput(item.path);
                        loadBrowser(item.path);
                      }}
                      title={item.path}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="settings-block">
              <h4>OCR 文字检索</h4>
              <div className="settings-line">状态: {ocrStatus?.available ? '可用' : '不可用'}</div>
              <div className="settings-line">队列: {ocrStatus?.queueSize || 0}</div>
              <div className="settings-line">识别语言: {ocrStatus?.lang || '-'}</div>
              {!ocrStatus?.available ? (
                <div className="settings-tip">请先安装 tesseract（mac: `brew install tesseract tesseract-lang`）。</div>
              ) : null}
              <button onClick={handleOcrReindex} disabled={busy || !ocrStatus?.available}>重建 OCR 索引</button>
            </div>
          </aside>
        </div>
      ) : null}

      {viewerOpen && selectedMap ? (
        <div className="viewer-mask" onClick={() => setViewerOpen(false)}>
          <div className="viewer-panel" onClick={(e) => e.stopPropagation()}>
            <TransformWrapper initialScale={1} minScale={0.4} maxScale={10} centerOnInit>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="viewer-toolbar">
                    <button onClick={() => zoomIn()}>放大</button>
                    <button onClick={() => zoomOut()}>缩小</button>
                    <button onClick={() => resetTransform()}>重置</button>
                    <button onClick={() => setViewerOpen(false)}>关闭</button>
                  </div>
                  <TransformComponent
                    wrapperStyle={{ width: '100%', height: 'calc(100vh - 120px)' }}
                    contentStyle={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  >
                    <img
                      className="viewer-image"
                      src={`/api/files/${selectedMap.id}`}
                      alt={selectedMap.title || selectedMap.file_name}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      ) : null}

      {message ? <div className="toast ok">{message}</div> : null}
      {error ? <div className="toast err">{error}</div> : null}
    </div>
  );
}

export default App;
