// Decide se o aparelho aguenta o 3D pesado (Three.js) e a densidade cheia de partículas.
// Combina mais de um sinal de propósito — largura de tela sozinha engana em
// tablets/notebooks com janela redimensionada.

export type DeviceCapability = 'full' | 'reduced';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasSaveDataOn(): boolean {
  return (navigator as any).connection?.saveData === true;
}

export function getDeviceCapability(): DeviceCapability {
  const isNarrowOrTouch =
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(pointer: coarse)').matches;

  const cores = navigator.hardwareConcurrency;
  const isLowCore = typeof cores === 'number' && cores < 4;

  if (prefersReducedMotion() || hasSaveDataOn()) return 'reduced';
  if (isNarrowOrTouch || isLowCore) return 'reduced';
  return 'full';
}

// Gate deliberadamente mais permissivo, só pras duas seções "vitrine"
// (Gêmeo Digital e Centro de Comando/dashboard-3d): usuário pediu
// explicitamente (08/set/2026) que TODO mundo veja essas duas, celular
// incluído — largura de tela e quantidade de núcleos deixam de bloquear.
// Só continuam bloqueando os dois sinais que representam uma escolha
// EXPLÍCITA da pessoa (não uma suposição sobre o aparelho dela):
// `prefers-reduced-motion` (acessibilidade — sensibilidade a movimento,
// vale em qualquer aparelho) e `saveData` (o próprio usuário ligou economia
// de dados no navegador). Cada uma dessas duas cenas já se pausa sozinha
// fora da viewport (ver visibility-lifecycle.ts), o que reduz bastante o
// risco de a versão "sempre roda" pesar demais num aparelho mais fraco.
export function shouldLoadStorytellingScenes(): boolean {
  return !prefersReducedMotion() && !hasSaveDataOn();
}
