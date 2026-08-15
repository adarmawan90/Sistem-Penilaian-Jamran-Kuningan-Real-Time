import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { ApiService } from '../services/apiService';
import {
  Settings,
  Save,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Database,
  HelpCircle,
  Trash2,
  AlertTriangle,
  Lock,
  ShieldAlert,
  Key,
  FileSpreadsheet,
  Flame,
  Cloud,
  ExternalLink,
  Layers,
  Trophy,
  Globe,
  Copy,
  Check,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onRefresh: () => void;
  onOpenDocs: () => void;
  onOpenUploadModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onRefresh, onOpenDocs, onOpenUploadModal }) => {
  const [eventTitle, setEventTitle] = useState(settings.eventTitle);
  const [minScore, setMinScore] = useState(settings.defaultMinScore);
  const [maxScore, setMaxScore] = useState(settings.defaultMaxScore);
  const [autoSync, setAutoSync] = useState(settings.autoSyncIntervalSec);
  const [publicShowRekap, setPublicShowRekap] = useState(settings.publicShowRekap !== false);
  const [judgeShowRekap, setJudgeShowRekap] = useState(!!settings.judgeShowRekap);
  const [publicShowRanking, setPublicShowRanking] = useState(!!settings.publicShowRanking);
  const [publicShowMonitor, setPublicShowMonitor] = useState(!!settings.publicShowMonitor);
  const [rankingLimit, setRankingLimit] = useState<number>(settings.rankingLimit ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Firebase Status State
  const [fbStatus, setFbStatus] = useState<any>(null);
  const [isFbSyncing, setIsFbSyncing] = useState(false);
  const [isFbPulling, setIsFbPulling] = useState(false);

  // Clear All Scores State
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearErrorMsg, setClearErrorMsg] = useState('');
  const [copiedVercel, setCopiedVercel] = useState(false);

  const loadFbStatus = async () => {
    try {
      const data = await ApiService.getFirebaseStatus();
      setFbStatus(data);
    } catch {
      setFbStatus({ configured: false });
    }
  };

  useEffect(() => {
    loadFbStatus();
  }, []);

  const handleSyncToFirebase = async () => {
    setIsFbSyncing(true);
    try {
      const res = await ApiService.syncToFirebase();
      setMsg({ text: res.message || 'Data berhasil disinkronkan ke Google Firebase Firestore!', type: 'success' });
      await loadFbStatus();
      onRefresh();
    } catch (err: any) {
      setMsg({ text: err.message || 'Gagal sinkronisasi ke Firebase', type: 'error' });
    } finally {
      setIsFbSyncing(false);
    }
  };

  const handlePullFromFirebase = async () => {
    if (!confirm('Tarik data dari Google Firebase Firestore dan perbarui database lokal?')) return;
    setIsFbPulling(true);
    try {
      const res = await ApiService.pullFromFirebase();
      setMsg({ text: res.message || 'Berhasil memuat data dari Firebase Firestore!', type: 'success' });
      await loadFbStatus();
      onRefresh();
    } catch (err: any) {
      setMsg({ text: err.message || 'Gagal memuat data dari Firebase', type: 'error' });
    } finally {
      setIsFbPulling(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await ApiService.saveSettings({
        eventTitle: eventTitle.trim(),
        defaultMinScore: Number(minScore),
        defaultMaxScore: Number(maxScore),
        autoSyncIntervalSec: Number(autoSync),
        publicShowRekap,
        judgeShowRekap,
        publicShowRanking,
        publicShowMonitor,
        rankingLimit: Number(rankingLimit),
      });
      setMsg({ text: 'Pengaturan berhasil disimpan!', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setMsg({ text: err.message || 'Gagal menyimpan pengaturan', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = () => {
    window.location.href = '/api/backup/export';
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) return;
    if (!confirm('PERHATIAN: Pemulihan database akan menimpa data yang ada. Lanjutkan?')) return;

    setIsRestoring(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          await ApiService.restoreBackup(json);
          setMsg({ text: 'Database berhasil dipulihkan dari file backup!', type: 'success' });
          onRefresh();
        } catch (err: any) {
          setMsg({ text: 'File backup tidak valid', type: 'error' });
        } finally {
          setIsRestoring(false);
        }
      };
      reader.readAsText(restoreFile);
    } catch (err: any) {
      setMsg({ text: err.message || 'Gagal memulihkan backup', type: 'error' });
      setIsRestoring(false);
    }
  };

  const handleConfirmClearAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearPassword.trim()) {
      setClearErrorMsg('Silakan masukkan password konfirmasi!');
      return;
    }

    if (clearPassword.trim() !== 'alan_d19') {
      setClearErrorMsg('Password konfirmasi salah! Hapus semua nilai dibatalkan.');
      return;
    }

    setIsClearing(true);
    setClearErrorMsg('');
    try {
      const res = await ApiService.clearAllScores(clearPassword.trim());
      setMsg({ text: res.message || 'Seluruh data nilai berhasil dihapus dari sistem!', type: 'success' });
      setClearModalOpen(false);
      setClearPassword('');
      onRefresh();
    } catch (err: any) {
      setClearErrorMsg(err.message || 'Gagal menghapus data nilai. Pastikan password benar.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-700" />
            Pengaturan Sistem & Database
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur nama kegiatan, batas acuan nilai, backup, reset nilai, dan lihat dokumentasi teknis.
          </p>
        </div>

        <button
          onClick={onOpenDocs}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
          <span>DOKUMENTASI TEKNIS</span>
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-xs font-bold ${
            msg.type === 'success' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
          1. Identitas & Judul Kegiatan
        </h3>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Judul Kegiatan Lomba (Pengganti Placeholder [Judul Kegiatan])
          </label>
          <input
            type="text"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="Contoh: Lomba Tingkat III Penggalang Pramuka Kuningan 2026"
            className="w-full px-4 py-2.5 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Judul ini akan ditampilkan di seluruh header aplikasi, rekap, dan lembar ranking cetak.
          </p>
        </div>

        <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 pt-2">
          2. Batas Validasi Rentang Nilai Default
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nilai Minimum Default</label>
            <input
              type="number"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nilai Maksimum Default</label>
            <input
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Interval Sinkronisasi Otomatis Offline (Detik)</label>
          <input
            type="number"
            value={autoSync}
            onChange={(e) => setAutoSync(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
          />
        </div>

        <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 pt-2">
          3. Pengaturan Hak Akses Tampilan & Menu
        </h3>

        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl space-y-4">
          <p className="text-xs text-amber-950 font-bold">
            🔒 Atur visibilitas menu Rekap Nilai, Ranking, dan Status Pos untuk Akses Publik (pengunjung) serta Akun Juri:
          </p>

          <div className="space-y-3 pt-1">
            {/* Rekap Publik */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={publicShowRekap}
                onChange={(e) => setPublicShowRekap(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-black text-slate-900 block">Tampilkan Menu Rekap Nilai ke Akses Publik (Pengunjung)</span>
                <span className="text-[11px] text-slate-500 block">Jika dicentang, pengunjung tanpa login dapat melihat tabel rekapitulasi nilai seluruh pangkalan.</span>
              </div>
            </label>

            {/* Rekap Juri */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={judgeShowRekap}
                onChange={(e) => setJudgeShowRekap(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-black text-slate-900 block">Izinkan Juri Melihat Menu Rekap Nilai Semua Pos</span>
                <span className="text-[11px] text-slate-500 block">Secara default dinonaktifkan (Juri hanya melihat Daftar Nilai Pos miliknya). Aktifkan jika juri diizinkan memantau rekap pos lain.</span>
              </div>
            </label>

            {/* Ranking Publik */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={publicShowRanking}
                onChange={(e) => setPublicShowRanking(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-black text-slate-900 block">Tampilkan Menu Ranking ke Akses Publik</span>
                <span className="text-[11px] text-slate-500 block">Pengunjung tanpa login dapat melihat papan peringkat pangkalan & juara umum.</span>
              </div>
            </label>

            {/* Status Pos Publik */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={publicShowMonitor}
                onChange={(e) => setPublicShowMonitor(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-black text-slate-900 block">Tampilkan Menu Status Pos / Monitor ke Akses Publik</span>
                <span className="text-[11px] text-slate-500 block">Pengunjung tanpa login dapat melihat status input dan aktivitas pos lomba.</span>
              </div>
            </label>
          </div>
        </div>

        <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 pt-2 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span>4. Batas Tampilan Peringkat Ranking (Juara Umum & Pos)</span>
        </h3>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
          <div>
            <label className="block text-xs font-black text-slate-900 mb-1">
              Atur Mau Menampilkan Sampai Peringkat Berapa:
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Admin dapat menentukan batas peringkat yang ditampilkan pada tabel ranking (contoh: hanya menampilkan Juara 1-3, Top 5, Top 10, atau seluruh pangkalan).
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { val: 0, label: 'Semua (55 Pangkalan)' },
              { val: 3, label: '🏆 Top 3 (Podium Juara 1-3)' },
              { val: 5, label: 'Top 5' },
              { val: 6, label: '🎖️ Top 6 (Juara 1-3 & Harapan 1-3)' },
              { val: 10, label: 'Top 10 Besar' },
              { val: 20, label: 'Top 20' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setRankingLimit(opt.val)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  rankingLimit === opt.val
                    ? 'bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-400'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom Limit Input */}
          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Atau masukkan angka kustom:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Tampilkan Top</span>
              <input
                type="number"
                min="0"
                max="100"
                value={rankingLimit}
                onChange={(e) => setRankingLimit(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 px-3 py-1.5 text-xs font-mono font-black border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-center"
              />
              <span className="text-xs text-slate-500 font-semibold">Besar (0 = Tampilkan Semua)</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium flex items-center gap-2 mt-2">
            <span className="font-bold">Status Saat Ini:</span>
            {rankingLimit === 0 ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                Menampilkan Semua Pangkalan (Tanpa Batas Peringkat)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-bold text-[11px]">
                Hanya Menampilkan Sampai Peringkat Ke-{rankingLimit} (Top {rankingLimit})
              </span>
            )}
          </div>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>

      {/* Google Firebase Console & Cloud Firestore Card */}
      <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-600/10 p-6 rounded-2xl border border-amber-300 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Flame className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Database Google Firebase Console & Firestore</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Online Terhubung
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Penyimpanan cloud database terpusat real-time di Google Cloud Firebase Platform.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncToFirebase}
              disabled={isFbSyncing}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Cloud className={`w-4 h-4 ${isFbSyncing ? 'animate-spin' : ''}`} />
              <span>{isFbSyncing ? 'Menyinkronkan...' : 'Sinkronkan ke Cloud'}</span>
            </button>
            <button
              type="button"
              onClick={handlePullFromFirebase}
              disabled={isFbPulling}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFbPulling ? 'animate-spin' : ''}`} />
              <span>{isFbPulling ? 'Memuat...' : 'Tarik Cloud'}</span>
            </button>
          </div>
        </div>

        {/* Firebase Config & Stats Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 bg-white/80 rounded-xl border border-amber-200/80 space-y-1">
            <div className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">Project ID Firebase</div>
            <div className="font-mono font-bold text-slate-900 text-xs truncate">
              {fbStatus?.projectId || 'modified-circlet-f1ttq'}
            </div>
            <div className="text-[10px] text-slate-500">Google Cloud Applet Project</div>
          </div>

          <div className="p-3.5 bg-white/80 rounded-xl border border-amber-200/80 space-y-1">
            <div className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">Database Koleksi Firestore</div>
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>scores, schools, judges, logs</span>
            </div>
            <div className="text-[10px] text-slate-500">6 Koleksi Firestore Terintegrasi</div>
          </div>

          <div className="p-3.5 bg-white/80 rounded-xl border border-amber-200/80 space-y-1 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">Akses Console Firebase</div>
              <div className="text-[11px] text-slate-600">Buka panel web Firestore console</div>
            </div>
            <a
              href={`https://console.firebase.google.com/project/${fbStatus?.projectId || 'modified-circlet-f1ttq'}/firestore`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 underline mt-1"
            >
              <span>Buka Firebase Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Vercel Online Deployment Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 rounded-2xl border border-slate-700 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-slate-950 flex items-center justify-center font-black shadow-md">
              <Globe className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>Publikasi Online ke Vercel (.vercel.app)</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Siap Deploy
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Konfigurasi <code>vercel.json</code> dan Serverless API <code>/api</code> telah aktif & terkonfigurasi.
              </p>
            </div>
          </div>

          <a
            href="https://vercel.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all shrink-0 cursor-pointer"
          >
            <span>Buka Dashboard Vercel</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">1. Export / Push</span>
            <p className="text-slate-200 text-[11px] leading-relaxed">
              Export proyek ke <strong>GitHub</strong> via menu Settings AI Studio, atau upload file project.
            </p>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">2. Import di Vercel</span>
            <p className="text-slate-200 text-[11px] leading-relaxed">
              Pilih repository Anda. Framework preset: <strong>Vite</strong>, Build Command: <code>vite build</code>.
            </p>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">3. Database Firestore</span>
            <p className="text-slate-200 text-[11px] leading-relaxed">
              Semua nilai juri & master data langsung terhubung ke Google Cloud Firestore (<code>penilaianjamrankuningan</code>).
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="truncate font-mono text-[11px] text-slate-300">
            <span className="text-emerald-400 font-bold">CLI Deploy:</span> <code>npm install -g vercel && vercel --prod</code>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText('npm install -g vercel && vercel --prod');
              setCopiedVercel(true);
              setTimeout(() => setCopiedVercel(false), 2000);
            }}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
          >
            {copiedVercel ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedVercel ? 'Disalin!' : 'Salin Perintah'}</span>
          </button>
        </div>
      </div>

      {/* Backup & Restore Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" />
          Manajemen Data & Backup Database
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Upload Excel */}
          {onOpenUploadModal && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Impor Batch Nilai (Excel)</span>
                </h4>
                <p className="text-xs text-emerald-800 mt-1">Unduh format Excel resmi lalu upload untuk pengisian nilai massal otomatis.</p>
              </div>
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
              >
                <Upload className="w-4 h-4 text-amber-300" />
                <span>UPLOAD FILE EXCEL</span>
              </button>
            </div>
          )}

          {/* Export */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Export Backup JSON</h4>
              <p className="text-xs text-slate-500 mt-1">Unduh seluruh file backup data (Pangkalan, Juri, Pos, Nilai, Log).</p>
            </div>
            <button
              onClick={handleExportBackup}
              className="w-full py-2.5 px-4 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-300" />
              <span>UNDUH BACKUP DATABASE</span>
            </button>
          </div>

          {/* Restore */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Restore Database</h4>
              <input
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-900 hover:file:bg-blue-200 cursor-pointer mt-1"
              />
            </div>
            <button
              onClick={handleRestoreBackup}
              disabled={!restoreFile || isRestoring}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                !restoreFile || isRestoring
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? 'Memulihkan...' : 'PULIHKAN DARI FILE'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* DANGER ZONE: Hapus Semua Nilai */}
      <div className="bg-rose-50/80 p-6 rounded-2xl border-2 border-rose-200 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-rose-950 flex items-center gap-2 uppercase tracking-wider">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Zona Bahaya: Reset / Hapus Semua Nilai</span>
            </h3>
            <p className="text-xs text-rose-800 font-medium leading-relaxed">
              Tindakan ini akan <strong>menghapus seluruh rekaman nilai dan catatan waktu</strong> dari semua pangkalan peserta yang telah diinput juri. Data pangkalan, daftar juri, dan pos lomba tidak akan terhapus.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setClearPassword('');
              setClearErrorMsg('');
              setClearModalOpen(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 shrink-0 cursor-pointer transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>HAPUS SEMUA NILAI</span>
          </button>
        </div>
      </div>

      {/* MODAL KONFIRMASI HAPUS SEMUA NILAI WITH PASSWORD alan_d19 */}
      {clearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-5">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">PERINGATAN KERAS!</h3>
                <p className="text-xs text-rose-700 font-bold">Hapus Seluruh Data Nilai Sistem</p>
              </div>
            </div>

            {/* Warning Text */}
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900 font-medium">
              <p className="font-extrabold text-rose-950">
                ⚠️ PERHATIAN: Seluruh input nilai juri di semua pos lomba akan dihapus permanen dan tidak bisa dikembalikan!
              </p>
              <p className="text-[11px] text-rose-800">
                Untuk menyetujui penghapusan seluruh data nilai ini, Anda diwajibkan memasukkan password konfirmasi khusus keamanan admin.
              </p>
            </div>

            {clearErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold text-center">
                {clearErrorMsg}
              </div>
            )}

            {/* Form Confirmation Password */}
            <form onSubmit={handleConfirmClearAll} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-rose-600" />
                  <span>Masukkan Password Konfirmasi Keamanan:</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={clearPassword}
                    onChange={(e) => {
                      setClearPassword(e.target.value);
                      setClearErrorMsg('');
                    }}
                    placeholder="Masukkan password konfirmasi..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none font-mono"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClearModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isClearing || !clearPassword}
                  className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                    !clearPassword || isClearing
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isClearing ? 'Proses Menghapus...' : 'YA, HAPUS SEMUA NILAI'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
