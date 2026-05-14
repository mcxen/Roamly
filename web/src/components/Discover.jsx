import { useCallback, useEffect, useState } from 'react';
import { Compass, RefreshCw, Loader2, Rss, Calendar, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { api } from '../api.js';

function MapCard({ item, onClick }) {
  return (
    <div
      className="tw-group tw-cursor-pointer tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-overflow-hidden tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200 hover:tw--translate-y-0.5 tw-shrink-0 tw-w-[220px] tw-snap-start"
      onClick={() => onClick?.(item)}
    >
      <div className="tw-aspect-[4/3] tw-overflow-hidden tw-bg-slate-100">
        <img
          src={`/api/files/${item.id}?max=400&quality=72`}
          alt={item.title || item.file_name}
          className="tw-w-full tw-h-full tw-object-cover group-hover:tw-scale-105 tw-transition-transform tw-duration-300"
          loading="lazy"
        />
      </div>
      <div className="tw-p-2.5">
        <p className="tw-text-sm tw-font-medium tw-text-slate-800 tw-truncate">{item.title || item.file_name}</p>
        <div className="tw-flex tw-items-center tw-gap-1 tw-mt-1 tw-flex-wrap">
          {item.city && <Badge variant="secondary" className="tw-text-[10px]">{item.city}</Badge>}
          {item.country_name && <Badge variant="outline" className="tw-text-[10px]">{item.country_name}</Badge>}
          {item.year_label && <Badge variant="outline" className="tw-text-[10px]">{item.year_label}</Badge>}
        </div>
      </div>
    </div>
  );
}

export default function Discover() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.randomMaps(20, false);
      setMaps(data.items || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  return (
    <div className="tw-flex tw-flex-col tw-flex-1 tw-min-h-0 tw-relative tw-overflow-hidden">
      {/* Main content area */}
      <div className="tw-flex tw-flex-col tw-flex-1 tw-min-h-0 tw-p-4 tw-gap-4">
        {/* Top: horizontal scrollable map list */}
        <div className="tw-shrink-0">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
            <div className="tw-flex tw-items-center tw-gap-3">
              <h2 className="tw-text-base tw-font-semibold tw-flex tw-items-center tw-gap-2">
                <Compass className="tw-w-5 tw-h-5" /> 发现
              </h2>
              <span className="tw-text-xs tw-text-slate-400 tw-flex tw-items-center tw-gap-1.5">
                <Calendar className="tw-w-3 tw-h-3" />{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
              </span>
            </div>
            <div className="tw-flex tw-gap-2">
              <Button variant="outline" size="sm" onClick={loadMaps} disabled={loading}>
                {loading ? <Loader2 className="tw-w-3.5 tw-h-3.5 tw-animate-spin" /> : <RefreshCw className="tw-w-3.5 tw-h-3.5" />}
                换一批
              </Button>
              <a href="/api/feed/rss" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Rss className="tw-w-3.5 tw-h-3.5 tw-text-orange-500" /> RSS
                </Button>
              </a>
            </div>
          </div>
          <div className="tw-flex tw-gap-3 tw-overflow-x-auto tw-pb-3 tw-snap-x tw-snap-mandatory tw-scrollbar-thin">
            {maps.map((item) => (
              <MapCard key={item.id} item={item} onClick={setViewItem} />
            ))}
            {!loading && !maps.length && (
              <p className="tw-text-slate-400 tw-text-sm tw-py-8 tw-w-full tw-text-center">暂无地图数据</p>
            )}
          </div>
        </div>

        {/* Bottom: large map grid */}
        <div className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto">
          <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 lg:tw-grid-cols-4 xl:tw-grid-cols-5 tw-gap-3">
            {maps.map((item) => (
              <div
                key={item.id}
                className="tw-group tw-cursor-pointer tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-overflow-hidden tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200 hover:tw--translate-y-0.5"
                onClick={() => setViewItem(item)}
              >
                <div className="tw-aspect-[3/2] tw-overflow-hidden tw-bg-slate-100">
                  <img
                    src={`/api/files/${item.id}?max=480&quality=72`}
                    alt={item.title || item.file_name}
                    className="tw-w-full tw-h-full tw-object-cover group-hover:tw-scale-105 tw-transition-transform tw-duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="tw-p-2.5">
                  <p className="tw-text-sm tw-font-medium tw-text-slate-800 tw-truncate">{item.title || item.file_name}</p>
                  <p className="tw-text-xs tw-text-slate-400 tw-mt-0.5 tw-truncate">{[item.country_name, item.city, item.year_label].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {viewItem && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/85 tw-flex tw-flex-col tw-animate-in tw-fade-in tw-duration-200" onClick={() => setViewItem(null)}>
          <div className="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-2 tw-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="tw-text-white tw-min-w-0">
              <p className="tw-font-medium tw-truncate">{viewItem.title || viewItem.file_name}</p>
              <p className="tw-text-xs tw-text-white/60">{[viewItem.country_name, viewItem.province, viewItem.city, viewItem.year_label].filter(Boolean).join(' · ')}</p>
            </div>
            <button className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white/15 tw-text-white tw-flex tw-items-center tw-justify-center hover:tw-bg-white/30 tw-transition-colors tw-border-0 tw-cursor-pointer tw-text-lg tw-shrink-0" onClick={() => setViewItem(null)}>✕</button>
          </div>
          <div className="tw-flex-1 tw-min-h-0 tw-relative" onClick={(e) => e.stopPropagation()}>
            <TransformWrapper initialScale={1} minScale={0.3} maxScale={20} centerOnInit smooth={false} wheel={{ step: 0.15 }}>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="tw-absolute tw-bottom-4 tw-left-1/2 tw--translate-x-1/2 tw-z-10 tw-flex tw-gap-2">
                    <button className="tw-w-9 tw-h-9 tw-rounded-full tw-bg-white/90 tw-border-0 tw-shadow-lg tw-flex tw-items-center tw-justify-center tw-cursor-pointer hover:tw-bg-white tw-transition-colors" onClick={() => zoomIn()}><ZoomIn className="tw-w-4 tw-h-4" /></button>
                    <button className="tw-w-9 tw-h-9 tw-rounded-full tw-bg-white/90 tw-border-0 tw-shadow-lg tw-flex tw-items-center tw-justify-center tw-cursor-pointer hover:tw-bg-white tw-transition-colors" onClick={() => zoomOut()}><ZoomOut className="tw-w-4 tw-h-4" /></button>
                    <button className="tw-w-9 tw-h-9 tw-rounded-full tw-bg-white/90 tw-border-0 tw-shadow-lg tw-flex tw-items-center tw-justify-center tw-cursor-pointer hover:tw-bg-white tw-transition-colors" onClick={() => resetTransform()}><Maximize className="tw-w-4 tw-h-4" /></button>
                  </div>
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <img src={`/api/files/${viewItem.id}`} alt={viewItem.title || viewItem.file_name} className="tw-max-w-full tw-max-h-full tw-object-contain" />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </div>
  );
}
