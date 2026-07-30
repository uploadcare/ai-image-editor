/**
 * Run a callback right after the next paint (double `requestAnimationFrame`:
 * the first callback fires just before the upcoming paint, so scheduling from
 * inside it lands the second one after that paint has been committed).
 *
 * Used to flip transition gates only once the current layout is on screen —
 * state applied now snaps in instead of animating from a stale/empty value.
 */
export function afterNextPaint(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}
