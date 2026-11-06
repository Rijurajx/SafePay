import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Protected Money Companion | Financial Protection & Oversight',
  description: 'AI-assisted financial protection and dual-gate payment authorization platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
