import React, { useState } from 'react';
import { Competition, SubPost } from '../types';
import { ApiService } from '../services/apiService';
import { Trophy, Plus, Edit2, Trash2, CheckCircle2, XCircle, Clock, TimerOff, Layers } from 'lucide-react';

interface MasterCompetitionsProps {
  competitions: Competition[];
  onRefresh: () => void;
}

export const MasterCompetitions: React.FC<MasterCompetitionsProps> = ({ competitions, onRefresh }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<Partial<Competition> | null>(null);
  const [formName, setFormName] = useState('');
  const [formMinScore, setFormMinScore] = useState(0);
  const [formMaxScore, setFormMaxScore] = useState(100);
  const [formIsExploration, setFormIsExploration] = useState(false);
  const [formHasTime, setFormHasTime] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingComp, setDeletingComp] = useState<Competition | null>(null);
  const [deletingSubPost, setDeletingSubPost] = useState<{ comp: Competition; subId: string; subName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sub-Post Modal State
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [activeCompForSub, setActiveCompForSub] = useState<Competition | null>(null);
  const [editingSubPost, setEditingSubPost] = useState<SubPost | null>(null);
  const [subNameInput, setSubNameInput] = useState('');
  const [subHasTime, setSubHasTime] = useState(true);
  const [subMinScore, setSubMinScore] = useState(0);
  const [subMaxScore, setSubMaxScore] = useState(100);

  const handleOpenAdd = () => {
    setEditingComp(null);
    setFormName('');
    setFormMinScore(0);
    setFormMaxScore(100);
    setFormIsExploration(false);
    setFormHasTime(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (comp: Competition) => {
    setEditingComp(comp);
    setFormName(comp.name);
    setFormMinScore(comp.minScore);
    setFormMaxScore(comp.maxScore);
    setFormIsExploration(comp.isExploration);
    setFormHasTime(comp.hasTime !== false);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSaving(true);
    try {
      await ApiService.saveCompetition({
        id: editingComp?.id,
        name: formName.trim(),
        minScore: Number(formMinScore),
        maxScore: Number(formMaxScore),
        isExploration: formIsExploration,
        hasTime: formHasTime,
        active: editingComp?.active ?? true,
      });
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (comp: Competition) => {
    try {
      await ApiService.saveCompetition({
        ...comp,
        active: !comp.active,
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status');
    }
  };

  const handleToggleHasTime = async (comp: Competition) => {
    const currentHasTime = comp.hasTime !== false;
    const newStatus = !currentHasTime;
    const confirmMsg = newStatus
      ? `Aktifkan catatan waktu (Stopwatch) untuk lomba "${comp.name}"?`
      : `Nonaktifkan / Hapus fitur catatan waktu (Stopwatch) untuk lomba "${comp.name}"? (Juri tidak perlu mencatat waktu untuk lomba ini)`;

    if (!confirm(confirmMsg)) return;

    try {
      await ApiService.saveCompetition({
        ...comp,
        hasTime: newStatus,
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah setting waktu');
    }
  };

  const handleDelete = async (comp: Competition) => {
    setDeletingComp(comp);
  };

  const handleConfirmDeleteComp = async () => {
    if (!deletingComp) return;
    setIsDeleting(true);
    try {
      await ApiService.deleteCompetition(deletingComp.id);
      setDeletingComp(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sub-Post Handlers
  const handleOpenAddSubPost = (comp: Competition) => {
    setActiveCompForSub(comp);
    setEditingSubPost(null);
    setSubNameInput(`Pos ${(comp.subPosts?.length || 0) + 1} `);
    setSubHasTime(comp.hasTime !== false);
    setSubMinScore(comp.minScore || 0);
    setSubMaxScore(comp.maxScore || 100);
    setSubModalOpen(true);
  };

  const handleOpenEditSubPost = (comp: Competition, sub: SubPost) => {
    setActiveCompForSub(comp);
    setEditingSubPost(sub);
    setSubNameInput(sub.name);
    setSubHasTime(sub.hasTime !== undefined ? sub.hasTime : (comp.hasTime !== false));
    setSubMinScore(sub.minScore ?? comp.minScore ?? 0);
    setSubMaxScore(sub.maxScore ?? comp.maxScore ?? 100);
    setSubModalOpen(true);
  };

  const handleToggleSubPostHasTime = async (comp: Competition, sub: SubPost) => {
    const currentSubHasTime = sub.hasTime !== undefined ? sub.hasTime : (comp.hasTime !== false);
    const newStatus = !currentSubHasTime;

    try {
      const updatedSubPosts = (comp.subPosts || []).map((s) => {
        if (s.id === sub.id) {
          return { ...s, hasTime: newStatus };
        }
        return s;
      });

      await ApiService.saveCompetition({
        ...comp,
        subPosts: updatedSubPosts,
      });

      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status waktu sub-pos');
    }
  };

  const handleSaveSubPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompForSub || !subNameInput.trim()) return;

    setIsSaving(true);
    try {
      const currentSubPosts = [...(activeCompForSub.subPosts || [])];
      
      if (editingSubPost) {
        // Edit existing subpost
        const idx = currentSubPosts.findIndex((s) => s.id === editingSubPost.id);
        if (idx >= 0) {
          currentSubPosts[idx] = {
            ...currentSubPosts[idx],
            name: subNameInput.trim(),
            hasTime: subHasTime,
            minScore: Number(subMinScore),
            maxScore: Number(subMaxScore),
          };
        }
      } else {
        // Add new subpost
        const newSubPost: SubPost = {
          id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          competitionId: activeCompForSub.id,
          name: subNameInput.trim(),
          order: currentSubPosts.length + 1,
          minScore: Number(subMinScore),
          maxScore: Number(subMaxScore),
          hasTime: subHasTime,
        };
        currentSubPosts.push(newSubPost);
      }

      await ApiService.saveCompetition({
        ...activeCompForSub,
        subPosts: currentSubPosts,
      });

      setSubModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan sub-pos');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubPost = async (comp: Competition, subId: string, subName: string) => {
    setDeletingSubPost({ comp, subId, subName });
  };

  const handleConfirmDeleteSubPost = async () => {
    if (!deletingSubPost) return;
    setIsDeleting(true);
    try {
      const updatedSubPosts = (deletingSubPost.comp.subPosts || [])
        .filter((s) => s.id !== deletingSubPost.subId)
        .map((s, i) => ({ ...s, order: i + 1 }));

      await ApiService.saveCompetition({
        ...deletingSubPost.comp,
        subPosts: updatedSubPosts,
      });

      setDeletingSubPost(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus sub-pos');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Master Data Perlombaan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola mata perlombaan, pos penjelajahan, batas nilai, dan setting catatan waktu (Stopwatch).
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>TAMBAH PERLOMBAAN</span>
        </button>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {competitions.map((comp) => {
            const hasTime = comp.hasTime !== false;

            return (
              <div key={comp.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-slate-100 font-mono font-bold text-slate-700 text-xs flex items-center justify-center border border-slate-200">
                      #{comp.order}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-slate-900">{comp.name}</h3>
                        {comp.isExploration && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                            Penjelajahan ({comp.subPosts?.length || 0} Sub-Pos)
                          </span>
                        )}
                        {/* Time Feature Badge */}
                        {hasTime ? (
                          <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-600" />
                            Ada Catatan Waktu
                          </span>
                        ) : (
                          <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-300 flex items-center gap-1">
                            <TimerOff className="w-3 h-3 text-slate-500" />
                            Tanpa Waktu (Dihapus)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Rentang Nilai: {comp.minScore} - {comp.maxScore} • Catatan Waktu: <strong className={hasTime ? 'text-sky-700' : 'text-slate-500'}>{hasTime ? 'Diaktifkan' : 'Dinonaktifkan / Dihapus'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Toggle Time Button */}
                    <button
                      onClick={() => handleToggleHasTime(comp)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                        hasTime
                          ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                      title={hasTime ? 'Nonaktifkan/Hapus waktu untuk lomba ini' : 'Aktifkan catatan waktu'}
                    >
                      {hasTime ? <Clock className="w-3.5 h-3.5 text-sky-600" /> : <TimerOff className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{hasTime ? 'Waktu: ON' : 'Waktu: OFF'}</span>
                    </button>

                    {/* Toggle Active Button */}
                    <button
                      onClick={() => handleToggleActive(comp)}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        comp.active
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {comp.active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{comp.active ? 'Aktif' : 'Nonaktif'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(comp)}
                      className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingComp(comp)}
                      className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Render Sub-Posts for Penjelajahan */}
                {comp.isExploration && (
                  <div className="ml-0 sm:ml-11 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase tracking-wider">
                        <Layers className="w-4 h-4 text-amber-700" />
                        <span>Sub-Pos Penjelajahan ({comp.subPosts?.length || 0})</span>
                      </div>
                      <button
                        onClick={() => handleOpenAddSubPost(comp)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>TAMBAH SUB-POS</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {comp.subPosts && comp.subPosts.length > 0 ? (
                        comp.subPosts.map((sub) => {
                          const subHasTime = sub.hasTime !== undefined ? sub.hasTime : (comp.hasTime !== false);
                          return (
                            <div key={sub.id} className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs text-xs flex items-center justify-between gap-2">
                              <div className="truncate flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-slate-800 truncate">{sub.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">Pos #{sub.order}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    Nilai: {sub.minScore ?? comp.minScore} - {sub.maxScore ?? comp.maxScore}
                                  </span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${
                                    subHasTime ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                    {subHasTime ? <Clock className="w-2.5 h-2.5 text-sky-600" /> : <TimerOff className="w-2.5 h-2.5 text-slate-400" />}
                                    {subHasTime ? 'Waktu: ON' : 'Waktu: OFF'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubPostHasTime(comp, sub)}
                                  className={`p-1 rounded transition-colors cursor-pointer border ${
                                    subHasTime ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title={subHasTime ? 'Nonaktifkan Waktu untuk Sub-Pos ini' : 'Aktifkan Waktu untuk Sub-Pos ini'}
                                >
                                  {subHasTime ? <Clock className="w-3.5 h-3.5 text-sky-600" /> : <TimerOff className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSubPost(comp, sub)}
                                  className="p-1 rounded text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Edit Sub-Pos"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubPost(comp, sub.id, sub.name)}
                                  className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Hapus Sub-Pos"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full py-2 px-3 text-xs text-amber-800 font-medium italic">
                          Belum ada sub-pos. Klik tombol "+ TAMBAH SUB-POS" di atas untuk menambahkan.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              {editingComp ? 'Edit Perlombaan' : 'Tambah Perlombaan Baru'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Perlombaan</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Pionering"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nilai Min</label>
                  <input
                    type="number"
                    value={formMinScore}
                    onChange={(e) => setFormMinScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nilai Max</label>
                  <input
                    type="number"
                    value={formMaxScore}
                    onChange={(e) => setFormMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Setting Toggle Catatan Waktu (Stopwatch) */}
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasTime"
                    checked={formHasTime}
                    onChange={(e) => setFormHasTime(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="hasTime" className="text-xs font-black text-sky-950 cursor-pointer flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    <span>Gunakan Fitur Catatan Waktu (Stopwatch)</span>
                  </label>
                </div>
                <p className="text-[11px] text-sky-800 pl-6">
                  Jika di-uncheck (dihapus), juri tidak perlu mencatat waktu stopwatch saat menilai lomba ini.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isExploration"
                  checked={formIsExploration}
                  onChange={(e) => setFormIsExploration(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isExploration" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Kategori Penjelajahan (Memiliki Sub-Pos / Pos Berantai)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Sub-Pos Penjelajahan */}
      {subModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-600" />
              <span>{editingSubPost ? 'Edit Sub-Pos' : 'Tambah Sub-Pos Baru'}</span>
            </h3>

            <p className="text-xs text-slate-500">
              Kategori: <strong>{activeCompForSub?.name}</strong>
            </p>

            <form onSubmit={handleSaveSubPost} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Sub-Pos</label>
                <input
                  type="text"
                  value={subNameInput}
                  onChange={(e) => setSubNameInput(e.target.value)}
                  placeholder="Contoh: Pos 6 Sandi Morse & Semaphore"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nilai Min</label>
                  <input
                    type="number"
                    value={subMinScore}
                    onChange={(e) => setSubMinScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nilai Max</label>
                  <input
                    type="number"
                    value={subMaxScore}
                    onChange={(e) => setSubMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Setting Toggle Catatan Waktu (Stopwatch) untuk Sub-Pos */}
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="subHasTime"
                    checked={subHasTime}
                    onChange={(e) => setSubHasTime(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                  />
                  <label htmlFor="subHasTime" className="text-xs font-black text-sky-950 cursor-pointer flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    <span>Gunakan Fitur Catatan Waktu (Stopwatch)</span>
                  </label>
                </div>
                <p className="text-[11px] text-sky-800 pl-6">
                  Jika di-uncheck (dihapus/nonaktif), juri sub-pos ini tidak perlu mencatat waktu stopwatch saat menilai.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSubModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Sub-Pos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete Competition */}
      {deletingComp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus Mata Lomba?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-900">
              {deletingComp.name}
            </div>

            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus perlombaan ini dari master data?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingComp(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteComp}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Perlombaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete Sub-Post */}
      {deletingSubPost && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus Sub-Pos?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-900">
              {deletingSubPost.subName} ({deletingSubPost.comp.name})
            </div>

            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus sub-pos ini?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingSubPost(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubPost}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Sub-Pos'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
