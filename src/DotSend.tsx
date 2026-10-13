'use client';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';
import type { CSSProperties, ReactNode, Ref } from 'react';
import { animateBubble, cssZoom } from './animate.js';
import type { DotSendAccent } from './appearance.js';
import type { MotionHandle, OriginRect } from './animate.js';
import { resolveOptions, widthTiming } from './physics.js';
import type { DotSendOptions, MotionOptions } from './physics.js';
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
interface Snapshot {
  composer: HTMLElement;
  origin: OriginRect;
  rows: { element: HTMLElement; top: number }[];
}
interface QueuedSend {
  snapshot: Snapshot;
  options: MotionOptions;
  start(origin: OriginRect, composer: HTMLElement): void;
  restore(): void;
}
interface Registry {
  list: HTMLElement | null;
  latestCapture: Snapshot | null;
  queued: Set<QueuedSend>;
  scheduling: boolean;
  frame: number;
  generation: number;
  rows: Set<HTMLElement>;
  pending: Map<string, Snapshot>;
  shifts: Set<Animation>;
  active: Set<MotionHandle>;
}
function cancelRegistry(registry: Registry) {
  registry.generation++;
  registry.scheduling = false;
  cancelAnimationFrame(registry.frame);
  registry.frame = 0;
  registry.queued.forEach((entry) => entry.restore());
  registry.queued.clear();
  registry.latestCapture = null;
  registry.pending.clear();
  registry.active.forEach((handle) => handle.cancel());
  registry.active.clear();
  registry.shifts.forEach((animation) => animation.cancel());
  registry.shifts.clear();
}
function releasePending(registry: Registry, id: string, expected?: Snapshot) {
  if (expected && registry.pending.get(id) !== expected) return;
  registry.pending.delete(id);
  if (!registry.pending.size && !registry.queued.size) registry.latestCapture = null;
}
/** One microtask/animation-frame batch with a shared origin snapshot. */
function enqueueSend(registry: Registry, entry: QueuedSend) {
  registry.queued.add(entry);
  if (!registry.scheduling && !registry.frame) {
    registry.scheduling = true;
    const generation = registry.generation;
    queueMicrotask(() => {
      if (generation !== registry.generation) return;
      registry.scheduling = false;
      if (!registry.queued.size) return;
      const snapshot = registry.latestCapture ?? entry.snapshot;
      // Capture the origin when scheduling the frame, but read
      // the latest captured old-row positions when that frame actually runs.
      const { origin, composer } = snapshot;
      registry.frame = requestAnimationFrame(() => {
        registry.frame = 0;
        const rows = (registry.latestCapture ?? snapshot).rows;
        registry.latestCapture = null;
        if (!registry.queued.size) return;
        const offsets = rows.map(({ element, top }) => ({
          element,
          delta: (top - element.getBoundingClientRect().top) / cssZoom(element),
        }));
        rows.length = 0;
        try {
          for (const { element, delta } of offsets) {
            if (!element.isConnected || !delta) continue;
            const shift = element.animate(
              [{ translate: `0px ${delta}px` }, { translate: '0px 0px' }],
              widthTiming(entry.options),
            );
            shift.startTime = document.timeline.currentTime;
            registry.shifts.add(shift);
            shift.onfinish = () => {
              shift.cancel();
              registry.shifts.delete(shift);
            };
          }
        } catch (error) {
          cancelRegistry(registry);
          console.error('Dot row animation could not start', error);
          return;
        }
        const batch = [...registry.queued];
        registry.queued.clear();
        for (const queued of batch) queued.start(origin, composer);
      });
    });
  }
  return () => {
    registry.queued.delete(entry);
    entry.restore();
  };
}
interface ContextValue {
  accent: DotSendAccent;
  registry: Registry;
  options: MotionOptions;
  enabled: boolean;
}
const Context = createContext<ContextValue | null>(null);
function useScope() {
  const scope = useContext(Context);
  if (!scope) throw new Error('DotSendBubble and useDotSend must be inside DotSendProvider');
  return scope;
}
export interface DotSendProviderProps {
  children: ReactNode;
  options?: DotSendOptions;
  /** Conversation accent. Defaults to blue. */
  accent?: DotSendAccent;
  /** System reduced-motion preference is always respected. */
  enabled?: boolean;
}
/** One provider per independent conversation/transcript. */
export function DotSendProvider({
  children,
  options,
  accent = 'blue',
  enabled = true,
}: DotSendProviderProps) {
  const [registry] = useState<Registry>(() => ({
    rows: new Set(),
    pending: new Map(),
    shifts: new Set(),
    active: new Set(),
    list: null,
    latestCapture: null,
    queued: new Set(),
    scheduling: false,
    frame: 0,
    generation: 0,
  }));
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const { durationMs, receiptDelayMs, squishXPx, squishYPx, overshootPx, easing } = options ?? {};
  const resolved = useMemo(
    () =>
      resolveOptions({
        ...(durationMs === undefined ? {} : { durationMs }),
        ...(receiptDelayMs === undefined ? {} : { receiptDelayMs }),
        ...(squishXPx === undefined ? {} : { squishXPx }),
        ...(squishYPx === undefined ? {} : { squishYPx }),
        ...(overshootPx === undefined ? {} : { overshootPx }),
        ...(easing === undefined ? {} : { easing }),
      }),
    [durationMs, receiptDelayMs, squishXPx, squishYPx, overshootPx, easing],
  );
  const motionEnabled = enabled && !reduced;
  // The provider owns every motion in this conversation, including old-row FLIP.
  useBrowserLayoutEffect(() => {
    if (!motionEnabled) cancelRegistry(registry);
    return () => cancelRegistry(registry);
  }, [registry, resolved, motionEnabled]);
  const value = useMemo(
    () => ({ registry, options: resolved, enabled: motionEnabled, accent }),
    [registry, resolved, motionEnabled, accent],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDotSend() {
  const { registry, enabled, options } = useScope();
  return useMemo(
    () => ({
      /** Call BEFORE appending the optimistic message or clearing the composer. No flushSync needed. */
      captureSend(id: string, composer: HTMLElement | null): () => void {
        releasePending(registry, id);
        if (
          !enabled ||
          options.durationMs === 0 ||
          !composer?.isConnected ||
          !composer.getClientRects().length
        )
          return () => {};
        const rect = composer.getBoundingClientRect();
        if (!rect.width || !rect.height) return () => {};
        const rows: Snapshot['rows'] = [];
        if (registry.list) {
          const viewport = registry.list.parentElement?.getBoundingClientRect();
          for (
            let element = registry.list.lastElementChild;
            element;
            element = element.previousElementSibling
          ) {
            if (!(element instanceof HTMLElement)) continue;
            const bounds = element.getBoundingClientRect();
            if (viewport && bounds.bottom < viewport.top) break;
            if (!viewport || bounds.top <= viewport.bottom) rows.push({ element, top: bounds.top });
          }
        } else {
          for (const element of registry.rows) {
            if (element.isConnected && element.getClientRects().length)
              rows.push({ element, top: element.getBoundingClientRect().top });
          }
        }
        registry.shifts.forEach((animation) => animation.cancel());
        registry.shifts.clear();
        const snapshot = {
          composer,
          origin: { top: rect.top, bottom: rect.bottom, right: rect.right, width: rect.width },
          rows,
        };
        registry.latestCapture = snapshot;
        registry.pending.set(id, snapshot);
        // Use this if sending is abandoned before a matching bubble is mounted.
        return () => releasePending(registry, id, snapshot);
      },
      cancelSend(id: string) {
        releasePending(registry, id);
      },
    }),
    [registry, enabled, options.durationMs],
  );
}
export interface DotSendBubbleProps {
  /** Stable unique optimistic ID. Keep this ID/key when replacing it with the server response. */
  id: string;
  children: ReactNode;
  receipt?: ReactNode;
  /** Server delivery state, independent of the animation clock. */
  receiptState?: 'pending' | 'delivered' | 'read';
  side?: 'sent' | 'received';
  /** Remove extra row spacing; derive grouping from your timeline. */
  groupedNext?: boolean;
  className?: string;
  style?: CSSProperties;
}
export function DotSendBubble({
  id,
  children,
  receipt,
  receiptState = 'delivered',
  side = 'sent',
  groupedNext = false,
  className = '',
  style,
}: DotSendBubbleProps) {
  const { registry, options, enabled, accent } = useScope();
  const rowRef = useRef<HTMLDivElement>(null),
    bodyRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null),
    textRef = useRef<HTMLDivElement>(null);
  const captured = useRef<{ id: string; snapshot: Snapshot } | null>(null);
  const finished = useRef(false);
  useBrowserLayoutEffect(() => {
    const row = rowRef.current!,
      body = bodyRef.current!,
      bubble = bubbleRef.current!,
      text = textRef.current!;
    registry.rows.add(row);
    if (captured.current?.id !== id) {
      captured.current = null;
      finished.current = false;
    }
    const pending = registry.pending.get(id);
    if (pending) {
      captured.current = { id, snapshot: pending };
      registry.pending.delete(id);
    }
    let dequeue: (() => void) | undefined, handle: MotionHandle | undefined;
    const snapshot = captured.current?.snapshot;
    const previousVisibility = body.style.visibility;
    const show = () => {
      body.style.visibility = previousVisibility;
    };
    if (
      enabled &&
      side === 'sent' &&
      snapshot &&
      !finished.current &&
      typeof body.animate === 'function'
    ) {
      body.style.visibility = 'hidden';
      row.setAttribute('data-dot-sending', '');
      dequeue = enqueueSend(registry, {
        snapshot,
        options,
        restore: () => {
          show();
          row.removeAttribute('data-dot-sending');
        },
        start(origin, composer) {
          show();
          try {
            // Check visibility at frame time, after layout changes.
            if (!composer.isConnected || composer.getClientRects().length === 0) {
              row.removeAttribute('data-dot-sending');
              finished.current = true;
              captured.current = null;
              return;
            }
            // The engine owns the marker from this point onward.
            row.removeAttribute('data-dot-sending');
            let completedSynchronously = false;
            handle = animateBubble({ row, body, bubble, text }, origin, options, () => {
              completedSynchronously = true;
              finished.current = true;
              captured.current = null;
              if (handle) registry.active.delete(handle);
            });
            if (!completedSynchronously) registry.active.add(handle);
          } catch (error) {
            snapshot.rows.length = 0;
            row.removeAttribute('data-dot-sending');
            finished.current = true;
            captured.current = null;
            // Restore a readable message even when the browser rejects a timing option.
            console.error('Dot send animation could not start', error);
          }
        },
      });
    } else if (snapshot) {
      snapshot.rows.length = 0;
      finished.current = true;
      captured.current = null;
    }
    return () => {
      registry.rows.delete(row);
      dequeue?.();
      show();
      if (handle) {
        handle.cancel();
        registry.active.delete(handle);
      }
      row.removeAttribute('data-dot-sending');
    };
  }, [id, registry, options, enabled, side]);
  return (
    <div
      ref={rowRef}
      className={`dot-send-row ${className}`}
      data-side={side}
      data-grouped-next={groupedNext || undefined}
      data-accent={accent}
      data-message-id={id}
      style={style}
    >
      <div className="dot-send-wrap">
        <div className="dot-send-content-line">
          <div className="dot-send-stack">
            <div className="dot-send-content">
              <div ref={bodyRef} className="dot-send-body">
                <div className="dot-send-surface">
                  <div ref={bubbleRef} className="dot-send-bubble">
                    <div ref={textRef} className="dot-send-text">
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {receipt != null && side === 'sent' && (
              <div
                className="dot-send-receipt"
                role="status"
                aria-hidden={receiptState === 'pending'}
                data-read={receiptState === 'read'}
              >
                <div className="dot-send-receipt-clip">
                  <div className="dot-send-receipt-content">{receipt}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface DotSendTranscriptProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Use for host-owned scrolling in a layout effect, before the send frame. */
  viewportRef?: Ref<HTMLDivElement>;
  'aria-label'?: string;
}
export function DotSendTranscript({
  children,
  className = '',
  style,
  viewportRef,
  'aria-label': label = 'Messages',
}: DotSendTranscriptProps) {
  const { registry } = useScope();
  const viewport = useRef<HTMLDivElement>(null),
    list = useRef<HTMLDivElement>(null);
  useImperativeHandle(viewportRef, () => viewport.current!, []);
  useBrowserLayoutEffect(() => {
    const element = list.current!;
    if (registry.list && registry.list !== element)
      throw new Error('Use one DotSendTranscript per DotSendProvider');
    registry.list = element;
    return () => {
      if (registry.list === element) registry.list = null;
    };
  }, [registry]);
  return (
    <div
      ref={viewport}
      className={`dot-send-viewport ${className}`}
      style={style}
      role="log"
      aria-label={label}
    >
      <div ref={list} className="dot-send-list">
        {children}
      </div>
    </div>
  );
}
