import { School, Competition, Judge, ScoreRecord, ActivityLog, AppSettings, TeamCategory } from '../types';
import { INITIAL_SCHOOLS, INITIAL_COMPETITIONS, INITIAL_JUDGES, INITIAL_SETTINGS } from '../data/seedData';

const OFFLINE_KEY = 'pramuka_offline_scores_queue';

/**
 * Helper to safely execute fetch and parse JSON without crashing on HTML 500 error pages (like Vercel).
 */
async function safeFetch(url: string, options?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'Server offline / Cold start' };
    }

    if (!res.ok) {
      let errorMsg = data?.error || data?.message || `Server status ${res.status}`;
      if (typeof errorMsg === 'string' && (errorMsg.includes('server error') || errorMsg.includes('Unexpected token') || errorMsg.includes('valid JSON'))) {
        errorMsg = 'Layanan server sedang offline. Aplikasi berjalan dalam mode lokal.';
      }
      throw new Error(errorMsg);
    }

    return data;
  } catch (err: any) {
    let msg = err?.message || 'Koneksi server gagal';
    if (typeof msg === 'string' && (msg.includes('Unexpected token') || msg.includes('valid JSON') || msg.includes('server error'))) {
      msg = 'Koneksi server tidak tersedia. Menggunakan data lokal.';
    }
    throw new Error(msg);
  }
}

export class ApiService {
  static async getInitialData() {
    try {
      const data = await safeFetch('/api/initial-data');

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
        logs: [],
      };
    }
  }

  static async syncMissingScoresToServer(missingScores: ScoreRecord[]) {
    try {
      await safeFetch('/api/scores/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchScores: missingScores }),
      });
    } catch (err) {
      console.warn('Auto sync missing scores to server failed:', err);
    }
  }

  static async login(username: string, password?: string, localJudges?: Judge[]) {
    try {
      const data = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (data && data.user) {
        return data;
      }
    } catch {
      // Continue to local offline authentication fallback
    }

    // Local authentication fallback (Offline & Serverless resilient)
    const cleanUser = username.trim().toLowerCase();
    let candidateList: Judge[] = [];

    if (localJudges && localJudges.length > 0) {
      candidateList = candidateList.concat(localJudges);
    }
    candidateList = candidateList.concat(INITIAL_JUDGES);

    // Try reading cached judges from localStorage
    try {
      const cached = localStorage.getItem('pramuka_initial_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.judges && Array.isArray(parsed.judges)) {
          candidateList = candidateList.concat(parsed.judges);
        }
      }
    } catch {}

    const localJudge = candidateList.find(
      (j) => j && j.username && j.username.toLowerCase() === cleanUser && j.isActive
    );

    if (localJudge) {
      const expected = (localJudge.password || localJudge.passwordHash || (localJudge.role === 'ADMIN' ? 'admin123' : 'juri123')).trim();
      const entered = (password || '').trim();
      if (!entered || entered === expected) {
        return {
          success: true,
          user: localJudge,
          token: `jwt-local-${localJudge.id}-${Date.now()}`,
        };
      } else {
        throw new Error('Password tidak sesuai. Silakan periksa kembali password Anda.');
      }
    }

    throw new Error('Username tidak ditemukan. Gunakan username terdaftar seperti admin atau juri_tenda.');
  }

  static async sendHeartbeat(judgeId: string) {
    try {
      return await safeFetch('/api/judges/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judgeId }),
      });
    } catch {
      return null;
    }
  }

  static updateLocalScoresCache(record: ScoreRecord) {
    try {
      const raw = localStorage.getItem('pramuka_scores_backup');
      let list: ScoreRecord[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      const idx = list.findIndex((s) => {
        if (s.schoolId === record.schoolId && s.teamCategory === record.teamCategory && s.competitionId === record.competitionId) {
          if (record.subPostId) return s.subPostId === record.subPostId;
          return !s.subPostId;
        }
        return false;
      });
      if (idx >= 0) {
        list[idx] = record;
      } else {
        list.push(record);
      }
      localStorage.setItem('pramuka_scores_backup', JSON.stringify(list));
    } catch {}
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
    // If offline, save to local queue and local backup
    if (!navigator.onLine) {
      const offlineRecord: ScoreRecord = {
        id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        schoolId: payload.schoolId,
        teamCategory: payload.teamCategory,
        competitionId: payload.competitionId,
        subPostId: payload.subPostId,
        score: payload.score,
        timeInMs: payload.timeInMs,
        timeFormatted: payload.timeFormatted,
        notes: payload.notes || '',
        judgeId: payload.judgeId,
        judgeName: payload.judgeName,
        posName: payload.posName,
        timestamp: new Date().toISOString(),
      };
      this.updateLocalScoresCache(offlineRecord);
      this.saveOfflineQueue(payload);
      return {
        success: true,
        isOffline: true,
        scoreRecord: offlineRecord,
        message: 'Koneksi terputus! Data disimpan lokal di HP dan akan disinkron otomatis saat internet kembali.',
      };
    }

    try {
      const data = await safeFetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (data && data.scoreRecord) {
        this.updateLocalScoresCache(data.scoreRecord);
      }
      return data;
    } catch (err: any) {
      // Network error occurred during fetch
      const offlineRecord: ScoreRecord = {
        id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        schoolId: payload.schoolId,
        teamCategory: payload.teamCategory,
        competitionId: payload.competitionId,
        subPostId: payload.subPostId,
        score: payload.score,
        timeInMs: payload.timeInMs,
        timeFormatted: payload.timeFormatted,
        notes: payload.notes || '',
        judgeId: payload.judgeId,
        judgeName: payload.judgeName,
        posName: payload.posName,
        timestamp: new Date().toISOString(),
      };
      this.updateLocalScoresCache(offlineRecord);
      this.saveOfflineQueue(payload);
      return {
        success: true,
        isOffline: true,
        scoreRecord: offlineRecord,
        message: 'Koneksi lambat/terputus! Data tersimpan aman di penyimpanan lokal.',
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
      const res = await safeFetch('/api/scores/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchScores: queue }),
      });
      if (res.success || res.synced) {
        localStorage.removeItem(OFFLINE_KEY);
        return { syncedCount: queue.length };
      }
    } catch (err) {
      console.error('Offline queue sync failed:', err);
    }
    return { syncedCount: 0 };
  }

  static async deleteScore(scoreId: string) {
    return await safeFetch(`/api/scores/${scoreId}`, { method: 'DELETE' });
  }

  static async saveCompetition(comp: Partial<Competition>) {
    const isEdit = !!comp.id;
    const url = isEdit ? `/api/competitions/${comp.id}` : '/api/competitions';
    const method = isEdit ? 'PUT' : 'POST';

    return await safeFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comp),
    });
  }

  static async deleteCompetition(id: string) {
    return await safeFetch(`/api/competitions/${id}`, { method: 'DELETE' });
  }

  static async saveSchool(school: Partial<School>) {
    const isEdit = !!school.id;
    const url = isEdit ? `/api/schools/${school.id}` : '/api/schools';
    const method = isEdit ? 'PUT' : 'POST';

    return await safeFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(school),
    });
  }

  static async deleteSchool(id: number) {
    return await safeFetch(`/api/schools/${id}`, { method: 'DELETE' });
  }

  static async saveJudge(judge: Partial<Judge>) {
    const isEdit = !!judge.id;
    const url = isEdit ? `/api/judges/${judge.id}` : '/api/judges';
    const method = isEdit ? 'PUT' : 'POST';

    return await safeFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(judge),
    });
  }

  static async saveJudgesBatch(batchJudges: Partial<Judge>[]) {
    return await safeFetch('/api/judges/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchJudges }),
    });
  }

  static async deleteJudge(id: string) {
    return await safeFetch(`/api/judges/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  static async deleteAllNonAdminJudges() {
    return await safeFetch('/api/judges-all-non-admin', { method: 'DELETE' });
  }

  static async uploadBatchScores(batchScores: any[]) {
    return await safeFetch('/api/scores/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchScores }),
    });
  }

  static async saveSettings(settings: Partial<AppSettings>) {
    return await safeFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  }

  static async clearAllScores(password: string) {
    const data = await safeFetch('/api/scores/clear-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    localStorage.setItem('pramuka_scores_cleared_timestamp', Date.now().toString());
    localStorage.setItem('pramuka_scores_backup', JSON.stringify([]));
    localStorage.removeItem('pramuka_initial_cache');
    localStorage.removeItem(OFFLINE_KEY);
    return data;
  }

  static async restoreBackup(jsonData: any) {
    return await safeFetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: jsonData }),
    });
  }

  static async getFirebaseStatus() {
    try {
      return await safeFetch('/api/firebase/status');
    } catch (err: any) {
      return { configured: false, error: err.message };
    }
  }

  static async syncToFirebase() {
    return await safeFetch('/api/firebase/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static async pullFromFirebase() {
    return await safeFetch('/api/firebase/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static async getGSheetsStatus() {
    return await safeFetch('/api/gsheets/status');
  }

  static async syncGSheets() {
    return await safeFetch('/api/gsheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
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
