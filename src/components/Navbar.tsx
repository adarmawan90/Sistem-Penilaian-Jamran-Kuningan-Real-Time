import React, { useState } from 'react';
import { Judge, AppSettings } from '../types';
import { LayoutDashboard, Database, Trophy, FileText, History, Settings, LogOut, Wifi, WifiOff, RefreshCw, BarChart3, HelpCircle, Shield, Menu, X, Users, Compass, Eye, ListOrdered } from 'lucide-react';

interface NavbarProps {
  currentJudge: Judge | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: AppSettings;
  isOnline: boolean;
  offlineCount: number;
  onSyncOffline: () => void;
  onSwitchUser: () => void;
  onOpenDocs: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentJudge,
  activeTab,
  setActiveTab,
  settings,
  isOnline,
  offlineCount,
  onSyncOffline,
  onSwitchUser,
  onOpenDocs,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = currentJudge?.role === 'ADMIN';

  const navItems = currentJudge
    ? isAdmin
      ? [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'master_competitions', label: 'Perlombaan', icon: Trophy },
          { id: 'master_schools', label: 'Pangkalan', icon: Users },
          { id: 'master_judges', label: 'Juri', icon: Shield },
          { id: 'realtime_monitor', label: 'Monitor', icon: Eye },
          { id: 'rekap', label: 'Rekap Nilai', icon: FileText },
          { id: 'ranking', label: 'Ranking', icon: BarChart3 },
          { id: 'audit_logs', label: 'Riwayat Log', icon: History },
          { id: 'settings', label: 'Pengaturan', icon: Settings },
        ]
      : [
          { id: 'judge_portal', label: 'Input Penilaian', icon: FileText },
          { id: 'my_pos_scores', label: 'Daftar Nilai Pos', icon: ListOrdered },
          { id: 'realtime_monitor', label: 'Status Pos', icon: Eye },
          ...(settings.judgeShowRekap ? [{ id: 'rekap', label: 'Rekap Nilai', icon: FileText }] : []),
        ]
    : [
        ...(settings.publicShowRekap !== false ? [{ id: 'rekap', label: 'Rekap Nilai', icon: FileText }] : []),
        ...(settings.publicShowRanking ? [{ id: 'ranking', label: 'Ranking', icon: BarChart3 }] : []),
        ...(settings.publicShowMonitor ? [{ id: 'realtime_monitor', label: 'Status Pos', icon: Eye }] : []),
      ];

  return (
    <header className="sticky top-0 z-40 bg-blue-950 text-white shadow-md border-b border-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 flex items-center justify-center shadow-md text-blue-950 font-black text-xl tracking-tighter">
              ⚜️
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white leading-tight line-clamp-1">
                {settings.eventTitle || 'Sistem Penilaian Lomba Pramuka'}
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-blue-300">
                <span className="font-semibold text-amber-300">55 Pangkalan</span>
                <span>•</span>
                <span className="capitalize text-sky-200">
                  {currentJudge ? (isAdmin ? 'Mode Admin' : `Juri ${currentJudge?.name || currentJudge?.username || 'Petugas'}`) : 'Akses Publik (Read-Only)'}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-800 text-white shadow-sm border border-blue-700'
                      : 'text-blue-200 hover:text-white hover:bg-blue-900/60'
                  }`}
                >
                  <Icon className="w-4 h-4 text-sky-300" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Actions & Status */}
          <div className="flex items-center gap-2">
            
            {/* Helpdesk WA Button */}
            <a
              href="https://wa.me/6289625029588"
              target="_blank"
              rel="noopener noreferrer"
              title="Helpdesk WA Admin: 089625029588"
              className="px-2.5 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-emerald-600 shadow-2xs"
            >
              <span>💬</span>
              <span className="hidden md:inline">Helpdesk: 089625029588</span>
              <span className="md:hidden">Helpdesk</span>
            </a>

            {/* Documentation Button */}
            <button
              onClick={onOpenDocs}
              title="Dokumentasi System & Diagrams"
              className="px-2.5 py-1.5 rounded-lg bg-blue-900/80 hover:bg-blue-800 text-sky-200 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all border border-blue-800 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Dokumentasi</span>
            </button>

            {/* Network Sync Status Indicator */}
            {isOnline ? (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-semibold">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>ONLINE</span>
              </div>
            ) : (
              <button
                onClick={onSyncOffline}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 font-bold animate-pulse cursor-pointer"
              >
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span>OFFLINE ({offlineCount})</span>
                <RefreshCw className="w-3 h-3 ml-1" />
              </button>
            )}

            {/* Switch User / Login Button */}
            <button
              onClick={onSwitchUser}
              className={`p-2 sm:px-3.5 sm:py-1.5 rounded-lg font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                currentJudge
                  ? 'bg-amber-500 hover:bg-amber-400 text-blue-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-300'
              }`}
              title={currentJudge ? 'Ganti Pengguna / Logout' : 'Login Sebagai Juri atau Admin'}
            >
              {currentJudge ? <LogOut className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              <span className="hidden sm:inline">{currentJudge ? 'Ganti Akun' : 'Login Juri / Admin'}</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-blue-200 hover:text-white hover:bg-blue-900 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-blue-950 border-t border-blue-900 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-all ${
                  isActive
                    ? 'bg-blue-800 text-white border border-blue-700'
                    : 'text-blue-200 hover:bg-blue-900'
                }`}
              >
                <Icon className="w-5 h-5 text-sky-400" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
