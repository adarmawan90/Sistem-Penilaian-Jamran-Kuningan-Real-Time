import React, { useState, useEffect, useMemo, useRef } from 'react';
import { School, Competition, Judge, ScoreRecord, AppSettings, TeamCategory } from '../types';
import { Stopwatch } from './Stopwatch';
import { ApiService } from '../services/apiService';
import { CheckCircle2, Clock, TimerOff, Search, ShieldCheck, AlertCircle, RefreshCw, Send, User, Check, Layers, Lock, Trash2, RotateCcw, FileText } from 'lucide-react';

interface JudgePortalProps {
  currentJudge: Judge;
  competitions: Competition[];
  schools: School[];
  scores: ScoreRecord[];
  settings: AppSettings;
  initialCategory?: TeamCategory;
  selectedSchoolIdProp?: number | null;
  onScoreSaved: () => void;
}

export const JudgePortal: React.FC<JudgePortalProps> = ({
  currentJudge,
  competitions,
  schools,
  scores,
  settings,
  initialCategory = 'PUTRA',
  selectedSchoolIdProp,
  onScoreSaved,
}) => {
  const isJudgeRole = currentJudge.role === 'JUDGE';

  const assignedComp = useMemo(() => {
    return competitions.find((c) => c.id === currentJudge.assignedCompetitionId) || competitions[0];
  }, [competitions, currentJudge]);

  const [selectedSubPostId, setSelectedSubPostId] = useState<string>('');

  const assignedSubPost = useMemo(() => {
    if (assignedComp?.isExploration && assignedComp.subPosts && assignedComp.subPosts.length > 0) {
      if (selectedSubPostId) {
        const found = assignedComp.subPosts.find((sp) => sp.id === selectedSubPostId);
        if (found) return found;
      }
      return assignedComp.subPosts.find((sp) => sp.id === currentJudge.assignedSubPostId) || assignedComp.subPosts[0];
    }
    return null;
  }, [assignedComp, currentJudge, selectedSubPostId]);

  const competitionHasTime = useMemo(() => {
    if (assignedSubPost && assignedSubPost.hasTime !== undefined) {
      return assignedSubPost.hasTime;
    }
    return assignedComp?.hasTime !== false;
  }, [assignedComp, assignedSubPost]);

  const posTitle = useMemo(() => {
    if (assignedSubPost) {
      return `${assignedComp?.name} - ${assignedSubPost.name}`;
    }
    return assignedComp?.name || 'Pos Penilaian';
  }, [assignedComp, assignedSubPost]);

  // Form State - If role is JUDGE, lock strictly to initialCategory selected at login
  const [selectedCategory, setSelectedCategory] = useState<TeamCategory>(initialCategory);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNSCORED' | 'SCORED'>('ALL');

  const [scoreInput, setScoreInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [capturedTimeMs, setCapturedTimeMs] = useState<number>(0);
  const [capturedTimeFormatted, setCapturedTimeFormatted] = useState<string>('00:00:000');
  
  // UI Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [timeNow, setTimeNow] = useState(new Date());

  const formRef = useRef<HTMLFormElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);

  // Sync category if initialCategory changes from parent
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  // Handle auto-selected school from external navigation
  useEffect(() => {
    if (selectedSchoolIdProp) {
      handleSelectSchool(selectedSchoolIdProp);
    }
  }, [selectedSchoolIdProp]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setTimeNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check which schools already have scores at this Pos
  const scoredSchoolMap = useMemo(() => {
    const map: Record<number, { score: number; timeFormatted: string }> = {};
    if (!assignedComp) return map;

    scores.forEach((s) => {
      if (s.teamCategory === selectedCategory && s.competitionId === assignedComp.id) {
        if (assignedSubPost) {
          if (s.subPostId === assignedSubPost.id) {
            map[s.schoolId] = { score: s.score, timeFormatted: s.timeFormatted };
          }
        } else if (!s.subPostId) {
          map[s.schoolId] = { score: s.score, timeFormatted: s.timeFormatted };
        }
      }
    });
    return map;
  }, [scores, selectedCategory, assignedComp, assignedSubPost]);

  // Filtered Schools based on category, search query, and status filter
  const filteredSchools = useMemo(() => {
    return schools
      .filter((s) => {
        if (selectedCategory === 'PUTRA' && !s.hasPutra) return false;
        if (selectedCategory === 'PUTRI' && !s.hasPutri) return false;

        const isScored = scoredSchoolMap[s.id] !== undefined;
        if (statusFilter === 'UNSCORED' && isScored) return false;
        if (statusFilter === 'SCORED' && !isScored) return false;

        const q = searchQuery.toLowerCase();
        const paddedId = String(s.id).padStart(2, '0');
        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || String(s.id).includes(q) || paddedId.includes(q);
      })
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [schools, selectedCategory, searchQuery, statusFilter, scoredSchoolMap]);

  // Selected school object
  const selectedSchool = useMemo(() => {
    return schools.find((s) => s.id === Number(selectedSchoolId));
  }, [schools, selectedSchoolId]);

  // Existing score record for selected team
  const existingScoreRecord = useMemo(() => {
    if (!selectedSchoolId || !assignedComp) return null;
    return scores.find((s) => {
      if (s.schoolId === Number(selectedSchoolId) && s.teamCategory === selectedCategory && s.competitionId === assignedComp.id) {
        if (assignedSubPost) return s.subPostId === assignedSubPost.id;
        return !s.subPostId;
      }
      return false;
    });
  }, [scores, selectedSchoolId, selectedCategory, assignedComp, assignedSubPost]);

  // When selected team changes, pre-fill score if editing existing
  useEffect(() => {
    if (existingScoreRecord) {
      setScoreInput(String(existingScoreRecord.score));
      setNotesInput(existingScoreRecord.notes || '');
      if (competitionHasTime) {
        setCapturedTimeMs(existingScoreRecord.timeInMs);
        setCapturedTimeFormatted(existingScoreRecord.timeFormatted);
      } else {
        setCapturedTimeMs(0);
        setCapturedTimeFormatted('00:00:000');
      }
    } else {
      setScoreInput('');
      setNotesInput('');
      setCapturedTimeMs(0);
      setCapturedTimeFormatted('00:00:000');
    }
  }, [existingScoreRecord, selectedSchoolId, selectedCategory, competitionHasTime]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSelectSchool = (schoolId: number | '') => {
    setSelectedSchoolId(schoolId);
    if (schoolId !== '') {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth' });
        scoreInputRef.current?.focus();
      }, 100);
    }
  };

  const handleTimeCaptured = (timeInMs: number, timeFormatted: string) => {
    if (competitionHasTime) {
      setCapturedTimeMs(timeInMs);
      setCapturedTimeFormatted(timeFormatted);
    } else {
      setCapturedTimeMs(0);
      setCapturedTimeFormatted('00:00:000');
    }
  };

  const handleClearTimeOnly = async () => {
    if (!existingScoreRecord) return;
    if (!confirm(`Clear / Hapus catatan waktu untuk ${selectedSchool?.name}? Waktu akan di-reset menjadi 00:00:000.`)) return;

    setIsSubmitting(true);
    try {
      await ApiService.submitScore({
        schoolId: Number(selectedSchoolId),
        teamCategory: selectedCategory,
        competitionId: assignedComp.id,
        subPostId: assignedSubPost?.id,
        score: existingScoreRecord.score,
        timeInMs: 0,
        timeFormatted: '00:00:000',
        judgeId: currentJudge.id,
        judgeName: currentJudge.name,
        posName: posTitle,
      });

      setCapturedTimeMs(0);
      setCapturedTimeFormatted('00:00:000');
      showToast(`Catatan waktu ${selectedSchool?.name} berhasil dihapus/direset menjadi 00:00:000.`, 'success');
      onScoreSaved();
    } catch (err: any) {
      showToast(err.message || 'Gagal mereset waktu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScoreRecord = async () => {
    if (!existingScoreRecord) return;
    if (!confirm(`Hapus SELURUH nilai & waktu untuk ${selectedSchool?.name}?`)) return;

    setIsSubmitting(true);
    try {
      await ApiService.deleteScore(existingScoreRecord.id);
      showToast(`Nilai ${selectedSchool?.name} berhasil dihapus.`, 'success');
      setSelectedSchoolId('');
      setScoreInput('');
      setCapturedTimeMs(0);
      setCapturedTimeFormatted('00:00:000');
      onScoreSaved();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus nilai', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSchoolId) {
      showToast('Pilih pangkalan terlebih dahulu!', 'error');
      return;
    }

    if (scoreInput === '' || scoreInput === null || scoreInput === undefined) {
      showToast('Nilai wajib diisi!', 'error');
      return;
    }

    const numScore = Number(scoreInput);
    const minVal = assignedComp?.minScore ?? settings.defaultMinScore;
    const maxVal = assignedComp?.maxScore ?? settings.defaultMaxScore;

    if (isNaN(numScore) || numScore < minVal || numScore > maxVal) {
      showToast(`Nilai harus berupa angka rentang ${minVal} - ${maxVal}`, 'error');
      return;
    }

    if (competitionHasTime && capturedTimeMs <= 0) {
      showToast('Waktu lomba wajib diisi! Silakan catat waktu menggunakan Stopwatch atau Ketik Cepat Waktu (misal: 6.30).', 'error');
      return;
    }

    const timeMsToSave = competitionHasTime ? capturedTimeMs : 0;
    const timeFormattedToSave = competitionHasTime ? capturedTimeFormatted : '00:00:000';

    setIsSubmitting(true);
    try {
      const result = await ApiService.submitScore({
        schoolId: Number(selectedSchoolId),
        teamCategory: selectedCategory,
        competitionId: assignedComp.id,
        subPostId: assignedSubPost?.id,
        score: numScore,
        timeInMs: timeMsToSave,
        timeFormatted: timeFormattedToSave,
        notes: notesInput.trim(),
        judgeId: currentJudge.id,
        judgeName: currentJudge.name,
        posName: posTitle,
      });

      if (result.isOffline) {
        showToast(result.message, 'info');
      } else {
        showToast(`Berhasil menyimpan nilai ${selectedSchool?.name} (${selectedCategory}): ${numScore}`, 'success');
      }

      // AUTO CLEAR form for next entry
      setSelectedSchoolId('');
      setSearchQuery('');
      setScoreInput('');
      setNotesInput('');
      setCapturedTimeMs(0);
      setCapturedTimeFormatted('00:00:000');

      onScoreSaved();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan nilai', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSchoolsForCategory = useMemo(() => {
    return schools.filter((s) => (selectedCategory === 'PUTRA' ? s.hasPutra : s.hasPutri)).length;
  }, [schools, selectedCategory]);

  const scoredCount = useMemo(() => {
    return Object.keys(scoredSchoolMap).length;
  }, [scoredSchoolMap]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-20 space-y-5">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-blue-800/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/30">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                PORTAL PENILAIAN JURI
              </div>
              <a
                href="https://wa.me/6289625029588"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-400/40 transition-colors"
                title="Hubungi Admin Helpdesk WhatsApp"
              >
                <span>💬 Helpdesk WA: 089625029588</span>
              </a>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{posTitle}</h1>
            <p className="text-blue-200 text-xs sm:text-sm mt-0.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-sky-300" />
              Juri: <span className="font-semibold text-white">{currentJudge.name}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-blue-200 font-medium">
              {timeNow.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <div className="text-lg font-mono font-bold text-amber-300 tracking-wider mt-0.5">
              {timeNow.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl text-sm font-medium shadow-md flex items-center gap-2 transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : toastMessage.type === 'error'
              ? 'bg-rose-100 text-rose-900 border border-rose-300'
              : 'bg-amber-100 text-amber-900 border border-amber-300'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          {toastMessage.type === 'info' && <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 animate-spin" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Category Lock Status */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            {isJudgeRole && <Lock className="w-4 h-4 text-amber-600" />}
            <span>Kategori Regu Penilaian Juri</span>
          </label>
          <span className="text-[11px] font-bold text-slate-500">
            Progres: <strong className="text-emerald-700">{scoredCount}</strong> / {totalSchoolsForCategory} Dinilai
          </span>
        </div>

        {isJudgeRole ? (
          <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedCategory === 'PUTRA' ? '👦' : '👧'}</span>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regu Terkunci Untuk Juri Ini</div>
                <div className="text-base font-black text-amber-300">
                  REGU {selectedCategory === 'PUTRA' ? 'PUTRA (PA)' : 'PUTRI (PI)'}
                </div>
              </div>
            </div>
            <div className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-extrabold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Khusus {selectedCategory === 'PUTRA' ? 'Putra' : 'Putri'}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedCategory('PUTRA')}
              className={`py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                selectedCategory === 'PUTRA'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.01]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg">👦</span>
              <span>REGU PUTRA (PA)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('PUTRI')}
              className={`py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                selectedCategory === 'PUTRI'
                  ? 'bg-pink-600 text-white border-pink-600 shadow-md scale-[1.01]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg">👧</span>
              <span>REGU PUTRI (PI)</span>
            </button>
          </div>
        )}

        {/* Sub-Pos Selector for Penjelajahan */}
        {assignedComp?.isExploration && assignedComp.subPosts && assignedComp.subPosts.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <label className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>Pilih Sub-Pos Penjelajahan ({assignedComp.subPosts.length} Pos Tersedia)</span>
            </label>
            <select
              value={assignedSubPost?.id || ''}
              onChange={(e) => {
                setSelectedSubPostId(e.target.value);
                setSelectedSchoolId('');
                setScoreInput('');
                setCapturedTimeMs(0);
                setCapturedTimeFormatted('00:00:000');
              }}
              className="w-full px-3.5 py-2.5 text-xs font-extrabold text-amber-950 bg-amber-50/80 border-2 border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer shadow-2xs"
            >
              {assignedComp.subPosts.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} (Rentang Nilai: {sp.minScore ?? assignedComp.minScore} - {sp.maxScore ?? assignedComp.maxScore}) {sp.hasTime ? '⏱' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SECTION: PEMILIHAN NAMA PANGKALAN */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Pilih Nama Pangkalan / Sekolah ({filteredSchools.length} Tampil)</span>
          </label>
          <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
            Regu {selectedCategory}
          </span>
        </div>

        {/* 2. QUICK STATUS FILTERS & SEARCH */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({totalSchoolsForCategory})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNSCORED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'UNSCORED' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Belum ({totalSchoolsForCategory - scoredCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SCORED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'SCORED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sudah ({scoredCount})
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / #nomor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Selected School Status Banner */}
        {selectedSchool ? (
          <div className="p-3 bg-blue-900 text-white border-2 border-blue-600 rounded-xl flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                #{String(selectedSchool.id).padStart(2, '0')}
              </span>
              <span className="text-sm font-black">{selectedSchool.name}</span>
            </div>
            <span className="text-xs font-bold text-emerald-300 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-800">
              ✓ Terpilih (Regu {selectedCategory})
            </span>
          </div>
        ) : (
          <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold text-center">
            Pilih pangkalan di atas atau klik tombol pangkalan di bawah untuk mulai menginput nilai
          </div>
        )}

        {/* 3. VISUAL CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1 max-h-[500px] overflow-y-auto p-1 border border-slate-100 rounded-xl">
          {filteredSchools.map((school) => {
            const isSelected = selectedSchoolId === school.id;
            const info = scoredSchoolMap[school.id];
            const hasScore = info !== undefined;

            return (
              <button
                key={school.id}
                type="button"
                onClick={() => handleSelectSchool(school.id)}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-900 text-white border-blue-900 shadow-md ring-2 ring-blue-500 scale-[1.01]'
                    : hasScore
                    ? 'bg-emerald-50/90 text-slate-900 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : hasScore
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-800'
                    }`}>
                      #{String(school.id).padStart(2, '0')}
                    </span>
                    <span className={`text-xs font-extrabold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {school.name}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  {hasScore && !isSelected && (
                    <span className="text-[11px] font-black text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-emerald-300">
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{info.score}</span>
                    </span>
                  )}
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scoring Card Form */}
      <form ref={formRef} onSubmit={handleSaveScore} className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-5">
        
        {/* Existing Score Edit Warning Notice + Admin Action Controls */}
        {existingScoreRecord && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-950 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pangkalan ini sudah memiliki nilai recorded: <strong className="text-amber-900 text-sm font-black">{existingScoreRecord.score}</strong> {existingScoreRecord.timeFormatted !== '00:00:000' && `(Waktu: ${existingScoreRecord.timeFormatted})`}</span>
              </div>
            </div>

            {/* Quick action buttons for Admin/Juri to reset time or delete score record */}
            <div className="flex items-center gap-2 pt-1 border-t border-amber-200 flex-wrap">
              {existingScoreRecord.timeInMs > 0 && (
                <button
                  type="button"
                  onClick={handleClearTimeOnly}
                  className="px-3 py-1.5 bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-200 rounded-lg font-extrabold flex items-center gap-1 text-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-700" />
                  <span>Hapus / Reset Waktu (Ke 00:00)</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteScoreRecord}
                className="px-3 py-1.5 bg-rose-100 text-rose-900 border border-rose-300 hover:bg-rose-200 rounded-lg font-extrabold flex items-center gap-1 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                <span>Hapus Data Nilai Ini</span>
              </button>
            </div>
          </div>
        )}

        {/* 1. Score Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Nilai Perolehan ({assignedComp?.minScore ?? settings.defaultMinScore} - {assignedComp?.maxScore ?? settings.defaultMaxScore})
          </label>
          <div className="relative">
            <input
              ref={scoreInputRef}
              type="number"
              min={assignedComp?.minScore ?? settings.defaultMinScore}
              max={assignedComp?.maxScore ?? settings.defaultMaxScore}
              step="any"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              placeholder="Masukkan nilai angka (Cth: 85)"
              className="w-full px-4 py-3 text-2xl font-black text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white focus:outline-none"
              required
            />
          </div>
        </div>

        {/* 2. Stopwatch Component or No-Time Indicator */}
        {competitionHasTime ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Pencatat Waktu Lomba (Stopwatch / Input Manual) <span className="text-rose-600 font-black">*WAJIB DIISI</span>
              </label>
              {capturedTimeMs > 0 ? (
                <span className="text-emerald-700 font-extrabold text-[11px] bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                  ✓ Waktu Terisi: {capturedTimeFormatted}
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold text-[11px] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                  ⚠️ Belum Diisi
                </span>
              )}
            </div>
            <Stopwatch key={`${selectedSchoolId || 'none'}_${selectedCategory}`} onTimeCaptured={handleTimeCaptured} initialTimeMs={capturedTimeMs} />
            {capturedTimeMs > 0 ? (
              <div className="mt-2 text-xs text-emerald-800 font-medium flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Waktu Terekam: <strong className="font-mono text-emerald-950 font-black text-sm">{capturedTimeFormatted}</strong> ({capturedTimeMs} ms)</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-rose-700 font-bold flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Waktu lomba wajib diisi! Gunakan Stopwatch atau Ketik Cepat Waktu di atas (contoh ketik <code className="font-mono text-rose-950 bg-white px-1.5 py-0.5 rounded border border-rose-300 font-black">6.30</code>).</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <TimerOff className="w-4 h-4 text-slate-500" />
              <span>Pencatat Waktu Lomba</span>
            </label>
            <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TimerOff className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Perlombaan ini diatur <strong>TANPA catatan waktu</strong> (Fitur waktu nonaktif/dihapus untuk lomba ini).</span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg shrink-0">00:00:000</span>
            </div>
          </div>
        )}

        {/* 3. Catatan / Keterangan Juri (Opsional) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Catatan / Keterangan Juri (Opsional)</span>
          </label>
          <textarea
            rows={2}
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Contoh: Pengurangan nilai 5 poin karena simpul kurang kencang, keterlambatan, dll."
            className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none placeholder:text-slate-400 resize-y"
          />
        </div>

        {/* 4. Tombol Simpan */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !selectedSchoolId}
            className={`w-full py-4 px-6 rounded-xl font-black text-lg text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              !selectedSchoolId
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] shadow-emerald-900/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>MENYIMPAN NILAI...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>SIMPAN NILAI {competitionHasTime ? '& WAKTU' : ''}</span>
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-slate-500 mt-2">
            Setelah tombol SIMPAN ditekan, form otomatis dikosongkan untuk pangkalan berikutnya.
          </p>
        </div>
      </form>
    </div>
  );
};
