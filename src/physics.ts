// Spring and easing adaptation: Motion, MIT. See THIRD_PARTY_NOTICES.md.
export interface DotSendOptions {
  durationMs?: number;
  receiptDelayMs?: number;
  squishXPx?: number;
  squishYPx?: number;
  overshootPx?: number;
  /** CSS easing override. Omit to use the distance-dependent spring. */
  easing?: string;
}
export const defaults = Object.freeze({
  durationMs: 600,
  receiptDelayMs: 200,
  squishXPx: 18,
  squishYPx: 4,
  overshootPx: 3,
});
export type MotionOptions = Required<Omit<DotSendOptions, 'easing'>> &
  Pick<DotSendOptions, 'easing'>;
export function resolveOptions(options: DotSendOptions = {}): MotionOptions {
  const result = { ...defaults, ...options };
  for (const name of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = result[name];
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError(`${name} must be finite and nonnegative`);
  }
  // Bound 10 ms easing samples to 2,000 entries. This is a wrapper resource guard.
  if (result.durationMs > 20_000) throw new RangeError('durationMs must not exceed 20000 ms');
  return result;
}
export const widthEasing = 'cubic-bezier(0.73, 0.42, 0.54, 1)';
export const squishEasing = 'cubic-bezier(0.65, 0, 0.35, 1)';
export const recoveryEasing = 'cubic-bezier(0.19, 0, 0.48, 1)';
export function widthTiming(options: MotionOptions): KeyframeAnimationOptions {
  return { duration: (190 / 600) * options.durationMs, easing: options.easing ?? widthEasing };
}
/** Zero-velocity spring, sampled into native CSS linear(). */
export function springEasing(distance: number, options: MotionOptions): string {
  const ratio = distance === 0 ? 0 : Math.min(options.overshootPx / distance, 0.99);
  const log = -Math.log(ratio);
  const dampingRatio = ratio === 0 ? 1 : log / Math.hypot(Math.PI, log);
  // Preserve floating-point operation order: k=140, mass=1.
  const stiffness = 140,
    damping = 2 * dampingRatio * Math.sqrt(stiffness);
  const zeta = damping / (2 * Math.sqrt(stiffness));
  const omega = Math.sqrt(stiffness) / 1000;
  const frequency = omega * Math.sqrt(1 - zeta * zeta);
  const amplitude = zeta < 1 ? (zeta * omega * 100) / frequency : 0;
  const sineVelocity = zeta * omega * amplitude + 100 * frequency;
  const cosineVelocity = zeta * omega * 100 - amplitude * frequency;
  function sample(ms: number) {
    const decay = Math.exp(-zeta * omega * ms);
    const value =
      zeta < 1
        ? 100 - decay * (amplitude * Math.sin(frequency * ms) + 100 * Math.cos(frequency * ms))
        : 100 - Math.exp(-omega * ms) * (100 + omega * 100 * ms);
    const velocity =
      zeta < 1
        ? 1000 *
          decay *
          (sineVelocity * Math.sin(frequency * ms) + cosineVelocity * Math.cos(frequency * ms))
        : 1000 * Math.exp(-omega * ms) * omega * omega * 100 * ms;
    const done = Math.abs(velocity) <= 15 && Math.abs(100 - value) <= 0.5;
    return { done, value: done ? 100 : value };
  }
  let naturalDuration = 0;
  while (naturalDuration < 20_000 && !sample(naturalDuration).done) naturalDuration += 50;
  const count = Math.max(Math.round(options.durationMs / 10), 2);
  return `linear(${Array.from(
    { length: count },
    (_, i) => Math.round((sample(naturalDuration * (i / (count - 1))).value / 100) * 1e4) / 1e4,
  ).join(', ')})`;
}
