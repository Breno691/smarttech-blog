// Cena Three.js "Centro de Comando Holográfico" da seção "Sistema" — painel
// principal em escala imersiva, telas menores flutuando em profundidade,
// nuvem de pontos, anéis giratórios e scanner, com GSAP ScrollTrigger
// "mergulhando" a câmera em direção à cena conforme o usuário rola.
//
// Só é carregado via import() dinâmico, depois que device-capability.ts confirmar
// que o aparelho aguenta — nunca baixado em modo 'reduced' (ver home-entry.ts).

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// NOTA (histórico Fase 2): a ideia original era pós-processamento de verdade
// (EffectComposer + UnrealBloomPass). Testado e descartado depois de isolar
// o problema com precisão: mesmo com OutputPass e o threshold bem alto, o
// UnrealBloomPass "lavava" a cena inteira pra cinza, de forma idêntica não
// importando o strength/threshold configurado. O glow "neon" continua sendo
// feito via CSS `filter: drop-shadow()` no elemento <canvas> — mesma
// sensação visual, sem o bug, sem o custo de múltiplos passes de blur.

// ── Fase 1 (Next Level UI v2) — terminais animados nos pop-ups ──────────────
// Cada pop-up agora "roda" um terminal com linhas digitando de verdade, em
// vez de um texto estático. IMPORTANTE (perf/memória): cada instância cria
// UM <canvas> e UMA THREE.CanvasTexture na hora de construir a cena — depois
// disso, todo frame só REDESENHA nesse mesmo canvas e marca
// `texture.needsUpdate = true`. Nunca cria canvas/textura/material novo por
// frame (isso vazaria memória rápido).

interface TerminalLine {
  text: string;
  color: string;
}

const TERMINAL_SCRIPTS: Record<string, TerminalLine[]> = {
  lean: [
    { text: '$ lean-six-sigma --analyze', color: '#c4b5fd' },
    { text: '  mapeando desperdicios...', color: '#8b8baa' },
    { text: '  > 3 gargalos identificados', color: '#6ee7b7' },
    { text: '$ dmaic --apply', color: '#c4b5fd' },
    { text: '  ciclo de melhoria ativo_', color: '#8b8baa' },
  ],
  auto: [
    { text: '$ automacao-ia --start', color: '#6ee7b7' },
    { text: '  conectando whatsapp...', color: '#8b8baa' },
    { text: '  ! timeout, reconectando', color: '#fbbf24' },
    { text: '  > conexao restabelecida', color: '#6ee7b7' },
    { text: '$ status: rodando 24/7_', color: '#6ee7b7' },
  ],
  diagnostico: [
    { text: '$ diagnostico --run', color: '#fbbf24' },
    { text: '  coletando indicadores...', color: '#8b8baa' },
    { text: '  processando dados...', color: '#8b8baa' },
    { text: '  > analise concluida', color: '#6ee7b7' },
    { text: '$ gerando proposta..._', color: '#fbbf24' },
  ],
};

const TYPE_SPEED_MS = 38; // ms por caractere digitado
const LINE_PAUSE_MS = 380; // pausa depois de terminar uma linha
const LOOP_PAUSE_MS = 1600; // pausa antes de reiniciar o script do zero

class TerminalEmulator {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private lineIndex = 0;
  private charIndex = 0;
  private phase: 'typing' | 'line-pause' | 'loop-pause' = 'typing';
  private phaseStart = performance.now();

  constructor(
    private readonly title: string,
    private readonly accent: string,
    private readonly lines: TerminalLine[],
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 180;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.render();
  }

  // Chamado a cada frame do loop de animação — só recalcula estado e
  // redesenha o MESMO canvas/textura, nunca aloca nada novo.
  update(now: number): void {
    const elapsed = now - this.phaseStart;

    if (this.phase === 'typing') {
      const current = this.lines[this.lineIndex];
      this.charIndex = Math.min(current.text.length, Math.floor(elapsed / TYPE_SPEED_MS));
      if (this.charIndex >= current.text.length) {
        this.phase = 'line-pause';
        this.phaseStart = now;
      }
    } else if (this.phase === 'line-pause') {
      if (elapsed >= LINE_PAUSE_MS) {
        this.lineIndex++;
        this.charIndex = 0;
        this.phaseStart = now;
        this.phase = this.lineIndex >= this.lines.length ? 'loop-pause' : 'typing';
      }
    } else {
      if (elapsed >= LOOP_PAUSE_MS) {
        this.lineIndex = 0;
        this.charIndex = 0;
        this.phase = 'typing';
        this.phaseStart = now;
      }
    }

    this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#06060e';
    ctx.fillRect(0, 0, w, h);

    // Cabeçalho — mantém a identificação clara de qual serviço é cada tela
    ctx.fillStyle = this.accent;
    ctx.font = '800 14px -apple-system, Segoe UI, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(this.title.toUpperCase(), 14, 12);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = this.accent;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.lineTo(w, 34);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Corpo — linhas do terminal, digitando
    ctx.font = '600 13px "Courier New", monospace';
    const lineHeight = 21;
    let y = 46;

    for (let i = 0; i < this.lineIndex; i++) {
      const line = this.lines[i];
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 14, y);
      y += lineHeight;
    }

    if (this.lineIndex < this.lines.length) {
      const current = this.lines[this.lineIndex];
      const typed = current.text.slice(0, this.charIndex);
      ctx.fillStyle = current.color;
      ctx.fillText(typed, 14, y);

      // cursor piscante (~1Hz), só desenhado enquanto essa linha está "ativa"
      if (Math.floor(performance.now() / 500) % 2 === 0) {
        const cursorX = 14 + ctx.measureText(typed).width + 2;
        ctx.fillRect(cursorX, y + 2, 7, 14);
      }
    }

    this.texture.needsUpdate = true;
  }
}

// Vidro translúcido reutilizado pro painel principal e pras telas menores —
// só muda o tamanho de cada instância.
function createGlassMesh(width: number, height: number, depth: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0d0d1c,
    roughness: 0.25,
    transmission: 0.55,
    thickness: 0.6,
    metalness: 0.1,
    clearcoat: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.9 }),
  );
  mesh.add(edges);
  return mesh;
}

// Grade de wireframe no rosto do painel principal — sugere "interface de
// sistema" sem custo nenhum (um único LineSegments, uma malha de linhas).
function createGrid(width: number, height: number, divisionsX: number, divisionsY: number): THREE.LineSegments {
  const halfW = width / 2;
  const halfH = height / 2;
  const points: number[] = [];
  for (let i = 0; i <= divisionsX; i++) {
    const x = -halfW + (width * i) / divisionsX;
    points.push(x, -halfH, 0, x, halfH, 0);
  }
  for (let j = 0; j <= divisionsY; j++) {
    const y = -halfH + (height * j) / divisionsY;
    points.push(-halfW, y, 0, halfW, y, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.12 }));
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
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);

  // "Mergulho": a câmera começa longe (visão geral do centro de comando) e se
  // aproxima conforme o ScrollTrigger avança — dá a sensação de entrar no
  // sistema, em vez de só o painel girar sozinho no lugar.
  const CAMERA_FAR = 9.5;
  const CAMERA_NEAR = 4.3;
  camera.position.set(0, 0, CAMERA_FAR);

  const keyLight = new THREE.PointLight(0xa78bfa, 8, 24);
  keyLight.position.set(3, 3, 5);
  const fillLight = new THREE.PointLight(0x7c3aed, 4, 24);
  fillLight.position.set(-4, -1.5, 3);
  scene.add(keyLight, fillLight, new THREE.AmbientLight(0xffffff, 0.15));

  // Grupo único: tudo que "mergulha"/gira junto conforme o scroll.
  const systemGroup = new THREE.Group();
  scene.add(systemGroup);

  // ── Painel principal — escala imersiva, quase a largura toda do container ──
  const MAIN_W = 9;
  const MAIN_H = 3.3;
  const mainPanel = createGlassMesh(MAIN_W, MAIN_H, 0.1);
  systemGroup.add(mainPanel);

  const grid = createGrid(MAIN_W * 0.94, MAIN_H * 0.86, 14, 6);
  grid.position.z = 0.052;
  mainPanel.add(grid);

  // ── Telas menores flutuando em profundidade, tipo pop-ups holográficos ──
  // Posições em Z variadas de propósito (0.85 / 1.05 / 1.35) — é o que dá o
  // parallax de profundidade quando a câmera se aproxima no scroll.
  const popupSpecs: Array<{
    size: [number, number, number];
    pos: [number, number, number];
    title: string;
    accent: string;
    kind: keyof typeof TERMINAL_SCRIPTS;
  }> = [
    { size: [1.9, 1.05, 0.06], pos: [-3.3, 1.05, 0.85], title: 'Lean Six Sigma', accent: '#c4b5fd', kind: 'lean' },
    { size: [2.0, 1.1, 0.06], pos: [3.1, -0.95, 1.05], title: 'Automação IA', accent: '#6ee7b7', kind: 'auto' },
    { size: [1.7, 0.95, 0.06], pos: [0.15, 1.35, 1.35], title: 'Diagnóstico', accent: '#fbbf24', kind: 'diagnostico' },
  ];
  const terminals: TerminalEmulator[] = [];
  for (const spec of popupSpecs) {
    const popup = createGlassMesh(...spec.size);
    popup.position.set(...spec.pos);

    const terminal = new TerminalEmulator(spec.title, spec.accent, TERMINAL_SCRIPTS[spec.kind]);
    terminals.push(terminal);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.size[0] * 0.88, spec.size[1] * 0.82),
      new THREE.MeshBasicMaterial({ map: terminal.texture, transparent: true }),
    );
    screen.position.z = spec.size[2] / 2 + 0.005;
    popup.add(screen);

    systemGroup.add(popup);

    // flutuação independente sutil, tipo painel realmente suspenso no ar
    gsap.to(popup.position, {
      y: spec.pos[1] + 0.12,
      duration: 1.8 + Math.random() * 0.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 0.6,
    });
    gsap.to(popup.rotation, {
      y: (Math.random() - 0.5) * 0.15,
      duration: 2.4 + Math.random(),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  // ── Anéis de carregamento — motivo clássico de HUD de ficção científica ──
  const ringSpecs: Array<{ radius: number; pos: [number, number, number]; color: number; speed: number; axis: 'x' | 'y' | 'z' }> = [
    { radius: 0.55, pos: [-3.4, -1.15, 1.0], color: 0xa78bfa, speed: 0.012, axis: 'z' },
    { radius: 0.38, pos: [-3.4, -1.15, 1.0], color: 0x6ee7b7, speed: -0.018, axis: 'z' },
    { radius: 0.5, pos: [3.5, 1.2, 0.7], color: 0x7c3aed, speed: -0.01, axis: 'y' },
  ];
  const rings: Array<{ mesh: THREE.Mesh; speed: number; axis: 'x' | 'y' | 'z' }> = [];
  for (const spec of ringSpecs) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius, 0.015, 8, 64, Math.PI * 1.5),
      new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.85 }),
    );
    ring.position.set(...spec.pos);
    systemGroup.add(ring);
    rings.push({ mesh: ring, speed: spec.speed, axis: spec.axis });
  }

  // ── Nuvem de pontos densa — "processamento massivo de dados" ──
  const CLOUD_COUNT = 220;
  const cloudPositions = new Float32Array(CLOUD_COUNT * 3);
  for (let i = 0; i < CLOUD_COUNT; i++) {
    cloudPositions[i * 3] = (Math.random() - 0.5) * MAIN_W * 1.15;
    cloudPositions[i * 3 + 1] = (Math.random() - 0.5) * MAIN_H * 1.3;
    cloudPositions[i * 3 + 2] = 0.3 + Math.random() * 1.6;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
  const pointCloud = new THREE.Points(
    cloudGeo,
    new THREE.PointsMaterial({ color: 0xa78bfa, size: 0.035, transparent: true, opacity: 0.75, sizeAttenuation: true }),
  );
  systemGroup.add(pointCloud);

  // ── Scanner — linha fina varrendo o painel principal, efeito radar ──
  const scanLine = new THREE.Mesh(
    new THREE.BoxGeometry(MAIN_W * 0.94, 0.012, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.55 }),
  );
  scanLine.position.z = 0.06;
  mainPanel.add(scanLine);
  gsap.to(scanLine.position, {
    y: MAIN_H / 2 - 0.1,
    duration: 3.2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });
  scanLine.position.y = -MAIN_H / 2 + 0.1;

  // Estado inicial do grupo: entrando de lado, câmera longe (ver ScrollTrigger)
  const START_ROT_Y = -0.5;
  const START_ROT_X = 0.08;
  systemGroup.rotation.y = START_ROT_Y;
  systemGroup.rotation.x = START_ROT_X;
  systemGroup.position.x = -1.1;

  ScrollTrigger.create({
    trigger: mount,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,
    onUpdate(self) {
      const p = self.progress; // 0 → 1 conforme a seção atravessa a tela
      camera.position.z = THREE.MathUtils.lerp(CAMERA_FAR, CAMERA_NEAR, p);
      systemGroup.rotation.y = THREE.MathUtils.lerp(START_ROT_Y, 0, p);
      systemGroup.rotation.x = THREE.MathUtils.lerp(START_ROT_X, 0, p);
      systemGroup.position.x = THREE.MathUtils.lerp(-1.1, 0, p);
    },
  });

  // Glow "neon elegante" via CSS drop-shadow no canvas (ver nota no topo do
  // arquivo — substitui o UnrealBloomPass, que se mostrou quebrado). Dois
  // drop-shadows empilhados: um mais fechado (roxo) e um mais aberto/sutil
  // (verde), ecoando as duas cores que já aparecem nos anéis/telas.
  renderer.domElement.style.filter =
    'drop-shadow(0 0 6px rgba(167,139,250,0.45)) drop-shadow(0 0 18px rgba(110,231,183,0.18))';

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    pointCloud.rotation.y += 0.0018;
    for (const { mesh, speed, axis } of rings) {
      mesh.rotation[axis] += speed;
    }
    for (const terminal of terminals) {
      terminal.update(now);
    }
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
