import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

// Run through npm's JS entry point so Windows does not need a shell for npm.cmd.
function npm(args, cwd) {
  assert.ok(process.env.npm_execpath, 'Run this test with npm run test:package');
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 180_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function node(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 60_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
}

test(
  'a fresh tarball builds itself and works as an installed React, TypeScript and CSS dependency',
  { timeout: 300_000 },
  () => {
    const consumer = mkdtempSync(path.join(tmpdir(), 'dot-send-consumer-'));
    try {
      // Catch exports that only work because a developer has stale build output.
      rmSync(path.join(root, 'dist'), { recursive: true, force: true });
      npm(['pack', '--pack-destination', consumer], root);
      const archive = path.join(consumer, `${manifest.name}-${manifest.version}.tgz`);
      writeFileSync(
        path.join(consumer, 'package.json'),
        JSON.stringify({
          name: 'dot-send-package-consumer',
          version: '0.0.0',
          private: true,
          type: 'module',
        }),
      );
      const dependencies = [
        'react',
        'react-dom',
        '@types/react',
        '@types/react-dom',
        'typescript',
        'vite',
      ].map((name) => `${name}@${manifest.devDependencies[name]}`);
      npm(
        [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--save-exact',
          archive,
          ...dependencies,
        ],
        consumer,
      );
      const installed = path.join(consumer, 'node_modules', manifest.name);
      const installedManifest = JSON.parse(
        readFileSync(path.join(installed, 'package.json'), 'utf8'),
      );
      assert.equal(installedManifest.license, 'MIT');
      assert.match(readFileSync(path.join(installed, 'LICENSE'), 'utf8'), /MIT License/);
      assert.ok(readFileSync(path.join(installed, 'THIRD_PARTY_NOTICES.md'), 'utf8').length > 0);
      assert.ok(
        readFileSync(path.join(installed, 'docs/api.md'), 'utf8').length > 0,
      );
      const packageFiles = readdirSync(installed, { recursive: true }).map((file) =>
        String(file).replaceAll('\\', '/'),
      );
      assert.ok(
        !packageFiles.some((file) => /(^|\/)(tests|tools|demo)(\/|$)/.test(file)),
        'Packaged files must exclude tests and demo files',
      );
      writeFileSync(
        path.join(consumer, 'smoke.mjs'),
        `
      import assert from 'node:assert/strict';
      import { readFileSync } from 'node:fs';
      import { createElement as h } from 'react';
      import { renderToString } from 'react-dom/server';
      import { DotSendProvider, DotSendTranscript, DotSendBubble, useDotSend } from '${manifest.name}';
      assert.equal(typeof useDotSend, 'function');
      const html = renderToString(h(DotSendProvider, null, h(DotSendTranscript, null,
        h(DotSendBubble, { id: 'package-check' }, 'Package works'))));
      assert.match(html, /Package works/);
      assert.match(readFileSync(new URL(import.meta.resolve('${manifest.name}/styles.css')), 'utf8'), /dot-send/);
    `,
      );
      node(['smoke.mjs'], consumer);
      writeFileSync(
        path.join(consumer, 'index.html'),
        '<div id="root"></div><script type="module" src="/main.tsx"></script>',
      );
      writeFileSync(
        path.join(consumer, 'main.tsx'),
        `
      import { createRoot } from 'react-dom/client';
      import { DotSendProvider, DotSendTranscript, DotSendBubble, useDotSend } from '${manifest.name}';
      import type { DotSendOptions, DotSendAccent } from '${manifest.name}';
      import '${manifest.name}/styles.css';
      const options: DotSendOptions = { durationMs: 600 };
      const accent: DotSendAccent = 'cyan';
      function Composer() { const { captureSend } = useDotSend(); return <button onClick={event => captureSend('next', event.currentTarget)}>Send</button>; }
      createRoot(document.getElementById('root')!).render(<DotSendProvider options={options} accent={accent}>
        <DotSendTranscript><DotSendBubble id="package-check">Package works</DotSendBubble></DotSendTranscript><Composer />
      </DotSendProvider>);
    `,
      );
      writeFileSync(
        path.join(consumer, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            jsx: 'react-jsx',
            lib: ['ES2022', 'DOM'],
          },
          include: ['main.tsx'],
        }),
      );
      node(['node_modules/typescript/bin/tsc', '--noEmit'], consumer);
      node(['node_modules/vite/bin/vite.js', 'build'], consumer);
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  },
);
