import { StrictMode, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DotSendBubble, DotSendProvider, DotSendTranscript, useDotSend } from '../src/index';
import '../src/styles.css';

const fixture = document.querySelector<HTMLDivElement>('#fixture')!;
const results = document.querySelector<HTMLPreElement>('#results')!;
const run = document.querySelector<HTMLButtonElement>('#run')!;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function nextFrame() {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type ComposerMode = 'visible' | 'hidden' | 'removed';
interface Controls {
  send(texts: string[], mode?: ComposerMode): void;
  disable(): void;
}

function Conversation({ controls }: { controls: Controls }) {
  const { captureSend } = useDotSend();
  const composer = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [mode, setMode] = useState<ComposerMode>('visible');
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [messages]);
  controls.send = (texts, nextMode = 'visible') => {
    for (const text of texts) captureSend(text, composer.current);
    setMessages((previous) => [...previous, ...texts]);
    setMode(nextMode);
  };
  return (
    <>
      <DotSendTranscript viewportRef={viewport} style={{ height: 160 }}>
        <DotSendBubble id="initial" side="received">
          Existing message
        </DotSendBubble>
        {messages.map((id) => (
          <DotSendBubble key={id} id={id} receipt="Sent">
            {id}
          </DotSendBubble>
        ))}
      </DotSendTranscript>
      {mode !== 'removed' && (
        <div
          ref={composer}
          style={{ width: 400, height: 60, display: mode === 'hidden' ? 'none' : undefined }}
        />
      )}
    </>
  );
}

function Host({ controls }: { controls: Controls }) {
  const [enabled, setEnabled] = useState(true);
  controls.disable = () => setEnabled(false);
  return (
    <DotSendProvider enabled={enabled}>
      <Conversation controls={controls} />
    </DotSendProvider>
  );
}

async function withConversation(check: (controls: Controls, unmount: () => void) => Promise<void>) {
  const controls: Controls = { send() {}, disable() {} };
  const root = createRoot(fixture);
  let mounted = true;
  const unmount = () => {
    if (mounted) {
      flushSync(() => root.unmount());
      mounted = false;
    }
  };
  try {
    flushSync(() =>
      root.render(
        <StrictMode>
          <Host controls={controls} />
        </StrictMode>,
      ),
    );
    await check(controls, unmount);
  } finally {
    unmount();
  }
}

function assertRestored() {
  assert(
    !fixture.querySelector('[data-dot-sending], .dot-send-background'),
    'Send state or background leaked',
  );
  // Receipt CSS transitions can legitimately start when the send gate is removed.
  const motion = fixture
    .getAnimations({ subtree: true })
    .filter((animation) => !(animation instanceof CSSTransition));
  assert(motion.length === 0, 'Send or old-row animation remained active');
  for (const body of fixture.querySelectorAll('.dot-send-body')) {
    assert(getComputedStyle(body).visibility === 'visible', 'Message remained hidden');
  }
}

run.addEventListener('click', async () => {
  const lines: string[] = [];
  run.disabled = true;
  results.textContent = 'Running';
  try {
    assert(typeof fixture.animate === 'function', 'This suite requires Web Animations API');
    assert(
      !matchMedia('(prefers-reduced-motion: reduce)').matches,
      'Run the motion suite with reduced motion off; it separately tests the reduced-motion boundary',
    );
    await withConversation(async (controls) => {
      assertRestored();
      flushSync(() => controls.send(['first', 'second']));
      await nextFrame();
      assert(
        fixture.querySelectorAll('[data-dot-sending]').length === 2,
        'Both batched sends should animate in StrictMode',
      );
      assert(
        fixture.querySelectorAll('.dot-send-background').length === 2,
        'Missing animation backgrounds',
      );
      assert(
        fixture.querySelector('[data-message-id="initial"]')!.getAnimations().length > 0,
        'Fixture must exercise old-row movement before disabling',
      );
      flushSync(() => controls.disable());
      assertRestored();
    });
    lines.push(
      'PASS StrictMode / history / batched sends / disable clears bubble and old-row animations',
    );

    await withConversation(async (controls) => {
      flushSync(() => controls.send(['scheduled-cleanup']));
      await nextFrame();
      assert(fixture.querySelector('[data-dot-sending]'), 'Send did not start');
      await wait(250);
      assert(
        !fixture.querySelector('.dot-send-background'),
        'Background did not clear after 190 ms',
      );
      assert(fixture.querySelector('[data-dot-sending]'), 'Receipt gate cleared too early');
      await wait(650);
      assertRestored();
    });
    lines.push('PASS background cleanup and receipt gate (real timer intervals)');

    for (const mode of ['hidden', 'removed'] as const) {
      await withConversation(async (controls) => {
        flushSync(() => controls.send([mode], mode));
        await nextFrame();
        assertRestored();
      });
    }
    lines.push('PASS composer hidden or removed before the first frame restores readable messages');

    for (const beforeFrame of [true, false]) {
      await withConversation(async (controls, unmount) => {
        flushSync(() => controls.send(['unmount']));
        if (!beforeFrame) await nextFrame();
        const animations = fixture.getAnimations({ subtree: true });
        unmount();
        await nextFrame();
        assert(!fixture.children.length, 'Unmount leaked nodes');
        assert(
          animations.every((animation) => animation.playState === 'idle'),
          'Unmount left detached animations running',
        );
      });
    }
    lines.push('PASS unmount before and during animation');

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => {
      const real = originalMatchMedia.call(window, query);
      return new Proxy(real, {
        get(target, key) {
          if (key === 'matches' && query.includes('prefers-reduced-motion')) return true;
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    };
    try {
      await withConversation(async (controls) => {
        flushSync(() => controls.send(['reduced-motion']));
        await nextFrame();
        assertRestored();
      });
    } finally {
      window.matchMedia = originalMatchMedia;
    }
    lines.push('PASS reduced-motion preference (mock MediaQueryList boundary)');
    results.textContent = lines.join('\n') + '\nALL CHECKS PASSED';
  } catch (error) {
    results.textContent = lines.join('\n') + '\nFAIL ' + String(error);
    console.error(error);
  } finally {
    run.disabled = false;
  }
});
