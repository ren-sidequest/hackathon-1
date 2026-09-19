import React, { useEffect, useRef } from 'react';

// Independent implementation of the public twinkling-square effect, not Pro source.
// Decorative only: no pointer tracking, no hit targets, no data or network calls.
export function GoldBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, previous = 0, width = 0, height = 0, dark = true;
    let cells: { x: number; y: number; phase: number; alpha: number }[] = [];
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = dark ? '#e1bd65' : '#8b661e';
      for (const cell of cells) {
        const pulse = reduced.matches ? .5 : .55 + .45 * Math.sin(time / 2400 + cell.phase);
        context.globalAlpha = cell.alpha * pulse * (dark ? .22 : .09);
        context.fillRect(cell.x, cell.y, 2, 2);
      }
      context.globalAlpha = 1;
    };
    const tick = (time: number) => {
      if (time - previous > 66) { draw(time); previous = time; }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      dark = document.documentElement.dataset.theme !== 'light';
      draw(performance.now());
      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      width = window.innerWidth; height = Math.min(window.innerHeight, 680);
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cells = [];
      for (let y = 0; y < height; y += 24) for (let x = 0; x < width; x += 24) {
        const seed = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        if (seed > .46) cells.push({ x, y, phase: seed * 14, alpha: (x / width) * (1 - y / height) });
      }
      sync();
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', resize);
    reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
    resize();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', resize); reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return <><div className="eb-gold-atmosphere" aria-hidden="true" /><canvas ref={ref} className="eb-gold-backdrop" aria-hidden="true" /></>;
}
