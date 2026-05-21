import { createMockBflProvider } from '@uploadcare/ai-enhancer';
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AiEnhancer } from '../AiEnhancer';

// Workaround for tsconfig "jsx": "react": ensure React is in scope at runtime.
void React;

function App() {
  const provider = useMemo(() => createMockBflProvider({ latency: 600 }), []);
  const [log, setLog] = useState<string[]>([]);
  const append = (line: string) => setLog((prev) => [line, ...prev].slice(0, 20));

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontWeight: 500 }}>react-ai-enhancer demo</h1>
      <AiEnhancer
        mode="generate"
        provider={provider}
        onApply={(detail) => append(`apply: ${JSON.stringify(detail)}`)}
        onCancel={() => append('cancel')}
        onError={(error) => append(`error: ${(error as Error)?.message ?? String(error)}`)}
      />
      <pre style={{ marginTop: 24, fontSize: 12 }}>{log.join('\n')}</pre>
    </div>
  );
}

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
