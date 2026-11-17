import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { GameplayClip } from '../types/domain';

interface ClipReplayPreviewProps {
  clip: GameplayClip;
}

export function ClipReplayPreview({ clip }: ClipReplayPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || clip.videoUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const drawFrame = (tick: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#090E1A';
      ctx.fillRect(0, 0, w, h);

      // Grid backdrop
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Live frametime waveform trace
      const seed = clip.replaySeed ?? 1;
      ctx.strokeStyle = clip.avgFps >= 55 ? '#10B981' : '#3B82F6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const samples = 48;
      for (let i = 0; i <= samples; i++) {
        const px = (i / samples) * w;
        const wave =
          Math.sin((i + tick * 0.4) * 0.35 + seed) * 14 +
          Math.cos((i + tick * 0.2) * 0.7 + seed * 2) * 6;
        const baseLine = h * 0.58 - (clip.avgFps / 140) * (h * 0.24);
        const py = Math.max(24, Math.min(h - 24, baseLine + wave));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Subtle HUD metrics inside replay canvas
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      const liveJitter = playing ? Math.sin(tick * 0.15) * 1.4 : 0;
      const liveFps = (clip.avgFps + liveJitter).toFixed(1);
      ctx.fillText(`${clip.platform}  ${liveFps} FPS  ${clip.frameTimeMs} ms`, 14, 24);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${clip.resolution} · ${clip.graphicsMode}`, 14, h - 14);
    };

    drawFrame(frameRef.current);

    if (playing) {
      const loop = () => {
        frameRef.current += 1;
        drawFrame(frameRef.current);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [clip, playing]);

  if (clip.videoUrl) {
    return (
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800">
        <video
          src={clip.videoUrl}
          controls
          preload="metadata"
          aria-label={`Gameplay video for ${clip.title}`}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-[#090E1A] rounded-lg overflow-hidden border border-slate-800">
      <canvas
        ref={canvasRef}
        width={480}
        height={270}
        data-testid={`replay-canvas-${clip.id}`}
        className="w-full h-full block"
      />
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? `Pause ${clip.title} telemetry replay` : `Play ${clip.title} telemetry replay`}
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 transition-colors"
      >
        {playing ? (
          <>
            <Pause className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Pause</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Play Replay</span>
          </>
        )}
      </button>
    </div>
  );
}
