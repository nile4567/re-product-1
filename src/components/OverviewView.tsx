import { ArrowRight, CheckCircle2, Play } from 'lucide-react';
import type {
  BugThread,
  ConsolePlatform,
  Game,
  GameplayClip,
  NavSection,
} from '../types/domain';
import type { AggregatePerformanceResult, GameProgressSummary } from '../utils/trackerLogic';
import { formatRelativeTime } from '../utils/trackerLogic';
import { ImageWithFallback } from './ImageWithFallback';

interface OverviewViewProps {
  game: Game;
  activePlatform: ConsolePlatform;
  progressSummary: GameProgressSummary;
  threads: BugThread[];
  clips: GameplayClip[];
  performance: AggregatePerformanceResult;
  onNavigate: (nav: NavSection) => void;
  onOpenChapter: (chapterId: string) => void;
  onSelectThread: (threadId: string) => void;
  onOpenReportBug: () => void;
  onOpenUploadClip: () => void;
}

export function OverviewView({
  game,
  activePlatform,
  progressSummary,
  threads,
  clips,
  performance,
  onNavigate,
  onOpenChapter,
  onSelectThread,
  onOpenReportBug,
  onOpenUploadClip,
}: OverviewViewProps) {
  const platformBugs = threads.filter((t) => t.platform === activePlatform);
  const topThreads = (platformBugs.length > 0 ? platformBugs : threads).slice(0, 3);
  const latestClip = clips[0] ?? null;

  return (
    <div className="space-y-8">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{game.genre}</span>
              <span aria-hidden="true">·</span>
              <span>Patch {game.currentPatch}</span>
              <span aria-hidden="true">·</span>
              <span>Tracking on {activePlatform}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              {game.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              {progressSummary.nextStep
                ? `Next objective in ${progressSummary.nextStep.chapterTitle}: ${progressSummary.nextStep.stepTitle} (${progressSummary.nextStep.location}).`
                : 'All walkthrough steps and collectibles in this campaign are complete.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (progressSummary.nextStep) {
                  onOpenChapter(progressSummary.nextStep.chapterId);
                } else {
                  onNavigate('guides');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>
                {progressSummary.nextStep ? 'Resume Walkthrough' : 'Review Walkthrough'}
              </span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onOpenReportBug}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Report Console Bug
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full bg-slate-900">
          <ImageWithFallback
            src={game.coverUrl}
            alt={`${game.title} key artwork`}
            className="w-full h-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#111827] via-black/30 to-transparent lg:bg-gradient-to-r lg:from-[#111827] lg:via-transparent lg:to-transparent"
          />
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section
        aria-label="Campaign and performance summary"
        className="grid grid-cols-2 lg:grid-cols-4 bg-[#111827] border border-slate-800 rounded-xl divide-x divide-y lg:divide-y-0 divide-slate-800 overflow-hidden"
      >
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">Campaign Completion</p>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {progressSummary.percentage}%
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            {progressSummary.completedSteps}/{progressSummary.totalSteps} steps ·{' '}
            {progressSummary.completedCollectibles}/{progressSummary.totalCollectibles} items
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">{activePlatform} Bug Reports</p>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {platformBugs.length}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            {threads.length} total across all consoles
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">Mean Frame Rate</p>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {performance.clipCount > 0 ? `${performance.meanAvgFps} fps` : '—'}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            {performance.clipCount > 0
              ? `${performance.meanFrameTimeMs} ms avg frame time`
              : 'No clips logged yet'}
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">Uploaded Clips</p>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {clips.length}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            {performance.target60RatePct}% at 55+ fps target
          </p>
        </div>
      </section>

      {/* Chapter Progress Breakdown + Community & Clip Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chapters */}
        <section className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Chapter Progress
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('guides')}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
            >
              View All Guides
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {progressSummary.chapterSummaries.map((ch, idx) => (
              <div key={ch.chapterId} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenChapter(ch.chapterId)}
                    className="text-left text-sm font-medium text-slate-100 hover:text-blue-400 transition-colors truncate"
                  >
                    0{idx + 1}. {ch.title}
                  </button>
                  <span className="font-mono text-xs tabular-nums text-slate-300 shrink-0">
                    {ch.percentage}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-200 ${
                      ch.percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${ch.percentage}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums">
                  <span>
                    {ch.completedSteps}/{ch.totalSteps} steps
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {ch.completedCollectibles}/{ch.totalCollectibles} collectibles
                  </span>
                  {ch.percentage === 100 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Cleared
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Console Bug Alerts & Latest Clip */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-white">
                Top {platformBugs.length > 0 ? activePlatform : 'Community'} Issues
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('forum')}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
              >
                Open Bug Forum
              </button>
            </div>

            {topThreads.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                No console bug reports logged for this title yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {topThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => onSelectThread(thread.id)}
                        className="text-left text-sm font-medium text-slate-100 hover:text-blue-400 transition-colors line-clamp-1"
                      >
                        {thread.title}
                      </button>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span
                          className={
                            thread.severity === 'Critical'
                              ? 'text-red-400 font-medium'
                              : thread.severity === 'Major'
                              ? 'text-amber-400 font-medium'
                              : 'text-slate-300 font-medium'
                          }
                        >
                          {thread.severity}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{thread.platform}</span>
                        <span aria-hidden="true">·</span>
                        <span>{thread.status}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {thread.confirmations} confirmations
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(thread.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-white">
                Latest Gameplay Benchmark
              </h2>
              <button
                type="button"
                onClick={onOpenUploadClip}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
              >
                Upload Clip
              </button>
            </div>

            {latestClip ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="space-y-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('clips')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-100 hover:text-blue-400 transition-colors text-left"
                  >
                    <Play className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">{latestClip.title}</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{latestClip.platform}</span>
                    <span aria-hidden="true">·</span>
                    <span>{latestClip.resolution}</span>
                    <span aria-hidden="true">·</span>
                    <span>{latestClip.graphicsMode}</span>
                    <span aria-hidden="true">·</span>
                    <span>by {latestClip.author}</span>
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0 font-mono tabular-nums">
                  <div>
                    <p className="text-xs text-slate-400">Avg FPS</p>
                    <p className="text-base font-semibold text-emerald-400">
                      {latestClip.avgFps}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">1% Low</p>
                    <p className="text-base font-semibold text-slate-200">
                      {latestClip.low1PercentFps}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Frame Time</p>
                    <p className="text-base font-semibold text-slate-200">
                      {latestClip.frameTimeMs} ms
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No gameplay clips uploaded for this game yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
