// Entrada coreografada (stagger) dos grupos de cards — Serviços, Depoimentos
// e FAQ. Só desktop (capability 'full'), via import() dinâmico em
// home-entry.ts. No celular, esses mesmos elementos (classe .stagger-reveal)
// recebem o fade simples e leve do scroll-reveal.ts (ver ali).
//
// Usa gsap.fromTo (não gsap.from) de propósito: define o estado final
// explicitamente em vez de depender do CSS calculado do elemento — assim não
// há corrida com a regra `.stagger-reveal { opacity: 1 }` (estado seguro
// default) que já existe no <style> de index.astro.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const GROUPS = [
  { container: '.services-grid', items: '.svc-card' },
  { container: '.testimonials-grid', items: '.testimonial-card' },
  { container: '.faq-list', items: '.faq-item' },
];

export function initStaggerReveal(): void {
  for (const { container, items } of GROUPS) {
    const containerEl = document.querySelector<HTMLElement>(container);
    if (!containerEl) continue;
    const els = containerEl.querySelectorAll<HTMLElement>(items);
    if (!els.length) continue;

    gsap.fromTo(
      els,
      { opacity: 0, y: 30, skewY: 4 },
      {
        opacity: 1,
        y: 0,
        skewY: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.15,
        scrollTrigger: {
          trigger: containerEl,
          start: 'top 85%',
          once: true,
        },
      },
    );
  }
}
