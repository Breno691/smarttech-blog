// Cursor customizado "spotlight" — persegue o mouse com lerp (suave, não
// grudado) e reage magneticamente (puxa levemente pro centro) sobre
// elementos interativos. Só desktop (capability 'full'), via import()
// dinâmico em home-entry.ts — nunca carregado no celular/toque.

const FOLLOW_EASE = 0.18; // 0-1: quanto maior, mais "grudado" no mouse real
const MAGNET_PULL = 0.35; // força do "puxão" pro centro do elemento em hover
const INTERACTIVE_SELECTOR = 'a, button, .form-group input, .form-group select, .form-group textarea, .svc-card';

export function initMagneticCursor(): void {
  const cursor = document.createElement('div');
  cursor.className = 'magnetic-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cursor);

  // Só esconde o cursor nativo depois que o customizado já está no DOM —
  // se algo falhar antes disso, o usuário nunca fica sem cursor nenhum.
  document.documentElement.classList.add('magnetic-cursor-active');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cursorX = mouseX;
  let cursorY = mouseY;
  let scale = 1;
  let targetScale = 1;
  let magnetCenter: { x: number; y: number } | null = null;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.classList.add('is-visible');
  });

  // Esconde se o mouse sair da janela — sem isso o cursor fake fica "preso"
  // parado num canto enquanto o usuário mexe noutra janela/aba.
  document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
  document.documentElement.addEventListener('mouseenter', () => cursor.classList.add('is-visible'));

  // Delegação única em vez de listener por elemento — mesmo padrão já usado
  // em EventTracking.astro.
  document.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(INTERACTIVE_SELECTOR);
    if (!el) return;
    targetScale = 1.8;
    cursor.classList.add('is-active');
    const rect = el.getBoundingClientRect();
    magnetCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  document.addEventListener('mouseout', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(INTERACTIVE_SELECTOR);
    if (!el) return;
    targetScale = 1;
    cursor.classList.remove('is-active');
    magnetCenter = null;
  });

  function raf() {
    requestAnimationFrame(raf);

    // Alvo puxado levemente pro centro do elemento em hover (efeito magnético)
    const targetX = magnetCenter ? mouseX + (magnetCenter.x - mouseX) * MAGNET_PULL : mouseX;
    const targetY = magnetCenter ? mouseY + (magnetCenter.y - mouseY) * MAGNET_PULL : mouseY;

    cursorX += (targetX - cursorX) * FOLLOW_EASE;
    cursorY += (targetY - cursorY) * FOLLOW_EASE;
    scale += (targetScale - scale) * 0.2;

    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%) scale(${scale})`;
  }
  raf();
}
