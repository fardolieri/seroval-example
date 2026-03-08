---
name: Seroval streaming demo
overview: Create a server.ts with two endpoints -- GET / serves an HTML client page, GET /api/test1 streams seroval-serialized data. Run with Node directly.
todos:
  - id: server-file
    content: Create server.ts with HTTP server, two endpoints (/ for HTML client, /api/test1 for streaming seroval data)
    status: completed
  - id: update-index
    content: Replace index.ts with the server code
    status: completed
isProject: false
---

# Seroval Streaming Server/Client Demo

## Approach

Two endpoints in a single [server.ts](server.ts):

- `GET /` -- serves a static HTML page with client-side JS that fetches from `/api/test1` and renders streamed data
- `GET /api/test1` -- uses `crossSerializeStream` to stream serialized JS chunks as an HTTP response (content-type `text/plain` or similar, streamed line-by-line)

Run with `node server.ts`. No extra flags, no build step.

## Data flow

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    Browser->>Server: GET /
    Server->>Browser: Full HTML page with client JS
    Browser->>Server: GET /api/test1
    Note over Server: crossSerializeStream starts
    Server->>Browser: chunk: $R header
    Server->>Browser: chunk: sync scaffold
    Note over Server: Promise resolves after 1s
    Server->>Browser: chunk: profile data
    Note over Server: Promise resolves after 3s
    Server->>Browser: chunk: posts data
    Note over Server: createStream pushes
    Server->>Browser: chunk: feed message 1
    Server->>Browser: chunk: feed message 2
    Server->>Browser: chunk: feed message 3
    Server->>Browser: stream ends
    Note over Browser: Client evals each chunk, updates DOM
```

## What `/api/test1` serializes

An object with mixed sync/async data:

- `title` (string) -- available immediately
- `timestamp` (Date) -- available immediately
- `profile` (Promise) -- resolves after 1s with `{ name, bio }`
- `posts` (Promise) -- resolves after 3s with an array of posts
- `feed` (createStream) -- pushes 3 messages at 1s intervals, then closes

## Changes

### 1. Rewrite [index.ts](index.ts) as the server

- Node `http.createServer` on port 3000
- `GET /` -- responds with a complete HTML page containing:
  - Clean UI with sections for each data field and a button to trigger the request
  - Clicking the button fetches `/api/test1` using streaming fetch (`response.body.getReader()`), reads chunks, evals each line, and calls a `render()` function to update the DOM from `$R`
- `GET /api/test1` -- streaming endpoint:
  - Writes `getCrossReferenceHeader()` as the first line
  - Calls `crossSerializeStream(data, { onSerialize(chunk) { res.write(chunk + '\n') } })`
  - Ends the response once all async values and the stream have completed