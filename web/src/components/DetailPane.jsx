import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import DetailGlobe from '../DetailGlobe.jsx';
import { api } from '../api.js';

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

export default function DetailPane({
  selectedSummary, selectedMap, form, setForm,
  detailImageSrc, previewPanelStyle,
  ocrHighlights, coverageOutlinePoints, hasCoverageOutline,
  normalizeOutlinePoints, formatBytes, formatDate,
  handleAIExtract, aiBusy, toggleFavorite,
  setViewerOpen, handleSave, busy,
  chinaCityOptions, locationHints, applyHint,
  resolveCityFromInput, cityResolveBusy
}) {
  return (
    <aside className="right-pane pane">
      <div className="detail-header detail-section">
        <h3>{selectedSummary?.title || '未选择地图'}</h3>
        <div className="detail-header-actions">
          <button onClick={handleAIExtract} disabled={!selectedMap || aiBusy}>
            {aiBusy ? 'AI 提取中...' : 'AI 提取'}
          </button>
          <button onClick={toggleFavorite} disabled={!selectedSummary}>
            {selectedSummary?.favorite ? '取消收藏' : '加入收藏'}
          </button>
        </div>
      </div>

      {selectedMap ? (
        <>
          <section className="detail-section preview-section">
            <div className="preview-wrap" style={previewPanelStyle}>
              <TransformWrapper
                key={selectedMap.id}
                initialScale={1} minScale={0.3} maxScale={18} centerOnInit smooth={false}
                wheel={{ step: 0.16, smoothStep: 0.005 }}
                pinch={{ step: 4 }}
                zoomAnimation={{ disabled: true }}
                alignmentAnimation={{ disabled: true }}
                velocityAnimation={{ disabled: true }}
                panning={{ velocityDisabled: true }}
                doubleClick={{ mode: 'zoomIn', step: 1.4, animationTime: 80 }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="preview-toolbar">
                      <button onClick={() => zoomIn()}>放大</button>
                      <button onClick={() => zoomOut()}>缩小</button>
                      <button onClick={() => resetTransform()}>重置</button>
                      <button onClick={() => setViewerOpen(true)}>全屏查看</button>
                    </div>
                    <TransformComponent wrapperClass="preview-transform-wrapper" contentClass="preview-transform-content">
                      <div className="preview-image-wrap">
                        <img className="preview" src={detailImageSrc} alt={selectedMap.title || selectedMap.file_name} loading="eager" decoding="async" />
                        {hasCoverageOutline ? (
                          <svg className="coverage-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            <polygon points={coverageOutlinePoints} />
                          </svg>
                        ) : null}
                        {ocrHighlights.map((item, index) => (
                          <div key={`${item.text}-${index}`} className="ocr-highlight" title={`${item.text} (${Math.round(item.confidence || 0)}%)`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.w * 100}%`, height: `${item.h * 100}%` }} />
                        ))}
                      </div>
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>
            {selectedMap.ocr_text && ocrHighlights.length ? (
              <div className="preview-ocr-summary preview-ocr-summary-compact">
                <span className="preview-ocr-chip">OCR 命中 {ocrHighlights.length}</span>
              </div>
            ) : null}
          </section>

          <section className="detail-section meta-section">
            <div className="file-meta">
              <span>ID: {selectedMap.id.slice(0, 12)}</span>
              <span>{selectedMap.width || '-'} x {selectedMap.height || '-'}</span>
              <span>{selectedMap.mime || '-'}</span>
              <span>{formatBytes(selectedMap.size_bytes)}</span>
              <span>{formatDate(selectedMap.mtime_ms)}</span>
              <span>OCR: {selectedMap.ocr_status || 'pending'}</span>
              <span>轮廓: {hasCoverageOutline ? `${normalizeOutlinePoints(selectedMap.coverage_outline).length} 点` : '未提取'}</span>
              <span>范围: {selectedMap.north_latitude != null && selectedMap.south_latitude != null ? `${Number(selectedMap.south_latitude).toFixed(2)}-${Number(selectedMap.north_latitude).toFixed(2)}N` : '-'}</span>
              <span>
                GPS: {selectedMap.latitude != null && selectedMap.longitude != null
                  ? `${Number(selectedMap.latitude).toFixed(4)}, ${Number(selectedMap.longitude).toFixed(4)}`
                  : <button className="tw-inline tw-text-[10px] tw-px-1.5 tw-py-0.5 tw-border tw-border-dashed tw-border-[var(--kumo-info)] tw-bg-transparent tw-text-[var(--kumo-info)] tw-rounded tw-cursor-pointer tw-shadow-none hover:tw-bg-[var(--kumo-info)]/10" onClick={async () => {
                      try {
                        const exif = await api.extractExif(selectedMap.id);
                        if (exif?.exif?.hasExif) {
                          setMessage?.('提取到 GPS: ' + exif.exif.latitude + ', ' + exif.exif.longitude);
                          setTimeout(() => onMapUpdate?.(), 500);
                        } else {
                          setMessage?.('未找到 EXIF GPS 数据');
                        }
                      } catch (err) { setError?.(err.message); }
                    }}>提取 EXIF</button>
                }
              </span>
            </div>
          </section>

          <section className="detail-section globe-section">
            <DetailGlobe
              latitude={selectedMap.latitude} longitude={selectedMap.longitude}
              north={selectedMap.north_latitude} south={selectedMap.south_latitude}
              east={selectedMap.east_longitude} west={selectedMap.west_longitude}
            />
          </section>

          <section className="detail-section form-section">
            <div className="form-block">
              <div className="form-block-title">内容信息</div>
              <div className="form-grid">
                <label>标题<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                <label>年代<input value={form.year_label} onChange={(e) => setForm({ ...form, year_label: e.target.value })} /></label>
                <label>收藏单位<input value={form.collection_unit} onChange={(e) => setForm({ ...form, collection_unit: e.target.value })} /></label>
                <label>专题 / 战役<input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} /></label>
                <label>教学用途<input value={form.teaching_use} onChange={(e) => setForm({ ...form, teaching_use: e.target.value })} /></label>
                <label>密级
                  <select value={form.security_level} onChange={(e) => setForm({ ...form, security_level: e.target.value })}>
                    <option value="">未设置</option>
                    <option value="内部教学">内部教学</option>
                    <option value="内部资料">内部资料</option>
                    <option value="保密审看">保密审看</option>
                  </select>
                </label>
                <label>存储彩虹条
                  <select value={form.storage_band} onChange={(e) => setForm({ ...form, storage_band: e.target.value })}>
                    {STORAGE_BAND_OPTIONS.map((o) => <option key={o.value || 'none'} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label>标签<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="多个标签用逗号分隔" /></label>
                <label className="full">简介<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></label>
                <label className="full">授课备注<textarea value={form.teaching_note} onChange={(e) => setForm({ ...form, teaching_note: e.target.value })} rows={3} placeholder="用于课堂讲解、地图判读重点、保密提醒等" /></label>
              </div>
            </div>

            <div className="form-block">
              <div className="form-block-title">定位与范围</div>
              <div className="form-grid compact">
                <label>范围
                  <select value={form.scope_level} onChange={(e) => setForm({ ...form, scope_level: e.target.value })}>
                    <option value="">未设置</option><option value="national">国家级</option><option value="international">国际</option>
                  </select>
                </label>
                <label>国家<input value={form.country_name} onChange={(e) => setForm({ ...form, country_name: e.target.value })} /></label>
                <label>国家代码<input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} /></label>
                <label>省/州<input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></label>
                <label>市
                  <input value={form.city} list="china-city-datalist" onChange={(e) => setForm({ ...form, city: e.target.value })} onBlur={() => resolveCityFromInput(form.city)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolveCityFromInput(form.city); } }} />
                  <datalist id="china-city-datalist">
                    {chinaCityOptions.map((it) => <option key={`${it.province}-${it.city}`} value={it.city}>{it.province} / {it.city}</option>)}
                  </datalist>
                </label>
                <label>区县<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
                <label className="full">关联国家<input value={form.related_countries} placeholder="日本, 中国" onChange={(e) => setForm({ ...form, related_countries: e.target.value })} /></label>
                <label className="full">关联省份<input value={form.related_provinces} placeholder="黑龙江, 吉林" onChange={(e) => setForm({ ...form, related_provinces: e.target.value })} /></label>
                <label>中心纬度<input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></label>
                <label>中心经度<input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></label>
              </div>
              <div className="form-block-actions">
                <div className="city-tools">
                  <select value="" onChange={(e) => {
                    if (!e.target.value) return;
                    const [province, city] = e.target.value.split('|');
                    const item = chinaCityOptions.find((it) => it.province === province && it.city === city);
                    if (item) applyHint({ ...item, scope_level: 'national' }, false);
                  }}>
                    <option value="">从地级市列表快速选择</option>
                    {chinaCityOptions.map((it) => <option key={`${it.province}|${it.city}`} value={`${it.province}|${it.city}`}>{it.province} / {it.city}</option>)}
                  </select>
                  <button onClick={() => resolveCityFromInput(form.city)} disabled={cityResolveBusy || !form.city.trim()}>
                    {cityResolveBusy ? '匹配中...' : '自动匹配地级市'}
                  </button>
                </div>
                {locationHints.length > 0 ? (
                  <div className="hints">
                    {locationHints.map((item) => (
                      <button key={`${item.country_code}-${item.city}-${item.latitude}`} onClick={() => applyHint(item)}>
                        {item.country_name} / {item.province} / {item.city}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <button className="save-btn" onClick={handleSave} disabled={busy}>保存地图信息</button>
        </>
      ) : (
        <div className="empty-detail detail-section">从中间选择一张地图查看详情</div>
      )}
    </aside>
  );
}
