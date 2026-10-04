export const EFFECTS = [
  { id: 0, name: "Wave", glyph: "〰", color: true, rate: true, direction: true, custom: false, localOnly: false },
  { id: 1, name: "Spiral Wave", glyph: "◎", color: false, rate: true, direction: true, custom: false, localOnly: false },
  { id: 2, name: "Random", glyph: "✣", color: false, rate: true, direction: false, custom: false, localOnly: false },
  { id: 3, name: "Star", glyph: "✦", color: false, rate: true, direction: false, custom: false, localOnly: false },
  { id: 4, name: "Footprint", glyph: "◌", color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 5, name: "River", glyph: "≈", color: true, rate: false, direction: false, custom: false, localOnly: false },
  { id: 6, name: "Color Cycle", glyph: "◒", color: false, rate: true, direction: false, custom: false, localOnly: false },
  { id: 7, name: "Breathing", glyph: "⌁", color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 8, name: "Solid", glyph: "■", color: true, rate: false, direction: false, custom: false, localOnly: false },
  { id: 9, name: "Ripples", glyph: "◉", color: true, rate: false, direction: false, custom: false, localOnly: false },
  { id: 10, name: "Trigger", glyph: "✧", color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 11, name: "Color Discharge", glyph: "◈", color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 12, name: "Sine Wave", glyph: "∿", color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 13, name: "Rain", glyph: "⋮", color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 19, name: "Custom", glyph: "+", color: true, rate: false, direction: false, custom: true, localOnly: false },
  { id: 20, name: "LED Off", glyph: "⊘", color: false, rate: false, direction: false, custom: false, localOnly: true },
] as const;

export const EFFECT_NAME = Object.fromEntries(EFFECTS.map((e) => [e.id, e.name])) as Record<number, string>;
