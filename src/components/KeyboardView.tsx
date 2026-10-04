import { useMemo, type CSSProperties } from "react";
import { getKeyboardKeys, type KeyDef } from "../data/keyboard";
import { getLayout } from "../data/registry";
import { useLanguage } from "../lib/i18n";
import type { RawKeyBinding } from "../lib/types";

type Props = {
  styleName: string | null;
  color: [number, number, number];
  selected?: string;
  onSelect?: (key: KeyDef) => void;
  snapHids?: Set<number>;
  keyBindings?: RawKeyBinding[];
};

export default function KeyboardView({ styleName, color, selected, onSelect, snapHids, keyBindings }: Props) {
  const { t } = useLanguage();
  const layout = getLayout(styleName);
  const keys = getKeyboardKeys(styleName);
  const bindings = useMemo(() => new Map(keyBindings?.map((b) => [b.slot, b]) ?? []), [keyBindings]);
  const css = { "--key-rgb": `rgb(${color.join(",")})` } as CSSProperties;
  if (!layout) return <div className="empty-state">{t("Layout unavailable")}</div>;
  return <div className="keyboard-shell" style={css}>
    <div className="keyboard-aurora" />
    <div className="keyboard-board" style={{ aspectRatio: `${parseFloat(layout.width)} / ${parseFloat(layout.height)}` }}>
        {keys.map((key) => {
          const slot = key.slot;
          const binding = slot === undefined ? undefined : bindings.get(slot);
          const remapped = !!binding && !(binding.kind === 1 && binding.code === key.hid);
          return <button key={key.id} title={key.id} onClick={() => onSelect?.(key)}
            className={`keycap ${selected === key.id ? "selected" : ""} ${snapHids?.has(key.hid) ? "snap" : ""} ${remapped ? "remapped" : ""}`}
            style={{ left: key.left, top: key.top, width: key.width, height: key.height, paddingBottom: key.paddingBottom }}>
            <span>{key.label}</span>{remapped && <i className="remap-dot" />}
          </button>;
        })}
    </div>
  </div>;
}
