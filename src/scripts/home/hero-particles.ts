// Fundo de partículas conectadas do Hero — Canvas2D puro, sem biblioteca externa.
// Densidade e cálculo de linhas conectivas variam conforme getDeviceCapability().
//
// Implementado na FASE 3.

export interface HeroParticlesOptions {
  density: number; // ~80-100 no modo 'full', ~20-30 no modo 'reduced'
  connectLines: boolean; // desligado no modo 'reduced' (é o cálculo mais caro, mais que a quantidade)
}

export function initHeroParticles(
  _canvas: HTMLCanvasElement,
  _options: HeroParticlesOptions,
): void {
  // TODO (Fase 3)
}
