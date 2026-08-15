import React, { useState, useMemo } from 'react';
import { School, Competition, ScoreRecord, Judge, TeamCategory } from '../types';
import { Search, Printer, Clock, Trophy, Filter, Edit3, CheckCircle2, AlertCircle, Award, Layers, RefreshCw } from 'lucide-react';

interface MyPosScoresViewProps {
  currentJudge: Judge | null;
  schools: School[];
  competitions: Competition[];
  scores: ScoreRecord[];
  onNavigateToInput: (schoolId: number, category: TeamCategory) => void;
  onRefresh?: () => void;
}

export const MyPosScoresView: React.FC<MyPosScoresViewProps> = ({
  currentJudge,
  schools,
  competitions,
  scores,
  onNavigateToInput,
  onRefresh,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TeamCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SCORED' | 'UNSCORED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Determine assigned competition and sub-pos
  const assignedComp = useMemo(() => {
    if (!currentJudge) return null;
    return competitions.find((c) => c.id === currentJudge.assignedCompetitionId) || null;
  }, [currentJudge, competitions]);

  const assignedSubPost = useMemo(() => {
    if (!assignedComp || !currentJudge?.assignedSubPostId) return null;
    return assignedComp.subPosts?.find((s) => s.id === currentJudge.assignedSubPostId) || null;
  }, [assignedComp, currentJudge]);

  const posNameDisplay = useMemo(() => {
    if (assignedSubPost) return `${assignedComp?.name || ''} - ${assignedSubPost.name}`;
    if (assignedComp) return assignedComp.name;
    return 'Semua Pos';
  }, [assignedComp, assignedSubPost]);

  const hasTimeSetting = useMemo(() => {
    if (assignedSubPost && assignedSubPost.hasTime !== undefined) {
      return assignedSubPost.hasTime;
    }
    return assignedComp?.hasTime !== false;
  }, [assignedComp, assignedSubPost]);

  const minScore = assignedSubPost?.minScore ?? assignedComp?.minScore ?? 0;
  const maxScore = assignedSubPost?.maxScore ?? assignedComp?.maxScore ?? 100;

  // Filter scores specifically for this judge's pos
  const posScores = useMemo(() => {
    if (!currentJudge) return [];

    return scores.filter((s) => {
      // Check competition ID
      if (currentJudge.assignedCompetitionId !== 'all' && s.competitionId !== currentJudge.assignedCompetitionId) {
        return false;
      }
      // Check sub-pos ID if assigned
      if (currentJudge.assignedSubPostId && s.subPostId !== currentJudge.assignedSubPostId) {
        return false;
      }
      return true;
    });
  }, [scores, currentJudge]);

  // Create a map for quick lookup: `${schoolId}_${teamCategory}` -> ScoreRecord
  const scoreMap = useMemo(() => {
    const map: Record<string, ScoreRecord> = {};
    posScores.forEach((s) => {
      map[`${s.schoolId}_${s.teamCategory}`] = s;
    });
    return map;
  }, [posScores]);

  // Generate list of all school-category entries expected for this pos
  const allEntries = useMemo(() => {
    const list: Array<{
      schoolId: number;
      schoolName: string;
      code: string;
      category: TeamCategory;
      scoreRecord?: ScoreRecord;
      isScored: boolean;
    }> = [];

    // Category constraint of the judge if any
    const allowedCategories: TeamCategory[] = [];
    if (currentJudge?.assignedCategory === 'PUTRA') {
      allowedCategories.push('PUTRA');
    } else if (currentJudge?.assignedCategory === 'PUTRI') {
      allowedCategories.push('PUTRI');
    } else {
      allowedCategories.push('PUTRA', 'PUTRI');
    }

    schools.forEach((s) => {
      if (s.hasPutra && allowedCategories.includes('PUTRA')) {
        const record = scoreMap[`${s.id}_PUTRA`];
        list.push({
          schoolId: s.id,
          schoolName: s.name,
          code: s.code,
          category: 'PUTRA',
          scoreRecord: record,
          isScored: !!record,
        });
      }
      if (s.hasPutri && allowedCategories.includes('PUTRI')) {
        const record = scoreMap[`${s.id}_PUTRI`];
        list.push({
          schoolId: s.id,
          schoolName: s.name,
          code: s.code,
          category: 'PUTRI',
          scoreRecord: record,
          isScored: !!record,
        });
      }
    });

    return list.sort((a, b) => Number(a.schoolId) - Number(b.schoolId));
  }, [schools, currentJudge, scoreMap]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return allEntries.filter((item) => {
      // Filter category
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      // Filter status
      if (statusFilter === 'SCORED' && !item.isScored) return false;
      if (statusFilter === 'UNSCORED' && item.isScored) return false;

      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const paddedId = String(item.schoolId).padStart(2, '0');
        const matchName = item.schoolName.toLowerCase().includes(q);
        const matchId = String(item.schoolId).includes(q) || paddedId.includes(q) || item.code.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }

      return true;
    });
  }, [allEntries, selectedCategory, statusFilter, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = allEntries.length;
    const scored = allEntries.filter((e) => e.isScored).length;
    const unscored = total - scored;
    const totalVal = allEntries.reduce((acc, e) => acc + (e.scoreRecord?.score || 0), 0);
    const avgScore = scored > 0 ? (totalVal / scored).toFixed(1) : '-';

    return { total, scored, unscored, avgScore };
  }, [allEntries]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header Information Banner */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-blue-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md">
                POS PENILAIAN JURI
              </span>
              {hasTimeSetting && (
                <span className="bg-sky-500/20 text-sky-200 border border-sky-400/30 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sky-400" />
                  Dengan Stopwatch
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
              <span>Daftar Nilai: {posNameDisplay}</span>
            </h1>
            <p className="text-xs text-blue-200 mt-1">
              Juri Petugas: <strong className="text-white font-bold">{currentJudge?.name || currentJudge?.username || 'Petugas'}</strong> {currentJudge?.username ? `(@${currentJudge.username})` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2.5 bg-blue-900/80 hover:bg-blue-800 text-blue-200 rounded-xl border border-blue-700 transition-all cursor-pointer"
                title="Muat Ulang Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Rekap Pos</span>
            </button>
          </div>
        </div>

        {/* Pos Specs Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-blue-900/80 border border-blue-700/80 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="text-blue-300">Rentang Nilai:</span>
            <span className="font-extrabold text-amber-300">{minScore} - {maxScore}</span>
          </div>
          <div className="bg-blue-900/80 border border-blue-700/80 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span className="text-blue-300">Kategori Ditugaskan:</span>
            <span className="font-extrabold text-white">{currentJudge?.assignedCategory || 'SEMUA REGU'}</span>
          </div>
        </div>
      </div>

      {/* 2. Quick Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Pangkalan</p>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Regu terdaftar</p>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Sudah Diinput</p>
          <div className="text-2xl font-black text-emerald-900 flex items-center gap-1.5">
            <span>{stats.scored}</span>
            <span className="text-xs font-bold text-emerald-700">({stats.total > 0 ? Math.round((stats.scored / stats.total) * 100) : 0}%)</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5">Sudah tersimpan</p>
        </div>

        <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-xs">
          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Belum Diinput</p>
          <div className="text-2xl font-black text-amber-900">{stats.unscored}</div>
          <p className="text-[11px] text-amber-700 mt-0.5">Menunggu penilaian</p>
        </div>

        <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 shadow-xs">
          <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider mb-1">Rata-rata Nilai Pos</p>
          <div className="text-2xl font-black text-indigo-950">{stats.avgScore}</div>
          <p className="text-[11px] text-indigo-700 mt-0.5">Nilai rata-rata</p>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Regu Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedCategory === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Regu
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('PUTRA')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedCategory === 'PUTRA' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👦 Regu Putra
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('PUTRI')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedCategory === 'PUTRI' ? 'bg-pink-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👧 Regu Putri
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({allEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SCORED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'SCORED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sudah Input ({stats.scored})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNSCORED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'UNSCORED' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum ({stats.unscored})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pangkalan..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

        </div>
      </div>

      {/* 4. Main Score Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Daftar Nilai Pangkalan ({filteredEntries.length} Tampil)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Klik "Edit Nilai" untuk mengubah nilai
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4 w-16 text-center">No</th>
                <th className="py-3 px-4">Pangkalan / Sekolah</th>
                <th className="py-3 px-4 w-28 text-center">Kategori</th>
                <th className="py-3 px-4 w-28 text-center">Nilai Pos</th>
                {hasTimeSetting && <th className="py-3 px-4 w-32 text-center">Waktu Tempuh</th>}
                <th className="py-3 px-4 w-32 text-center">Status</th>
                <th className="py-3 px-4 w-40 text-center">Waktu Input</th>
                <th className="py-3 px-4 w-28 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={hasTimeSetting ? 8 : 7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-slate-600">Tidak ada data pangkalan yang sesuai dengan filter.</p>
                      <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau filter status.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item, idx) => {
                  const rec = item.scoreRecord;
                  const isScored = !!rec;

                  return (
                    <tr
                      key={`${item.schoolId}_${item.category}`}
                      className={`hover:bg-blue-50/50 transition-colors ${
                        isScored ? 'bg-emerald-50/20' : 'bg-white'
                      }`}
                    >
                      {/* ID / No */}
                      <td className="py-3 px-4 font-mono font-extrabold text-slate-900 text-center">
                        #{String(item.schoolId).padStart(2, '0')}
                      </td>

                      {/* School Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{item.schoolName}</span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.code}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.category === 'PUTRA'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-pink-100 text-pink-900 border border-pink-200'
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="py-3 px-4 text-center">
                        {isScored ? (
                          <span className="text-base font-black text-emerald-900 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 inline-block">
                            {rec.score}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono italic">-</span>
                        )}
                      </td>

                      {/* Time if enabled */}
                      {hasTimeSetting && (
                        <td className="py-3 px-4 text-center">
                          {isScored && rec.timeFormatted && rec.timeFormatted !== '00:00:000' ? (
                            <span className="font-mono text-slate-800 font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200 text-xs">
                              ⏱ {rec.timeFormatted}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isScored ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Sudah Input</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                            <span>Belum Input</span>
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-center text-[11px] text-slate-500 font-mono">
                        {isScored && rec.timestamp ? (
                          new Date(rec.timestamp).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onNavigateToInput(item.schoolId, item.category)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                            isScored
                              ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isScored ? 'Edit' : 'Input'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print View Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .my-pos-print-area, .my-pos-print-area * {
            visibility: visible;
          }
          .my-pos-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
