import React, { useState } from 'react';
import { X, FileCode, Database, Cpu, Network, Terminal, CheckCircle2, BookOpen, GitBranch } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  const [docTab, setDocTab] = useState<'ERD' | 'FLOWCHART' | 'USECASE' | 'API' | 'INSTALL'>('ERD');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-950 text-white p-5 flex items-center justify-between border-b border-blue-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400 text-blue-950 font-black">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Dokumentasi Teknis & Diagram Sistem</h2>
              <p className="text-xs text-blue-300">ERD, System Architecture, Flowchart, API Specs, & Panduan Instalasi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-2 border-b border-slate-200 overflow-x-auto shrink-0 text-xs font-bold">
          <button
            onClick={() => setDocTab('ERD')}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              docTab === 'ERD' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-amber-500" />
            <span>Diagram ERD</span>
          </button>
          <button
            onClick={() => setDocTab('FLOWCHART')}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              docTab === 'FLOWCHART' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitBranch className="w-4 h-4 text-emerald-500" />
            <span>Alur System (Flowchart)</span>
          </button>
          <button
            onClick={() => setDocTab('USECASE')}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              docTab === 'USECASE' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4 text-sky-500" />
            <span>Diagram Use Case</span>
          </button>
          <button
            onClick={() => setDocTab('API')}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              docTab === 'API' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4 text-indigo-500" />
            <span>REST API Documentation</span>
          </button>
          <button
            onClick={() => setDocTab('INSTALL')}
            className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              docTab === 'INSTALL' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-500" />
            <span>Panduan Instalasi</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed">
          
          {docTab === 'ERD' && (
            <div className="space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-500" />
                Entity Relationship Diagram (ERD Relational Schema)
              </h3>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto space-y-3">
                <div>
                  <span className="text-amber-400 font-bold">[SCHOOLS (Pangkalan)]</span>
                  <br />
                  id (PK) | code | name | hasPutra | hasPutri
                </div>
                <div>
                  <span className="text-sky-400 font-bold">[COMPETITIONS (Perlombaan)]</span>
                  <br />
                  id (PK) | name | order | active | isExploration | minScore | maxScore
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">[SUB_POSTS (Pos Penjelajahan)]</span>
                  <br />
                  id (PK) | competitionId (FK) | name | order | minScore | maxScore
                </div>
                <div>
                  <span className="text-pink-400 font-bold">[JUDGES (User Juri)]</span>
                  <br />
                  id (PK) | username | name | role | assignedCompetitionId | assignedSubPostId | isActive
                </div>
                <div>
                  <span className="text-purple-400 font-bold">[SCORES (Nilai Lomba)]</span>
                  <br />
                  id (PK) | schoolId (FK) | teamCategory | competitionId (FK) | subPostId (FK) | score | timeInMs | timeFormatted | judgeId (FK) | timestamp
                </div>
                <div>
                  <span className="text-rose-400 font-bold">[ACTIVITY_LOGS (Audit Log)]</span>
                  <br />
                  id (PK) | timestamp | judgeName | posName | schoolName | teamCategory | oldScore | newScore | device | ip | actionType
                </div>
              </div>
            </div>
          )}

          {docTab === 'FLOWCHART' && (
            <div className="space-y-4">
              <h3 className="text-base font-black text-slate-900">Alur Kerja Penilaian Real-Time (Flowchart)</h3>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">1</div>
                  <div>
                    <strong className="text-slate-900">Login Juri / Admin:</strong> Juri masuk ke portal dan langsung diarahkan ke Pos Lomba yang ditugaskan.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">2</div>
                  <div>
                    <strong className="text-slate-900">Input Nilai & Stopwatch:</strong> Juri memilih Regu (Putra/Putri), memilih Pangkalan (55 sekolah), memasukkan Nilai, dan menekan Stopwatch (MM:SS:mmm).
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">3</div>
                  <div>
                    <strong className="text-slate-900">Simpan & Auto-Clear:</strong> Juri menekan tombol SIMPAN (Hijau). Form otomatis kosong dalam hitungan detik untuk pangkalan berikutnya.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">4</div>
                  <div>
                    <strong className="text-slate-900">Penanganan Offline:</strong> Jika sinyal internet terputus, data tersimpan di LocalStorage HP juri dan akan disinkron otomatis saat internet kembali.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">5</div>
                  <div>
                    <strong className="text-slate-900">Broadcasting SSE Real-Time:</strong> Server memancarkan sinyal SSE ke Dashboard Admin, Rekap, dan Ranking tanpa perlu refresh browser.
                  </div>
                </div>
              </div>
            </div>
          )}

          {docTab === 'USECASE' && (
            <div className="space-y-4">
              <h3 className="text-base font-black text-slate-900">Spesifikasi Diagram Use Case</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
                  <span className="font-extrabold text-blue-900">Actor: Juri Pos</span>
                  <ul className="list-disc pl-5 text-xs space-y-1 text-slate-700">
                    <li>Input nilai perolehan pangkalan</li>
                    <li>Menjalankan & menghentikan stopwatch presisi</li>
                    <li>Melihat riwayat nilai pos sendiri</li>
                    <li>Penyimpanan offline lokal jika sinyal drop</li>
                  </ul>
                </div>
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
                  <span className="font-extrabold text-indigo-900">Actor: Admin Utama</span>
                  <ul className="list-disc pl-5 text-xs space-y-1 text-slate-700">
                    <li>Kelola Master Data (55 Pangkalan, 11 Perlombaan)</li>
                    <li>Kelola Juri & Pembagian Pos</li>
                    <li>Monitor Progress Penilaian Real-Time</li>
                    <li>Melihat Rekap Putra, Putri, & Penjelajahan</li>
                    <li>Melihat Ranking dengan Tie-Breaker Rules</li>
                    <li>Export Excel, PDF, & Print Rekap/Ranking</li>
                    <li>Backup & Restore Database</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {docTab === 'API' && (
            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">REST API Endpoints</h3>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs space-y-2">
                <p><span className="text-emerald-400 font-bold">GET</span> /api/initial-data - Ambil data awal pangkalan, pos, juri, nilai</p>
                <p><span className="text-blue-400 font-bold">POST</span> /api/login - Otentikasi akun Juri / Admin</p>
                <p><span className="text-amber-400 font-bold">POST</span> /api/scores - Simpan / update nilai tunggal</p>
                <p><span className="text-purple-400 font-bold">POST</span> /api/scores/batch - Sinkronisasi offline batch scores</p>
                <p><span className="text-rose-400 font-bold">DELETE</span> /api/scores/:id - Hapus record nilai</p>
                <p><span className="text-sky-400 font-bold">GET</span> /api/realtime/stream - EventSource SSE Real-time live updates</p>
                <p><span className="text-amber-400 font-bold">GET</span> /api/backup/export - Export backup data JSON</p>
                <p><span className="text-emerald-400 font-bold">POST</span> /api/backup/restore - Restore backup data JSON</p>
              </div>
            </div>
          )}

          {docTab === 'INSTALL' && (
            <div className="space-y-4">
              <h3 className="text-base font-black text-slate-900">Panduan Instalasi & Deployment</h3>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs space-y-2">
                <p className="text-slate-400"># 1. Install dependencies</p>
                <p className="text-emerald-400">npm install</p>
                <p className="text-slate-400 mt-2"># 2. Jalankan Mode Development Server (Full Stack)</p>
                <p className="text-emerald-400">npm run dev</p>
                <p className="text-slate-400 mt-2"># 3. Build Production Bundle</p>
                <p className="text-emerald-400">npm run build</p>
                <p className="text-slate-400 mt-2"># 4. Start Production Server</p>
                <p className="text-emerald-400">npm run start</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
