---
name: Random streaming objects
overview: Rewrite index.ts so the server randomly picks one of three complex objects to stream, and the client renders the received object in a simple JSON-like code block that progressively fills in as data arrives (loading indicators for pending promises, accumulated values for streams).
todos:
  - id: rewrite-index
    content: Rewrite index.ts with random shape selection, three data generators, and generic recursive client renderer
    status: pending
isProject: false
---

# Random Streaming Objects Demo

## Server: three random data shapes

The `/api/test1` handler randomly picks one of three objects before streaming. Each has a different structure with a mix of sync values, Promises, and `createStream` instances so the client can't predict the shape:

- **Shape A** — a "user" object with nested profile (Promise), settings (sync), activity feed (stream)
- **Shape B** — a "dashboard" object with stats (sync), chart data (Promise), notifications (stream), weather (Promise)
- **Shape C** — an "order" object with items (sync), shipping status (Promise), tracking updates (stream), receipt (Promise)

Each has different property names, nesting depth, and timing of async resolutions.

## Client: generic recursive renderer

Replace the current field-based UI with a single `<pre><code>` block. A recursive `renderValue(value, indent)` function walks `$R[0]` and produces JSON-like output:

- **Primitives** (string, number, boolean, null, undefined, bigint): render as JSON would
- **Date**: render as ISO string
- **RegExp**: render as toString
- **Array**: render as `[...]` with recursive children
- **Object**: render as `{...}` with recursive key/value pairs
- **Promise**: check `value.s === 1` (seroval sets this on resolution) — if resolved, render `value.v` recursively; otherwise render a dim `<pending...>` placeholder
- **Stream** (`value.__SEROVAL_STREAM__`): attach `.on()` listener once to accumulate values into a side array, render those accumulated values as an array-like list

After each chunk eval, call `render()` which walks `$R[0]` and writes the output into the `<code>` element. Also yield a microtask so Promise `.then()` handlers fire, then re-render.

## Changes

All in [index.ts](index.ts):

- **Server side**: replace `handleStreamEndpoint` with a function that picks a random shape, constructs it, and streams via `crossSerializeStream`
- **Client HTML**: strip down to just a button + `<pre><code id="output">` block. Minimal dark-theme styling. The `<code>` block starts empty.
- **Client JS**: replace all the field/state/renderDOM logic with a single recursive `renderValue()` that produces indented text. Set up stream listeners lazily (track which streams we've already subscribed to via a WeakSet). Re-render after each chunk + microtask.
