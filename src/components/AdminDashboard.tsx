import React, { useMemo } from 'react';
import { School, Competition, Judge, ScoreRecord, ActivityLog } from '../types';
import { School as SchoolIcon, Trophy, CheckCircle, Clock, AlertTriangle, Activity, TrendingUp, Users, ArrowUpRight, BarChart2, Upload } from 'lucide-react';

interface AdminDashboardProps {
  schools: School[];
  competitions: Competition[];
  judges: Judge[];
  scores: ScoreRecord[];
  logs: ActivityLog[];
  onNavigateTab: (tab: string) => void;
  onOpenUploadModal?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  schools,
  competitions,
  judges,
  scores,
  logs,
  onNavigateTab,
  onOpenUploadModal,
}) => {
  // Statistics Calculations
  const totalSchools = schools.length;
  const totalReguPutra = schools.filter((s) => s.hasPutra).length;
  const totalReguPutri = schools.filter((s) => s.hasPutri).length;
  const totalPossibleTeams = totalReguPutra + totalReguPutri;

  // Online Judges count
  const onlineJudgesCount = useMemo(() => {
    const now = Date.now();
    return judges.filter((j) => j.lastActive && (now - new Date(j.lastActive).getTime() < 60000)).length;
  }, [judges]);

  // Total scoring slots (Total competitions / pos * total possible teams)
  const totalPosCount = useMemo(() => {
    let count = 0;
    competitions.forEach((c) => {
      if (!c.active) return;
      if (c.isExploration && c.subPosts) {
        count += c.subPosts.length;
      } else {
        count += 1;
      }
    });
    return count;
  }, [competitions]);

  const maxTotalScoreEntriesPossible = totalPosCount * totalPossibleTeams;
  const totalScoresEntered = scores.length;
  const progressPercent = maxTotalScoreEntriesPossible > 0
    ? Math.min(100, Math.round((totalScoresEntered / maxTotalScoreEntriesPossible) * 100))
    : 0;

  // Competition Progress breakdown
  const competitionProgressList = useMemo(() => {
    return competitions.map((comp) => {
      let compPosCount = 1;
      let scoreCount = 0;

      if (comp.isExploration && comp.subPosts) {
        compPosCount = comp.subPosts.length;
        scoreCount = scores.filter((s) => s.competitionId === comp.id).length;
      } else {
        scoreCount = scores.filter((s) => s.competitionId === comp.id).length;
      }

      const target = compPosCount * totalPossibleTeams;
      const pct = target > 0 ? Math.round((scoreCount / target) * 100) : 0;
      return {
        ...comp,
        scoreCount,
        target,
        pct,
      };
    });
  }, [competitions, scores, totalPossibleTeams]);

  // Completed Pos count (where 100% scores are entered)
  const posCompletedCount = competitionProgressList.filter((c) => c.pct >= 100).length;
  const posPendingCount = competitionProgressList.length - posCompletedCount;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            REAL-TIME MONITORING CENTER
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Ringkasan Perlombaan</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Pantau perolehan nilai 55 pangkalan dan progress 11 pos lomba secara langsung.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Upload className="w-4 h-4 text-sky-300" />
              <span>UPLOAD NILAI (EXCEL)</span>
            </button>
          )}
          <button
            onClick={() => onNavigateTab('realtime_monitor')}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <BarChart2 className="w-4 h-4 text-sky-300" />
            <span>LIHAT GRID MONITORING</span>
          </button>
          <button
            onClick={() => onNavigateTab('rekap')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            <span>REKAP & RANKING</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Pangkalan & Regu */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Pangkalan</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <SchoolIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{totalSchools}</div>
          <div className="flex items-center gap-3 text-xs text-slate-600 pt-1 font-medium border-t border-slate-100">
            <span className="text-blue-700 font-bold">👦 {totalReguPutra} Putra</span>
            <span>•</span>
            <span className="text-pink-700 font-bold">👧 {totalReguPutri} Putri</span>
          </div>
        </div>

        {/* Card 2: Jumlah Nilai Masuk */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Nilai Masuk</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{totalScoresEntered}</div>
          <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
            Dari estimasi <strong className="text-slate-800">{maxTotalScoreEntriesPossible}</strong> total perolehan
          </div>
        </div>

        {/* Card 3: Juri Online */}
        <div
          onClick={() => onNavigateTab('judges')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 cursor-pointer hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Juri Online</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{onlineJudgesCount}</span>
            <span className="text-xs text-slate-500 font-bold">/ {judges.length} Juri</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold pt-1 border-t border-slate-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Pantau di Master Juri →</span>
          </div>
        </div>

        {/* Card 4: Status Pos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Status Pos Lomba</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{posCompletedCount}</span>
            <span className="text-xs text-slate-500 font-bold">Selesai / {competitionProgressList.length} Total</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="text-amber-600 font-bold">{posPendingCount} Pos Belum Selesai</span>
          </div>
        </div>

        {/* Card 5: Persentase Progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Progress Kegiatan</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600">{progressPercent}%</div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

      </div>

      {/* Competition Progress Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Progress per Perlombaan */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Progress Penilaian per Perlombaan</h3>
              <p className="text-xs text-slate-500">
                11 Mata Perlombaan & Sub-Pos Penjelajahan
              </p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200">
              {competitions.length} Perlombaan Active
            </span>
          </div>

          <div className="space-y-3.5 pt-2">
            {competitionProgressList.map((comp) => (
              <div key={comp.id} className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500">#{comp.order}</span>
                    <span className="text-sm font-extrabold text-blue-950">{comp.name}</span>
                    {comp.isExploration && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        5 Sub-Pos Penjelajahan
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-slate-700">
                    {comp.scoreCount} / {comp.target} ({comp.pct}%)
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      comp.pct >= 100
                        ? 'bg-emerald-500'
                        : comp.pct > 50
                        ? 'bg-blue-600'
                        : comp.pct > 0
                        ? 'bg-amber-500'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: `${Math.min(100, comp.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Live Audit Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              Aktivitas Terbaru
            </h3>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse">
              LIVE
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 divide-y divide-slate-100">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Belum ada riwayat input penilaian</div>
            ) : (
              logs.slice(0, 15).map((log) => (
                <div key={log.id} className="pt-2.5 first:pt-0 space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="text-blue-900 font-extrabold">{log.schoolName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      {log.posName} ({log.teamCategory})
                    </span>
                    <span className="font-extrabold text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded">
                      Nilai: {log.newScore}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Juri: {log.judgeName}</span>
                    <span className="italic">{log.actionType}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
