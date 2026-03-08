---
name: SolidJS SerovalViewer component
overview: Refactor into idiomatic SolidJS. createSerovalStream returns a single augmented object where Promises and Streams have reactive properties. SerovalViewer renders it.
todos:
  - id: create-composable
    content: Create createSerovalStream.ts composable returning { data, done, start }
    status: pending
  - id: create-viewer
    content: Create SerovalViewer.tsx component that recursively renders the augmented object
    status: pending
  - id: simplify-app
    content: Simplify App.tsx to use the new component and composable
    status: pending
isProject: false
---

# SolidJS SerovalViewer Component

## API

```ts
const { data, done, start } = createSerovalStream('/api/test1');
```

- `**data**` — `Accessor<unknown>`: the deserialized seroval root object, augmented in-place:
  - Promises get signal-backed `.state` (`'pending' | 'resolved' | 'rejected'`), `.value`, and `.error` properties via `Object.defineProperty` getters
  - Streams get signal-backed `.chunks` (array of `.next()` values), `.lastChunk` (most recent `.next()` value or `undefined`), `.done` (`boolean`), and `.error` (value from `.throw()` or `undefined`). The `.return()` value is NOT included in `.chunks` — access via `.on()` if needed.
  - Resolved values are recursively augmented (e.g. a Promise resolving to an object with a Stream inside)
- `**done**` — `Accessor<boolean>`: `true` once the HTTP response stream is fully read
- `**start**` — `() => void`: triggers the fetch, resets state for re-use

## New files

### `client/src/createSerovalStream.ts`

Core logic:

1. `start()` calls `fetch(url)`, reads chunks via `getReader()`, passes each JSON line through `fromCrossJSON(node, { refs })`
2. Once the root object is available (first `fromCrossJSON` call that returns non-undefined), walk it recursively with `augment(value)`:
  - If `value instanceof Promise`: define `.state`, `.value`, `.error` as signal-backed getters. Set up `.then(v => { setState('resolved'); setValue(augment(v)); }, e => { setState('rejected'); setError(e); })`
  - If `value?.__SEROVAL_STREAM__`: define signal-backed getters for `.chunks` (`unknown[]`), `.lastChunk` (`unknown`), `.done` (`boolean`), and `.error` (`unknown`). Set up `.on({ next(v) { const a = augment(v); setChunks(prev => [...prev, a]); setLastChunk(a); }, throw(e) { setError(e); setDone(true); }, return() { setDone(true); } })`
  - If Array or plain Object: recurse into children
  - Primitives, Date, RegExp: no-op
3. Set `data` signal to the augmented root
4. After response ends, set `done` to `true`

### `client/src/SerovalViewer.tsx`

`<SerovalViewer value={data()} />` wraps a `<pre>` and recursively renders:

- `**ValueNode**` component dispatches by type:
  - Primitives → colored `<span>`s
  - Date → `Date(ISO string)`
  - Promise → reads `val.state`: if `'pending'` show `<pending...>`, if `'resolved'` recurse into `val.value`, if `'rejected'` show `<rejected>`
  - Stream → renders `val.chunks` as an array with `<For each={val.chunks}>`, plus `(streaming...)` suffix when `!val.done`
  - Array → `[` + `<For>` + `]`
  - Object → `{` + `<For each={Object.keys(val)}>` + `}`

Since `.state`, `.value`, `.chunks` are signal getters, SolidJS tracks them automatically — only the leaf component that reads a signal re-renders when it changes.

**Note:** To distinguish a pending Promise (`undefined`) from an actual `undefined` value, the viewer checks `val instanceof Promise` and reads `.state` rather than checking for `undefined`.

## Changes to existing files

### `client/src/App.tsx`

```tsx
function App() {
  const { data, done, start } = createSerovalStream('/api/test1');
  return (
    <div class="container">
      <h1>Seroval Streaming Demo</h1>
      <p class="hint">Each request returns a random object. Promises and streams resolve reactively.</p>
      <button onClick={start} disabled={!done()}>
        {done() ? 'Fetch /api/test1' : 'Streaming...'}
      </button>
      <Show when={data()}>
        {val => <SerovalViewer value={val()} />}
      </Show>
    </div>
  );
}
```

### `client/src/index.css`

Keep existing syntax-highlight classes and layout styles. No changes needed.