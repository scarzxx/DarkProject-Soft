import { useMemo, useRef, type CSSProperties, type PointerEvent } from "react";

function rgbToHsv([r0, g0, b0]: [number, number, number]) {
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export default function ColorPicker({ color, onChange }: { color: [number, number, number]; onChange: (c: [number, number, number]) => void }) {
  const plane = useRef<HTMLDivElement>(null);
  const hsv = useMemo(() => rgbToHsv(color), [color[0], color[1], color[2]]);
  const pure = hsvToRgb(hsv.h, 1, 1);

  const move = (clientX: number, clientY: number) => {
    const el = plane.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
    onChange(hsvToRgb(hsv.h, s, v));
  };

  const pointer = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e.clientX, e.clientY);
  };

  return <div className="real-color-picker">
    <div
      ref={plane}
      className="sv-plane"
      style={{ "--hue-color": `rgb(${pure.join(",")})` } as CSSProperties}
      onPointerDown={pointer}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e.clientX, e.clientY); }}
    >
      <i style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}/>
    </div>
    <input
      className="hue-range"
      aria-label="Hue"
      type="range"
      min={0}
      max={359}
      value={Math.round(hsv.h)}
      onChange={(e) => onChange(hsvToRgb(+e.target.value, hsv.s, hsv.v))}
    />
  </div>;
}
