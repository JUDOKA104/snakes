// src/components/Settings.ts
export type GameSettings = {
    cell: number;     // taille de case en px
    speed: number;    // ticks/sec
    wrap: boolean;    // wrap vs murs solides
    muted: boolean;   // sons coupés
    volume: number;   // 0..1
    nickname: string; // pour leaderboard
};

const KEY = 'snake.settings.v1';

export function loadSettings(): GameSettings {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
        return {
            cell: raw.cell ?? 20,
            speed: raw.speed ?? 10,
            wrap: raw.wrap ?? true,
            muted: raw.muted ?? false,
            volume: raw.volume ?? 0.6,
            nickname: raw.nickname ?? '',
        };
    } catch {
        return { cell: 20, speed: 10, wrap: true, muted: false, volume: 0.6, nickname: '' };
    }
}

export function saveSettings(s: GameSettings) {
    localStorage.setItem(KEY, JSON.stringify(s));
}
