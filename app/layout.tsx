import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Procedural Cyberpunk City',
  description: 'Procedural 3D cyberpunk city generator',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black">{children}</body>
    </html>
  );
}
