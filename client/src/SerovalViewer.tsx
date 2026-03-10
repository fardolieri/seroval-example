import { For, Show, type JSX } from 'solid-js';

function ValueNode(props: { value: unknown; depth: number }): JSX.Element {
  const val = () => props.value;
  const d = () => props.depth;

  return (
    <>
      {(() => {
        const v = val();
        if (v === null) return <span class="x">null</span>;
        if (v === undefined) return <span class="x">undefined</span>;
        if (typeof v === 'string') return <span class="s">{JSON.stringify(v)}</span>;
        if (typeof v === 'number') return <span class="n">{v}</span>;
        if (typeof v === 'boolean') return <span class="b">{String(v)}</span>;
        if (typeof v === 'bigint') return <span class="n">{String(v)}n</span>;
        if (v instanceof Date) return <span class="d">Date({v.toISOString()})</span>;
        if (v instanceof RegExp) return <span class="d">{String(v)}</span>;

        if (v instanceof Promise) {
          const p = v as { state: string; result: unknown; error: unknown };
          return (
            <>
              <Show when={p.state === 'pending'}>
                <span class="p">&lt;pending...&gt;</span>
              </Show>
              <Show when={p.state === 'resolved'}>
                <ValueNode value={p.result} depth={d()} />
              </Show>
              <Show when={p.state === 'rejected'}>
                <span class="p">&lt;rejected: {String(p.error)}&gt;</span>
              </Show>
            </>
          );
        }

        if (typeof v === 'object' && '__SEROVAL_STREAM__' in v) {
          const s = v as { chunks: unknown[]; done: boolean; returnChunk: unknown };
          return (
            <>
              <span class="t">Stream</span>{' '}
              <ArrayBody items={s.chunks} depth={d()} />
              <Show when={!s.done}>
                {' '}<span class="p">(streaming...)</span>
              </Show>
              <Show when={s.done && s.returnChunk !== undefined}>
                {'\n' + indent(d() + 1)}<span class="x">return: </span>
                <ValueNode value={s.returnChunk} depth={d() + 1} />
              </Show>
            </>
          );
        }

        if (Array.isArray(v)) {
          if (v.length === 0) return <>{'[]'}</>;
          return <ArrayBody items={v} depth={d()} />;
        }

        if (typeof v === 'object') {
          const keys = Object.keys(v);
          if (keys.length === 0) return <>{'{}'}</>;
          const pad1 = indent(d() + 1);
          const pad0 = indent(d());
          return (
            <>
              {'{\n'}
              <For each={keys}>
                {(key, i) => (
                  <>
                    {pad1}<span class="k">{key}</span>{': '}
                    <ValueNode value={(v as Record<string, unknown>)[key]} depth={d() + 1} />
                    {i() < keys.length - 1 ? ',\n' : '\n'}
                  </>
                )}
              </For>
              {pad0 + '}'}
            </>
          );
        }

        return <>{String(v)}</>;
      })()}
    </>
  );
}

function ArrayBody(props: { items: unknown[]; depth: number }): JSX.Element {
  const pad1 = () => indent(props.depth + 1);
  const pad0 = () => indent(props.depth);
  return (
    <>
      {'[\n'}
      <For each={props.items}>
        {(item, i) => (
          <>
            {pad1()}<ValueNode value={item} depth={props.depth + 1} />
            {i() < props.items.length - 1 ? ',\n' : '\n'}
          </>
        )}
      </For>
      {pad0() + ']'}
    </>
  );
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

export function SerovalViewer(props: { value: unknown }): JSX.Element {
  return (
    <pre id="output">
      <ValueNode value={props.value} depth={0} />
    </pre>
  );
}
