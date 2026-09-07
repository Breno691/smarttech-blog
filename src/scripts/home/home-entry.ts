// Ponto de entrada único, importado pelo <script type="module"> do index.astro.
//
// Regra de performance (não mexer sem motivo forte): este é o ÚNICO arquivo que
// pode importar dashboard-3d.ts / icon-3d.ts / card-tilt-spotlight.ts, e só
// pode fazê-lo via import() dinâmico depois de checar getDeviceCapability().
// Em modo 'reduced' (celular fraco, poucos núcleos, prefers-reduced-motion, ou
// economia de dados), esses pacotes nunca devem ser baixados — nem em parte.
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

import { getDeviceCapability } from './device-capability';
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

  if (capability === 'full') {
    const dashboardMount = document.querySelector<HTMLElement>('#dashboard-3d-mount');
    if (dashboardMount) {
      import('./dashboard-3d').then(({ initDashboard3D }) => initDashboard3D(dashboardMount));
    }

    const iconMounts = Array.from(document.querySelectorAll<HTMLElement>('.svc-icon-mount'));
    if (iconMounts.length) {
      import('./icon-3d').then(({ initIcon3D }) => initIcon3D(iconMounts));
    }

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
  } else {
    document.body.classList.add('is-reduced-motion-fallback');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
