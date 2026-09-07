// Tilt 3D + spotlight seguindo o cursor nos cards de serviço/depoimento.
// Só é chamado quando getDeviceCapability() === 'full' (ver home-entry.ts) —
// em celular/toque este arquivo nem chega a ser baixado.

const MAX_TILT_DEG = 8;

export function initCardTiltSpotlight(cards: HTMLElement[]): void {
  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height;

      const rotY = (px - 0.5) * 2 * MAX_TILT_DEG;
      const rotX = -(py - 0.5) * 2 * MAX_TILT_DEG;

      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.style.setProperty('--rx', `${rotX}deg`);
      card.style.setProperty('--ry', `${rotY}deg`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}
