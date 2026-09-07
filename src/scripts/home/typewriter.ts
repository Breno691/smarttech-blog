// Efeito "máquina de escrever" no subtítulo do hero. Roda em TODO aparelho —
// importado estaticamente em home-entry.ts.
//
// Anti-CLS: o texto original fica no DOM dentro de .tw-source com
// visibility:hidden (reserva a altura/quebra de linha exatas, sem colapsar o
// espaço, e ainda é o texto que a busca indexa). A digitação acontece num
// <span> irmão, absolutamente posicionado por cima (ver CSS em index.astro),
// preenchendo o mesmo espaço já reservado.

const MS_PER_CHAR = 22;

export function initTypewriter(): void {
  const container = document.querySelector<HTMLElement>('[data-typewriter]');
  const source = container?.querySelector<HTMLElement>('.tw-source');
  const output = container?.querySelector<HTMLElement>('.tw-output');
  if (!container || !source || !output) return;

  const fullText = source.textContent ?? '';
  output.textContent = '';

  const cursor = document.createElement('span');
  cursor.className = 'tw-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  output.appendChild(cursor);

  // Baseado em tempo decorrido (não numa corrente de setTimeout por caractere)
  // — se a página estiver ocupada (partículas + 3D rodando junto) e um quadro
  // atrasar, o próximo quadro pula direto pra quantidade certa de caracteres
  // em vez de acumular atraso. Mesmo princípio do counters.ts.
  const start = performance.now();
  let shown = 0;

  function tick(now: number) {
    const targetChars = Math.min(fullText.length, Math.floor((now - start) / MS_PER_CHAR));
    if (targetChars > shown) {
      cursor.insertAdjacentText('beforebegin', fullText.slice(shown, targetChars));
      shown = targetChars;
    }
    if (shown < fullText.length) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(() => cursor.classList.add('is-done'), 1400);
    }
  }
  requestAnimationFrame(tick);
}
