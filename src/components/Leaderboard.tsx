import React, { useEffect, useState } from 'react';

export type ScoreRow = { name: string; score: number; date: string };

const KEY = 'snake.leaderboard.v1';

function load(): ScoreRow[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(rows: ScoreRow[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 10)));
}

export default function Leaderboard() {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  useEffect(() => { setRows(load()); }, []);

  return (
    <section id="leaderboard" className="asus-rog-card mt-8 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Leaderboard (local)</h3>
        <div className="text-xs text-muted">Top 10 — stocké en local</div>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted text-sm">Aucun score pour l’instant. Jouez une partie pour enregistrer un score !</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between border border-border rounded-xl px-3 py-2">
              <span className="text-muted w-6">#{i+1}</span>
              <span className="flex-1">{r.name}</span>
              <span className="tabular-nums">{r.score}</span>
              <span className="text-xs text-muted ml-3">{new Date(r.date).toLocaleDateString()}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function addScore(row: ScoreRow) {
  const rows = load();
  rows.push(row);
  rows.sort((a,b)=>b.score-a.score);
  save(rows);
}
