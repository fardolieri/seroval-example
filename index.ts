import http from 'node:http';
import fs from 'node:fs';
import { toCrossJSONStream, createStream, type Stream } from 'seroval';

const PORT = 3000;

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise(r => setTimeout(() => r(value), ms));
}

function drip<T>(stream: Stream<T>, items: T[], ms: number, last: T) {
  let i = 0;
  const id = setInterval(() => {
    if (i < items.length) {
      stream.next(items[i++]!);
    }
    else {
      clearInterval(id);
      stream.return(last);
    }
  }, ms);
}

// ── Three random data shapes ──────────────────────────────────────────

function makeUser() {
  const feed = createStream<string>();
  drip(feed, [
    'Logged in from Chrome on macOS',
    'Updated avatar',
    'Changed email to alice@new.dev',
  ], 1200, 'end of activity log');

  return {
    kind: 'user',
    username: 'alice42',
    verified: true,
    joinedAt: new Date('2024-03-15T08:30:00Z'),
    settings: { theme: 'dark', locale: 'en-US', notifications: { email: true, push: false, sms: false } },
    profile: delay(1500, {
      displayName: 'Alice Nakamura',
      bio: 'Software engineer & open-source enthusiast',
      location: 'Tokyo, Japan',
      links: ['https://alice.dev', 'https://github.com/alice42'],
    }),
    recentPosts: delay(3000, [
      { id: 1, title: 'Getting started with seroval', likes: 42 },
      { id: 2, title: 'Streaming data patterns', likes: 17 },
      { id: 3, title: 'Why I moved to Bun', likes: 89 },
    ]),
    activityFeed: feed,
  };
}

function makeDashboard() {
  const notifs = createStream<{ level: string; message: string }>();
  drip(notifs, [
    { level: 'info', message: 'Deploy #487 succeeded' },
    { level: 'warn', message: 'CPU usage above 80%' },
    { level: 'info', message: '3 new sign-ups today' },
    { level: 'error', message: 'Payment webhook timeout' },
  ], 1000, { level: 'info', message: 'No more notifications' });

  return {
    kind: 'dashboard',
    generatedAt: new Date(),
    stats: { users: 12847, activeToday: 431, revenue: 28493.5, uptime: 99.97 },
    chartData: delay(2000, {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      visits: [1200, 1350, 980, 1500, 1700, 900, 1100],
      conversions: [42, 58, 31, 67, 73, 28, 45],
    }),
    weather: delay(1000, {
      city: 'San Francisco', temp: 18, unit: 'C',
      condition: 'Partly cloudy', forecast: ['Sunny', 'Cloudy', 'Rain'],
    }),
    notifications: notifs,
  };
}

function makeOrder() {
  const tracking = createStream<{ time: string; status: string }>();
  drip(tracking, [
    { time: '09:00', status: 'Package picked up from warehouse' },
    { time: '11:30', status: 'In transit — sorting facility' },
    { time: '14:15', status: 'Out for delivery' },
  ], 1500, { time: '16:42', status: 'Delivered' });

  return {
    kind: 'order',
    orderId: 'ORD-2026-7X9K2',
    placedAt: new Date('2026-03-07T22:14:00Z'),
    items: [
      { sku: 'MECH-KB-01', name: 'Mechanical Keyboard', qty: 1, price: 149.99 },
      { sku: 'USB-C-CBL', name: 'USB-C Cable 2m', qty: 2, price: 12.99 },
      { sku: 'MPAD-XL', name: 'Desk Mat XL', qty: 1, price: 34.99 },
    ],
    shippingStatus: delay(2500, {
      carrier: 'FastShip', trackingNumber: 'FS-8842991102',
      estimatedDelivery: '2026-03-09', weight: '1.4kg',
    }),
    receipt: delay(1200, { subtotal: 210.96, tax: 17.38, shipping: 5.99, total: 234.33, currency: 'USD' }),
    trackingUpdates: tracking,
  };
}

const shapes = [makeUser, makeDashboard, makeOrder];

// ── Streaming endpoint ────────────────────────────────────────────────

function handleStream(res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });

  const data = shapes[Math.floor(Math.random() * shapes.length)]!();

  toCrossJSONStream(data, {
    onParse(node) {
      res.write(JSON.stringify(node) + '\n');
    },
    onError(err) {
      console.error('Stream error:', err);
      res.end();
    },
    onDone() {
      res.end();
    },
  });
}

// ── HTML client ───────────────────────────────────────────────────────

const HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seroval Streaming Demo</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #c8c8c8; padding: 2rem; }
  h1 { font-size: 1.4rem; color: #fff; margin-bottom: 1rem; }
  p.hint { color: #666; font-size: 0.85rem; margin-bottom: 1rem; }
  button {
    background: #2563eb; color: #fff; border: none;
    padding: 0.5rem 1.2rem; border-radius: 6px; font-size: 0.9rem; cursor: pointer;
  }
  button:hover { background: #1d4ed8; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  pre#output {
    background: #111; border: 1px solid #222; border-radius: 8px;
    padding: 1.2rem; margin-top: 1rem;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.82rem; line-height: 1.5;
    min-height: 3rem; white-space: pre-wrap; word-break: break-word;
    overflow-y: auto; max-height: 80vh;
  }
  .p { color: #555; } .s { color: #a5d6a7; } .n { color: #90caf9; }
  .b { color: #ce93d8; } .x { color: #666; font-style: italic; }
  .k { color: #e0e0e0; } .d { color: #ffcc80; } .t { color: #4fc3f7; }
</style>
</head>
<body>
<h1>Seroval Streaming Demo</h1>
<p class="hint">Each request returns a random object shape. No eval — deserialized with seroval's fromCrossJSON.</p>
<button id="btn">Fetch /api/test1</button>
<pre id="output"></pre>
<script type="module">
import { fromCrossJSON } from '/vendor/seroval.mjs';

const btn = document.getElementById('btn');
const output = document.getElementById('output');

btn.addEventListener('click', startStream);

async function startStream() {
  btn.disabled = true;
  btn.textContent = 'Streaming...';
  output.innerHTML = '';

  const refs = new Map();
  const streams = new WeakMap();
  const promises = new WeakMap();
  let root = null;

  const rerender = () => { if (root) output.innerHTML = pretty(root, 0); };

  function pretty(val, d) {
    if (val === null) return '<span class=x>null</span>';
    if (val === undefined) return '<span class=x>undefined</span>';
    if (typeof val === 'string') return '<span class=s>' + esc(JSON.stringify(val)) + '</span>';
    if (typeof val === 'number') return '<span class=n>' + val + '</span>';
    if (typeof val === 'boolean') return '<span class=b>' + val + '</span>';
    if (typeof val === 'bigint') return '<span class=n>' + val + 'n</span>';
    if (val instanceof Date) return '<span class=d>Date(' + esc(val.toISOString()) + ')</span>';
    if (val instanceof RegExp) return '<span class=d>' + esc(String(val)) + '</span>';

    if (val instanceof Promise) {
      if (!promises.has(val)) {
        promises.set(val, undefined);
        val.then(v => { promises.set(val, v); rerender(); });
      }
      const resolved = promises.get(val);
      return resolved !== undefined ? pretty(resolved, d) : '<span class=p>&lt;pending...&gt;</span>';
    }

    if (val?.__SEROVAL_STREAM__) {
      if (!streams.has(val)) {
        streams.set(val, { items: [], done: false });
        val.on({
          next(v) { streams.get(val).items.push(v); rerender(); },
          throw(v) { streams.get(val).items.push(v); rerender(); },
          return(v) { const b = streams.get(val); b.items.push(v); b.done = true; rerender(); },
        });
      }
      const buf = streams.get(val);
      const suffix = buf.done ? '' : ' <span class=p>(streaming...)</span>';
      return buf.items.length === 0
        ? '<span class=t>Stream</span> []' + suffix
        : '<span class=t>Stream</span> ' + list(buf.items, d) + suffix;
    }

    if (Array.isArray(val)) return val.length === 0 ? '[]' : list(val, d);

    if (typeof val === 'object') {
      const keys = Object.keys(val);
      if (keys.length === 0) return '{}';
      const i1 = '  '.repeat(d + 1);
      const i0 = '  '.repeat(d);
      return '{\\n' + keys.map((k, idx) =>
        i1 + '<span class=k>' + esc(k) + '</span>: ' + pretty(val[k], d + 1)
      ).join(',\\n') + '\\n' + i0 + '}';
    }

    return esc(String(val));
  }

  function list(arr, d) {
    const i1 = '  '.repeat(d + 1);
    const i0 = '  '.repeat(d);
    return '[\\n' + arr.map(v => i1 + pretty(v, d + 1)).join(',\\n') + '\\n' + i0 + ']';
  }

  const res = await fetch('/api/test1');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const result = fromCrossJSON(JSON.parse(line), { refs });
      if (root === null && result !== undefined) root = result;
    }
    rerender();
    await new Promise(r => queueMicrotask(r));
    rerender();
  }

  btn.disabled = false;
  btn.textContent = 'Fetch again (random shape)';
  rerender();
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
</script>
</body>
</html>`;

// ── Server ────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (pathname === '/api/test1') return handleStream(res);

  if (pathname === '/vendor/seroval.mjs') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    const serovalBundle = fs.readFileSync(
      import.meta.dirname + '/node_modules/seroval/dist/esm/production/index.mjs',
      'utf-8',
    )
    return res.end(serovalBundle);
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(HTML);
});

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
