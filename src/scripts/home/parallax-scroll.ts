// Micro-parallax de profundidade — elementos com [data-speed] se deslocam
// sutilmente mais rápido/devagar que o scroll normal conforme atravessam a
// tela. Só desktop (capability 'full'), via import() dinâmico em
// home-entry.ts — nunca baixado no celular.
//
// data-speed="1" = sem parallax (não usar o atributo). <1 = mais devagar que
// o scroll (títulos); >1 = mais rápido (badges/elementos decorativos).

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const MAX_DRIFT_PX = 60; // desvio total sutil, não um parallax de tela cheia

export function initParallaxScroll(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-speed]');

  els.forEach((el) => {
    const speed = parseFloat(el.dataset.speed || '1');
    if (!Number.isFinite(speed) || speed === 1) return;

    const drift = (speed - 1) * MAX_DRIFT_PX;

    gsap.fromTo(
      el,
      { y: -drift },
      {
        y: drift,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
}
