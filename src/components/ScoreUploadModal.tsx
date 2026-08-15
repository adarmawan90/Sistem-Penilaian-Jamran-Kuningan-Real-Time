import React, { useState } from 'react';
import { School, Competition, TeamCategory } from '../types';
import { ApiService } from '../services/apiService';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Check,
  Layers,
  Filter,
  Users,
  Trophy,
  Clock,
} from 'lucide-react';

interface ScoreUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  competitions: Competition[];
  onUploadSuccess: () => void;
}

interface ParsedScoreRow {
  schoolId: number;
  schoolName: string;
  teamCategory: TeamCategory;
  competitionId: string;
  subPostId?: string;
  posName: string;
  score: number;
  timeInMs: number;
  timeFormatted: string;
  status: 'VALID' | 'INVALID';
  errorMessage?: string;
}

// Helper time formatter & parser
function formatMsToString(ms: number): string {
  if (!ms || ms <= 0) return '00:00:000';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const milli = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(milli).padStart(3, '0')}`;
}

function parseTimeToMsAndFormatted(val: any): { timeInMs: number; timeFormatted: string } {
  if (val === undefined || val === null || String(val).trim() === '') {
    return { timeInMs: 0, timeFormatted: '00:00:000' };
  }

  const str = String(val).trim();

  // Excel serial time fraction (e.g. 0.0038194444 = 5 min 30 sec)
  if (typeof val === 'number') {
    if (val > 0 && val < 1) {
      const totalMs = Math.round(val * 86400 * 1000);
      return { timeInMs: totalMs, timeFormatted: formatMsToString(totalMs) };
    } else if (val > 100000) {
      return { timeInMs: Math.round(val), timeFormatted: formatMsToString(Math.round(val)) };
    } else {
      const totalMs = Math.round(val * 1000);
      return { timeInMs: totalMs, timeFormatted: formatMsToString(totalMs) };
    }
  }

  // String formats e.g. "05:30.120", "05:30", "05:30:120", "1:30"
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length === 2) {
      const mins = parseFloat(parts[0]) || 0;
      const secs = parseFloat(parts[1]) || 0;
      const totalMs = Math.round((mins * 60 + secs) * 1000);
      return { timeInMs: totalMs, timeFormatted: formatMsToString(totalMs) };
    } else if (parts.length === 3) {
      const p1 = parseFloat(parts[0]) || 0;
      const p2 = parseFloat(parts[1]) || 0;
      const p3 = parseFloat(parts[2]) || 0;

      if (p3 < 1000 && p2 < 60 && p1 < 1000) {
        const totalMs = Math.round(p1 * 60000 + p2 * 1000 + p3);
        return { timeInMs: totalMs, timeFormatted: formatMsToString(totalMs) };
      } else {
        const totalMs = Math.round(p1 * 3600000 + p2 * 60000 + p3 * 1000);
        return { timeInMs: totalMs, timeFormatted: formatMsToString(totalMs) };
      }
    }
  }

  // Pure numeric string e.g. "330" (seconds or ms)
  const num = parseFloat(str);
  if (!isNaN(num)) {
    if (num > 100000) {
      return { timeInMs: Math.round(num), timeFormatted: formatMsToString(Math.round(num)) };
    }
    const totalMs = Math.round(num * 1000);
    return { timeInMs: totalMs, timeFormatted: formatMsToString(totalMs) };
  }

  return { timeInMs: 0, timeFormatted: '00:00:000' };
}

export const ScoreUploadModal: React.FC<ScoreUploadModalProps> = ({
  isOpen,
  onClose,
  schools,
  competitions,
  onUploadSuccess,
}) => {
  const [selectedRegu, setSelectedRegu] = useState<'ALL' | 'PUTRA' | 'PUTRI'>('ALL');
  const [selectedPosHeader, setSelectedPosHeader] = useState<string>('ALL');

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedScoreRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Flatten active competitions into discrete Pos items
  const flatPosList: Array<{
    competitionId: string;
    subPostId?: string;
    headerName: string;
    posName: string;
    minScore: number;
    maxScore: number;
  }> = [];

  competitions.forEach((comp) => {
    if (!comp.active) return;
    if (comp.isExploration && comp.subPosts && comp.subPosts.length > 0) {
      comp.subPosts.forEach((sub) => {
        flatPosList.push({
          competitionId: comp.id,
          subPostId: sub.id,
          headerName: `${comp.name} - ${sub.name}`,
          posName: `${comp.name} (${sub.name})`,
          minScore: comp.minScore,
          maxScore: comp.maxScore,
        });
      });
    } else {
      flatPosList.push({
        competitionId: comp.id,
        headerName: comp.name,
        posName: comp.name,
        minScore: comp.minScore,
        maxScore: comp.maxScore,
      });
    }
  });

  // Filter pos list based on dropdown selection
  const filteredPosList =
    selectedPosHeader === 'ALL'
      ? flatPosList
      : flatPosList.filter((p) => p.headerName === selectedPosHeader);

  // 1. GENERATE & DOWNLOAD EXCEL TEMPLATE
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const gridRows: any[] = [];

    schools.forEach((school) => {
      // Row Putra if active & selected
      if (school.hasPutra && (selectedRegu === 'ALL' || selectedRegu === 'PUTRA')) {
        const rowData: Record<string, any> = {
          'ID Pangkalan': String(school.id).padStart(2, '0'),
          'Nama Pangkalan': school.name,
          'Kategori Regu': 'PUTRA',
        };

        if (filteredPosList.length === 1) {
          rowData['Nilai'] = '';
          rowData['Waktu (MM:SS.ms)'] = '';
        } else {
          filteredPosList.forEach((pos) => {
            rowData[`${pos.headerName} (Nilai)`] = '';
            rowData[`${pos.headerName} (Waktu)`] = '';
          });
        }
        gridRows.push(rowData);
      }

      // Row Putri if active & selected
      if (school.hasPutri && (selectedRegu === 'ALL' || selectedRegu === 'PUTRI')) {
        const rowData: Record<string, any> = {
          'ID Pangkalan': String(school.id).padStart(2, '0'),
          'Nama Pangkalan': school.name,
          'Kategori Regu': 'PUTRI',
        };

        if (filteredPosList.length === 1) {
          rowData['Nilai'] = '';
          rowData['Waktu (MM:SS.ms)'] = '';
        } else {
          filteredPosList.forEach((pos) => {
            rowData[`${pos.headerName} (Nilai)`] = '';
            rowData[`${pos.headerName} (Waktu)`] = '';
          });
        }
        gridRows.push(rowData);
      }
    });

    const wsGrid = XLSX.utils.json_to_sheet(gridRows);

    // Adjust column widths
    const colWidths = [
      { wch: 14 }, // ID Pangkalan
      { wch: 30 }, // Nama Pangkalan
      { wch: 15 }, // Kategori Regu
    ];

    if (filteredPosList.length === 1) {
      colWidths.push({ wch: 16 }); // Nilai
      colWidths.push({ wch: 22 }); // Waktu
    } else {
      filteredPosList.forEach(() => {
        colWidths.push({ wch: 22 }); // Nilai pos
        colWidths.push({ wch: 22 }); // Waktu pos
      });
    }
    wsGrid['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, wsGrid, 'Template_Nilai');

    // SHEET 2: Petunjuk Format
    const targetPosLabel = selectedPosHeader === 'ALL' ? 'Semua Pos Lomba' : selectedPosHeader;
    const targetReguLabel = selectedRegu === 'ALL' ? 'Semua Regu (Putra & Putri)' : `Regu ${selectedRegu}`;

    const guideData = [
      { 'PETUNJUK PENGISIAN TEMPLATE': `Sasar Target: ${targetPosLabel} - ${targetReguLabel}` },
      { 'PETUNJUK PENGISIAN TEMPLATE': '1. Jangan mengubah header kolom "ID Pangkalan" dan "Kategori Regu".' },
      { 'PETUNJUK PENGISIAN TEMPLATE': '2. Isikan angka Nilai (contoh: 85, 90.5) pada kolom Nilai.' },
      { 'PETUNJUK PENGISIAN TEMPLATE': '3. Isikan Waktu (contoh: 05:30 atau 05:30.120 atau detik 330) pada kolom Waktu.' },
      { 'PETUNJUK PENGISIAN TEMPLATE': '4. Nilai diisikan sesuai rentang acuan (0 - 100).' },
      { 'PETUNJUK PENGISIAN TEMPLATE': '5. Kolom Waktu bersifat opsional (dapat dikosongkan jika pos tidak memakai stopwatch).' },
      { 'PETUNJUK PENGISIAN TEMPLATE': '6. Kategori Regu diisi "PUTRA" atau "PUTRI".' },
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan_Upload');

    // Filename
    let filename = 'Template_Import_Nilai';
    if (selectedPosHeader !== 'ALL') {
      const cleanPos = selectedPosHeader.replace(/[^a-zA-Z0-9]/g, '_');
      filename += `_${cleanPos}`;
    }
    if (selectedRegu !== 'ALL') {
      filename += `_${selectedRegu}`;
    }
    filename += '.xlsx';

    XLSX.writeFile(wb, filename);
  };

  // 2. FILE SELECTION & PARSING
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setUploadError(null);
    setUploadSuccessMsg(null);
    setParsedRows([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];

      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (rawJson.length === 0) {
        throw new Error('File Excel kosong atau tidak memiliki data.');
      }

      const results: ParsedScoreRow[] = [];

      // Parse each row from rawJson
      rawJson.forEach((row) => {
        // Retrieve ID Pangkalan & School Name
        const schoolIdRaw = row['ID Pangkalan'] ?? row['ID'] ?? row['id_pangkalan'] ?? row['Id Pangkalan'];
        const schoolId = Number(schoolIdRaw);

        let schoolNameObj = schools.find((s) => s.id === schoolId);
        if (!schoolNameObj && row['Nama Pangkalan']) {
          const nameSearch = String(row['Nama Pangkalan']).toLowerCase().trim();
          schoolNameObj = schools.find((s) => s.name.toLowerCase().trim() === nameSearch);
        }

        const schoolName = schoolNameObj ? schoolNameObj.name : (row['Nama Pangkalan'] || `ID #${schoolIdRaw}`);

        // Category Regu
        const rawCat = String(row['Kategori Regu'] || row['Kategori'] || row['kategori'] || '').toUpperCase().trim();
        let teamCategory: TeamCategory;
        if (rawCat === 'PUTRI' || rawCat === 'PI') {
          teamCategory = 'PUTRI';
        } else if (rawCat === 'PUTRA' || rawCat === 'PA') {
          teamCategory = 'PUTRA';
        } else {
          teamCategory = selectedRegu !== 'ALL' ? selectedRegu : 'PUTRA';
        }

        // Determine which pos columns to look for
        flatPosList.forEach((pos) => {
          // Find matching Score key
          let valKey = Object.keys(row).find((k) => {
            const cleanK = k.toLowerCase().trim();
            const cleanHeader = pos.headerName.toLowerCase().trim();
            const cleanPos = pos.posName.toLowerCase().trim();
            return (
              cleanK === `${cleanHeader} (nilai)` ||
              cleanK === `${cleanHeader} - nilai` ||
              cleanK === `nilai: ${cleanHeader}` ||
              cleanK === cleanHeader ||
              cleanK === cleanPos
            );
          });

          // Fallback for Score key if specific Pos or single pos selected
          if (!valKey) {
            valKey = Object.keys(row).find((k) => {
              const cleanK = k.toLowerCase().trim();
              if (selectedPosHeader !== 'ALL' && pos.headerName === selectedPosHeader) {
                return cleanK === 'nilai' || cleanK === 'score' || cleanK === 'nilai pos' || cleanK === 'skor';
              }
              return cleanK.includes(pos.competitionId.toLowerCase()) && !cleanK.includes('waktu');
            });
          }

          // Find matching Time key
          let timeKey = Object.keys(row).find((k) => {
            const cleanK = k.toLowerCase().trim();
            const cleanHeader = pos.headerName.toLowerCase().trim();
            const cleanPos = pos.posName.toLowerCase().trim();
            return (
              cleanK === `${cleanHeader} (waktu)` ||
              cleanK === `${cleanHeader} - waktu` ||
              cleanK === `waktu: ${cleanHeader}` ||
              cleanK === `waktu ${cleanHeader}`
            );
          });

          // Fallback for Time key
          if (!timeKey) {
            timeKey = Object.keys(row).find((k) => {
              const cleanK = k.toLowerCase().trim();
              if (selectedPosHeader !== 'ALL' && pos.headerName === selectedPosHeader) {
                return cleanK.includes('waktu') || cleanK === 'time' || cleanK === 'waktu tempuh';
              }
              return cleanK.includes(pos.competitionId.toLowerCase()) && cleanK.includes('waktu');
            });
          }

          if (valKey && row[valKey] !== undefined && row[valKey] !== null && String(row[valKey]).trim() !== '') {
            const rawScoreVal = Number(row[valKey]);

            if (!isNaN(rawScoreVal)) {
              let isValid = true;
              let errMsg = '';

              if (!schoolNameObj) {
                isValid = false;
                errMsg = `ID Pangkalan #${schoolIdRaw} tidak ditemukan di database`;
              } else if (rawScoreVal < pos.minScore || rawScoreVal > pos.maxScore) {
                isValid = false;
                errMsg = `Nilai ${rawScoreVal} di luar rentang (${pos.minScore} - ${pos.maxScore})`;
              }

              // Parse time if timeKey exists
              const rawTimeVal = timeKey ? row[timeKey] : undefined;
              const { timeInMs, timeFormatted } = parseTimeToMsAndFormatted(rawTimeVal);

              results.push({
                schoolId: schoolNameObj ? schoolNameObj.id : schoolId,
                schoolName,
                teamCategory,
                competitionId: pos.competitionId,
                subPostId: pos.subPostId,
                posName: pos.posName,
                score: rawScoreVal,
                timeInMs,
                timeFormatted,
                status: isValid ? 'VALID' : 'INVALID',
                errorMessage: errMsg,
              });
            }
          }
        });
      });

      if (results.length === 0) {
        throw new Error(
          'Tidak ditemukan kolom nilai yang cocok. Pastikan menggunakan Template Excel resmi atau header kolom pos yang sesuai.'
        );
      }

      setParsedRows(results);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal membaca file Excel.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. CONFIRM & SUBMIT
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.status === 'VALID');
    if (validRows.length === 0) {
      setUploadError('Tidak ada data nilai valid yang dapat diimpor.');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    try {
      const batchPayload = validRows.map((r) => ({
        schoolId: r.schoolId,
        teamCategory: r.teamCategory,
        competitionId: r.competitionId,
        subPostId: r.subPostId,
        score: r.score,
        timeInMs: r.timeInMs || 0,
        timeFormatted: r.timeFormatted || '00:00:000',
        judgeId: 'admin_upload',
        judgeName: 'Administrator (Import Excel)',
        posName: r.posName,
      }));

      await ApiService.uploadBatchScores(batchPayload);

      setUploadSuccessMsg(`Berhasil mengimpor ${validRows.length} data nilai ke dalam sistem!`);
      setTimeout(() => {
        onUploadSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal menyimpan batch nilai ke server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.status === 'VALID').length;
  const invalidCount = parsedRows.filter((r) => r.status === 'INVALID').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Upload & Impor Nilai + Waktu (Per Pos & Per Regu)
              </h3>
              <p className="text-xs text-slate-500">
                Pilih pos lomba dan kategori regu, unduh template (dengan kolom Nilai dan Waktu), lalu upload kembali file Excel.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadSuccessMsg && (
          <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{uploadSuccessMsg}</span>
          </div>
        )}

        {uploadError && (
          <div className="p-4 bg-rose-100 border border-rose-300 text-rose-900 font-bold text-xs rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* STEP 1: SELECT POS & REGU TARGET FILTER */}
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
          <div className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-indigo-700" />
            <span>1. Filter Target Nilai (Per Pos & Per Regu)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Filter Pos Lomba */}
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pilih Pos Lomba:</span>
              </label>
              <select
                value={selectedPosHeader}
                onChange={(e) => {
                  setSelectedPosHeader(e.target.value);
                  setParsedRows([]);
                  setFile(null);
                }}
                className="w-full py-2 px-3 text-xs font-bold bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">🌐 SEMUA POS LOMBA ({flatPosList.length} Pos)</option>
                {flatPosList.map((pos, idx) => (
                  <option key={idx} value={pos.headerName}>
                    📍 {pos.headerName}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Regu */}
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pilih Kategori Regu:</span>
              </label>
              <select
                value={selectedRegu}
                onChange={(e) => {
                  setSelectedRegu(e.target.value as 'ALL' | 'PUTRA' | 'PUTRI');
                  setParsedRows([]);
                  setFile(null);
                }}
                className="w-full py-2 px-3 text-xs font-bold bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">👥 SEMUA REGU (PUTRA & PUTRI)</option>
                <option value="PUTRA">👦 REGU PUTRA SAJA (PA)</option>
                <option value="PUTRI">👧 REGU PUTRI SAJA (PI)</option>
              </select>
            </div>
          </div>
        </div>

        {/* STEP 2: DOWNLOAD TEMPLATE ACCORDING TO FILTER */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-blue-700" />
              <span>2. Unduh Format Template Excel (Nilai + Waktu)</span>
            </h4>
            <p className="text-xs text-blue-800">
              Template berisi kolom untuk Nilai dan Waktu untuk{' '}
              <strong>
                {selectedPosHeader === 'ALL' ? 'Semua Pos Lomba' : selectedPosHeader}
              </strong>{' '}
              ({selectedRegu === 'ALL' ? 'Semua Regu' : `Regu ${selectedRegu}`}).
            </p>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 shrink-0 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>UNDUH TEMPLATE EXCEL</span>
          </button>
        </div>

        {/* STEP 3: UPLOAD FILE */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
            3. Upload File Excel Hasil Pengisian (.XLSX / .XLS / .CSV)
          </label>

          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50 hover:bg-emerald-50/40 transition-colors relative cursor-pointer">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <Upload className="w-8 h-8 text-emerald-600" />
              <div className="text-xs font-bold text-slate-800">
                {file ? file.name : 'Klik di sini atau seret file Excel ke area ini'}
              </div>
              <p className="text-[11px] text-slate-500">
                Mendukung format .XLSX, .XLS, atau .CSV resmi.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 4: PREVIEW PARSED ROWS */}
        {isProcessing && (
          <div className="p-6 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Membaca dan memvalidasi data Excel...</p>
          </div>
        )}

        {parsedRows.length > 0 && !isProcessing && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Hasil Analisis Data ({parsedRows.length} Rekaman Nilai Ditemukan)</span>
              </span>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg font-bold">
                  ✓ Valid: {validCount}
                </span>
                {invalidCount > 0 && (
                  <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-lg font-bold">
                    ⚠️ Ditolak: {invalidCount}
                  </span>
                )}
              </div>
            </div>

            {/* Preview Scrollable Table */}
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-slate-50 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-200/80 text-slate-700 font-extrabold sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">Pangkalan</th>
                    <th className="p-2.5">Regu</th>
                    <th className="p-2.5">Pos Lomba</th>
                    <th className="p-2.5 text-center">Nilai</th>
                    <th className="p-2.5 text-center">Waktu Tempuh</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {parsedRows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className={row.status === 'INVALID' ? 'bg-rose-50/80' : 'hover:bg-slate-50'}>
                      <td className="p-2.5 font-bold text-slate-900">
                        #{String(row.schoolId).padStart(2, '0')} {row.schoolName}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-black text-[10px] ${
                            row.teamCategory === 'PUTRA'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-pink-100 text-pink-900'
                          }`}
                        >
                          {row.teamCategory}
                        </span>
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800">{row.posName}</td>
                      <td className="p-2.5 text-center font-mono font-black text-indigo-700">{row.score}</td>
                      <td className="p-2.5 text-center">
                        {row.timeFormatted && row.timeFormatted !== '00:00:000' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {row.timeFormatted}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {row.status === 'VALID' ? (
                          <span className="text-emerald-700 font-extrabold flex items-center justify-center gap-1 text-[11px]">
                            <Check className="w-3.5 h-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="text-rose-700 font-bold text-[10px]" title={row.errorMessage}>
                            ❌ {row.errorMessage}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 100 && (
                <div className="p-2 text-center text-[11px] text-slate-500 italic bg-slate-100">
                  Dan {parsedRows.length - 100} data lainnya...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isSubmitting || validCount === 0}
            className={`px-6 py-3 font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer ${
              validCount === 0 || isSubmitting
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{isSubmitting ? 'Mengimpor Data...' : `IMPOR ${validCount} NILAI VALID`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
