import { Children, useEffect, useRef, useState } from 'react';

export default function MetricCarousel({ children, pageWidth, page, onPageChange }) {
  const viewport = useRef(null);
  const drag = useRef(null);
  const settle = useRef(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    viewport.current?.scrollTo({ left: page * pageWidth, behavior: 'smooth' });
  }, [page, pageWidth]);
  useEffect(() => () => clearTimeout(settle.current), []);
  const finish = (event) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const next = Math.max(0, Math.min(Children.count(children) - 1, Math.round(event.currentTarget.scrollLeft / pageWidth)));
    event.currentTarget.scrollTo({ left: next * pageWidth, behavior: 'smooth' });
    onPageChange(next);
  };
  return <div ref={viewport} role="region" aria-label="Puntaje de recuerdo y constancia" style={{ width: '100%', overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: dragging ? 'none' : 'x mandatory', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'pan-x pan-y', userSelect: dragging ? 'none' : 'auto' }}
    onPointerDown={(event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (!drag.current) return;
      const delta = event.clientX - drag.current.x;
      if (Math.abs(delta) > 6 || dragging) {
        setDragging(true);
        event.currentTarget.scrollLeft = drag.current.left - delta;
      }
    }}
    onPointerUp={finish} onPointerCancel={finish}
    onScroll={() => {
      clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        if (!drag.current && viewport.current) onPageChange(Math.max(0, Math.min(Children.count(children) - 1, Math.round(viewport.current.scrollLeft / pageWidth))));
      }, 120);
    }}>
    <div style={{ display: 'flex', width: 'max-content', alignItems: 'stretch' }}>
      {Children.map(children, (child) => <div style={{ width: pageWidth, flexShrink: 0, scrollSnapAlign: 'start' }}>{child}</div>)}
    </div>
  </div>;
}
