// Utilitário compartilhado (Fase 9 — otimização de performance): pausa cenas
// 3D pesadas (loop de requestAnimationFrame + tweens/timelines GSAP) quando
// saem da viewport. Sem isso, o Gêmeo Digital e o Centro de Comando 3D
// continuam rodando (WebGL renderizando, GSAP ticando) mesmo com o usuário
// parado no topo ou no rodapé do site — desperdício de CPU/GPU/bateria que
// pode causar thermal throttling em aparelhos mais fracos.
//
// rootMargin generoso (padrão 300px) faz a cena "acordar" ANTES de entrar de
// fato na tela — evita que o usuário veja um frame congelado no instante em
// que a seção aparece durante um scroll rápido.
export interface VisibilityLifecycle {
  onVisible: () => void;
  onHidden: () => void;
}

export function observeVisibilityLifecycle(target: Element, lifecycle: VisibilityLifecycle, rootMargin = '300px'): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) lifecycle.onVisible();
        else lifecycle.onHidden();
      }
    },
    { rootMargin, threshold: 0 },
  );
  observer.observe(target);
}
