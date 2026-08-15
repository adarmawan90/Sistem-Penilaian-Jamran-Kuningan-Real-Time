import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, Timer, Edit3, Clock, Check, Zap, AlertTriangle } from 'lucide-react';

interface StopwatchProps {
  onTimeCaptured: (timeInMs: number, timeFormatted: string) => void;
  initialTimeMs?: number;
}

export const Stopwatch: React.FC<StopwatchProps> = ({ onTimeCaptured, initialTimeMs = 0 }) => {
  const [timeMs, setTimeMs] = useState<number>(initialTimeMs);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  // Manual Ketik Cepat State (e.g. "6.30") - Biarkan manual tanpa auto fill dari stopwatch
  const [quickInput, setQuickInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Sync initialTimeMs on mount or prop change
  useEffect(() => {
    setTimeMs(initialTimeMs);
    if (initialTimeMs === 0) {
      setQuickInput('');
      setInputError(null);
      setIsRunning(false);
    } else {
      const m = Math.floor(initialTimeMs / 60000);
      const s = Math.floor((initialTimeMs % 60000) / 1000);
      const mmStr = String(m).padStart(2, '0');
      const ssStr = String(s).padStart(2, '0');
      setQuickInput(`${mmStr}.${ssStr}`);
      setInputError(null);
    }
  }, [initialTimeMs]);

  // Stopwatch timer loop
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = performance.now() - timeMs;
      const updateTimer = () => {
        const now = performance.now();
        const elapsed = Math.max(0, Math.floor(now - startTimeRef.current));
        setTimeMs(elapsed);
        timerRef.current = requestAnimationFrame(updateTimer);
      };
      timerRef.current = requestAnimationFrame(updateTimer);
    } else if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
    }

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isRunning, timeMs]);

  const formatTimeParts = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return {
      mm: String(minutes).padStart(2, '0'),
      ss: String(seconds).padStart(2, '0'),
      mmm: String(millis).padStart(3, '0'),
    };
  };

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    const parts = formatTimeParts(timeMs);
    const formatted = `${parts.mm}:${parts.ss}:${parts.mmm}`;
    onTimeCaptured(timeMs, formatted);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeMs(0);
    setQuickInput('');
    onTimeCaptured(0, '00:00:000');
  };

  // Helper time parser with automatic formatting
  const parseTimeFromInput = (raw: string) => {
    if (!raw || !raw.trim()) {
      return { totalMs: 0, formatted: '00:00:000', m: 0, s: 0, displayShort: '' };
    }

    let cleaned = raw.trim().replace(/,/g, '.').replace(/:/g, '.');
    cleaned = cleaned.replace(/[^0-9.]/g, '');

    let m = 0;
    let s = 0;

    if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      m = parseInt(parts[0] || '0', 10) || 0;
      s = parseInt(parts[1] || '0', 10) || 0;
    } else {
      const digits = cleaned;
      if (digits.length === 3 || digits.length === 4) {
        m = parseInt(digits.substring(0, digits.length - 2), 10) || 0;
        s = parseInt(digits.substring(digits.length - 2), 10) || 0;
      } else if (digits.length <= 2) {
        const val = parseInt(digits, 10) || 0;
        if (val < 10) {
          m = val;
          s = 0;
        } else {
          m = 0;
          s = val;
        }
      } else {
        m = parseInt(digits, 10) || 0;
        s = 0;
      }
    }

    const safeSec = Math.min(59, Math.max(0, s));
    const totalMs = (m * 60000) + (safeSec * 1000);
    const mmStr = String(m).padStart(2, '0');
    const ssStr = String(safeSec).padStart(2, '0');
    const formatted = `${mmStr}:${ssStr}:000`;
    const displayShort = `${mmStr}.${ssStr}`;

    return { totalMs, formatted, m, s: safeSec, displayShort };
  };

  // Handle Quick Format Input
  const handleQuickInputChange = (rawVal: string) => {
    // Check if non-numeric/non-delimiter characters were attempted
    const hasInvalid = /[^0-9.:,]/.test(rawVal);
    if (hasInvalid) {
      setInputError('⛔ Karakter selain angka ditolak! Harap hanya ketikkan angka (misal: 6.30 atau 630).');
    } else {
      setInputError(null);
    }

    // Strictly filter out non-numeric and non-delimiter characters
    const cleanVal = rawVal.replace(/[^0-9.:,]/g, '');
    setQuickInput(cleanVal);
    const parsed = parseTimeFromInput(cleanVal);
    setTimeMs(parsed.totalMs);
    onTimeCaptured(parsed.totalMs, parsed.formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Reject single character keypresses that are letters or invalid symbols
    if (e.key.length === 1 && !/[0-9.:,]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setInputError('⛔ Karakter selain angka ditolak! Harap hanya ketikkan angka (misal: 6.30 atau 630).');
    }
  };

  const handleQuickInputBlur = () => {
    if (!quickInput.trim()) return;
    const parsed = parseTimeFromInput(quickInput);
    if (parsed.totalMs > 0) {
      setQuickInput(parsed.displayShort);
    }
  };

  const applyPreset = (rawVal: string, totalSec: number) => {
    setIsRunning(false);
    setQuickInput(rawVal);
    const totalMs = totalSec * 1000;
    setTimeMs(totalMs);

    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const mmStr = String(m).padStart(2, '0');
    const ssStr = String(s).padStart(2, '0');
    onTimeCaptured(totalMs, `${mmStr}:${ssStr}:000`);
  };

  const { mm, ss, mmm } = formatTimeParts(timeMs);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 text-amber-400 text-xs uppercase tracking-wider font-extrabold">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>STOPWATCH & KETIK CEPAT WAKTU</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${isRunning ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
          {isRunning ? '▶ RUNNING' : '⏸ IDLE'}
        </span>
      </div>

      {/* BLOCK 1: DIGITAL STOPWATCH TIMER */}
      <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1 text-sky-400">
            <Timer className="w-3.5 h-3.5" />
            1. Digital Stopwatch Timer
          </span>
        </div>

        {/* Big Display */}
        <div className="text-center py-2 bg-slate-900 rounded-xl border border-slate-800 font-mono select-none">
          <div className="text-4xl sm:text-5xl font-black tracking-tight text-amber-400 flex items-baseline justify-center gap-1">
            <span>{mm}</span>
            <span className="text-slate-600 text-3xl sm:text-4xl">:</span>
            <span>{ss}</span>
            <span className="text-slate-600 text-3xl sm:text-4xl">:</span>
            <span className="text-2xl sm:text-3xl text-sky-300 w-[3ch] text-left">{mmm}</span>
          </div>
          <div className="flex justify-center text-[10px] text-slate-500 font-sans gap-8 mt-1 uppercase tracking-widest font-bold">
            <span>Menit</span>
            <span>Detik</span>
            <span>MiliSec</span>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START TIMER</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="col-span-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>STOP & SIMPAN WAKTU</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* BLOCK 2: INPUT KETIK CEPAT (TANPA INPUT TERPISAH MENIT & DETIK) */}
      <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
        <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1 text-amber-400">
            <Edit3 className="w-3.5 h-3.5" />
            2. Input Ketik Cepat Format Waktu
          </span>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Ketik Cepat Waktu (Contoh: <code className="text-amber-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">6.30</code> artinya 6 menit 30 detik)</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9.:,]*"
            value={quickInput}
            onKeyDown={handleKeyDown}
            onChange={(e) => handleQuickInputChange(e.target.value)}
            onBlur={handleQuickInputBlur}
            placeholder="Ketik misal 6.30 atau 630..."
            className={`w-full px-3.5 py-2.5 bg-slate-900 border rounded-xl text-base font-mono font-bold text-amber-400 focus:ring-2 focus:outline-none transition-all ${
              inputError ? 'border-rose-500 focus:ring-rose-500 bg-rose-950/20' : 'border-slate-700 focus:ring-amber-500'
            }`}
          />
          {inputError && (
            <div className="mt-1.5 text-xs text-rose-300 font-bold flex items-center gap-1.5 bg-rose-950/90 px-3 py-1.5 rounded-lg border border-rose-800 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{inputError}</span>
            </div>
          )}
          {quickInput.trim() !== '' && !inputError && (
            <div className="mt-1.5 text-xs text-emerald-400 font-mono font-bold flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-emerald-800/60">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Format Otomatis Terdeteksi:</span>
              <span className="text-white font-black bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
                {parseTimeFromInput(quickInput).m} Menit {parseTimeFromInput(quickInput).s} Detik ({parseTimeFromInput(quickInput).displayShort})
              </span>
            </div>
          )}
        </div>

        {/* Quick Presets */}
        <div>
          <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
            Tombol Pintas Durasi Waktu:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '0.30 (30 Dtk)', val: '0.30', sec: 30 },
              { label: '1.00 (1 Mnt)', val: '1.00', sec: 60 },
              { label: '2.00 (2 Mnt)', val: '2.00', sec: 120 },
              { label: '3.00 (3 Mnt)', val: '3.00', sec: 180 },
              { label: '5.00 (5 Mnt)', val: '5.00', sec: 300 },
              { label: '6.30 (6½ Mnt)', val: '6.30', sec: 390 },
              { label: '10.00 (10 Mnt)', val: '10.00', sec: 600 },
            ].map((p) => (
              <button
                key={p.sec}
                type="button"
                onClick={() => applyPreset(p.val, p.sec)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-all cursor-pointer"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg transition-all cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Captured Result Summary Bar */}
      {timeMs > 0 && (
        <div className="p-2.5 bg-blue-950/80 border border-blue-800/80 rounded-xl text-xs flex items-center justify-between text-blue-200 font-medium">
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Catatan Waktu Terpilih:</span>
            <strong className="font-mono text-white text-sm bg-blue-900 px-2.5 py-0.5 rounded border border-blue-700">
              {mm}:{ss}:{mmm} ({Math.floor(timeMs / 60000)}m {Math.floor((timeMs % 60000) / 1000)}s)
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};
