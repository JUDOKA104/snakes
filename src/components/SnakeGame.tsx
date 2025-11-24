import React, { useEffect, useMemo, useRef, useState } from "react";

/** ===== Types & Utils ===== */
type Point = { x: number; y: number };
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const eq = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const randCell = (max: number) => Math.floor(Math.random() * max);

function nextHead(h: Point, d: Dir): Point {
  switch (d) {
    case "UP": return { x: h.x, y: h.y - 1 };
    case "DOWN": return { x: h.x, y: h.y + 1 };
    case "LEFT": return { x: h.x - 1, y: h.y };
    default: return { x: h.x + 1, y: h.y };
  }
}
function isOpposite(d1: Dir, d2: Dir) {
  return (d1 === "UP" && d2 === "DOWN") || (d1 === "DOWN" && d2 === "UP") ||
    (d1 === "LEFT" && d2 === "RIGHT") || (d1 === "RIGHT" && d2 === "LEFT");
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpPoint(a: Point, b: Point, t: number): Point { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }

/** ===== Audio Engine ===== */
function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(true);

  const ensure = () => {
    if (typeof window === "undefined") return null;
    return (ctxRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)());
  };

  const playTone = (freq: number, type: OscillatorType, dur: number, vol: number) => {
    if (!enabledRef.current) return;
    try {
      const c = ensure();
      if (!c || c.state === "suspended") c?.resume();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.1);
    } catch { }
  };

  return {
    eat: () => { playTone(600, "sine", 0.1, 0.1); setTimeout(() => playTone(900, "sine", 0.15, 0.1), 50); },
    step: () => playTone(150, "triangle", 0.05, 0.02),
    die: () => { playTone(200, "sawtooth", 0.4, 0.2); setTimeout(() => playTone(100, "sawtooth", 0.4, 0.2), 100); },
    toggle: (on: boolean) => { enabledRef.current = on; }
  };
}

/** ===== Swipe Handler ===== */
function useSwipe(onDir: (d: Dir) => void) {
  const start = useRef<Point | null>(null);
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onTouchEnd = (e: TouchEvent) => {
      if (!start.current) return;
      const dx = e.changedTouches[0].clientX - start.current.x;
      const dy = e.changedTouches[0].clientY - start.current.y;
      if (Math.abs(dx) > Math.abs(dy)) onDir(dx > 0 ? "RIGHT" : "LEFT");
      else onDir(dy > 0 ? "DOWN" : "UP");
      start.current = null;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => { window.removeEventListener("touchstart", onTouchStart); window.removeEventListener("touchend", onTouchEnd); };
  }, [onDir]);
}

/** ===== Leaderboard ===== */
function useLeaderboard() {
  const KEY = "snake.lb.v2";
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const push = (score: number, mode: string) => {
    const d = get(); d.push({ score, mode, date: Date.now() });
    d.sort((a: any, b: any) => b.score - a.score);
    localStorage.setItem(KEY, JSON.stringify(d.slice(0, 50)));
  };
  return { list: (m: string) => get().filter((x: any) => x.mode === m).slice(0, 5), push, reset: () => localStorage.removeItem(KEY) };
}

/** █████  ULTIMATE SNAKE COMPONENT  █████ */
export default function SnakeGame() {
  const [cols, setCols] = useState(12);
  const [rows, setRows] = useState(12);

  const [snake, setSnake] = useState<Point[]>([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState<"MENU" | "PLAYING" | "PAUSED" | "GAMEOVER">("MENU");
  const [sfxOn, setSfxOn] = useState(true);

  // Refs Logique
  const snakeRef = useRef(snake);
  const moveQueue = useRef<Dir[]>([]);
  const currentDir = useRef<Dir>("RIGHT");

  // Refs Interpolation
  const prevSnakeRef = useRef<Point[]>(snake);
  const nextSnakeRef = useRef<Point[]>(snake);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const [interpolationT, setInterpolationT] = useState(0);

  const shakeIntensity = useRef(0);
  const audio = useAudio();
  const lb = useLeaderboard();
  const sizeKey = `${cols}x${rows}`;

  const speedMs = Math.max(60, 130 - Math.floor(score / 2) * 5);

  // --- Init ---
  useEffect(() => {
    try {
      const v = (localStorage.getItem("snake.sfx") ?? "1") === "1";
      setSfxOn(v); audio.toggle(v);
    } catch { }
  }, []);

  useEffect(() => {
    audio.toggle(sfxOn);
    try { localStorage.setItem("snake.sfx", sfxOn ? "1" : "0"); } catch { }
  }, [sfxOn]);

  useEffect(() => {
    const list = lb.list(sizeKey);
    setHighScore(list[0]?.score || 0);
  }, [cols, rows, status]);

  // --- Actions ---
  const startGame = () => {
    const init = [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
    setSnake(init);
    snakeRef.current = init;
    prevSnakeRef.current = init;
    nextSnakeRef.current = init;
    currentDir.current = "RIGHT";
    moveQueue.current = [];
    setScore(0);
    lastTimeRef.current = performance.now();
    accumulatorRef.current = 0;
    setInterpolationT(0);
    spawnFood(init);
    setStatus("PLAYING");
  };

  const spawnFood = (body: Point[]) => {
    let p: Point, t = 0;
    do { p = { x: randCell(cols), y: randCell(rows) }; t++; }
    while (body.some(s => eq(s, p)) && t < 100);
    setFood(p);
  };

  const addInput = (d: Dir) => {
    const last = moveQueue.current.length > 0 ? moveQueue.current[moveQueue.current.length - 1] : currentDir.current;
    if (!isOpposite(last, d) && last !== d && moveQueue.current.length < 3) moveQueue.current.push(d);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) addInput("UP");
      else if (["arrowdown", "s"].includes(k)) addInput("DOWN");
      else if (["arrowleft", "a"].includes(k)) addInput("LEFT");
      else if (["arrowright", "d"].includes(k)) addInput("RIGHT");
      else if (k === " ") {
        if (status === "PLAYING") setStatus("PAUSED");
        else if (status === "PAUSED") setStatus("PLAYING");
      }
      else if (k === "r") startGame();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status]);

  useSwipe(d => addInput(d));

  // --- Particles ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  const spawnParticles = (x: number, y: number, type: "EAT" | "DIE") => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const count = type === "EAT" ? 20 : 60;
    const px = (x + 0.5) * (rect.width / cols);
    const py = (y + 0.5) * (rect.height / rows);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (type === "EAT" ? 4 : 8);
      particlesRef.current.push({
        x: px, y: py,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1.0, color: type === "EAT" ? (Math.random() > 0.5 ? "#fbbf24" : "#34d399") : "#f87171",
        size: Math.random() * 4 + 2
      });
    }
  };

  // --- Game Tick ---
  const gameTick = () => {
    if (moveQueue.current.length > 0) currentDir.current = moveQueue.current.shift() as Dir;
    const head = snakeRef.current[0];
    const next = nextHead(head, currentDir.current);

    const wall = next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows;
    const self = snakeRef.current.some((p, i) => i !== 0 && eq(p, next));

    if (wall || self) {
      audio.die();
      setStatus("GAMEOVER");
      spawnParticles(head.x, head.y, "DIE");
      shakeIntensity.current = 20;
      lb.push(score, sizeKey);
      return false;
    }

    const ate = eq(next, food);
    const newBody = [next, ...snakeRef.current];
    if (!ate) newBody.pop();

    prevSnakeRef.current = snakeRef.current;
    nextSnakeRef.current = newBody;
    snakeRef.current = newBody;

    if (ate) {
      setScore(s => s + 1); spawnFood(newBody);
      spawnParticles(next.x, next.y, "EAT"); shakeIntensity.current = 5; audio.eat();
    } else { audio.step(); }

    setSnake(newBody);
    return true;
  };

  // --- Loop Principal ---
  useEffect(() => {
    let raf = 0;
    const ctx = canvasRef.current?.getContext("2d");
    lastTimeRef.current = performance.now();
    accumulatorRef.current = 0;

    const loop = (currentTime: number) => {
      raf = requestAnimationFrame(loop);
      let deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      if (deltaTime > 250) deltaTime = 250;

      if (status === "PLAYING") {
        accumulatorRef.current += deltaTime;
        while (accumulatorRef.current >= speedMs) {
          if (!gameTick()) break;
          accumulatorRef.current -= speedMs;
        }
        setInterpolationT(accumulatorRef.current / speedMs);
      } else { setInterpolationT(1); }

      // Render
      if (shakeIntensity.current > 0) {
        const amt = shakeIntensity.current;
        setShakeOffset({ x: (Math.random() - 0.5) * amt, y: (Math.random() - 0.5) * amt });
        shakeIntensity.current *= 0.9;
        if (shakeIntensity.current < 0.5) shakeIntensity.current = 0;
      } else { setShakeOffset({ x: 0, y: 0 }); }

      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.02;
          if (p.life <= 0) particlesRef.current.splice(i, 1);
          else {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, cols, rows, food, speedMs, score, sizeKey]);

  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

  const visSnake = useMemo(() => {
    const prev = prevSnakeRef.current;
    const next = nextSnakeRef.current;
    if (!prev.length || !next.length) return snake;
    const t = clamp(interpolationT, 0, 1);
    return next.map((n, i) => {
      const p = prev[i] ?? prev[prev.length - 1];
      return lerpPoint(p, n, t);
    });
  }, [interpolationT, snake]);

  const cellW = 100 / cols; const cellH = 100 / rows;
  const getHeadRotation = () => {
    switch (currentDir.current) {
      case "UP": return "rotate-180"; case "DOWN": return "rotate-0";
      case "LEFT": return "rotate-90"; case "RIGHT": return "-rotate-90"; default: return "rotate-0";
    }
  };
  const getStyle = (p: Point, scale = 1.05) => ({
    left: `${(p.x + 0.5) * cellW}%`, top: `${(p.y + 0.5) * cellH}%`,
    width: `${cellW * scale}%`, height: `${cellH * scale}%`,
  });

  return (
    // Suppression des max-w et width fixe, le composant prend 100% de son parent
    <div className="w-full h-full flex flex-col items-center justify-center touch-none select-none relative">

      {/* HUD (Absolute au-dessus du jeu ou intégré dans le panneau) */}
      <div className="absolute -top-16 left-0 right-0 flex items-end justify-between px-2">
        <div>
          <div className="text-[10px] font-bold tracking-[0.2em] text-emerald-500/80 uppercase mb-1">Score</div>
          <div className="text-4xl font-black text-white glow-text-green tabular-nums leading-[0.8]">{score}</div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setSfxOn(!sfxOn)} className="p-2 bg-white/10 rounded hover:bg-white/20 text-white transition">{sfxOn ? "🔊" : "🔇"}</button>
          <button onClick={() => setStatus("MENU")} className="p-2 bg-white/10 rounded hover:bg-white/20 text-white text-xs font-bold tracking-widest uppercase transition">Menu</button>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-bold tracking-[0.2em] text-indigo-400/80 uppercase mb-1">Top</div>
          <div className="text-2xl font-bold text-indigo-100 tabular-nums">{highScore}</div>
        </div>
      </div>

      {/* ZONE DE JEU (Remplit le parent) */}
      <div className="w-full h-full relative group perspective-1000">
        <div
          className="relative w-full h-full glass-panel rounded-xl overflow-hidden ring-1 ring-white/10 transition-transform duration-75"
          style={{ transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)` }}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-30" style={{ backgroundSize: `${cellW}% ${cellH}%` }} />

          <div className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10" style={getStyle(food, 0.65)}>
            <div className="w-full h-full rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse" />
          </div>

          {visSnake.slice(1).map((p, i) => (
            <div key={i} className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform"
              style={{ ...getStyle(p, 1.05), backgroundColor: `rgba(16, 185, 129, ${Math.max(0.4, 1 - i / (visSnake.length + 5))})`, boxShadow: i < 5 ? `0 0 10px rgba(16, 185, 129, 0.3)` : 'none' }} />
          ))}

          {visSnake[0] && (
            <div className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-20 transition-transform duration-100 ease-linear ${getHeadRotation()}`} style={getStyle(visSnake[0], 1.15)}>
              <div className="w-full h-full rounded-full bg-gradient-to-b from-emerald-300 to-emerald-600 glow-green relative">
                <div className="absolute top-[30%] left-[20%] w-[25%] h-[25%] bg-black rounded-full opacity-80 shadow-inner"></div>
                <div className="absolute top-[30%] right-[20%] w-[25%] h-[25%] bg-black rounded-full opacity-80 shadow-inner"></div>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-30 w-full h-full" />

          {status === "MENU" && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md grid place-items-center z-40 animate-in fade-in duration-300">
              <div className="text-center w-full max-w-sm px-6">
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-teal-300 to-cyan-500 mb-8 drop-shadow-sm">SNAKE</h1>
                <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 mb-8 border border-white/10">
                  <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">Taille Grille</span>
                  <select className="select-glass" value={`${cols}x${rows}`} onChange={e => { const [c, r] = e.target.value.split("x").map(Number); setCols(c); setRows(r); }}>
                    {[10, 15, 20, 25, 30].map(n => <option key={n} value={`${n}x${n}`} className="bg-black">{n} × {n}</option>)}
                  </select>
                </div>
                <button onClick={startGame} className="btn-primary w-full">JOUER</button>
              </div>
            </div>
          )}

          {status === "GAMEOVER" && (
            <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md grid place-items-center z-50 animate-in zoom-in-95 duration-200">
              <div className="text-center">
                <h2 className="text-5xl font-black text-white mb-2 glow-red">GAME OVER</h2>
                <div className="text-xl text-white/70 mb-8 font-mono">SCORE: {score}</div>
                <button onClick={startGame} className="btn-primary">REJOUER</button>
              </div>
            </div>
          )}

          {status === "PAUSED" && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50">
              <div className="text-6xl font-black text-white/20 tracking-[0.5em] uppercase pointer-events-none">Pause</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}