import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { SEED_STATE } from './src/data/seedData';
import type {
  AppState,
  BugReply,
  BugSeverity,
  BugStatus,
  BugThread,
  ConsolePlatform,
  GameplayClip,
} from './src/types/domain';
import { validateBugSubmission, validateClipSubmission } from './src/utils/trackerLogic';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'waypoint-store.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureStorage(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(SEED_STATE, null, 2), 'utf-8');
  }
}

function readStore(): AppState {
  ensureStorage();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.games || !parsed.progressByGame) {
      return structuredClone(SEED_STATE);
    }
    return parsed;
  } catch {
    return structuredClone(SEED_STATE);
  }
}

function writeStore(state: AppState): void {
  ensureStorage();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

const VALID_PLATFORMS: ConsolePlatform[] = ['PS5', 'Xbox Series X', 'PC', 'Switch 2'];
const VALID_SEVERITIES: BugSeverity[] = ['Critical', 'Major', 'Minor'];
const VALID_STATUSES: BugStatus[] = ['Open', 'Workaround', 'Patched'];

async function startServer() {
  ensureStorage();
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/state', (_req, res) => {
    const state = readStore();
    res.json(state);
  });

  app.post('/api/progress/toggle', (req, res) => {
    const { gameId, itemType, itemId, activePlatform } = req.body as {
      gameId?: string;
      itemType?: 'step' | 'collectible' | 'platform';
      itemId?: string;
      activePlatform?: ConsolePlatform;
    };

    const state = readStore();
    if (!gameId || !state.progressByGame[gameId]) {
      res.status(404).json({ error: 'Game progress not found.' });
      return;
    }

    const progress = state.progressByGame[gameId];

    if (itemType === 'platform' && activePlatform && VALID_PLATFORMS.includes(activePlatform)) {
      progress.activePlatform = activePlatform;
      progress.lastUpdated = new Date().toISOString();
      writeStore(state);
      res.json({ progress: state.progressByGame[gameId] });
      return;
    }

    if (!itemId || (itemType !== 'step' && itemType !== 'collectible')) {
      res.status(400).json({ error: 'Invalid toggle payload.' });
      return;
    }

    const list = itemType === 'step' ? progress.completedStepIds : progress.collectedIds;
    const idx = list.indexOf(itemId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(itemId);
    }
    progress.lastUpdated = new Date().toISOString();
    writeStore(state);
    res.json({ progress });
  });

  app.post('/api/progress/reset-chapter', (req, res) => {
    const { gameId, chapterId } = req.body as { gameId?: string; chapterId?: string };
    const state = readStore();
    const game = state.games.find((g) => g.id === gameId);
    const progress = gameId ? state.progressByGame[gameId] : undefined;

    if (!game || !progress || !chapterId) {
      res.status(404).json({ error: 'Game or chapter not found.' });
      return;
    }

    const chapter = game.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }

    const stepIds = new Set(chapter.steps.map((s) => s.id));
    const collIds = new Set(chapter.collectibles.map((c) => c.id));
    progress.completedStepIds = progress.completedStepIds.filter((id) => !stepIds.has(id));
    progress.collectedIds = progress.collectedIds.filter((id) => !collIds.has(id));
    progress.lastUpdated = new Date().toISOString();

    writeStore(state);
    res.json({ progress });
  });

  app.post('/api/bugs', (req, res) => {
    const body = req.body as {
      gameId?: string;
      title?: string;
      author?: string;
      platform?: ConsolePlatform;
      severity?: BugSeverity;
      patchVersion?: string;
      chapterOrZone?: string;
      description?: string;
      reproStepsText?: string;
      hardwareNotes?: string;
    };

    const state = readStore();
    const game = state.games.find((g) => g.id === body.gameId);
    if (!game) {
      res.status(404).json({ error: 'Target game not found.' });
      return;
    }

    const platform = VALID_PLATFORMS.includes(body.platform as ConsolePlatform)
      ? (body.platform as ConsolePlatform)
      : 'PS5';
    const severity = VALID_SEVERITIES.includes(body.severity as BugSeverity)
      ? (body.severity as BugSeverity)
      : 'Major';

    const errors = validateBugSubmission({
      title: body.title ?? '',
      author: body.author ?? '',
      platform,
      severity,
      patchVersion: body.patchVersion ?? game.currentPatch,
      chapterOrZone: body.chapterOrZone ?? '',
      description: body.description ?? '',
      reproStepsText: body.reproStepsText ?? '',
      hardwareNotes: body.hardwareNotes ?? '',
    });

    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: 'Validation failed', errors });
      return;
    }

    const reproSteps = (body.reproStepsText ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const newThread: BugThread = {
      id: `bug-${crypto.randomBytes(4).toString('hex')}`,
      gameId: game.id,
      title: body.title!.trim(),
      author: body.author!.trim(),
      platform,
      severity,
      status: 'Open',
      patchVersion: (body.patchVersion ?? game.currentPatch).trim() || game.currentPatch,
      chapterOrZone: body.chapterOrZone!.trim(),
      description: body.description!.trim(),
      reproSteps,
      hardwareNotes: (body.hardwareNotes ?? '').trim() || `${platform} · Patch ${game.currentPatch}`,
      confirmations: 1,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    state.bugThreads.unshift(newThread);
    writeStore(state);
    res.status(201).json({ thread: newThread });
  });

  app.post('/api/bugs/:id/vote', (req, res) => {
    const state = readStore();
    const thread = state.bugThreads.find((t) => t.id === req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Bug thread not found.' });
      return;
    }
    thread.confirmations += 1;
    writeStore(state);
    res.json({ thread });
  });

  app.post('/api/bugs/:id/status', (req, res) => {
    const { status } = req.body as { status?: BugStatus };
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status.' });
      return;
    }
    const state = readStore();
    const thread = state.bugThreads.find((t) => t.id === req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Bug thread not found.' });
      return;
    }
    thread.status = status;
    writeStore(state);
    res.json({ thread });
  });

  app.post('/api/bugs/:id/replies', (req, res) => {
    const { author, platform, body, isWorkaround } = req.body as {
      author?: string;
      platform?: ConsolePlatform;
      body?: string;
      isWorkaround?: boolean;
    };

    if (!author?.trim() || !body?.trim() || body.trim().length < 4) {
      res.status(400).json({ error: 'Author and reply message (min 4 chars) are required.' });
      return;
    }

    const state = readStore();
    const thread = state.bugThreads.find((t) => t.id === req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Bug thread not found.' });
      return;
    }

    const validPlatform = VALID_PLATFORMS.includes(platform as ConsolePlatform)
      ? (platform as ConsolePlatform)
      : thread.platform;

    const reply: BugReply = {
      id: `rep-${crypto.randomBytes(4).toString('hex')}`,
      author: author.trim(),
      platform: validPlatform,
      body: body.trim(),
      isWorkaround: Boolean(isWorkaround),
      createdAt: new Date().toISOString(),
    };

    thread.replies.push(reply);
    if (reply.isWorkaround && thread.status === 'Open') {
      thread.status = 'Workaround';
    }
    writeStore(state);
    res.status(201).json({ thread, reply });
  });

  app.post(
    '/api/uploads',
    express.raw({
      type: ['video/webm', 'video/mp4', 'video/quicktime', 'application/octet-stream'],
      limit: '50mb',
    }),
    (req, res) => {
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: 'Empty video file payload.' });
        return;
      }

      const contentType = String(req.headers['content-type'] ?? 'video/webm').toLowerCase();
      let ext = '.webm';
      if (contentType.includes('mp4')) ext = '.mp4';
      else if (contentType.includes('quicktime')) ext = '.mov';

      const filename = `clip-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      const targetPath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(targetPath, buffer);

      res.status(201).json({
        url: `/api/uploads/${filename}`,
        sizeBytes: buffer.length,
      });
    }
  );

  app.get('/api/uploads/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Clip file not found.' });
      return;
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mime =
      ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'video/webm';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  app.post('/api/clips', (req, res) => {
    const body = req.body as {
      gameId?: string;
      title?: string;
      author?: string;
      platform?: ConsolePlatform;
      zone?: string;
      resolution?: string;
      graphicsMode?: string;
      avgFps?: number;
      low1PercentFps?: number;
      frameTimeMs?: number;
      durationSec?: number;
      videoUrl?: string | null;
      notes?: string;
    };

    const state = readStore();
    const game = state.games.find((g) => g.id === body.gameId);
    if (!game) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }

    const platform = VALID_PLATFORMS.includes(body.platform as ConsolePlatform)
      ? (body.platform as ConsolePlatform)
      : 'PC';

    const avgFps = Number(body.avgFps);
    const low1PercentFps = Number(body.low1PercentFps);
    const frameTimeMs = Number(body.frameTimeMs);

    const errors = validateClipSubmission({
      title: body.title ?? '',
      author: body.author ?? '',
      platform,
      zone: body.zone ?? '',
      resolution: body.resolution ?? '1440p',
      graphicsMode: body.graphicsMode ?? 'Performance',
      avgFps,
      low1PercentFps,
      frameTimeMs,
      hasVideo: Boolean(body.videoUrl),
    });

    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: 'Validation failed', errors });
      return;
    }

    const newClip: GameplayClip = {
      id: `clip-${crypto.randomBytes(4).toString('hex')}`,
      gameId: game.id,
      title: body.title!.trim(),
      author: body.author!.trim(),
      platform,
      zone: body.zone!.trim(),
      resolution: (body.resolution ?? '1440p').trim(),
      graphicsMode: (body.graphicsMode ?? 'Performance 60').trim(),
      avgFps: Number(avgFps.toFixed(1)),
      low1PercentFps: Number(low1PercentFps.toFixed(1)),
      frameTimeMs: Number(frameTimeMs.toFixed(1)),
      durationSec: Math.max(1, Math.round(Number(body.durationSec) || 15)),
      videoUrl: body.videoUrl ?? null,
      notes: (body.notes ?? '').trim(),
      createdAt: new Date().toISOString(),
    };

    state.clips.unshift(newClip);
    writeStore(state);
    res.status(201).json({ clip: newClip });
  });

  app.delete('/api/clips/:id', (req, res) => {
    const state = readStore();
    const idx = state.clips.findIndex((c) => c.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ error: 'Clip not found.' });
      return;
    }
    const [removed] = state.clips.splice(idx, 1);
    if (removed.videoUrl && removed.videoUrl.startsWith('/api/uploads/')) {
      const filePath = path.join(UPLOADS_DIR, path.basename(removed.videoUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    writeStore(state);
    res.json({ deletedId: removed.id });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Waypoint server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Waypoint server:', err);
  process.exit(1);
});
