import React from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

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
    <html lang="id" className={inter.variable}>
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
