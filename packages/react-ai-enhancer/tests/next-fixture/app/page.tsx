import { AiEnhancer } from '@uploadcare/react-ai-enhancer';

// Deliberately a Server Component with NO 'use client' of its own: the
// package ships the directive in its dist files, which must be enough to
// establish the client boundary. Only serializable props are passed.
export default function Page() {
  return (
    <main>
      <h1>ai-enhancer fixture</h1>
      <AiEnhancer pubkey="demo-pubkey" fallback={<div data-testid="ai-enhancer-fallback">loading editor…</div>} />
    </main>
  );
}
