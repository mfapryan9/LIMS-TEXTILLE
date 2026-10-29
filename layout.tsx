import React from 'react';
import './globals.css';

export const metadata = {
  title: 'LIMS Tekstil - Lab Color Matching',
  description: 'System LIMS Pengujian Sampel Warna Kain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-800 antialiased">{children}</body>
    </html>
  );
}