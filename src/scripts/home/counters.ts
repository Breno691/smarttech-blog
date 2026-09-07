// Sobe de 0 até o valor final nos stats numéricos do hero (−30%, 24h) quando
// entram na tela. Roda em TODO aparelho — importado estaticamente em
// home-entry.ts.
//
// Sem GSAP de propósito, pelo mesmo motivo do scroll-reveal.ts: é só uma
// contagem simples, requestAnimationFrame nativo já resolve sem inflar o
// pacote que todo celular baixa sempre.

function animateCount(el: HTMLElement, to: number) {
  const duration = 1400;
  const start = performance.now();

  function tick(now: number) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cúbico
    el.textContent = Math.round(eased * to).toString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function initCounters(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-count-to]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => {
      const to = Number(el.dataset.countTo);
      if (Number.isFinite(to)) el.textContent = to.toString();
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const to = Number(el.dataset.countTo);
        if (Number.isFinite(to)) animateCount(el, to);
        observer.unobserve(el);
      });
    },
    { threshold: 0.5 },
  );

  targets.forEach((el) => observer.observe(el));
}
