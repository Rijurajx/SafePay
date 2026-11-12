import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafePay | A Little Shelter for Every Payment',
  description: 'AI-assisted financial protection and dual-gate payment authorization platform with PayPal Companion safeguards.',
  icons: {
    icon: '/safepay-logo.png',
    apple: '/safepay-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  for (var i = 0; i < regs.length; i++) {
                    regs[i].unregister();
                  }
                });
                if ('caches' in window) {
                  caches.keys().then(function(names) {
                    for (var i = 0; i < names.length; i++) {
                      caches.delete(names[i]);
                    }
                  });
                }
              }
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
