// Fade + slide-up suave em elementos com a classe .reveal conforme entram na
// tela. Roda em TODO aparelho — importado estaticamente em home-entry.ts.
//
// De propósito NÃO usa GSAP aqui: é só um fade/translate simples, e trazer a
// biblioteca inteira só pra isso infla o pacote que todo celular baixa sempre
// (GSAP fica reservado pro que já é desktop-only e vem via import() dinâmico:
// dashboard-3d.ts, icon-3d.ts). IntersectionObserver nativo já resolve.

export function initScrollReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('.reveal');
  if (!targets.length) return;

  // Só escondemos os elementos (via CSS, classe abaixo) depois de confirmar
  // que o JS está rodando de verdade — se algo falhar antes disso, o
  // conteúdo já nasceu visível (ver regra .reveal no <style> de index.astro)
  // e nunca fica invisível pra sempre.
  document.documentElement.classList.add('reveal-ready');

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  let count = 0;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        el.style.transitionDelay = `${(count % 3) * 80}ms`;
        count++;
        el.classList.add('is-visible');
        observer.unobserve(el);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
  );

  targets.forEach((el) => observer.observe(el));
}
