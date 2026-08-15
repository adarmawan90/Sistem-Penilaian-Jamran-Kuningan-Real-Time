import React, { useState, useRef } from 'react';
import { Judge, Competition, TeamCategory } from '../types';
import { ApiService } from '../services/apiService';
import { JudgeCardsModal } from './JudgeCardsModal';
import * as XLSX from 'xlsx';
import { Shield, Plus, Edit2, Trash2, Key, CheckCircle2, XCircle, Eye, EyeOff, Download, Upload, FileSpreadsheet, Users, Printer, UserX } from 'lucide-react';

interface MasterJudgesProps {
  judges: Judge[];
  competitions: Competition[];
  onRefresh: () => void;
}

export const MasterJudges: React.FC<MasterJudgesProps> = ({ judges, competitions, onRefresh }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [cardsModalOpen, setCardsModalOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Partial<Judge> | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'JUDGE'>('JUDGE');
  const [assignedCompId, setAssignedCompId] = useState('');
  const [assignedSubPostId, setAssignedSubPostId] = useState('');
  const [assignedCategory, setAssignedCategory] = useState<TeamCategory | 'ALL'>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [deletingJudge, setDeletingJudge] = useState<Judge | null>(null);
  const [isConfirmDeleteAllOpen, setIsConfirmDeleteAllOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedComp = competitions.find((c) => c.id === assignedCompId);

  const handleOpenAdd = () => {
    setEditingJudge(null);
    setUsername('');
    setPassword('juri123');
    setName('');
    setRole('JUDGE');
    setAssignedCompId(competitions[0]?.id || '');
    setAssignedSubPostId('');
    setAssignedCategory('ALL');
    setModalOpen(true);
  };

  const handleOpenEdit = (j: Judge) => {
    if (!j) return;
    setEditingJudge(j);
    setUsername(j.username || '');
    setPassword(j.password || (j.role === 'ADMIN' ? 'admin123' : 'juri123'));
    setName(j.name || '');
    setRole(j.role || 'JUDGE');
    setAssignedCompId(j.assignedCompetitionId || '');
    setAssignedSubPostId(j.assignedSubPostId || '');
    setAssignedCategory(j.assignedCategory || 'ALL');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim()) return;

    setIsSaving(true);
    try {
      await ApiService.saveJudge({
        id: editingJudge?.id,
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        role,
        assignedCompetitionId: role === 'JUDGE' ? assignedCompId : '',
        assignedSubPostId: role === 'JUDGE' ? assignedSubPostId : '',
        assignedCategory: role === 'JUDGE' ? assignedCategory : 'ALL',
        isActive: editingJudge?.isActive ?? true,
      });
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data juri');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (j: Judge) => {
    try {
      await ApiService.saveJudge({
        ...j,
        isActive: !j.isActive,
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal merubah status juri');
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!deletingJudge) return;
    setIsDeleting(true);
    try {
      await ApiService.deleteJudge(deletingJudge.id);
      setDeletingJudge(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus juri');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await ApiService.deleteAllNonAdminJudges();
      setIsConfirmDeleteAllOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus akun juri');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleShowPassword = (judgeId: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [judgeId]: !prev[judgeId] }));
  };

  // 1. Download Template Excel Juri
  const handleDownloadTemplate = () => {
    const headers = ['Nama Juri', 'Username', 'Password', 'Pos Lomba', 'Kategori Regu (Putra/Putri)'];
    
    // Sample rows for admin guidance
    const sampleRows = [
      ['Kak Budi Santoso', 'juri_tenda', 'juri123', 'Tenda Asri', 'Putra'],
      ['Kak Ani Rahmawati', 'juri_ppgd', 'juri123', 'PPGD', 'Putri'],
      ['Kak Agus Setiawan', 'juri_pos1', 'juri123', 'Penjelajahan - Pos 1 Sandi & Semaphore', 'Putra'],
      ['Kak Maya Indah', 'juri_sketsa', 'juri123', 'Sketsa Panorama', 'Semua'],
    ];

    // Reference List Sheet (Acuan Seluruh Pos Lomba)
    const refHeaders = ['Nama Pos Lomba', 'Tipe Pos', 'Contoh Isian di Excel'];
    const refRows: any[] = [];

    competitions.forEach((c) => {
      if (c.isExploration && c.subPosts && c.subPosts.length > 0) {
        c.subPosts.forEach((sp) => {
          refRows.push([`${c.name} - ${sp.name}`, 'Sub-Pos Penjelajahan', `${c.name} - ${sp.name}`]);
        });
      } else {
        refRows.push([c.name, 'Pos Lomba Utama', c.name]);
      }
    });

    const wsData = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wsRef = XLSX.utils.aoa_to_sheet([refHeaders, ...refRows]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, 'Data_Juri');
    XLSX.utils.book_append_sheet(wb, wsRef, 'Daftar_Pos_Acuan');

    XLSX.writeFile(wb, `Template_Import_Data_Juri_${Date.now()}.xlsx`);
  };

  // 2. Upload Excel Juri
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Membaca dan memproses file Excel...');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length <= 1) {
        throw new Error('File Excel tidak berisi data juri.');
      }

      // First row is headers
      const dataRows = jsonRows.slice(1);
      const parsedJudges: Partial<Judge>[] = [];

      dataRows.forEach((row, idx) => {
        const rawName = String(row[0] || '').trim();
        const rawUsername = String(row[1] || '').trim();
        const rawPassword = String(row[2] || 'juri123').trim();
        const rawPos = String(row[3] || '').trim();
        const rawCategory = String(row[4] || '').trim().toUpperCase();

        if (rawName && rawUsername) {
          // Match Pos Lomba to competition or sub-post
          let matchedCompId = '';
          let matchedSubPostId = '';

          if (rawPos) {
            // Check sub-posts first
            let foundSub = false;
            competitions.forEach((c) => {
              if (c.subPosts) {
                c.subPosts.forEach((sp) => {
                  const fullSubName = `${c.name} - ${sp.name}`.toLowerCase();
                  if (
                    rawPos.toLowerCase() === fullSubName ||
                    rawPos.toLowerCase() === sp.name.toLowerCase() ||
                    fullSubName.includes(rawPos.toLowerCase())
                  ) {
                    matchedCompId = c.id;
                    matchedSubPostId = sp.id;
                    foundSub = true;
                  }
                });
              }
            });

            if (!foundSub) {
              // Match main competition
              const comp = competitions.find(
                (c) =>
                  c.name.toLowerCase() === rawPos.toLowerCase() ||
                  c.name.toLowerCase().includes(rawPos.toLowerCase()) ||
                  rawPos.toLowerCase().includes(c.name.toLowerCase())
              );
              if (comp) {
                matchedCompId = comp.id;
              }
            }
          }

          // Category Regu
          let parsedCat: TeamCategory | 'ALL' = 'ALL';
          if (rawCategory.includes('PUTRA') || rawCategory === 'PA') {
            parsedCat = 'PUTRA';
          } else if (rawCategory.includes('PUTRI') || rawCategory === 'PI') {
            parsedCat = 'PUTRI';
          }

          parsedJudges.push({
            name: rawName,
            username: rawUsername,
            password: rawPassword,
            role: 'JUDGE',
            assignedCompetitionId: matchedCompId || competitions[0]?.id || '',
            assignedSubPostId: matchedSubPostId,
            assignedCategory: parsedCat,
            isActive: true,
          });
        }
      });

      if (parsedJudges.length === 0) {
        throw new Error('Tidak ditemukan baris data juri valid di file Excel.');
      }

      setUploadStatus(`Mengunggah ${parsedJudges.length} akun juri ke database...`);
      const res = await ApiService.saveJudgesBatch(parsedJudges);

      setUploadStatus(`Berhasil mengimpor ${res.count || parsedJudges.length} data juri!`);
      setTimeout(() => {
        setUploadStatus('');
      }, 4000);

      onRefresh();
    } catch (err: any) {
      alert(`Gagal mengimpor file Excel: ${err.message || err}`);
      setUploadStatus('');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Master Data Juri & Akun Login
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola username, password, role akses, penugasan pos lomba, dan Kategori Regu (Putra/Putri).
          </p>
        </div>

        {/* Action Buttons: Print PDF, Add, Download Template, Upload Excel, Clear All */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCardsModalOpen(true)}
            className="px-3.5 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            title="Cetak & Download Kartu Login Juri dalam Format PDF"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>CETAK KARTU JURI (PDF)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            title="Download Template Format Excel Juri"
          >
            <Download className="w-4 h-4" />
            <span>TEMPLATE EXCEL</span>
          </button>

          <label className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all inline-flex">
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'PROSES...' : 'UPLOAD EXCEL JURI'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>TAMBAH AKUN MANUAL</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmDeleteAllOpen(true)}
            className="px-3 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-rose-300 cursor-pointer transition-all"
            title="Hapus Seluruh Akun Juri Non-Admin"
          >
            <UserX className="w-4 h-4 text-rose-600" />
            <span>HAPUS SEMUA JURI</span>
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div className="p-3.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{uploadStatus}</span>
          </div>
        </div>
      )}

      {/* Online Judges Monitoring Banner */}
      {(() => {
        const now = Date.now();
        const activeOnline = judges.filter((j) => j.lastActive && (now - new Date(j.lastActive).getTime() < 60000));
        return (
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h3 className="text-sm font-black text-white tracking-tight uppercase">
                  MONITOR JURI ONLINE (REAL-TIME)
                </h3>
              </div>
              <div className="text-xs font-bold text-slate-300">
                <span className="text-emerald-400 font-extrabold text-sm mr-1">{activeOnline.length}</span>
                dari <span className="text-slate-100">{judges.length}</span> Akun Juri Sedang Aktif / Online
              </div>
            </div>

            {activeOnline.length === 0 ? (
              <div className="text-xs text-slate-400 py-1 font-medium italic">
                Belum ada juri yang terdeteksi online saat ini (Juri akan muncul otomatis ketika login/membuka sistem).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                {activeOnline.map((j) => {
                  const comp = competitions.find((c) => c.id === j.assignedCompetitionId);
                  let posName = comp?.name || 'Akses Sistem Utama';
                  if (comp?.isExploration && comp.subPosts && j.assignedSubPostId) {
                    const sub = comp.subPosts.find((sp) => sp.id === j.assignedSubPostId);
                    if (sub) posName = `${comp.name} - ${sub.name}`;
                  }
                  const secAgo = Math.floor((now - new Date(j.lastActive!).getTime()) / 1000);
                  const timeText = secAgo < 10 ? 'Baru saja' : `${secAgo} dtk lalu`;

                  return (
                    <div
                      key={j.id}
                      className="bg-slate-800/90 border border-slate-700 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold text-white truncate flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span>{j.name}</span>
                        </div>
                        <div className="text-[10px] text-amber-300 font-medium truncate mt-0.5">
                          {posName} ({j.assignedCategory || 'ALL'})
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded shrink-0 border border-slate-700">
                        {timeText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Judges Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Juri</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Password</th>
                <th className="py-3.5 px-4">Role Akses</th>
                <th className="py-3.5 px-4">Penugasan Pos</th>
                <th className="py-3.5 px-4">Regu Penugasan</th>
                <th className="py-3.5 px-4 text-center">Online</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {(judges || []).map((j) => {
                if (!j) return null;
                const comp = (competitions || []).find((c) => c && c.id === j.assignedCompetitionId);
                let posName = comp?.name || 'Seluruh Akses System';
                if (comp?.isExploration && comp.subPosts && j.assignedSubPostId) {
                  const sub = comp.subPosts.find((sp) => sp && sp.id === j.assignedSubPostId);
                  if (sub) posName = `${comp.name} - ${sub.name}`;
                }

                const pwd = j.password || (j.role === 'ADMIN' ? 'admin123' : 'juri123');
                const isPasswordVisible = !!showPasswordMap[j.id];
                const isOnline = j.lastActive && (Date.now() - new Date(j.lastActive).getTime() < 60000);

                return (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-slate-900">{j.name || '-'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 bg-slate-50 rounded">
                      <span className="font-bold text-blue-900">{j.username || '-'}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-200">
                          {isPasswordVisible ? pwd : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleShowPassword(j.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          title={isPasswordVisible ? 'Sembunyikan' : 'Tampilkan'}
                        >
                          {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {j.role === 'ADMIN' ? (
                        <span className="bg-indigo-100 text-indigo-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                          ADMINISTRATOR
                        </span>
                      ) : (
                        <span className="bg-sky-100 text-sky-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-sky-200">
                          JURI POS
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-900 text-xs">{posName}</td>
                    <td className="py-3 px-4">
                      {j.assignedCategory === 'PUTRA' ? (
                        <span className="bg-blue-100 text-blue-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-300">
                          👦 PUTRA
                        </span>
                      ) : j.assignedCategory === 'PUTRI' ? (
                        <span className="bg-pink-100 text-pink-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-pink-300">
                          👧 PUTRI
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-300">
                          👦👧 BEBAS/SEMUA
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isOnline ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5 border border-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          ONLINE
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full font-bold text-[11px] inline-flex items-center gap-1.5 border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                          OFFLINE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(j)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 transition-all cursor-pointer ${
                          j.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {j.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{j.isActive ? 'Aktif' : 'Nonaktif'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(j)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Username/Password/Penugasan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {j?.username !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => setDeletingJudge(j)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Juri"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit / Add Judge */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              <span>{editingJudge ? 'Edit Akun Juri' : 'Tambah Akun Juri Baru'}</span>
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Juri</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kak Budi (Juri Tenda Asri)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username Login</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="juri_tenda"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password Login</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="juri123"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Access</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                >
                  <option value="JUDGE">Juri Pos (Hanya bisa buka pos tugas)</option>
                  <option value="ADMIN">Administrator (Akses penuh seluruh system)</option>
                </select>
              </div>

              {role === 'JUDGE' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tugaskan ke Pos Lomba</label>
                    <select
                      value={assignedCompId}
                      onChange={(e) => {
                        setAssignedCompId(e.target.value);
                        setAssignedSubPostId('');
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                    >
                      {competitions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.isExploration ? '(Penjelajahan)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedComp?.isExploration && selectedComp.subPosts && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tugaskan Sub-Pos Penjelajahan</label>
                      <select
                        value={assignedSubPostId}
                        onChange={(e) => setAssignedSubPostId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                      >
                        <option value="">Semua Sub-Pos Penjelajahan</option>
                        {selectedComp.subPosts.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Regu Penugasan</label>
                    <select
                      value={assignedCategory}
                      onChange={(e) => setAssignedCategory(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                    >
                      <option value="ALL">👦👧 Semua / Bebas (Bisa Putra atau Putri)</option>
                      <option value="PUTRA">👦 Regu Putra (PA) Saja</option>
                      <option value="PUTRI">👧 Regu Putri (PI) Saja</option>
                    </select>
                  </div>
                </>
              )}

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
                  {isSaving ? 'Menyimpan...' : 'Simpan Akun Juri'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete Single Judge */}
      {deletingJudge && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus Akun Juri?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900">{deletingJudge?.name}</div>
              <div className="font-mono text-slate-600">Username: <span className="font-bold text-blue-900">{deletingJudge?.username}</span></div>
            </div>

            <p className="text-xs text-slate-600">
              Apakah Anda yakin ingin menghapus juri ini dari sistem?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingJudge(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Juri'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete ALL Non-Admin Judges */}
      {isConfirmDeleteAllOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Hapus SEMUA Akun Juri?</h3>
                <p className="text-xs text-rose-600 font-bold">PERINGATAN SANGAT PENTING!</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan menghapus <span className="font-bold text-slate-900">SELURUH akun juri (non-admin)</span> dari database. Akun administrator utama (<code className="bg-slate-100 px-1 py-0.5 rounded font-bold text-blue-900">admin</code>) tidak akan terhapus.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteAllOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Menghapus Semua...' : 'Ya, Hapus Seluruh Juri'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Kartu Login Juri (PDF) */}
      <JudgeCardsModal
        isOpen={cardsModalOpen}
        onClose={() => setCardsModalOpen(false)}
        judges={judges}
        competitions={competitions}
      />

    </div>
  );
};
