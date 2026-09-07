// Ícones 3D dos cards de serviço, com flutuação contínua em loop (Y-axis bobbing).
// Um único WebGLRenderer compartilhado para todos os ícones, pra não multiplicar
// o custo de contexto WebGL por card.
//
// Só é carregado via import() dinâmico, junto com dashboard-3d.ts, atrás da
// mesma checagem de device-capability.ts.
//
// Implementado na FASE 4.

export function initIcon3D(_mounts: HTMLElement[]): void {
  // TODO (Fase 4): renderer único + malha geométrica simples por ícone
  // + gsap.to(mesh.position, { y: '+=X', yoyo: true, repeat: -1 })
}
