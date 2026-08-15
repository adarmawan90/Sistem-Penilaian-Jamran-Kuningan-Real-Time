export type TeamCategory = 'PUTRA' | 'PUTRI';
export type UserRole = 'ADMIN' | 'JUDGE';

export interface School {
  id: number;
  code: string;
  name: string;
  hasPutra: boolean;
  hasPutri: boolean;
}

export interface SubPost {
  id: string;
  competitionId: string;
  name: string;
  order: number;
  minScore: number;
  maxScore: number;
  hasTime?: boolean; // Setting Stopwatch time for sub-pos
}

export interface Competition {
  id: string;
  name: string;
  order: number;
  active: boolean;
  isExploration: boolean; // Flag for Penjelajahan
  hasTime?: boolean; // Toggle whether stopwatch/time is used for this competition
  subPosts?: SubPost[];
  minScore: number;
  maxScore: number;
}

export interface Judge {
  id: string;
  username: string;
  password?: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  assignedCompetitionId: string;
  assignedSubPostId?: string; // For Penjelajahan sub-pos
  assignedCategory?: TeamCategory | 'ALL'; // Regu Putra/Putri assignment
  isActive: boolean;
  lastActive?: string; // ISO Timestamp of last online heartbeat
}

export interface ScoreRecord {
  id: string;
  schoolId: number;
  teamCategory: TeamCategory;
  competitionId: string;
  subPostId?: string;
  score: number;
  timeInMs: number; // Stopwatch time in milliseconds
  timeFormatted: string; // MM:SS:mmm
  notes?: string; // Catatan juri / alasan nilai
  judgeId: string;
  judgeName: string;
  posName: string;
  timestamp: string; // ISO string
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  judgeName: string;
  posName: string;
  schoolName: string;
  teamCategory: TeamCategory;
  oldScore: number | null;
  newScore: number;
  oldTimeMs?: number | null;
  newTimeMs?: number;
  device: string;
  ip: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE';
}

export interface AppSettings {
  eventTitle: string;
  defaultMinScore: number;
  defaultMaxScore: number;
  autoSyncIntervalSec: number;
  allowOffline: boolean;
  theme: 'light' | 'dark' | 'system';
  googleSpreadsheetId?: string;
  googleSpreadsheetUrl?: string;
  lastGoogleSync?: string;
  autoGoogleSyncEnabled?: boolean;
  publicShowRekap?: boolean;
  judgeShowRekap?: boolean;
  publicShowRanking?: boolean;
  publicShowMonitor?: boolean;
  rankingLimit?: number; // 0 = Semua, 3 = Top 3, 5 = Top 5, 10 = Top 10, etc.
}

export interface RankingResult {
  rank: number;
  schoolId: number;
  schoolName: string;
  teamCategory: TeamCategory;
  totalScore: number;
  totalTimeMs: number;
  totalTimeFormatted: string;
  earliestSubmitTimestamp: string;
  scoresCount: number;
  scoresBreakdown: Record<string, number>; // competitionId or subPostId -> score
}

export interface ExplorationRankingResult {
  rank: number;
  schoolId: number;
  schoolName: string;
  teamCategory: TeamCategory;
  subPostScores: Record<string, number>; // subPostId -> score
  totalExplorationScore: number;
  totalExplorationTimeMs: number;
  totalExplorationTimeFormatted: string;
}

export interface AuthState {
  user: Judge | null;
  isAuthenticated: boolean;
}
