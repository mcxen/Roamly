/**
 * 轻量 SVG 世界地图范围展示组件（shadcn 风格）
 * 使用简化的世界地图轮廓 + 范围矩形 + 中心点标记
 */

// 简化的世界地图路径（Natural Earth 110m 简化版）
const WORLD_PATH = 'M474,164l-2,1-2,0-1-1,0-2,2-1,2,0,1,1,0,2ZM550,170l-3,2-2-1,1-3,3-1,2,1-1,2ZM170,82l2,3-1,2-3,0-2-2,1-3,3,0ZM498,88l-1,3-3,1-2-2,1-3,3-1,2,2ZM240,140l5,2,3,4-1,4-4,2-5-1-3-4,1-4,4-3ZM180,195l-8,3-4-2,1-5,6-3,5,1,2,4-2,2ZM630,200l4,1,2,3-1,3-4,1-3-2-1-3,1-2,2-1ZM290,60l15,5,8,8-2,10-12,5-15-2-10-8,2-10,14-8ZM60,180l8,4,5,7-2,8-8,4-9-2-5-7,2-8,9-6ZM520,80l20,8,12,15-5,18-18,8-20-5-12-15,5-18,18-11ZM350,100l25,10,15,18-3,20-22,10-25-8-15-18,3-20,22-12ZM150,120l18,8,10,14-2,15-15,8-18-5-10-14,2-15,15-11ZM580,120l15,6,8,12-2,14-12,6-15-4-8-12,2-14,12-8ZM420,180l30,12,18,22-4,25-26,12-30-10-18-22,4-25,26-14ZM280,200l20,8,12,15-3,18-18,8-20-6-12-15,3-18,18-10ZM100,220l12,5,7,10-2,12-10,5-12-3-7-10,2-12,10-7ZM550,220l18,7,10,13-3,15-15,7-18-5-10-13,3-15,15-9ZM350,260l22,9,13,16-3,18-19,9-22-7-13-16,3-18,19-11ZM200,280l15,6,9,11-2,13-13,6-15-4-9-11,2-13,13-8ZM480,280l12,5,7,9-2,10-10,5-12-3-7-9,2-10,10-7ZM600,300l8,3,5,6-1,7-7,3-8-2-5-6,1-7,7-4ZM320,320l10,4,6,8-2,9-9,4-10-3-6-8,2-9,9-5ZM440,340l8,3,5,6-1,7-7,3-8-2-5-6,1-7,7-4Z';

// 经纬度转 SVG 坐标（等距圆柱投影）
const lngToX = (lng) => ((Number(lng) + 180) / 360) * 720;
const latToY = (lat) => ((90 - Number(lat)) / 180) * 400;

function DetailGlobe({ latitude, longitude, north, south, east, west }) {
  const hasCenter = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const hasBounds = [north, south, east, west].every((v) => Number.isFinite(Number(v)));

  const cx = hasCenter ? lngToX(longitude) : 360;
  const cy = hasCenter ? latToY(latitude) : 200;

  return (
    <div className="detail-globe-wrap">
      <svg viewBox="0 0 720 400" className="detail-globe-svg" aria-label="地图范围">
        {/* 背景 */}
        <rect width="720" height="400" fill="hsl(210 40% 98%)" rx="4" />
        {/* 经纬网格 */}
        {[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="400" stroke="hsl(214 32% 91%)" strokeWidth="0.5" />
        ))}
        {[0, 66, 133, 200, 266, 333, 400].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="720" y2={y} stroke="hsl(214 32% 91%)" strokeWidth="0.5" />
        ))}
        {/* 大陆轮廓 */}
        <path d={WORLD_PATH} fill="hsl(210 40% 93%)" stroke="hsl(215 20% 75%)" strokeWidth="0.6" />
        {/* 范围矩形 */}
        {hasBounds ? (
          <rect
            x={lngToX(west)}
            y={latToY(north)}
            width={lngToX(east) - lngToX(west)}
            height={latToY(south) - latToY(north)}
            fill="hsl(217 91% 60% / 0.12)"
            stroke="hsl(217 91% 60%)"
            strokeWidth="1.5"
            rx="2"
          />
        ) : null}
        {/* 中心点 */}
        {hasCenter ? (
          <>
            <circle cx={cx} cy={cy} r="6" fill="white" stroke="hsl(217 91% 60%)" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="3" fill="hsl(0 84% 60%)" />
          </>
        ) : null}
      </svg>
      {!hasCenter ? (
        <div className="detail-globe-hint">暂无位置信息，AI 提取后将在此展示地图范围</div>
      ) : null}
    </div>
  );
}

export default DetailGlobe;
