<h1 align="center">Codex Dot Send Motion</h1>

<p align="center">React 消息发送动效组件，inspired by <a href="https://openai.com/index/introducing-dots/">Codex Dot</a>.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codex-dot-send-motion"><img src="https://img.shields.io/npm/v/codex-dot-send-motion?style=flat" alt="npm version"></a>
  <img src="https://img.shields.io/badge/React-19-20232A?style=flat&amp;logo=react&amp;logoColor=61DAFB" alt="React 19">
  <a href="https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/codex-dot-send-motion?style=flat" alt="MIT License"></a>
</p>

<p align="center">
  <a href="https://wcqqq1214.github.io/codex-dot-send-motion/">在线演示</a> ·
  <a href="https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/docs/api.md">API</a> ·
  <a href="https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/README.md">English</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/wcqqq1214/codex-dot-send-motion/main/docs/assets/preview.gif" width="520" alt="消息发送动效演示">
</p>

## 安装

```sh
npm install codex-dot-send-motion
```

> [!NOTE]
> 需要 React 19、React DOM 19 和 ESM；遵循 `prefers-reduced-motion` 系统设置。

<details>
<summary>使用编程 Agent？</summary>

```text
按照以下文档，在当前应用中安装并接入 codex-dot-send-motion：
https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/docs/api.md
验证类型、构建、发送动效和减少动态效果设置。
```

</details>

## 使用

点击按钮，从按钮位置发送一条消息。请在更新消息列表前调用 `captureSend`。

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

输入框接入示例和全部选项见 [API 文档](https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/docs/api.md)。

## 许可证

[MIT](https://github.com/wcqqq1214/codex-dot-send-motion/blob/main/LICENSE)
