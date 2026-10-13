# API

Requires React 19, React DOM 19, and ESM. React Server Components frameworks need a `'use client'` boundary; load the stylesheet through the host's CSS entry point.

## Example

```tsx
'use client';

import { useRef, useState } from 'react';
import {
  DotSendBubble,
  DotSendProvider,
  DotSendTranscript,
  useDotSend,
} from 'codex-dot-send-motion';
import 'codex-dot-send-motion/styles.css';

function Conversation() {
  const composer = useRef<HTMLDivElement>(null);
  const { captureSend } = useDotSend();
  const [draft, setDraft] = useState('Hello, Dot');
  const [messages, setMessages] = useState<{ id: string; text: string }[]>([]);

  function send() {
    if (!draft.trim()) return;
    const id = crypto.randomUUID();
    captureSend(id, composer.current); // Capture before updating the layout.
    setMessages(previous => [...previous, { id, text: draft }]);
    setDraft('');
  }

  return <>
    <DotSendTranscript style={{ height: 360 }}>
      {messages.map(message => (
        <DotSendBubble key={message.id} id={message.id}>
          {message.text}
        </DotSendBubble>
      ))}
    </DotSendTranscript>
    <div ref={composer}>
      <textarea aria-label="Message" value={draft}
        onChange={event => setDraft(event.target.value)} />
      <button onClick={send}>Send</button>
    </div>
  </>;
}

export default function Example() {
  return <DotSendProvider><Conversation /></DotSendProvider>;
}
```

## Components

| Export | Props / behavior |
| --- | --- |
| `DotSendProvider` | Required `children`; `accent="blue"`, `enabled=true`, `options` below. One per conversation; use `key={conversationId}` when switching conversations. System reduced motion takes precedence. |
| `DotSendTranscript` | Required `children`; `className`, `style`, `viewportRef`, `aria-label="Messages"`. At most one per provider. Set a height or flex layout; place bubbles directly inside it. |
| `DotSendBubble` | Required `id`, `children`; `side="sent"` (`sent` / `received`), `receipt`, `receiptState="delivered"` (`pending` / `delivered` / `read`), `groupedNext=false`, `className`, `style`. Received bubbles have no send effect or receipt. |

Accents: `gray`, `pink`, `orchid`, `coral`, `orange`, `yellow`, `lime`, `teal`, `cyan`, `blue`, `violet`. Yellow and lime use dark text.

### Motion options

| Option | Default | Meaning |
| --- | --- | --- |
| `durationMs` | `600` | Main animation duration; `0` disables movement; maximum `20000` |
| `receiptDelayMs` | `200` | Additional delay before revealing the receipt |
| `squishXPx` / `squishYPx` | `18` / `4` | Squash amount, adjusted to bubble size |
| `overshootPx` | `3` | Spring rebound amplitude |
| `easing` | Unset | CSS easing override |

Numeric options must be finite and nonnegative. Exported types: `DotSendOptions`, `DotSendAccent`, and the three component prop types.

## Sending and lifecycle

```ts
const { captureSend, cancelSend } = useDotSend();
const cancelCapture = captureSend(id, composerElement);
```

- Call `captureSend` with the visible composer wrapper **before** appending the optimistic message or clearing the composer, in the same synchronous event. No `flushSync` is needed.
- Keep the same unique ID and React key when the server responds. Messages without a capture appear immediately.
- Call `cancelCapture()` or `cancelSend(id)` if a captured send is abandoned before its bubble mounts. They do not stop an active animation.
- Scrolling and delivery state belong to the host. The example does not auto-scroll; use `viewportRef` and a layout effect to apply your scroll policy before the animation frame.
- Set `receiptState="pending"` until the server confirms delivery. Animation completion does not imply delivery. Default receipt timing is 800 ms before a 400 ms CSS reveal; newer receipts hide older ones.
- Unmounting or disabling motion cleans up animations. Keep content dimensions stable during motion and avoid separately animating the internal body's `transform` or `translate`.

## Styling

Set these properties on an ancestor; explicit `--dot-send-*` values override inherited theme tokens:

```css
.chat {
  --dot-send-radius: 22px;
  --dot-send-max-width: 88%;
  --dot-send-min-height: 36px;
  --dot-send-font-size: 1rem;
  --dot-send-line-height: 1.5rem;
  --dot-send-receipt-font-size: 11px;
}
```

Optional color overrides: `--dot-send-sent-background`, `--dot-send-received-background`, `--dot-send-foreground`, `--dot-send-receipt-color`. Receipt geometry: `--dot-send-receipt-origin` (default `center`) and `--dot-send-receipt-padding-inline` (default `16px`). `groupedNext` removes the extra gap between grouped rows.

## Compatibility and limits

- Tested with React 19.2 and Chromium. Safari, Firefox, virtualized lists, transformed ancestors, percentage/elliptical radii, gradient/bordered bubbles, and asynchronous attachments are unverified.
- Native window material, avatars, and networking are outside this component's scope.
- Canceling the latest of several pending captures can leave its origin selected for the remaining send when composer positions differ.
- Without the Web Animations API, messages appear immediately. Without CSS `linear()` support, the main movement uses `ease-out`.
