import React, { useState, useMemo, useEffect } from 'react';
import { School, Competition, ScoreRecord, TeamCategory, RankingResult, AppSettings, Judge } from '../types';
import { ApiService } from '../services/apiService';
import {
  Trophy,
  Medal,
  Award,
  Search,
  Printer,
  Download,
  Sparkles,
  Clock,
  CheckCircle2,
  Target,
  Layers,
  ChevronRight,
  FileSpreadsheet,
  SlidersHorizontal,
  Save,
  Filter,
  Eye,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface RankingViewProps {
  schools: School[];
  competitions: Competition[];
  scores: ScoreRecord[];
  settings?: AppSettings;
  currentJudge?: Judge | null;
  onRefresh?: () => void;
}

interface PosOption {
  id: string; // unique identifier
  name: string;
  competitionId: string;
  subPostId?: string;
  hasTime: boolean;
  minScore: number;
  maxScore: number;
}

interface PosRankingItem {
  rank: number;
  schoolId: number;
  schoolName: string;
  code: string;
  teamCategory: TeamCategory;
  score: number;
  timeMs: number;
  timeFormatted: string;
  timestamp: string;
  notes?: string;
  hasRecord: boolean;
}

export const RankingView: React.FC<RankingViewProps> = ({
  schools,
  competitions,
  scores,
  settings,
  currentJudge,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<'OVERALL' | 'PER_POS'>('OVERALL');
  const [activeCategory, setActiveCategory] = useState<TeamCategory>('PUTRA');
  const [selectedPosId, setSelectedPosId] = useState<string>('');
  const [search, setSearch] = useState('');

  // Admin configurable ranking limit (0 = all, 3 = top 3, 5 = top 5, etc.)
  const [displayLimit, setDisplayLimit] = useState<number>(settings?.rankingLimit ?? 0);
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInputVal, setCustomInputVal] = useState<string>('');

  // Sync when settings change
  useEffect(() => {
    if (settings?.rankingLimit !== undefined) {
      setDisplayLimit(settings.rankingLimit);
    }
  }, [settings?.rankingLimit]);

  // Helper time formatter
  const formatMs = (timeMs: number) => {
    if (!timeMs || timeMs <= 0) return '-';
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);
    const millis = timeMs % 1000;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(millis).padStart(3, '0')}`;
  };

  // Build Pos Options list (Competitions & Sub-Posts)
  const posOptions: PosOption[] = useMemo(() => {
    const list: PosOption[] = [];
    competitions.forEach((comp) => {
      if (comp.isExploration && comp.subPosts && comp.subPosts.length > 0) {
        comp.subPosts.forEach((sp) => {
          const subHasTime = sp.hasTime !== undefined ? sp.hasTime : (comp.hasTime !== false);
          list.push({
            id: sp.id,
            name: `${comp.name} - ${sp.name}`,
            competitionId: comp.id,
            subPostId: sp.id,
            hasTime: subHasTime,
            minScore: sp.minScore ?? comp.minScore ?? 0,
            maxScore: sp.maxScore ?? comp.maxScore ?? 100,
          });
        });
      } else {
        list.push({
          id: comp.id,
          name: comp.name,
          competitionId: comp.id,
          hasTime: comp.hasTime !== false,
          minScore: comp.minScore || 0,
          maxScore: comp.maxScore || 100,
        });
      }
    });
    return list;
  }, [competitions]);

  // Set default selected pos when posOptions loads
  useEffect(() => {
    if (posOptions.length > 0 && (!selectedPosId || !posOptions.some((p) => p.id === selectedPosId))) {
      setSelectedPosId(posOptions[0].id);
    }
  }, [posOptions, selectedPosId]);

  const selectedPos = useMemo(() => {
    return posOptions.find((p) => p.id === selectedPosId) || posOptions[0];
  }, [posOptions, selectedPosId]);

  // Calculate OVERALL Rankings according to tie-breaker rules
  const rankingList: RankingResult[] = useMemo(() => {
    const list: RankingResult[] = [];

    schools.forEach((school) => {
      const hasCategory = activeCategory === 'PUTRA' ? school.hasPutra : school.hasPutri;
      if (!hasCategory) return;

      const teamScores = scores.filter(
        (s) => s.schoolId === school.id && s.teamCategory === activeCategory
      );

      let totalScore = 0;
      let totalTimeMs = 0;
      let earliestSubmit = '9999-12-31';
      const breakdown: Record<string, number> = {};

      teamScores.forEach((s) => {
        totalScore += s.score;
        totalTimeMs += s.timeInMs;
        if (s.timestamp && s.timestamp < earliestSubmit) {
          earliestSubmit = s.timestamp;
        }
        const key = s.subPostId || s.competitionId;
        breakdown[key] = s.score;
      });

      const totalTimeFormatted = formatMs(totalTimeMs);

      list.push({
        rank: 0,
        schoolId: school.id,
        schoolName: school.name,
        teamCategory: activeCategory,
        totalScore,
        totalTimeMs,
        totalTimeFormatted,
        earliestSubmitTimestamp: earliestSubmit === '9999-12-31' ? new Date().toISOString() : earliestSubmit,
        scoresCount: teamScores.length,
        scoresBreakdown: breakdown,
      });
    });

    // SORTING LOGIC FOR OVERALL:
    // 1. Total Score HIGHEST (DESC)
    // 2. Total Time FASTEST (ASC)
    // 3. Submission Timestamp EARLIEST (ASC)
    list.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      if (a.totalTimeMs !== b.totalTimeMs) {
        return a.totalTimeMs - b.totalTimeMs;
      }
      return a.earliestSubmitTimestamp.localeCompare(b.earliestSubmitTimestamp);
    });

    // Assign Rank index
    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [schools, scores, activeCategory]);

  // Calculate RANKING PER POS
  const posRankingList: PosRankingItem[] = useMemo(() => {
    if (!selectedPos) return [];

    const list: PosRankingItem[] = [];

    schools.forEach((school) => {
      const hasCategory = activeCategory === 'PUTRA' ? school.hasPutra : school.hasPutri;
      if (!hasCategory) return;

      const scoreRecord = scores.find((s) => {
        if (s.schoolId !== school.id || s.teamCategory !== activeCategory) return false;
        if (selectedPos.subPostId) {
          return s.competitionId === selectedPos.competitionId && s.subPostId === selectedPos.subPostId;
        }
        return s.competitionId === selectedPos.competitionId && !s.subPostId;
      });

      list.push({
        rank: 0,
        schoolId: school.id,
        schoolName: school.name,
        code: `PKG-${String(school.id).padStart(2, '0')}`,
        teamCategory: activeCategory,
        score: scoreRecord ? scoreRecord.score : 0,
        timeMs: scoreRecord ? scoreRecord.timeInMs : 0,
        timeFormatted: scoreRecord ? formatMs(scoreRecord.timeInMs) : '-',
        timestamp: scoreRecord?.timestamp || '',
        notes: scoreRecord?.notes,
        hasRecord: !!scoreRecord,
      });
    });

    // SORTING LOGIC FOR POS RANKING:
    // 1. Score HIGHEST (DESC)
    // 2. Time FASTEST (ASC) if time > 0
    // 3. Timestamp EARLIEST (ASC)
    list.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.timeMs > 0 && b.timeMs > 0 && a.timeMs !== b.timeMs) {
        return a.timeMs - b.timeMs;
      }
      if (a.timeMs > 0 && b.timeMs === 0) return -1;
      if (b.timeMs > 0 && a.timeMs === 0) return 1;
      return (a.timestamp || '9999').localeCompare(b.timestamp || '9999');
    });

    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [schools, scores, activeCategory, selectedPos]);

  // Current active full dataset before limit
  const activeFullList: (RankingResult | PosRankingItem)[] = viewMode === 'OVERALL' ? rankingList : posRankingList;
  const totalSchoolsInCat = activeFullList.length;

  // Filtered rankings applying displayLimit and search
  const filteredRankings: (RankingResult | PosRankingItem)[] = useMemo(() => {
    let list: (RankingResult | PosRankingItem)[] = activeFullList;

    // Apply ranking limit if set (> 0)
    if (displayLimit > 0) {
      list = list.filter((r) => r.rank <= displayLimit);
    }

    // Apply search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const paddedId = String(r.schoolId).padStart(2, '0');
        const nameMatch = r.schoolName.toLowerCase().includes(q);
        const codeMatch = 'code' in r ? (r as any).code.toLowerCase().includes(q) : String(r.schoolId).includes(q);
        const numMatch = String(r.schoolId).includes(q) || paddedId.includes(q);
        return nameMatch || codeMatch || numMatch;
      });
    }

    return list;
  }, [activeFullList, displayLimit, search]);

  // Podium contestants from full list
  const top1 = activeFullList[0];
  const top2 = activeFullList[1];
  const top3 = activeFullList[2];

  // Save Limit to System (For Admin)
  const handleSaveDefaultLimit = async (limitVal: number) => {
    if (!currentJudge || currentJudge.role !== 'ADMIN') return;
    setIsSavingLimit(true);
    try {
      await ApiService.saveSettings({
        ...(settings || {}),
        rankingLimit: limitVal,
      });
      setSaveSuccessMsg(
        limitVal === 0
          ? 'Batas ranking default diatur ke SEMUA Pangkalan!'
          : `Batas ranking default berhasil diatur ke Top ${limitVal} Peringkat!`
      );
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Gagal menyimpan batas ranking default');
    } finally {
      setIsSavingLimit(false);
    }
  };

  // Export Excel Functions
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    if (viewMode === 'OVERALL') {
      const headers = ['Peringkat', 'No Pangkalan', 'Nama Pangkalan', 'Total Nilai', 'Total Waktu (MM:SS:mmm)', 'Jumlah Pos Dinilai'];
      const rows = filteredRankings.map((r: any) => [
        r.rank,
        `PKG-${String(r.schoolId).padStart(2, '0')}`,
        r.schoolName,
        r.totalScore,
        r.totalTimeFormatted,
        r.scoresCount,
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const limitSuffix = displayLimit > 0 ? `_Top${displayLimit}` : '';
      XLSX.utils.book_append_sheet(workbook, worksheet, `Juara_Umum_${activeCategory}${limitSuffix}`);
      XLSX.writeFile(workbook, `Hasil_Ranking_Juara_Umum_${activeCategory}${limitSuffix}_${Date.now()}.xlsx`);
    } else {
      const posTitle = selectedPos ? selectedPos.name : 'Pos';
      const headers = ['Peringkat', 'Kode Pangkalan', 'Nama Pangkalan', 'Nilai Pos', 'Waktu Stopwatch', 'Catatan Juri'];
      const rows = filteredRankings.map((r: any) => [
        r.rank,
        r.code,
        r.schoolName,
        r.score,
        r.timeFormatted,
        r.notes || '-',
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const limitSuffix = displayLimit > 0 ? `_Top${displayLimit}` : '';
      XLSX.utils.book_append_sheet(workbook, worksheet, `Juara_Pos_${activeCategory}${limitSuffix}`);
      XLSX.writeFile(workbook, `Hasil_Ranking_${posTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${activeCategory}${limitSuffix}_${Date.now()}.xlsx`);
    }
  };

  // Export ALL Pos Rankings to Excel Multi-Sheet
  const handleExportAllPosExcel = () => {
    const workbook = XLSX.utils.book_new();

    posOptions.forEach((pos) => {
      const listForPos: PosRankingItem[] = [];

      schools.forEach((school) => {
        const hasCategory = activeCategory === 'PUTRA' ? school.hasPutra : school.hasPutri;
        if (!hasCategory) return;

        const scoreRecord = scores.find((s) => {
          if (s.schoolId !== school.id || s.teamCategory !== activeCategory) return false;
          if (pos.subPostId) {
            return s.competitionId === pos.competitionId && s.subPostId === pos.subPostId;
          }
          return s.competitionId === pos.competitionId && !s.subPostId;
        });

        listForPos.push({
          rank: 0,
          schoolId: school.id,
          schoolName: school.name,
          code: `PKG-${String(school.id).padStart(2, '0')}`,
          teamCategory: activeCategory,
          score: scoreRecord ? scoreRecord.score : 0,
          timeMs: scoreRecord ? scoreRecord.timeInMs : 0,
          timeFormatted: scoreRecord ? formatMs(scoreRecord.timeInMs) : '-',
          timestamp: scoreRecord?.timestamp || '',
          notes: scoreRecord?.notes,
          hasRecord: !!scoreRecord,
        });
      });

      listForPos.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.timeMs > 0 && b.timeMs > 0 && a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
        if (a.timeMs > 0 && b.timeMs === 0) return -1;
        if (b.timeMs > 0 && a.timeMs === 0) return 1;
        return (a.timestamp || '9999').localeCompare(b.timestamp || '9999');
      });

      // Apply limit if configured
      const finalItems = displayLimit > 0 ? listForPos.slice(0, displayLimit) : listForPos;

      const headers = ['Peringkat', 'Kode Pangkalan', 'Nama Pangkalan', 'Nilai Pos', 'Waktu Stopwatch', 'Catatan Juri'];
      const rows = finalItems.map((r, idx) => [
        idx + 1,
        r.code,
        r.schoolName,
        r.score,
        r.timeFormatted,
        r.notes || '-',
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      let sheetName = pos.name.replace(/[:\\/?*\[\]]/g, '').slice(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const limitSuffix = displayLimit > 0 ? `_Top${displayLimit}` : '';
    XLSX.writeFile(workbook, `Ranking_Semua_Pos_${activeCategory}${limitSuffix}_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Mode Navigation Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('OVERALL')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'OVERALL'
                ? 'bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-400/50'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>🏆 RANKING JUARA UMUM</span>
          </button>
          <button
            onClick={() => setViewMode('PER_POS')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'PER_POS'
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-500/50'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>🎯 RANKING PER POS / MATA LOMBA</span>
          </button>
        </div>

        {viewMode === 'PER_POS' && (
          <button
            onClick={handleExportAllPosExcel}
            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            title="Unduh Rekap Ranking Semua Pos dalam 1 File Excel Multi-Sheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>UNDUH SEMUA POS (EXCEL)</span>
          </button>
        )}
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {viewMode === 'OVERALL' ? (
              <>
                <Trophy className="w-6 h-6 text-amber-500" />
                <span>Papan Peringkat Juara Umum (Real-Time)</span>
              </>
            ) : (
              <>
                <Target className="w-6 h-6 text-indigo-600" />
                <span>Papan Peringkat Per Pos / Mata Lomba</span>
              </>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aturan Ranking: Nilai Terbesar ➔ Waktu Stopwatch Tercepat ➔ Waktu Input Terawal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            <span>EXCEL {viewMode === 'OVERALL' ? 'UMUM' : 'POS'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>CETAK RANKING</span>
          </button>
        </div>
      </div>

      {/* Admin Ranking Display Limit Toolbar */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-100 to-amber-500/10 p-4 rounded-2xl border border-amber-200/80 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-amber-600" />
              <span>Tampilkan Sampai Peringkat:</span>
            </div>

            {/* Quick Limit Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { val: 0, label: 'Semua' },
                { val: 3, label: '🏆 Top 3' },
                { val: 5, label: 'Top 5' },
                { val: 6, label: '🎖️ Top 6' },
                { val: 10, label: 'Top 10' },
                { val: 20, label: 'Top 20' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDisplayLimit(opt.val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    displayLimit === opt.val
                      ? 'bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-400'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {/* Custom Number Button */}
              <button
                type="button"
                onClick={() => {
                  setCustomInputVal(displayLimit > 0 ? String(displayLimit) : '10');
                  setShowCustomModal(true);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                  ![0, 3, 5, 6, 10, 20].includes(displayLimit)
                    ? 'bg-amber-500 text-amber-950 border-amber-400 shadow-md ring-2 ring-amber-400'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {![0, 3, 5, 6, 10, 20].includes(displayLimit) ? `Top ${displayLimit}` : '⚙️ Kustom...'}
              </button>
            </div>
          </div>

          {/* Admin Save Default Button */}
          {currentJudge?.role === 'ADMIN' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSaveDefaultLimit(displayLimit)}
                disabled={isSavingLimit}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                title="Simpan batas tampilan peringkat ini sebagai pengaturan default aplikasi"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSavingLimit ? 'Menyimpan...' : 'Simpan Sebagai Default'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Success Toast */}
        {saveSuccessMsg && (
          <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Active Limit Notice Banner */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-white/70 px-3 py-2 rounded-xl border border-amber-100">
          <div className="flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            {displayLimit === 0 ? (
              <span>
                Menampilkan <strong>seluruh {totalSchoolsInCat} pangkalan</strong> tanpa pembatasan peringkat.
              </span>
            ) : (
              <span>
                Menampilkan <strong>Peringkat 1 s/d {displayLimit}</strong> ({filteredRankings.length} pangkalan).{' '}
                <span className="text-slate-500">
                  ({Math.max(0, totalSchoolsInCat - filteredRankings.length)} pangkalan di bawah Top {displayLimit} disembunyikan).
                </span>
              </span>
            )}
          </div>
          {displayLimit !== (settings?.rankingLimit ?? 0) && (
            <button
              type="button"
              onClick={() => setDisplayLimit(settings?.rankingLimit ?? 0)}
              className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
            >
              Reset ke Default Admin ({settings?.rankingLimit === 0 ? 'Semua' : `Top ${settings?.rankingLimit}`})
            </button>
          )}
        </div>
      </div>

      {/* Category & Pos Selection Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        
        {/* Category Toggle */}
        <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-2xl">
          <button
            onClick={() => setActiveCategory('PUTRA')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeCategory === 'PUTRA' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            👦 REGU PUTRA (PA)
          </button>
          <button
            onClick={() => setActiveCategory('PUTRI')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeCategory === 'PUTRI' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-700'
            }`}
          >
            👧 REGU PUTRI (PI)
          </button>
        </div>

        {/* Pos Selector (Only in PER_POS mode) */}
        {viewMode === 'PER_POS' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-600 shrink-0">Pilih Pos:</span>
            <select
              value={selectedPosId}
              onChange={(e) => setSelectedPosId(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 bg-white border-2 border-indigo-200 rounded-xl text-xs font-extrabold text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer shadow-2xs"
            >
              {posOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.hasTime ? '⏱' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pangkalan..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Selected Pos Info Banner (In PER_POS Mode) */}
      {viewMode === 'PER_POS' && selectedPos && (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-sm border border-indigo-800 flex items-center justify-between gap-3 flex-wrap print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-300 block font-bold">
                MATA LOMBA TERPILIH
              </span>
              <h3 className="text-base font-black text-white">{selectedPos.name}</h3>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1.5 bg-white/10 rounded-xl border border-white/10">
              <span className="text-slate-300">Rentang Nilai: </span>
              <strong className="text-amber-300 font-mono">{selectedPos.minScore} - {selectedPos.maxScore}</strong>
            </div>
            <div className="px-3 py-1.5 bg-white/10 rounded-xl border border-white/10 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Stopwatch: <strong className={selectedPos.hasTime ? 'text-emerald-400' : 'text-slate-400'}>{selectedPos.hasTime ? 'AKTIF' : 'NONAKTIF'}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Podium Display (Top 3) - Dynamically adapts if displayLimit < 3 */}
      {(displayLimit === 0 || displayLimit >= 1) && top1 && !search && (
        <div
          className={`grid gap-4 pt-2 print:hidden ${
            displayLimit === 1
              ? 'grid-cols-1 max-w-md mx-auto'
              : displayLimit === 2
              ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto'
              : 'grid-cols-1 md:grid-cols-3'
          }`}
        >
          {/* Juara 2 (Silver) */}
          {(displayLimit === 0 || displayLimit >= 2) && top2 && (
            <div className="bg-gradient-to-b from-slate-100 to-slate-200 rounded-2xl p-5 border-2 border-slate-300 shadow-sm text-center flex flex-col justify-between order-2 md:order-1 mt-4 md:mt-6">
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-300 text-slate-800 font-black text-xl flex items-center justify-center border-2 border-slate-400 shadow-md">
                  🥈
                </div>
                <span className="inline-block px-3 py-0.5 bg-slate-300 text-slate-800 text-[10px] font-black uppercase rounded-full tracking-wider">
                  JUARA 2 {viewMode === 'PER_POS' ? 'POS' : ''}
                </span>
                <h3 className="text-base font-black text-slate-900 leading-snug">{top2.schoolName}</h3>
              </div>

              <div className="pt-4 border-t border-slate-300/60 mt-3 space-y-1">
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {viewMode === 'OVERALL' ? (top2 as RankingResult).totalScore : (top2 as PosRankingItem).score}
                </div>
                <div className="text-[11px] text-slate-600 font-mono flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    Waktu: {viewMode === 'OVERALL' ? (top2 as RankingResult).totalTimeFormatted : (top2 as PosRankingItem).timeFormatted}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Juara 1 (Gold) */}
          <div className="bg-gradient-to-b from-amber-100 via-amber-50 to-amber-200 rounded-2xl p-6 border-2 border-amber-400 shadow-lg text-center flex flex-col justify-between order-1 md:order-2 transform md:-translate-y-2">
            <div className="space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-400 text-amber-950 font-black text-2xl flex items-center justify-center border-2 border-amber-500 shadow-lg animate-bounce">
                🥇
              </div>
              <span className="inline-block px-4 py-1 bg-amber-400 text-amber-950 text-xs font-black uppercase rounded-full tracking-wider shadow-xs">
                🏆 JUARA 1 {viewMode === 'PER_POS' ? 'POS' : 'UTAMA'}
              </span>
              <h3 className="text-lg font-black text-slate-950 leading-snug">{top1.schoolName}</h3>
            </div>

            <div className="pt-4 border-t border-amber-300 mt-4 space-y-1">
              <div className="text-4xl font-black text-amber-950 font-mono">
                {viewMode === 'OVERALL' ? (top1 as RankingResult).totalScore : (top1 as PosRankingItem).score}
              </div>
              <div className="text-xs text-amber-900 font-mono font-bold flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-800" />
                <span>
                  Waktu: {viewMode === 'OVERALL' ? (top1 as RankingResult).totalTimeFormatted : (top1 as PosRankingItem).timeFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Juara 3 (Bronze) */}
          {(displayLimit === 0 || displayLimit >= 3) && top3 && (
            <div className="bg-gradient-to-b from-amber-900/10 to-amber-800/20 rounded-2xl p-5 border-2 border-amber-800/30 shadow-sm text-center flex flex-col justify-between order-3 md:order-3 mt-4 md:mt-8">
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-700/30 text-amber-900 font-black text-xl flex items-center justify-center border-2 border-amber-700/50 shadow-md">
                  🥉
                </div>
                <span className="inline-block px-3 py-0.5 bg-amber-800/20 text-amber-900 text-[10px] font-black uppercase rounded-full tracking-wider">
                  JUARA 3 {viewMode === 'PER_POS' ? 'POS' : ''}
                </span>
                <h3 className="text-base font-black text-slate-900 leading-snug">{top3.schoolName}</h3>
              </div>

              <div className="pt-4 border-t border-amber-800/20 mt-3 space-y-1">
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {viewMode === 'OVERALL' ? (top3 as RankingResult).totalScore : (top3 as PosRankingItem).score}
                </div>
                <div className="text-[11px] text-slate-600 font-mono flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    Waktu: {viewMode === 'OVERALL' ? (top3 as RankingResult).totalTimeFormatted : (top3 as PosRankingItem).timeFormatted}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Printable Header */}
      <div className="hidden print:block text-center space-y-1 mb-4">
        <h1 className="text-xl font-black">
          PAPAN HASIL DAN RANKING LOMBA PRAMUKA {viewMode === 'PER_POS' && selectedPos ? `- POS ${selectedPos.name.toUpperCase()}` : 'JUARA UMUM'}
        </h1>
        <p className="text-sm font-bold uppercase">
          Kategori Regu: {activeCategory} {displayLimit > 0 ? `(MENAMPILKAN TOP ${displayLimit} BESAR)` : '(SEMUA PERINGKAT)'}
        </p>
        <p className="text-xs text-slate-500">Dicetak Tanggal: {new Date().toLocaleDateString('id-ID')}</p>
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-16">Rank</th>
                <th className="py-3.5 px-4 w-24">Kode</th>
                <th className="py-3.5 px-4">Nama Pangkalan</th>
                {viewMode === 'OVERALL' ? (
                  <>
                    <th className="py-3.5 px-4 text-center">Pos Dinilai</th>
                    <th className="py-3.5 px-4 text-center">Total Nilai</th>
                    <th className="py-3.5 px-4 text-center">Total Waktu (MM:SS:mmm)</th>
                  </>
                ) : (
                  <>
                    <th className="py-3.5 px-4 text-center">Nilai Pos</th>
                    <th className="py-3.5 px-4 text-center">Waktu Stopwatch</th>
                    <th className="py-3.5 px-4">Catatan Juri</th>
                  </>
                )}
                <th className="py-3.5 px-4 text-right">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {filteredRankings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    Tidak ada pangkalan ditemukan.
                  </td>
                </tr>
              ) : (
                filteredRankings.map((item: any) => {
                  let badgeClass = 'bg-slate-100 text-slate-700';
                  let rankLabel = `#${String(item.rank).padStart(2, '0')}`;

                  if (item.rank === 1) {
                    badgeClass = 'bg-amber-400 text-amber-950 font-black';
                    rankLabel = '🥇 JUARA 1';
                  } else if (item.rank === 2) {
                    badgeClass = 'bg-slate-300 text-slate-900 font-black';
                    rankLabel = '🥈 JUARA 2';
                  } else if (item.rank === 3) {
                    badgeClass = 'bg-amber-700/20 text-amber-950 font-black';
                    rankLabel = '🥉 JUARA 3';
                  } else if (item.rank === 4) {
                    rankLabel = '🎖️ HARAPAN 1';
                  } else if (item.rank === 5) {
                    rankLabel = '🎖️ HARAPAN 2';
                  } else if (item.rank === 6) {
                    rankLabel = '🎖️ HARAPAN 3';
                  }

                  const code = item.code || `PKG-${String(item.schoolId).padStart(2, '0')}`;

                  return (
                    <tr key={item.schoolId} className={item.rank <= 3 ? 'bg-amber-50/30 hover:bg-amber-50/70 font-bold' : 'hover:bg-slate-50'}>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-block ${badgeClass}`}>
                          {rankLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-blue-900">{code}</td>
                      <td className="py-3.5 px-4 font-black text-slate-900">{item.schoolName}</td>
                      
                      {viewMode === 'OVERALL' ? (
                        <>
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-600">{item.scoresCount} Pos</td>
                          <td className="py-3.5 px-4 text-center font-mono text-base font-black text-blue-950">{item.totalScore}</td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-sky-800">{item.totalTimeFormatted}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-3.5 px-4 text-center font-mono text-base font-black text-indigo-950">
                            {item.hasRecord ? item.score : <span className="text-slate-300 text-xs font-normal">Belum Dinilai</span>}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-sky-800">
                            {item.timeFormatted}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[200px] truncate">
                            {item.notes || '-'}
                          </td>
                        </>
                      )}

                      <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                        {item.rank <= 3 ? (viewMode === 'OVERALL' ? 'Penerima Piala Utama' : 'Penerima Piala Pos') : item.rank <= 6 ? 'Penerima Piagam' : 'Peserta'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Limit Dialog Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-amber-500" />
              <span>Atur Batas Peringkat Kustom</span>
            </h3>
            <p className="text-xs text-slate-500">
              Masukkan angka batas peringkat yang ingin ditampilkan pada papan ranking (misal: 8, 12, 15, 25).
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tampilkan Sampai Peringkat Ke-:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Top</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={customInputVal}
                  onChange={(e) => setCustomInputVal(e.target.value)}
                  placeholder="Contoh: 15"
                  className="w-full px-4 py-2 border-2 border-amber-300 rounded-xl font-mono text-sm font-black text-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  autoFocus
                />
                <span className="text-xs font-bold text-slate-500">Besar</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const num = Math.max(1, parseInt(customInputVal) || 1);
                  setDisplayLimit(num);
                  setShowCustomModal(false);
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
