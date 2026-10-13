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

All components require `children`. `DotSendTranscript` and `DotSendBubble` also accept `className` and `style`.

### `DotSendProvider`

Use one per conversation; set `key={conversationId}` when switching conversations.

| Prop | Default | Purpose |
| --- | --- | --- |
| `accent` | `"blue"` | Bubble palette, listed below |
| `enabled` | `true` | Enable motion; system reduced motion always takes precedence |
| `options` | See below | Motion settings |

Accents: `gray`, `pink`, `orchid`, `coral`, `orange`, `yellow`, `lime`, `teal`, `cyan`, `blue`, `violet`. Yellow and lime use dark text.

### `DotSendTranscript`

Use at most one per provider. Set a height or flex layout and place bubbles directly inside it.

| Prop | Default | Purpose |
| --- | --- | --- |
| `viewportRef` | Unset | Ref to the scroll container |
| `aria-label` | `"Messages"` | Accessible label |

### `DotSendBubble`

| Prop | Default | Purpose |
| --- | --- | --- |
| `id` | Required | Unique, stable message ID (`string`) |
| `side` | `"sent"` | `"sent"` or `"received"`; received bubbles have no send effect or receipt |
| `receipt` | Unset | Receipt content (`ReactNode`) |
| `receiptState` | `"delivered"` | `"pending"`, `"delivered"`, or `"read"`; controlled by your app |
| `groupedNext` | `false` | Remove extra spacing between grouped rows |

## Motion options

| Option | Default | Meaning |
| --- | --- | --- |
| `durationMs` | `600` | Main animation duration; `0` disables movement; maximum `20000` |
| `receiptDelayMs` | `200` | Additional delay before revealing the receipt |
| `squishXPx` / `squishYPx` | `18` / `4` | Squash amount, adjusted to bubble size |
| `overshootPx` | `3` | Spring rebound amplitude |
| `easing` | Unset | CSS easing override |

Pass these through `DotSendProvider.options`. Numeric values must be finite and nonnegative.

Exported types: `DotSendOptions`, `DotSendAccent`, `DotSendProviderProps`, `DotSendTranscriptProps`, `DotSendBubbleProps`.

## Sending

```ts
const { captureSend, cancelSend } = useDotSend();
const cancelCapture = captureSend(id, composerElement);
```

- Call `captureSend` with the visible composer wrapper **before** appending the optimistic message or clearing the composer, in the same synchronous event. No `flushSync` is needed.
- Keep the same unique ID and React key when the server responds. Messages without a capture appear immediately.
- Call `cancelCapture()` or `cancelSend(id)` if a captured send is abandoned before its bubble mounts. They do not stop an active animation.
- The example does not auto-scroll. Control scrolling through `viewportRef` in a layout effect, before the animation frame.
- Set `receiptState="pending"` until the server confirms delivery; animation completion does not imply delivery. Newer receipts hide older ones.
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

- Colors: `--dot-send-sent-background`, `--dot-send-received-background`, `--dot-send-foreground`, `--dot-send-receipt-color`.
- Receipt layout: `--dot-send-receipt-origin` (default `center`), `--dot-send-receipt-padding-inline` (default `16px`).

## Compatibility and limits

- Tested with React 19.2 and Chromium. Safari, Firefox, virtualized lists, transformed ancestors, percentage/elliptical radii, gradient/bordered bubbles, and asynchronous attachments are unverified.
- Canceling the latest of several pending captures can leave its origin selected for the remaining send when composer positions differ.
- Without the Web Animations API, messages appear immediately. Without CSS `linear()` support, the main movement uses `ease-out`.
