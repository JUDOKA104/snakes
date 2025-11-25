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
      const c = ensure(); if (!c || c.state === "suspended") c?.resume(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, c.currentTime); g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.1);
    } catch { }
  };
  return {
    eat: () => { playTone(800, "sine", 0.05, 0.1); setTimeout(() => playTone(1200, "square", 0.1, 0.05), 50); },
    step: () => playTone(100, "triangle", 0.02, 0.01),
    die: () => { playTone(200, "sawtooth", 0.3, 0.2); setTimeout(() => playTone(50, "sawtooth", 0.5, 0.3), 100); },
    toggle: (on: boolean) => { enabledRef.current = on; }
  };
}

/** ===== Swipe & Leaderboard ===== */
function useSwipe(onDir: (d: Dir) => void) {
  const start = useRef<Point | null>(null);
  useEffect(() => {
    const onStart = (e: TouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onEnd = (e: TouchEvent) => {
      if (!start.current) return;
      const dx = e.changedTouches[0].clientX - start.current.x, dy = e.changedTouches[0].clientY - start.current.y;
      if (Math.abs(dx) > Math.abs(dy)) onDir(dx > 0 ? "RIGHT" : "LEFT"); else onDir(dy > 0 ? "DOWN" : "UP");
      start.current = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true }); window.addEventListener("touchend", onEnd);
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchend", onEnd); };
  }, [onDir]);
}

function useLeaderboard() {
  const KEY = "snake.lb.v2";
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const push = (score: number, mode: string) => {
    const d = get(); d.push({ score, mode, date: Date.now() });
    d.sort((a: any, b: any) => b.score - a.score); localStorage.setItem(KEY, JSON.stringify(d.slice(0, 50)));
  };
  return { list: (m: string) => get().filter((x: any) => x.mode === m).slice(0, 5), push };
}

/** █████  ULTIMATE SNAKE COMPONENT  █████ */
export default function SnakeGame() {
  const [cols, setCols] = useState(12); const [rows, setRows] = useState(12);
  const [snake, setSnake] = useState<Point[]>([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [score, setScore] = useState(0); const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState<"MENU" | "PLAYING" | "PAUSED" | "GAMEOVER">("MENU");
  const [sfxOn, setSfxOn] = useState(true);

  // Refs Logique
  const snakeRef = useRef(snake); const moveQueue = useRef<Dir[]>([]); const currentDir = useRef<Dir>("RIGHT");
  const prevSnakeRef = useRef<Point[]>(snake); const nextSnakeRef = useRef<Point[]>(snake);
  const lastTimeRef = useRef<number>(0); const accumulatorRef = useRef<number>(0);
  const [interpolationT, setInterpolationT] = useState(0);
  const shakeIntensity = useRef(0); const audio = useAudio(); const lb = useLeaderboard();
  const sizeKey = `${cols}x${rows}`;
  const speedMs = Math.max(60, 130 - Math.floor(score / 2) * 5);

  useEffect(() => { try { const v = (localStorage.getItem("snake.sfx") ?? "1") === "1"; setSfxOn(v); audio.toggle(v); } catch { } }, []);
  useEffect(() => { audio.toggle(sfxOn); try { localStorage.setItem("snake.sfx", sfxOn ? "1" : "0"); } catch { } }, [sfxOn]);
  useEffect(() => { setHighScore(lb.list(sizeKey)[0]?.score || 0); }, [cols, rows, status]);

  const startGame = () => {
    const init = [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
    setSnake(init); snakeRef.current = init; prevSnakeRef.current = init; nextSnakeRef.current = init;
    currentDir.current = "RIGHT"; moveQueue.current = []; setScore(0);
    lastTimeRef.current = performance.now(); accumulatorRef.current = 0; setInterpolationT(0);
    spawnFood(init); setStatus("PLAYING");
  };

  const spawnFood = (body: Point[]) => {
    let p: Point, t = 0; do { p = { x: randCell(cols), y: randCell(rows) }; t++; } while (body.some(s => eq(s, p)) && t < 100); setFood(p);
  };
  const addInput = (d: Dir) => {
    const last = moveQueue.current.length > 0 ? moveQueue.current[moveQueue.current.length - 1] : currentDir.current;
    if (!isOpposite(last, d) && last !== d && moveQueue.current.length < 3) moveQueue.current.push(d);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) addInput("UP"); else if (["arrowdown", "s"].includes(k)) addInput("DOWN");
      else if (["arrowleft", "a"].includes(k)) addInput("LEFT"); else if (["arrowright", "d"].includes(k)) addInput("RIGHT");
      else if (k === " ") { if (status === "PLAYING") setStatus("PAUSED"); else if (status === "PAUSED") setStatus("PLAYING"); }
      else if (k === "r") startGame();
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [status]);
  useSwipe(d => addInput(d));

  // Particles
  const canvasRef = useRef<HTMLCanvasElement>(null); const particlesRef = useRef<Particle[]>([]);
  const spawnParticles = (x: number, y: number, type: "EAT" | "DIE") => {
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const px = (x + 0.5) * (rect.width / cols); const py = (y + 0.5) * (rect.height / rows);
    for (let i = 0; i < (type === "EAT" ? 25 : 60); i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * (type === "EAT" ? 6 : 12);
      particlesRef.current.push({
        x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.0,
        color: type === "EAT" ? "#00f2ff" : "#ff0055", size: Math.random() * 5 + 2
      });
    }
  };

  // Game Logic
  const gameTick = () => {
    if (moveQueue.current.length > 0) currentDir.current = moveQueue.current.shift() as Dir;
    const head = snakeRef.current[0]; const next = nextHead(head, currentDir.current);
    if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows || snakeRef.current.some((p, i) => i !== 0 && eq(p, next))) {
      audio.die(); setStatus("GAMEOVER"); spawnParticles(head.x, head.y, "DIE"); shakeIntensity.current = 30; lb.push(score, sizeKey); return false;
    }
    const ate = eq(next, food); const newBody = [next, ...snakeRef.current]; if (!ate) newBody.pop();
    prevSnakeRef.current = snakeRef.current; nextSnakeRef.current = newBody; snakeRef.current = newBody;
    if (ate) { setScore(s => s + 1); spawnFood(newBody); spawnParticles(next.x, next.y, "EAT"); shakeIntensity.current = 6; audio.eat(); } else { audio.step(); }
    setSnake(newBody); return true;
  };

  // Loop
  useEffect(() => {
    let raf = 0; const ctx = canvasRef.current?.getContext("2d");
    lastTimeRef.current = performance.now(); accumulatorRef.current = 0;
    const loop = (currentTime: number) => {
      raf = requestAnimationFrame(loop);
      let dt = currentTime - lastTimeRef.current; lastTimeRef.current = currentTime; if (dt > 200) dt = 200;
      if (status === "PLAYING") {
        accumulatorRef.current += dt;
        while (accumulatorRef.current >= speedMs) { if (!gameTick()) break; accumulatorRef.current -= speedMs; }
        setInterpolationT(accumulatorRef.current / speedMs);
      } else { setInterpolationT(1); }
      if (shakeIntensity.current > 0) {
        const amt = shakeIntensity.current; setShakeOffset({ x: (Math.random() - 0.5) * amt, y: (Math.random() - 0.5) * amt });
        shakeIntensity.current *= 0.9; if (shakeIntensity.current < 0.5) shakeIntensity.current = 0;
      }
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); ctx.globalCompositeOperation = 'screen';
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.03;
          if (p.life <= 0) particlesRef.current.splice(i, 1);
          else { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [status, cols, rows, food, speedMs, score, sizeKey]);

  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
  const visSnake = useMemo(() => {
    const prev = prevSnakeRef.current, next = nextSnakeRef.current; if (!prev.length || !next.length) return snake;
    const t = clamp(interpolationT, 0, 1);
    return next.map((n, i) => lerpPoint(prev[i] ?? prev[prev.length - 1], n, t));
  }, [interpolationT, snake]);

  // --- VISUAL HELPERS ---
  const cellW = 100 / cols; const cellH = 100 / rows;
  const getStyle = (p: Point, scale = 1.0) => ({
    left: `${(p.x + 0.5) * cellW}%`, top: `${(p.y + 0.5) * cellH}%`,
    width: `${cellW * scale}%`, height: `${cellH * scale}%`,
  });

  const getSegmentShape = (i: number) => {
    const curr = visSnake[i]; const prev = visSnake[i - 1]; const next = visSnake[i + 1];
    const radius = "8px"; const style: React.CSSProperties = { borderRadius: radius };
    const check = (n: Point | undefined) => {
      if (!n) return;
      const dx = n.x - curr.x, dy = n.y - curr.y;
      if (dy < -0.5) { style.borderTopLeftRadius = 0; style.borderTopRightRadius = 0; }
      if (dy > 0.5) { style.borderBottomLeftRadius = 0; style.borderBottomRightRadius = 0; }
      if (dx < -0.5) { style.borderTopLeftRadius = 0; style.borderBottomLeftRadius = 0; }
      if (dx > 0.5) { style.borderTopRightRadius = 0; style.borderBottomRightRadius = 0; }
    };
    check(prev); check(next); return style;
  };

  // Helper pour rotation fluide de la tête
  const getHeadRotation = () => {
    switch (currentDir.current) {
      case "UP": return "rotate-180"; case "DOWN": return "rotate-0";
      case "LEFT": return "rotate-90"; case "RIGHT": return "-rotate-90"; default: return "rotate-0";
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center touch-none select-none relative overflow-hidden bg-black font-sans">

      {/* SCANLINES OVERLAY */}
      <div className="absolute inset-0 scanlines z-40 opacity-30 pointer-events-none"></div>
      <div className="absolute inset-0 vignette z-40 pointer-events-none"></div>

      {/* HUD FLOTTANT */}
      <div className="absolute top-6 left-0 right-0 z-50 px-6 flex items-start justify-between max-w-3xl mx-auto">
        <div className="glass-dark px-4 py-2 rounded-lg">
          <div className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase">Score</div>
          <div className="text-4xl font-black text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{score}</div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setSfxOn(!sfxOn)} className="glass-dark w-10 h-10 grid place-items-center rounded-lg hover:bg-white/10 transition">{sfxOn ? "🔊" : "🔇"}</button>
          <button onClick={() => setStatus("MENU")} className="glass-dark px-4 h-10 grid place-items-center rounded-lg hover:bg-white/10 transition text-xs font-bold tracking-widest uppercase">Menu</button>
        </div>
      </div>

      {/* ZONE DE JEU */}
      <div className="w-full h-full relative group flex items-center justify-center p-4">
        <div className="relative aspect-square w-full max-w-[min(90vw,85vh)] bg-[#08080a] rounded-2xl border border-white/5 shadow-2xl overflow-hidden"
          style={{ transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)` }}>

          {/* GRILLE CYBER */}
          <div className="absolute inset-0 bg-cyber-grid opacity-20" style={{ backgroundSize: `${cellW}% ${cellH}%` }} />

          {/* FOOD - ORBE D'ENERGIE */}
          <div className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10" style={getStyle(food, 1.0)}>
            {/* Noyau */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] bg-cyan-400 rounded-full shadow-[0_0_20px_#00f2ff] animate-pulse-glow" />
            {/* Anneau 1 */}
            <div className="absolute top-1/2 left-1/2 w-[80%] h-[80%] border-2 border-cyan-500/50 rounded-full animate-spin-slow" />
            {/* Anneau 2 */}
            <div className="absolute top-1/2 left-1/2 w-[100%] h-[100%] border border-cyan-300/30 rounded-full animate-spin-reverse" />
          </div>

          {/* SNAKE - TUBE NEON CONTINU */}
          {visSnake.slice(1).map((p, i) => {
            const shapeStyle = getSegmentShape(i + 1);
            // Couleur HSL dynamique basée sur la position dans le corps
            const hue = 160 + (i * 2); // De Emerald (160) à Cyan/Blue
            return (
              <div key={i} className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform scale-[1.02]"
                style={{
                  ...getStyle(p, 1.00),
                  ...shapeStyle,
                  backgroundColor: `hsl(${hue}, 100%, 50%)`,
                  boxShadow: `0 0 15px hsla(${hue}, 100%, 50%, 0.4)`,
                  zIndex: 10
                }} />
            );
          })}

          {/* TÊTE HIGH-TECH */}
          {visSnake[0] && (
            <div className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-20 transition-transform duration-100 ease-linear scale-[1.05] ${getHeadRotation()}`} style={getStyle(visSnake[0], 1.0)}>
              <div className="w-full h-full bg-white relative rounded-t-lg rounded-b-none shadow-[0_0_30px_rgba(255,255,255,0.6)]">
                <div className="absolute top-[30%] left-[20%] w-[20%] h-[30%] bg-black rounded-sm" />
                <div className="absolute top-[30%] right-[20%] w-[20%] h-[30%] bg-black rounded-sm" />
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-30 w-full h-full mix-blend-screen" />

          {/* OVERLAYS (MENU / GAME OVER) */}
          {status === "MENU" && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md grid place-items-center z-50 animate-in fade-in">
              <div className="text-center">
                <h1 className="text-7xl font-black text-white italic tracking-tighter mb-2 drop-shadow-[0_0_30px_rgba(0,242,255,0.5)]">NEON<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">SNAKE</span></h1>
                <p className="text-cyan-500/60 font-mono text-sm tracking-[0.5em] uppercase mb-12">System Ready</p>

                <div className="flex flex-col gap-4 w-64 mx-auto">
                  <div className="flex justify-between items-center text-sm text-gray-400 font-mono border-b border-white/10 pb-2">
                    <span>GRID SIZE</span>
                    <select className="bg-transparent text-white outline-none font-bold text-right cursor-pointer" value={`${cols}x${rows}`} onChange={e => { const [c, r] = e.target.value.split("x").map(Number); setCols(c); setRows(r); }}>
                      {[10, 15, 20, 25].map(n => <option key={n} value={`${n}x${n}`} className="bg-black text-white">{n} × {n}</option>)}
                    </select>
                  </div>
                  <button onClick={startGame} className="mt-4 w-full py-4 bg-white text-black font-black text-xl tracking-widest hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.4)]">INITIATE</button>
                </div>
              </div>
            </div>
          )}

          {status === "GAMEOVER" && (
            <div className="absolute inset-0 bg-red-900/90 backdrop-blur-xl grid place-items-center z-50 animate-in zoom-in-95">
              <div className="text-center">
                <h2 className="text-6xl font-black text-white mb-2 drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]">FATAL ERROR</h2>
                <div className="text-2xl text-white/80 mb-8 font-mono border-y border-white/20 py-2">SCORE: {score}</div>
                <button onClick={startGame} className="px-8 py-3 bg-white text-black font-bold tracking-widest hover:bg-gray-200 transition">REBOOT SYSTEM</button>
              </div>
            </div>
          )}

          {status === "PAUSED" && (<div className="absolute inset-0 bg-black/40 backdrop-blur-sm grid place-items-center z-50"><div className="text-6xl font-black text-white/10 tracking-[0.2em] italic">PAUSED</div></div>)}
        </div>
      </div>
    </div>
  );
}