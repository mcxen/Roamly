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
  async storageSettings() {
    return handle(await fetch('/api/storage/settings'));
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
  async upload(files, folder) {
    const normalized = Array.isArray(files) ? files : [files];
    const form = new FormData();
    normalized.filter(Boolean).forEach((file) => {
      form.append('files', file);
    });
    form.append('folder', folder || '');

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
  }
};
