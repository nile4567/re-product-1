import { useMemo, useState } from 'react';
import { AlertCircle, Trash2, Video, X } from 'lucide-react';
import type { ConsolePlatform, Game, GameplayClip } from '../types/domain';
import {
  aggregatePerformanceStats,
  formatRelativeTime,
  validateClipSubmission,
  type ValidationErrors,
} from '../utils/trackerLogic';
import { ClipReplayPreview } from './ClipReplayPreview';

interface ClipsStatsViewProps {
  game: Game;
  clips: GameplayClip[];
  activePlatform: ConsolePlatform;
  uploadModalOpen: boolean;
  onOpenUploadModal: () => void;
  onCloseUploadModal: () => void;
  onCreateClip: (payload: {
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
  }) => Promise<void>;
  onDeleteClip: (clipId: string) => Promise<void>;
}

const PLATFORM_FILTERS: (ConsolePlatform | 'All')[] = [
  'All',
  'PS5',
  'Xbox Series X',
  'PC',
  'Switch 2',
];

async function createSampleWebmBlob(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');

  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    // Minimal fallback binary if MediaRecorder isn't available in a headless browser
    return new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'video/webm' });
  }

  const stream = canvas.captureStream(15);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
    ? 'video/webm;codecs=vp8'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start();
  for (let i = 0; i < 12; i++) {
    if (ctx) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(20 + i * 20, 75, 48, 30);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '12px monospace';
      ctx.fillText(`60.0 FPS · Frame ${i + 1}`, 16, 28);
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  recorder.stop();
  return done;
}

export function ClipsStatsView({
  game,
  clips,
  activePlatform,
  uploadModalOpen,
  onOpenUploadModal,
  onCloseUploadModal,
  onCreateClip,
  onDeleteClip,
}: ClipsStatsViewProps) {
  const [platformFilter, setPlatformFilter] = useState<ConsolePlatform | 'All'>('All');

  // Upload form state
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [platform, setPlatform] = useState<ConsolePlatform>(activePlatform);
  const [zone, setZone] = useState(game.chapters[0]?.title ?? '');
  const [resolution, setResolution] = useState('1440p');
  const [graphicsMode, setGraphicsMode] = useState('Performance 60');
  const [avgFps, setAvgFps] = useState('60');
  const [low1PercentFps, setLow1PercentFps] = useState('51');
  const [frameTimeMs, setFrameTimeMs] = useState('16.7');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [generatingSample, setGeneratingSample] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<
    ValidationErrors<
      'title' | 'author' | 'zone' | 'avgFps' | 'low1PercentFps' | 'frameTimeMs' | 'hasVideo'
    >
  >({});

  const gameClips = useMemo(
    () => clips.filter((c) => c.gameId === game.id),
    [clips, game.id]
  );

  const visibleClips = useMemo(
    () =>
      platformFilter === 'All'
        ? gameClips
        : gameClips.filter((c) => c.platform === platformFilter),
    [gameClips, platformFilter]
  );

  const telemetryAll = useMemo(
    () => aggregatePerformanceStats(gameClips, 'All'),
    [gameClips]
  );
  const telemetryFiltered = useMemo(
    () => aggregatePerformanceStats(gameClips, platformFilter),
    [gameClips, platformFilter]
  );

  const maxChartFps = Math.max(
    120,
    ...telemetryAll.byPlatform.map((p) => Math.ceil(p.meanAvgFps / 20) * 20)
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedFileName(file.name);
      setFormErrors((prev) => ({ ...prev, hasVideo: undefined }));
    }
  };

  const handleGenerateSample = async () => {
    setGeneratingSample(true);
    setUploadError(null);
    try {
      const blob = await createSampleWebmBlob();
      setSelectedFile(blob);
      setSelectedFileName('gameplay-capture-sample.webm');
      setFormErrors((prev) => ({ ...prev, hasVideo: undefined }));
    } catch {
      setUploadError('Could not record sample clip in this browser.');
    } finally {
      setGeneratingSample(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    const parsedAvg = Number(avgFps);
    const parsedLow = Number(low1PercentFps);
    const parsedFt = Number(frameTimeMs);

    const errors = validateClipSubmission({
      title,
      author,
      platform,
      zone,
      resolution,
      graphicsMode,
      avgFps: parsedAvg,
      low1PercentFps: parsedLow,
      frameTimeMs: parsedFt,
      hasVideo: Boolean(selectedFile),
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !selectedFile) return;

    try {
      setUploading(true);
      const uploadRes = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          'Content-Type': selectedFile.type || 'video/webm',
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        const errBody = (await uploadRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Video upload failed.');
      }

      const { url } = (await uploadRes.json()) as { url: string };

      await onCreateClip({
        gameId: game.id,
        title,
        author,
        platform,
        zone,
        resolution,
        graphicsMode,
        avgFps: parsedAvg,
        low1PercentFps: parsedLow,
        frameTimeMs: parsedFt,
        durationSec: 15,
        videoUrl: url,
        notes,
      });

      setTitle('');
      setAuthor('');
      setNotes('');
      setSelectedFile(null);
      setSelectedFileName('');
      setFormErrors({});
      onCloseUploadModal();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to upload clip.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">
            Gameplay Clips &amp; Performance Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare real frame-rate metrics across consoles and upload gameplay captures for{' '}
            {game.title}.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter clips and stats by console"
            className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto max-w-full"
          >
            {PLATFORM_FILTERS.map((consoleName) => (
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

          <span className="font-mono text-xs tabular-nums text-slate-400">
            Showing {visibleClips.length} of {gameClips.length} captures
          </span>
        </div>
      </section>

      {/* Telemetry Summary & Console FPS Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section
          aria-label="Telemetry metrics"
          className="lg:col-span-5 grid grid-cols-2 bg-[#111827] border border-slate-800 rounded-xl divide-x divide-y divide-slate-800 overflow-hidden"
        >
          <div className="p-5 space-y-1">
            <p className="text-xs text-slate-400">Mean Avg FPS</p>
            <p className="font-mono text-2xl font-semibold text-white tabular-nums">
              {telemetryFiltered.clipCount > 0 ? telemetryFiltered.meanAvgFps : '—'}
            </p>
            <p className="text-xs text-slate-400">
              {platformFilter === 'All' ? 'All platforms' : platformFilter}
            </p>
          </div>
          <div className="p-5 space-y-1">
            <p className="text-xs text-slate-400">Lowest 1% Low</p>
            <p className="font-mono text-2xl font-semibold text-amber-400 tabular-nums">
              {telemetryFiltered.clipCount > 0 ? telemetryFiltered.minLow1PercentFps : '—'}
            </p>
            <p className="text-xs text-slate-400">Worst recorded dip</p>
          </div>
          <div className="p-5 space-y-1">
            <p className="text-xs text-slate-400">Mean Frame Time</p>
            <p className="font-mono text-2xl font-semibold text-white tabular-nums">
              {telemetryFiltered.clipCount > 0 ? `${telemetryFiltered.meanFrameTimeMs} ms` : '—'}
            </p>
            <p className="text-xs text-slate-400">16.6 ms = 60 fps</p>
          </div>
          <div className="p-5 space-y-1">
            <p className="text-xs text-slate-400">55+ FPS Target</p>
            <p className="font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              {telemetryFiltered.clipCount > 0 ? `${telemetryFiltered.target60RatePct}%` : '—'}
            </p>
            <p className="text-xs text-slate-400">Captures meeting target</p>
          </div>
        </section>

        {/* Cross-Platform FPS Comparison Chart */}
        <section
          aria-label="Cross-console FPS comparison"
          className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-white">
              Console FPS &amp; 1% Low Comparison
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500" aria-hidden="true" />
                Avg FPS
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" aria-hidden="true" />
                1% Low FPS
              </span>
            </div>
          </div>

          {telemetryAll.byPlatform.length === 0 ? (
            <p className="text-sm text-slate-400 py-6">
              Upload a gameplay clip with performance metrics to compare consoles.
            </p>
          ) : (
            <div className="space-y-3.5">
              {telemetryAll.byPlatform.map((row) => {
                const avgPct = Math.min(100, (row.meanAvgFps / maxChartFps) * 100);
                const lowPct = Math.min(100, (row.meanLow1PercentFps / maxChartFps) * 100);
                return (
                  <div key={row.platform} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                      <span className="font-medium text-slate-200 whitespace-nowrap">
                        {row.platform}{' '}
                        <span className="text-slate-400 font-normal">
                          ({row.clipCount} {row.clipCount === 1 ? 'clip' : 'clips'})
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {row.meanAvgFps} avg · {row.meanLow1PercentFps} 1% low ·{' '}
                        {row.meanFrameTimeMs} ms
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-900 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-[width] duration-200"
                          style={{ width: `${avgPct}%` }}
                        />
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-[width] duration-200"
                          style={{ width: `${lowPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Gameplay Clips Grid */}
      {visibleClips.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-slate-400">
            No gameplay clips logged for {platformFilter === 'All' ? game.title : platformFilter}.
          </p>
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            Upload First Clip
          </button>
        </div>
      ) : (
        <section aria-label="Uploaded gameplay clips" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleClips.map((clip) => (
            <article
              key={clip.id}
              className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4"
            >
              <ClipReplayPreview clip={clip} />

              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white leading-snug">
                      {clip.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="text-slate-200 font-medium">{clip.platform}</span>
                      <span aria-hidden="true">·</span>
                      <span>{clip.zone}</span>
                      <span aria-hidden="true">·</span>
                      <span>{clip.resolution}</span>
                      <span aria-hidden="true">·</span>
                      <span>{clip.graphicsMode}</span>
                    </div>
                  </div>

                  {clip.videoUrl && (
                    <button
                      type="button"
                      onClick={() => onDeleteClip(clip.id)}
                      aria-label={`Delete clip "${clip.title}"`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Tabular Telemetry Strip */}
                <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-800/80 font-mono tabular-nums">
                  <div>
                    <p className="text-[11px] font-sans text-slate-400">Avg FPS</p>
                    <p
                      className={`text-sm font-semibold ${
                        clip.avgFps >= 55 ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {clip.avgFps}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-sans text-slate-400">1% Low FPS</p>
                    <p className="text-sm font-semibold text-slate-200">
                      {clip.low1PercentFps}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-sans text-slate-400">Frame Time</p>
                    <p className="text-sm font-semibold text-slate-200">
                      {clip.frameTimeMs} ms
                    </p>
                  </div>
                </div>

                {clip.notes && (
                  <p className="text-xs text-slate-300 leading-relaxed">{clip.notes}</p>
                )}

                <p className="text-xs text-slate-500">
                  Uploaded by {clip.author} · {formatRelativeTime(clip.createdAt)}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Upload Clip Modal */}
      {uploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-clip-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
        >
          <div className="w-full max-w-xl bg-[#111827] border border-slate-700 rounded-xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="upload-clip-title" className="font-display text-lg font-bold text-white">
                Upload Gameplay Clip &amp; Telemetry
              </h2>
              <button
                type="button"
                onClick={onCloseUploadModal}
                aria-label="Close upload clip modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="clip-video-file"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Gameplay Video File (.mp4, .webm, .mov)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <input
                    id="clip-video-file"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateSample}
                    disabled={generatingSample}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0"
                  >
                    <Video className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                    <span>{generatingSample ? 'Recording...' : 'Record 1s Sample'}</span>
                  </button>
                </div>
                {selectedFileName && (
                  <p className="text-xs text-emerald-400 mt-1.5">
                    Attached: {selectedFileName}
                  </p>
                )}
                {formErrors.hasVideo && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.hasVideo}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="clip-title"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Clip Title
                </label>
                <input
                  id="clip-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Obsidian Warden Phase 2 Frametime Test"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                {formErrors.title && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.title}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="clip-author"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Handle
                  </label>
                  <input
                    id="clip-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="PlayerOne"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  {formErrors.author && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.author}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="clip-platform"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Platform
                  </label>
                  <select
                    id="clip-platform"
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
                    htmlFor="clip-zone"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Zone / Boss
                  </label>
                  <input
                    id="clip-zone"
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="Flooded Cathedral"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  {formErrors.zone && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.zone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="sm:col-span-1">
                  <label
                    htmlFor="clip-avg-fps"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Avg FPS
                  </label>
                  <input
                    id="clip-avg-fps"
                    type="number"
                    step="0.1"
                    value={avgFps}
                    onChange={(e) => setAvgFps(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  {formErrors.avgFps && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.avgFps}</p>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label
                    htmlFor="clip-low-fps"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    1% Low
                  </label>
                  <input
                    id="clip-low-fps"
                    type="number"
                    step="0.1"
                    value={low1PercentFps}
                    onChange={(e) => setLow1PercentFps(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  {formErrors.low1PercentFps && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.low1PercentFps}</p>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label
                    htmlFor="clip-frametime"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Frame ms
                  </label>
                  <input
                    id="clip-frametime"
                    type="number"
                    step="0.1"
                    value={frameTimeMs}
                    onChange={(e) => setFrameTimeMs(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  {formErrors.frameTimeMs && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.frameTimeMs}</p>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label
                    htmlFor="clip-resolution"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Resolution
                  </label>
                  <input
                    id="clip-resolution"
                    type="text"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label
                    htmlFor="clip-mode"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Mode
                  </label>
                  <input
                    id="clip-mode"
                    type="text"
                    value={graphicsMode}
                    onChange={(e) => setGraphicsMode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="clip-notes"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Capture Notes (optional)
                </label>
                <textarea
                  id="clip-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Settings, VRR status, or areas where frame drops occurred..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>

              {uploadError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-300"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onCloseUploadModal}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white"
                >
                  {uploading ? 'Uploading...' : 'Publish Clip & Stats'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
