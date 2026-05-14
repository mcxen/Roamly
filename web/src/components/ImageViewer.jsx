import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

export default function ImageViewer({ selectedMap, imageSrc, maps, setSelectedId, onClose }) {
  const currentIdx = maps.findIndex((m) => m.id === selectedMap.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < maps.length - 1;
  const goPrev = () => { if (hasPrev) setSelectedId(maps[currentIdx - 1].id); };
  const goNext = () => { if (hasNext) setSelectedId(maps[currentIdx + 1].id); };

  return (
    <div className="viewer-mask" onClick={onClose}>
      <div className="viewer-panel" onClick={(e) => e.stopPropagation()}>
        <TransformWrapper
          key={`viewer-${selectedMap.id}`}
          initialScale={1} minScale={0.25} maxScale={16} centerOnInit smooth={false}
          wheel={{ step: 0.22, smoothStep: 0.005 }}
          zoomAnimation={{ disabled: true }}
          alignmentAnimation={{ disabled: true }}
          velocityAnimation={{ disabled: true }}
          pinch={{ step: 4 }}
          doubleClick={{ mode: 'zoomIn', step: 1.4, animationTime: 90 }}
          panning={{ velocityDisabled: true, wheelPanning: false }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="viewer-toolbar">
                <button onClick={() => zoomIn()}>放大</button>
                <button onClick={() => zoomOut()}>缩小</button>
                <button onClick={() => resetTransform()}>重置</button>
                <button disabled={!hasPrev} onClick={goPrev}>上一张</button>
                <button disabled={!hasNext} onClick={goNext}>下一张</button>
                <button onClick={onClose}>关闭</button>
              </div>
              <TransformComponent
                wrapperStyle={{ width: '100%', height: 'calc(100vh - 120px)' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                <img className="viewer-image" src={imageSrc} alt={selectedMap.title || selectedMap.file_name} loading="eager" decoding="async" />
              </TransformComponent>
              <button className="viewer-nav prev" disabled={!hasPrev} onClick={goPrev} aria-label="上一张">‹</button>
              <button className="viewer-nav next" disabled={!hasNext} onClick={goNext} aria-label="下一张">›</button>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
