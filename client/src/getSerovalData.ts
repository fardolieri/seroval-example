import { createSignal } from 'solid-js';
import { fromCrossJSON, type SerovalNode } from 'seroval';

export interface AugmentedPromise<T = unknown> extends Promise<T> {
  readonly state: 'pending' | 'resolved' | 'rejected';
  readonly result: T | undefined;
  readonly error: unknown;
}

export interface AugmentedStream<T = unknown> {
  readonly __SEROVAL_STREAM__: true;
  on(listener: { next(v: T): void; throw(v: unknown): void; return(v: T): void }): () => void;
  next(value: T): void;
  throw(value: unknown): void;
  return(value: T): void;
  readonly chunks: T[];
  readonly returnChunk: T | undefined;
  readonly done: boolean;
  readonly error: unknown;
}

const _augmented = new WeakSet();

function augment(value: unknown): unknown {
  if (value != null && typeof value === 'object') {
    if (_augmented.has(value)) return value;
    _augmented.add(value);
  }

  if (value instanceof Promise) {
    const [state, setState] = createSignal<'pending' | 'resolved' | 'rejected'>('pending');
    const [result, setResult] = createSignal<unknown>(undefined);
    const [error, setError] = createSignal<unknown>(undefined);

    Object.defineProperty(value, 'state', { get: state, enumerable: true });
    Object.defineProperty(value, 'result', { get: result, enumerable: true });
    Object.defineProperty(value, 'error', { get: error, enumerable: true });

    value.then(
      v => { setResult(augment(v)); setState('resolved'); },
      e => { setError(e); setState('rejected'); },
    );

    return value;
  }

  if (value && typeof value === 'object' && '__SEROVAL_STREAM__' in value) {
    const stream = value as { __SEROVAL_STREAM__: true; on: Function };

    const [chunks, setChunks] = createSignal<unknown[]>([]);
    const [returnChunk, setReturnChunk] = createSignal<unknown>(undefined);
    const [done, setDone] = createSignal(false);
    const [error, setError] = createSignal<unknown>(undefined);

    Object.defineProperty(stream, 'chunks', { get: chunks, enumerable: true });
    Object.defineProperty(stream, 'returnChunk', { get: returnChunk, enumerable: true });
    Object.defineProperty(stream, 'done', { get: done, enumerable: true });
    Object.defineProperty(stream, 'error', { get: error, enumerable: true });

    stream.on({
      next(v: unknown) { setChunks(prev => [...prev, augment(v)]); },
      throw(e: unknown) { setError(e); setDone(true); },
      return(v: unknown) { setReturnChunk(augment(v)); setDone(true); },
    });

    return stream;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = augment(value[i]);
    }
    return value;
  }

  if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value instanceof RegExp)) {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      obj[key] = augment(obj[key]);
    }
    return obj;
  }

  return value;
}

export function getSerovalData(url: string): AugmentedPromise {
  const rootPromise = new Promise((resolve, reject) => {
    (async () => {
      const res = await fetch(url);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const refs = new Map<number, unknown>();
      let buf = '';
      let root: unknown = undefined;
      let resolved = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const node: SerovalNode = JSON.parse(line);
          const result = fromCrossJSON(node, { refs });
          if (!resolved && result !== undefined) {
            root = augment(result);
            resolved = true;
            resolve(root);
          }
        }
      }

      if (!resolved) {
        resolve(undefined);
      }
    })().catch(reject);
  });

  return augment(rootPromise) as AugmentedPromise;
}
