import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregatePerformanceStats,
  calculateGameProgress,
  filterBugThreads,
  formatRelativeTime,
  validateBugSubmission,
  validateClipSubmission,
} from './trackerLogic';
import { SEED_STATE } from '../data/seedData';

test('calculateGameProgress computes exact counts, percentage, and next uncompleted step', () => {
  const aethelgard = SEED_STATE.games[0];
  const progress = SEED_STATE.progressByGame.aethelgard;
  const summary = calculateGameProgress(
    aethelgard.chapters,
    progress.completedStepIds,
    progress.collectedIds
  );

  // Total steps = 3 + 3 + 2 = 8; total collectibles = 2 + 2 + 2 = 6; total = 14
  assert.equal(summary.totalSteps, 8);
  assert.equal(summary.completedSteps, 4);
  assert.equal(summary.totalCollectibles, 6);
  assert.equal(summary.completedCollectibles, 2);
  assert.equal(summary.percentage, Math.round((6 / 14) * 100));
  assert.equal(summary.nextStep?.stepId, 'aeth-s5');
  assert.equal(summary.nextStep?.chapterTitle, 'Flooded Cathedral');
});

test('calculateGameProgress returns null nextStep when 100% of steps are complete', () => {
  const ironclad = SEED_STATE.games[2];
  const allSteps = ironclad.chapters.flatMap((c) => c.steps.map((s) => s.id));
  const allCollectibles = ironclad.chapters.flatMap((c) => c.collectibles.map((col) => col.id));
  const summary = calculateGameProgress(ironclad.chapters, allSteps, allCollectibles);

  assert.equal(summary.percentage, 100);
  assert.equal(summary.nextStep, null);
});

test('filterBugThreads filters by game, console platform, severity, and search query', () => {
  const ps5Threads = filterBugThreads(SEED_STATE.bugThreads, {
    gameId: 'aethelgard',
    platform: 'PS5',
    sortBy: 'votes',
  });
  assert.equal(ps5Threads.length, 1);
  assert.equal(ps5Threads[0].id, 'bug-101');

  const searchThreads = filterBugThreads(SEED_STATE.bugThreads, {
    gameId: 'aethelgard',
    search: 'Quick Resume',
  });
  assert.equal(searchThreads.length, 1);
  assert.equal(searchThreads[0].platform, 'Xbox Series X');

  const sortedByVotes = filterBugThreads(SEED_STATE.bugThreads, {
    gameId: 'aethelgard',
    sortBy: 'votes',
  });
  assert.equal(sortedByVotes[0].confirmations >= sortedByVotes[1].confirmations, true);
});

test('aggregatePerformanceStats computes mean FPS, min 1% low, and console breakdown', () => {
  const aethClips = SEED_STATE.clips.filter((c) => c.gameId === 'aethelgard');
  const stats = aggregatePerformanceStats(aethClips, 'All');

  assert.equal(stats.clipCount, 4);
  assert.equal(stats.minLow1PercentFps, 27.4);
  assert.equal(stats.byPlatform.length, 4);
  assert.equal(stats.target60RatePct, 50); // 2 of 4 clips >= 55 fps

  const pcOnly = aggregatePerformanceStats(aethClips, 'PC');
  assert.equal(pcOnly.clipCount, 1);
  assert.equal(pcOnly.meanAvgFps, 114.6);
});

test('validateBugSubmission rejects invalid empty fields and accepts valid input', () => {
  const invalid = validateBugSubmission({
    title: 'bug',
    author: '',
    platform: 'PS5',
    severity: 'Major',
    patchVersion: '1.04',
    chapterOrZone: '',
    description: 'too short',
    reproStepsText: '   ',
    hardwareNotes: '',
  });

  assert.ok(invalid.title);
  assert.ok(invalid.author);
  assert.ok(invalid.chapterOrZone);
  assert.ok(invalid.description);
  assert.ok(invalid.reproStepsText);

  const valid = validateBugSubmission({
    title: 'Audio crackle inside Crypt elevator',
    author: 'Tester01',
    platform: 'PS5',
    severity: 'Major',
    patchVersion: '1.04',
    chapterOrZone: 'Flooded Cathedral',
    description: 'Sound effects stutter repeatedly while riding the lift downward.',
    reproStepsText: 'Pull lever\nStand near east railing',
    hardwareNotes: 'PS5 Slim',
  });

  assert.deepEqual(valid, {});
});

test('validateClipSubmission enforces FPS bounds and video attachment', () => {
  const invalid = validateClipSubmission({
    title: 'ab',
    author: '',
    platform: 'PC',
    zone: '',
    resolution: '1440p',
    graphicsMode: 'High',
    avgFps: 45,
    low1PercentFps: 60,
    frameTimeMs: -2,
    hasVideo: false,
  });

  assert.ok(invalid.title);
  assert.ok(invalid.author);
  assert.ok(invalid.zone);
  assert.ok(invalid.low1PercentFps);
  assert.ok(invalid.frameTimeMs);
  assert.ok(invalid.hasVideo);

  const valid = validateClipSubmission({
    title: 'Boss Phase 2 Benchmark',
    author: 'NoraBench',
    platform: 'PC',
    zone: 'Flooded Cathedral',
    resolution: '2560x1440',
    graphicsMode: 'High',
    avgFps: 92.4,
    low1PercentFps: 71.0,
    frameTimeMs: 10.8,
    hasVideo: true,
  });

  assert.deepEqual(valid, {});
});

test('formatRelativeTime formats elapsed time accurately', () => {
  const now = new Date('2026-11-17T12:00:00Z').getTime();
  assert.equal(formatRelativeTime('2026-11-17T11:59:30Z', now), 'Just now');
  assert.equal(formatRelativeTime('2026-11-17T11:45:00Z', now), '15m ago');
  assert.equal(formatRelativeTime('2026-11-17T09:00:00Z', now), '3h ago');
  assert.equal(formatRelativeTime('2026-11-15T12:00:00Z', now), '2d ago');
});
