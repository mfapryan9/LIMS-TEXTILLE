'use client';

import React, { useState } from 'react';

export default function HomePage() {
  const [role, setRole] = useState('OPERATOR_LAB');

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Role Switcher */}
      <header className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">LIMS Lab Color Matching</h1>
          <p className="text-sm text-slate-500">PT Nagasakti Kurnia Textile Mills</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase">Peran Saat Ini:</label>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="OPERATOR_LAB">Operator Lab</option>
            <option value="KEPALA_URUSAN_LAB">Kepala Urusan Lab</option>
            <option value="KEPALA_LAB">Kepala Lab</option>
            <option value="KEPALA_PPIC">Kepala / Operator PPIC</option>
            <option value="KEPALA_MARKETING">Kepala Marketing</option>
            <option value="KEPALA_PRODUKSI">Kepala Produksi</option>
          </select>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Sampel</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">24</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Mendesak (CR ≤ 1)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">5</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Terlambat (CR &lt; 0)</p>
          <p className="text-2xl font-bold text-red-600 mt-1">2</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Status Urgent</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">3</p>
        </div>
      </div>

      {/* Notification Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm flex justify-between items-center">
        <span>⚠️ Ada <strong>2 sampel</strong> melewati due date (CR negatif) dan <strong>3 sampel urgent</strong> memerlukan perhatian segera.</span>
      </div>

      {/* Main Content Area */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Antrean Prioritas Critical Ratio (CR)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="p-3">No. SPK</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Warna / Kode</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Critical Ratio (CR)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900">SPK-2026-001</td>
                <td className="p-3">PT Sinar Tekstil</td>
                <td className="p-3">Navy Blue (CM-102)</td>
                <td className="p-3 text-red-600 font-medium">28 Okt 2026 (Terlambat)</td>
                <td className="p-3">
                  <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-bold">
                    CR: -0.50 (Terlambat)
                  </span>
                </td>
                <td className="p-3"><span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">Dalam Proses</span></td>
                <td className="p-3 text-right">
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-medium">
                    Detail / Uji
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900">SPK-2026-004</td>
                <td className="p-3">CV Buana Warna</td>
                <td className="p-3">Scarlet Red (CM-204)</td>
                <td className="p-3 text-amber-600 font-medium">30 Okt 2026</td>
                <td className="p-3">
                  <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold">
                    CR: 0.80 (Mendesak)
                  </span>
                </td>
                <td className="p-3"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">Menunggu</span></td>
                <td className="p-3 text-right">
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-medium">
                    Detail / Uji
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}