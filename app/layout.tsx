import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Design Partner Demo',
  description: 'Generate React + Tailwind components from website styles',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}