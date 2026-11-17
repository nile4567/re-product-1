import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { BugForumView } from './components/BugForumView';
import { ClipsStatsView } from './components/ClipsStatsView';
import { GuidesView } from './components/GuidesView';
import { OverviewView } from './components/OverviewView';
import { Sidebar } from './components/Sidebar';
import type {
  AppState,
  BugSeverity,
  BugStatus,
  BugThread,
  ConsolePlatform,
  GameplayClip,
  GameProgress,
  NavSection,
} from './types/domain';
import { aggregatePerformanceStats, calculateGameProgress } from './utils/trackerLogic';

const SECTION_LABELS: Record<NavSection, string> = {
  overview: 'Overview',
  guides: 'Interactive Guides',
  forum: 'Bug Forum',
  clips: 'Clips & Stats',
};

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeGameId, setActiveGameId] = useState<string>('aethelgard');
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Unable to load Waypoint workspace data.');
      const data = (await res.json()) as AppState;
      setAppState(data);
      const defaultGame =
        data.games.find((g) => g.id === activeGameId) ?? data.games[0];
      if (defaultGame) {
        setActiveGameId(defaultGame.id);
        setSelectedChapterId((prev) =>
          defaultGame.chapters.some((c) => c.id === prev)
            ? prev
            : defaultGame.chapters[0]?.id ?? ''
        );
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  }, [activeGameId]);

  useEffect(() => {
    void fetchState();
    // Initial hydration only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeGame = useMemo(() => {
    if (!appState) return null;
    return appState.games.find((g) => g.id === activeGameId) ?? appState.games[0] ?? null;
  }, [appState, activeGameId]);

  const activeProgress: GameProgress = useMemo(() => {
    if (!appState || !activeGame) {
      return {
        completedStepIds: [],
        collectedIds: [],
        activePlatform: 'PS5',
        lastUpdated: new Date().toISOString(),
      };
    }
    return (
      appState.progressByGame[activeGame.id] ?? {
        completedStepIds: [],
        collectedIds: [],
        activePlatform: activeGame.platforms[0] ?? 'PS5',
        lastUpdated: new Date().toISOString(),
      }
    );
  }, [appState, activeGame]);

  const progressSummary = useMemo(() => {
    if (!activeGame) {
      return {
        completedSteps: 0,
        totalSteps: 0,
        completedCollectibles: 0,
        totalCollectibles: 0,
        totalItems: 0,
        completedItems: 0,
        percentage: 0,
        chapterSummaries: [],
        nextStep: null,
      };
    }
    return calculateGameProgress(
      activeGame.chapters,
      activeProgress.completedStepIds,
      activeProgress.collectedIds
    );
  }, [activeGame, activeProgress]);

  const gameThreads = useMemo(
    () => (appState ? appState.bugThreads.filter((t) => t.gameId === activeGameId) : []),
    [appState, activeGameId]
  );

  const gameClips = useMemo(
    () => (appState ? appState.clips.filter((c) => c.gameId === activeGameId) : []),
    [appState, activeGameId]
  );

  const performanceSummary = useMemo(
    () => aggregatePerformanceStats(gameClips, 'All'),
    [gameClips]
  );

  const handleSelectGame = (gameId: string) => {
    setActiveGameId(gameId);
    const target = appState?.games.find((g) => g.id === gameId);
    if (target) {
      setSelectedChapterId(target.chapters[0]?.id ?? '');
    }
    setSelectedThreadId(null);
  };

  const handleToggleItem = async (
    itemType: 'step' | 'collectible',
    itemId: string
  ) => {
    if (!activeGame) return;
    const res = await fetch('/api/progress/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: activeGame.id, itemType, itemId }),
    });
    if (!res.ok) return;
    const { progress } = (await res.json()) as { progress: GameProgress };
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            progressByGame: { ...prev.progressByGame, [activeGame.id]: progress },
          }
        : prev
    );
  };

  const handleSelectPlatform = async (platform: ConsolePlatform) => {
    if (!activeGame) return;
    const res = await fetch('/api/progress/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: activeGame.id,
        itemType: 'platform',
        activePlatform: platform,
      }),
    });
    if (!res.ok) return;
    const { progress } = (await res.json()) as { progress: GameProgress };
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            progressByGame: { ...prev.progressByGame, [activeGame.id]: progress },
          }
        : prev
    );
  };

  const handleResetChapter = async (chapterId: string) => {
    if (!activeGame) return;
    const res = await fetch('/api/progress/reset-chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: activeGame.id, chapterId }),
    });
    if (!res.ok) return;
    const { progress } = (await res.json()) as { progress: GameProgress };
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            progressByGame: { ...prev.progressByGame, [activeGame.id]: progress },
          }
        : prev
    );
  };

  const handleCreateBug = async (payload: {
    gameId: string;
    title: string;
    author: string;
    platform: ConsolePlatform;
    severity: BugSeverity;
    patchVersion: string;
    chapterOrZone: string;
    description: string;
    reproStepsText: string;
    hardwareNotes: string;
  }) => {
    const res = await fetch('/api/bugs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { thread?: BugThread; error?: string };
    if (!res.ok || !data.thread) {
      throw new Error(data.error || 'Failed to submit bug report.');
    }
    const created = data.thread;
    setAppState((prev) =>
      prev ? { ...prev, bugThreads: [created, ...prev.bugThreads] } : prev
    );
    setSelectedThreadId(created.id);
    setActiveNav('forum');
  };

  const handleConfirmBug = async (threadId: string) => {
    const res = await fetch(`/api/bugs/${threadId}/vote`, { method: 'POST' });
    if (!res.ok) return;
    const { thread } = (await res.json()) as { thread: BugThread };
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            bugThreads: prev.bugThreads.map((t) => (t.id === thread.id ? thread : t)),
          }
        : prev
    );
  };

  const handleUpdateBugStatus = async (threadId: string, status: BugStatus) => {
    const res = await fetch(`/api/bugs/${threadId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    const { thread } = (await res.json()) as { thread: BugThread };
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            bugThreads: prev.bugThreads.map((t) => (t.id === thread.id ? thread : t)),
          }
        : prev
    );
  };

  const handleAddReply = async (
    threadId: string,
    payload: {
      author: string;
      platform: ConsolePlatform;
      body: string;
      isWorkaround: boolean;
    }
  ) => {
    const res = await fetch(`/api/bugs/${threadId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { thread?: BugThread; error?: string };
    if (!res.ok || !data.thread) {
      throw new Error(data.error || 'Failed to post reply.');
    }
    const updated = data.thread;
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            bugThreads: prev.bugThreads.map((t) => (t.id === updated.id ? updated : t)),
          }
        : prev
    );
  };

  const handleCreateClip = async (payload: {
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
    videoUrl: string;
    notes: string;
  }) => {
    const res = await fetch('/api/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { clip?: GameplayClip; error?: string };
    if (!res.ok || !data.clip) {
      throw new Error(data.error || 'Failed to save clip.');
    }
    const created = data.clip;
    setAppState((prev) => (prev ? { ...prev, clips: [created, ...prev.clips] } : prev));
    setActiveNav('clips');
  };

  const handleDeleteClip = async (clipId: string) => {
    const res = await fetch(`/api/clips/${clipId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setAppState((prev) =>
      prev ? { ...prev, clips: prev.clips.filter((c) => c.id !== clipId) } : prev
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl space-y-4 animate-pulse">
          <div className="h-10 bg-slate-900 rounded-lg border border-slate-800 w-1/3" />
          <div className="h-48 bg-slate-900 rounded-xl border border-slate-800" />
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-slate-900 rounded-xl border border-slate-800" />
            <div className="h-24 bg-slate-900 rounded-xl border border-slate-800" />
            <div className="h-24 bg-slate-900 rounded-xl border border-slate-800" />
            <div className="h-24 bg-slate-900 rounded-xl border border-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !appState || !activeGame) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4 text-center">
          <h1 className="font-display text-lg font-bold text-white">
            Unable to load workspace
          </h1>
          <p className="text-sm text-slate-400">{loadError ?? 'Workspace unavailable.'}</p>
          <button
            type="button"
            onClick={() => void fetchState()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const headerAction =
    activeNav === 'clips'
      ? {
          label: 'Upload Clip',
          onClick: () => setUploadModalOpen(true),
        }
      : {
          label: 'Report Bug',
          onClick: () => {
            setActiveNav('forum');
            setReportModalOpen(true);
          },
        };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex">
      <Sidebar
        games={appState.games}
        activeGame={activeGame}
        activeNav={activeNav}
        activePlatform={activeProgress.activePlatform}
        progressSummary={progressSummary}
        bugCount={gameThreads.length}
        clipCount={gameClips.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectGame={handleSelectGame}
        onSelectNav={setActiveNav}
        onSelectPlatform={(platform) => void handleSelectPlatform(platform)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary CTA on right */}
        <header className="sticky top-0 z-30 h-14 px-4 sm:px-8 bg-[#0B1120]/95 backdrop-blur border-b border-slate-800/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-medium text-slate-300 truncate">{activeGame.title}</span>
              <span aria-hidden="true" className="text-slate-600">
                /
              </span>
              <span className="font-semibold text-white whitespace-nowrap">
                {SECTION_LABELS[activeNav]}
              </span>
            </nav>
          </div>

          <button
            type="button"
            onClick={headerAction.onClick}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            {headerAction.label}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
          {activeNav === 'overview' && (
            <OverviewView
              game={activeGame}
              activePlatform={activeProgress.activePlatform}
              progressSummary={progressSummary}
              threads={gameThreads}
              clips={gameClips}
              performance={performanceSummary}
              onNavigate={setActiveNav}
              onOpenChapter={(chapterId) => {
                setSelectedChapterId(chapterId);
                setActiveNav('guides');
              }}
              onSelectThread={(threadId) => {
                setSelectedThreadId(threadId);
                setActiveNav('forum');
              }}
              onOpenReportBug={() => {
                setActiveNav('forum');
                setReportModalOpen(true);
              }}
              onOpenUploadClip={() => {
                setActiveNav('clips');
                setUploadModalOpen(true);
              }}
            />
          )}

          {activeNav === 'guides' && (
            <GuidesView
              game={activeGame}
              progress={activeProgress}
              selectedChapterId={selectedChapterId}
              onSelectChapter={setSelectedChapterId}
              onToggleItem={handleToggleItem}
              onResetChapter={handleResetChapter}
            />
          )}

          {activeNav === 'forum' && (
            <BugForumView
              game={activeGame}
              threads={appState.bugThreads}
              activePlatform={activeProgress.activePlatform}
              selectedThreadId={selectedThreadId}
              reportModalOpen={reportModalOpen}
              onSelectThread={setSelectedThreadId}
              onOpenReportModal={() => setReportModalOpen(true)}
              onCloseReportModal={() => setReportModalOpen(false)}
              onCreateBug={handleCreateBug}
              onConfirmBug={handleConfirmBug}
              onUpdateStatus={handleUpdateBugStatus}
              onAddReply={handleAddReply}
            />
          )}

          {activeNav === 'clips' && (
            <ClipsStatsView
              game={activeGame}
              clips={appState.clips}
              activePlatform={activeProgress.activePlatform}
              uploadModalOpen={uploadModalOpen}
              onOpenUploadModal={() => setUploadModalOpen(true)}
              onCloseUploadModal={() => setUploadModalOpen(false)}
              onCreateClip={handleCreateClip}
              onDeleteClip={handleDeleteClip}
            />
          )}
        </main>
      </div>
    </div>
  );
}
