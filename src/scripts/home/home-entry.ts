// Ponto de entrada único, importado pelo <script type="module"> do index.astro.
//
// Regra de performance (não mexer sem motivo forte): este é o ÚNICO arquivo que
// pode importar dashboard-3d.ts / icon-3d.ts, e só pode fazê-lo via import()
// dinâmico depois de checar getDeviceCapability(). Em modo 'reduced' (celular
// fraco, poucos núcleos, prefers-reduced-motion, ou economia de dados), o pacote
// do Three.js nunca deve ser baixado — nem em parte.
//
// FASE 3 concluída (partículas sempre ligadas, densidade por aparelho).
// FASE 4 concluída (dashboard 3D + ícones, via import() dinâmico abaixo).

import { getDeviceCapability } from './device-capability';
import { initHeroParticles } from './hero-particles';

function init() {
  const capability = getDeviceCapability();

  const heroCanvas = document.querySelector<HTMLCanvasElement>('#hero-particles');
  if (heroCanvas) {
    initHeroParticles(heroCanvas, {
      density: capability === 'full' ? 80 : 25,
      connectLines: capability === 'full',
    });
  }

  if (capability === 'full') {
    // import() dinâmico — o Three.js só é baixado (em chunk separado) quando o
    // aparelho passou na checagem acima. Nunca entra no bundle inicial nem é
    // baixado em modo 'reduced'.
    const dashboardMount = document.querySelector<HTMLElement>('#dashboard-3d-mount');
    if (dashboardMount) {
      import('./dashboard-3d').then(({ initDashboard3D }) => initDashboard3D(dashboardMount));
    }

    const iconMounts = Array.from(document.querySelectorAll<HTMLElement>('.svc-icon-mount'));
    if (iconMounts.length) {
      import('./icon-3d').then(({ initIcon3D }) => initIcon3D(iconMounts));
    }
  } else {
    document.body.classList.add('is-reduced-motion-fallback');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
