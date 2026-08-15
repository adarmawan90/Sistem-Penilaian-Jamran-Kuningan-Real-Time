import { School, Competition, Judge, ScoreRecord, ActivityLog, AppSettings, TeamCategory } from '../types';
import { INITIAL_SCHOOLS, INITIAL_COMPETITIONS, INITIAL_JUDGES, INITIAL_SETTINGS } from '../data/seedData';

const OFFLINE_KEY = 'pramuka_offline_scores_queue';

export class ApiService {
  static async getInitialData() {
    try {
      const res = await fetch('/api/initial-data');
      if (!res.ok) throw new Error(`Failed to fetch initial data: HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data.schools) || data.schools.length === 0) {
        data.schools = INITIAL_SCHOOLS;
      }
      if (!Array.isArray(data.competitions) || data.competitions.length === 0) {
        data.competitions = INITIAL_COMPETITIONS;
      }
      if (!Array.isArray(data.judges) || data.judges.length === 0) {
        data.judges = INITIAL_JUDGES;
      }
      if (!Array.isArray(data.scores)) {
        data.scores = [];
      }
      if (!data.settings || !data.settings.eventTitle) {
        data.settings = INITIAL_SETTINGS;
      }

      // Save authoritative state from server to local persistent storage
      localStorage.setItem('pramuka_scores_backup', JSON.stringify(data.scores));
      localStorage.setItem('pramuka_initial_cache', JSON.stringify(data));

      return data;
    } catch (err) {
      console.warn('Network fetch initial data failed, using local persistent cache and defaults:', err);
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.schools) && parsed.schools.length > 0) {
            return parsed;
          }
        } catch {}
      }
      const backupRaw = localStorage.getItem('pramuka_scores_backup');
      let backupScores: ScoreRecord[] = [];
      if (backupRaw) {
        try {
          backupScores = JSON.parse(backupRaw) || [];
        } catch {}
      }
      return {
        schools: INITIAL_SCHOOLS,
        competitions: INITIAL_COMPETITIONS,
        judges: INITIAL_JUDGES,
        scores: backupScores,
        settings: INITIAL_SETTINGS,
        logs: []
      };
    }
  }

  static async syncMissingScoresToServer(missingScores: ScoreRecord[]) {
    try {
      await fetch('/api/scores/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchScores: missingScores }),
      });
    } catch (err) {
      console.warn('Auto sync missing scores to server failed:', err);
    }
  }

  static async login(username: string, password?: string) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');
    return data;
  }

  static async sendHeartbeat(judgeId: string) {
    try {
      const res = await fetch('/api/judges/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judgeId }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  static async submitScore(payload: {
    schoolId: number;
    teamCategory: TeamCategory;
    competitionId: string;
    subPostId?: string;
    score: number;
    timeInMs: number;
    timeFormatted: string;
    notes?: string;
    judgeId: string;
    judgeName: string;
    posName: string;
  }) {
    // If offline, save to local queue
    if (!navigator.onLine) {
      this.saveOfflineQueue(payload);
      return {
        success: true,
        isOffline: true,
        message: 'Koneksi terputus! Data disimpan lokal di HP dan akan disinkron otomatis saat internet kembali.',
      };
    }

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan nilai');
      }
      return data;
    } catch (err: any) {
      // Network error occurred during fetch
      this.saveOfflineQueue(payload);
      return {
        success: true,
        isOffline: true,
        message: 'Koneksi lambat/terputus! Data tersimpan di penyimpanan lokal.',
      };
    }
  }

  static saveOfflineQueue(payload: any) {
    const queue = this.getOfflineQueue();
    queue.push({
      ...payload,
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  }

  static getOfflineQueue(): any[] {
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static async syncOfflineQueue() {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return { syncedCount: 0 };

    if (!navigator.onLine) return { syncedCount: 0 };

    try {
      const res = await fetch('/api/scores/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchScores: queue }),
      });
      if (res.ok) {
        localStorage.removeItem(OFFLINE_KEY);
        return { syncedCount: queue.length };
      }
    } catch (err) {
      console.error('Offline queue sync failed:', err);
    }
    return { syncedCount: 0 };
  }

  static async deleteScore(scoreId: string) {
    const res = await fetch(`/api/scores/${scoreId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus nilai');
    return data;
  }

  static async saveCompetition(comp: Partial<Competition>) {
    const isEdit = !!comp.id;
    const url = isEdit ? `/api/competitions/${comp.id}` : '/api/competitions';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comp),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan perlombaan');
    return data;
  }

  static async deleteCompetition(id: string) {
    const res = await fetch(`/api/competitions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus perlombaan');
    return data;
  }

  static async saveSchool(school: Partial<School>) {
    const isEdit = !!school.id;
    const url = isEdit ? `/api/schools/${school.id}` : '/api/schools';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(school),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pangkalan');
    return data;
  }

  static async deleteSchool(id: number) {
    const res = await fetch(`/api/schools/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus pangkalan');
    return data;
  }

  static async saveJudge(judge: Partial<Judge>) {
    const isEdit = !!judge.id;
    const url = isEdit ? `/api/judges/${judge.id}` : '/api/judges';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(judge),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan juri');
    return data;
  }

  static async saveJudgesBatch(batchJudges: Partial<Judge>[]) {
    const res = await fetch('/api/judges/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchJudges }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan batch juri');
    return data;
  }

  static async deleteJudge(id: string) {
    const res = await fetch(`/api/judges/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus juri');
    return data;
  }

  static async deleteAllNonAdminJudges() {
    const res = await fetch('/api/judges-all-non-admin', { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus seluruh juri');
    return data;
  }

  static async uploadBatchScores(batchScores: any[]) {
    const res = await fetch('/api/scores/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchScores }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengunggah batch nilai');
    return data;
  }

  static async saveSettings(settings: Partial<AppSettings>) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan');
    return data;
  }

  static async clearAllScores(password: string) {
    const res = await fetch('/api/scores/clear-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus semua nilai');
    localStorage.setItem('pramuka_scores_cleared_timestamp', Date.now().toString());
    localStorage.setItem('pramuka_scores_backup', JSON.stringify([]));
    localStorage.removeItem('pramuka_initial_cache');
    localStorage.removeItem(OFFLINE_KEY);
    return data;
  }

  static async restoreBackup(jsonData: any) {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: jsonData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memulihkan backup');
    return data;
  }

  static async getFirebaseStatus() {
    try {
      const res = await fetch('/api/firebase/status');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil status Firebase');
      return data;
    } catch (err: any) {
      return { configured: false, error: err.message };
    }
  }

  static async syncToFirebase() {
    const res = await fetch('/api/firebase/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyinkronkan data ke Google Firebase');
    return data;
  }

  static async pullFromFirebase() {
    const res = await fetch('/api/firebase/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memuat data dari Google Firebase');
    return data;
  }

  static async getGSheetsStatus() {
    const res = await fetch('/api/gsheets/status');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengambil status Google Sheets');
    return data;
  }

  static async syncGSheets() {
    const res = await fetch('/api/gsheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal sinkronisasi ke Google Sheets');
    return data;
  }

  static subscribeToRealtime(onMessage: (event: string, payload: any) => void) {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime/stream');
      const events = [
        'score_updated',
        'scores_batch_updated',
        'score_deleted',
        'competitions_updated',
        'schools_updated',
        'judges_updated',
        'settings_updated',
        'system_restored',
        'gsheets_synced',
      ];

      events.forEach((evtName) => {
        eventSource?.addEventListener(evtName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onMessage(evtName, data);
          } catch (err) {
            console.error('Error parsing SSE data:', err);
          }
        });
      });
    } catch (e) {
      console.warn('SSE EventSource creation failed, falling back to polling if needed:', e);
    }

    return () => {
      eventSource?.close();
    };
  }
}
