import { google } from 'googleapis';
import { School, Competition, ScoreRecord, AppSettings, TeamCategory } from '../types';

function formatTimeMs(ms: number | undefined | null): string {
  if (!ms || ms <= 0) return '00:00.000';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const milli = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

function formatDateIso(isoStr: string | undefined): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
  } catch {
    return isoStr;
  }
}

export interface PosItem {
  competitionId: string;
  subPostId?: string;
  posKey: string;
  name: string;
}

export function getFlatPosItems(competitions: Competition[]): PosItem[] {
  const items: PosItem[] = [];
  competitions.forEach((comp) => {
    if (!comp.active) return;
    if (comp.isExploration && comp.subPosts && comp.subPosts.length > 0) {
      comp.subPosts.forEach((sub) => {
        items.push({
          competitionId: comp.id,
          subPostId: sub.id,
          posKey: `${comp.id}_${sub.id}`,
          name: `${comp.name} - ${sub.name}`,
        });
      });
    } else {
      items.push({
        competitionId: comp.id,
        posKey: comp.id,
        name: comp.name,
      });
    }
  });
  return items;
}

export function getGoogleAuthClient(providedToken?: string) {
  const token = providedToken || process.env.ACCESS_TOKEN;
  if (!token) {
    throw new Error('OAuth Google belum terhubung. Akses token Google tidak ditemukan.');
  }
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return oauth2Client;
}

export async function syncDataToGoogleSheets(
  schools: School[],
  competitions: Competition[],
  scores: ScoreRecord[],
  settings: AppSettings,
  providedToken?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; lastSyncTime: string }> {
  const auth = getGoogleAuthClient(providedToken);
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const eventTitle = settings.eventTitle || 'Rekap Nilai Pramuka';
  const spreadsheetTitle = `[LIVE REKAP] ${eventTitle}`;

  let spreadsheetId = settings.googleSpreadsheetId || '';

  // Check if spreadsheet exists
  if (spreadsheetId) {
    try {
      await sheets.spreadsheets.get({ spreadsheetId });
    } catch (e) {
      console.warn('Existing spreadsheet ID not accessible, creating new file:', e);
      spreadsheetId = '';
    }
  }

  // Create new spreadsheet if needed
  if (!spreadsheetId) {
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: spreadsheetTitle,
        },
      },
    });
    spreadsheetId = createRes.data.spreadsheetId || '';
    if (!spreadsheetId) {
      throw new Error('Gagal membuat file Google Sheets di Drive.');
    }
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Flat Pos Items
  const posItems = getFlatPosItems(competitions);

  // Prepare required sheet definitions
  // 1. Rekap Putra
  // 2. Ranking Putra
  // 3. PA Pos Sheets
  // 4. Rekap Putri
  // 5. Ranking Putri
  // 6. PI Pos Sheets

  type SheetConfig = {
    title: string;
    category: TeamCategory;
    type: 'REKAP' | 'RANKING' | 'POS';
    posItem?: PosItem;
    headerColor: { red: number; green: number; blue: number };
  };

  const sheetConfigs: SheetConfig[] = [];

  // PUTRA
  const paHeaderColor = { red: 0.12, green: 0.23, blue: 0.54 }; // Navy/Indigo
  sheetConfigs.push({
    title: '📊 Rekap Putra',
    category: 'PUTRA',
    type: 'REKAP',
    headerColor: { red: 0.02, green: 0.37, blue: 0.27 }, // Emerald
  });
  sheetConfigs.push({
    title: '🏆 Ranking Putra',
    category: 'PUTRA',
    type: 'RANKING',
    headerColor: { red: 0.02, green: 0.37, blue: 0.27 }, // Emerald
  });
  posItems.forEach((pos) => {
    // Sanitize sheet name max 100 chars and no invalid chars
    const cleanName = pos.name.replace(/[:\\/?*\[\]]/g, '-').substring(0, 80);
    sheetConfigs.push({
      title: `👦 PA - ${cleanName}`,
      category: 'PUTRA',
      type: 'POS',
      posItem: pos,
      headerColor: paHeaderColor,
    });
  });

  // PUTRI
  const piHeaderColor = { red: 0.51, green: 0.09, blue: 0.26 }; // Deep Pink / Rose
  sheetConfigs.push({
    title: '📊 Rekap Putri',
    category: 'PUTRI',
    type: 'REKAP',
    headerColor: { red: 0.02, green: 0.37, blue: 0.27 }, // Emerald
  });
  sheetConfigs.push({
    title: '🏆 Ranking Putri',
    category: 'PUTRI',
    type: 'RANKING',
    headerColor: { red: 0.02, green: 0.37, blue: 0.27 }, // Emerald
  });
  posItems.forEach((pos) => {
    const cleanName = pos.name.replace(/[:\\/?*\[\]]/g, '-').substring(0, 80);
    sheetConfigs.push({
      title: `👧 PI - ${cleanName}`,
      category: 'PUTRI',
      type: 'POS',
      posItem: pos,
      headerColor: piHeaderColor,
    });
  });

  // Fetch current spreadsheet meta to see existing sheets
  const currentSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = currentSpreadsheet.data.sheets || [];
  const existingTitlesMap = new Map<string, number>();
  existingSheets.forEach((s) => {
    if (s.properties?.title && s.properties.sheetId !== undefined) {
      existingTitlesMap.set(s.properties.title, s.properties.sheetId);
    }
  });

  // Ensure all required sheets exist
  const batchAddRequests: any[] = [];
  sheetConfigs.forEach((sc) => {
    if (!existingTitlesMap.has(sc.title)) {
      batchAddRequests.push({
        addSheet: {
          properties: {
            title: sc.title,
          },
        },
      });
    }
  });

  if (batchAddRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: batchAddRequests },
    });

    // Refresh current sheet map
    const refreshed = await sheets.spreadsheets.get({ spreadsheetId });
    (refreshed.data.sheets || []).forEach((s) => {
      if (s.properties?.title && s.properties.sheetId !== undefined) {
        existingTitlesMap.set(s.properties.title, s.properties.sheetId);
      }
    });
  }

  // Delete default "Sheet1" if present
  if (existingTitlesMap.has('Sheet1') && existingTitlesMap.size > 1) {
    const sheet1Id = existingTitlesMap.get('Sheet1');
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId: sheet1Id } }],
        },
      });
      existingTitlesMap.delete('Sheet1');
    } catch {
      // Ignore
    }
  }

  // BUILD DATA FOR EACH SHEET
  const valueUpdates: Array<{ range: string; values: any[][] }> = [];
  const formattingRequests: any[] = [];

  // Helper map score lookup: key = `${schoolId}_${category}_${competitionId}_${subPostId || ''}`
  const scoreLookup = new Map<string, ScoreRecord>();
  scores.forEach((sc) => {
    const key = `${sc.schoolId}_${sc.teamCategory}_${sc.competitionId}_${sc.subPostId || ''}`;
    scoreLookup.set(key, sc);
  });

  sheetConfigs.forEach((sc) => {
    const sheetId = existingTitlesMap.get(sc.title);
    if (sheetId === undefined) return;

    const activeSchools = schools.filter((s) => (sc.category === 'PUTRA' ? s.hasPutra : s.hasPutri));

    let headers: string[] = [];
    let rowsData: any[][] = [];

    if (sc.type === 'POS' && sc.posItem) {
      headers = [
        'No',
        'Nama Sekolah/Pangkalan',
        'Nama Pos',
        'Nilai',
        'Waktu (mm:ss.SSS)',
        'Catatan Juri',
        'Nama Juri',
        'Tanggal dan Jam Input',
      ];

      activeSchools.forEach((school, idx) => {
        const key = `${school.id}_${sc.category}_${sc.posItem!.competitionId}_${sc.posItem!.subPostId || ''}`;
        const scRecord = scoreLookup.get(key);

        rowsData.push([
          idx + 1,
          school.name,
          sc.posItem!.name,
          scRecord ? scRecord.score : '-',
          scRecord && scRecord.timeInMs ? formatTimeMs(scRecord.timeInMs) : '00:00.000',
          scRecord?.notes || '-',
          scRecord ? scRecord.judgeName : '-',
          scRecord ? formatDateIso(scRecord.updatedAt || scRecord.timestamp) : '-',
        ]);
      });
    } else if (sc.type === 'REKAP') {
      headers = ['No', 'Nama Sekolah/Pangkalan'];
      posItems.forEach((p) => {
        headers.push(`${p.name} (Nilai)`);
        headers.push(`${p.name} (Waktu)`);
      });
      headers.push('Total Nilai', 'Total Waktu (mm:ss.SSS)');

      activeSchools.forEach((school, idx) => {
        let totalScore = 0;
        let totalTimeMs = 0;
        const row: any[] = [idx + 1, school.name];

        posItems.forEach((p) => {
          const key = `${school.id}_${sc.category}_${p.competitionId}_${p.subPostId || ''}`;
          const scRecord = scoreLookup.get(key);

          if (scRecord) {
            row.push(scRecord.score);
            row.push(scRecord.timeInMs > 0 ? formatTimeMs(scRecord.timeInMs) : '00:00.000');
            totalScore += scRecord.score;
            totalTimeMs += scRecord.timeInMs || 0;
          } else {
            row.push('-');
            row.push('00:00.000');
          }
        });

        row.push(totalScore, formatTimeMs(totalTimeMs));
        rowsData.push(row);
      });
    } else if (sc.type === 'RANKING') {
      headers = ['Peringkat', 'Nama Sekolah/Pangkalan', 'Total Nilai', 'Total Waktu (mm:ss.SSS)', 'Keterangan'];

      // Calculate totals for ranking
      const schoolStats = activeSchools.map((school) => {
        let totalScore = 0;
        let totalTimeMs = 0;
        let scoreCount = 0;

        posItems.forEach((p) => {
          const key = `${school.id}_${sc.category}_${p.competitionId}_${p.subPostId || ''}`;
          const scRecord = scoreLookup.get(key);
          if (scRecord) {
            totalScore += scRecord.score;
            totalTimeMs += scRecord.timeInMs || 0;
            scoreCount++;
          }
        });

        return {
          school,
          totalScore,
          totalTimeMs,
          scoreCount,
        };
      });

      // Sort by Total Score DESC, then Total Time ASC (faster = lower time)
      schoolStats.sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (a.totalTimeMs !== b.totalTimeMs) {
          return a.totalTimeMs - b.totalTimeMs;
        }
        return a.school.id - b.school.id;
      });

      schoolStats.forEach((stat, idx) => {
        const rank = idx + 1;
        let label = 'PESERTA';
        if (rank === 1) label = '🏆 JUARA 1 UTAMA';
        else if (rank === 2) label = '🥈 JUARA 2 UTAMA';
        else if (rank === 3) label = '🥉 JUARA 3 UTAMA';
        else if (rank === 4) label = '🎗 JUARA HARAPAN 1';
        else if (rank === 5) label = '🎗 JUARA HARAPAN 2';
        else if (rank === 6) label = '🎗 JUARA HARAPAN 3';

        rowsData.push([
          rank,
          stat.school.name,
          stat.totalScore,
          formatTimeMs(stat.totalTimeMs),
          label,
        ]);
      });
    }

    const fullGrid = [headers, ...rowsData];

    // Clear and push values
    valueUpdates.push({
      range: `'${sc.title}'!A1:Z100`,
      values: fullGrid,
    });

    // Formatting: Freeze row 1 & Filter
    formattingRequests.push(
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: fullGrid.length,
              startColumnIndex: 0,
              endColumnIndex: headers.length,
            },
          },
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: headers.length,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: sc.headerColor,
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 10,
              },
              alignment: { horizontal: 'CENTER', vertical: 'MIDDLE' },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,alignment)',
        },
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: headers.length,
          },
        },
      }
    );
  });

  // Batch clear first to remove ghost rows
  const clearRequests = sheetConfigs.map((sc) => `'${sc.title}'!A1:Z100`);
  try {
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: clearRequests },
    });
  } catch (e) {
    console.warn('Batch clear warning:', e);
  }

  // Write new values
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: valueUpdates,
    },
  });

  // Apply batch formatting (Freeze row 1, headers, auto filter, column widths)
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formattingRequests },
    });
  } catch (err) {
    console.warn('Formatting batch update warning:', err);
  }

  const lastSyncTime = new Date().toISOString();

  return {
    spreadsheetId,
    spreadsheetUrl,
    lastSyncTime,
  };
}
