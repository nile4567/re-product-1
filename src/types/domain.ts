export type ConsolePlatform = 'PS5' | 'Xbox Series X' | 'PC' | 'Switch 2';

export type BugSeverity = 'Critical' | 'Major' | 'Minor';

export type BugStatus = 'Open' | 'Workaround' | 'Patched';

export type NavSection = 'overview' | 'guides' | 'forum' | 'clips';

export interface GuideStep {
  id: string;
  order: number;
  title: string;
  description: string;
  location: string;
  tip?: string;
  missable?: boolean;
  estimatedMinutes: number;
}

export interface Collectible {
  id: string;
  name: string;
  category: 'Relic' | 'Codex' | 'Upgrade Core' | 'Key Item';
  locationHint: string;
}

export interface BossTactic {
  name: string;
  recommendedLevel: string;
  weaknesses: string[];
  imageUrl?: string;
  phases: {
    phase: string;
    summary: string;
    counter: string;
  }[];
}

export interface Chapter {
  id: string;
  order: number;
  title: string;
  region: string;
  summary: string;
  steps: GuideStep[];
  collectibles: Collectible[];
  boss?: BossTactic;
}

export interface Game {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  currentPatch: string;
  coverUrl: string;
  platforms: ConsolePlatform[];
  chapters: Chapter[];
}

export interface GameProgress {
  completedStepIds: string[];
  collectedIds: string[];
  activePlatform: ConsolePlatform;
  lastUpdated: string;
}

export interface BugReply {
  id: string;
  author: string;
  platform: ConsolePlatform;
  body: string;
  isWorkaround: boolean;
  createdAt: string;
}

export interface BugThread {
  id: string;
  gameId: string;
  title: string;
  author: string;
  platform: ConsolePlatform;
  severity: BugSeverity;
  status: BugStatus;
  patchVersion: string;
  chapterOrZone: string;
  description: string;
  reproSteps: string[];
  hardwareNotes: string;
  confirmations: number;
  createdAt: string;
  replies: BugReply[];
}

export interface GameplayClip {
  id: string;
  gameId: string;
  title: string;
  author: string;
  platform: ConsolePlatform;
  zone: string;
  resolution: string;
  graphicsMode: string;
  avgFps: number;
  low1PercentFps: number;
  frameTimeMs: number;
  durationSec: number;
  videoUrl: string | null;
  replaySeed?: number;
  notes: string;
  createdAt: string;
}

export interface AppState {
  games: Game[];
  progressByGame: Record<string, GameProgress>;
  bugThreads: BugThread[];
  clips: GameplayClip[];
}
