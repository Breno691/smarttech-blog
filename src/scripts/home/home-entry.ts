// Ponto de entrada único, importado pelo <script type="module"> do index.astro.
//
// Regra de performance (não mexer sem motivo forte): este é o ÚNICO arquivo que
// pode importar dashboard-3d.ts / card-tilt-spotlight.ts, e só
// pode fazê-lo via import() dinâmico depois de checar getDeviceCapability().
// Em modo 'reduced' (poucos núcleos, prefers-reduced-motion, ou economia de
// dados), esses pacotes nunca devem ser baixados — nem em parte.
//
// scroll-reveal / counters / typewriter são leves (sem Three.js) e rodam em
// TODO aparelho — por isso são importados estaticamente, fora do if abaixo.
//
// FASE 3 concluída (partículas sempre ligadas, densidade por aparelho).
// FASE 4 concluída (dashboard 3D + ícones, via import() dinâmico abaixo).
// Pacote "Vale do Silício" concluído (reveal/contadores/typewriter sempre;
// tilt+spotlight + painel enriquecido só em 'full').
// Next Level UI Fase 1 concluída (scroll suave + fundo em shader, só 'full').
// Next Level UI Fase 2 concluída (HUD do painel + glow via CSS, só 'full').
// Next Level UI Fase 3 concluída (parallax + stagger, só 'full').
// Next Level UI Fase 4 concluída (cursor magnético, só 'full').
// Fase 8 concluída (Gêmeo Digital — simulação de gargalo/IA, via import()
// dinâmico, só 'full').
// 12/set/2026: Gêmeo Digital e Centro de Comando (dashboard-3d) REMOVIDOS de
// vez — o peso de Three.js (LCP/TBT no PageSpeed, celular real) deixou de
// valer a pena frente ao efeito visual. dashboard-3d.ts/digital-twin.ts
// seguem no repo, sem nenhum import daqui; podem ser apagados quando alguém
// confirmar que não vão voltar.

import { getDeviceCapability } from './device-capability';
import { initHeroParticles } from './hero-particles';
import { initScrollReveal } from './scroll-reveal';
import { initCounters } from './counters';

function init() {
  const capability = getDeviceCapability();

  const heroCanvas = document.querySelector<HTMLCanvasElement>('#hero-particles');
  if (heroCanvas) {
    initHeroParticles(heroCanvas, {
      density: capability === 'full' ? 80 : 25,
      connectLines: capability === 'full',
    });
  }

  // Roda sempre, em qualquer aparelho.
  initScrollReveal(capability === 'full');
  initCounters();
  // 12/set/2026: efeito de digitação removido — a caixa que deveria reservar
  // o espaço (anti-CLS) não estava funcionando, causando ~0.2 de troca de
  // layout no PageSpeed. Texto agora aparece direto, sem animação.

  if (capability !== 'full') {
    document.body.classList.add('is-reduced-motion-fallback');
  }

  // Tudo abaixo é pesado (Three.js × 2 cenas, shader WebGL, GSAP em 4 módulos) —
  // adiado pra depois do `load` E enfileirado um de cada vez (nunca os ~7 juntos
  // na mesma tarefa) pra não travar a thread principal por segundos seguidos.
  // Cada item só começa depois que o navegador teve uma folga real pra pintar/
  // responder ao toque — é essa fila, não o adiamento em si, que ataca o "Total
  // Blocking Time" que o PageSpeed reportou (12/set/2026, TBT ~3s no celular).
  // Ninguém perde cena nem efeito (celular incluído — ver Fase 11 acima):
  // tudo roda, só espaçado no tempo em vez de empilhado num só instante.
  function runQueued(tasks: Array<() => void | Promise<unknown>>) {
    let i = 0;
    function next() {
      if (i >= tasks.length) return;
      const task = tasks[i++];
      Promise.resolve(task()).finally(() => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(next, { timeout: 500 });
        } else {
          setTimeout(next, 50);
        }
      });
    }
    next();
  }

  function loadHeavyScenes() {
    const tasks: Array<() => void | Promise<unknown>> = [];

    if (capability === 'full') {
      const tiltCards = Array.from(document.querySelectorAll<HTMLElement>('.svc-card, .testimonial-card'));
      if (tiltCards.length) {
        tasks.push(() => import('./card-tilt-spotlight').then(({ initCardTiltSpotlight }) => initCardTiltSpotlight(tiltCards)));
      }

      // Sequencial de propósito (independente da fila): o shader de fundo lê a
      // velocidade do scroll da Lenis a cada quadro, então initSmoothScroll()
      // precisa já ter rodado antes dele — os dois entram como um único item
      // da fila pra manter essa ordem.
      tasks.push(() =>
        import('./smooth-scroll').then(({ initSmoothScroll }) => {
          initSmoothScroll();
          return import('./background-webgl').then(({ initBackgroundWebGL }) => initBackgroundWebGL());
        }),
      );

      tasks.push(() => import('./parallax-scroll').then(({ initParallaxScroll }) => initParallaxScroll()));
      tasks.push(() => import('./stagger-reveal').then(({ initStaggerReveal }) => initStaggerReveal()));
      tasks.push(() => import('./magnetic-cursor').then(({ initMagneticCursor }) => initMagneticCursor()));
    }

    runQueued(tasks);
  }

  function scheduleHeavyScenes() {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadHeavyScenes, { timeout: 2000 });
    } else {
      setTimeout(loadHeavyScenes, 300);
    }
  }

  if (document.readyState === 'complete') {
    scheduleHeavyScenes();
  } else {
    window.addEventListener('load', scheduleHeavyScenes);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
