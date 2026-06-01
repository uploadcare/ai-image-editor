import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AiEnhancer } from '../AiEnhancer';

// Workaround for tsconfig "jsx": "react": ensure React is in scope at runtime.
void React;

type Theme = 'auto' | 'light' | 'dark';

function App() {
  const [log, setLog] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>('auto');
  const append = (line: string) => setLog((prev) => [line, ...prev].slice(0, 20));

  useEffect(() => {
    document.body.classList.remove('uc-light', 'uc-dark');
    if (theme !== 'auto') document.body.classList.add(`uc-${theme}`);
  }, [theme]);

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontWeight: 500 }}>react-ai-enhancer demo</h1>
      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', margin: '0 0 16px', fontSize: 13 }}>
        Theme
        <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          <option value="auto">auto (system)</option>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </label>
      <AiEnhancer
        mode="generate"
        pubkey="demopublickey"
        baseUrl="https://upload.staging0.uploadcare.com"
        cdnCnamePrefixed="https://staging0.ucarecd.net"
        onDone={(detail) => append(`done: ${JSON.stringify(detail)}`)}
        onCancel={() => append('cancel')}
        onError={(error) => append(`error: ${(error as Error)?.message ?? String(error)}`)}
      />
      <pre style={{ marginTop: 24, fontSize: 12 }}>{log.join('\n')}</pre>
    </div>
  );
}

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
