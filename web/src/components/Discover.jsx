import { useCallback, useEffect, useState } from 'react';
import { Compass, MapPin, RefreshCw, Loader2, Rss, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { api } from '../api.js';

function MapCard({ item, onClick }) {
  return (
    <div
      className="tw-group tw-cursor-pointer tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-overflow-hidden tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200 hover:tw--translate-y-0.5"
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
      <div className="tw-p-3">
        <p className="tw-text-sm tw-font-medium tw-text-slate-800 tw-truncate">{item.title || item.file_name}</p>
        <div className="tw-flex tw-items-center tw-gap-1.5 tw-mt-1.5 tw-flex-wrap">
          {item.city && <Badge variant="secondary" className="tw-text-[10px]">{item.city}</Badge>}
          {item.country_name && <Badge variant="outline" className="tw-text-[10px]">{item.country_name}</Badge>}
          {item.year_label && <Badge variant="outline" className="tw-text-[10px]">{item.year_label}</Badge>}
        </div>
      </div>
    </div>
  );
}

function MapMarker({ item, onClick }) {
  return (
    <div
      className="tw-absolute tw-w-3 tw-h-3 tw-rounded-full tw-bg-slate-900 tw-border-2 tw-border-white tw-shadow-md tw-cursor-pointer hover:tw-scale-150 tw-transition-transform tw-duration-150 tw-z-10"
      title={item.title || item.file_name}
      onClick={() => onClick?.(item)}
    />
  );
}

export default function Discover({ onSelectMap }) {
  const [randomMaps, setRandomMaps] = useState([]);
  const [geoMaps, setGeoMaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const loadRandom = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.randomMaps(12, false);
      setRandomMaps(data.items || []);
    } catch (_) { /* ignore */ }
    setLoading(false);
  }, []);

  const loadGeoMaps = useCallback(async () => {
    setGeoLoading(true);
    try {
      const data = await api.randomMaps(10, true);
      setGeoMaps(data.items || []);
    } catch (_) { /* ignore */ }
    setGeoLoading(false);
  }, []);

  useEffect(() => {
    loadRandom();
    loadGeoMaps();
  }, [loadRandom, loadGeoMaps]);

  const handleClick = (item) => {
    setViewItem(item);
  };

  // Simple map projection (Mercator-like) for geo markers
  const projectToPercent = (lat, lng) => {
    const x = ((lng + 180) / 360) * 100;
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = 50 - (mercN / Math.PI) * 50;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  return (
    <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-[1fr_1fr] tw-gap-4 tw-p-4 tw-flex-1 tw-min-h-0 tw-overflow-auto">
      {/* Left: Random recommendations */}
      <Card className="tw-flex tw-flex-col tw-min-h-0">
        <CardHeader className="tw-flex-row tw-items-center tw-justify-between tw-space-y-0 tw-pb-3">
          <CardTitle className="tw-text-base tw-flex tw-items-center tw-gap-2">
            <Compass className="tw-w-5 tw-h-5" />
            随机发现
          </CardTitle>
          <div className="tw-flex tw-gap-2">
            <Button variant="outline" size="sm" onClick={loadRandom} disabled={loading}>
              {loading ? <Loader2 className="tw-w-3.5 tw-h-3.5 tw-animate-spin" /> : <RefreshCw className="tw-w-3.5 tw-h-3.5" />}
              换一批
            </Button>
            <a href="/api/feed/rss" target="_blank" rel="noopener noreferrer" title="RSS 订阅">
              <Button variant="outline" size="sm" type="button" asChild={false}>
                <Rss className="tw-w-3.5 tw-h-3.5 tw-text-orange-500" />
                RSS
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="tw-flex-1 tw-overflow-y-auto tw-pt-0">
          <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
            {randomMaps.map((item) => (
              <MapCard key={item.id} item={item} onClick={handleClick} />
            ))}
          </div>
          {!loading && !randomMaps.length && (
            <p className="tw-text-center tw-text-slate-400 tw-py-12">暂无地图数据</p>
          )}
        </CardContent>
      </Card>

      {/* Right: Geo map recommendations */}
      <Card className="tw-flex tw-flex-col tw-min-h-0">
        <CardHeader className="tw-flex-row tw-items-center tw-justify-between tw-space-y-0 tw-pb-3">
          <CardTitle className="tw-text-base tw-flex tw-items-center tw-gap-2">
            <MapPin className="tw-w-5 tw-h-5" />
            地理推荐
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadGeoMaps} disabled={geoLoading}>
            {geoLoading ? <Loader2 className="tw-w-3.5 tw-h-3.5 tw-animate-spin" /> : <RefreshCw className="tw-w-3.5 tw-h-3.5" />}
            刷新
          </Button>
        </CardHeader>
        <CardContent className="tw-flex-1 tw-overflow-y-auto tw-pt-0 tw-space-y-4">
          {/* Mini world map with markers */}
          <div className="tw-relative tw-w-full tw-aspect-[2/1] tw-rounded-lg tw-bg-slate-100 tw-border tw-border-slate-200 tw-overflow-hidden">
            {/* Simple world outline background */}
            <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-text-slate-300 tw-text-xs">
              🌍 世界地图
            </div>
            {geoMaps.map((item) => {
              if (!item.latitude || !item.longitude) return null;
              const { x, y } = projectToPercent(item.latitude, item.longitude);
              return (
                <div
                  key={item.id}
                  className="tw-absolute tw-w-3 tw-h-3 tw-rounded-full tw-bg-slate-900 tw-border-2 tw-border-white tw-shadow-md tw-cursor-pointer hover:tw-scale-150 tw-transition-transform tw-duration-150 tw-z-10"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                  title={item.title || item.file_name}
                  onClick={() => handleClick(item)}
                />
              );
            })}
          </div>

          {/* Geo map cards */}
          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            {geoMaps.map((item) => (
              <MapCard key={item.id} item={item} onClick={handleClick} />
            ))}
          </div>
          {!geoLoading && !geoMaps.length && (
            <p className="tw-text-center tw-text-slate-400 tw-py-8">暂无带坐标的地图</p>
          )}
        </CardContent>
      </Card>

      {/* Lightbox with zoom/pan */}
      {viewItem && (
        <div
          className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/85 tw-flex tw-flex-col tw-animate-in tw-fade-in tw-duration-200"
          onClick={() => setViewItem(null)}
        >
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
