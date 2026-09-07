// Decide se o aparelho aguenta o 3D pesado (Three.js) e a densidade cheia de partículas.
// Combina mais de um sinal de propósito — largura de tela sozinha engana em
// tablets/notebooks com janela redimensionada.
//
// Implementado na FASE 3.

export type DeviceCapability = 'full' | 'reduced';

export function getDeviceCapability(): DeviceCapability {
  return 'full'; // TODO (Fase 3): pointer coarse + largura + hardwareConcurrency + prefers-reduced-motion + saveData
}
