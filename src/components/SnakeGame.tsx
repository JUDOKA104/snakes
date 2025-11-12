import React, { useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(true);

  const ensureCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctxRef.current;
  };

  const playBeep = (freq=440, dur=0.06, type: OscillatorType="sine", vol=0.08) => {
    if (!enabledRef.current) return;
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  };

  const eat = () => { playBeep(660, 0.05, "triangle"); };
  const step = () => { playBeep(220, 0.02, "square", 0.02); };
  const die = () => {
    // sweep down
    if (!enabledRef.current) return;
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  };

  const toggle = (on: boolean) => { enabledRef.current = on; };

  return { eat, step, die, toggle };
}

function useSwipe(onDir: (d: Dir) => void) {
  const start = useRef<Point | null>(null);
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        onDir(dx > 0 ? "RIGHT" : "LEFT");
      } else {
        onDir(dy > 0 ? "DOWN" : "UP");
      }
      start.current = null;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [onDir]);
}

function randCell(max: number) {
  return Math.floor(Math.random() * max);
}

function nextHead(head: Point, dir: Dir): Point {
  switch (dir) {
    case "UP": return { x: head.x, y: head.y - 1 };
    case "DOWN": return { x: head.x, y: head.y + 1 };
    case "LEFT": return { x: head.x - 1, y: head.y };
    case "RIGHT": return { x: head.x + 1, y: head.y };
  }
}

function eq(a: Point, b: Point) { return a.x === b.x && a.y === b.y; }

function useLeaderboard() {
  type Entry = { score: number; size: string; date: string };
  const KEY = "snake.leaderboard.v1";
  const read = (): Entry[] => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  };
  const write = (arr: Entry[]) => localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 50)));
  const push = (score: number, size: string) => {
    const arr = read();
    arr.push({ score, size, date: new Date().toISOString() });
    arr.sort((a,b)=>b.score-a.score);
    write(arr);
  };
  const list = (size?: string) => {
    const arr = read();
    return size ? arr.filter(e=>e.size===size).slice(0, 10) : arr.slice(0, 10);
  };
  const reset = () => localStorage.removeItem(KEY);
  return { push, list, reset };
}

export default function SnakeGame() {
  const [cols, setCols] = useState(10);
  const [rows, setRows] = useState(10);
  const [speed, setSpeed] = useState(8); // steps/sec
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);

  const lb = useLeaderboard();
  const audio = useAudio();
  useEffect(()=>audio.toggle(sfxOn),[sfxOn]);

  const sizeKey = `${cols}x${rows}`;
  useEffect(()=>{
    // best for this size
    const list = lb.list(sizeKey);
    setBest(list[0]?.score ?? 0);
  }, [cols, rows]);

  const particleRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const [dir, setDir] = useState<Dir>("RIGHT");
  const [snake, setSnake] = useState<Point[]>([{x:2,y:0},{x:1,y:0},{x:0,y:0}]);
  const [food, setFood] = useState<Point>({x: 5, y: 5});

  // init/restart when size changes
  useEffect(()=>{
    setSnake([{x:2,y:0},{x:1,y:0},{x:0,y:0}]);
    setFood({x: clamp(Math.floor(cols/2),0,cols-1), y: clamp(Math.floor(rows/2),0,rows-1)});
    setDir("RIGHT");
    setScore(0);
    setGameOver(false);
    setPaused(false);
  }, [cols, rows]);

  // input
  useEffect(()=>{
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const toDir = (d: Dir) => {
        setDir(prev => {
          if ((prev === "UP" && d === "DOWN") || (prev === "DOWN" && d === "UP") ||
              (prev === "LEFT" && d === "RIGHT") || (prev === "RIGHT" && d === "LEFT")) return prev;
          return d;
        });
      };
      if (k === "arrowup" || k === "w") toDir("UP");
      else if (k === "arrowdown" || k === "s") toDir("DOWN");
      else if (k === "arrowleft" || k === "a") toDir("LEFT");
      else if (k === "arrowright" || k === "d") toDir("RIGHT");
      else if (k === " "){ setPaused(p=>!p); }
      else if (k === "r"){ restart(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useSwipe((d)=>{
    setDir(prev => {
      if ((prev === "UP" && d === "DOWN") || (prev === "DOWN" && d === "UP") ||
          (prev === "LEFT" && d === "RIGHT") || (prev === "RIGHT" && d === "LEFT")) return prev;
      return d;
    });
  });

  const placeFood = (body: Point[]) => {
    let p: Point;
    do {
      p = { x: randCell(cols), y: randCell(rows) };
    } while (body.some(s => eq(s, p)));
    setFood(p);
  };

  const explode = () => {
    const canvas = particleRef.current;
    if (!canvas) return;
    const grid = gridRef.current;
    const rect = grid?.getBoundingClientRect();
    canvas.width = rect?.width ?? 600;
    canvas.height = rect?.height ?? 600;
    const ctx = canvas.getContext("2d")!;
    const parts = Array.from({length: 120}).map(()=> ({
      x: (rect?.width ?? 0)/2,
      y: (rect?.height ?? 0)/2,
      vx: (Math.random()*2-1)*4,
      vy: (Math.random()*2-1)*4,
      life: 40+Math.random()*30
    }));
    let tick = 0;
    const id = requestAnimationFrame(function loop(){
      tick++;
      ctx.clearRect(0,0,canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
        ctx.globalAlpha = Math.max(0, p.life/80);
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      if (tick < 80) requestAnimationFrame(loop);
      else ctx.clearRect(0,0,canvas.width,canvas.height);
    });
  };

  // game loop
  useEffect(()=>{
    if (paused || gameOver) return;
    const interval = 1000 / clamp(speed, 2, 30);
    const id = setInterval(()=>{
      setSnake(prev => {
        const head = prev[0];
        const nh = nextHead(head, dir);
        // wrap around (torus) or collide -> choose wrap for fun; collide with self is death
        if (nh.x < 0) nh.x = cols-1;
        if (nh.x >= cols) nh.x = 0;
        if (nh.y < 0) nh.y = rows-1;
        if (nh.y >= rows) nh.y = 0;

        if (prev.some((p,i)=> i!==0 && eq(p, nh))) {
          // death
          audio.die();
          explode();
          setGameOver(true);
          lb.push(score, sizeKey);
          setBest(b=>Math.max(b, score));
          return prev;
        }
        const ate = eq(nh, food);
        const body = [nh, ...prev];
        if (!ate) body.pop();
        if (ate) {
          setScore(s => s + 1);
          audio.eat();
          placeFood(body);
        } else {
          audio.step();
        }
        return body;
      });
    }, interval);
    return ()=>clearInterval(id);
  }, [dir, speed, paused, gameOver, cols, rows, food, score]);

  const cells = useMemo(()=> rows*cols, [rows, cols]);
  const percent = Math.min(100, (score / Math.max(1,cells-3)) * 100);

  const restart = () => {
    setSnake([{x:2,y:0},{x:1,y:0},{x:0,y:0}]);
    setFood({x: clamp(Math.floor(cols/2),0,cols-1), y: clamp(Math.floor(rows/2),0,rows-1)});
    setDir("RIGHT");
    setScore(0);
    setGameOver(false);
    setPaused(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 justify-between mb-3">
        <div className="flex items-center gap-3">
          <label className="text-sm opacity-80">Taille</label>
          <select className="bg-transparent border rounded px-2 py-1"
            value={`${cols}x${rows}`}
            onChange={e=>{
              const [c,r] = e.target.value.split("x").map(Number);
              setCols(c); setRows(r);
            }}>
            {[5,8,10,12,15,20].map(n=>(
              <option key={n} value={`${n}x${n}`}>{n}×{n}</option>
            ))}
          </select>

          <label className="text-sm opacity-80">Vitesse</label>
          <input type="range" min={2} max={30} value={speed}
            onChange={e=>setSpeed(parseInt(e.target.value))} />
          <span className="tabular-nums text-sm">{speed} t/s</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="border rounded px-2 py-1" onClick={()=>setSfxOn(s=>!s)}>
            {sfxOn ? "🔊 SFX" : "🔈 Muet"}
          </button>
          <button className="border rounded px-2 py-1" onClick={restart}>↻ Rejouer</button>
          <button className="border rounded px-2 py-1" onClick={()=>setPaused(p=>!p)}>{paused ? "▶︎ Reprendre" : "⏸ Pause"}</button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Score: <span className="tabular-nums">{score}</span></div>
        <div className="opacity-80">Meilleur ({sizeKey}) : <span className="tabular-nums">{best}</span></div>
        <div className="w-40 h-2 bg-white/10 rounded overflow-hidden">
          <div className="h-full bg-green-500" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="relative">
        <div
          ref={gridRef}
          className="grid gap-[2px] bg-[var(--border)] p-[2px] rounded aspect-square"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: rows * cols }).map((_, idx) => {
            const x = idx % cols;
            const y = Math.floor(idx / cols);
            const isFood = food.x === x && food.y === y;
            const idxSnake = snake.findIndex(s => s.x === x && s.y === y);
            const isHead = idxSnake === 0;
            const isBody = idxSnake > 0;
            return (
              <div key={idx} className="bg-[var(--card)] rounded-sm relative">
                {isFood && <div className="w-full h-full rounded-sm" style={{ background: "radial-gradient(circle, rgba(255,100,100,0.95) 0%, rgba(255,0,0,0.8) 60%, transparent 70%)" }} />}
                {isBody && <div className="w-full h-full rounded-sm opacity-90" style={{ background: "linear-gradient(180deg, rgba(20,184,110,1) 0%, rgba(7,140,86,1) 100%)" }} />}
                {isHead && <div className="w-full h-full rounded-sm ring-2 ring-emerald-300" style={{ background: "linear-gradient(180deg, rgba(72,255,173,1) 0%, rgba(20,184,110,1) 100%)" }} />}
              </div>
            );
          })}
        </div>
        <canvas ref={particleRef} className="pointer-events-none absolute inset-0"></canvas>
      </div>

      {gameOver && (
        <div className="mt-3 p-3 rounded border bg-white/5">
          <div className="font-semibold mb-1">💀 Fin de partie</div>
          <div className="text-sm opacity-80 mb-2">Score: {score} — Taille: {sizeKey}</div>
          <button className="border rounded px-3 py-1" onClick={restart}>Rejouer</button>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">🏆 Leaderboard (local)</h3>
          <button className="text-xs opacity-70 hover:opacity-100 underline" onClick={()=>lb.reset()}>Réinitialiser</button>
        </div>
        <table className="w-full text-sm border-separate border-spacing-y-1">
          <thead className="opacity-70">
            <tr><th className="text-left">#</th><th className="text-left">Score</th><th>Taille</th><th>Date</th></tr>
          </thead>
          <tbody>
            {lb.list(sizeKey).map((e, i)=>(
              <tr key={i}>
                <td>{i+1}</td>
                <td className="font-semibold tabular-nums">{e.score}</td>
                <td>{e.size}</td>
                <td>{new Date(e.date).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
