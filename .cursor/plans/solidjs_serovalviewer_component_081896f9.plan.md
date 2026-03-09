---
name: SolidJS SerovalViewer component
overview: Refactor into idiomatic SolidJS. getSerovalData returns a readonly store shaped like a Promise ({ state, result, error }) where the result is the augmented seroval root. SerovalViewer renders it.
todos:
  - id: create-composable
    content: Create getSerovalData.ts — returns a readonly store, immediately fetches
    status: pending
  - id: create-viewer
    content: Create SerovalViewer.tsx component that recursively renders the augmented object
    status: pending
  - id: simplify-app
    content: Simplify App.tsx to use the new component and helper
    status: pending
isProject: false
---

# SolidJS SerovalViewer Component

## API

```ts
const data = getSerovalData('/api/test1');

data.state   // 'pending' | 'resolved' | 'rejected'
data.result  // the augmented seroval root object (undefined while pending)
data.error   // error value if fetch/network fails (undefined otherwise)
```

- One-shot: calling `getSerovalData(url)` immediately triggers the fetch.
- Returns a **readonly SolidJS store** with `{ state, result, error }`.
- `state` starts as `'pending'`. Once the first seroval root arrives it becomes `'resolved'` and `result` is set. If the fetch itself fails, `state` becomes `'rejected'` and `error` is set.
- `result` is the deserialized seroval root object, augmented **in-place on the real instances**:
  - **Promises remain actual `Promise` instances** (still `.then()`-able / `await`-able). They are extended with signal-backed `.state` (`'pending' | 'resolved' | 'rejected'`), `.result`, and `.error` getters via `Object.defineProperty`.
  - **Streams remain actual seroval Stream instances** (still have `.on()` etc.). They are extended with signal-backed `.chunks`, `.returnChunk`, `.done`, `.error` getters via `Object.defineProperty`.
  - Resolved values are recursively augmented.

## New files

### `client/src/getSerovalData.ts`

Core logic:

1. Create a store: `const [store, setStore] = createStore({ state: 'pending', result: undefined, error: undefined })`
2. Immediately call `fetch(url)`, read chunks via `getReader()`, pass each JSON line through `fromCrossJSON(node, { refs })`
3. Once the root object is available (first `fromCrossJSON` call that returns non-undefined), walk it recursively with `augment(value)`:
  - If `value instanceof Promise`: the actual Promise instance gets `.state`, `.result`, `.error` defined as signal-backed getters via `Object.defineProperty`. Set up `.then(v => { setState('resolved'); setResult(augment(v)); }, e => { setState('rejected'); setError(e); })`. The Promise itself is still thenable/awaitable.
  - If `value?.__SEROVAL_STREAM__`: the actual Stream instance gets `.chunks`, `.returnChunk`, `.done`, `.error` defined as signal-backed getters via `Object.defineProperty`. Set up `.on({ next(v) { pushChunk(augment(v)); }, throw(e) { setError(e); setDone(true); }, return(v) { setReturnChunk(augment(v)); setDone(true); } })`. The Stream itself still has its original `.on()` etc.
  - If Array or plain Object: recurse into children
  - Primitives, Date, RegExp: no-op
4. Set `setStore({ state: 'resolved', result: augmentedRoot })`
5. If `fetch` throws or the stream errors, set `setStore({ state: 'rejected', error: e })`
6. Return the store (readonly — the setter stays internal)

### `client/src/SerovalViewer.tsx`

`<SerovalViewer value={data.result} />` wraps a `<pre>` and recursively renders:

- `**ValueNode`** component dispatches by type:
  - Primitives -> colored `<span>`s
  - Date -> `Date(ISO string)`
  - Promise -> reads `val.state`: if `'pending'` show `<pending...>`, if `'resolved'` recurse into `val.result`, if `'rejected'` show `<rejected>`
  - Stream -> renders `val.chunks` as an array with `<For each={val.chunks}>`, plus `(streaming...)` suffix when `!val.done`
  - Array -> `[` + `<For>` + `]`
  - Object -> `{` + `<For each={Object.keys(val)}>` + `}`

Since `.state`, `.result`, `.chunks` are signal getters, SolidJS tracks them automatically — only the leaf component that reads a signal re-renders when it changes.

**Note:** To distinguish a pending Promise (`undefined`) from an actual `undefined` value, the viewer checks `val instanceof Promise` and reads `.state` rather than checking for `undefined`.

## Changes to existing files

### `client/src/App.tsx`

```tsx
import { getSerovalData } from './getSerovalData';
import { SerovalViewer } from './SerovalViewer';

function App() {
  const data = getSerovalData('/api/test1');
  return (
    <div class="container">
      <h1>Seroval Streaming Demo</h1>
      <p class="hint">Each request returns a random object. Promises and streams resolve reactively.</p>
      <SerovalViewer value={data} />
    </div>
  );
}

export default App;
```

### `client/src/index.css`

Keep existing syntax-highlight classes and layout styles. No changes needed.