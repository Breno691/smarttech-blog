// Scroll suave (Lenis) — só desktop, chamado via import() dinâmico atrás da
// checagem de device-capability (ver home-entry.ts). Celular continua com o
// scroll nativo do navegador.

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export function initSmoothScroll(): Lenis {
  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
  });

  // Padrão oficial de integração Lenis + GSAP/ScrollTrigger. De propósito NÃO
  // criamos um segundo loop de rAF manual — o gsap.ticker já dirige o lenis.raf,
  // ter os dois ao mesmo tempo chamaria raf() duas vezes por quadro.
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis!.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // O scroll-behavior:smooth nativo (CSS) e a suavização da Lenis competiriam
  // entre si — desliga o nativo só aqui, no caminho onde a Lenis assume;
  // celular (que nunca roda este módulo) mantém o suave nativo do CSS.
  document.documentElement.style.scrollBehavior = 'auto';

  return lenis;
}

export function getScrollVelocity(): number {
  return lenis?.velocity ?? 0;
}
