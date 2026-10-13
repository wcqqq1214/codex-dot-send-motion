import { recoveryEasing, springEasing, squishEasing, widthTiming } from './physics.js';
import type { MotionOptions } from './physics.js';
export interface OriginRect {
  top: number;
  right: number;
  bottom: number;
  width: number;
}
export interface BubbleElements {
  row: HTMLElement;
  body: HTMLElement;
  bubble: HTMLElement;
  text: HTMLElement;
}
export interface MotionHandle {
  cancel(): void;
}
export function cssZoom(element: HTMLElement): number {
  const native = (element as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  if (native && Number.isFinite(native)) return native;
  // Fallback for browsers without currentCSSZoom; transforms are intentionally not zoom.
  let zoom = 1;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const value = parseFloat(getComputedStyle(node).getPropertyValue('zoom'));
    if (Number.isFinite(value) && value > 0) zoom *= value;
  }
  return zoom;
}
function saveProperty(element: HTMLElement, name: string) {
  const value = element.style.getPropertyValue(name),
    priority = element.style.getPropertyPriority(name);
  return () =>
    value ? element.style.setProperty(name, value, priority) : element.style.removeProperty(name);
}
/** Animates existing DOM only. No clones of text, timers, portals, or network calls. */
export function animateBubble(
  elements: BubbleElements,
  origin: OriginRect,
  options: MotionOptions,
  complete: () => void = () => {},
): MotionHandle {
  const { row, body, bubble, text } = elements;
  const rect = body.getBoundingClientRect(),
    zoom = cssZoom(body);
  if (
    !body.isConnected ||
    !rect.width ||
    !rect.height ||
    body.closest('[inert]') ||
    options.durationMs === 0
  ) {
    complete();
    return { cancel() {} };
  }
  const animations: Animation[] = [],
    backgroundAnimations: Animation[] = [];
  const restoreBody = saveProperty(body, '--dot-send-body-width');
  const restoreText = saveProperty(bubble, '--dot-send-text-width');
  const restoreFill = saveProperty(bubble, 'background-color');
  const hadMarker = row.hasAttribute('data-dot-sending');
  let background: HTMLDivElement | undefined,
    cleaned = false,
    backgroundCleaned = false;
  function clearBackground() {
    if (backgroundCleaned) return;
    backgroundCleaned = true;
    backgroundAnimations.forEach((animation) => animation.cancel());
    background?.remove();
    restoreFill();
    restoreText();
    bubble.classList.remove('dot-send-bubble-active');
    text.classList.remove('dot-send-text-active');
  }
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    animations.forEach((animation) => animation.cancel());
    clearBackground();
    restoreBody();
    body.classList.remove('dot-send-body-active');
    if (!hadMarker) row.removeAttribute('data-dot-sending');
    complete();
  }
  function animate(
    element: HTMLElement,
    keyframes: Keyframe[],
    timing: KeyframeAnimationOptions,
    backgroundPart = false,
  ) {
    const animation = element.animate(keyframes, timing);
    animations.push(animation);
    if (backgroundPart) backgroundAnimations.push(animation);
    return animation;
  }
  try {
    const bubbleRect = bubble.getBoundingClientRect(),
      bubbleZoom = cssZoom(bubble);
    const width = bubbleRect.width / bubbleZoom,
      height = bubbleRect.height / bubbleZoom;
    const style = getComputedStyle(bubble);
    const radii = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map(parseFloat);
    const [tl, tr, br, bl] = radii;
    const factor = Math.min(
      1,
      width / (tl + tr),
      width / (bl + br),
      height / (tl + bl),
      height / (tr + br),
    );
    const left = Math.max(tl, bl) * factor,
      right = Math.max(tr, br) * factor;
    const extra = Math.max(0, origin.width / zoom - width),
      seam = 1 / bubbleZoom;
    const middleWidth = Math.max(1, width + extra - left - right);
    background = document.createElement('div');
    background.className = 'dot-send-background';
    background.setAttribute('aria-hidden', 'true');
    background.style.setProperty('--dot-send-fill', style.backgroundColor);
    const capLeft = document.createElement('span'),
      middle = document.createElement('span'),
      capRight = document.createElement('span');
    capLeft.style.width = `${left + seam}px`;
    capLeft.style.borderRadius = `${tl * factor}px 0 0 ${bl * factor}px`;
    middle.style.right = `${right}px`;
    middle.style.width = `${middleWidth}px`;
    capRight.style.width = `${right + seam}px`;
    capRight.style.borderRadius = `0 ${tr * factor}px ${br * factor}px 0`;
    background.append(capLeft, middle, capRight);
    bubble.append(background);
    const timing = { ...widthTiming(options), fill: 'both' as const };
    const slide = [{ translate: `${-extra}px 0px` }, { translate: '0px 0px' }];
    const backgroundDone = animate(capLeft, slide, timing, true);
    animate(
      middle,
      [
        { transform: 'scaleX(1)' },
        { transform: `scaleX(${(width - left - right) / middleWidth})` },
      ],
      timing,
      true,
    );
    animate(text, slide, timing, true);
    const textWidth = text.getBoundingClientRect().width;
    body.classList.add('dot-send-body-active');
    body.style.setProperty('--dot-send-body-width', `${rect.width / zoom}px`);
    bubble.style.setProperty('--dot-send-text-width', `${textWidth / zoom}px`);
    bubble.style.backgroundColor = 'transparent';
    bubble.classList.add('dot-send-bubble-active');
    text.classList.add('dot-send-text-active');
    row.setAttribute('data-dot-sending', '');
    const size = Math.min(1, Math.max(rect.width, rect.height) / (360 * zoom));
    const sx = Math.max(0.5, 1 - (options.squishXPx * size) / (rect.width / zoom));
    const sy = Math.max(0.5, 1 - (options.squishYPx * size) / (rect.height / zoom));
    const dx = (origin.right - rect.right) / zoom;
    const dy = (Math.min(origin.top, origin.bottom - rect.height) - rect.top) / zoom;
    let easing = options.easing ?? springEasing(Math.hypot(dx, dy), options);
    if (!CSS.supports('animation-timing-function', easing)) easing = 'ease-out';
    animate(body, [{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], {
      duration: options.durationMs,
      easing,
    });
    animate(
      body,
      [
        { transform: 'scale(1)', offset: 0, easing: options.easing ?? squishEasing },
        {
          transform: `scale(${sx}, ${sy})`,
          offset: 1 / 3,
          easing: options.easing ?? recoveryEasing,
        },
        { transform: 'scale(1)', offset: 0.9, easing: options.easing ?? squishEasing },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: options.durationMs, easing: 'linear' },
    );
    const done = animate(body, [], { duration: options.durationMs + options.receiptDelayMs });
    const start = document.timeline.currentTime;
    animations.forEach((animation) => {
      animation.startTime = start;
    });
    backgroundDone.onfinish = clearBackground;
    done.onfinish = cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
  return { cancel: cleanup };
}
