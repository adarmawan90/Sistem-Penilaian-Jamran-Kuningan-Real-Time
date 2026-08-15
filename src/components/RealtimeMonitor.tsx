import React, { useState, useMemo } from 'react';
import { School, Competition, ScoreRecord } from '../types';
import { Eye, CheckCircle2, Circle, Search, Filter } from 'lucide-react';

interface RealtimeMonitorProps {
  schools: School[];
  competitions: Competition[];
  scores: ScoreRecord[];
}

export const RealtimeMonitor: React.FC<RealtimeMonitorProps> = ({ schools, competitions, scores }) => {
  const [selectedCategory, setSelectedCategory] = useState<'PUTRA' | 'PUTRI'>('PUTRA');
  const [search, setSearch] = useState('');

  // Expand competitions into sub-pos list
  const expandedPosList = useMemo(() => {
    const list: { key: string; name: string; compName: string }[] = [];
    competitions.forEach((c) => {
      if (!c.active) return;
      if (c.isExploration && c.subPosts) {
        c.subPosts.forEach((sp) => {
          list.push({ key: `${c.id}_${sp.id}`, name: sp.name, compName: c.name });
        });
      } else {
        list.push({ key: c.id, name: c.name, compName: c.name });
      }
    });
    return list;
  }, [competitions]);

  const filteredSchools = useMemo(() => {
    return schools
      .filter((s) => (selectedCategory === 'PUTRA' ? s.hasPutra : s.hasPutri))
      .filter((s) => {
        const q = search.toLowerCase();
        const paddedId = String(s.id).padStart(2, '0');
        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || String(s.id).includes(q) || paddedId.includes(q);
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [schools, selectedCategory, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Eye className="w-6 h-6 text-sky-600" />
            Grid Monitoring Real-Time Status Pos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau pangkalan mana yang sudah dinilai (Hijau) dan belum dinilai (Abu-abu) di setiap pos.
          </p>
        </div>

        {/* Legend & Category Switch */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sudah
            </span>
            <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              <Circle className="w-3.5 h-3.5 text-slate-400" /> Belum
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-xl">
            <button
              onClick={() => setSelectedCategory('PUTRA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                selectedCategory === 'PUTRA' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700'
              }`}
            >
              👦 PUTRA
            </button>
            <button
              onClick={() => setSelectedCategory('PUTRI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                selectedCategory === 'PUTRI' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-700'
              }`}
            >
              👧 PUTRI
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter pangkalan..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Grid Monitor Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center border-r border-slate-800">No</th>
                <th className="py-3 px-3 min-w-[180px] border-r border-slate-800">Nama Pangkalan</th>
                {expandedPosList.map((pos) => (
                  <th key={pos.key} className="py-3 px-2 text-center border-r border-slate-800 min-w-[70px]">
                    <span className="block truncate text-[10px] font-extrabold">{pos.name}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSchools.map((school) => (
                <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-100">
                    #{String(school.id).padStart(2, '0')}
                  </td>
                  <td className="py-2 px-3 font-extrabold text-slate-900 border-r border-slate-100">
                    {school.name}
                  </td>

                  {expandedPosList.map((pos) => {
                    const [compId, subId] = pos.key.split('_');
                    const hasScore = scores.some((s) => {
                      if (s.schoolId === school.id && s.teamCategory === selectedCategory && s.competitionId === compId) {
                        if (subId) return s.subPostId === subId;
                        return !s.subPostId;
                      }
                      return false;
                    });

                    return (
                      <td key={pos.key} className="py-2 px-2 text-center border-r border-slate-100">
                        {hasScore ? (
                          <div className="inline-flex items-center justify-center p-1 bg-emerald-100 text-emerald-700 rounded-lg shadow-2xs" title={`${school.name} - ${pos.name}: Selesai`}>
                            <CheckCircle2 className="w-4 h-4 fill-emerald-600 text-white" />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center p-1 text-slate-300" title={`${school.name} - ${pos.name}: Belum`}>
                            <Circle className="w-4 h-4 stroke-1" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
