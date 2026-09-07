// Cena Three.js do painel/dashboard flutuante da seção "Sistema", com GSAP
// ScrollTrigger girando/aproximando o painel conforme o usuário rola a página.
//
// Só é carregado via import() dinâmico, depois que device-capability.ts confirmar
// que o aparelho aguenta — nunca baixado em modo 'reduced' (ver home-entry.ts).

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// NOTA (Fase 2): a ideia original era pós-processamento de verdade
// (EffectComposer + UnrealBloomPass). Testado e descartado depois de isolar
// o problema com precisão: mesmo com OutputPass e o threshold bem alto
// (0.94), o UnrealBloomPass "lavava" a cena inteira pra cinza, de forma
// idêntica não importando o strength/threshold configurado — confirmado
// comparando screenshot com o pass ligado vs desligado, várias combinações de
// parâmetro, sempre o mesmo resultado quebrado. Em vez de insistir num pass
// que não se comporta como documentado nesta versão do Three.js, o glow
// "neon" é feito via CSS `filter: drop-shadow()` no próprio elemento
// &lt;canvas&gt; — mesma sensação visual, sem o bug, sem custo de GPU de
// múltiplos passes de blur.

// Gera a textura de um mini-painel de HUD (label + valor), desenhado num
// <canvas> 2D e usado como mapa de um PlaneGeometry — mais leve que carregar
// fonte/imagem externa, e fica no mesmo tom da marca.
function createHudTexture(label: string, value: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(6,6,14,0.82)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '700 16px -apple-system, Segoe UI, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(label.toUpperCase(), 16, 16);

  ctx.fillStyle = accent;
  ctx.font = '800 30px -apple-system, Segoe UI, sans-serif';
  ctx.fillText(value, 16, 46);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function initDashboard3D(mount: HTMLElement): void {
  const width = mount.clientWidth;
  const height = mount.clientHeight;
  if (!width || !height) return;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0); // fundo transparente — o gradiente do site aparece atrás
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Painel "vidro" escuro translúcido
  const panelGeo = new THREE.BoxGeometry(3.2, 1.9, 0.12);
  const panelMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d0d1c,
    roughness: 0.25,
    transmission: 0.55,
    thickness: 0.6,
    metalness: 0.1,
    clearcoat: 0.4,
  });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  scene.add(panel);

  // Bordas roxas brilhantes
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(panelGeo),
    new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.9 }),
  );
  panel.add(edges);

  const keyLight = new THREE.PointLight(0xa78bfa, 8, 20);
  keyLight.position.set(2, 2, 4);
  const fillLight = new THREE.PointLight(0x7c3aed, 4, 20);
  fillLight.position.set(-3, -1, 2);
  scene.add(keyLight, fillLight, new THREE.AmbientLight(0xffffff, 0.15));

  // ── "Equalizador" — barrinhas na frente do vidro, tipo monitor de atividade ──
  const barCount = 5;
  const barGroup = new THREE.Group();
  const barBaseHeights: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const baseHeight = 0.35 + Math.random() * 0.55;
    barBaseHeights.push(baseHeight);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, baseHeight, 0.04),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xa78bfa : 0x6ee7b7,
        transparent: true,
        opacity: 0.85,
      }),
    );
    bar.position.set(-0.9 + i * 0.45, -0.5 + baseHeight / 2, 0.09);
    barGroup.add(bar);

    gsap.to(bar.scale, {
      y: 0.35 + Math.random() * 0.5,
      duration: 0.9 + Math.random() * 0.9,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: i * 0.15,
    });
  }
  panel.add(barGroup);

  // ── Cluster de nós de rede flutuando em frente ao painel ──
  const nodeCount = 7;
  const nodePositions: THREE.Vector3[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodePositions.push(
      // Espalhamento contido de propósito: em z alto (perto da câmera), o
      // grupo herda a rotação do painel durante o ScrollTrigger, e pontos
      // largos + z profundo faziam o cluster "escapar" da caixa de vidro em
      // certos ângulos de rotação. Mantendo x/y bem dentro da metade do
      // painel (1.6 / 0.95) e z raso, o cluster fica sempre contido.
      new THREE.Vector3(
        (Math.random() - 0.5) * 1.7,
        (Math.random() - 0.5) * 0.9,
        0.12 + Math.random() * 0.18,
      ),
    );
  }
  const pointsPositions = new Float32Array(nodePositions.flatMap((v) => [v.x, v.y, v.z]));
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(pointsPositions, 3));
  const points = new THREE.Points(
    pointsGeo,
    new THREE.PointsMaterial({ color: 0xa78bfa, size: 0.06, transparent: true, opacity: 0.9, sizeAttenuation: true }),
  );

  const linePositions: number[] = [];
  const NODE_CONNECT_DISTANCE = 0.85;
  for (let i = 0; i < nodePositions.length; i++) {
    for (let j = i + 1; j < nodePositions.length; j++) {
      if (nodePositions[i].distanceTo(nodePositions[j]) < NODE_CONNECT_DISTANCE) {
        linePositions.push(nodePositions[i].x, nodePositions[i].y, nodePositions[i].z);
        linePositions.push(nodePositions[j].x, nodePositions[j].y, nodePositions[j].z);
      }
    }
  }
  const linesGeo = new THREE.BufferGeometry();
  linesGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  const nodeLines = new THREE.LineSegments(
    linesGeo,
    new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.35 }),
  );

  const nodeGroup = new THREE.Group();
  nodeGroup.add(points, nodeLines);
  panel.add(nodeGroup);

  // ── HUD flutuante — 3 mini-painéis com leitura da metodologia (Fase 2) ──
  // Mesmos limites contidos aprendidos com o bug do cluster de nós: x/y bem
  // dentro da metade do painel, z raso, pra nunca "escapar" do vidro em
  // nenhum ângulo do ScrollTrigger.
  const hudSpecs: Array<{ label: string; value: string; accent: string; pos: [number, number, number] }> = [
    { label: 'Lean Six Sigma', value: 'Ciclo ativo', accent: '#c4b5fd', pos: [-1.15, 0.62, 0.22] },
    { label: 'Automação IA', value: 'Rodando 24/7', accent: '#6ee7b7', pos: [1.15, 0.62, 0.22] },
    { label: 'Diagnóstico', value: 'Em análise', accent: '#fbbf24', pos: [0, -0.78, 0.26] },
  ];
  const hudGroup = new THREE.Group();
  for (const spec of hudSpecs) {
    const texture = createHudTexture(spec.label, spec.value, spec.accent);
    const hudPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.23),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
    hudPanel.position.set(...spec.pos);
    hudGroup.add(hudPanel);

    // leve flutuação independente, pra não parecer estático/colado
    gsap.to(hudPanel.position, {
      y: spec.pos[1] + 0.05,
      duration: 1.6 + Math.random() * 0.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 0.5,
    });
  }
  panel.add(hudGroup);

  // Estado inicial: painel entrando de lado
  panel.rotation.y = -0.9;
  panel.rotation.x = 0.15;
  panel.position.set(-1.4, 0, -1);

  ScrollTrigger.create({
    trigger: mount,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,
    onUpdate(self) {
      const p = self.progress; // 0 → 1 conforme a seção atravessa a tela
      panel.rotation.y = THREE.MathUtils.lerp(-0.9, 0, p);
      panel.rotation.x = THREE.MathUtils.lerp(0.15, 0, p);
      panel.position.x = THREE.MathUtils.lerp(-1.4, 0, p);
      panel.position.z = THREE.MathUtils.lerp(-1, 0.4, p);
    },
  });

  // Glow "neon elegante" via CSS drop-shadow no canvas (ver nota no topo do
  // arquivo — substitui o UnrealBloomPass, que se mostrou quebrado). Dois
  // drop-shadows empilhados: um mais fechado (roxo) e um mais aberto/sutil
  // (verde), ecoando as duas cores que já aparecem nas barras/nós.
  renderer.domElement.style.filter =
    'drop-shadow(0 0 6px rgba(167,139,250,0.45)) drop-shadow(0 0 18px rgba(110,231,183,0.18))';

  function animate() {
    requestAnimationFrame(animate);
    nodeGroup.rotation.y += 0.0025;
    renderer.render(scene, camera);
  }
  animate();

  // O placeholder em CSS puro (Fase 2) fica por baixo, sem precisar remover do DOM —
  // só escondemos visualmente agora que o 3D real está desenhando por cima.
  const fallback = mount.querySelector<HTMLElement>('.system-visual-fallback');
  if (fallback) fallback.style.opacity = '0';

  // Nota: não existe uma função de "cleanup" aqui (nem havia antes desta fase)
  // porque o site é multi-página estático (Astro), não uma SPA com rotas
  // client-side — não há cenário real de "desmontar" essa seção sem recarregar
  // a página inteira. Adicionar dispose() por precaução seria código morto.
  window.addEventListener('resize', () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
}
