---
name: SolidJS SerovalViewer component
overview: Refactor into idiomatic SolidJS. getSerovalData returns an actual augmented Promise with reactive .state/.result/.error. SerovalViewer recursively renders any value including augmented Promises and Streams.
todos:
  - id: create-composable
    content: Create getSerovalData.ts — returns an augmented Promise, immediately fetches
    status: completed
  - id: create-viewer
    content: Create SerovalViewer.tsx component that recursively renders the augmented object
    status: completed
  - id: simplify-app
    content: Simplify App.tsx to use the new component and helper
    status: completed
isProject: false
---

# SolidJS SerovalViewer Component

## API

```ts
const data = getSerovalData('/api/test1');

// data is a real Promise, augmented with signal-backed getters:
data.state   // 'pending' | 'resolved' | 'rejected'  (reactive)
data.result  // the augmented seroval root object once resolved (reactive)
data.error   // error value if fetch fails (reactive)

// still a real Promise:
data instanceof Promise  // true
await data               // works
data.then(root => ...)   // works
```

- One-shot: calling `getSerovalData(url)` immediately triggers the fetch and returns the augmented Promise.
- The returned Promise is the same object type as any inner augmented Promise — consistent at every level.
- `result` is the deserialized seroval root object, augmented **in-place on the real instances**:
  - **Promises remain actual `Promise` instances** (still `.then()`-able / `await`-able). Extended with signal-backed `.state`, `.result`, `.error` getters via `Object.defineProperty`.
  - **Streams remain actual seroval Stream instances** (still have `.on()` etc.). Extended with signal-backed `.chunks`, `.returnChunk`, `.done`, `.error` getters via `Object.defineProperty`.
  - Resolved values are recursively augmented.

## New files

### `client/src/getSerovalData.ts`

Exports: `getSerovalData(url: string): AugmentedPromise`

`augment(value)` — recursive function that adds reactive getters to Promises and Streams:

- If `value instanceof Promise`: define `.state`, `.result`, `.error` as signal-backed getters via `Object.defineProperty`. Attach `.then(v => { setState('resolved'); setResult(augment(v)); }, e => { setState('rejected'); setError(e); })`.
- If `value?.__SEROVAL_STREAM__`: define `.chunks`, `.returnChunk`, `.done`, `.error` as signal-backed getters. Attach `.on({ next(v) { pushChunk(augment(v)); }, throw(e) { setError(e); setDone(true); }, return(v) { setReturnChunk(augment(v)); setDone(true); } })`.
- If Array or plain Object: recurse into children.
- Primitives, Date, RegExp: no-op.

`getSerovalData(url)` — creates the fetch Promise and augments it:

1. Create `const rootPromise = new Promise((resolve, reject) => { ... })` where the executor kicks off the streaming fetch logic.
2. Inside the executor: `fetch(url)`, read chunks via `getReader()`, pass each JSON line through `fromCrossJSON(node, { refs })`. Once the root object is available, `augment(root)` recursively, then `resolve(root)`.
3. If anything fails, `reject(error)`.
4. Call `augment(rootPromise)` to add signal-backed `.state`, `.result`, `.error` to it.
5. Return `rootPromise`.

The root Promise resolves to the augmented seroval root. Its `.state` starts as `'pending'`, the viewer shows `<pending...>`. Once the first seroval line arrives and the root is built, `.state` flips to `'resolved'` and `.result` becomes the augmented root object — the viewer recurses into it.

### `client/src/SerovalViewer.tsx`

`<SerovalViewer value={data} />` wraps a `<pre>` and recursively renders via a `ValueNode` component:

- **Primitives** -> colored `<span>`s (`null`, `undefined`, booleans, numbers, strings)
- **Date** -> `Date(ISO string)`
- **Promise** (`val instanceof Promise`) -> reads `val.state`:
  - `'pending'` -> show `<pending...>`
  - `'resolved'` -> recurse into `val.result`
  - `'rejected'` -> show `<rejected: val.error>`
- **Stream** (`val?.__SEROVAL_STREAM__`) -> renders `val.chunks` as an array with `<For>`, plus `(streaming...)` suffix when `!val.done`
- **Array** -> `[` + `<For>` + `]`
- **Object** -> `{` + `<For each={Object.keys(val)}>` + `}`

Since `.state`, `.result`, `.chunks` etc. are signal getters, SolidJS tracks them automatically — only the leaf component that reads a signal re-renders when it changes.

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