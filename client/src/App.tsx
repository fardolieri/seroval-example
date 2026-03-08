import { createSignal } from 'solid-js';
import { fromCrossJSON } from 'seroval';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function App() {
  const [html, setHtml] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  async function startStream() {
    setLoading(true);
    setHtml('');

    const refs = new Map();
    const streams = new WeakMap<object, { items: unknown[]; done: boolean }>();
    const promises = new WeakMap<object, unknown>();
    let root: Record<string, unknown> | null = null;

    const rerender = () => {
      if (root) setHtml(pretty(root, 0));
    };

    function pretty(val: unknown, d: number): string {
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

      if (val && typeof val === 'object' && '__SEROVAL_STREAM__' in val) {
        const stream = val as { __SEROVAL_STREAM__: true; on: (l: Record<string, (v: unknown) => void>) => void };
        if (!streams.has(stream)) {
          streams.set(stream, { items: [], done: false });
          stream.on({
            next(v: unknown) { streams.get(stream)!.items.push(v); rerender(); },
            throw(v: unknown) { streams.get(stream)!.items.push(v); rerender(); },
            return(v: unknown) { const b = streams.get(stream)!; b.items.push(v); b.done = true; rerender(); },
          });
        }
        const buf = streams.get(stream)!;
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
        return '{\n' + keys.map(k =>
          i1 + '<span class=k>' + esc(k) + '</span>: ' + pretty((val as Record<string, unknown>)[k], d + 1)
        ).join(',\n') + '\n' + i0 + '}';
      }

      return esc(String(val));
    }

    function list(arr: unknown[], d: number) {
      const i1 = '  '.repeat(d + 1);
      const i0 = '  '.repeat(d);
      return '[\n' + arr.map(v => i1 + pretty(v, d + 1)).join(',\n') + '\n' + i0 + ']';
    }

    const res = await fetch('/api/test1');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        const result = fromCrossJSON(JSON.parse(line), { refs });
        if (root === null && result !== undefined) root = result as Record<string, unknown>;
      }
      await new Promise<void>(r => queueMicrotask(r));
      rerender();
    }

    setLoading(false);
    rerender();
  }

  return (
    <div class="container">
      <h1>Seroval Streaming Demo</h1>
      <p class="hint">Each request returns a random object shape. No eval — deserialized with seroval's fromCrossJSON.</p>
      <button onClick={startStream} disabled={loading()}>
        {loading() ? 'Streaming...' : 'Fetch /api/test1'}
      </button>
      <pre id="output" innerHTML={html()} />
    </div>
  );
}

export default App;
