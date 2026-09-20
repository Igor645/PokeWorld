/** Tiny canvas confetti burst for the "named them all" moment. Returns a stop function. */
export function launchConfetti(canvas: HTMLCanvasElement, colors: string[], durationMs = 3600): () => void {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  interface Bit { x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; c: string; round: boolean; }
  const burst = (x: number, dir: number): Bit[] =>
    Array.from({ length: 70 }, () => {
      const angle = (-Math.PI / 2) + dir * (0.25 + Math.random() * 0.65);
      const speed = 9 + Math.random() * 9;
      return {
        x, y: h * 0.72, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        s: 5 + Math.random() * 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        c: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < 0.3,
      };
    });
  const bits = [...burst(w * 0.12, 1), ...burst(w * 0.88, -1)];

  const start = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const age = now - start;
    ctx.clearRect(0, 0, w, h);
    const fade = Math.max(0, Math.min(1, (durationMs - age) / 900));
    for (const b of bits) {
      b.vy += 0.32;
      b.vx *= 0.992;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.s / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-b.s / 2, -b.s / 3, b.s, b.s * 0.66);
      ctx.restore();
    }
    if (age < durationMs) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
