<h1 align="center">Codex Dot Send Motion</h1>

<p align="center">A React message-send animation inspired by <a href="https://openai.com/index/introducing-dots/">Codex Dot</a>.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codex-dot-send-motion"><img src="https://img.shields.io/npm/v/codex-dot-send-motion?style=flat" alt="npm version"></a>
  <img src="https://img.shields.io/badge/React-19-20232A?style=flat&amp;logo=react&amp;logoColor=61DAFB" alt="React 19">
  <a href="https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/codex-dot-send-motion?style=flat" alt="MIT License"></a>
</p>

<p align="center">
  <a href="https://wcqqq1214.github.io/codex-dot-send-motion/">Live demo</a> ·
  <a href="https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/docs/api.md">API</a> ·
  <a href="https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/wcqqq1214/codex-dot-send-motion/main/docs/assets/preview.gif" width="520" alt="Demo of the message-send animation">
</p>

## Install

```sh
npm install codex-dot-send-motion
# or
pnpm add codex-dot-send-motion
# or
bun add codex-dot-send-motion
```

> [!NOTE]
> Requires React 19, React DOM 19, and ESM. Respects `prefers-reduced-motion`.

<details>
<summary>Using a coding agent?</summary>

```text
Install and integrate codex-dot-send-motion into this app following:
https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/docs/api.md
Verify types, build, sending, and reduced motion.
```

</details>

## Usage

Click the button to send a message from its position. Call `captureSend` before updating the message list.

```tsx
'use client';
import { useState } from 'react';
import { DotSendProvider, DotSendTranscript, DotSendBubble, useDotSend } from 'codex-dot-send-motion';
import 'codex-dot-send-motion/styles.css';

function Conversation() {
  const [messages, setMessages] = useState<string[]>([]);
  const { captureSend } = useDotSend();

  return <>
    <DotSendTranscript style={{ height: 240 }}>
      {messages.map(id => <DotSendBubble key={id} id={id}>Hello, Dot!</DotSendBubble>)}
    </DotSendTranscript>
    <button onClick={event => {
      const id = crypto.randomUUID();
      captureSend(id, event.currentTarget);
      setMessages(previous => [...previous, id]);
    }}>Send a message</button>
  </>;
}

export default function App() {
  return <DotSendProvider><Conversation /></DotSendProvider>;
}
```

See the [API reference](https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/docs/api.md) for a composer example and all options.

## License

[MIT](https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/LICENSE)
