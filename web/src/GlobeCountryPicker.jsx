import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { feature } from 'topojson-client';
import worldAtlasData from 'world-atlas/countries-110m.json';

const DEFAULT_VIEW = {
  center: [112, 20],
  zoom: 1.52,
  pitch: 0,
  bearing: 0
};

const MAP_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    cartoBase: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    cartoLabels: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#ececeb'
      }
    },
    {
      id: 'carto-base',
      type: 'raster',
      source: 'cartoBase',
      paint: {
        'raster-opacity': 0.97,
        'raster-saturation': -0.08,
        'raster-brightness-min': 0.24,
        'raster-brightness-max': 0.98
      }
    },
    {
      id: 'carto-labels',
      type: 'raster',
      source: 'cartoLabels',
      paint: {
        'raster-opacity': 0.9
      }
    }
  ]
};

const WORLD_GEOJSON = {
  type: 'FeatureCollection',
  features: (feature(
    worldAtlasData,
    worldAtlasData?.objects?.countries
  )?.features || []).map((item) => {
    const englishName = String(item?.properties?.name || '').trim();
    return {
      ...item,
      properties: {
        ...item.properties,
        name_en: englishName
      }
    };
  })
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildSelectionFilter = (selectedCountry, getCountryLabel) => {
  const raw = String(selectedCountry || '').trim();
  if (!raw) return ['==', ['get', 'name_en'], '__none__'];

  const selectedLower = raw.toLowerCase();
  const englishMatch = WORLD_GEOJSON.features.find((item) => {
    const englishName = String(item?.properties?.name_en || '').trim();
    if (!englishName) return false;
    if (englishName.toLowerCase() === selectedLower) return true;
    const label = String(getCountryLabel?.(englishName) || '').trim();
    return Boolean(label) && label.toLowerCase() === selectedLower;
  });

  const matchedEnglish = String(englishMatch?.properties?.name_en || raw);
  return ['==', ['get', 'name_en'], matchedEnglish];
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildPointFeatures = (points) => ({
  type: 'FeatureCollection',
  features: (Array.isArray(points) ? points : [])
    .map((item, index) => {
      const longitude = toNumber(item?.longitude ?? item?.lng);
      const latitude = toNumber(item?.latitude ?? item?.lat);
      if (longitude === null || latitude === null) return null;
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        properties: {
          id: String(item?.id || `point-${index}`),
          label: String(item?.label || '').trim(),
          active: item?.active ? 1 : 0
        }
      };
    })
    .filter(Boolean)
});

function GlobeCountryPicker({
  selectedCountry,
  onPickCountry,
  getCountryLabel,
  points = []
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const selectionFilter = useMemo(
    () => buildSelectionFilter(selectedCountry, getCountryLabel),
    [getCountryLabel, selectedCountry]
  );
  const pointGeoJson = useMemo(() => buildPointFeatures(points), [points]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      pitch: DEFAULT_VIEW.pitch,
      bearing: DEFAULT_VIEW.bearing,
      projection: { type: 'globe' },
      attributionControl: false,
      dragRotate: false,
      touchZoomRotate: true,
      minZoom: 0.8,
      maxZoom: 3.4,
      renderWorldCopies: false
    });

    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const handleLoad = () => {
      if (!map.getSource('globe-countries')) {
        map.addSource('globe-countries', {
          type: 'geojson',
          data: WORLD_GEOJSON
        });
      }

      if (!map.getLayer('globe-countries-fill')) {
        map.addLayer({
          id: 'globe-countries-fill',
          type: 'fill',
          source: 'globe-countries',
          paint: {
            'fill-color': '#fffefe',
            'fill-opacity': 0.84
          }
        });
      }

      if (!map.getLayer('globe-countries-selected')) {
        map.addLayer({
          id: 'globe-countries-selected',
          type: 'fill',
          source: 'globe-countries',
          filter: selectionFilter,
          paint: {
            'fill-color': '#dff2ff',
            'fill-opacity': 0.62
          }
        });
      }

      if (!map.getLayer('globe-countries-outline')) {
        map.addLayer({
          id: 'globe-countries-outline',
          type: 'line',
          source: 'globe-countries',
          paint: {
            'line-color': 'rgba(232, 220, 220, 0.84)',
            'line-width': 0.6
          }
        });
      }

      if (!map.getSource('globe-points')) {
        map.addSource('globe-points', {
          type: 'geojson',
          data: pointGeoJson
        });
      }

      if (!map.getLayer('globe-point-halo')) {
        map.addLayer({
          id: 'globe-point-halo',
          type: 'circle',
          source: 'globe-points',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'active'], 1],
              12.5,
              8.4
            ],
            'circle-color': 'rgba(255,255,255,0.94)'
          }
        });
      }

      if (!map.getLayer('globe-point-dot')) {
        map.addLayer({
          id: 'globe-point-dot',
          type: 'circle',
          source: 'globe-points',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'active'], 1],
              8.1,
              5.6
            ],
            'circle-color': [
              'case',
              ['==', ['get', 'active'], 1],
              '#1ca0f2',
              '#10c488'
            ],
            'circle-stroke-width': 1.6,
            'circle-stroke-color': '#ffffff'
          }
        });
      }

      if (!map.getLayer('globe-point-label')) {
        map.addLayer({
          id: 'globe-point-label',
          type: 'symbol',
          source: 'globe-points',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Regular'],
            'text-size': [
              'case',
              ['==', ['get', 'active'], 1],
              18,
              12.5
            ],
            'text-transform': 'uppercase',
            'text-letter-spacing': [
              'case',
              ['==', ['get', 'active'], 1],
              0.08,
              0.03
            ],
            'text-anchor': 'top',
            'text-offset': [
              'case',
              ['==', ['get', 'active'], 1],
              ['literal', [0, 1.62]],
              ['literal', [0, 1.12]]
            ],
            'text-optional': true
          },
          paint: {
            'text-color': [
              'case',
              ['==', ['get', 'active'], 1],
              '#111111',
              '#b1bcc5'
            ],
            'text-halo-color': 'rgba(255,255,255,0.86)',
            'text-halo-width': 1.25
          }
        });
      }

      map.on('mouseenter', 'globe-countries-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'globe-countries-fill', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'globe-countries-fill', (event) => {
        const country = event.features?.[0];
        const englishName = String(country?.properties?.name_en || '').trim();
        if (!englishName) return;
        onPickCountry?.({
          country: String(getCountryLabel?.(englishName) || englishName),
          country_en: englishName
        });
      });

      setLoaded(true);
    };

    map.on('load', handleLoad);

    return () => {
      setLoaded(false);
      map.remove();
      mapRef.current = null;
    };
  }, [getCountryLabel, onPickCountry, pointGeoJson, selectionFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('globe-countries-selected')) {
      map.setFilter('globe-countries-selected', selectionFilter);
    }
  }, [selectionFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('globe-points');
    if (source) {
      source.setData(pointGeoJson);
    }
  }, [pointGeoJson]);

  const adjustZoom = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    const nextZoom = clamp(map.getZoom() + delta, 0.8, 3.4);
    map.easeTo({ zoom: nextZoom, duration: 220 });
  };

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      pitch: DEFAULT_VIEW.pitch,
      bearing: DEFAULT_VIEW.bearing,
      duration: 500
    });
  };

  return (
    <div className="globe-wrap">
      <div className="globe-map-frame">
        <div ref={containerRef} className="globe-map" />
        <button type="button" className="globe-info" aria-label="地图说明" title="地图说明">
          i
        </button>
      </div>
      {!loaded ? <div className="globe-loading">地球加载中…</div> : null}
      <div className="globe-zoom">
        <button onClick={() => adjustZoom(0.3)}>+</button>
        <button onClick={() => adjustZoom(-0.3)}>-</button>
        <button onClick={resetView}>重置</button>
      </div>
      <div className="globe-tip">拖拽旋转地球，滚轮缩放，点击国家后自动筛选</div>
    </div>
  );
}

export default GlobeCountryPicker;
