import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import marker from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { geoContains, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldAtlasData from 'world-atlas/countries-110m.json';
import { api } from './api.js';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker,
  shadowUrl: shadow
});

const WORLD_FEATURES = feature(
  worldAtlasData,
  worldAtlasData?.objects?.countries
)?.features || [];

const COUNTRY_NAME_ZH = {
  China: '中国',
  Japan: '日本',
  'United States of America': '美国',
  Russia: '俄罗斯',
  'United Kingdom': '英国',
  France: '法国',
  Germany: '德国',
  'South Korea': '韩国',
  'North Korea': '朝鲜',
  India: '印度',
  Canada: '加拿大',
  Australia: '澳大利亚',
  Brazil: '巴西',
  Italy: '意大利',
  Spain: '西班牙',
  Mexico: '墨西哥',
  Mongolia: '蒙古国',
  Kazakhstan: '哈萨克斯坦',
  Ukraine: '乌克兰',
  Poland: '波兰',
  Turkey: '土耳其',
  Egypt: '埃及',
  Iran: '伊朗',
  Iraq: '伊拉克',
  Afghanistan: '阿富汗',
  Pakistan: '巴基斯坦',
  Thailand: '泰国',
  Vietnam: '越南',
  Indonesia: '印度尼西亚',
  Malaysia: '马来西亚',
  Philippines: '菲律宾',
  Myanmar: '缅甸',
  Singapore: '新加坡',
  'South Africa': '南非',
  Argentina: '阿根廷',
  Chile: '智利',
  Peru: '秘鲁'
};

const toCountryLabel = (name) => {
  const raw = String(name || '').trim();
  return COUNTRY_NAME_ZH[raw] || raw;
};

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

const DEFAULT_STORAGE_FORM = {
  storageDriver: 'local',
  mapLibraryDir: '',
  webdav: {
    url: '',
    username: '',
    password: '',
    rootPath: '/'
  }
};

const DEFAULT_UI_SETTINGS = {
  thumbnailLabelVisible: true,
  thumbnailLabelSize: 14,
  thumbnailHeight: 160,
  thumbnailWidth: 180,
  detailPreviewHeight: 520
};

const DEFAULT_PANE_SIZES = {
  left: 280,
  right: 620
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const loadJsonFromStorage = (key, fallbackValue) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? { ...fallbackValue, ...parsed }
      : fallbackValue;
  } catch (_err) {
    return fallbackValue;
  }
};

const normalizeDriver = (value) => {
  return value === 'webdav' ? 'webdav' : 'local';
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

const pickFolders = (data) => {
  const folders = Array.isArray(data?.folders) ? data.folders : [];
  return folders.length ? folders : [''];
};

const buildFileUrl = (id, params = {}) => {
  if (!id) return '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString();
  return suffix ? `/api/files/${id}?${suffix}` : `/api/files/${id}`;
};

function GlobeCountryPicker({ selectedCountry, onPickCountry }) {
  const canvasRef = useRef(null);
  const dragStateRef = useRef(null);
  const rotationRef = useRef([-20, -20, 0]);
  const [rotation, setRotation] = useState(rotationRef.current);

  const drawGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 240;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const scale = Math.min(width, height) * 0.46;
    const projection = geoOrthographic()
      .translate([width / 2, height / 2])
      .scale(scale)
      .clipAngle(90)
      .rotate(rotation);

    const pathGen = geoPath(projection, ctx);

    const gradient = ctx.createRadialGradient(
      width * 0.42,
      height * 0.34,
      scale * 0.08,
      width * 0.5,
      height * 0.48,
      scale * 1.15
    );
    gradient.addColorStop(0, '#a0cff5');
    gradient.addColorStop(0.55, '#68a8dc');
    gradient.addColorStop(1, '#254b73');

    ctx.beginPath();
    pathGen({ type: 'Sphere' });
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    pathGen(geoGraticule10());
    ctx.strokeStyle = 'rgba(220,236,250,0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    for (const item of WORLD_FEATURES) {
      const englishName = item?.properties?.name || '';
      const name = toCountryLabel(englishName);
      const selected = Boolean(selectedCountry) && (
        String(selectedCountry).toLowerCase() === name.toLowerCase()
        || String(selectedCountry).toLowerCase() === englishName.toLowerCase()
      );

      ctx.beginPath();
      pathGen(item);
      ctx.fillStyle = selected ? '#ffce8a' : '#dce8f4';
      ctx.strokeStyle = selected ? '#bf6d1f' : 'rgba(89,117,148,0.64)';
      ctx.lineWidth = selected ? 1.1 : 0.7;
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    pathGen({ type: 'Sphere' });
    ctx.strokeStyle = 'rgba(16,30,44,0.7)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }, [rotation, selectedCountry]);

  useEffect(() => {
    drawGlobe();
    const onResize = () => drawGlobe();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawGlobe]);

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startRotation: [...rotationRef.current],
      moved: false
    };
  };

  const handlePointerMove = (event) => {
    const state = dragStateRef.current;
    if (!state) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      state.moved = true;
    }

    const nextRotation = [
      state.startRotation[0] + dx * 0.35,
      clamp(state.startRotation[1] - dy * 0.35, -80, 80),
      0
    ];
    rotationRef.current = nextRotation;
    setRotation(nextRotation);
  };

  const handlePointerUp = (event) => {
    const canvas = canvasRef.current;
    const state = dragStateRef.current;
    if (!canvas || !state) {
      dragStateRef.current = null;
      return;
    }

    canvas.releasePointerCapture(event.pointerId);
    const wasMoved = state.moved;
    dragStateRef.current = null;

    if (wasMoved) return;

    const rect = canvas.getBoundingClientRect();
    const width = canvas.clientWidth || rect.width;
    const height = canvas.clientHeight || rect.height;
    const projection = geoOrthographic()
      .translate([width / 2, height / 2])
      .scale(Math.min(width, height) * 0.46)
      .clipAngle(90)
      .rotate(rotationRef.current);

    const point = projection.invert([event.clientX - rect.left, event.clientY - rect.top]);
    if (!point) return;

    const hit = WORLD_FEATURES.find((item) => geoContains(item, point));
    if (!hit) return;

    const englishName = hit?.properties?.name || '';
    const countryName = toCountryLabel(englishName);
    onPickCountry({
      country: countryName,
      country_en: englishName
    });
  };

  return (
    <div className="globe-wrap">
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <div className="globe-tip">拖拽旋转地球仪，点击国家后自动筛选</div>
    </div>
  );
}

function App() {
  const [status, setStatus] = useState(null);
  const [ocrStatus, setOcrStatus] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [queryInput, setQueryInput] = useState('');
  const [maps, setMaps] = useState([]);
  const [facets, setFacets] = useState({ scope: [], country: [], province: [], city: [] });
  const [selectedId, setSelectedId] = useState('');
  const [selectedMap, setSelectedMap] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [locationHints, setLocationHints] = useState([]);
  const [chinaCityOptions, setChinaCityOptions] = useState([]);
  const [cityResolveBusy, setCityResolveBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const raw = Number(localStorage.getItem('roamly-page-size') || 18);
    return clamp(raw, 6, 120);
  });
  const [pageInput, setPageInput] = useState('1');
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadFolder, setUploadFolder] = useState('');
  const [folderOptions, setFolderOptions] = useState(['']);
  const [browserState, setBrowserState] = useState({
    currentPath: '',
    parentPath: '',
    children: []
  });
  const [storageForm, setStorageForm] = useState(DEFAULT_STORAGE_FORM);
  const [activeTab, setActiveTab] = useState('content');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uiSettings, setUiSettings] = useState(() => loadJsonFromStorage('roamly-ui-settings', DEFAULT_UI_SETTINGS));
  const [paneSizes, setPaneSizes] = useState(() => loadJsonFromStorage('roamly-pane-sizes', DEFAULT_PANE_SIZES));
  const [resizingPane, setResizingPane] = useState('');

  const layoutRef = useRef(null);
  const resizeStateRef = useRef(null);

  const selectedSummary = useMemo(() => maps.find((item) => item.id === selectedId) || null, [maps, selectedId]);
  const detailImageSrc = useMemo(() => {
    if (!selectedMap?.id) return '';
    return buildFileUrl(selectedMap.id, { v: selectedMap?.mtime_ms || '' });
  }, [selectedMap?.id, selectedMap?.mtime_ms]);
  const viewerImageSrc = useMemo(() => {
    if (!selectedMap?.id) return '';
    return buildFileUrl(selectedMap.id, { v: selectedMap?.mtime_ms || '' });
  }, [selectedMap?.id, selectedMap?.mtime_ms]);

  const cardGridStyle = useMemo(() => ({
    '--thumb-height': `${clamp(Number(uiSettings.thumbnailHeight) || 160, 10, 320)}px`,
    '--thumb-width': `${clamp(Number(uiSettings.thumbnailWidth) || 180, 10, 320)}px`,
    '--thumb-label-size': `${clamp(Number(uiSettings.thumbnailLabelSize) || 14, 10, 28)}px`
  }), [uiSettings.thumbnailHeight, uiSettings.thumbnailWidth, uiSettings.thumbnailLabelSize]);

  const thumbnailRequestMax = useMemo(() => {
    const width = clamp(Number(uiSettings.thumbnailWidth) || 180, 10, 320);
    const height = clamp(Number(uiSettings.thumbnailHeight) || 160, 10, 320);
    return clamp(Math.round(Math.max(width, height) * 2), 120, 900);
  }, [uiSettings.thumbnailWidth, uiSettings.thumbnailHeight]);

  const previewPanelStyle = useMemo(() => ({
    '--detail-preview-height': `${clamp(Number(uiSettings.detailPreviewHeight) || 520, 320, 860)}px`
  }), [uiSettings.detailPreviewHeight]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil(total / Math.max(1, Number(pageSize) || 1));
    return Math.max(1, pages);
  }, [total, pageSize]);

  const layoutStyle = useMemo(() => ({
    '--left-pane-width': `${clamp(Number(paneSizes.left) || DEFAULT_PANE_SIZES.left, 220, 600)}px`,
    '--right-pane-width': `${clamp(Number(paneSizes.right) || DEFAULT_PANE_SIZES.right, 360, 900)}px`
  }), [paneSizes.left, paneSizes.right]);

  const refreshStatus = useCallback(async () => {
    const data = await api.status();
    setStatus(data);
    setOcrStatus(data.ocr || null);
    setStorageForm({
      storageDriver: normalizeDriver(data.storageDriver),
      mapLibraryDir: data.mapLibraryDir || '',
      webdav: {
        url: data.webdav?.url || '',
        username: data.webdav?.username || '',
        password: '',
        rootPath: data.webdav?.rootPath || '/'
      }
    });
    return data;
  }, []);

  const refreshOcrStatus = useCallback(async () => {
    try {
      const data = await api.ocrStatus();
      setOcrStatus(data);
    } catch (_err) {
      // ignore
    }
  }, []);

  const loadStorageFolders = useCallback(async (driver = status?.storageDriver) => {
    const normalizedDriver = normalizeDriver(driver);
    const activeDriver = normalizeDriver(status?.storageDriver);
    if (status?.storageDriver && normalizedDriver !== activeDriver) {
      setMessage('请先保存存储设置，再刷新目录列表');
      return;
    }
    try {
      let folders = [''];
      if (normalizedDriver === 'webdav') {
        const data = await api.listWebdavFolders(6);
        folders = pickFolders(data);
      } else {
        const data = await api.listLocalFolders(6);
        folders = pickFolders(data);
      }

      setFolderOptions(folders);
      setUploadFolder((prev) => (folders.includes(prev) ? prev : ''));
    } catch (err) {
      setError(err.message);
      setFolderOptions(['']);
      setUploadFolder('');
    }
  }, [status?.storageDriver]);

  const loadBrowser = useCallback(async (targetPath, driver = status?.storageDriver) => {
    if (normalizeDriver(driver) !== 'local') {
      return;
    }
    try {
      const data = await api.browseLocal(targetPath || storageForm.mapLibraryDir || '');
      setBrowserState({
        currentPath: data.currentPath || '',
        parentPath: data.parentPath || '',
        children: data.children || []
      });
    } catch (err) {
      setError(err.message);
    }
  }, [status?.storageDriver, storageForm.mapLibraryDir]);

  const loadFacets = useCallback(async (source) => {
    try {
      const data = await api.facets(source || undefined);
      setFacets(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadMaps = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.listMaps({ ...filters, page, limit: pageSize });
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
  }, [filters, page, pageSize, selectedId]);

  const loadChinaCities = useCallback(async () => {
    try {
      const data = await api.chinaCities();
      setChinaCityOptions(data.items || []);
    } catch (_err) {
      setChinaCityOptions([]);
    }
  }, []);

  const applyHint = useCallback((item, preserveInputCity = false) => {
    if (!item) return;
    setForm((prev) => ({
      ...prev,
      country_code: item.country_code || prev.country_code,
      country_name: item.country_name || prev.country_name,
      province: item.province || prev.province,
      city: preserveInputCity ? prev.city : (item.city || prev.city),
      latitude: item.latitude ?? prev.latitude,
      longitude: item.longitude ?? prev.longitude,
      scope_level: item.scope_level || (item.country_code === 'CN' ? 'national' : (prev.scope_level || 'international'))
    }));
  }, []);

  const resolveCityFromInput = useCallback(async (keyword) => {
    const q = String(keyword || '').trim();
    if (!q) return;

    setCityResolveBusy(true);
    try {
      const data = await api.resolveCity(q);
      if (data.item) {
        applyHint(data.item, false);
        setMessage(`已匹配：${data.item.country_name || ''} ${data.item.province || ''} ${data.item.city || ''}`.trim());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCityResolveBusy(false);
    }
  }, [applyHint]);

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

  const applyStorageSettings = async () => {
    const nextDriver = normalizeDriver(storageForm.storageDriver);

    const payload = {
      storageDriver: nextDriver
    };

    if (nextDriver === 'local') {
      const localPath = String(storageForm.mapLibraryDir || '').trim();
      if (localPath) {
        payload.mapLibraryDir = localPath;
      }
    } else {
      const webdavPayload = {
        url: String(storageForm.webdav?.url || '').trim(),
        username: String(storageForm.webdav?.username || '').trim(),
        rootPath: String(storageForm.webdav?.rootPath || '/').trim() || '/'
      };

      const password = String(storageForm.webdav?.password || '').trim();
      if (password) {
        webdavPayload.password = password;
      }

      payload.webdav = webdavPayload;
    }

    setBusy(true);
    try {
      const data = await api.saveStorageSettings(payload);
      const runtime = data.settings || {};

      setStatus((prev) => ({
        ...(prev || {}),
        storageDriver: runtime.storageDriver,
        mapLibraryDir: runtime.mapLibraryDir,
        webdav: runtime.webdav,
        project: data.project || prev?.project
      }));

      setStorageForm((prev) => ({
        ...prev,
        storageDriver: normalizeDriver(runtime.storageDriver),
        mapLibraryDir: runtime.mapLibraryDir || '',
        webdav: {
          url: runtime.webdav?.url || '',
          username: runtime.webdav?.username || '',
          password: '',
          rootPath: runtime.webdav?.rootPath || '/'
        }
      }));

      setFolderOptions(pickFolders(data));
      setUploadFolder('');

      if (runtime.storageDriver === 'local') {
        await loadBrowser(runtime.mapLibraryDir || '', runtime.storageDriver);
      } else {
        setBrowserState({ currentPath: '', parentPath: '', children: [] });
      }

      await loadMaps();
      await loadFacets(filters.source || undefined);
      await refreshOcrStatus();

      const scanned = data.scan?.scanned;
      if (typeof scanned === 'number') {
        setMessage(`存储设置已更新，扫描 ${scanned} 张图片`);
      } else {
        setMessage('存储设置已更新');
      }
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
          .filter(Boolean),
        auto_resolve_city: true
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
      await loadStorageFolders(status?.storageDriver);
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
      await loadStorageFolders(status?.storageDriver);
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

  const startResize = (pane, event) => {
    if (window.innerWidth <= 1280) return;
    event.preventDefault();
    resizeStateRef.current = {
      pane,
      startX: event.clientX,
      startLeft: clamp(Number(paneSizes.left) || DEFAULT_PANE_SIZES.left, 220, 600),
      startRight: clamp(Number(paneSizes.right) || DEFAULT_PANE_SIZES.right, 360, 900)
    };
    setResizingPane(pane);
  };

  const resetPaneSizes = () => {
    setPaneSizes(DEFAULT_PANE_SIZES);
  };

  useEffect(() => {
    refreshStatus()
      .then(async (data) => {
        await loadStorageFolders(data.storageDriver);
        if (data.storageDriver === 'local') {
          await loadBrowser(data.mapLibraryDir || '', data.storageDriver);
        }
      })
      .catch((err) => setError(err.message));

    loadChinaCities();
  }, [refreshStatus, loadBrowser, loadStorageFolders, loadChinaCities]);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    loadFacets(filters.source || undefined);
  }, [filters.source, loadFacets]);

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
    }, 320);

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

  useEffect(() => {
    localStorage.setItem('roamly-ui-settings', JSON.stringify(uiSettings));
  }, [uiSettings]);

  useEffect(() => {
    localStorage.setItem('roamly-pane-sizes', JSON.stringify(paneSizes));
  }, [paneSizes]);

  useEffect(() => {
    localStorage.setItem('roamly-page-size', String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
      return;
    }
    setPageInput(String(page));
  }, [page, totalPages]);

  useEffect(() => {
    if (!resizingPane) return;

    const onMouseMove = (event) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const totalWidth = layoutRef.current?.clientWidth || window.innerWidth;
      const minCenterWidth = 420;
      const gutters = 20;
      const deltaX = event.clientX - state.startX;

      if (state.pane === 'left') {
        const maxLeft = Math.max(240, totalWidth - state.startRight - minCenterWidth - gutters);
        const nextLeft = clamp(state.startLeft + deltaX, 220, maxLeft);
        setPaneSizes((prev) => ({ ...prev, left: nextLeft }));
        return;
      }

      const maxRight = Math.max(380, totalWidth - state.startLeft - minCenterWidth - gutters);
      const nextRight = clamp(state.startRight - deltaX, 360, maxRight);
      setPaneSizes((prev) => ({ ...prev, right: nextRight }));
    };

    const onMouseUp = () => {
      resizeStateRef.current = null;
      setResizingPane('');
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.classList.add('resizing-panes');

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('resizing-panes');
    };
  }, [resizingPane]);

  return (
    <div className="page-root">
      <header className="topbar">
        <div className="brand">Roamly 地图库</div>
        <div className="status">
          <span>存储: {status?.storageDriver || '-'}</span>
          <span>
            根目录: {status?.storageDriver === 'webdav'
              ? (status?.webdav?.rootPath || '/')
              : (status?.mapLibraryDir || '未设置')}
          </span>
          <span>
            OCR: {ocrStatus?.available ? `可用(队列${ocrStatus.queueSize || 0})` : '不可用'}
          </span>
        </div>
        <div className="actions">
          <button onClick={() => setSettingsOpen(true)}>设置</button>
          <button onClick={handleScan} disabled={busy}>重扫目录</button>
        </div>
      </header>

      <main
        ref={layoutRef}
        className={resizingPane ? 'layout is-resizing' : 'layout'}
        style={layoutStyle}
      >
        <aside className="left-pane pane">
          <div className="pane-title">目录分类</div>
          <div className="facet-group">
            <h4>国家</h4>
            {facets.country.slice(0, 20).map((item, index) => {
              const label = String(item.value || '').trim() || 'Unknown';
              const selected = String(filters.country || '').trim().toLowerCase() === label.toLowerCase();
              return (
                <button
                  key={`country-${label}-${index}`}
                  className={selected ? 'facet active' : 'facet'}
                  onClick={() => patchFilters({
                    country: selected ? '' : label,
                    city: '',
                    province: ''
                  })}
                >
                  <span>{label}</span>
                  <strong>{item.count}</strong>
                </button>
              );
            })}
          </div>
          <div className="facet-group">
            <h4>城市</h4>
            {facets.city.slice(0, 24).map((item, index) => {
              const label = String(item.value || '').trim() || 'Unknown';
              const selected = String(filters.city || '').trim().toLowerCase() === label.toLowerCase();
              return (
                <button
                  key={`city-${label}-${index}`}
                  className={selected ? 'facet active' : 'facet'}
                  onClick={() => patchFilters({
                    city: selected ? '' : label,
                    country: '',
                    province: ''
                  })}
                >
                  <span>{label}</span>
                  <strong>{item.count}</strong>
                </button>
              );
            })}
          </div>
          <div className="facet-group globe-filter-wrap">
            <h4>全球交互筛选</h4>
            <div className="globe-filter-actions">
              <button
                onClick={() => patchFilters({
                  scope: '',
                  country: '全球',
                  city: '',
                  province: ''
                })}
              >
                返回全球
              </button>
              <button
                onClick={() => patchFilters({
                  scope: '',
                  country: '',
                  city: '',
                  province: ''
                })}
              >
                查看全部
              </button>
            </div>
            <GlobeCountryPicker
              selectedCountry={filters.country}
              onPickCountry={(item) => {
                patchFilters({
                  scope: '',
                  country: item.country || item.country_en || '',
                  province: '',
                  city: ''
                });
              }}
            />
            <div className="china-tip">点击地球国家可筛选包含该国家的地图（含全球/East Asia 等跨国图）。</div>
          </div>
        </aside>

        <div
          className={resizingPane === 'left' ? 'pane-resizer active' : 'pane-resizer'}
          onMouseDown={(event) => startResize('left', event)}
          onDoubleClick={resetPaneSizes}
          title="拖拽调整左栏宽度，双击恢复默认"
        />

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

          <div className="count-line">
            <span>共 {total} 张，{totalPages} 页，当前第 {page} 页</span>
            <div className="count-controls">
              <label>
                每页
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const next = clamp(Number(e.target.value || 18), 6, 120);
                    setPageSize(next);
                    setPage(1);
                  }}
                >
                  {[6, 10, 18, 24, 36, 48, 60, 96].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
              <label>
                跳页
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => {
                    const nextPage = clamp(Number(pageInput || page), 1, totalPages);
                    setPage(nextPage);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    const nextPage = clamp(Number(pageInput || page), 1, totalPages);
                    setPage(nextPage);
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const nextPage = clamp(Number(pageInput || page), 1, totalPages);
                  setPage(nextPage);
                }}
              >
                跳转
              </button>
            </div>
          </div>

          <div className="card-grid" style={cardGridStyle}>
            {maps.map((item) => (
              <article
                key={item.id}
                className={selectedId === item.id ? 'map-card active' : 'map-card'}
                onClick={() => setSelectedId(item.id)}
              >
                <img
                  src={buildFileUrl(item.id, { max: thumbnailRequestMax, quality: 60, v: item.mtime_ms || '' })}
                  alt={item.title || item.file_name}
                  loading="lazy"
                  decoding="async"
                />

                {uiSettings.thumbnailLabelVisible ? (
                  <div className="map-card-body">
                    <div className="map-card-title">{item.title || item.file_name}</div>
                    <div className="map-card-meta">
                      <span>{item.city || item.country_name || '未定位'}</span>
                      <span>{item.favorite ? '★' : ''}</span>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="pager">
            <button onClick={() => setPage(1)} disabled={page <= 1}>首页</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</button>
            <span>第 {page} 页</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>下一页</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}>末页</button>
          </div>
        </section>

        <div
          className={resizingPane === 'right' ? 'pane-resizer active' : 'pane-resizer'}
          onMouseDown={(event) => startResize('right', event)}
          onDoubleClick={resetPaneSizes}
          title="拖拽调整右栏宽度，双击恢复默认"
        />

        <aside className="right-pane pane">
          <div className="detail-header">
            <h3>{selectedSummary?.title || '未选择地图'}</h3>
            <button onClick={toggleFavorite} disabled={!selectedSummary}>
              {selectedSummary?.favorite ? '取消收藏' : '加入收藏'}
            </button>
          </div>

          {selectedMap ? (
            <>
              <div className="preview-wrap" style={previewPanelStyle}>
                <TransformWrapper
                  key={selectedMap.id}
                  initialScale={1}
                  minScale={0.3}
                  maxScale={18}
                  centerOnInit
                  smooth={false}
                  wheel={{
                    step: 0.16,
                    smoothStep: 0.005,
                    touchPadDisabled: false,
                    wheelDisabled: false
                  }}
                  pinch={{ step: 4 }}
                  zoomAnimation={{ disabled: true }}
                  alignmentAnimation={{ disabled: true }}
                  velocityAnimation={{ disabled: true }}
                  panning={{ velocityDisabled: true }}
                  doubleClick={{
                    mode: 'zoomIn',
                    step: 1.4,
                    animationTime: 80
                  }}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div className="preview-toolbar">
                        <button onClick={() => zoomIn()}>放大</button>
                        <button onClick={() => zoomOut()}>缩小</button>
                        <button onClick={() => resetTransform()}>重置</button>
                        <button onClick={() => setViewerOpen(true)}>全屏查看</button>
                      </div>
                      <TransformComponent
                        wrapperClass="preview-transform-wrapper"
                        contentClass="preview-transform-content"
                      >
                        <img
                          className="preview"
                          src={detailImageSrc}
                          alt={selectedMap.title || selectedMap.file_name}
                          loading="eager"
                          decoding="async"
                        />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
                <div className="preview-tip">触控板/滚轮可缩放，拖拽可平移</div>
              </div>

              <div className="file-meta">
                <span>ID: {selectedMap.id.slice(0, 12)}</span>
                <span>{selectedMap.width || '-'} x {selectedMap.height || '-'}</span>
                <span>{selectedMap.mime || '-'}</span>
                <span>{formatBytes(selectedMap.size_bytes)}</span>
                <span>{formatDate(selectedMap.mtime_ms)}</span>
                <span>OCR: {selectedMap.ocr_status || 'pending'}</span>
              </div>

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
                <div className="form-grid compact">
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
                    市（可直接输入地级市自动匹配）
                    <input
                      value={form.city}
                      list="china-city-datalist"
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      onBlur={() => resolveCityFromInput(form.city)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          resolveCityFromInput(form.city);
                        }
                      }}
                    />
                    <datalist id="china-city-datalist">
                      {chinaCityOptions.map((item) => (
                        <option key={`${item.province}-${item.city}`} value={item.city}>{item.province} / {item.city}</option>
                      ))}
                    </datalist>
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

                  <div className="full city-tools">
                    <select
                      value=""
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!value) return;
                        const [province, city] = value.split('|');
                        const item = chinaCityOptions.find((it) => it.province === province && it.city === city);
                        if (item) {
                          applyHint({
                            ...item,
                            scope_level: 'national'
                          }, false);
                        }
                      }}
                    >
                      <option value="">从地级市列表快速选择</option>
                      {chinaCityOptions.map((item) => (
                        <option key={`${item.province}|${item.city}`} value={`${item.province}|${item.city}`}>
                          {item.province} / {item.city}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => resolveCityFromInput(form.city)} disabled={cityResolveBusy || !form.city.trim()}>
                      {cityResolveBusy ? '匹配中...' : '自动匹配地级市'}
                    </button>
                  </div>

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
                        style={{ height: 200, width: '100%' }}
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

            <div className="settings-block">
              <h4>显示设置</h4>
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={Boolean(uiSettings.thumbnailLabelVisible)}
                  onChange={(e) => setUiSettings((prev) => ({ ...prev, thumbnailLabelVisible: e.target.checked }))}
                />
                显示缩略图文字
              </label>
              <label className="settings-slider">
                缩略图文字大小: {clamp(Number(uiSettings.thumbnailLabelSize) || 14, 10, 28)}
                <input
                  type="range"
                  min="10"
                  max="28"
                  value={clamp(Number(uiSettings.thumbnailLabelSize) || 14, 10, 28)}
                  onChange={(e) => setUiSettings((prev) => ({ ...prev, thumbnailLabelSize: Number(e.target.value) }))}
                />
              </label>
              <label className="settings-slider">
                缩略图宽度: {clamp(Number(uiSettings.thumbnailWidth) || 180, 10, 320)} px
                <input
                  type="range"
                  min="10"
                  max="320"
                  value={clamp(Number(uiSettings.thumbnailWidth) || 180, 10, 320)}
                  onChange={(e) => setUiSettings((prev) => ({ ...prev, thumbnailWidth: Number(e.target.value) }))}
                />
              </label>
              <label className="settings-slider">
                缩略图高度: {clamp(Number(uiSettings.thumbnailHeight) || 160, 10, 320)} px
                <input
                  type="range"
                  min="10"
                  max="320"
                  value={clamp(Number(uiSettings.thumbnailHeight) || 160, 10, 320)}
                  onChange={(e) => setUiSettings((prev) => ({ ...prev, thumbnailHeight: Number(e.target.value) }))}
                />
              </label>
              <label className="settings-slider">
                右侧主图高度: {clamp(Number(uiSettings.detailPreviewHeight) || 520, 320, 860)} px
                <input
                  type="range"
                  min="320"
                  max="860"
                  value={clamp(Number(uiSettings.detailPreviewHeight) || 520, 320, 860)}
                  onChange={(e) => setUiSettings((prev) => ({ ...prev, detailPreviewHeight: Number(e.target.value) }))}
                />
              </label>
              <div className="settings-tip">中间两条分隔线可拖拽，左右三栏支持宽度调整。</div>
            </div>

            <div className="settings-block">
              <h4>存储设置</h4>
              <label>
                存储模式
                <select
                  value={storageForm.storageDriver}
                  onChange={(e) => setStorageForm((prev) => ({ ...prev, storageDriver: normalizeDriver(e.target.value) }))}
                >
                  <option value="local">本地目录</option>
                  <option value="webdav">WebDAV</option>
                </select>
              </label>

              {storageForm.storageDriver === 'local' ? (
                <>
                  <div className="library-row">
                    <input
                      value={storageForm.mapLibraryDir}
                      onChange={(e) => setStorageForm((prev) => ({ ...prev, mapLibraryDir: e.target.value }))}
                      placeholder="输入本地地图目录"
                    />
                    <button onClick={applyStorageSettings} disabled={busy}>设置目录</button>
                    <button onClick={() => loadBrowser(browserState.currentPath || storageForm.mapLibraryDir)} disabled={busy}>刷新浏览</button>
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
                          setStorageForm((prev) => ({ ...prev, mapLibraryDir: item.path }));
                          loadBrowser(item.path);
                        }}
                        title={item.path}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="webdav-grid">
                  <label>
                    WebDAV URL
                    <input
                      value={storageForm.webdav.url}
                      onChange={(e) => setStorageForm((prev) => ({
                        ...prev,
                        webdav: { ...prev.webdav, url: e.target.value }
                      }))}
                      placeholder="https://example.com/remote.php/dav/files/user"
                    />
                  </label>
                  <label>
                    用户名
                    <input
                      value={storageForm.webdav.username}
                      onChange={(e) => setStorageForm((prev) => ({
                        ...prev,
                        webdav: { ...prev.webdav, username: e.target.value }
                      }))}
                    />
                  </label>
                  <label>
                    密码（留空表示保持不变）
                    <input
                      type="password"
                      value={storageForm.webdav.password}
                      onChange={(e) => setStorageForm((prev) => ({
                        ...prev,
                        webdav: { ...prev.webdav, password: e.target.value }
                      }))}
                    />
                  </label>
                  <label>
                    根目录
                    <input
                      value={storageForm.webdav.rootPath}
                      onChange={(e) => setStorageForm((prev) => ({
                        ...prev,
                        webdav: { ...prev.webdav, rootPath: e.target.value }
                      }))}
                      placeholder="/maps"
                    />
                  </label>
                </div>
              )}

              <div className="settings-actions">
                <button onClick={applyStorageSettings} disabled={busy}>保存存储设置并扫描</button>
                <button onClick={() => loadStorageFolders(storageForm.storageDriver)} disabled={busy}>刷新目录列表</button>
              </div>
              <div className="settings-line">项目键: {status?.project?.projectKey || '-'}</div>
              <div className="settings-line">项目根目录: {status?.project?.root || '-'}</div>
              <div className="settings-line">缓存文件: {status?.project?.cacheFile || '-'}</div>
            </div>

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
            <TransformWrapper
              key={`viewer-${selectedMap.id}`}
              initialScale={1}
              minScale={0.25}
              maxScale={16}
              centerOnInit
              smooth={false}
              wheel={{
                step: 0.22,
                smoothStep: 0.005,
                wheelDisabled: false,
                touchPadDisabled: false
              }}
              zoomAnimation={{ disabled: true }}
              alignmentAnimation={{ disabled: true }}
              velocityAnimation={{ disabled: true }}
              pinch={{
                step: 4
              }}
              doubleClick={{
                mode: 'zoomIn',
                step: 1.4,
                animationTime: 90
              }}
              panning={{
                velocityDisabled: true,
                wheelPanning: false
              }}
            >
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
                      src={viewerImageSrc}
                      alt={selectedMap.title || selectedMap.file_name}
                      loading="eager"
                      decoding="async"
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
