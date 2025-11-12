import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal';
import { addScore } from './Leaderboard';

type Vec = { x: number; y: number };

const DIRS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
};

function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => () => { ctxRef.current?.close(); }, []);
  const beep = (freq: number, dur = 0.08) => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = ctxRef.current!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.value = 0.06;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  };
  return {
    eat: () => beep(560),
    step: () => beep(320, 0.04),
    death: () => { beep(180, 0.2); setTimeout(()=>beep(120, 0.25), 120); }
  };
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [cell, setCell] = useState(20); // cell size
  const [speed, setSpeed] = useState(10); // ticks per second
  const [shake, setShake] = useState(0);
  const [openOver, setOpenOver] = useState(false);
  const [lastDir, setLastDir] = useState<Vec>({ x: 1, y: 0 });
  const sounds = useSound();

  const grid = () => {
    const w = Math.floor((canvasRef.current?.parentElement?.clientWidth || 640) * .95);
    const h = Math.min(w, 640);
    const cols = Math.floor(w / cell);
    const rows = Math.floor(h / cell);
    return { cols: Math.max(10, cols), rows: Math.max(10, rows) };
  };

  const stateRef = useRef({
    snake: [] as Vec[],
    dir: { x: 1, y: 0 } as Vec,
    apple: { x: 5, y: 5 } as Vec,
    tAccum: 0,
  });

  const resizeCanvas = () => {
    const g = grid();
    const c = canvasRef.current!;
    c.width = g.cols * cell;
    c.height = g.rows * cell;
  };

  const spawn = () => {
    const g = grid();
    const mid = { x: Math.floor(g.cols/2), y: Math.floor(g.rows/2) };
    stateRef.current.snake = [mid, { x: mid.x-1, y: mid.y }, { x: mid.x-2, y: mid.y }];
    stateRef.current.dir = { x: 1, y: 0 };
    setLastDir({ x: 1, y: 0 });
    setScore(0);
    placeApple();
  };

  const placeApple = () => {
    const g = grid();
    while (true) {
      const pos = { x: Math.floor(Math.random()*g.cols), y: Math.floor(Math.random()*g.rows) };
      if (!stateRef.current.snake.some(s=>s.x===pos.x && s.y===pos.y)) {
        stateRef.current.apple = pos;
        return;
      }
    }
  };

  useEffect(() => { resizeCanvas(); }, [cell]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = DIRS[e.key];
      if (!v) return;
      const d = stateRef.current.dir;
      // disallow reverse
      if (v.x === -d.x && v.y === -d.y) return;
      stateRef.current.dir = v;
      setLastDir(v);
      sounds.step();
    };
    window.addEventListener('keydown', onKey);
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, []);

  useEffect(() => { spawn(); }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const st = stateRef.current;
      st.tAccum += dt;
      const stepTime = 1/Math.max(1, speed);
      if (running && st.tAccum >= stepTime) {
        st.tAccum -= stepTime;
        const g = grid();
        const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
        // walls -> wrap
        head.x = (head.x + g.cols) % g.cols;
        head.y = (head.y + g.rows) % g.rows;

        // self collision
        if (st.snake.some(s => s.x === head.x && s.y === head.y)) {
          sounds.death();
          setShake(1);
          setRunning(false);
          setTimeout(()=>setOpenOver(true), 180);
        } else {
          st.snake.unshift(head);
          if (head.x === st.apple.x && head.y === st.apple.y) {
            setScore(s => s + 10);
            sounds.eat();
            placeApple();
          } else {
            st.snake.pop();
          }
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const draw = () => {
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext('2d')!;
      const g = grid();
      ctx.clearRect(0,0,c.width,c.height);

      // background grid
      for (let y=0;y<g.rows;y++){
        for (let x=0;x<g.cols;x++){
          if ((x+y)%2===0){
            ctx.fillStyle = 'rgba(20,184,110,0.05)';
            ctx.fillRect(x*cell, y*cell, cell, cell);
          }
        }
      }

      // apple (glow)
      const ax = stateRef.current.apple.x*cell, ay = stateRef.current.apple.y*cell;
      const grad = ctx.createRadialGradient(ax+cell/2, ay+cell/2, 2, ax+cell/2, ay+cell/2, cell);
      grad.addColorStop(0, 'rgba(20,184,110,0.9)');
      grad.addColorStop(1, 'rgba(20,184,110,0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ax+cell/2, ay+cell/2, cell*0.6, 0, Math.PI*2);
      ctx.fill();

      // snake
      for (let i=stateRef.current.snake.length-1;i>=0;i--){
        const s = stateRef.current.snake[i];
        const t = i / Math.max(1, stateRef.current.snake.length-1);
        ctx.fillStyle = `hsl(150, 60%, ${35 + 25*(1-t)}%)`;
        const r = cell*0.25;
        const x = s.x*cell, y = s.y*cell;
        // rounded rect
        const w = cell-2, h = cell-2, rx = r, ry = r;
        ctx.beginPath();
        ctx.roundRect(x+1, y+1, w, h, [rx,ry,rx,ry]);
        ctx.fill();
        if (i===0){
          // eyes
          ctx.fillStyle = '#0b0c0e';
          const ex = x + cell/2 + (lastDir.x*cell*0.15), ey = y + cell/2 + (lastDir.y*cell*0.15);
          ctx.beginPath(); ctx.arc(ex-4, ey-2, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex+4, ey+2, 2, 0, Math.PI*2); ctx.fill();
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, cell, speed]);

  const onStart = () => { spawn(); setOpenOver(false); setRunning(true); };

  const onSaveScore = () => {
    const name = (document.getElementById('playerName') as HTMLInputElement)?.value?.trim() || 'Anon';
    addScore({ name, score, date: new Date().toISOString() });
    setOpenOver(false);
  };

  return (
    <section className="asus-rog-card p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button className="btn btn-primary" onClick={onStart}>{running ? 'Recommencer' : 'Jouer'}</button>
        <label className="text-sm flex items-center gap-2">
          Taille des cases
          <select className="select" value={cell} onChange={e=>setCell(parseInt(e.target.value))}>
            {[14,16,18,20,22,24,28,32].map(v=> <option key={v} value={v}>{v}px</option>)}
          </select>
        </label>
        <label className="text-sm flex items-center gap-2">
          Vitesse
          <input className="input w-28" type="range" min={5} max={20} value={speed} onChange={e=>setSpeed(parseInt(e.target.value))} />
          <span className="tabular-nums">{speed}</span>
        </label>
        <div className="ml-auto text-sm text-muted">Score: <span className="text-fg font-semibold tabular-nums">{score}</span></div>
      </div>

      <motion.div animate={shake ? { x: [-6,6,-4,4,-2,2,0] } : {}} onAnimationComplete={()=>setShake(0)}>
        <canvas ref={canvasRef} className="w-full h-auto rounded-2xl border border-border bg-bg shadow-glow" />
      </motion.div>

      <div id="howto" className="mt-4 text-sm text-muted flex flex-wrap gap-4">
        <div>Déplacements : <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> ou <kbd>WASD</kbd></div>
        <div>Mur : wrap-around</div>
        <div>Pomme : +10</div>
      </div>

      <Modal open={openOver} onClose={()=>setOpenOver(false)} title="Game Over">
        <p className="text-sm text-muted">Score : <span className="text-fg font-semibold">{score}</span></p>
        <div className="mt-3 flex items-center gap-2">
          <input id="playerName" className="input flex-1" placeholder="Votre nom / pseudo" maxLength={16} />
          <button className="btn btn-primary" onClick={onSaveScore}>Enregistrer</button>
          <button className="btn" onClick={onStart}>Rejouer</button>
        </div>
      </Modal>
    </section>
  );
}
