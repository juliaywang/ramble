export function motionDelay(ms: number) {
  if (typeof window === "undefined") return ms;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 160 : ms;
}
