import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Search,
  ThumbsUp,
  X,
} from 'lucide-react';
import type {
  BugSeverity,
  BugStatus,
  BugThread,
  ConsolePlatform,
  Game,
} from '../types/domain';
import {
  filterBugThreads,
  formatRelativeTime,
  validateBugSubmission,
  type ValidationErrors,
} from '../utils/trackerLogic';

interface BugForumViewProps {
  game: Game;
  threads: BugThread[];
  activePlatform: ConsolePlatform;
  selectedThreadId: string | null;
  reportModalOpen: boolean;
  onSelectThread: (threadId: string | null) => void;
  onOpenReportModal: () => void;
  onCloseReportModal: () => void;
  onCreateBug: (payload: {
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
  }) => Promise<void>;
  onConfirmBug: (threadId: string) => Promise<void>;
  onUpdateStatus: (threadId: string, status: BugStatus) => Promise<void>;
  onAddReply: (
    threadId: string,
    payload: {
      author: string;
      platform: ConsolePlatform;
      body: string;
      isWorkaround: boolean;
    }
  ) => Promise<void>;
}

const CONSOLE_FILTERS: (ConsolePlatform | 'All')[] = [
  'All',
  'PS5',
  'Xbox Series X',
  'PC',
  'Switch 2',
];

export function BugForumView({
  game,
  threads,
  activePlatform,
  selectedThreadId,
  reportModalOpen,
  onSelectThread,
  onOpenReportModal,
  onCloseReportModal,
  onCreateBug,
  onConfirmBug,
  onUpdateStatus,
  onAddReply,
}: BugForumViewProps) {
  const [platformFilter, setPlatformFilter] = useState<ConsolePlatform | 'All'>('All');
  const [severityFilter, setSeverityFilter] = useState<BugSeverity | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<BugStatus | 'All'>('All');
  const [sortBy, setSortBy] = useState<'votes' | 'newest'>('votes');
  const [search, setSearch] = useState('');

  // Reply form state
  const [replyAuthor, setReplyAuthor] = useState('');
  const [replyPlatform, setReplyPlatform] = useState<ConsolePlatform>(activePlatform);
  const [replyBody, setReplyBody] = useState('');
  const [replyIsWorkaround, setReplyIsWorkaround] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Report Bug modal form state
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [platform, setPlatform] = useState<ConsolePlatform>(activePlatform);
  const [severity, setSeverity] = useState<BugSeverity>('Major');
  const [patchVersion, setPatchVersion] = useState(game.currentPatch);
  const [chapterOrZone, setChapterOrZone] = useState(game.chapters[0]?.title ?? '');
  const [description, setDescription] = useState('');
  const [reproStepsText, setReproStepsText] = useState('');
  const [hardwareNotes, setHardwareNotes] = useState('');
  const [formErrors, setFormErrors] = useState<
    ValidationErrors<'title' | 'author' | 'chapterOrZone' | 'description' | 'reproStepsText'>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingBug, setSubmittingBug] = useState(false);

  const filteredThreads = useMemo(
    () =>
      filterBugThreads(threads, {
        gameId: game.id,
        platform: platformFilter,
        severity: severityFilter,
        status: statusFilter,
        search,
        sortBy,
      }),
    [threads, game.id, platformFilter, severityFilter, statusFilter, search, sortBy]
  );

  const activeThread = useMemo(() => {
    if (selectedThreadId) {
      const found = filteredThreads.find((t) => t.id === selectedThreadId);
      if (found) return found;
      const anyFound = threads.find((t) => t.id === selectedThreadId && t.gameId === game.id);
      if (anyFound) return anyFound;
    }
    return filteredThreads[0] ?? null;
  }, [selectedThreadId, filteredThreads, threads, game.id]);

  const handleCreateBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errors = validateBugSubmission({
      title,
      author,
      platform,
      severity,
      patchVersion,
      chapterOrZone,
      description,
      reproStepsText,
      hardwareNotes,
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmittingBug(true);
      await onCreateBug({
        gameId: game.id,
        title,
        author,
        platform,
        severity,
        patchVersion,
        chapterOrZone,
        description,
        reproStepsText,
        hardwareNotes,
      });
      setTitle('');
      setAuthor('');
      setDescription('');
      setReproStepsText('');
      setHardwareNotes('');
      setFormErrors({});
      onCloseReportModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to post bug report.');
    } finally {
      setSubmittingBug(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread) return;
    if (!replyAuthor.trim() || replyBody.trim().length < 4) {
      setReplyError('Provide your handle and at least 4 characters for the reply.');
      return;
    }
    setReplyError(null);
    try {
      setSubmittingReply(true);
      await onAddReply(activeThread.id, {
        author: replyAuthor.trim(),
        platform: replyPlatform,
        body: replyBody.trim(),
        isWorkaround: replyIsWorkaround,
      });
      setReplyBody('');
      setReplyIsWorkaround(false);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to post reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Console Filter Strip */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">
            Multi-Console Bug Forum
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Report platform-specific crashes, frame drops, and verified workarounds for{' '}
            {game.title}.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div
            role="group"
            aria-label="Filter bug reports by console"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg"
          >
            {CONSOLE_FILTERS.map((consoleName) => (
              <button
                key={consoleName}
                type="button"
                onClick={() => setPlatformFilter(consoleName)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  platformFilter === consoleName
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {consoleName}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bugs or zones..."
                aria-label="Search bug reports"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <select
              aria-label="Filter by severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as BugSeverity | 'All')}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BugStatus | 'All')}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Workaround">Workaround</option>
              <option value="Patched">Patched</option>
            </select>

            <select
              aria-label="Sort bug threads"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'votes' | 'newest')}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="votes">Most Confirmed</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>
      </section>

      {/* Split Issue List & Thread Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          aria-label="Bug report threads"
          className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl divide-y divide-slate-800/80 overflow-hidden"
        >
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">
                No bug reports match the selected console or filter criteria.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPlatformFilter('All');
                  setSeverityFilter('All');
                  setStatusFilter('All');
                  setSearch('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const isSelected = activeThread?.id === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full text-left p-4 transition-colors space-y-1.5 ${
                    isSelected ? 'bg-blue-600/10' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-100 leading-snug">
                      {thread.title}
                    </h2>
                    <span className="font-mono text-xs tabular-nums text-slate-300 shrink-0">
                      +{thread.confirmations}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
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
                    <span className="text-slate-200">{thread.platform}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        thread.status === 'Patched'
                          ? 'text-emerald-400'
                          : thread.status === 'Workaround'
                          ? 'text-blue-300'
                          : 'text-slate-400'
                      }
                    >
                      {thread.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {thread.replies.length}{' '}
                      {thread.replies.length === 1 ? 'reply' : 'replies'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate">
                    {thread.chapterOrZone} · Patch {thread.patchVersion} ·{' '}
                    {formatRelativeTime(thread.createdAt)}
                  </p>
                </button>
              );
            })
          )}
        </section>

        {/* Thread Detail View */}
        <section
          aria-label="Selected bug details"
          className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6"
        >
          {activeThread ? (
            <>
              <div className="space-y-3 pb-5 border-b border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 min-w-0">
                    <span
                      className={
                        activeThread.severity === 'Critical'
                          ? 'text-red-400 font-semibold'
                          : activeThread.severity === 'Major'
                          ? 'text-amber-400 font-semibold'
                          : 'text-slate-300 font-semibold'
                      }
                    >
                      {activeThread.severity}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-200 font-medium">{activeThread.platform}</span>
                    <span aria-hidden="true">·</span>
                    <span>Patch {activeThread.patchVersion}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeThread.chapterOrZone}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor="thread-status-select" className="sr-only">
                      Thread status
                    </label>
                    <select
                      id="thread-status-select"
                      value={activeThread.status}
                      onChange={(e) =>
                        onUpdateStatus(activeThread.id, e.target.value as BugStatus)
                      }
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="Open">Status: Open</option>
                      <option value="Workaround">Status: Workaround</option>
                      <option value="Patched">Status: Patched</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onConfirmBug(activeThread.id)}
                      aria-label={`Confirm bug "${activeThread.title}"`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                      <span>Confirm Bug</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        ({activeThread.confirmations})
                      </span>
                    </button>
                  </div>
                </div>

                <h2 className="font-display text-xl font-bold text-white">
                  {activeThread.title}
                </h2>
                <p className="text-xs text-slate-400">
                  Reported by {activeThread.author} ·{' '}
                  {formatRelativeTime(activeThread.createdAt)} · {activeThread.hardwareNotes}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-1.5">
                    Observed Behavior
                  </h3>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {activeThread.description}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 mb-1.5">
                    Reproduction Steps
                  </h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-slate-300">
                    {activeThread.reproSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Community Replies */}
              <div className="pt-5 border-t border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageSquare className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  <span>Community Replies &amp; Workarounds ({activeThread.replies.length})</span>
                </div>

                {activeThread.replies.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No replies yet. Share a console workaround or confirm your hardware specs
                    below.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800/80">
                    {activeThread.replies.map((reply) => (
                      <div key={reply.id} className="py-3.5 first:pt-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-100">{reply.author}</span>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-400">{reply.platform}</span>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-400">
                            {formatRelativeTime(reply.createdAt)}
                          </span>
                          {reply.isWorkaround && (
                            <>
                              <span aria-hidden="true" className="text-slate-600">
                                ·
                              </span>
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                Verified Workaround
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                <form
                  onSubmit={handleReplySubmit}
                  className="pt-4 border-t border-slate-800 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reply-author" className="block text-xs text-slate-400 mb-1">
                        Your Handle
                      </label>
                      <input
                        id="reply-author"
                        type="text"
                        value={replyAuthor}
                        onChange={(e) => setReplyAuthor(e.target.value)}
                        placeholder="e.g. NexusPlayer"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="reply-platform"
                        className="block text-xs text-slate-400 mb-1"
                      >
                        Console / Platform
                      </label>
                      <select
                        id="reply-platform"
                        value={replyPlatform}
                        onChange={(e) => setReplyPlatform(e.target.value as ConsolePlatform)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {game.platforms.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reply-body" className="block text-xs text-slate-400 mb-1">
                      Reply or Workaround
                    </label>
                    <textarea
                      id="reply-body"
                      rows={2}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Share your hardware notes or a working fix..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                  </div>

                  {replyError && (
                    <p role="alert" className="text-xs text-red-400">
                      {replyError}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={replyIsWorkaround}
                        onChange={(e) => setReplyIsWorkaround(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                      <span>Mark this reply as a verified workaround</span>
                    </label>

                    <button
                      type="submit"
                      disabled={submittingReply}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                    >
                      {submittingReply ? 'Posting...' : 'Post Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-slate-400">
              Select a bug report on the left or file a new console issue.
            </div>
          )}
        </section>
      </div>

      {/* Report Bug Modal */}
      {reportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-bug-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
        >
          <div className="w-full max-w-xl bg-[#111827] border border-slate-700 rounded-xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="report-bug-title" className="font-display text-lg font-bold text-white">
                Report Console Bug — {game.title}
              </h2>
              <button
                type="button"
                onClick={onCloseReportModal}
                aria-label="Close bug report modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateBugSubmit} className="space-y-4">
              <div>
                <label htmlFor="bug-title" className="block text-xs font-medium text-slate-300 mb-1">
                  Bug Title
                </label>
                <input
                  id="bug-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Crash when opening inventory in Belltower"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.title && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.title}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="bug-author"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Your Handle
                  </label>
                  <input
                    id="bug-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="GamerTag"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  {formErrors.author && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.author}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="bug-platform"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Console / Platform
                  </label>
                  <select
                    id="bug-platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as ConsolePlatform)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {game.platforms.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="bug-severity"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Severity
                  </label>
                  <select
                    id="bug-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="bug-zone"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Chapter or Zone
                  </label>
                  <input
                    id="bug-zone"
                    type="text"
                    value={chapterOrZone}
                    onChange={(e) => setChapterOrZone(e.target.value)}
                    placeholder="e.g. Flooded Cathedral"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  {formErrors.chapterOrZone && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.chapterOrZone}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="bug-patch"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Patch Version
                  </label>
                  <input
                    id="bug-patch"
                    type="text"
                    value={patchVersion}
                    onChange={(e) => setPatchVersion(e.target.value)}
                    placeholder={game.currentPatch}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="bug-description"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="bug-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happens, error codes, or visual glitches..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.description && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.description}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="bug-repro"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Reproduction Steps (one per line)
                </label>
                <textarea
                  id="bug-repro"
                  rows={3}
                  value={reproStepsText}
                  onChange={(e) => setReproStepsText(e.target.value)}
                  placeholder={'1. Travel to Flooded Cathedral\n2. Open inventory near east gate'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.reproStepsText && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.reproStepsText}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="bug-hardware"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Console / Display Mode Notes (optional)
                </label>
                <input
                  id="bug-hardware"
                  type="text"
                  value={hardwareNotes}
                  onChange={(e) => setHardwareNotes(e.target.value)}
                  placeholder="e.g. PS5 Pro · Performance Mode · VRR On"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-300"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onCloseReportModal}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBug}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white"
                >
                  {submittingBug ? 'Submitting...' : 'Submit Bug Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
