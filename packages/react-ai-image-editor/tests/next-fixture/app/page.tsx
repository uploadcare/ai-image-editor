import { AiImageEditor } from '@uploadcare/react-ai-image-editor';

// Deliberately a Server Component with NO 'use client' of its own: the
// package ships the directive in its dist files, which must be enough to
// establish the client boundary. Only serializable props are passed.
export default function Page() {
  return (
    <main>
      <h1>ai-image-editor fixture</h1>
      <AiImageEditor pubkey="demo-pubkey" fallback={<div data-testid="ai-image-editor-fallback">loading editor…</div>} />
    </main>
  );
}
