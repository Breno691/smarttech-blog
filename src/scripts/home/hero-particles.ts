// Fundo de partículas conectadas do Hero — Canvas2D puro, sem biblioteca externa.
// Densidade e cálculo de linhas conectivas variam conforme getDeviceCapability()
// (ver home-entry.ts, que decide os parâmetros e chama initHeroParticles uma vez).

import { observeVisibilityLifecycle } from './visibility-lifecycle';

export interface HeroParticlesOptions {
  density: number; // ~80 no modo 'full', ~25 no modo 'reduced'
  connectLines: boolean; // desligado no modo 'reduced' — é o cálculo mais caro (O(n²)), mais que a quantidade
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const CONNECT_DISTANCE = 130;
const MOUSE_RADIUS = 110;
const MOUSE_FORCE = 0.6;
const FRICTION = 0.98;

export function initHeroParticles(canvas: HTMLCanvasElement, options: HeroParticlesOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // DPR travado em 1 no modo reduzido — evita renderizar em resolução 3x em celular com tela retina
  const dpr = options.connectLines ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  let width = 0;
  let height = 0;
  let particles: Particle[] = [];
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    const rect = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedParticles() {
    const speed = options.connectLines ? 0.4 : 0.15;
    particles = Array.from({ length: options.density }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
    }));
  }

  resize();
  seedParticles();

  window.addEventListener('resize', () => {
    resize();
    // reposiciona quem ficou fora da nova área em vez de recriar tudo do zero
    for (const p of particles) {
      if (p.x > width) p.x = Math.random() * width;
      if (p.y > height) p.y = Math.random() * height;
    }
  });

  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  window.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  function step() {
    ctx!.clearRect(0, 0, width, height);

    for (const p of particles) {
      // repulsão suave: partículas perto do mouse são empurradas para longe
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < MOUSE_RADIUS * MOUSE_RADIUS) {
        const dist = Math.sqrt(distSq) || 1;
        const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
        p.vx += (dx / dist) * force * 0.05;
        p.vy += (dy / dist) * force * 0.05;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= FRICTION;
      p.vy *= FRICTION;

      // atravessa a borda e reaparece do outro lado, em vez de quicar
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx!.beginPath();
      ctx!.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx!.fillStyle = 'rgba(167, 139, 250, 0.75)';
      ctx!.fill();
    }

    if (options.connectLines) {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DISTANCE) {
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = `rgba(124, 58, 237, ${0.18 * (1 - dist / CONNECT_DISTANCE)})`;
            ctx!.lineWidth = 1;
            ctx!.stroke();
          }
        }
      }
    }

    rafId = requestAnimationFrame(step);
  }

  // Pausa o loop (e o custo O(n²) das linhas conectivas) assim que o Hero sai
  // da viewport pelo scroll — sem isso, o canvas continuava calculando e
  // desenhando pra sempre, mesmo com o usuário lendo o resto da página.
  let rafId: number | null = null;
  observeVisibilityLifecycle(canvas, {
    onVisible: () => {
      if (rafId === null) step();
    },
    onHidden: () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  });
}
