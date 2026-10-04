import { useMemo, type CSSProperties } from "react";
import { FN_SLOT, ROWS, SLOT_BY_HID, type KeyDef } from "../data/keyboard";
import type { RawKeyBinding } from "../lib/types";

type Props = {
  color: [number, number, number];
  selected?: string;
  onSelect?: (key: KeyDef) => void;
  snapHids?: Set<number>;
  keyBindings?: RawKeyBinding[];
};

export default function KeyboardView({ color, selected, onSelect, snapHids, keyBindings }: Props) {
  const bindings = useMemo(() => new Map(keyBindings?.map((b) => [b.slot, b]) ?? []), [keyBindings]);
  const css = { "--key-rgb": `rgb(${color.join(",")})` } as CSSProperties;
  return <div className="keyboard-shell" style={css}>
    <div className="keyboard-aurora" />
    <div className="keyboard-board">
      {ROWS.map((row, rowIndex) => <div className="key-row" key={rowIndex}>
        {row.map((key) => {
          const slot = key.special ? FN_SLOT : SLOT_BY_HID.get(key.hid);
          const binding = slot === undefined ? undefined : bindings.get(slot);
          const remapped = !!binding && !(binding.kind === 1 && binding.code === key.hid);
          return <button key={key.id} title={key.id} onClick={() => onSelect?.(key)}
            className={`keycap ${selected === key.id ? "selected" : ""} ${snapHids?.has(key.hid) ? "snap" : ""} ${remapped ? "remapped" : ""}`}
            style={{ width: `calc(${key.w ?? 1} * var(--key-unit))`, marginLeft: `calc(${key.gap ?? 0} * var(--key-gap))` }}>
            <span>{key.label}</span>{remapped && <i className="remap-dot" />}
          </button>;
        })}
      </div>)}
    </div>
  </div>;
}
