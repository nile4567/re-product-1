import type {
  BugSeverity,
  BugStatus,
  BugThread,
  Chapter,
  ConsolePlatform,
  GameplayClip,
} from '../types/domain';

export interface ChapterProgressSummary {
  chapterId: string;
  title: string;
  completedSteps: number;
  totalSteps: number;
  completedCollectibles: number;
  totalCollectibles: number;
  percentage: number;
}

export interface GameProgressSummary {
  completedSteps: number;
  totalSteps: number;
  completedCollectibles: number;
  totalCollectibles: number;
  totalItems: number;
  completedItems: number;
  percentage: number;
  chapterSummaries: ChapterProgressSummary[];
  nextStep: {
    chapterId: string;
    chapterTitle: string;
    stepId: string;
    stepTitle: string;
    location: string;
  } | null;
}

export function calculateGameProgress(
  chapters: Chapter[],
  completedStepIds: string[],
  collectedIds: string[]
): GameProgressSummary {
  const stepSet = new Set(completedStepIds);
  const collectibleSet = new Set(collectedIds);

  let totalSteps = 0;
  let completedSteps = 0;
  let totalCollectibles = 0;
  let completedCollectibles = 0;
  let nextStep: GameProgressSummary['nextStep'] = null;

  const chapterSummaries: ChapterProgressSummary[] = chapters.map((chapter) => {
    const chTotalSteps = chapter.steps.length;
    const chDoneSteps = chapter.steps.filter((s) => stepSet.has(s.id)).length;
    const chTotalColl = chapter.collectibles.length;
    const chDoneColl = chapter.collectibles.filter((c) => collectibleSet.has(c.id)).length;

    totalSteps += chTotalSteps;
    completedSteps += chDoneSteps;
    totalCollectibles += chTotalColl;
    completedCollectibles += chDoneColl;

    if (!nextStep) {
      const firstRemaining = chapter.steps.find((s) => !stepSet.has(s.id));
      if (firstRemaining) {
        nextStep = {
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          stepId: firstRemaining.id,
          stepTitle: firstRemaining.title,
          location: firstRemaining.location,
        };
      }
    }

    const chTotal = chTotalSteps + chTotalColl;
    const chDone = chDoneSteps + chDoneColl;

    return {
      chapterId: chapter.id,
      title: chapter.title,
      completedSteps: chDoneSteps,
      totalSteps: chTotalSteps,
      completedCollectibles: chDoneColl,
      totalCollectibles: chTotalColl,
      percentage: chTotal === 0 ? 100 : Math.round((chDone / chTotal) * 100),
    };
  });

  const totalItems = totalSteps + totalCollectibles;
  const completedItems = completedSteps + completedCollectibles;
  const percentage = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  return {
    completedSteps,
    totalSteps,
    completedCollectibles,
    totalCollectibles,
    totalItems,
    completedItems,
    percentage,
    chapterSummaries,
    nextStep,
  };
}

export interface BugFilterOptions {
  gameId?: string;
  platform?: ConsolePlatform | 'All';
  severity?: BugSeverity | 'All';
  status?: BugStatus | 'All';
  search?: string;
  sortBy?: 'votes' | 'newest';
}

export function filterBugThreads(
  threads: BugThread[],
  filters: BugFilterOptions
): BugThread[] {
  const query = (filters.search ?? '').trim().toLowerCase();

  const filtered = threads.filter((thread) => {
    if (filters.gameId && thread.gameId !== filters.gameId) return false;
    if (filters.platform && filters.platform !== 'All' && thread.platform !== filters.platform) {
      return false;
    }
    if (filters.severity && filters.severity !== 'All' && thread.severity !== filters.severity) {
      return false;
    }
    if (filters.status && filters.status !== 'All' && thread.status !== filters.status) {
      return false;
    }
    if (query) {
      const haystack = [
        thread.title,
        thread.description,
        thread.chapterOrZone,
        thread.platform,
        thread.hardwareNotes,
        thread.author,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const sortBy = filters.sortBy ?? 'votes';
  return [...filtered].sort((a, b) => {
    if (sortBy === 'votes') {
      if (b.confirmations !== a.confirmations) return b.confirmations - a.confirmations;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export interface PlatformTelemetrySummary {
  platform: ConsolePlatform;
  clipCount: number;
  meanAvgFps: number;
  meanLow1PercentFps: number;
  meanFrameTimeMs: number;
}

export interface AggregatePerformanceResult {
  clipCount: number;
  meanAvgFps: number;
  minLow1PercentFps: number;
  meanFrameTimeMs: number;
  target60RatePct: number;
  byPlatform: PlatformTelemetrySummary[];
}

const ALL_PLATFORMS: ConsolePlatform[] = ['PS5', 'Xbox Series X', 'PC', 'Switch 2'];

export function aggregatePerformanceStats(
  clips: GameplayClip[],
  platformFilter: ConsolePlatform | 'All' = 'All'
): AggregatePerformanceResult {
  const scoped =
    platformFilter === 'All' ? clips : clips.filter((c) => c.platform === platformFilter);

  if (scoped.length === 0) {
    return {
      clipCount: 0,
      meanAvgFps: 0,
      minLow1PercentFps: 0,
      meanFrameTimeMs: 0,
      target60RatePct: 0,
      byPlatform: [],
    };
  }

  const sumAvg = scoped.reduce((acc, c) => acc + c.avgFps, 0);
  const sumFrameTime = scoped.reduce((acc, c) => acc + c.frameTimeMs, 0);
  const minLow1 = Math.min(...scoped.map((c) => c.low1PercentFps));
  const atOrNear60 = scoped.filter((c) => c.avgFps >= 55).length;

  const byPlatform: PlatformTelemetrySummary[] = ALL_PLATFORMS.map((platform) => {
    const group = scoped.filter((c) => c.platform === platform);
    if (group.length === 0) return null;
    const gAvg = group.reduce((a, b) => a + b.avgFps, 0) / group.length;
    const gLow = group.reduce((a, b) => a + b.low1PercentFps, 0) / group.length;
    const gFt = group.reduce((a, b) => a + b.frameTimeMs, 0) / group.length;
    return {
      platform,
      clipCount: group.length,
      meanAvgFps: Number(gAvg.toFixed(1)),
      meanLow1PercentFps: Number(gLow.toFixed(1)),
      meanFrameTimeMs: Number(gFt.toFixed(1)),
    };
  }).filter((item): item is PlatformTelemetrySummary => item !== null);

  return {
    clipCount: scoped.length,
    meanAvgFps: Number((sumAvg / scoped.length).toFixed(1)),
    minLow1PercentFps: Number(minLow1.toFixed(1)),
    meanFrameTimeMs: Number((sumFrameTime / scoped.length).toFixed(1)),
    target60RatePct: Math.round((atOrNear60 / scoped.length) * 100),
    byPlatform,
  };
}

export interface BugSubmissionInput {
  title: string;
  author: string;
  platform: ConsolePlatform;
  severity: BugSeverity;
  patchVersion: string;
  chapterOrZone: string;
  description: string;
  reproStepsText: string;
  hardwareNotes: string;
}

export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

export function validateBugSubmission(
  input: BugSubmissionInput
): ValidationErrors<'title' | 'author' | 'chapterOrZone' | 'description' | 'reproStepsText'> {
  const errors: ValidationErrors<'title' | 'author' | 'chapterOrZone' | 'description' | 'reproStepsText'> = {};

  if (!input.title.trim() || input.title.trim().length < 6) {
    errors.title = 'Enter a concise bug title (at least 6 characters).';
  }
  if (!input.author.trim()) {
    errors.author = 'Enter your handle or gamer tag.';
  }
  if (!input.chapterOrZone.trim()) {
    errors.chapterOrZone = 'Specify the chapter or zone where the issue occurs.';
  }
  if (!input.description.trim() || input.description.trim().length < 15) {
    errors.description = 'Describe the observed issue (at least 15 characters).';
  }
  const steps = input.reproStepsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (steps.length === 0) {
    errors.reproStepsText = 'Provide at least one reproduction step.';
  }

  return errors;
}

export interface ClipSubmissionInput {
  title: string;
  author: string;
  platform: ConsolePlatform;
  zone: string;
  resolution: string;
  graphicsMode: string;
  avgFps: number;
  low1PercentFps: number;
  frameTimeMs: number;
  hasVideo: boolean;
}

export function validateClipSubmission(
  input: ClipSubmissionInput
): ValidationErrors<
  'title' | 'author' | 'zone' | 'avgFps' | 'low1PercentFps' | 'frameTimeMs' | 'hasVideo'
> {
  const errors: ValidationErrors<
    'title' | 'author' | 'zone' | 'avgFps' | 'low1PercentFps' | 'frameTimeMs' | 'hasVideo'
  > = {};

  if (!input.title.trim() || input.title.trim().length < 4) {
    errors.title = 'Enter a descriptive clip title (at least 4 characters).';
  }
  if (!input.author.trim()) {
    errors.author = 'Enter your handle.';
  }
  if (!input.zone.trim()) {
    errors.zone = 'Specify the zone or boss encounter.';
  }
  if (!Number.isFinite(input.avgFps) || input.avgFps <= 0 || input.avgFps > 500) {
    errors.avgFps = 'Avg FPS must be between 1 and 500.';
  }
  if (
    !Number.isFinite(input.low1PercentFps) ||
    input.low1PercentFps <= 0 ||
    input.low1PercentFps > input.avgFps
  ) {
    errors.low1PercentFps = '1% Low FPS must be positive and not exceed Avg FPS.';
  }
  if (!Number.isFinite(input.frameTimeMs) || input.frameTimeMs <= 0 || input.frameTimeMs > 500) {
    errors.frameTimeMs = 'Frame time (ms) must be between 0.1 and 500.';
  }
  if (!input.hasVideo) {
    errors.hasVideo = 'Select a gameplay video file or generate a sample clip.';
  }

  return errors;
}

export function formatRelativeTime(isoDate: string, nowMs: number = Date.now()): string {
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return 'Recently';
  const diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
