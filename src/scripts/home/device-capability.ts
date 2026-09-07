// Decide se o aparelho aguenta o 3D pesado (Three.js) e a densidade cheia de partículas.
// Combina mais de um sinal de propósito — largura de tela sozinha engana em
// tablets/notebooks com janela redimensionada.

export type DeviceCapability = 'full' | 'reduced';

export function getDeviceCapability(): DeviceCapability {
  const isNarrowOrTouch =
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(pointer: coarse)').matches;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cores = navigator.hardwareConcurrency;
  const isLowCore = typeof cores === 'number' && cores < 4;

  const saveData = (navigator as any).connection?.saveData === true;

  if (prefersReducedMotion || saveData) return 'reduced';
  if (isNarrowOrTouch || isLowCore) return 'reduced';
  return 'full';
}
