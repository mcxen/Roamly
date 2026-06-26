const jsonHeaders = {
  'Content-Type': 'application/json'
};

const handle = async (res) => {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch (_err) {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
};

export const api = {
  async status() {
    return handle(await fetch('/api/status'));
  },
  async ocrStatus() {
    return handle(await fetch('/api/ocr/status'));
  },
  async ocrReindex(force = false, limit = 600) {
    return handle(await fetch('/api/ocr/reindex', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ force, limit })
    }));
  },
  async aiSettings() {
    return handle(await fetch('/api/ai/settings'));
  },
  async saveAISettings(payload) {
    return handle(await fetch('/api/ai/settings', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async aiProviders() {
    return handle(await fetch('/api/ai/providers'));
  },
  async aiUsage({ providerId, days, limit } = {}) {
    const query = new URLSearchParams();
    if (providerId) query.set('providerId', providerId);
    if (days) query.set('days', days);
    if (limit) query.set('limit', limit);
    const suffix = query.toString();
    return handle(await fetch(`/api/ai/usage${suffix ? `?${suffix}` : ''}`));
  },
  async aiUsageSummary({ days } = {}) {
    const query = new URLSearchParams();
    if (days) query.set('days', days);
    const suffix = query.toString();
    return handle(await fetch(`/api/ai/usage/summary${suffix ? `?${suffix}` : ''}`));
  },
  async aiUsageProviders(days) {
    const query = new URLSearchParams();
    if (days) query.set('days', days);
    const suffix = query.toString();
    return handle(await fetch(`/api/ai/usage/providers${suffix ? `?${suffix}` : ''}`));
  },
  async aiProviderConfigs() {
    return handle(await fetch('/api/ai/provider-configs'));
  },
  async saveAIProviderConfig(payload) {
    return handle(await fetch('/api/ai/provider-configs', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async deleteAIProviderConfig(id) {
    return handle(await fetch(`/api/ai/provider-configs/${id}`, { method: 'DELETE' }));
  },
  async activateAIProvider(id) {
    return handle(await fetch(`/api/ai/provider-configs/${id}/activate`, { method: 'POST' }));
  },
  async aiModels(payload) {
    return handle(await fetch('/api/ai/models', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async aiTest(payload) {
    return handle(await fetch('/api/ai/test', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async aiChat(payload) {
    return handle(await fetch('/api/ai/chat', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async extractAIMap(id, options = {}) {
    return handle(await fetch(`/api/ai/maps/${id}/extract`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(options || {})
    }));
  },
  async batchExtractAIMaps(ids, options = {}) {
    return handle(await fetch('/api/ai/maps/batch-extract', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ ids, ...options })
    }));
  },
  async storageSettings() {
    return handle(await fetch('/api/storage/settings'));
  },
  async mcpTools() {
    return handle(await fetch('/api/mcp/tools'));
  },
  async saveStorageSettings(payload) {
    return handle(await fetch('/api/storage/settings', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async listMaps(params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    });
    return handle(await fetch(`/api/maps?${query.toString()}`));
  },
  async facets(options) {
    const query = new URLSearchParams();
    if (typeof options === 'string') {
      if (options) {
        query.set('source', options);
      }
    } else if (options && typeof options === 'object') {
      if (options.source) {
        query.set('source', options.source);
      }
      if (options.country) {
        query.set('country', options.country);
      }
    }
    const suffix = query.toString();
    return handle(await fetch(`/api/maps/facets${suffix ? `?${suffix}` : ''}`));
  },
  async stats() {
    return handle(await fetch('/api/maps/stats'));
  },
  async map(id) {
    return handle(await fetch(`/api/maps/${id}`));
  },
  async saveMap(id, payload) {
    return handle(await fetch(`/api/maps/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    }));
  },
  async batchUpdateMaps(ids, payload) {
    return handle(await fetch('/api/maps/batch-update', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ ids, ...(payload || {}) })
    }));
  },
  async toggleFavorite(id, favorite) {
    return handle(await fetch(`/api/maps/${id}/favorite`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ favorite })
    }));
  },
  async scan() {
    return handle(await fetch('/api/maps/scan', { method: 'POST' }));
  },
  async upload(files, folder, metadata = {}) {
    const normalized = Array.isArray(files) ? files : [files];
    const form = new FormData();
    normalized.filter(Boolean).forEach((file) => {
      form.append('files', file);
    });
    form.append('folder', folder || '');

    Object.entries(metadata || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        form.append(key, JSON.stringify(value));
        return;
      }
      form.append(key, String(value));
    });

    return handle(await fetch('/api/maps/upload', {
      method: 'POST',
      body: form
    }));
  },
  async suggestLocations(q) {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    return handle(await fetch(`/api/locations/suggest${query}`));
  },
  async getLocalCurrent() {
    return handle(await fetch('/api/storage/local/current'));
  },
  async setLocalDirectory(targetPath) {
    return handle(await fetch('/api/storage/local/select', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ path: targetPath })
    }));
  },
  async listLocalFolders(depth = 6) {
    return handle(await fetch(`/api/storage/local/folders?depth=${encodeURIComponent(depth)}`));
  },
  async listWebdavFolders(depth = 6) {
    return handle(await fetch(`/api/storage/webdav/folders?depth=${encodeURIComponent(depth)}`));
  },
  async chinaDistribution(source) {
    const query = source ? `?source=${encodeURIComponent(source)}` : '';
    return handle(await fetch(`/api/maps/china-distribution${query}`));
  },
  async browseLocal(pathValue) {
    const query = pathValue ? `?path=${encodeURIComponent(pathValue)}` : '';
    return handle(await fetch(`/api/storage/local/browse${query}`));
  },
  async resolveCity(q) {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    return handle(await fetch(`/api/locations/resolve-city${query}`));
  },
  async chinaCities() {
    return handle(await fetch('/api/locations/china-cities'));
  },
  async randomMaps(limit = 10, hasCoords = false) {
    const params = new URLSearchParams({ limit, hasCoords });
    return handle(await fetch(`/api/maps/random?${params}`));
  },
  async batchExtractAsync(ids, options = {}) {
    return handle(await fetch('/api/ai/maps/batch-extract-async', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ ids, ...options })
    }));
  },
  async aiTaskStatus(taskId) {
    return handle(await fetch(`/api/ai/tasks/${taskId}`));
  },
  async aiTasks() {
    return handle(await fetch('/api/ai/tasks'));
  },
  async rssSettings() {
    return handle(await fetch('/api/rss/settings'));
  },
  async saveRssSettings(payload) {
    return handle(await fetch('/api/rss/settings', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async rssGenerate() {
    return handle(await fetch('/api/rss/generate', { method: 'POST' }));
  },
  async discoverSettings() {
    return handle(await fetch('/api/discover/settings'));
  },
  async saveDiscoverSettings(payload) {
    return handle(await fetch('/api/discover/settings', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload || {})
    }));
  },
  async discoverRecommendation() {
    return handle(await fetch('/api/discover/recommendation'));
  },

  /* GeoJSON */
  async exportGeoJSON(options = {}) {
    const params = new URLSearchParams();
    if (options.hasCoords) params.set('hasCoords', '1');
    if (options.country) params.set('country', options.country);
    if (options.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    const res = await fetch(`/api/maps/geojson${query ? `?${query}` : ''}`);
    return res.json();
  },

  async importGeoJSON(geojson) {
    return handle(await fetch('/api/maps/geojson/import', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(geojson),
    }));
  },

  /* EXIF */
  async extractExif(id) {
    return handle(await fetch(`/api/maps/extract-exif/${id}`, { method: 'POST' }));
  },

  async extractExifBatch(limit = 100) {
    return handle(await fetch('/api/maps/extract-exif-batch', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ limit }),
    }));
  },
};
