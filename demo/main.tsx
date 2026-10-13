import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DotSendProvider, DotSendBubble, DotSendTranscript, useDotSend } from '../src/index';
import '../src/styles.css';
import './style.css';

function Conversation({
  slow,
  onSlowChange,
}: {
  slow: boolean;
  onSlowChange: (value: boolean) => void;
}) {
  const { captureSend } = useDotSend();
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [messages, setMessages] = useState<{ id: string; text: string; delivered: boolean }[]>([]);
  const serial = useRef(0);
  const composer = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  function clearTimers() {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }
  useEffect(() => () => clearTimers(), []);
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const resize = () => {
      const scrollTop = element.scrollTop;
      element.style.height = 'auto';
      const height = element.scrollHeight;
      // Dot keeps the expanded layout until the draft is cleared.
      if (!composing) {
        if (!draft) setExpanded(false);
        else if (!expanded && (draft.includes('\n') || height > 24)) setExpanded(true);
      }
      element.style.height = `${expanded ? height : 24}px`;
      element.scrollTop = scrollTop;
    };
    resize();
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [draft, expanded, composing]);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  function send() {
    if (!draft.trim()) return;
    const id = `message-${++serial.current}`;
    captureSend(id, composer.current);
    setMessages((previous) => [...previous, { id, text: draft, delivered: false }]);
    setDraft('');
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setMessages((previous) =>
        previous.map((message) => (message.id === id ? { ...message, delivered: true } : message)),
      );
    }, 350);
    timers.current.add(timer);
  }

  return (
    <>
      <header className="chat-header">
        <h1>
          <span className="dot" aria-hidden="true" />
          Dot send motion
        </h1>
        <button
          className="clear"
          type="button"
          disabled={!messages.length}
          onClick={() => {
            clearTimers();
            setMessages([]);
          }}
        >
          Clear
        </button>
      </header>
      <DotSendTranscript viewportRef={viewport} className="transcript" aria-label="Messages">
        <DotSendBubble id="welcome" side="received">
          Send a message. Watch it settle.
        </DotSendBubble>
        {messages.map((message, index) => (
          <DotSendBubble
            key={message.id}
            id={message.id}
            groupedNext={index < messages.length - 1}
            receipt="Delivered"
            receiptState={message.delivered ? 'delivered' : 'pending'}
          >
            {message.text}
          </DotSendBubble>
        ))}
      </DotSendTranscript>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div
          ref={composer}
          className="composer"
          data-expanded={expanded || undefined}
          onClick={(event) => {
            if (event.target === event.currentTarget) input.current?.focus();
          }}
        >
          <textarea
            ref={input}
            aria-label="Message"
            placeholder="Send a message"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" aria-label="Send message" disabled={!draft.trim()}>
            ↑
          </button>
        </div>
      </form>
      <footer className="chat-footer">
        <label>
          <input
            type="checkbox"
            checked={slow}
            onChange={(event) => onSlowChange(event.target.checked)}
          />
          Slow motion
        </label>
      </footer>
    </>
  );
}

function App() {
  const [slow, setSlow] = useState(false);
  return (
    <main className="chat">
      <DotSendProvider
        accent="blue"
        options={slow ? { durationMs: 2400, receiptDelayMs: 800 } : undefined}
      >
        <Conversation slow={slow} onSlowChange={setSlow} />
      </DotSendProvider>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
