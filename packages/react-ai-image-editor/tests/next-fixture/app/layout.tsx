import type { ReactNode } from 'react';

export const metadata = { title: 'ai-image-editor next fixture' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
