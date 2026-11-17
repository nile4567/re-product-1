import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RotateCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type { Game, GameProgress } from '../types/domain';
import { calculateGameProgress } from '../utils/trackerLogic';
import { ImageWithFallback } from './ImageWithFallback';

interface GuidesViewProps {
  game: Game;
  progress: GameProgress;
  selectedChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onToggleItem: (itemType: 'step' | 'collectible', itemId: string) => Promise<void>;
  onResetChapter: (chapterId: string) => Promise<void>;
}

type StepFilter = 'all' | 'remaining' | 'completed';

export function GuidesView({
  game,
  progress,
  selectedChapterId,
  onSelectChapter,
  onToggleItem,
  onResetChapter,
}: GuidesViewProps) {
  const [stepFilter, setStepFilter] = useState<StepFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTips, setExpandedTips] = useState<Record<string, boolean>>({});
  const [showBossSpoiler, setShowBossSpoiler] = useState(false);

  const summary = useMemo(
    () =>
      calculateGameProgress(
        game.chapters,
        progress.completedStepIds,
        progress.collectedIds
      ),
    [game.chapters, progress.completedStepIds, progress.collectedIds]
  );

  const activeChapter =
    game.chapters.find((c) => c.id === selectedChapterId) ?? game.chapters[0];
  const activeChapterSummary = summary.chapterSummaries.find(
    (s) => s.chapterId === activeChapter.id
  );

  const completedStepSet = useMemo(
    () => new Set(progress.completedStepIds),
    [progress.completedStepIds]
  );
  const collectedSet = useMemo(
    () => new Set(progress.collectedIds),
    [progress.collectedIds]
  );

  const filteredSteps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeChapter.steps.filter((step) => {
      const done = completedStepSet.has(step.id);
      if (stepFilter === 'remaining' && done) return false;
      if (stepFilter === 'completed' && !done) return false;
      if (q) {
        const hay = `${step.title} ${step.description} ${step.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeChapter.steps, completedStepSet, stepFilter, searchQuery]);

  const toggleTip = (stepId: string) => {
    setExpandedTips((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Chapter Selector List */}
      <aside
        aria-label="Walkthrough chapters"
        className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-2"
      >
        <div className="px-2 pb-2 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">Chapters</h2>
          <span className="font-mono text-xs tabular-nums text-slate-400">
            {summary.percentage}% total
          </span>
        </div>

        <div className="space-y-1">
          {game.chapters.map((chapter, idx) => {
            const chSum = summary.chapterSummaries[idx];
            const isSelected = chapter.id === activeChapter.id;
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => {
                  onSelectChapter(chapter.id);
                  setShowBossSpoiler(false);
                }}
                aria-current={isSelected ? 'true' : undefined}
                className={`w-full text-left p-3 rounded-lg border transition-colors space-y-2 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/40 text-white'
                    : 'bg-transparent border-transparent hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    0{chapter.order}. {chapter.title}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-400 shrink-0">
                    {chSum?.completedSteps}/{chSum?.totalSteps}
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-200 ${
                      chSum?.percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${chSum?.percentage ?? 0}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {chapter.region}
                  {chapter.boss ? ` · Boss: ${chapter.boss.name}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Chapter Guide Content */}
      <div className="lg:col-span-8 space-y-6">
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Chapter {activeChapter.order}</span>
                <span aria-hidden="true">·</span>
                <span>{activeChapter.region}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {activeChapterSummary?.percentage ?? 0}% complete
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold text-white tracking-tight">
                {activeChapter.title}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                {activeChapter.summary}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onResetChapter(activeChapter.id)}
              aria-label={`Reset progress for ${activeChapter.title}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Chapter</span>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter steps or locations..."
                aria-label="Filter walkthrough steps"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <div
              role="group"
              aria-label="Filter steps by completion"
              className="inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start"
            >
              {(['all', 'remaining', 'completed'] as StepFilter[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStepFilter(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                    stepFilter === mode
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Steps Checklist */}
          <div className="divide-y divide-slate-800/80">
            {filteredSteps.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-slate-400">
                  No steps match the current filter in {activeChapter.title}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStepFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredSteps.map((step) => {
                const isDone = completedStepSet.has(step.id);
                const tipOpen = Boolean(expandedTips[step.id]);
                return (
                  <div key={step.id} className="py-4 first:pt-2 last:pb-1">
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isDone}
                        aria-label={`Mark "${step.title}" as ${
                          isDone ? 'incomplete' : 'complete'
                        }`}
                        onClick={() => onToggleItem('step', step.id)}
                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isDone
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-600 hover:border-blue-400 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3
                            className={`text-sm font-semibold ${
                              isDone ? 'text-slate-400 line-through' : 'text-slate-100'
                            }`}
                          >
                            {step.order}. {step.title}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono tabular-nums">
                            {step.location} · ~{step.estimatedMinutes}m
                          </span>
                        </div>

                        <p className="text-sm text-slate-300 leading-relaxed">
                          {step.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          {step.missable && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                              Missable objective
                            </span>
                          )}

                          {step.tip && (
                            <button
                              type="button"
                              aria-expanded={tipOpen}
                              onClick={() => toggleTip(step.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <span>{tipOpen ? 'Hide Strategy Tip' : 'Show Strategy Tip'}</span>
                              {tipOpen ? (
                                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                          )}
                        </div>

                        {step.tip && tipOpen && (
                          <div className="mt-2 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                            {step.tip}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Collectibles Checklist */}
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Chapter Collectibles &amp; Key Items
            </h2>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {activeChapterSummary?.completedCollectibles}/
              {activeChapterSummary?.totalCollectibles} found
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {activeChapter.collectibles.map((item) => {
              const collected = collectedSet.has(item.id);
              return (
                <div key={item.id} className="py-3 first:pt-1 last:pb-1 flex items-start gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={collected}
                    aria-label={`Mark collectible "${item.name}" as ${
                      collected ? 'not found' : 'collected'
                    }`}
                    onClick={() => onToggleItem('collectible', item.id)}
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      collected
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-900 border-slate-600 hover:border-blue-400 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          collected ? 'text-slate-400 line-through' : 'text-slate-100'
                        }`}
                      >
                        {item.name}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="text-xs text-slate-400">{item.category}</span>
                    </div>
                    <p className="text-xs text-slate-400">{item.locationHint}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Spoiler-Protected Boss Encounter Guide */}
        {activeChapter.boss && (
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  <span>Boss Encounter Guide</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeChapter.boss.recommendedLevel}</span>
                </div>
                <h2 className="font-display text-lg font-semibold text-white">
                  {activeChapter.boss.name}
                </h2>
              </div>

              <button
                type="button"
                aria-expanded={showBossSpoiler}
                onClick={() => setShowBossSpoiler((v) => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                {showBossSpoiler ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hide Tactics</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Reveal Boss Tactics</span>
                  </>
                )}
              </button>
            </div>

            {showBossSpoiler ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2 border-t border-slate-800">
                {activeChapter.boss.imageUrl && (
                  <div className="md:col-span-5 rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                    <ImageWithFallback
                      src={activeChapter.boss.imageUrl}
                      alt={activeChapter.boss.name}
                      className="w-full h-full object-cover aspect-[4/3]"
                    />
                  </div>
                )}
                <div
                  className={`${
                    activeChapter.boss.imageUrl ? 'md:col-span-7' : 'md:col-span-12'
                  } space-y-4`}
                >
                  <p className="text-xs text-slate-400">
                    Weaknesses:{' '}
                    <span className="text-slate-200 font-medium">
                      {activeChapter.boss.weaknesses.join(' · ')}
                    </span>
                  </p>

                  <div className="divide-y divide-slate-800/80">
                    {activeChapter.boss.phases.map((p) => (
                      <div key={p.phase} className="py-3 first:pt-0 last:pb-0 space-y-1">
                        <h3 className="text-sm font-semibold text-slate-100">{p.phase}</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">{p.summary}</p>
                        <p className="text-xs text-blue-300 leading-relaxed">
                          Counter: {p.counter}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Boss phases and counterplay notes are hidden by default to protect first-run
                discovery.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
