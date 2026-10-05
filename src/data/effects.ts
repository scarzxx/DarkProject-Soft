import { Waves, Orbit, Shuffle, Sparkles, Footprints, Wind, Palette, Activity, Lightbulb, Radio, MousePointer2, Zap, AudioLines, CloudRain, Paintbrush, Power } from "lucide-react";

export const EFFECTS = [
  { id: 0, name: "Wave", icon: Waves, color: true, rate: true, direction: true, custom: false, localOnly: false },
  { id: 1, name: "Spiral Wave", icon: Orbit, color: false, rate: true, direction: true, custom: false, localOnly: false },
  { id: 2, name: "Random", icon: Shuffle, color: false, rate: true, direction: false, custom: false, localOnly: false },
  { id: 3, name: "Star", icon: Sparkles, color: false, rate: true, direction: false, custom: false, localOnly: false },
  { id: 4, name: "Footprint", icon: Footprints, color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 5, name: "River", icon: Wind, color: true, rate: false, direction: false, custom: false, localOnly: false },
  { id: 6, name: "Color Cycle", icon: Palette, color: false, rate: true, direction: false, custom: false, localOnly: false },
  { id: 7, name: "Breathing", icon: Activity, color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 8, name: "Solid", icon: Lightbulb, color: true, rate: false, direction: false, custom: false, localOnly: false },
  { id: 9, name: "Ripples", icon: Radio, color: true, rate: false, direction: false, custom: false, localOnly: false },
  { id: 10, name: "Trigger", icon: MousePointer2, color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 11, name: "Color Discharge", icon: Zap, color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 12, name: "Sine Wave", icon: AudioLines, color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 13, name: "Rain", icon: CloudRain, color: true, rate: true, direction: false, custom: false, localOnly: false },
  { id: 19, name: "Custom", icon: Paintbrush, color: true, rate: false, direction: false, custom: true, localOnly: false },
  { id: 20, name: "LED Off", icon: Power, color: false, rate: false, direction: false, custom: false, localOnly: true },
] as const;

export const EFFECT_NAME = Object.fromEntries(EFFECTS.map((e) => [e.id, e.name])) as Record<number, string>;
