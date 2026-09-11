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
// Fase 11 (08/set/2026): usuário pediu que o Gêmeo Digital e o Centro de
// Comando (dashboard-3d) sejam vistos por TODO MUNDO, celular incluído — as
// duas passaram a usar `shouldLoadStorytellingScenes()` (só bloqueia por
// prefers-reduced-motion/economia de dados, ignora tela estreita/poucos
// núcleos) em vez do gate geral `capability === 'full'`. O resto da lista
// (ícones 3D, tilt-spotlight, shader de fundo, parallax, cursor magnético)
// continua só em 'full' — são efeitos decorativos, não a "prova em tempo
// real" que o usuário quer que ninguém perca.

import { getDeviceCapability, shouldLoadStorytellingScenes } from './device-capability';
import { initHeroParticles } from './hero-particles';
import { initScrollReveal } from './scroll-reveal';
import { initCounters } from './counters';
import { initTypewriter } from './typewriter';

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
  initTypewriter();

  if (capability !== 'full') {
    document.body.classList.add('is-reduced-motion-fallback');
  }

  // Tudo abaixo é pesado (Three.js, ScrollTrigger, shader) — adiado pra depois
  // do `load` (e de um idle real, quando o navegador suportar) pra não competir
  // por banda com o conteúdo crítico da primeira pintura da página. Ninguém
  // perde a cena (nem no celular — ver Fase 11 acima): só passa a baixar um
  // instante depois da página já estar de pé, não durante.
  function loadHeavyScenes() {
    if (shouldLoadStorytellingScenes()) {
      const dashboardMount = document.querySelector<HTMLElement>('#dashboard-3d-mount');
      if (dashboardMount) {
        import('./dashboard-3d').then(({ initDashboard3D }) => initDashboard3D(dashboardMount));
      }

      const twinMount = document.querySelector<HTMLElement>('#digital-twin-mount');
      if (twinMount) {
        import('./digital-twin').then(({ initDigitalTwin }) => initDigitalTwin(twinMount));
      }
    }

    if (capability === 'full') {
      const tiltCards = Array.from(document.querySelectorAll<HTMLElement>('.svc-card, .testimonial-card'));
      if (tiltCards.length) {
        import('./card-tilt-spotlight').then(({ initCardTiltSpotlight }) => initCardTiltSpotlight(tiltCards));
      }

      // Sequencial de propósito: o shader de fundo lê a velocidade do scroll da
      // Lenis a cada quadro, então initSmoothScroll() precisa já ter rodado.
      import('./smooth-scroll').then(({ initSmoothScroll }) => {
        initSmoothScroll();
        import('./background-webgl').then(({ initBackgroundWebGL }) => initBackgroundWebGL());
      });

      import('./parallax-scroll').then(({ initParallaxScroll }) => initParallaxScroll());
      import('./stagger-reveal').then(({ initStaggerReveal }) => initStaggerReveal());
      import('./magnetic-cursor').then(({ initMagneticCursor }) => initMagneticCursor());
    }
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
