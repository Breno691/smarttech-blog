// Ponto de entrada único, importado pelo <script type="module"> do index.astro.
//
// Regra de performance (não mexer sem motivo forte): este é o ÚNICO arquivo que
// pode importar dashboard-3d.ts / icon-3d.ts, e só pode fazê-lo via import()
// dinâmico depois de checar getDeviceCapability(). Em modo 'reduced' (celular
// fraco, poucos núcleos, prefers-reduced-motion, ou economia de dados), o pacote
// do Three.js nunca deve ser baixado — nem em parte.
//
// Implementado na FASE 3 (partículas sempre) e completado na FASE 4 (3D condicional).

import { getDeviceCapability } from './device-capability';
import { initHeroParticles } from './hero-particles';

function init() {
  const capability = getDeviceCapability();

  const heroCanvas = document.querySelector<HTMLCanvasElement>('#hero-particles');
  if (heroCanvas) {
    initHeroParticles(heroCanvas, {
      density: capability === 'full' ? 90 : 25,
      connectLines: capability === 'full',
    });
  }

  if (capability === 'full') {
    // TODO (Fase 4): import() dinâmico de dashboard-3d.ts e icon-3d.ts aqui dentro
  } else {
    document.body.classList.add('is-reduced-motion-fallback');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
