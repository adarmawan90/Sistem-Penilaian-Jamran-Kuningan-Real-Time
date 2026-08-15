import fs from 'fs';
import path from 'path';
import { School, Competition, Judge, ScoreRecord, ActivityLog, AppSettings } from '../types';

export interface FirebaseConfig {
  projectId: string;
  appId?: string;
  apiKey: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  projectId: 'gold-adviser-kpt51',
  appId: '1:503691970585:web:b3946133948c2d07b10288',
  apiKey: 'AIzaSyBNjYjuVho4ZkGFdU4YPh7N_Uyt_zD0KrU',
  authDomain: 'gold-adviser-kpt51.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixsistempenil-eedf6b83-f589-421a-8a2f-7c661c4ea0be',
  storageBucket: 'gold-adviser-kpt51.firebasestorage.app',
  messagingSenderId: '503691970585',
};

export function getFirebaseConfig(): FirebaseConfig {
  // 1. Check environment variables (e.g. Vercel deployment)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      appId: process.env.FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    };
  }

  // 2. Check firebase-applet-config.json file
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.projectId && parsed.apiKey) {
        return {
          ...DEFAULT_FIREBASE_CONFIG,
          ...parsed,
        };
      }
    }
  } catch (err) {
    console.warn('[Firestore] Failed to read firebase-applet-config.json:', err);
  }

  // 3. Fallback to embedded default Firebase configuration
  return DEFAULT_FIREBASE_CONFIG;
}

// Convert JavaScript objects into Firestore REST document fields
export function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convert Firestore REST document fields back to JavaScript objects
export function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

function getDatabasePath(config: FirebaseConfig): string {
  const dbId = (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' && config.firestoreDatabaseId.trim() !== '')
    ? config.firestoreDatabaseId
    : '(default)';
  return `projects/${config.projectId}/databases/${dbId}`;
}

function getBaseUrl(config: FirebaseConfig): string {
  const dbPath = getDatabasePath(config);
  return `https://firestore.googleapis.com/v1/${dbPath}/documents`;
}

// 1. Save or Update Single Document via Firestore REST API
export async function saveDocumentToFirestore(collectionName: string, docId: string, data: any) {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) return;

  const sanitizedId = encodeURIComponent(String(docId).replace(/\//g, '_'));
  const url = `${getBaseUrl(config)}/${collectionName}/${sanitizedId}?key=${config.apiKey}`;
  try {
    const firestoreData = toFirestoreValue(data);
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: firestoreData.mapValue?.fields || {} }),
    });
    if (!resp.ok) {
      const errJson: any = await resp.json().catch(() => ({}));
      console.warn(`[Firestore] Failed to save ${collectionName}/${docId}:`, errJson?.error?.message || resp.statusText);
    }
  } catch (err: any) {
    console.warn(`[Firestore] Error saving ${collectionName}/${docId}:`, err?.message || err);
  }
}

// 2. Delete Single Document from Firestore via REST API
export async function deleteDocumentFromFirestore(collectionName: string, docId: string) {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) return;

  const sanitizedId = encodeURIComponent(String(docId).replace(/\//g, '_'));
  const url = `${getBaseUrl(config)}/${collectionName}/${sanitizedId}?key=${config.apiKey}`;
  try {
    const resp = await fetch(url, { method: 'DELETE' });
    if (!resp.ok && resp.status !== 404) {
      const errJson: any = await resp.json().catch(() => ({}));
      console.warn(`[Firestore] Failed to delete ${collectionName}/${docId}:`, errJson?.error?.message || resp.statusText);
    }
  } catch (err: any) {
    console.warn(`[Firestore] Error deleting ${collectionName}/${docId}:`, err?.message || err);
  }
}

// Entity-specific helpers
export async function saveScoreToFirestore(score: ScoreRecord) {
  return saveDocumentToFirestore('scores', score.id, score);
}

export async function deleteScoreFromFirestore(scoreId: string) {
  return deleteDocumentFromFirestore('scores', scoreId);
}

export async function clearAllScoresInFirestore(scores: ScoreRecord[]) {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) return;

  const dbPath = getDatabasePath(config);
  const commitUrl = `https://firestore.googleapis.com/v1/${dbPath}/documents:commit?key=${config.apiKey}`;

  // Gather doc IDs from both local array and remote collection to ensure no orphan score documents
  const allDocIds = new Set<string>();
  if (Array.isArray(scores)) {
    scores.forEach((s) => s && s.id && allDocIds.add(String(s.id)));
  }

  try {
    const remoteScores = await fetchCollectionFromFirestore('scores');
    if (Array.isArray(remoteScores)) {
      remoteScores.forEach((s) => s && s.id && allDocIds.add(String(s.id)));
    }
  } catch (err) {
    console.warn('[Firestore] Error reading remote scores during clear:', err);
  }

  if (allDocIds.size === 0) return;

  const writes = Array.from(allDocIds).map((id) => ({
    delete: `${dbPath}/documents/scores/${encodeURIComponent(String(id).replace(/\//g, '_'))}`,
  }));

  const chunkSize = 200;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize);
    try {
      await fetch(commitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: chunk }),
      });
    } catch (e) {
      console.warn('[Firestore] Batch score deletion chunk failed:', e);
    }
  }
}

export async function deleteAllNonAdminJudgesInFirestore() {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) return;

  try {
    const remoteJudges = await fetchCollectionFromFirestore('judges');
    if (Array.isArray(remoteJudges)) {
      for (const j of remoteJudges) {
        if (j && j.username !== 'admin') {
          await deleteJudgeFromFirestore(j.id);
        }
      }
    }
  } catch (err) {
    console.warn('[Firestore] Error deleting non-admin judges in Firestore:', err);
  }
}

export async function saveSchoolToFirestore(school: School) {
  return saveDocumentToFirestore('schools', `school_${school.id}`, school);
}

export async function deleteSchoolFromFirestore(schoolId: number | string) {
  return deleteDocumentFromFirestore('schools', `school_${schoolId}`);
}

export async function saveCompetitionToFirestore(comp: Competition) {
  return saveDocumentToFirestore('competitions', comp.id, comp);
}

export async function deleteCompetitionFromFirestore(compId: string) {
  return deleteDocumentFromFirestore('competitions', compId);
}

export async function saveJudgeToFirestore(judge: Judge) {
  return saveDocumentToFirestore('judges', judge.id, judge);
}

export async function deleteJudgeFromFirestore(judgeId: string) {
  return deleteDocumentFromFirestore('judges', judgeId);
}

export async function saveLogToFirestore(log: ActivityLog) {
  return saveDocumentToFirestore('activity_logs', log.id, log);
}

export async function saveSettingsToFirestore(settings: AppSettings) {
  return saveDocumentToFirestore('settings', 'app_settings', {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}

// 3. Sync entire dataset to Firestore via REST Commit Batch (Atomic & High-Performance)
export async function syncAllToFirestore(data: {
  schools: School[];
  competitions: Competition[];
  judges: Judge[];
  scores: ScoreRecord[];
  logs: ActivityLog[];
  settings: AppSettings;
}): Promise<{ success: boolean; syncedCount: number; message: string }> {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) {
    throw new Error('Konfigurasi Firebase belum lengkap (Project ID / API Key tidak ditemukan).');
  }

  const dbPath = getDatabasePath(config);
  const commitUrl = `https://firestore.googleapis.com/v1/${dbPath}/documents:commit?key=${config.apiKey}`;

  const writes: any[] = [];

  // 1. Settings
  writes.push({
    update: {
      name: `${dbPath}/documents/settings/app_settings`,
      fields: toFirestoreValue({
        ...data.settings,
        updatedAt: new Date().toISOString(),
      }).mapValue.fields,
    },
  });

  // 2. Schools
  for (const school of data.schools) {
    writes.push({
      update: {
        name: `${dbPath}/documents/schools/school_${school.id}`,
        fields: toFirestoreValue(school).mapValue.fields,
      },
    });
  }

  // 3. Competitions
  for (const comp of data.competitions) {
    writes.push({
      update: {
        name: `${dbPath}/documents/competitions/${comp.id}`,
        fields: toFirestoreValue(comp).mapValue.fields,
      },
    });
  }

  // 4. Judges
  for (const judge of data.judges) {
    writes.push({
      update: {
        name: `${dbPath}/documents/judges/${judge.id}`,
        fields: toFirestoreValue(judge).mapValue.fields,
      },
    });
  }

  // 5. Scores
  for (const score of data.scores) {
    writes.push({
      update: {
        name: `${dbPath}/documents/scores/${score.id}`,
        fields: toFirestoreValue(score).mapValue.fields,
      },
    });
  }

  // 6. Recent Logs (last 50)
  const recentLogs = data.logs.slice(-50);
  for (const log of recentLogs) {
    writes.push({
      update: {
        name: `${dbPath}/documents/activity_logs/${log.id}`,
        fields: toFirestoreValue(log).mapValue.fields,
      },
    });
  }

  // Chunk writes into batches of 200 (Firestore commit supports max 500)
  const chunkSize = 200;
  let totalCommitted = 0;

  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize);
    try {
      const resp = await fetch(commitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: chunk }),
      });

      if (!resp.ok) {
        const errJson: any = await resp.json().catch(() => ({}));
        const errDetail = errJson?.error?.message || resp.statusText;
        if (resp.status === 404 || errDetail.includes('NOT_FOUND') || errDetail.includes('database')) {
          throw new Error(
            `Database Firestore belum dibuat di Google Firebase Console (${config.projectId}). Buka https://console.firebase.google.com/project/${config.projectId}/firestore dan klik "Create Database".`
          );
        }
        if (resp.status === 403 || errDetail.includes('PERMISSION_DENIED') || errDetail.includes('API has not been used')) {
          throw new Error(
            `Cloud Firestore API belum aktif atau Security Rules membatasi akses pada proyek "${config.projectId}". Silakan aktifkan Firestore di Firebase Console dan atur Security Rules.`
          );
        }
        throw new Error(`Firestore Error (${resp.status}): ${errDetail}`);
      }

      totalCommitted += chunk.length;
    } catch (err: any) {
      console.warn('[Firestore] Batch commit error:', err.message || err);
      throw err;
    }
  }

  return {
    success: true,
    syncedCount: totalCommitted,
    message: `Berhasil menyinkronkan ${totalCommitted} dokumen ke Google Cloud Firestore (${config.projectId})!`,
  };
}

// 4. Fetch collection documents from Firestore via REST runQuery
async function fetchCollectionFromFirestore(collectionName: string): Promise<any[]> {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) return [];

  const dbPath = getDatabasePath(config);
  const url = `https://firestore.googleapis.com/v1/${dbPath}/documents:runQuery?key=${config.apiKey}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          limit: 1000,
        },
      }),
    });
    if (!resp.ok) {
      return [];
    }
    const data: any = await resp.json();
    if (!Array.isArray(data)) {
      return [];
    }

    const items: any[] = [];
    for (const item of data) {
      if (item.document && item.document.fields) {
        const rawFields = item.document.fields;
        const obj: Record<string, any> = {};
        for (const [key, val] of Object.entries(rawFields)) {
          obj[key] = fromFirestoreValue(val);
        }
        items.push(obj);
      }
    }
    return items;
  } catch (err: any) {
    console.warn(`[Firestore] Error fetching collection ${collectionName}:`, err?.message || err);
    return [];
  }
}

// 5. Fetch all data from Firestore
export async function fetchAllFromFirestore(): Promise<{
  schools?: School[];
  competitions?: Competition[];
  judges?: Judge[];
  scores?: ScoreRecord[];
  logs?: ActivityLog[];
  settings?: AppSettings;
} | null> {
  const config = getFirebaseConfig();
  if (!config || !config.projectId || !config.apiKey) return null;

  try {
    const [schools, comps, judges, scores, logs, settingsList] = await Promise.all([
      fetchCollectionFromFirestore('schools'),
      fetchCollectionFromFirestore('competitions'),
      fetchCollectionFromFirestore('judges'),
      fetchCollectionFromFirestore('scores'),
      fetchCollectionFromFirestore('activity_logs'),
      fetchCollectionFromFirestore('settings'),
    ]);

    const result: any = {};
    if (schools.length > 0) result.schools = schools;
    if (comps.length > 0) result.competitions = comps;
    if (judges.length > 0) result.judges = judges;
    result.scores = scores;
    result.logs = logs;
    if (settingsList.length > 0) {
      result.settings = settingsList.find((s) => s.id === 'app_settings') || settingsList[0];
    }

    const hasData = (schools.length > 0 || comps.length > 0 || judges.length > 0 || scores.length > 0 || settingsList.length > 0);
    return hasData ? result : null;
  } catch (err: any) {
    console.warn('[Firestore] fetchAllFromFirestore error:', err?.message || err);
    return null;
  }
}
