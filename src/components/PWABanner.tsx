import React, { useState, useEffect } from 'react';
import { Download, WifiOff, RefreshCw, Smartphone } from 'lucide-react';

interface PWABannerProps {
  isOnline: boolean;
  offlineCount: number;
  onSyncOffline: () => void;
}

export const PWABanner: React.FC<PWABannerProps> = ({ isOnline, offlineCount, onSyncOffline }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 z-40 max-w-sm w-full space-y-2 pointer-events-none">
      
      {/* Offline Alert Floating Banner */}
      {!isOnline && (
        <div className="bg-rose-900 text-white p-3.5 rounded-2xl shadow-xl border border-rose-700 flex items-center justify-between gap-3 pointer-events-auto animate-bounce">
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-rose-300 shrink-0" />
            <div className="text-xs">
              <span className="font-extrabold block">Koneksi Internet Terputus</span>
              <span className="text-[11px] text-rose-200">{offlineCount} nilai tersimpan di HP Anda</span>
            </div>
          </div>
          <button
            onClick={onSyncOffline}
            className="px-3 py-1.5 bg-white text-rose-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer hover:bg-rose-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>SINKRON</span>
          </button>
        </div>
      )}

      {/* PWA Install Button */}
      {showInstallBtn && (
        <div className="bg-blue-900 text-white p-3 rounded-2xl shadow-xl border border-blue-700 flex items-center justify-between gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-300 shrink-0" />
            <span className="text-xs font-bold">Install Aplikasi Penilaian di HP</span>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>INSTALL</span>
          </button>
        </div>
      )}

    </div>
  );
};
