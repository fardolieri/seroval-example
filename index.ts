import http from 'node:http';
import { crossSerializeStream, getCrossReferenceHeader, createStream, type Stream } from 'seroval';

const PORT = 3000;

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

function pushOverTime<T>(stream: Stream<T>, values: T[], intervalMs: number, finalValue: T) {
  let i = 0;
  const id = setInterval(() => {
    if (i < values.length) {
      stream.next(values[i++]);
    } else {
      clearInterval(id);
      stream.return(finalValue);
    }
  }, intervalMs);
}

function makeShapeA() {
  const activityFeed = createStream<string>();
  pushOverTime(activityFeed, [
    'Logged in from Chrome on macOS',
    'Updated avatar',
    'Changed email to alice@new.dev',
  ], 1200, 'end of activity log');

  return {
    kind: 'user',
    username: 'alice42',
    verified: true,
    joinedAt: new Date('2024-03-15T08:30:00Z'),
    settings: {
      theme: 'dark',
      locale: 'en-US',
      notifications: { email: true, push: false, sms: false },
    },
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
    activityFeed,
  };
}

function makeShapeB() {
  const notifications = createStream<{ level: string; message: string }>();
  pushOverTime(notifications, [
    { level: 'info', message: 'Deploy #487 succeeded' },
    { level: 'warn', message: 'CPU usage above 80%' },
    { level: 'info', message: '3 new sign-ups today' },
    { level: 'error', message: 'Payment webhook timeout' },
  ], 1000, { level: 'info', message: 'No more notifications' });

  return {
    kind: 'dashboard',
    generatedAt: new Date(),
    stats: {
      users: 12847,
      activeToday: 431,
      revenue: 28493.5,
      uptime: 99.97,
    },
    chartData: delay(2000, {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      visits: [1200, 1350, 980, 1500, 1700, 900, 1100],
      conversions: [42, 58, 31, 67, 73, 28, 45],
    }),
    weather: delay(1000, {
      city: 'San Francisco',
      temp: 18,
      unit: 'C',
      condition: 'Partly cloudy',
      forecast: ['Sunny', 'Cloudy', 'Rain'],
    }),
    notifications,
  };
}

function makeShapeC() {
  const trackingUpdates = createStream<{ time: string; status: string }>();
  pushOverTime(trackingUpdates, [
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
      carrier: 'FastShip',
      trackingNumber: 'FS-8842991102',
      estimatedDelivery: '2026-03-09',
      weight: '1.4kg',
    }),
    receipt: delay(1200, {
      subtotal: 210.96,
      tax: 17.38,
      shipping: 5.99,
      total: 234.33,
      currency: 'USD',
    }),
    trackingUpdates,
  };
}

const shapes = [makeShapeA, makeShapeB, makeShapeC];

function handleStreamEndpoint(res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });

  const make = shapes[Math.floor(Math.random() * shapes.length)];
  const data = make();

  res.write(getCrossReferenceHeader() + '\n');

  crossSerializeStream(data, {
    onSerialize(chunk) {
      res.write(chunk + '\n');
    },
    onError(error) {
      console.error('Stream error:', error);
      res.end();
    },
    onDone() {
      res.end();
    },
  });
}

const HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seroval Streaming Demo</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, sans-serif;
    background: #0a0a0a; color: #c8c8c8;
    padding: 2rem;
  }
  h1 { font-size: 1.4rem; color: #fff; margin-bottom: 1rem; }
  p.hint { color: #666; font-size: 0.85rem; margin-bottom: 1rem; }
  button {
    background: #2563eb; color: #fff; border: none;
    padding: 0.5rem 1.2rem; border-radius: 6px;
    font-size: 0.9rem; cursor: pointer;
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
  .pending { color: #555; }
  .str { color: #a5d6a7; }
  .num { color: #90caf9; }
  .bool { color: #ce93d8; }
  .null { color: #666; font-style: italic; }
  .key { color: #e0e0e0; }
  .date { color: #ffcc80; }
  .stream-label { color: #4fc3f7; }
</style>
</head>
<body>
<h1>Seroval Streaming Demo</h1>
<p class="hint">Each request returns a random object shape. Promises resolve over time.</p>
<button id="btn">Fetch /api/test1</button>
<pre id="output"></pre>
<script>
const btn = document.getElementById('btn');
const output = document.getElementById('output');
const subscribedStreams = new WeakSet();
const streamBuffers = new WeakMap();

btn.addEventListener('click', startStream);

async function startStream() {
  btn.disabled = true;
  btn.textContent = 'Streaming...';
  output.innerHTML = '';
  self.$R = undefined;

  const res = await fetch('/api/test1');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try { (0, eval)(line); } catch (e) { console.error('eval error:', e); }
    }
    render();
    await new Promise(r => queueMicrotask(r));
    render();
  }

  btn.disabled = false;
  btn.textContent = 'Fetch again (random shape)';
  render();
}

function render() {
  if (!self.$R || $R[0] === undefined) return;
  output.innerHTML = renderValue($R[0], 0);
}

function renderValue(val, depth) {
  const indent = '  '.repeat(depth);
  const indent1 = '  '.repeat(depth + 1);

  if (val === null) return '<span class="null">null</span>';
  if (val === undefined) return '<span class="null">undefined</span>';

  if (typeof val === 'string') return '<span class="str">' + esc(JSON.stringify(val)) + '</span>';
  if (typeof val === 'number') return '<span class="num">' + val + '</span>';
  if (typeof val === 'boolean') return '<span class="bool">' + val + '</span>';
  if (typeof val === 'bigint') return '<span class="num">' + val + 'n</span>';

  if (val instanceof Date) return '<span class="date">Date(' + esc(val.toISOString()) + ')</span>';
  if (val instanceof RegExp) return '<span class="date">' + esc(String(val)) + '</span>';

  if (val instanceof Promise) {
    if (val.s === 1) return renderValue(val.v, depth);
    return '<span class="pending">&lt;pending...&gt;</span>';
  }

  if (val && val.__SEROVAL_STREAM__) {
    if (!subscribedStreams.has(val)) {
      subscribedStreams.add(val);
      streamBuffers.set(val, { items: [], done: false });
      val.on({
        next(v) { streamBuffers.get(val).items.push(v); render(); },
        throw(v) { streamBuffers.get(val).items.push({ __err__: v }); render(); },
        return(v) { const b = streamBuffers.get(val); b.items.push(v); b.done = true; render(); },
      });
    }
    const buf = streamBuffers.get(val);
    if (!buf || buf.items.length === 0) {
      return '<span class="stream-label">Stream []</span>' +
        (!buf || !buf.done ? ' <span class="pending">(waiting...)</span>' : '');
    }
    let out = '<span class="stream-label">Stream</span> [\\n';
    for (let i = 0; i < buf.items.length; i++) {
      out += indent1 + renderValue(buf.items[i], depth + 1);
      if (i < buf.items.length - 1) out += ',';
      out += '\\n';
    }
    out += indent + ']';
    if (!buf.done) out += ' <span class="pending">(streaming...)</span>';
    return out;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    let out = '[\\n';
    for (let i = 0; i < val.length; i++) {
      out += indent1 + renderValue(val[i], depth + 1);
      if (i < val.length - 1) out += ',';
      out += '\\n';
    }
    out += indent + ']';
    return out;
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    let out = '{\\n';
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      out += indent1 + '<span class="key">' + esc(k) + '</span>: ' + renderValue(val[k], depth + 1);
      if (i < keys.length - 1) out += ',';
      out += '\\n';
    }
    out += indent + '}';
    return out;
  }

  return esc(String(val));
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (url.pathname === '/api/test1') {
    handleStreamEndpoint(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
