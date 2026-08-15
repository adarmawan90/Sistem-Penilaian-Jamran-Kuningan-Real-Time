import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { INITIAL_SCHOOLS, INITIAL_COMPETITIONS, INITIAL_JUDGES, INITIAL_SETTINGS } from './src/data/seedData';
import { School, Competition, Judge, ScoreRecord, ActivityLog, AppSettings } from './src/types';
import { syncDataToGoogleSheets } from './src/server/googleSheetsService';
import {
  getFirebaseConfig,
  syncAllToFirestore,
  saveScoreToFirestore,
  deleteScoreFromFirestore,
  saveLogToFirestore,
  saveSettingsToFirestore,
  saveSchoolToFirestore,
  deleteSchoolFromFirestore,
  saveCompetitionToFirestore,
  deleteCompetitionFromFirestore,
  saveJudgeToFirestore,
  deleteJudgeFromFirestore,
  deleteAllNonAdminJudgesInFirestore,
  clearAllScoresInFirestore,
  fetchAllFromFirestore,
} from './src/server/firestoreService';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// CORS and Preflight headers for cross-origin or local requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Check if running in serverless environment
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NOW_REGION
);

// File persistence path (defaults safely to os.tmpdir() to prevent EROFS on read-only environments)
const DATA_FILE = path.join(os.tmpdir(), 'pramuka_data_storage.json');

// Memory Database
let schoolsData: School[] = [...INITIAL_SCHOOLS];
let competitionsData: Competition[] = [...INITIAL_COMPETITIONS];
let judgesData: Judge[] = [...INITIAL_JUDGES];
let scoresData: ScoreRecord[] = [];
let logsData: ActivityLog[] = [];
let settingsData: AppSettings = { ...INITIAL_SETTINGS };

// Load persistent data if exists
function loadStorage() {
  try {
    let raw: string | null = null;
    if (fs.existsSync(DATA_FILE)) {
      raw = fs.readFileSync(DATA_FILE, 'utf-8');
    } else if (fs.existsSync(path.join(process.cwd(), 'data_storage.json'))) {
      raw = fs.readFileSync(path.join(process.cwd(), 'data_storage.json'), 'utf-8');
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.schools && parsed.schools.length > 0) schoolsData = parsed.schools;
      if (parsed.competitions && parsed.competitions.length > 0) competitionsData = parsed.competitions;
      if (parsed.judges && parsed.judges.length > 0) judgesData = parsed.judges;
      if (parsed.scores) scoresData = parsed.scores;
      if (parsed.logs) logsData = parsed.logs;
      if (parsed.settings) settingsData = parsed.settings;
      console.log('Loaded data storage successfully.');
    } else {
      seedSampleScores();
      saveStorage();
    }
  } catch (err) {
    console.error('Error loading storage, using initial defaults:', err);
  }
}

function saveStorage() {
  try {
    const payload = {
      schools: schoolsData,
      competitions: competitionsData,
      judges: judgesData,
      scores: scoresData,
      logs: logsData,
      settings: settingsData,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    try {
      fs.writeFileSync(DATA_FILE, jsonStr, 'utf-8');
    } catch (writeErr) {
      // Memory fallback if filesystem write is not permitted
    }
  } catch (err) {
    console.error('Failed to save data storage:', err);
  }
}

function seedSampleScores() {
  const now = new Date();
  const sampleDataList = [
    { schoolId: 1, teamCategory: 'PUTRA' as const, compId: 'comp-1', score: 92, timeMs: 145000 },
    { schoolId: 1, teamCategory: 'PUTRI' as const, compId: 'comp-1', score: 88, timeMs: 152000 },
    { schoolId: 2, teamCategory: 'PUTRA' as const, compId: 'comp-1', score: 85, timeMs: 160000 },
    { schoolId: 1, teamCategory: 'PUTRA' as const, compId: 'comp-2', score: 95, timeMs: 120000 },
    { schoolId: 2, teamCategory: 'PUTRA' as const, compId: 'comp-2', score: 90, timeMs: 130000 },
    { schoolId: 1, teamCategory: 'PUTRA' as const, compId: 'comp-4', subPostId: 'sub-p1', score: 88, timeMs: 95000 },
    { schoolId: 1, teamCategory: 'PUTRA' as const, compId: 'comp-4', subPostId: 'sub-p2', score: 90, timeMs: 110000 },
    { schoolId: 2, teamCategory: 'PUTRA' as const, compId: 'comp-4', subPostId: 'sub-p1', score: 82, timeMs: 105000 },
  ];

  sampleDataList.forEach((item, idx) => {
    const school = schoolsData.find((s) => s.id === item.schoolId);
    const comp = competitionsData.find((c) => c.id === item.compId);
    let posName = comp?.name || 'Pos';
    if (item.subPostId && comp?.subPosts) {
      const sub = comp.subPosts.find((sp) => sp.id === item.subPostId);
      if (sub) posName = `${comp.name} - ${sub.name}`;
    }

    const minutes = Math.floor(item.timeMs / 60000);
    const seconds = Math.floor((item.timeMs % 60000) / 1000);
    const millis = item.timeMs % 1000;
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(millis).padStart(3, '0')}`;

    const scoreRec: ScoreRecord = {
      id: `score-seed-${idx + 1}`,
      schoolId: item.schoolId,
      teamCategory: item.teamCategory,
      competitionId: item.compId,
      subPostId: item.subPostId,
      score: item.score,
      timeInMs: item.timeMs,
      timeFormatted,
      judgeId: 'juri-1',
      judgeName: 'Juri Demo',
      posName,
      timestamp: new Date(now.getTime() - idx * 60000).toISOString(),
    };
    scoresData.push(scoreRec);

    logsData.push({
      id: `log-seed-${idx + 1}`,
      timestamp: scoreRec.timestamp,
      judgeName: 'Juri Demo',
      posName,
      schoolName: school?.name || 'Unknown',
      teamCategory: item.teamCategory,
      oldScore: null,
      newScore: item.score,
      oldTimeMs: null,
      newTimeMs: item.timeMs,
      device: 'Mobile Web Browser',
      ip: '127.0.0.1',
      actionType: 'CREATE',
    });
  });
}

loadStorage();

// Server Sent Events (SSE) subscribers
type SSESubscriber = { id: string; res: express.Response };
let sseSubscribers: SSESubscriber[] = [];

function broadcastSSE(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseSubscribers.forEach((sub) => {
    try {
      sub.res.write(payload);
    } catch (e) {
      // Ignore dead subscribers
    }
  });
}

// Background Firestore AutoSync
async function triggerBackgroundFirestoreSync() {
  try {
    await syncAllToFirestore({
      schools: schoolsData,
      competitions: competitionsData,
      judges: judgesData,
      scores: scoresData,
      logs: logsData,
      settings: settingsData,
    });
  } catch (err: any) {
    console.warn('[Firestore AutoSync] Warning:', err?.message || err);
  }
}

// Initial Sync & Hydration with Firestore on startup
async function initFirestoreOnBoot() {
  try {
    const pulled = await fetchAllFromFirestore();
    if (pulled && (pulled.schools?.length || pulled.scores?.length || pulled.competitions?.length)) {
      console.log('[Firestore] Successfully hydrated data from Cloud Firestore on boot!');
      if (pulled.schools && pulled.schools.length > 0) schoolsData = pulled.schools;
      if (pulled.competitions && pulled.competitions.length > 0) competitionsData = pulled.competitions;
      if (pulled.judges && pulled.judges.length > 0) judgesData = pulled.judges;
      if (pulled.scores) scoresData = pulled.scores;
      if (pulled.logs) logsData = pulled.logs;
      if (pulled.settings) settingsData = pulled.settings;
      saveStorage();
    } else {
      console.log('[Firestore] No existing cloud dataset, syncing initial dataset to Firestore...');
      await triggerBackgroundFirestoreSync();
    }
  } catch (err: any) {
    console.warn('[Firestore Boot] Note:', err?.message || err);
  }
}

setTimeout(() => {
  initFirestoreOnBoot();
}, 2000);

// Background GSheets AutoSync
async function triggerBackgroundGSheetsSync() {
  if (settingsData.autoGoogleSyncEnabled === false) return;
  if (!process.env.ACCESS_TOKEN) {
    // Silent return if Google OAuth token is not configured on the server
    return;
  }
  try {
    const res = await syncDataToGoogleSheets(
      schoolsData,
      competitionsData,
      scoresData,
      settingsData
    );
    settingsData.googleSpreadsheetId = res.spreadsheetId;
    settingsData.googleSpreadsheetUrl = res.spreadsheetUrl;
    settingsData.lastGoogleSync = res.lastSyncTime;
    saveStorage();
    broadcastSSE('gsheets_synced', {
      spreadsheetId: res.spreadsheetId,
      spreadsheetUrl: res.spreadsheetUrl,
      lastSyncTime: res.lastSyncTime,
    });
  } catch (err: any) {
    console.warn('[GSheets AutoSync] Warning:', err?.message || err);
  }
}

// REST API ROUTES
app.get('/api/health', (req, res) => {
  try {
    res.json({ status: 'ok', time: new Date().toISOString() });
  } catch (err: any) {
    res.status(200).json({ status: 'ok', fallback: true });
  }
});

// Google Sheets Status & Live Sync Endpoints
app.get('/api/gsheets/status', (req, res) => {
  try {
    res.json({
      connected: !!process.env.ACCESS_TOKEN,
      spreadsheetId: settingsData?.googleSpreadsheetId || '',
      spreadsheetUrl: settingsData?.googleSpreadsheetUrl || '',
      lastGoogleSync: settingsData?.lastGoogleSync || null,
      autoGoogleSyncEnabled: settingsData?.autoGoogleSyncEnabled !== false,
    });
  } catch (err: any) {
    res.json({
      connected: false,
      spreadsheetId: '',
      spreadsheetUrl: '',
      lastGoogleSync: null,
      autoGoogleSyncEnabled: true,
    });
  }
});

app.post('/api/gsheets/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!process.env.ACCESS_TOKEN && !bearerToken) {
      return res.status(400).json({
        success: false,
        error: 'OAuth Google belum terhubung. Akses token Google tidak ditemukan.',
      });
    }

    const result = await syncDataToGoogleSheets(
      schoolsData,
      competitionsData,
      scoresData,
      settingsData,
      bearerToken
    );

    settingsData.googleSpreadsheetId = result.spreadsheetId;
    settingsData.googleSpreadsheetUrl = result.spreadsheetUrl;
    settingsData.lastGoogleSync = result.lastSyncTime;
    saveStorage();

    broadcastSSE('gsheets_synced', {
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      lastSyncTime: result.lastSyncTime,
    });

    res.json({
      success: true,
      message: 'Berhasil melakukan sinkronisasi live rekap ke Google Sheets!',
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      lastSyncTime: result.lastSyncTime,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || 'Gagal melakukan sinkronisasi ke Google Sheets.',
    });
  }
});

// Google Firebase Firestore Endpoints
app.get('/api/firebase/status', (req, res) => {
  try {
    const config = getFirebaseConfig();
    res.json({
      configured: !!config?.projectId,
      connected: !!config?.projectId && !!config?.apiKey,
      projectId: config?.projectId || '',
      firestoreDatabaseId: config?.firestoreDatabaseId || '(default)',
      authDomain: config?.authDomain || '',
      storageBucket: config?.storageBucket || '',
      totalScores: scoresData.length,
      totalSchools: schoolsData.length,
      totalCompetitions: competitionsData.length,
      totalJudges: judgesData.length,
    });
  } catch (err: any) {
    res.json({
      configured: false,
      connected: false,
      error: err?.message || 'Firebase config lookup failed',
    });
  }
});

app.post('/api/firebase/sync', async (req, res) => {
  try {
    const result = await syncAllToFirestore({
      schools: schoolsData,
      competitions: competitionsData,
      judges: judgesData,
      scores: scoresData,
      logs: logsData,
      settings: settingsData,
    });
    broadcastSSE('firebase_synced', {
      timestamp: new Date().toISOString(),
      count: result.syncedCount,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(200).json({
      success: false,
      syncedCount: 0,
      error: err?.message || 'Gagal menyinkronkan data ke Google Firebase',
    });
  }
});

app.post('/api/firebase/pull', async (req, res) => {
  try {
    const pulled = await fetchAllFromFirestore();
    if (!pulled) {
      return res.status(200).json({
        success: false,
        message: 'Tidak ada data cloud baru di Firebase Firestore. Menggunakan data lokal.',
        scoresCount: scoresData.length,
      });
    }

    if (pulled.schools && pulled.schools.length > 0) schoolsData = pulled.schools;
    if (pulled.competitions && pulled.competitions.length > 0) competitionsData = pulled.competitions;
    if (pulled.judges && pulled.judges.length > 0) judgesData = pulled.judges;
    if (pulled.scores) scoresData = pulled.scores;
    if (pulled.logs) logsData = pulled.logs;
    if (pulled.settings) settingsData = pulled.settings;

    saveStorage();
    broadcastSSE('system_restored', { timestamp: new Date().toISOString(), source: 'firebase' });

    res.json({
      success: true,
      message: 'Berhasil memuat data terbaru dari Google Firebase Firestore!',
      scoresCount: scoresData.length,
    });
  } catch (err: any) {
    res.status(200).json({
      success: false,
      message: 'Gagal memuat data dari Firebase: ' + (err?.message || ''),
      scoresCount: scoresData.length,
    });
  }
});

// Real-time SSE Endpoint
app.get('/api/realtime/stream', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const subId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    sseSubscribers.push({ id: subId, res });

    // Heartbeat every 15s to keep connection alive
    const timer = setInterval(() => {
      try {
        res.write(':ping\n\n');
      } catch {
        clearInterval(timer);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(timer);
      sseSubscribers = sseSubscribers.filter((s) => s.id !== subId);
    });
  } catch (err) {
    console.warn('[SSE Stream error]:', err);
  }
});

// Initial Data Fetch
app.get('/api/initial-data', async (req, res) => {
  try {
    const pulled = await fetchAllFromFirestore();
    if (pulled) {
      if (pulled.schools && pulled.schools.length > 0) schoolsData = pulled.schools;
      if (pulled.competitions && pulled.competitions.length > 0) competitionsData = pulled.competitions;
      if (pulled.judges && pulled.judges.length > 0) judgesData = pulled.judges;
      if (pulled.scores) scoresData = pulled.scores;
      if (pulled.logs) logsData = pulled.logs;
      if (pulled.settings) settingsData = pulled.settings;
      saveStorage();
    }
  } catch (err) {
    console.warn('[Initial Data Fetch] Firestore hydration note:', err);
  }

  res.json({
    schools: schoolsData || INITIAL_SCHOOLS,
    competitions: competitionsData || INITIAL_COMPETITIONS,
    judges: judgesData || INITIAL_JUDGES,
    scores: scoresData || [],
    logs: logsData || [],
    settings: settingsData || INITIAL_SETTINGS,
  });
});

// Login Endpoint
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: 'Username wajib diisi' });
    }

    const judge = judgesData.find((j) => j && j.username && j.username.toLowerCase() === username.toLowerCase().trim() && j.isActive);
    if (!judge) {
      return res.status(401).json({ error: 'Pengguna tidak ditemukan atau akun dinonaktifkan.' });
    }

    const expectedPassword = judge.password || judge.passwordHash || (judge.role === 'ADMIN' ? 'admin123' : 'juri123');
    
    if (password !== undefined && password !== null && String(password).trim() !== '') {
      if (String(password).trim() !== String(expectedPassword).trim()) {
        return res.status(401).json({ error: 'Password salah. Periksa kembali password Anda.' });
      }
    }

    const nowIso = new Date().toISOString();
    judge.lastActive = nowIso;
    saveStorage();
    broadcastSSE('judges_updated', judgesData);

    res.json({
      success: true,
      user: judge,
      token: `jwt-demo-${judge.id}-${Date.now()}`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Login gagal' });
  }
});

// Judge Heartbeat Endpoint
app.post('/api/judges/heartbeat', (req, res) => {
  try {
    const { judgeId } = req.body || {};
    if (!judgeId) {
      return res.status(400).json({ error: 'judgeId wajib diisi' });
    }

    const judge = judgesData.find((j) => j && j.id === judgeId);
    if (judge) {
      const nowIso = new Date().toISOString();
      judge.lastActive = nowIso;
      saveStorage();
      broadcastSSE('judges_updated', judgesData);
      return res.json({ success: true, lastActive: nowIso });
    }

    res.status(404).json({ error: 'Juri tidak ditemukan' });
  } catch (err: any) {
    res.status(200).json({ success: false, error: err?.message });
  }
});

// Save or Update Score Endpoint
app.post('/api/scores', async (req, res) => {
  try {
    const { schoolId, teamCategory, competitionId, subPostId, score, timeInMs, timeFormatted, notes, judgeId, judgeName, posName, device, ip } = req.body || {};

    if (!schoolId || !teamCategory || !competitionId || score === undefined || score === null || score === '') {
      return res.status(400).json({ error: 'Data penilaian tidak lengkap.' });
    }

    const numScore = Number(score);
    const minLimit = settingsData?.defaultMinScore ?? 0;
    const maxLimit = settingsData?.defaultMaxScore ?? 100;
    if (isNaN(numScore) || numScore < minLimit || numScore > maxLimit) {
      return res.status(400).json({ error: `Nilai harus berupa angka rentang ${minLimit} - ${maxLimit}` });
    }

    let school = schoolsData.find((s) => s.id === Number(schoolId));
    if (!school) {
      // Find by ID match or create reference
      school = { id: Number(schoolId), code: `PKG-${schoolId}`, name: `Pangkalan #${schoolId}`, hasPutra: true, hasPutri: true };
    }

    const existingIdx = scoresData.findIndex((s) => {
      if (s.schoolId === Number(schoolId) && s.teamCategory === teamCategory && s.competitionId === competitionId) {
        if (subPostId) return s.subPostId === subPostId;
        return !s.subPostId;
      }
      return false;
    });

    const nowIso = new Date().toISOString();
    let oldScore: number | null = null;
    let oldTimeMs: number | null = null;
    let actionType: 'CREATE' | 'UPDATE' = 'CREATE';
    let targetRecord: ScoreRecord;

    if (existingIdx >= 0) {
      oldScore = scoresData[existingIdx].score;
      oldTimeMs = scoresData[existingIdx].timeInMs;
      actionType = 'UPDATE';

      scoresData[existingIdx] = {
        ...scoresData[existingIdx],
        score: numScore,
        timeInMs: Number(timeInMs || 0),
        timeFormatted: timeFormatted || '00:00:000',
        notes: notes !== undefined ? notes : scoresData[existingIdx].notes,
        judgeId: judgeId || scoresData[existingIdx].judgeId,
        judgeName: judgeName || scoresData[existingIdx].judgeName,
        posName: posName || scoresData[existingIdx].posName,
        updatedAt: nowIso,
      };
      targetRecord = scoresData[existingIdx];
    } else {
      targetRecord = {
        id: `score-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        schoolId: Number(schoolId),
        teamCategory,
        competitionId,
        subPostId,
        score: numScore,
        timeInMs: Number(timeInMs || 0),
        timeFormatted: timeFormatted || '00:00:000',
        notes: notes || '',
        judgeId: judgeId || 'system',
        judgeName: judgeName || 'Juri',
        posName: posName || 'Pos',
        timestamp: nowIso,
      };
      scoresData.push(targetRecord);
    }

    // Create Audit Log
    const logItem: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowIso,
      judgeName: judgeName || 'Juri',
      posName: posName || 'Pos',
      schoolName: school.name,
      teamCategory,
      oldScore,
      newScore: numScore,
      oldTimeMs,
      newTimeMs: Number(timeInMs || 0),
      device: device || req.headers['user-agent'] || 'Mobile Device',
      ip: (ip || req.ip || '127.0.0.1').toString(),
      actionType,
    };
    logsData.unshift(logItem);

    saveStorage();

    try {
      await Promise.allSettled([
        saveScoreToFirestore(targetRecord),
        saveLogToFirestore(logItem),
      ]);
    } catch (fsErr) {
      console.warn('[Firestore] Error saving score:', fsErr);
    }

    triggerBackgroundGSheetsSync();

    broadcastSSE('score_updated', {
      scoreRecord: targetRecord,
      logItem,
      totalScoresCount: scoresData.length,
    });

    res.json({
      success: true,
      message: 'Nilai berhasil disimpan.',
      scoreRecord: targetRecord,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menyimpan nilai' });
  }
});

// Batch Sync Route (For Offline Mode Auto-Sync & Excel Import)
app.post('/api/scores/batch', async (req, res) => {
  try {
    const { batchScores } = req.body || {};
    if (!Array.isArray(batchScores)) {
      return res.status(400).json({ error: 'Array batchScores dibutuhkan' });
    }

    const processed: ScoreRecord[] = [];
    batchScores.forEach((item) => {
      if (!item) return;
      const numScore = Number(item.score);
      if (isNaN(numScore)) return;

      const schoolId = Number(item.schoolId);
      if (isNaN(schoolId)) return;

      const existingIdx = scoresData.findIndex((s) => {
        if (s.schoolId === schoolId && s.teamCategory === item.teamCategory && s.competitionId === item.competitionId) {
          if (item.subPostId) return s.subPostId === item.subPostId;
          return !s.subPostId;
        }
        return false;
      });

      const nowIso = item.timestamp || new Date().toISOString();
      let targetRecord: ScoreRecord;

      if (existingIdx >= 0) {
        scoresData[existingIdx] = {
          ...scoresData[existingIdx],
          score: numScore,
          timeInMs: Number(item.timeInMs || 0),
          timeFormatted: item.timeFormatted || '00:00:000',
          updatedAt: nowIso,
        };
        targetRecord = scoresData[existingIdx];
      } else {
        targetRecord = {
          id: item.id || `score-batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          schoolId: schoolId,
          teamCategory: item.teamCategory,
          competitionId: item.competitionId,
          subPostId: item.subPostId,
          score: numScore,
          timeInMs: Number(item.timeInMs || 0),
          timeFormatted: item.timeFormatted || '00:00:000',
          judgeId: item.judgeId || 'juri-offline',
          judgeName: item.judgeName || 'Juri (Import/Sync)',
          posName: item.posName || 'Pos',
          timestamp: nowIso,
        };
        scoresData.push(targetRecord);
      }
      processed.push(targetRecord);
    });

    saveStorage();
    try {
      await triggerBackgroundFirestoreSync();
    } catch (fsErr) {
      console.warn('[Firestore] Batch sync warning:', fsErr);
    }
    triggerBackgroundGSheetsSync();
    broadcastSSE('scores_batch_updated', { processedCount: processed.length });

    res.json({ success: true, count: processed.length });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal memproses batch nilai' });
  }
});

// Delete Score
app.delete('/api/scores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    const idx = scoresData.findIndex((s) => s.id === id || s.id === decodedId);
    if (idx === -1) return res.status(404).json({ error: 'Nilai tidak ditemukan' });

    const deleted = scoresData.splice(idx, 1)[0];
    const school = schoolsData.find((s) => s.id === deleted.schoolId);

    const logItem: ActivityLog = {
      id: `log-del-${Date.now()}`,
      timestamp: new Date().toISOString(),
      judgeName: 'Admin',
      posName: deleted.posName,
      schoolName: school?.name || 'Unknown',
      teamCategory: deleted.teamCategory,
      oldScore: deleted.score,
      newScore: 0,
      device: 'Admin Console',
      ip: '127.0.0.1',
      actionType: 'DELETE',
    };
    logsData.unshift(logItem);

    saveStorage();
    try {
      await Promise.allSettled([
        deleteScoreFromFirestore(deleted.id),
        saveLogToFirestore(logItem),
      ]);
    } catch (fsErr) {
      console.warn('[Firestore] Delete score warning:', fsErr);
    }

    triggerBackgroundGSheetsSync();
    broadcastSSE('score_deleted', { id: deleted.id, deleted });

    res.json({ success: true, id: deleted.id });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menghapus nilai' });
  }
});

// Clear All Scores with password confirmation (alan_d19)
app.post('/api/scores/clear-all', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (password !== 'alan_d19') {
      return res.status(403).json({ error: 'Password konfirmasi salah! Hapus semua nilai dibatalkan.' });
    }

    const deletedList = [...scoresData];
    const deletedCount = scoresData.length;
    scoresData = [];

    const logItem: ActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      judgeName: 'Administrator',
      posName: 'HAPUS SEMUA NILAI',
      schoolName: 'SEMUA PANGKALAN',
      teamCategory: 'PUTRA',
      oldScore: 0,
      newScore: 0,
      device: 'Admin Console',
      ip: '127.0.0.1',
      actionType: 'DELETE',
    };
    logsData.unshift(logItem);

    saveStorage();
    try {
      await Promise.allSettled([
        clearAllScoresInFirestore(deletedList),
        saveLogToFirestore(logItem),
      ]);
    } catch (fsErr) {
      console.warn('[Firestore] Clear all scores warning:', fsErr);
    }

    triggerBackgroundGSheetsSync();
    broadcastSSE('scores_batch_updated', { type: 'CLEAR_ALL', timestamp: new Date().toISOString() });

    res.json({ success: true, message: `Berhasil menghapus seluruh ${deletedCount} data nilai dari sistem.`, deletedCount });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal mereset database nilai' });
  }
});

// Master Competition CRUD
app.post('/api/competitions', async (req, res) => {
  try {
    const { name, minScore, maxScore, isExploration, hasTime } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nama perlombaan wajib diisi' });

    const newComp: Competition = {
      id: `comp-${Date.now()}`,
      name: String(name).trim(),
      order: competitionsData.length + 1,
      active: true,
      isExploration: !!isExploration,
      hasTime: hasTime !== false,
      minScore: Number(minScore ?? 0),
      maxScore: Number(maxScore ?? 100),
    };

    if (isExploration) {
      newComp.subPosts = [
        { id: `sub-${Date.now()}-1`, competitionId: newComp.id, name: 'Pos 1 PUPK', order: 1, minScore: 0, maxScore: 100 },
        { id: `sub-${Date.now()}-2`, competitionId: newComp.id, name: 'Pos 2 PBB', order: 2, minScore: 0, maxScore: 100 },
        { id: `sub-${Date.now()}-3`, competitionId: newComp.id, name: 'Pos 3 Packing', order: 3, minScore: 0, maxScore: 100 },
        { id: `sub-${Date.now()}-4`, competitionId: newComp.id, name: 'Pos 4 KIM', order: 4, minScore: 0, maxScore: 100 },
        { id: `sub-${Date.now()}-5`, competitionId: newComp.id, name: 'Pos 5 Yel-Yel', order: 5, minScore: 0, maxScore: 100 },
      ];
    }

    competitionsData.push(newComp);
    saveStorage();
    try {
      await saveCompetitionToFirestore(newComp);
    } catch (fsErr) {
      console.warn('[Firestore] Save comp warning:', fsErr);
    }
    broadcastSSE('competitions_updated', competitionsData);
    res.json({ success: true, competition: newComp });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menambah perlombaan' });
  }
});

app.put('/api/competitions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    const idx = competitionsData.findIndex((c) => c.id === id || c.id === decodedId);
    if (idx === -1) return res.status(404).json({ error: 'Perlombaan tidak ditemukan' });

    competitionsData[idx] = {
      ...competitionsData[idx],
      ...req.body,
    };

    saveStorage();
    try {
      await saveCompetitionToFirestore(competitionsData[idx]);
    } catch (fsErr) {
      console.warn('[Firestore] Update comp warning:', fsErr);
    }
    broadcastSSE('competitions_updated', competitionsData);
    res.json({ success: true, competition: competitionsData[idx] });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal mengubah perlombaan' });
  }
});

app.delete('/api/competitions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    competitionsData = competitionsData.filter((c) => c.id !== id && c.id !== decodedId);
    saveStorage();
    try {
      await deleteCompetitionFromFirestore(decodedId);
      if (decodedId !== id) {
        await deleteCompetitionFromFirestore(id);
      }
    } catch (fsErr) {
      console.warn('[Firestore] Delete comp warning:', fsErr);
    }
    broadcastSSE('competitions_updated', competitionsData);
    res.json({ success: true, id: decodedId });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menghapus perlombaan' });
  }
});

// Master School CRUD
app.post('/api/schools', async (req, res) => {
  try {
    const { name, code, hasPutra, hasPutri } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nama pangkalan wajib' });

    const maxId = schoolsData.reduce((max, s) => Math.max(max, s.id), 0);
    const newSchool: School = {
      id: maxId + 1,
      code: code || `PKG-${String(maxId + 1).padStart(2, '0')}`,
      name: String(name).trim(),
      hasPutra: hasPutra !== false,
      hasPutri: hasPutri !== false,
    };

    schoolsData.push(newSchool);
    saveStorage();
    try {
      await saveSchoolToFirestore(newSchool);
    } catch (fsErr) {
      console.warn('[Firestore] Save school warning:', fsErr);
    }
    broadcastSSE('schools_updated', schoolsData);
    res.json({ success: true, school: newSchool });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menambah pangkalan' });
  }
});

app.put('/api/schools/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = schoolsData.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Pangkalan tidak ditemukan' });

    schoolsData[idx] = { ...schoolsData[idx], ...req.body };
    saveStorage();
    try {
      await saveSchoolToFirestore(schoolsData[idx]);
    } catch (fsErr) {
      console.warn('[Firestore] Update school warning:', fsErr);
    }
    broadcastSSE('schools_updated', schoolsData);
    res.json({ success: true, school: schoolsData[idx] });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal mengubah pangkalan' });
  }
});

app.delete('/api/schools/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    schoolsData = schoolsData.filter((s) => s.id !== id);
    saveStorage();
    try {
      await deleteSchoolFromFirestore(id);
    } catch (fsErr) {
      console.warn('[Firestore] Delete school warning:', fsErr);
    }
    broadcastSSE('schools_updated', schoolsData);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menghapus pangkalan' });
  }
});

// Master Judges CRUD
app.post('/api/judges', async (req, res) => {
  try {
    const { username, password, name, role, assignedCompetitionId, assignedSubPostId, assignedCategory } = req.body || {};
    if (!username || !name) return res.status(400).json({ error: 'Username dan Nama wajib' });

    const newJudge: Judge = {
      id: `judge-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      username: username.trim(),
      password: password ? password.trim() : (role === 'ADMIN' ? 'admin123' : 'juri123'),
      name: name.trim(),
      role: role || 'JUDGE',
      assignedCompetitionId: assignedCompetitionId || '',
      assignedSubPostId: assignedSubPostId || '',
      assignedCategory: assignedCategory || 'ALL',
      isActive: true,
    };

    judgesData.push(newJudge);
    saveStorage();
    try {
      await saveJudgeToFirestore(newJudge);
    } catch (fsErr) {
      console.warn('[Firestore] Save judge warning:', fsErr);
    }
    broadcastSSE('judges_updated', judgesData);
    res.json({ success: true, judge: newJudge });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menambah juri' });
  }
});

app.post('/api/judges/batch', async (req, res) => {
  try {
    const { batchJudges } = req.body || {};
    if (!Array.isArray(batchJudges) || batchJudges.length === 0) {
      return res.status(400).json({ error: 'Data batch juri tidak valid atau kosong' });
    }

    let addedCount = 0;
    for (const item of batchJudges) {
      if (item && item.username && item.name) {
        const existingIdx = judgesData.findIndex(
          (j) => j && j.username && j.username.toLowerCase() === item.username.toLowerCase().trim()
        );

        const judgeObj: Judge = {
          id: existingIdx >= 0 ? judgesData[existingIdx].id : `judge-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          username: item.username.trim(),
          password: item.password ? item.password.trim() : 'juri123',
          name: item.name.trim(),
          role: item.role || 'JUDGE',
          assignedCompetitionId: item.assignedCompetitionId || '',
          assignedSubPostId: item.assignedSubPostId || '',
          assignedCategory: item.assignedCategory || 'ALL',
          isActive: item.isActive !== undefined ? item.isActive : true,
        };

        if (existingIdx >= 0) {
          judgesData[existingIdx] = judgeObj;
        } else {
          judgesData.push(judgeObj);
        }
        try {
          await saveJudgeToFirestore(judgeObj);
        } catch (fsErr) {
          console.warn('[Firestore] Batch save judge warning:', fsErr);
        }
        addedCount++;
      }
    }

    saveStorage();
    broadcastSSE('judges_updated', judgesData);
    res.json({ success: true, count: addedCount, judges: judgesData });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal memproses batch juri' });
  }
});

app.put('/api/judges/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    const idx = judgesData.findIndex((j) => j && (String(j.id) === String(id) || String(j.id) === String(decodedId)));
    if (idx === -1) return res.status(404).json({ error: 'Juri tidak ditemukan' });

    judgesData[idx] = { ...judgesData[idx], ...req.body };
    saveStorage();
    try {
      await saveJudgeToFirestore(judgesData[idx]);
    } catch (fsErr) {
      console.warn('[Firestore] Update judge warning:', fsErr);
    }
    broadcastSSE('judges_updated', judgesData);
    res.json({ success: true, judge: judgesData[idx] });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal mengubah juri' });
  }
});

app.delete('/api/judges-all-non-admin', async (req, res) => {
  try {
    const initialCount = judgesData.length;
    const toDelete = judgesData.filter((j) => j && j.username !== 'admin');
    judgesData = judgesData.filter((j) => j && j.username === 'admin');
    saveStorage();
    try {
      await deleteAllNonAdminJudgesInFirestore();
      for (const j of toDelete) {
        await deleteJudgeFromFirestore(j.id);
      }
    } catch (fsErr) {
      console.warn('[Firestore] Delete non-admin judge warning:', fsErr);
    }
    broadcastSSE('judges_updated', judgesData);
    const deletedCount = initialCount - judgesData.length;
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menghapus akun juri non-admin' });
  }
});

app.delete('/api/judges/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const decodedId = decodeURIComponent(id);
    const initialCount = judgesData.length;
    judgesData = judgesData.filter((j) => String(j.id) !== String(id) && String(j.id) !== String(decodedId));
    saveStorage();
    try {
      await deleteJudgeFromFirestore(decodedId);
      if (decodedId !== id) {
        await deleteJudgeFromFirestore(id);
      }
    } catch (fsErr) {
      console.warn('[Firestore] Delete judge warning:', fsErr);
    }
    broadcastSSE('judges_updated', judgesData);
    res.json({ success: true, id: decodedId, deleted: initialCount > judgesData.length });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menghapus juri' });
  }
});

// App Settings Update
app.post('/api/settings', async (req, res) => {
  try {
    settingsData = { ...settingsData, ...req.body };
    saveStorage();
    try {
      await saveSettingsToFirestore(settingsData);
    } catch (fsErr) {
      console.warn('[Firestore] Save settings warning:', fsErr);
    }
    broadcastSSE('settings_updated', settingsData);
    res.json({ success: true, settings: settingsData });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal menyimpan pengaturan' });
  }
});

// Backup Export & Restore
app.get('/api/backup/export', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup-pramuka-${Date.now()}.json`);
    res.json({
      version: '1.0',
      exportTimestamp: new Date().toISOString(),
      schools: schoolsData,
      competitions: competitionsData,
      judges: judgesData,
      scores: scoresData,
      logs: logsData,
      settings: settingsData,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal mengekspor backup' });
  }
});

app.post('/api/backup/restore', (req, res) => {
  try {
    const { data } = req.body || {};
    if (!data || !Array.isArray(data.schools) || !Array.isArray(data.competitions)) {
      return res.status(400).json({ error: 'Format file backup tidak valid.' });
    }

    schoolsData = data.schools;
    competitionsData = data.competitions;
    judgesData = data.judges || [];
    scoresData = data.scores || [];
    logsData = data.logs || [];
    if (data.settings) settingsData = data.settings;

    saveStorage();
    triggerBackgroundFirestoreSync();
    broadcastSSE('system_restored', { timestamp: new Date().toISOString() });

    res.json({
      success: true,
      message: 'Database berhasil dipulihkan dari backup.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Gagal memulihkan database dari backup' });
  }
});

// Global catch-all 404 for unhandled API endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.method} ${req.originalUrl || req.url} tidak ditemukan.`,
  });
});

// Global Express Error Handler Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER GLOBAL ERROR HANDLER]:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 400).json({
    success: false,
    error: err?.message || 'Terjadi kesalahan sistem pada server',
  });
});

async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[PRAMUKA SERVER] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

// In standard container/local environments, start the HTTP server.
// In Vercel serverless environment, Vercel wraps the exported app directly.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
