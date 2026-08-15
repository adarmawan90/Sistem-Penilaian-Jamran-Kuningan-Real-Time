import React, { useState, useEffect, useCallback } from 'react';
import { School, Competition, Judge, ScoreRecord, ActivityLog, AppSettings, TeamCategory } from './types';
import { INITIAL_SCHOOLS, INITIAL_COMPETITIONS, INITIAL_JUDGES, INITIAL_SETTINGS } from './data/seedData';
import { ApiService } from './services/apiService';
import { Navbar } from './components/Navbar';
import { JudgePortal } from './components/JudgePortal';
import { AdminDashboard } from './components/AdminDashboard';
import { MasterCompetitions } from './components/MasterCompetitions';
import { MasterSchools } from './components/MasterSchools';
import { MasterJudges } from './components/MasterJudges';
import { RekapView } from './components/RekapView';
import { RankingView } from './components/RankingView';
import { RealtimeMonitor } from './components/RealtimeMonitor';
import { AuditLogView } from './components/AuditLogView';
import { SettingsView } from './components/SettingsView';
import { MyPosScoresView } from './components/MyPosScoresView';
import { LoginModal } from './components/LoginModal';
import { ScoreUploadModal } from './components/ScoreUploadModal';
import { DocumentationModal } from './components/DocumentationModal';
import { PWABanner } from './components/PWABanner';
import { Lock, LogIn, ShieldAlert } from 'lucide-react';

export default function App() {
  const [currentJudge, setCurrentJudge] = useState<Judge | null>(() => {
    try {
      const stored = localStorage.getItem('pramuka_logged_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [judgeCategory, setJudgeCategory] = useState<TeamCategory>(() => {
    try {
      const storedCat = localStorage.getItem('pramuka_logged_category');
      if (storedCat === 'PUTRA' || storedCat === 'PUTRI') return storedCat;
      const stored = localStorage.getItem('pramuka_logged_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.assignedCategory === 'PUTRI') return 'PUTRI';
      }
    } catch {}
    return 'PUTRA';
  });

  const [selectedSchoolForJudgeInput, setSelectedSchoolForJudgeInput] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const storedUser = localStorage.getItem('pramuka_logged_user');
      const savedTab = localStorage.getItem('pramuka_active_tab');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === 'JUDGE') {
          // If judge was in a valid judge tab, keep it, otherwise default to judge_portal (input nilai)
          if (savedTab && ['judge_portal', 'my_pos_scores', 'realtime_monitor', 'rekap'].includes(savedTab)) {
            return savedTab;
          }
          return 'judge_portal';
        }
        if (parsed.role === 'ADMIN') {
          return savedTab || 'dashboard';
        }
      }
      return savedTab || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  // Data Collections (initialized with instant local data so UI is never blank)
  const [schools, setSchools] = useState<School[]>(() => {
    try {
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.schools && parsed.schools.length > 0) return parsed.schools;
      }
    } catch {}
    return INITIAL_SCHOOLS;
  });

  const [competitions, setCompetitions] = useState<Competition[]>(() => {
    try {
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.competitions && parsed.competitions.length > 0) return parsed.competitions;
      }
    } catch {}
    return INITIAL_COMPETITIONS;
  });

  const [judges, setJudges] = useState<Judge[]>(() => {
    try {
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.judges && parsed.judges.length > 0) return parsed.judges;
      }
    } catch {}
    return INITIAL_JUDGES;
  });

  const [scores, setScores] = useState<ScoreRecord[]>(() => {
    try {
      const backup = localStorage.getItem('pramuka_scores_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed)) return parsed;
      }
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.scores)) return parsed.scores;
      }
    } catch {}
    return [];
  });

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.settings && parsed.settings.eventTitle) return parsed.settings;
      }
    } catch {}
    return INITIAL_SETTINGS;
  });

  // System UI States
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(() => {
    // Open login modal only if no logged user is stored
    return !localStorage.getItem('pramuka_logged_user');
  });
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [docsModalOpen, setDocsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Persist activeTab whenever it changes
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('pramuka_active_tab', activeTab);
    }
  }, [activeTab]);

  // Public mode tab guard (only when NO user is logged in)
  useEffect(() => {
    if (!currentJudge) {
      const allowed: string[] = [];
      if (settings.publicShowRekap !== false) allowed.push('rekap');
      if (settings.publicShowRanking) allowed.push('ranking');
      if (settings.publicShowMonitor) allowed.push('realtime_monitor');

      if (allowed.length > 0) {
        if (!allowed.includes(activeTab)) {
          setActiveTab(allowed[0]);
        }
      } else {
        if (activeTab !== 'locked_public') {
          setActiveTab('locked_public');
        }
      }
    }
  }, [currentJudge, activeTab, settings.publicShowRekap, settings.publicShowRanking, settings.publicShowMonitor]);

  // Periodic Heartbeat for active judge session
  useEffect(() => {
    if (!currentJudge) return;
    const sendBeat = () => {
      ApiService.sendHeartbeat(currentJudge.id);
    };
    sendBeat();
    const timer = setInterval(sendBeat, 10000);
    return () => clearInterval(timer);
  }, [currentJudge]);

  // Load Data
  const loadInitialData = useCallback(async () => {
    // 1. Load instantly from local storage cache if available so UI never resets on restart
    const localCached = localStorage.getItem('pramuka_initial_cache');
    if (localCached) {
      try {
        const parsed = JSON.parse(localCached);
        if (parsed.schools) setSchools(parsed.schools);
        if (parsed.competitions) setCompetitions(parsed.competitions);
        if (parsed.judges) setJudges(parsed.judges);
        if (parsed.scores) setScores(parsed.scores);
        if (parsed.logs) setLogs(parsed.logs);
        if (parsed.settings) setSettings(parsed.settings);
      } catch (e) {
        console.warn('Initial cache parse error:', e);
      }
    }

    // 2. Fetch fresh data from server and merge
    try {
      const data = await ApiService.getInitialData();
      if (data.schools && data.schools.length > 0) setSchools(data.schools);
      if (data.competitions && data.competitions.length > 0) setCompetitions(data.competitions);
      if (data.judges && data.judges.length > 0) setJudges(data.judges);
      if (Array.isArray(data.scores)) setScores(data.scores);
      if (Array.isArray(data.logs)) setLogs(data.logs);
      if (data.settings && data.settings.eventTitle) setSettings(data.settings);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Offline queue check
  const updateOfflineCount = useCallback(() => {
    const queue = ApiService.getOfflineQueue();
    setOfflineCount(queue.length);
  }, []);

  const handleSyncOfflineData = useCallback(async () => {
    const res = await ApiService.syncOfflineQueue();
    updateOfflineCount();
    if (res.syncedCount > 0) {
      loadInitialData();
    }
  }, [loadInitialData, updateOfflineCount]);

  useEffect(() => {
    loadInitialData();
    updateOfflineCount();

    // Default auto login as Admin if not logged in
    const storedJudge = localStorage.getItem('pramuka_logged_user');
    if (storedJudge) {
      try {
        const parsed = JSON.parse(storedJudge);
        setCurrentJudge(parsed);
        const savedTab = localStorage.getItem('pramuka_active_tab');
        if (!savedTab && parsed.role === 'JUDGE') {
          setActiveTab('judge_portal');
        }
      } catch {
        setLoginModalOpen(true);
      }
    } else {
      setLoginModalOpen(true);
    }

    // Network Online/Offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      handleSyncOfflineData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to SSE Real-time Updates
    const unsubscribeSSE = ApiService.subscribeToRealtime((event, payload) => {
      if (event === 'score_updated') {
        setScores((prev) => {
          const idx = prev.findIndex((s) => s.id === payload.scoreRecord.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = payload.scoreRecord;
            return next;
          }
          return [payload.scoreRecord, ...prev];
        });
        if (payload.logItem) {
          setLogs((prev) => [payload.logItem, ...prev]);
        }
      } else if (event === 'score_deleted') {
        setScores((prev) => prev.filter((s) => s.id !== payload.id));
      } else if (event === 'competitions_updated') {
        setCompetitions(payload);
      } else if (event === 'schools_updated') {
        setSchools(payload);
      } else if (event === 'judges_updated') {
        setJudges(payload);
      } else if (event === 'settings_updated') {
        setSettings(payload);
      } else if (event === 'scores_batch_updated') {
        if (payload?.type === 'CLEAR_ALL') {
          setScores([]);
          localStorage.setItem('pramuka_scores_backup', JSON.stringify([]));
          localStorage.removeItem('pramuka_initial_cache');
        } else {
          loadInitialData();
        }
      } else if (event === 'system_restored') {
        loadInitialData();
      }
    });

    // Lightweight periodic refresh for serverless environments (Vercel)
    const intervalTimer = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        ApiService.getInitialData().then((freshData) => {
          if (freshData) {
            if (freshData.schools && freshData.schools.length > 0) setSchools(freshData.schools);
            if (freshData.competitions && freshData.competitions.length > 0) setCompetitions(freshData.competitions);
            if (freshData.judges && freshData.judges.length > 0) setJudges(freshData.judges);
            if (Array.isArray(freshData.scores)) setScores(freshData.scores);
            if (Array.isArray(freshData.logs)) setLogs(freshData.logs);
            if (freshData.settings && freshData.settings.eventTitle) setSettings(freshData.settings);
          }
        }).catch(() => {});
      }
    }, 8000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalTimer);
      unsubscribeSSE();
    };
  }, [loadInitialData, handleSyncOfflineData, updateOfflineCount]);

  // Backup scores to localStorage whenever scores state updates
  useEffect(() => {
    if (scores) {
      localStorage.setItem('pramuka_scores_backup', JSON.stringify(scores));
    }
  }, [scores]);

  const handleLoginSuccess = async (user: Judge, selectedCategory?: TeamCategory) => {
    setCurrentJudge(user);
    const categoryToSet = selectedCategory || (user.assignedCategory === 'PUTRI' ? 'PUTRI' : 'PUTRA');
    setJudgeCategory(categoryToSet);
    localStorage.setItem('pramuka_logged_user', JSON.stringify(user));
    localStorage.setItem('pramuka_logged_category', categoryToSet);
    setLoginModalOpen(false);

    // Always fetch latest saved scores and data from database upon login
    await loadInitialData();

    if (user.role === 'ADMIN') {
      setActiveTab('dashboard');
      localStorage.setItem('pramuka_active_tab', 'dashboard');
    } else {
      setActiveTab('judge_portal');
      localStorage.setItem('pramuka_active_tab', 'judge_portal');
    }
  };

  const handleSwitchUser = () => {
    localStorage.removeItem('pramuka_logged_user');
    localStorage.removeItem('pramuka_logged_category');
    localStorage.removeItem('pramuka_active_tab');
    setCurrentJudge(null);
    setLoginModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-950 text-amber-300 font-black text-3xl flex items-center justify-center shadow-xl animate-pulse mb-4">
          ⚜️
        </div>
        <h1 className="text-lg font-black text-slate-800 tracking-tight">MEMUAT SISTEM PENILAIAN LOMBA PRAMUKA...</h1>
        <p className="text-xs text-slate-500 mt-1">Menyiapkan database 55 pangkalan dan real-time stream...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-blue-200">
      
      {/* Navbar */}
      <Navbar
        currentJudge={currentJudge}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        isOnline={isOnline}
        offlineCount={offlineCount}
        onSyncOffline={handleSyncOfflineData}
        onSwitchUser={handleSwitchUser}
        onOpenDocs={() => setDocsModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="pb-12">
        {!currentJudge && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-950 px-4 py-2.5 shadow-sm border-b border-amber-300">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs font-bold flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-base">📢</span>
                <span>
                  Mode Pengunjung (Publik): Rekapitulasi Nilai Lomba Terupdate Real-Time.
                  {settings.publicShowRanking && ' • Ranking Aktif'}
                  {settings.publicShowMonitor && ' • Status Pos Aktif'}
                </span>
              </div>
              <button
                onClick={() => setLoginModalOpen(true)}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 rounded-lg text-xs font-black shadow-sm transition-all cursor-pointer"
              >
                🔑 Login Juri / Admin
              </button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <AdminDashboard
            schools={schools}
            competitions={competitions}
            judges={judges}
            scores={scores}
            logs={logs}
            onNavigateTab={setActiveTab}
            onOpenUploadModal={() => setUploadModalOpen(true)}
          />
        )}

        {activeTab === 'judge_portal' && currentJudge && (
          <JudgePortal
            currentJudge={currentJudge}
            competitions={competitions}
            schools={schools}
            scores={scores}
            settings={settings}
            initialCategory={judgeCategory}
            selectedSchoolIdProp={selectedSchoolForJudgeInput}
            onScoreSaved={() => {
              updateOfflineCount();
              setSelectedSchoolForJudgeInput(null);
              loadInitialData();
            }}
          />
        )}

        {activeTab === 'my_pos_scores' && currentJudge && (
          <MyPosScoresView
            currentJudge={currentJudge}
            schools={schools}
            competitions={competitions}
            scores={scores}
            onRefresh={loadInitialData}
            onNavigateToInput={(schoolId, category) => {
              setSelectedSchoolForJudgeInput(schoolId);
              setJudgeCategory(category);
              setActiveTab('judge_portal');
            }}
          />
        )}

        {activeTab === 'master_competitions' && (
          <MasterCompetitions competitions={competitions} onRefresh={loadInitialData} />
        )}

        {activeTab === 'master_schools' && (
          <MasterSchools schools={schools} onRefresh={loadInitialData} />
        )}

        {activeTab === 'master_judges' && (
          <MasterJudges judges={judges} competitions={competitions} onRefresh={loadInitialData} />
        )}

        {activeTab === 'rekap' && (
          currentJudge?.role === 'ADMIN' ||
          (currentJudge?.role === 'JUDGE' && !!settings.judgeShowRekap) ||
          (!currentJudge && settings.publicShowRekap !== false)
        ) && (
          <RekapView
            schools={schools}
            competitions={competitions}
            scores={scores}
            onOpenUploadModal={() => setUploadModalOpen(true)}
          />
        )}

        {activeTab === 'locked_public' && !currentJudge && (
          <div className="max-w-md mx-auto my-16 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Rekapitulasi Nilai Ditutup</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tampilan menu rekapitulasi nilai saat ini dinonaktifkan untuk akses publik oleh Administrator. Silakan masuk menggunakan akun Juri atau Admin untuk bertugas.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-amber-300" />
                <span>LOGIN PETUGAS / JURI</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ranking' && (
          <RankingView
            schools={schools}
            competitions={competitions}
            scores={scores}
            settings={settings}
            currentJudge={currentJudge}
            onRefresh={loadInitialData}
          />
        )}

        {activeTab === 'realtime_monitor' && (
          <RealtimeMonitor schools={schools} competitions={competitions} scores={scores} />
        )}

        {activeTab === 'audit_logs' && <AuditLogView logs={logs} />}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onRefresh={loadInitialData}
            onOpenDocs={() => setDocsModalOpen(true)}
            onOpenUploadModal={() => setUploadModalOpen(true)}
          />
        )}
      </main>

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        judges={judges}
        competitions={competitions}
        onLoginSuccess={handleLoginSuccess}
        onViewPublicRekap={() => {
          setLoginModalOpen(false);
          setActiveTab('rekap');
        }}
        onClose={() => {
          if (currentJudge) setLoginModalOpen(false);
        }}
      />

      {/* Score Upload Modal (Excel Auto Fill) */}
      <ScoreUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        schools={schools}
        competitions={competitions}
        onUploadSuccess={loadInitialData}
      />

      {/* Documentation Modal */}
      <DocumentationModal isOpen={docsModalOpen} onClose={() => setDocsModalOpen(false)} />

      {/* Floating PWA & Offline Banner */}
      <PWABanner isOnline={isOnline} offlineCount={offlineCount} onSyncOffline={handleSyncOfflineData} />

    </div>
  );
}
