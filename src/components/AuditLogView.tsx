import React, { useState } from 'react';
import { ActivityLog } from '../types';
import { History, Search, ShieldAlert, Monitor, Globe } from 'lucide-react';

interface AuditLogViewProps {
  logs: ActivityLog[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      log.schoolName.toLowerCase().includes(q) ||
      log.judgeName.toLowerCase().includes(q) ||
      log.posName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            Riwayat Log Penilaian & Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rekam jejak setiap perubahan nilai, juri pencatat, perangkat, IP, dan timestamps.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari log nama pangkalan/juri..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Juri</th>
                <th className="py-3.5 px-4">Pos Penilaian</th>
                <th className="py-3.5 px-4">Pangkalan / Regu</th>
                <th className="py-3.5 px-4 text-center">Nilai Lama</th>
                <th className="py-3.5 px-4 text-center">Nilai Baru</th>
                <th className="py-3.5 px-4">Perangkat & IP</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Belum ada catatan aktivitas log
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(log.timestamp).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{log.judgeName}</td>
                    <td className="py-3 px-4 font-bold text-blue-900">{log.posName}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      {log.schoolName} <span className="text-[10px] font-semibold text-slate-500">({log.teamCategory})</span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {log.oldScore !== null ? log.oldScore : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 bg-emerald-50/50">
                      {log.newScore}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <Monitor className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{log.device}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                        <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>IP: {log.ip}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
