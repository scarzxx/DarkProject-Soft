export const EFFECTS = [
  { id: 0, name: "Wave", glyph: "〰" },
  { id: 1, name: "Spiral Wave", glyph: "◎" },
  { id: 2, name: "Random", glyph: "✣" },
  { id: 3, name: "Star", glyph: "✦" },
  { id: 4, name: "Footprint", glyph: "◌" },
  { id: 5, name: "River", glyph: "≈" },
  { id: 6, name: "Color Cycle", glyph: "◒" },
  { id: 7, name: "Breathing", glyph: "⌁" },
  { id: 8, name: "Solid", glyph: "■" },
  { id: 9, name: "Ripples", glyph: "◉" },
  { id: 10, name: "Trigger", glyph: "✧" },
  { id: 11, name: "Color Discharge", glyph: "◈" },
  { id: 12, name: "Sine Wave", glyph: "∿" },
  { id: 13, name: "Rain", glyph: "⋮" },
  { id: 19, name: "Custom", glyph: "+" },
  { id: 20, name: "LED Off", glyph: "⊘", localOnly: true },
] as const;

export const EFFECT_NAME = Object.fromEntries(EFFECTS.map((e) => [e.id, e.name])) as Record<number, string>;
