import { BookOpen, Bug, Film, LayoutDashboard, X } from 'lucide-react';
import type { ConsolePlatform, Game, NavSection } from '../types/domain';
import type { GameProgressSummary } from '../utils/trackerLogic';

interface SidebarProps {
  games: Game[];
  activeGame: Game;
  activeNav: NavSection;
  activePlatform: ConsolePlatform;
  progressSummary: GameProgressSummary;
  bugCount: number;
  clipCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectGame: (gameId: string) => void;
  onSelectNav: (nav: NavSection) => void;
  onSelectPlatform: (platform: ConsolePlatform) => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'guides', label: 'Interactive Guides', icon: BookOpen },
  { id: 'forum', label: 'Bug Forum', icon: Bug },
  { id: 'clips', label: 'Clips & Stats', icon: Film },
];

export function Sidebar({
  games,
  activeGame,
  activeNav,
  activePlatform,
  progressSummary,
  bugCount,
  clipCount,
  mobileOpen,
  onCloseMobile,
  onSelectGame,
  onSelectNav,
  onSelectPlatform,
}: SidebarProps) {
  const sidebarBody = (
    <div className="flex flex-col h-full bg-[#0E1525] border-r border-slate-800/90 text-slate-200">
      <div className="flex items-center justify-between h-14 px-5 border-b border-slate-800/90">
        <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Waypoint
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-800/90 space-y-3">
        <div>
          <label
            htmlFor="game-selector"
            className="block text-xs font-medium text-slate-400 mb-1.5"
          >
            Active Title
          </label>
          <select
            id="game-selector"
            value={activeGame.id}
            onChange={(e) => onSelectGame(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm font-medium text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="console-selector"
            className="block text-xs font-medium text-slate-400 mb-1.5"
          >
            My Platform
          </label>
          <select
            id="console-selector"
            value={activePlatform}
            onChange={(e) => onSelectPlatform(e.target.value as ConsolePlatform)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {activeGame.platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav aria-label="Main workspace navigation" className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          const count =
            item.id === 'forum' ? bugCount : item.id === 'clips' ? clipCount : null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectNav(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </span>
              {count !== null && (
                <span className="font-mono text-xs tabular-nums text-slate-400 ml-2">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800/90 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Campaign Progress</span>
          <span className="font-mono tabular-nums font-medium text-slate-200">
            {progressSummary.percentage}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-[width] duration-200"
            style={{ width: `${progressSummary.percentage}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 tabular-nums">
          {progressSummary.completedItems} of {progressSummary.totalItems} objectives complete
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/60"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{sidebarBody}</aside>
        </div>
      )}
    </>
  );
}
