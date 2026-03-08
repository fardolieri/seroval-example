import http from 'node:http';
import { crossSerializeStream, getCrossReferenceHeader, createStream } from 'seroval';

const PORT = 3000;

function handleStreamEndpoint(res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });

  const feed = createStream<string>();

  const data = {
    title: 'Seroval Streaming Demo',
    timestamp: new Date(),
    profile: new Promise(resolve =>
      setTimeout(() => resolve({ name: 'Alice', bio: 'Likes streams' }), 1000),
    ),
    posts: new Promise(resolve =>
      setTimeout(() => resolve(['First post', 'Second post', 'Third post']), 3000),
    ),
    feed,
  };

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

  let count = 0;
  const interval = setInterval(() => {
    count++;
    feed.next(`Live message #${count}`);
    if (count >= 3) {
      clearInterval(interval);
      feed.return(`Stream complete (${count} messages)`);
    }
  }, 1500);
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
    font-family: system-ui, -apple-system, sans-serif;
    background: #0a0a0a; color: #e0e0e0;
    padding: 2rem; line-height: 1.6;
  }
  h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #fff; }
  button {
    background: #2563eb; color: #fff; border: none;
    padding: 0.6rem 1.4rem; border-radius: 6px;
    font-size: 0.95rem; cursor: pointer; transition: background 0.15s;
  }
  button:hover { background: #1d4ed8; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  #output { margin-top: 1.5rem; }
  .field {
    background: #161616; border: 1px solid #2a2a2a;
    border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem;
  }
  .label {
    font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 0.08em; color: #888; margin-bottom: 0.3rem;
  }
  .value {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.9rem; white-space: pre-wrap; word-break: break-word;
  }
  .pending { color: #666; font-style: italic; }
  .resolved { color: #4ade80; }
  .feed-msg { color: #60a5fa; display: block; }
  .feed-done { color: #facc15; display: block; }
  .chunk-log { margin-top: 1.5rem; }
  .chunk-log summary { cursor: pointer; color: #888; font-size: 0.85rem; }
  .chunk-log pre {
    background: #111; border: 1px solid #222; border-radius: 6px;
    padding: 1rem; margin-top: 0.5rem; font-size: 0.78rem; color: #aaa;
    max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;
  }
</style>
</head>
<body>
<h1>Seroval Streaming Demo</h1>
<button id="btn">Fetch /api/test1</button>
<div id="output"></div>
<details class="chunk-log">
  <summary>Raw chunks received from server</summary>
  <pre id="chunks"></pre>
</details>
<script>
const btn = document.getElementById('btn');
const output = document.getElementById('output');
const chunksEl = document.getElementById('chunks');

const state = {
  title: null,
  timestamp: null,
  profile: null,
  posts: null,
  feedMessages: [],
  done: false,
};

btn.addEventListener('click', startStream);

async function startStream() {
  btn.disabled = true;
  btn.textContent = 'Streaming...';
  output.innerHTML = '';
  chunksEl.textContent = '';
  Object.assign(state, { title: null, timestamp: null, profile: null, posts: null, feedMessages: [], done: false });
  self.$R = undefined;

  const res = await fetch('/api/test1');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let listenersReady = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      chunksEl.textContent += line + '\\n\\n';
      try { (0, eval)(line); } catch (e) { console.error('Eval error:', e); }

      if (!listenersReady) {
        const root = findRoot();
        if (root) {
          listenersReady = true;
          state.title = root.title;
          state.timestamp = root.timestamp;

          root.profile.then(v => { state.profile = v; renderDOM(); });
          root.posts.then(v => { state.posts = v; renderDOM(); });

          if (root.feed && root.feed.__SEROVAL_STREAM__) {
            root.feed.on({
              next(v) { state.feedMessages.push({ type: 'msg', text: v }); renderDOM(); },
              throw(v) { state.feedMessages.push({ type: 'err', text: String(v) }); renderDOM(); },
              return(v) { state.feedMessages.push({ type: 'done', text: v }); renderDOM(); },
            });
          }
          renderDOM();
        }
      }
    }

    await new Promise(r => queueMicrotask(r));
    renderDOM();
  }

  state.done = true;
  btn.disabled = false;
  btn.textContent = 'Fetch again';
  renderDOM();
}

function findRoot() {
  if (!self.$R) return null;
  for (const v of Object.values($R)) {
    if (v && typeof v === 'object' && 'title' in v) return v;
  }
  return null;
}

function renderDOM() {
  let html = '';

  html += makeField('Title', state.title ?? '<span class="pending">waiting...</span>');
  html += makeField('Timestamp',
    state.timestamp instanceof Date ? state.timestamp.toISOString() : '<span class="pending">waiting...</span>'
  );
  html += makeField('Profile',
    state.profile
      ? '<span class="resolved">' + esc(JSON.stringify(state.profile, null, 2)) + '</span>'
      : '<span class="pending">pending...</span>'
  );
  html += makeField('Posts',
    state.posts
      ? '<span class="resolved">' + esc(JSON.stringify(state.posts, null, 2)) + '</span>'
      : '<span class="pending">pending...</span>'
  );

  let feedHtml = '';
  if (state.feedMessages.length === 0) {
    feedHtml = '<span class="pending">waiting for messages...</span>';
  } else {
    for (const m of state.feedMessages) {
      if (m.type === 'done') feedHtml += '<span class="feed-done">' + esc(m.text) + '</span>';
      else feedHtml += '<span class="feed-msg">' + esc(m.text) + '</span>';
    }
  }
  html += makeField('Feed', feedHtml);

  if (state.done) {
    html += '<div style="margin-top:0.5rem;color:#888;font-size:0.85rem">Stream ended.</div>';
  }

  output.innerHTML = html;
}

function makeField(label, value) {
  return '<div class="field"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
