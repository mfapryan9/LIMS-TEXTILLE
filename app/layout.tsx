import React from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

export const metadata = {
  title: 'LIMS Lab Color Matching · PT Nagasakti Kurnia Textile Mills',
  description: 'Sistem LIMS pengujian sampel warna kain PT Nagasakti Kurnia Textile Mills',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={sans.variable}>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
