import React, { useState, useMemo, useEffect } from 'react';
import { School, Competition, ScoreRecord } from '../types';
import { ApiService } from '../services/apiService';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { FileText, Download, Printer, Search, Upload, ExternalLink, RefreshCw, CheckCircle2, ShieldCheck, Filter, CheckSquare, Square, RotateCcw, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

interface RekapViewProps {
  schools: School[];
  competitions: Competition[];
  scores: ScoreRecord[];
  onOpenUploadModal?: () => void;
}

export const RekapView: React.FC<RekapViewProps> = ({ schools, competitions, scores, onOpenUploadModal }) => {
  const [activeSubTab, setActiveSubTab] = useState<'PUTRA' | 'PUTRI' | 'PENJELAJAHAN'>('PUTRA');
  const [search, setSearch] = useState('');

  // Penjelajahan competition object
  const penjelajahanComp = competitions.find((c) => c.isExploration) || competitions.find((c) => c.name.toLowerCase().includes('penjelajahan'));

  // Custom Pos Filter State (IDs of selected competitions or sub-posts)
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [selectedSubPostIds, setSelectedSubPostIds] = useState<string[]>([]);
  const [showPosFilter, setShowPosFilter] = useState(false);

  // Sync selected IDs when competitions or penjelajahanComp load
  useEffect(() => {
    if (competitions.length > 0) {
      setSelectedCompIds((prev) => {
        if (prev.length === 0) return competitions.map((c) => c.id);
        const valid = prev.filter((id) => competitions.some((c) => c.id === id));
        return valid.length > 0 ? valid : competitions.map((c) => c.id);
      });
    }
  }, [competitions]);

  useEffect(() => {
    if (penjelajahanComp?.subPosts) {
      const subIds = penjelajahanComp.subPosts.map((sp) => sp.id);
      setSelectedSubPostIds((prev) => {
        if (prev.length === 0) return subIds;
        const valid = prev.filter((id) => subIds.includes(id));
        return valid.length > 0 ? valid : subIds;
      });
    }
  }, [penjelajahanComp]);

  // Active items for current tab
  const isPenjelajahanTab = activeSubTab === 'PENJELAJAHAN';

  const availableItems = useMemo(() => {
    if (isPenjelajahanTab) {
      return penjelajahanComp?.subPosts || [];
    }
    return competitions;
  }, [isPenjelajahanTab, penjelajahanComp, competitions]);

  const selectedIds = useMemo(() => {
    if (isPenjelajahanTab) {
      return selectedSubPostIds;
    }
    return selectedCompIds;
  }, [isPenjelajahanTab, selectedSubPostIds, selectedCompIds]);

  const filteredSubPosts = useMemo(() => {
    return (penjelajahanComp?.subPosts || []).filter((sp) => selectedSubPostIds.includes(sp.id));
  }, [penjelajahanComp, selectedSubPostIds]);

  const filteredCompetitions = useMemo(() => {
    return competitions.filter((c) => selectedCompIds.includes(c.id));
  }, [competitions, selectedCompIds]);

  const handleSelectAllPos = () => {
    if (isPenjelajahanTab) {
      setSelectedSubPostIds((penjelajahanComp?.subPosts || []).map((sp) => sp.id));
    } else {
      setSelectedCompIds(competitions.map((c) => c.id));
    }
  };

  const handleDeselectAllPos = () => {
    if (isPenjelajahanTab) {
      setSelectedSubPostIds([]);
    } else {
      setSelectedCompIds([]);
    }
  };

  const handleTogglePosItem = (id: string) => {
    if (isPenjelajahanTab) {
      setSelectedSubPostIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedCompIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  // Google Sheets Live Sync State
  const [gsheetsInfo, setGsheetsInfo] = useState<{
    spreadsheetUrl: string;
    lastGoogleSync: string | null;
    isSyncing: boolean;
    syncSuccessMsg: string | null;
    error: string | null;
  }>({
    spreadsheetUrl: '',
    lastGoogleSync: null,
    isSyncing: false,
    syncSuccessMsg: null,
    error: null,
  });

  const fetchGSheetsStatus = async () => {
    try {
      const status = await ApiService.getGSheetsStatus();
      setGsheetsInfo((prev) => ({
        ...prev,
        spreadsheetUrl: status.spreadsheetUrl || '',
        lastGoogleSync: status.lastGoogleSync || null,
      }));
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchGSheetsStatus();

    const unsubscribe = ApiService.subscribeToRealtime((event, data) => {
      if (event === 'gsheets_synced') {
        setGsheetsInfo((prev) => ({
          ...prev,
          spreadsheetUrl: data.spreadsheetUrl || prev.spreadsheetUrl,
          lastGoogleSync: data.lastSyncTime || new Date().toISOString(),
          syncSuccessMsg: 'Laporan otomatis ter-update di Google Sheets!',
        }));
        setTimeout(() => {
          setGsheetsInfo((prev) => ({ ...prev, syncSuccessMsg: null }));
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualSyncGSheets = async () => {
    setGsheetsInfo((prev) => ({ ...prev, isSyncing: true, error: null, syncSuccessMsg: null }));
    try {
      const res = await ApiService.syncGSheets();
      setGsheetsInfo((prev) => ({
        ...prev,
        spreadsheetUrl: res.spreadsheetUrl,
        lastGoogleSync: res.lastSyncTime,
        isSyncing: false,
        syncSuccessMsg: 'Berhasil melakukan Live Sync seluruh laporan ke Google Sheets!',
      }));
      setTimeout(() => {
        setGsheetsInfo((prev) => ({ ...prev, syncSuccessMsg: null }));
      }, 4000);
    } catch (err: any) {
      setGsheetsInfo((prev) => ({
        ...prev,
        isSyncing: false,
        error: err.message || 'Gagal sinkronisasi ke Google Sheets',
      }));
    }
  };

  // Helper time formatter
  const formatMs = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mmm = ms % 1000;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(mmm).padStart(3, '0')}`;
  };

  // Calculate Rekap Data Matrix
  const rekapMatrix = useMemo(() => {
    const isPenjelajahanTab = activeSubTab === 'PENJELAJAHAN';

    return schools
      .filter((s) => {
        if (activeSubTab === 'PUTRA') return s.hasPutra;
        if (activeSubTab === 'PUTRI') return s.hasPutri;
        return true;
      })
      .filter((s) => {
        const q = search.toLowerCase();
        const paddedId = String(s.id).padStart(2, '0');
        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || String(s.id).includes(q) || paddedId.includes(q);
      })
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((school) => {
        const compScores: Record<string, { score: number; timeMs: number; notes?: string }> = {};
        let grandTotal = 0;
        let totalTimeMs = 0;

        if (isPenjelajahanTab) {
          // Calculate for filtered sub-posts of Penjelajahan
          filteredSubPosts.forEach((sub) => {
            const record = scores.find(
              (s) => s.schoolId === school.id && s.competitionId === penjelajahanComp?.id && s.subPostId === sub.id
            );
            if (record) {
              compScores[sub.id] = { score: record.score, timeMs: record.timeInMs, notes: record.notes };
              grandTotal += record.score;
              totalTimeMs += record.timeInMs;
            } else {
              compScores[sub.id] = { score: 0, timeMs: 0 };
            }
          });
        } else {
          // Standard Competitions for PUTRA or PUTRI (filtered ones)
          const cat = activeSubTab as 'PUTRA' | 'PUTRI';
          filteredCompetitions.forEach((comp) => {
            if (comp.isExploration && comp.subPosts) {
              // Sum up sub-posts for total Penjelajahan score in standard rekap
              let subTotal = 0;
              let subTime = 0;
              const notesList: string[] = [];
              comp.subPosts.forEach((sub) => {
                const rec = scores.find(
                  (s) => s.schoolId === school.id && s.teamCategory === cat && s.competitionId === comp.id && s.subPostId === sub.id
                );
                if (rec) {
                  subTotal += rec.score;
                  subTime += rec.timeInMs;
                  if (rec.notes) notesList.push(`${sub.name}: ${rec.notes}`);
                }
              });
              compScores[comp.id] = { score: subTotal, timeMs: subTime, notes: notesList.join(' | ') };
              grandTotal += subTotal;
              totalTimeMs += subTime;
            } else {
              const rec = scores.find(
                (s) => s.schoolId === school.id && s.teamCategory === cat && s.competitionId === comp.id
              );
              if (rec) {
                compScores[comp.id] = { score: rec.score, timeMs: rec.timeInMs, notes: rec.notes };
                grandTotal += rec.score;
                totalTimeMs += rec.timeInMs;
              } else {
                compScores[comp.id] = { score: 0, timeMs: 0 };
              }
            }
          });
        }

        return {
          schoolId: school.id,
          code: school.code || `PKG-${String(school.id).padStart(2, '0')}`,
          name: school.name,
          compScores,
          grandTotal,
          totalTimeMs,
        };
      });
  }, [schools, competitions, scores, activeSubTab, search, penjelajahanComp, filteredSubPosts, filteredCompetitions]);

  // Export Excel Function with Sheet 1 (Rekap Nilai) and Sheet 2 (Waktu Per Pos)
  const handleExportExcel = () => {
    // Sheet 1: Rekap Nilai
    const headersNilai = ['No', 'Kode', 'Nama Pangkalan'];
    if (activeSubTab === 'PENJELAJAHAN') {
      filteredSubPosts.forEach((sp) => headersNilai.push(sp.name));
    } else {
      filteredCompetitions.forEach((c) => headersNilai.push(c.name));
    }
    headersNilai.push('Total Nilai');
    headersNilai.push('Total Waktu (MM:SS:mmm)');

    const rowsNilai = rekapMatrix.map((item, idx) => {
      const row: any[] = [String(idx + 1).padStart(2, '0'), item.code, item.name];
      if (activeSubTab === 'PENJELAJAHAN') {
        filteredSubPosts.forEach((sp) => {
          row.push(item.compScores[sp.id]?.score || 0);
        });
      } else {
        filteredCompetitions.forEach((c) => {
          row.push(item.compScores[c.id]?.score || 0);
        });
      }
      row.push(item.grandTotal);
      row.push(formatMs(item.totalTimeMs));
      return row;
    });

    // Sheet 2: Waktu Per Pos
    const headersWaktu = ['No', 'Kode', 'Nama Pangkalan'];
    if (activeSubTab === 'PENJELAJAHAN') {
      filteredSubPosts.forEach((sp) => headersWaktu.push(`${sp.name} (Waktu)`));
    } else {
      filteredCompetitions.forEach((c) => headersWaktu.push(`${c.name} (Waktu)`));
    }
    headersWaktu.push('Total Akumulasi Waktu (MM:SS:mmm)');

    const rowsWaktu = rekapMatrix.map((item, idx) => {
      const row: any[] = [String(idx + 1).padStart(2, '0'), item.code, item.name];
      if (activeSubTab === 'PENJELAJAHAN') {
        filteredSubPosts.forEach((sp) => {
          const timeMs = item.compScores[sp.id]?.timeMs || 0;
          row.push(timeMs > 0 ? formatMs(timeMs) : '-');
        });
      } else {
        filteredCompetitions.forEach((c) => {
          const timeMs = item.compScores[c.id]?.timeMs || 0;
          row.push(timeMs > 0 ? formatMs(timeMs) : '-');
        });
      }
      row.push(formatMs(item.totalTimeMs));
      return row;
    });

    const worksheetNilai = XLSX.utils.aoa_to_sheet([headersNilai, ...rowsNilai]);
    const worksheetWaktu = XLSX.utils.aoa_to_sheet([headersWaktu, ...rowsWaktu]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheetNilai, `Rekap_Nilai_${activeSubTab}`);
    XLSX.utils.book_append_sheet(workbook, worksheetWaktu, `Waktu_Per_Pos`);

    XLSX.writeFile(workbook, `Rekap_Custom_Nilai_Waktu_${activeSubTab}_${Date.now()}.xlsx`);
  };

  // Export PDF Function
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`REKAPITULASI PENILAIAN & WAKTU LOMBA PRAMUKA - REGU ${activeSubTab}`, 14, 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pos Terhitung: ${selectedIds.length} dari ${availableItems.length} Pos | Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    let yPos = 30;
    doc.setFontSize(8);
    
    rekapMatrix.forEach((item, idx) => {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`${String(idx + 1).padStart(2, '0')}. [${item.code}] ${item.name} - Total Nilai: ${item.grandTotal} | Total Waktu: ${formatMs(item.totalTimeMs)}`, 14, yPos);
      yPos += 6;
    });

    doc.save(`Rekap_${activeSubTab}_${Date.now()}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            Rekapitulasi Perolehan Nilai & Total Waktu
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Menampilkan akumulasi nilai lengkap beserta total durasi waktu perlombaan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Upload className="w-4 h-4 text-sky-300" />
              <span>UPLOAD EXCEL</span>
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            <span>EXCEL</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>CETAK</span>
          </button>
        </div>
      </div>

      {/* GOOGLE SHEETS LIVE SYNC BANNER */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 rounded-3xl shadow-xl border border-emerald-700/50 space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h3 className="text-sm font-black tracking-tight text-emerald-300 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Live Sync Google Sheets (Real-Time Synchronized)
              </h3>
            </div>
            <p className="text-xs text-slate-200">
              Setiap input juri otomatis tersimpan dan memperbarui sheet Pos, Rekap, dan Rangking di Google Drive secara langsung.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {gsheetsInfo.spreadsheetUrl && (
              <a
                href={gsheetsInfo.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>BUKA GOOGLE SHEETS</span>
              </a>
            )}

            <button
              onClick={handleManualSyncGSheets}
              disabled={gsheetsInfo.isSyncing}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${gsheetsInfo.isSyncing ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
              <span>{gsheetsInfo.isSyncing ? 'Proses Sync...' : 'SINKRON SEKARANG'}</span>
            </button>
          </div>
        </div>

        {gsheetsInfo.lastGoogleSync && (
          <div className="text-[11px] text-emerald-200/90 font-mono flex items-center gap-2 pt-1 border-t border-white/10">
            <span>🕒 Terakhir disinkronkan: {new Date(gsheetsInfo.lastGoogleSync).toLocaleString('id-ID')}</span>
          </div>
        )}

        {gsheetsInfo.syncSuccessMsg && (
          <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{gsheetsInfo.syncSuccessMsg}</span>
          </div>
        )}

        {gsheetsInfo.error && (
          <div className="p-2.5 bg-rose-500/20 border border-rose-400/40 text-rose-200 rounded-xl text-xs font-bold">
            ⚠️ {gsheetsInfo.error}
          </div>
        )}
      </div>

      {/* Sub Tabs & Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('PUTRA')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'PUTRA'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            👦 REKAP PUTRA (PA)
          </button>
          <button
            onClick={() => setActiveSubTab('PUTRI')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'PUTRI'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            👧 REKAP PUTRI (PI)
          </button>
          <button
            onClick={() => setActiveSubTab('PENJELAJAHAN')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'PENJELAJAHAN'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            🧭 REKAP PENJELAJAHAN ({penjelajahanComp?.subPosts?.length || 0} POS)
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter pangkalan..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* CUSTOM POS FILTER CONTROL PANEL */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 flex-wrap">
                <span>Filter Custom Pos / Mata Lomba</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  selectedIds.length === availableItems.length
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : selectedIds.length === 0
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                }`}>
                  {selectedIds.length} dari {availableItems.length} Pos Terpilih
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Pilih pos mana saja yang ingin dihitung total nilai & waktunya dalam tabel rekapitulasi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAllPos}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pilih Semua</span>
            </button>
            <button
              type="button"
              onClick={handleDeselectAllPos}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 text-rose-500" />
              <span>Hapus Semua</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPosFilter(!showPosFilter)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showPosFilter ? 'Sembunyikan Opsi' : 'Atur Pilihan Pos'}</span>
              {showPosFilter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expanded Checkbox Chips */}
        {showPosFilter && (
          <div className="pt-3 border-t border-slate-100 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {availableItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTogglePosItem(item.id)}
                    className={`p-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-70 hover:opacity-100'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Printable Title */}
      <div className="hidden print:block text-center space-y-1 mb-4">
        <h1 className="text-xl font-black">REKAPITULASI PENILAIAN & TOTAL WAKTU LOMBA PRAMUKA</h1>
        <p className="text-sm font-bold uppercase">Kategori: {activeSubTab} ({selectedIds.length} Pos Terpilih)</p>
        <p className="text-xs text-slate-500">Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}</p>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center border-r border-slate-800">No</th>
                <th className="py-3 px-3 w-20 border-r border-slate-800">Kode</th>
                <th className="py-3 px-3 min-w-[180px] border-r border-slate-800">Nama Pangkalan</th>
                
                {/* Competition Columns */}
                {activeSubTab === 'PENJELAJAHAN'
                  ? filteredSubPosts.map((sp) => (
                      <th key={sp.id} className="py-3 px-2 text-center border-r border-slate-800 min-w-[90px]">
                        {sp.name}
                      </th>
                    ))
                  : filteredCompetitions.map((comp) => (
                      <th key={comp.id} className="py-3 px-2 text-center border-r border-slate-800 min-w-[90px]">
                        {comp.name}
                      </th>
                    ))}

                <th className="py-3 px-3 text-center bg-amber-500 text-slate-950 font-black min-w-[100px] border-r border-amber-600">
                  TOTAL NILAI
                </th>
                <th className="py-3 px-3 text-center bg-sky-600 text-white font-black min-w-[120px]">
                  TOTAL WAKTU
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {selectedIds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="w-8 h-8 text-indigo-400 animate-bounce" />
                      <p className="text-sm font-bold text-slate-700">Belum Ada Pos / Mata Lomba yang Dipilih</p>
                      <p className="text-xs text-slate-400">
                        Klik tombol <span className="font-bold text-indigo-600">"Pilih Semua"</span> atau centang pos di atas untuk menampilkan nilai rekap.
                      </p>
                      <button
                        type="button"
                        onClick={handleSelectAllPos}
                        className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                      >
                        Centang Semua Pos Sekarang
                      </button>
                    </div>
                  </td>
                </tr>
              ) : rekapMatrix.length === 0 ? (
                <tr>
                  <td colSpan={3 + (isPenjelajahanTab ? filteredSubPosts.length : filteredCompetitions.length) + 2} className="py-8 text-center text-slate-400">
                    Tidak ada pangkalan ditemukan.
                  </td>
                </tr>
              ) : (
                rekapMatrix.map((item, idx) => (
                  <tr key={item.schoolId} className="hover:bg-blue-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500 border-r border-slate-100">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900 border-r border-slate-100">
                      {item.code}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-slate-900 border-r border-slate-100">
                      {item.name}
                    </td>

                    {/* Render Scores & Time */}
                    {activeSubTab === 'PENJELAJAHAN'
                      ? filteredSubPosts.map((sp) => {
                          const scoreData = item.compScores[sp.id];
                          const val = scoreData?.score || 0;
                          const timeMs = scoreData?.timeMs || 0;
                          const note = scoreData?.notes;
                          return (
                            <td key={sp.id} className="py-2.5 px-2 text-center font-mono font-bold border-r border-slate-100">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className={val > 0 ? 'text-slate-900 font-black text-xs' : 'text-slate-300'}>
                                  {val > 0 ? val : '-'}
                                </span>
                                {timeMs > 0 && (
                                  <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200/80 px-1 py-0.5 rounded font-bold leading-tight whitespace-nowrap">
                                    ⏱ {formatMs(timeMs)}
                                  </span>
                                )}
                                {note && (
                                  <span title={note} className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-sans font-medium leading-tight max-w-[110px] truncate cursor-help">
                                    📝 {note}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })
                      : filteredCompetitions.map((comp) => {
                          const scoreData = item.compScores[comp.id];
                          const val = scoreData?.score || 0;
                          const timeMs = scoreData?.timeMs || 0;
                          const note = scoreData?.notes;
                          return (
                            <td key={comp.id} className="py-2.5 px-2 text-center font-mono font-bold border-r border-slate-100">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className={val > 0 ? 'text-slate-900 font-black text-xs' : 'text-slate-300'}>
                                  {val > 0 ? val : '-'}
                                </span>
                                {timeMs > 0 && (
                                  <span className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200/80 px-1 py-0.5 rounded font-bold leading-tight whitespace-nowrap">
                                    ⏱ {formatMs(timeMs)}
                                  </span>
                                )}
                                {note && (
                                  <span title={note} className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-sans font-medium leading-tight max-w-[110px] truncate cursor-help">
                                    📝 {note}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                    <td className="py-2.5 px-3 text-center font-mono font-black text-amber-900 bg-amber-50 border-r border-amber-200">
                      {item.grandTotal}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-900 bg-sky-50">
                      {formatMs(item.totalTimeMs)}
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
