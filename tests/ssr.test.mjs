import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { DotSendBubble, DotSendProvider, DotSendTranscript } from '../dist/index.js';

test('server rendering preserves transcript content and pending delivery state without browser globals', () => {
  const html = renderToString(
    h(
      DotSendProvider,
      null,
      h(
        DotSendTranscript,
        { 'aria-label': 'Conversation' },
        h(
          DotSendBubble,
          { id: 'sent', receipt: 'Delivered', receiptState: 'pending' },
          'Hello <Dot>',
        ),
      ),
    ),
  );
  assert.match(html, /role="log" aria-label="Conversation"/);
  assert.match(html, /Hello &lt;Dot&gt;/);
  assert.match(html, /role="status" aria-hidden="true"/);
  assert.doesNotMatch(html, /data-dot-sending|dot-send-background/);
});

test('received messages do not render a delivery receipt', () => {
  const html = renderToString(
    h(
      DotSendProvider,
      null,
      h(DotSendBubble, { id: 'received', side: 'received', receipt: 'Delivered' }, 'Hello'),
    ),
  );
  assert.match(html, /data-side="received"/);
  assert.doesNotMatch(html, /role="status"|Delivered/);
});
