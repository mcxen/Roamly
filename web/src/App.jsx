import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import FileManager from './components/FileManager.jsx';
import Discover from './components/Discover.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import ImageViewer from './components/ImageViewer.jsx';
import DetailPane from './components/DetailPane.jsx';
import StatsPanel from './components/StatsPanel.jsx';

const STORAGE_BAND_OPTIONS = [
  { value: '', label: '未设置' },
  { value: 'red', label: '红条' },
  { value: 'orange', label: '橙条' },
  { value: 'yellow', label: '黄条' },
  { value: 'green', label: '绿条' },
  { value: 'cyan', label: '青条' },
  { value: 'blue', label: '蓝条' },
  { value: 'purple', label: '紫条' }
];

const DEFAULT_FILTERS = {
  q: '',
  scope: '',
  country: '',
  province: '',
  city: '',
  favorite: ''
};

const emptyForm = {
  title: '',
  description: '',
  tags: '',
  collection_unit: '',
  scope_level: '',
  campaign: '',
  teaching_use: '',
  teaching_note: '',
  security_level: '',
  storage_band: '',
  country_code: '',
  country_name: '',
  province: '',
  related_countries: '',
  related_provinces: '',
  city: '',
  district: '',
  latitude: '',
  longitude: '',
  year_label: ''
};

const emptyUploadMeta = {
  title: '',
  description: '',
  tags: '',
  collection_unit: '',
  scope_level: '',
  campaign: '',
  teaching_use: '',
  teaching_note: '',
  security_level: '',
  storage_band: '',
  country_code: '',
  country_name: '',
  province: '',
  related_countries: '',
  related_provinces: '',
  city: '',
  district: '',
  latitude: '',
  longitude: '',
  year_label: '',
  favorite: false,
  auto_resolve_city: true
};

const DEFAULT_STORAGE_FORM = {
  storageDriver: 'local',
  mapLibraryDir: '',
  serverMapDir: '',
  webdav: {
    url: '',
    username: '',
    password: '',
    rootPath: '/'
  }
};

const DEFAULT_AI_FORM = {
  apiUrl: '',
  apiKey: '',
  model: '',
  provider: 'openai-compatible',
  systemPrompt: ''
};

const AI_PROVIDER_OPTIONS = [
  { value: 'openai-compatible', label: 'OpenAI 兼容（自定义）' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'moonshot', label: 'Moonshot AI (Kimi)' },
  { value: 'zhipu', label: '智谱 AI (GLM)' },
  { value: 'qwen', label: '通义千问' },
  { value: 'doubao', label: '豆包 (火山引擎)' }
];

const DEFAULT_UI_SETTINGS = {
  thumbnailLabelVisible: true,
  thumbnailLabelSize: 14,
  thumbnailHeight: 160,
  thumbnailWidth: 180,
  detailPreviewHeight: 440
};

const DEFAULT_PANE_SIZES = {
  right: 620
};

const LAYOUT_MIN_CENTER = 420;
const LAYOUT_COLUMN_GAP = 6;
const LAYOUT_RESIZER_WIDTH = 8;
const LAYOUT_GUTTERS = LAYOUT_RESIZER_WIDTH + LAYOUT_COLUMN_GAP * 2;
const LAYOUT_BASE_PADDING = 10;

const buildFileUrl = (id, params = {}) => {
  const safeId = encodeURIComponent(String(id || '').trim());
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });

  const suffix = query.toString();
  return `/api/files/${safeId}${suffix ? `?${suffix}` : ''}`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const splitMultiValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[;,，；/、|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const joinMultiValue = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value);
};

const resolveRegionConfig = (country) => {
  const raw = String(country || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return REGION_2D_CONFIGS.find((item) =>
    item.matches.some((value) => String(value).toLowerCase() === lower)
  ) || null;
};

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
  return value === 'webdav' ? 'webdav' : (value === 'server' ? 'server' : 'local');
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

const buildOcrHighlights = (map, keyword) => {
  const q = String(keyword || '').trim().toLowerCase();
  if (!q || !Array.isArray(map?.ocr_blocks)) return [];
  return map.ocr_blocks.filter((item) => String(item?.text || '').toLowerCase().includes(q));
};

const normalizeOutlinePoints = (outline) => {
  if (!Array.isArray(outline)) return [];
  return outline
    .map((point) => ({
      x: clamp(Number(point?.x), 0, 1),
      y: clamp(Number(point?.y), 0, 1)
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
};

const outlineToSvgPoints = (outline) => normalizeOutlinePoints(outline)
  .map((point) => `${(point.x * 100).toFixed(2)},${(point.y * 100).toFixed(2)}`)
  .join(' ');

function App() {
  const [status, setStatus] = useState(null);
  const [ocrStatus, setOcrStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('library');
  const [mcpInfo, setMcpInfo] = useState(null);
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
  const [uploadMeta, setUploadMeta] = useState(emptyUploadMeta);
  const [uploadMetaOpen, setUploadMetaOpen] = useState(false);
  const [uploadAdvancedOpen, setUploadAdvancedOpen] = useState(false);
  const [folderOptions, setFolderOptions] = useState(['']);
  const [browserState, setBrowserState] = useState({
    currentPath: '',
    parentPath: '',
    children: []
  });
  const [storageForm, setStorageForm] = useState(DEFAULT_STORAGE_FORM);
  const [aiForm, setAIForm] = useState(DEFAULT_AI_FORM);
  const [aiBusy, setAIBusy] = useState(false);
  const [aiModels, setAIModels] = useState([]);
  const [aiModelsBusy, setAIModelsBusy] = useState(false);
  const [aiTestResult, setAITestResult] = useState(null);
  const [aiTestBusy, setAITestBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uiSettings, setUiSettings] = useState(() => loadJsonFromStorage('roamly-ui-settings', DEFAULT_UI_SETTINGS));
  const [paneSizes, setPaneSizes] = useState(() => loadJsonFromStorage('roamly-pane-sizes', DEFAULT_PANE_SIZES));
  const [resizingPane, setResizingPane] = useState('');
  const [layoutContentWidth, setLayoutContentWidth] = useState(0);

  const layoutRef = useRef(null);
  const resizeStateRef = useRef(null);
  const aiModelsKeyRef = useRef('');

  const getLayoutContentWidth = useCallback(() => {
    const node = layoutRef.current;
    if (!node || typeof window === 'undefined') return 0;
    const styles = window.getComputedStyle(node);
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    return Math.max(0, node.clientWidth - paddingLeft - paddingRight);
  }, []);

  const selectedSummary = useMemo(() => maps.find((item) => item.id === selectedId) || null, [maps, selectedId]);
  const detailImageSrc = useMemo(() => {
    if (!selectedMap?.id) return '';
    return buildFileUrl(selectedMap.id, { v: selectedMap?.mtime_ms || '' });
  }, [selectedMap?.id, selectedMap?.mtime_ms]);
  const viewerImageSrc = useMemo(() => {
    if (!selectedMap?.id) return '';
    return buildFileUrl(selectedMap.id, { v: selectedMap?.mtime_ms || '' });
  }, [selectedMap?.id, selectedMap?.mtime_ms]);
  const ocrHighlights = useMemo(() => buildOcrHighlights(selectedMap, filters.q || queryInput), [selectedMap, filters.q, queryInput]);
  const coverageOutlinePoints = useMemo(() => outlineToSvgPoints(selectedMap?.coverage_outline), [selectedMap?.coverage_outline]);
  const hasCoverageOutline = Boolean(coverageOutlinePoints);

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

  const maxRightPaneWidth = useMemo(() => {
    if (!layoutContentWidth) return 900;
    const available = layoutContentWidth - LAYOUT_MIN_CENTER - LAYOUT_GUTTERS;
    return Math.max(360, Math.min(900, available));
  }, [layoutContentWidth]);

  const rightPaneWidth = useMemo(() => {
    const preferred = Number(paneSizes.right) || DEFAULT_PANE_SIZES.right;
    return clamp(preferred, 360, maxRightPaneWidth || 900);
  }, [paneSizes.right, maxRightPaneWidth]);

  const layoutStyle = useMemo(() => ({
    '--right-pane-width': `${rightPaneWidth}px`
  }), [rightPaneWidth]);

  const refreshStatus = useCallback(async () => {
    const data = await api.status();
    setStatus(data);
    setOcrStatus(data.ocr || null);
    setStorageForm({
      storageDriver: normalizeDriver(data.storageDriver),
      mapLibraryDir: data.mapLibraryDir || '',
      serverMapDir: data.serverMapDir || '',
      webdav: {
        url: data.webdav?.url || '',
        username: data.webdav?.username || '',
        password: '',
        rootPath: data.webdav?.rootPath || '/'
      }
    });
    setAIForm({
      apiUrl: data.ai?.apiUrl || '',
      apiKey: '',
      model: data.ai?.model || '',
      provider: data.ai?.provider || 'openai-compatible',
      systemPrompt: data.ai?.systemPrompt || ''
    });
    api.mcpTools()
      .then((info) => setMcpInfo(info))
      .catch(() => setMcpInfo(null));
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
    if (!['local', 'server'].includes(normalizeDriver(driver))) {
      return;
    }
    try {
      const basePath = normalizeDriver(driver) === 'server'
        ? (targetPath || storageForm.serverMapDir || '')
        : (targetPath || storageForm.mapLibraryDir || '');
      const data = await api.browseLocal(basePath);
      setBrowserState({
        currentPath: data.currentPath || '',
        parentPath: data.parentPath || '',
        children: data.children || []
      });
    } catch (err) {
      setError(err.message);
    }
  }, [status?.storageDriver, storageForm.mapLibraryDir, storageForm.serverMapDir]);

  const loadFacets = useCallback(async (country) => {
    try {
      const data = await api.facets({
        source: status?.storageDriver || undefined,
        country: country || undefined
      });
      setFacets(data);
    } catch (err) {
      setError(err.message);
    }
  }, [status?.storageDriver]);

  const loadMaps = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.listMaps({ ...filters, source: status?.storageDriver || undefined, page, limit: pageSize });
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
  }, [filters, page, pageSize, selectedId, status?.storageDriver]);

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
    } else if (nextDriver === 'server') {
      const serverPath = String(storageForm.serverMapDir || '').trim();
      if (serverPath) {
        payload.serverMapDir = serverPath;
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
        serverMapDir: runtime.serverMapDir,
        webdav: runtime.webdav,
        project: data.project || prev?.project
      }));

      setStorageForm((prev) => ({
        ...prev,
        storageDriver: normalizeDriver(runtime.storageDriver),
        mapLibraryDir: runtime.mapLibraryDir || '',
        serverMapDir: runtime.serverMapDir || '',
        webdav: {
          url: runtime.webdav?.url || '',
          username: runtime.webdav?.username || '',
          password: '',
          rootPath: runtime.webdav?.rootPath || '/'
        }
      }));

      setFolderOptions(pickFolders(data));
      setUploadFolder('');

      if (runtime.storageDriver === 'local' || runtime.storageDriver === 'server') {
        await loadBrowser(runtime.storageDriver === 'server' ? (runtime.serverMapDir || '') : (runtime.mapLibraryDir || ''), runtime.storageDriver);
      } else {
        setBrowserState({ currentPath: '', parentPath: '', children: [] });
      }

      await loadMaps();
      await loadFacets(filters.country || undefined);
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
      const multiLocationPattern = /[;,，；/、|]/;
      const hasMultiLocation = multiLocationPattern.test(form.province || '')
        || multiLocationPattern.test(form.city || '');
      const relatedCountries = splitMultiValue(form.related_countries);
      const relatedProvinces = splitMultiValue(form.related_provinces);
      await api.saveMap(selectedId, {
        ...form,
        tags: form.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        related_countries: relatedCountries,
        related_provinces: relatedProvinces,
        auto_resolve_city: !hasMultiLocation
      });
      setMessage('已保存元数据');
      await loadMaps();
      await loadFacets(filters.country || undefined);
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
      setMessage(`扫描完成: ${data.scanned} 张，已预热 ${data.prewarm?.queued || 0} 张缩略图`);
      await loadMaps();
      await loadFacets(filters.country || undefined);
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
      const result = await api.upload(uploadFiles, uploadFolder, uploadMeta);
      setUploadFiles([]);
      setUploadMeta(emptyUploadMeta);
      setMessage(`上传并复制完成: ${result.count} 张，已预热 ${result.prewarm?.queued || 0} 张缩略图`);
      await loadMaps();
      await loadFacets(filters.country || undefined);
      await loadStorageFolders(status?.storageDriver);
      await refreshOcrStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFileDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) {
      setUploadFiles(files);
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

  const saveAISettings = async () => {
    setAIBusy(true);
    try {
      const payload = {
        apiUrl: aiForm.apiUrl,
        model: aiForm.model,
        provider: aiForm.provider,
        systemPrompt: aiForm.systemPrompt
      };
      if (String(aiForm.apiKey || '').trim()) {
        payload.apiKey = aiForm.apiKey;
      }
      const data = await api.saveAISettings(payload);
      setAIForm((prev) => ({
        ...prev,
        apiUrl: data.apiUrl || '',
        apiKey: '',
        model: data.model || '',
        provider: data.provider || 'openai-compatible',
        systemPrompt: data.systemPrompt || ''
      }));
      setMessage('AI 设置已保存');
    } catch (err) {
      setError(err.message);
    } finally {
      setAIBusy(false);
    }
  };

  const fetchAIModels = useCallback(async (force = false) => {
    const key = `${String(aiForm.apiUrl || '').trim()}|${String(aiForm.provider || '').trim()}|${Boolean(String(aiForm.apiKey || '').trim())}`;
    if (!force && aiModelsKeyRef.current === key && aiModels.length) {
      return;
    }
    setAIModelsBusy(true);
    try {
      const payload = {
        apiUrl: aiForm.apiUrl,
        provider: aiForm.provider
      };
      if (String(aiForm.apiKey || '').trim()) {
        payload.apiKey = aiForm.apiKey;
      }
      const data = await api.aiModels(payload);
      const models = Array.isArray(data.models) ? data.models : [];
      setAIModels(models);
      aiModelsKeyRef.current = key;
      if (models.length && !models.some((item) => item.id === aiForm.model)) {
        const preferred = models.find((item) => item.id === 'kimi-k2.6')
          || models.find((item) => /kimi|gpt|qwen|glm|claude/i.test(item.id))
          || models[0];
        if (!aiForm.model && preferred?.id) {
          setAIForm((prev) => ({ ...prev, model: preferred.id }));
        }
      }
      setMessage(`已获取 ${models.length} 个模型`);
    } catch (err) {
      setError(err.message);
    } finally {
      setAIModelsBusy(false);
    }
  }, [aiForm.apiKey, aiForm.apiUrl, aiForm.model, aiForm.provider, aiModels.length]);

  const testAIConnection = async () => {
    setAITestBusy(true);
    setAITestResult(null);
    try {
      const payload = {
        provider: aiForm.provider,
        apiUrl: aiForm.apiUrl,
        model: aiForm.model
      };
      if (String(aiForm.apiKey || '').trim()) {
        payload.apiKey = aiForm.apiKey;
      }
      const data = await api.aiTest(payload);
      setAITestResult({
        ok: true,
        latency: data.latency,
        response: data.response,
        model: data.model
      });
      setMessage(`连接测试成功，延迟 ${data.latency}ms`);
    } catch (err) {
      setAITestResult({ ok: false, error: err.message });
      setError(`连接测试失败: ${err.message}`);
    } finally {
      setAITestBusy(false);
    }
  };

  const handleBatchAIExtract = async () => {
    const ids = maps.map((item) => item.id).slice(0, 10);
    if (!ids.length) return;
    setAIBusy(true);
    try {
      const data = await api.batchExtractAIMaps(ids, { includeImage: true });
      const successCount = data.total || 0;
      const errorCount = data.errors?.length || 0;
      setMessage(`批量 AI 提取完成: 成功 ${successCount} 张${errorCount ? `，失败 ${errorCount} 张` : ''}`);
      await loadMaps();
      await loadFacets(filters.country || undefined);
      if (selectedId && data.results?.some((r) => r.id === selectedId)) {
        const detail = await api.map(selectedId);
        setSelectedMap(detail);
        setForm({
          title: detail.title || '',
          description: detail.description || '',
          tags: (detail.tags || []).join(', '),
          collection_unit: detail.collection_unit || '',
          scope_level: detail.scope_level || '',
          campaign: detail.campaign || '',
          teaching_use: detail.teaching_use || '',
          teaching_note: detail.teaching_note || '',
          security_level: detail.security_level || '',
          storage_band: detail.storage_band || '',
          country_code: detail.country_code || '',
          country_name: detail.country_name || '',
          province: detail.province || '',
          related_countries: joinMultiValue(detail.related_countries),
          related_provinces: joinMultiValue(detail.related_provinces),
          city: detail.city || '',
          district: detail.district || '',
          latitude: detail.latitude ?? '',
          longitude: detail.longitude ?? '',
          year_label: detail.year_label || ''
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAIBusy(false);
    }
  };

  const handleAIExtract = async () => {
    if (!selectedMap?.id) return;
    setAIBusy(true);
    try {
      const data = await api.extractAIMap(selectedMap.id, { includeImage: true });
      const updated = data.item || data;
      setSelectedMap(updated);
      setForm({
        title: updated.title || '',
        description: updated.description || '',
        tags: (updated.tags || []).join(', '),
        collection_unit: updated.collection_unit || '',
        scope_level: updated.scope_level || '',
        campaign: updated.campaign || '',
        teaching_use: updated.teaching_use || '',
        teaching_note: updated.teaching_note || '',
        security_level: updated.security_level || '',
        storage_band: updated.storage_band || '',
        country_code: updated.country_code || '',
        country_name: updated.country_name || '',
        province: updated.province || '',
        related_countries: joinMultiValue(updated.related_countries),
        related_provinces: joinMultiValue(updated.related_provinces),
        city: updated.city || '',
        district: updated.district || '',
        latitude: updated.latitude ?? '',
        longitude: updated.longitude ?? '',
        year_label: updated.year_label || ''
      });
      setSelectedId(updated.id);
      await loadMaps();
      await loadFacets(filters.country || undefined);
      setMessage('AI 提取完成，已更新元数据和缩略图轮廓');
    } catch (err) {
      setError(err.message);
    } finally {
      setAIBusy(false);
    }
  };

  const startResize = (pane, event) => {
    if (window.innerWidth <= 1280) return;
    event.preventDefault();
    resizeStateRef.current = {
      pane,
      startX: event.clientX,
      startRight: rightPaneWidth
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
    api.stats().then(setStats).catch(() => {});
  }, [refreshStatus, loadBrowser, loadStorageFolders, loadChinaCities]);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    loadFacets(filters.country || undefined);
  }, [filters.country, loadFacets]);

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
          campaign: data.campaign || '',
          teaching_use: data.teaching_use || '',
          teaching_note: data.teaching_note || '',
          security_level: data.security_level || '',
          storage_band: data.storage_band || '',
          country_code: data.country_code || '',
          country_name: data.country_name || '',
          province: data.province || '',
          related_countries: joinMultiValue(data.related_countries),
          related_provinces: joinMultiValue(data.related_provinces),
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
    if (!settingsOpen || !String(aiForm.apiUrl || '').trim()) return;
    fetchAIModels(false);
  }, [settingsOpen, aiForm.apiUrl, aiForm.provider, fetchAIModels]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 3500);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!viewerOpen) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') { setViewerOpen(false); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const idx = maps.findIndex((m) => m.id === selectedId);
        if (idx > 0) setSelectedId(maps[idx - 1].id);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const idx = maps.findIndex((m) => m.id === selectedId);
        if (idx >= 0 && idx < maps.length - 1) setSelectedId(maps[idx + 1].id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewerOpen, maps, selectedId]);

  useEffect(() => {
    localStorage.setItem('roamly-ui-settings', JSON.stringify(uiSettings));
  }, [uiSettings]);

  useEffect(() => {
    localStorage.setItem('roamly-pane-sizes', JSON.stringify(paneSizes));
  }, [paneSizes]);

  useEffect(() => {
    localStorage.setItem('roamly-page-size', String(pageSize));
  }, [pageSize]);

  const measureLayout = useCallback(() => {
    const width = getLayoutContentWidth();
    if (!width) return;
    setLayoutContentWidth(width);
  }, [getLayoutContentWidth]);

  useEffect(() => {
    measureLayout();
  }, [measureLayout]);

  useEffect(() => {
    const node = layoutRef.current;
    if (!node) return;
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measureLayout());
      observer.observe(node);
    }
    window.addEventListener('resize', measureLayout);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', measureLayout);
    };
  }, [measureLayout]);

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

      const totalWidth = getLayoutContentWidth() || window.innerWidth;
      const deltaX = event.clientX - state.startX;

      const maxRight = Math.max(360, Math.min(900, totalWidth - LAYOUT_MIN_CENTER - LAYOUT_GUTTERS));
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
          <span>当前系统: {status?.storageDriver || '-'}</span>
          <span>
            根目录: {status?.storageDriver === 'webdav'
              ? (status?.webdav?.rootPath || '/')
              : (status?.storageDriver === 'server'
                ? (status?.serverMapDir || '未设置')
                : (status?.mapLibraryDir || '未设置'))}
          </span>
        </div>
        <div className="actions">
          <button className={viewMode === 'library' ? 'active' : ''} onClick={() => setViewMode('library')}>图库</button>
          <button className={viewMode === 'files' ? 'active' : ''} onClick={() => setViewMode('files')}>文件管理</button>
          <button className={viewMode === 'discover' ? 'active' : ''} onClick={() => setViewMode('discover')}>发现</button>
          <button onClick={() => setSettingsOpen(true)}>设置</button>
        </div>
      </header>

      {viewMode === 'library' ? (
        <>
      <main
        ref={layoutRef}
        className={resizingPane ? 'layout is-resizing' : 'layout'}
        style={layoutStyle}
      >
        <section className="center-pane pane">
          <div className="toolbar compact-toolbar">
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              placeholder="搜索标题/文件名/城市/OCR文字"
            />
            <div className="toolbar-actions">
              <button onClick={applySearch}>检索</button>
              <button onClick={resetFilters}>清空</button>
              <button onClick={() => setFilter('favorite', filters.favorite ? '' : 'true')}>
                {filters.favorite ? '取消收藏' : '仅收藏'}
              </button>
              <button type="button" onClick={() => {
                setUploadMetaOpen((prev) => {
                  const next = !prev;
                  if (!next) setUploadAdvancedOpen(false);
                  return next;
                });
              }}>
                {uploadMetaOpen ? '收起上传' : '上传'}
              </button>
            </div>
          </div>

          <div className="filter-row">
            <select value={filters.scope} onChange={(e) => setFilter('scope', e.target.value)}>
              <option value="">全部范围</option>
              <option value="national">国家级</option>
              <option value="international">国际</option>
            </select>
            <select value={filters.country} onChange={(e) => { patchFilters({ country: e.target.value, province: '', city: '' }); loadFacets(e.target.value || undefined); }}>
              <option value="">全部国家</option>
              {(facets.country || []).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
            <select value={filters.province} onChange={(e) => { patchFilters({ province: e.target.value, city: '' }); }}>
              <option value="">全部省份</option>
              {(facets.province || []).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
            <select value={filters.city} onChange={(e) => setFilter('city', e.target.value)}>
              <option value="">全部城市</option>
              {(facets.city || []).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </div>

          {uploadMetaOpen ? (
            <>
              <div className="upload-row compact slim-upload-row">
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
                <div className="toolbar-actions upload-row-actions">
                  <button type="button" onClick={() => setUploadAdvancedOpen((prev) => !prev)}>
                    {uploadAdvancedOpen ? '收起高级' : '高级'}
                  </button>
                  <button onClick={handleUpload} disabled={!uploadFiles.length || busy}>上传并复制</button>
                </div>
              </div>

              {uploadAdvancedOpen ? (
                <div className="upload-meta-grid slim-upload-meta-grid">
                  <input value={uploadMeta.title} onChange={(e) => setUploadMeta((prev) => ({ ...prev, title: e.target.value }))} placeholder="批量标题（可选）" />
                  <input value={uploadMeta.year_label} onChange={(e) => setUploadMeta((prev) => ({ ...prev, year_label: e.target.value }))} placeholder="批量年代" />
                  <input value={uploadMeta.collection_unit} onChange={(e) => setUploadMeta((prev) => ({ ...prev, collection_unit: e.target.value }))} placeholder="收藏单位" />
                  <input value={uploadMeta.campaign} onChange={(e) => setUploadMeta((prev) => ({ ...prev, campaign: e.target.value }))} placeholder="专题 / 战役" />
                  <input value={uploadMeta.teaching_use} onChange={(e) => setUploadMeta((prev) => ({ ...prev, teaching_use: e.target.value }))} placeholder="教学用途" />
                  <select value={uploadMeta.security_level} onChange={(e) => setUploadMeta((prev) => ({ ...prev, security_level: e.target.value }))}>
                    <option value="">密级（默认）</option>
                    <option value="内部教学">内部教学</option>
                    <option value="内部资料">内部资料</option>
                    <option value="保密审看">保密审看</option>
                  </select>
                  <select value={uploadMeta.storage_band} onChange={(e) => setUploadMeta((prev) => ({ ...prev, storage_band: e.target.value }))}>
                    {STORAGE_BAND_OPTIONS.map((item) => (
                      <option key={item.value || 'none'} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <input value={uploadMeta.tags} onChange={(e) => setUploadMeta((prev) => ({ ...prev, tags: e.target.value }))} placeholder="批量标签，逗号分隔" />
                  <select value={uploadMeta.scope_level} onChange={(e) => setUploadMeta((prev) => ({ ...prev, scope_level: e.target.value }))}>
                    <option value="">范围（自动/空）</option>
                    <option value="national">国家级</option>
                    <option value="international">国际</option>
                  </select>
                  <input value={uploadMeta.country_name} onChange={(e) => setUploadMeta((prev) => ({ ...prev, country_name: e.target.value }))} placeholder="国家" />
                  <input value={uploadMeta.country_code} onChange={(e) => setUploadMeta((prev) => ({ ...prev, country_code: e.target.value }))} placeholder="国家代码" />
                  <input value={uploadMeta.province} onChange={(e) => setUploadMeta((prev) => ({ ...prev, province: e.target.value }))} placeholder="省/州" />
                  <input value={uploadMeta.city} onChange={(e) => setUploadMeta((prev) => ({ ...prev, city: e.target.value }))} placeholder="城市" />
                  <input value={uploadMeta.district} onChange={(e) => setUploadMeta((prev) => ({ ...prev, district: e.target.value }))} placeholder="区县" />
                  <input value={uploadMeta.related_countries} onChange={(e) => setUploadMeta((prev) => ({ ...prev, related_countries: e.target.value }))} placeholder="相关国家，逗号分隔" />
                  <input value={uploadMeta.related_provinces} onChange={(e) => setUploadMeta((prev) => ({ ...prev, related_provinces: e.target.value }))} placeholder="相关省份，逗号分隔" />
                  <input value={uploadMeta.latitude} onChange={(e) => setUploadMeta((prev) => ({ ...prev, latitude: e.target.value }))} placeholder="纬度" />
                  <input value={uploadMeta.longitude} onChange={(e) => setUploadMeta((prev) => ({ ...prev, longitude: e.target.value }))} placeholder="经度" />
                  <textarea value={uploadMeta.description} onChange={(e) => setUploadMeta((prev) => ({ ...prev, description: e.target.value }))} rows={2} placeholder="批量描述（可选）" />
                  <textarea value={uploadMeta.teaching_note} onChange={(e) => setUploadMeta((prev) => ({ ...prev, teaching_note: e.target.value }))} rows={2} placeholder="批量授课备注（可选）" />
                  <label className="upload-meta-check">
                    <input type="checkbox" checked={uploadMeta.favorite} onChange={(e) => setUploadMeta((prev) => ({ ...prev, favorite: e.target.checked }))} />
                    上传后设为收藏
                  </label>
                  <label className="upload-meta-check">
                    <input type="checkbox" checked={uploadMeta.auto_resolve_city} onChange={(e) => setUploadMeta((prev) => ({ ...prev, auto_resolve_city: e.target.checked }))} />
                    根据城市自动补全定位
                  </label>
                </div>
              ) : null}
            </>
          ) : null}

          {!uploadMetaOpen && stats ? <StatsPanel /> : null}

          <div className="count-line compact-count-line">
            <span>共 {total} 张，{totalPages} 页，当前第 {page} 页</span>
            <div className="count-controls">
              <button onClick={handleScan} disabled={busy}>重扫</button>
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
                data-band={item.storage_band || ''}
              >
                <div className="map-card-band" />
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

        <DetailPane
          selectedSummary={selectedSummary} selectedMap={selectedMap}
          form={form} setForm={setForm}
          detailImageSrc={detailImageSrc} previewPanelStyle={previewPanelStyle}
          ocrHighlights={ocrHighlights}
          coverageOutlinePoints={coverageOutlinePoints}
          hasCoverageOutline={hasCoverageOutline}
          normalizeOutlinePoints={normalizeOutlinePoints}
          formatBytes={formatBytes} formatDate={formatDate}
          handleAIExtract={handleAIExtract} aiBusy={aiBusy}
          toggleFavorite={toggleFavorite}
          setViewerOpen={setViewerOpen} handleSave={handleSave} busy={busy}
          chinaCityOptions={chinaCityOptions} locationHints={locationHints}
          applyHint={applyHint} resolveCityFromInput={resolveCityFromInput}
          cityResolveBusy={cityResolveBusy}
        />      </main>
        </>
      ) : viewMode === 'discover' ? (
        <Discover onSelectMap={(item) => { setSelectedId(item.id); setViewMode('library'); }} />
      ) : (
        <FileManager
          status={status}
          busy={busy}
          uploadFiles={uploadFiles}
          setUploadFiles={setUploadFiles}
          uploadFolder={uploadFolder}
          setUploadFolder={setUploadFolder}
          uploadMeta={uploadMeta}
          setUploadMeta={setUploadMeta}
          folderOptions={folderOptions}
          handleScan={handleScan}
          handleUpload={handleUpload}
          handleFileDrop={handleFileDrop}
          loadStorageFolders={loadStorageFolders}
          mcpInfo={mcpInfo}
          maps={maps}
          setSelectedId={setSelectedId}
          setViewMode={setViewMode}
          ocrStatus={ocrStatus}
          stats={stats}
          handleBatchAIExtract={handleBatchAIExtract}
          handleOcrReindex={handleOcrReindex}
          aiBusy={aiBusy}
        />
      )}

      {settingsOpen ? (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          uiSettings={uiSettings} setUiSettings={setUiSettings}
          storageForm={storageForm} setStorageForm={setStorageForm}
          browserState={browserState} loadBrowser={loadBrowser}
          applyStorageSettings={applyStorageSettings}
          loadStorageFolders={loadStorageFolders} busy={busy} status={status}
          ocrStatus={ocrStatus} handleOcrReindex={handleOcrReindex}
          aiForm={aiForm} setAIForm={setAIForm} aiModels={aiModels}
          aiModelsBusy={aiModelsBusy} aiBusy={aiBusy}
          aiTestBusy={aiTestBusy} aiTestResult={aiTestResult}
          saveAISettings={saveAISettings} fetchAIModels={fetchAIModels}
          testAIConnection={testAIConnection}
          handleAIExtract={handleAIExtract} handleBatchAIExtract={handleBatchAIExtract}
          selectedMap={selectedMap} maps={maps} aiModelsKeyRef={aiModelsKeyRef}
          stats={stats}
        />
      ) : null}

      {viewerOpen && selectedMap ? (
        <ImageViewer
          selectedMap={selectedMap}
          imageSrc={viewerImageSrc}
          maps={maps}
          setSelectedId={setSelectedId}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}

      {message ? <div className="toast ok">{message}</div> : null}
      {error ? <div className="toast err">{error}</div> : null}
    </div>
  );
}

export default App;
