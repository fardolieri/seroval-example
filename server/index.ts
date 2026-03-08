import http from 'node:http';
import { toCrossJSONStream, createStream, type Stream } from 'seroval';

const PORT = 3000;

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise(r => setTimeout(() => r(value), ms));
}

function drip<T>(stream: Stream<T>, items: T[], ms: number, last: T) {
  let i = 0;
  const id = setInterval(() => {
    if (i < items.length) stream.next(items[i++]!);
    else { clearInterval(id); stream.return(last); }
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
    onParse(node) { res.write(JSON.stringify(node) + '\n'); },
    onError(err) { console.error('Stream error:', err); res.end(); },
    onDone() { res.end(); },
  });
}

// ── Server ────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (pathname === '/api/test1') return handleStream(res);

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => console.log(`API server: http://localhost:${PORT}`));
