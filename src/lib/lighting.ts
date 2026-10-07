/** Match the brightness levels encoded by the selected protocol driver. */
export function getBrightnessControl(protocol: string | undefined, brightness: number) {
  if (protocol !== "CommonKeyboardSeries") return { step: 1, value: brightness };
  return { step: 25, value: Math.ceil(Math.max(0, Math.min(100, brightness)) / 25) * 25 };
}
