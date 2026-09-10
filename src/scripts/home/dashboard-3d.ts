// Cena Three.js "Centro de Comando Holográfico" da seção "Sistema" — painel
// principal em escala imersiva, telas menores flutuando em profundidade,
// nuvem de pontos, anéis giratórios e scanner, com GSAP ScrollTrigger
// "mergulhando" a câmera em direção à cena conforme o usuário rola.
//
// Rodada "Cérebro de Automação" (pós-Gêmeo Digital): usuário achou a cena
// pequena/vazia demais perto do novo padrão visual do resto da home. Os 3
// pop-ups (Lean Six Sigma/Automação IA/Diagnóstico) foram escalados ~2,5x e
// espalhados num arco bem mais largo ao redor do painel principal (layout
// "Command Center", não mais 3 telinhas próximas do centro); os terminais
// passaram a exibir payloads/webhooks/rotas (`[200 OK]`, JSON, `route -->`)
// em vez de comandos genéricos; as "rodovias de dados" (tubos + pacotes
// viajando entre painéis) ficaram mais grossas, rápidas e numerosas; e a
// câmera recuou (CAMERA_FAR/NEAR maiores) pra enquadrar a cena bem maior sem
// cortar nada.
//
// Só é carregado via import() dinâmico, depois que device-capability.ts confirmar
// que o aparelho aguenta — nunca baixado em modo 'reduced' (ver home-entry.ts).

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { observeVisibilityLifecycle } from './visibility-lifecycle';

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
  speed?: number; // multiplicador de velocidade de digitação (1 = normal, <1 mais rápido, >1 mais devagar)
  isError?: boolean; // linha de "erro" — some visualmente pro tom resolvido assim que o script segue adiante
  resolvedColor?: string; // cor que a linha de erro assume depois de "recuperada" (ver isError)
}

const TERMINAL_SCRIPTS: Record<string, TerminalLine[]> = {
  lean: [
    { text: '$ POST /webhook/dmaic-trigger', color: '#c4b5fd', speed: 0.85 },
    { text: '  { "processo":"triagem", "waste":3 }', color: '#8b8baa', speed: 1.15 },
    { text: '  [200 OK] gargalos mapeados', color: '#6ee7b7' },
    { text: '$ route --node=melhoria-continua', color: '#c4b5fd', speed: 0.85 },
    { text: '  status: ciclo dmaic ativo_', color: '#8b8baa' },
  ],
  auto: [
    { text: '$ POST /webhook/whatsapp-in', color: '#6ee7b7', speed: 0.85 },
    { text: '  { "canal":"whatsapp", "sid":"9F2A" }', color: '#8b8baa', speed: 1.15 },
    { text: '  [408] timeout, retry...', color: '#f87171', isError: true, resolvedColor: '#4d6b5a' },
    { text: '  [200 OK] fila reprocessada', color: '#6ee7b7' },
    { text: '$ uptime: 24/7 rodando_', color: '#6ee7b7', speed: 0.85 },
  ],
  diagnostico: [
    { text: '$ GET /api/kpis?range=30d', color: '#fbbf24', speed: 0.85 },
    { text: '  { "indicadores":14, "ok":true }', color: '#8b8baa', speed: 1.2 },
    { text: '  [200 OK] dados processados', color: '#8b8baa', speed: 1.2 },
    { text: '  route --node=proposta-ia', color: '#8b8baa' },
    { text: '$ gerando relatorio.pdf_', color: '#fbbf24', speed: 0.85 },
  ],
};

const TYPE_SPEED_MS = 38; // ms por caractere digitado (base — cada linha aplica seu próprio multiplicador)
const LINE_PAUSE_MS = 380; // pausa depois de terminar uma linha
const LOOP_PAUSE_MS = 1600; // pausa antes de reiniciar o script do zero
const ERROR_FLASH_MS = 700; // por quanto tempo a linha de erro "pisca" antes de ser dada como resolvida

class TerminalEmulator {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private lineIndex = 0;
  private charIndex = 0;
  private phase: 'typing' | 'line-pause' | 'loop-pause' = 'typing';
  private phaseStart = performance.now();
  private lineCompletedAt: number[] = []; // timestamp em que cada linha terminou de digitar (p/ recovery visual)

  constructor(
    private readonly title: string,
    private readonly accent: string,
    private readonly lines: TerminalLine[],
    private readonly onErrorStart?: () => void,
  ) {
    this.canvas = document.createElement('canvas');
    // 1.5x a resolução original (mesma proporção 16:9) — os painéis ficaram
    // ~2,5x maiores no espaço 3D, o texto precisa acompanhar pra não borrar.
    this.canvas.width = 480;
    this.canvas.height = 270;
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
      const msPerChar = TYPE_SPEED_MS * (current.speed ?? 1);
      this.charIndex = Math.min(current.text.length, Math.floor(elapsed / msPerChar));
      if (this.charIndex >= current.text.length) {
        this.lineCompletedAt[this.lineIndex] = now;
        this.phase = 'line-pause';
        this.phaseStart = now;
      }
    } else if (this.phase === 'line-pause') {
      if (elapsed >= LINE_PAUSE_MS) {
        this.lineIndex++;
        this.charIndex = 0;
        this.phaseStart = now;
        this.phase = this.lineIndex >= this.lines.length ? 'loop-pause' : 'typing';
        // Sincronia narrativa (Fase 5): dispara exatamente quando o terminal
        // começa a digitar a linha de erro, não depois — o glitch acontece
        // "junto" com o timeout, não como reação atrasada a ele.
        if (this.lines[this.lineIndex]?.isError) this.onErrorStart?.();
      }
    } else {
      if (elapsed >= LOOP_PAUSE_MS) {
        this.lineIndex = 0;
        this.charIndex = 0;
        this.lineCompletedAt = [];
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
    ctx.font = '800 20px -apple-system, Segoe UI, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(this.title.toUpperCase(), 20, 18);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = this.accent;
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.lineTo(w, 50);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Corpo — linhas do terminal, digitando
    ctx.font = '600 18px "Courier New", monospace';
    const lineHeight = 30;
    let y = 66;

    for (let i = 0; i < this.lineIndex; i++) {
      const line = this.lines[i];
      // Recovery visual: uma linha de erro já digitada continua vermelha só
      // durante o "flash" logo depois de completar — passado esse tempo,
      // assume a cor resolvida (o sistema já seguiu em frente, o problema
      // passou), sem precisar reescrever o texto.
      const completedAt = this.lineCompletedAt[i];
      const isFlashing = completedAt !== undefined && performance.now() - completedAt < ERROR_FLASH_MS;
      ctx.fillStyle = line.isError && !isFlashing ? (line.resolvedColor ?? line.color) : line.color;
      ctx.fillText(line.text, 20, y);
      y += lineHeight;
    }

    if (this.lineIndex < this.lines.length) {
      const current = this.lines[this.lineIndex];
      const typed = current.text.slice(0, this.charIndex);
      ctx.fillStyle = current.color;
      ctx.fillText(typed, 20, y);

      // cursor piscante (~1Hz), só desenhado enquanto essa linha está "ativa"
      if (Math.floor(performance.now() / 500) % 2 === 0) {
        const cursorX = 20 + ctx.measureText(typed).width + 3;
        ctx.fillRect(cursorX, y + 3, 10, 20);
      }
    }

    this.texture.needsUpdate = true;
  }
}

// Vidro translúcido reutilizado pro painel principal e pras telas menores —
// só muda o tamanho de cada instância. Além da borda roxa normal, cria duas
// cópias extras (vermelha/ciano) levemente deslocadas, escondidas por padrão
// — são a "aberração cromática" da Fase 5 (glitch), ligadas só durante o
// solavanco de glitch (ver triggerGlitch mais abaixo).
function createGlassMesh(width: number, height: number, depth: number): { mesh: THREE.Mesh; glitchEdges: THREE.LineSegments[] } {
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
  const edgesGeo = new THREE.EdgesGeometry(geo);
  const edges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.9 }));
  mesh.add(edges);

  const glitchOffset = Math.max(width, height) * 0.006;
  const redEdges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0xff4d6a, transparent: true, opacity: 0.85 }));
  redEdges.position.x = -glitchOffset;
  redEdges.visible = false;
  const cyanEdges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 }));
  cyanEdges.position.x = glitchOffset;
  cyanEdges.visible = false;
  mesh.add(redEdges, cyanEdges);

  return { mesh, glitchEdges: [redEdges, cyanEdges] };
}

// ── Fase 2 (Next Level UI v2) — raios volumétricos ("godrays") ──────────────
// Decisão de técnica: o pedido permitia raymarching via shader OU malhas com
// AdditiveBlending. Escolhi malhas — depois do histórico de bugs reais do
// UnrealBloomPass (cena inteira lavando pra cinza, ver nota acima), prefiro
// uma técnica cujo resultado eu controle 100% visualmente (textura em
// gradiente pintada à mão) a um shader de raymarching que só se comprova
// certo depois de muita tentativa e erro. Sem post-processing de qualquer
// jeito, exatamente como pedido.
// Refinamento "Atmosfera" (Diretor de Arte): a textura era um degradê linear
// vertical só — bordas laterais duras, lia como "lâmina de laser". Agora é
// um degradê RADIAL (mais largo que alto, cobrindo o canvas inteiro), sem
// nenhuma borda reta — o raio fica esfumaçado em todas as direções, feito
// luz ambiente banhando a cena, não uma linha sólida competindo com os dados.
function createRayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 40, 0, 64, 40, 150);
  grad.addColorStop(0, 'rgba(167,139,250,0.55)');
  grad.addColorStop(0.3, 'rgba(167,139,250,0.16)');
  grad.addColorStop(0.65, 'rgba(167,139,250,0.04)');
  grad.addColorStop(1, 'rgba(167,139,250,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Grade de wireframe no rosto do painel principal — sugere "interface de
// sistema" sem custo nenhum (um único LineSegments, uma malha de linhas).
//
// Fase 7: o material deixou de ser um LineBasicMaterial estático e virou um
// ShaderMaterial simples — recebe a posição Y do scanner (uScanY) e acende
// (mistura pra uGlowColor, sobe opacidade) só a faixa da grade que o scanner
// está tocando naquele instante. Como o vY é interpolado por fragmento ao
// longo de cada segmento de linha pelo próprio WebGL, isso funciona tanto
// pras linhas horizontais (Y constante, acendem inteiras quando o scanner
// passa) quanto pras verticais (o brilho escorre ao longo delas). Nenhum
// post-processing envolvido — é só o material de UM objeto já existente.
interface HologramGridUniforms {
  uScanY: { value: number };
  uGlowColor: { value: THREE.Color };
}

function createGrid(
  width: number,
  height: number,
  divisionsX: number,
  divisionsY: number,
): { grid: THREE.LineSegments; uniforms: HologramGridUniforms } {
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

  const uniforms: HologramGridUniforms = {
    uScanY: { value: 0 },
    uGlowColor: { value: new THREE.Color(0x6ee7b7) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uBaseColor: { value: new THREE.Color(0xa78bfa) },
      uBaseOpacity: { value: 0.12 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uScanY;
      uniform vec3 uGlowColor;
      uniform vec3 uBaseColor;
      uniform float uBaseOpacity;
      varying float vY;
      void main() {
        float dist = abs(vY - uScanY);
        float glow = smoothstep(0.55, 0.0, dist);
        vec3 color = mix(uBaseColor, uGlowColor, glow);
        gl_FragColor = vec4(color, uBaseOpacity + glow * 0.8);
      }
    `,
  });

  return { grid: new THREE.LineSegments(geo, material), uniforms };
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
  const CAMERA_FOV_DEG = 50;
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, width / height, 0.1, 100);

  // "Mergulho": a câmera começa longe (visão geral do centro de comando) e se
  // aproxima conforme o ScrollTrigger avança — dá a sensação de entrar no
  // sistema, em vez de só o painel girar sozinho no lugar. A posição real é
  // calculada todo quadro dentro de animate() (Fase 6 — órbita + bobbing),
  // não precisa de um valor inicial aqui.
  // Recuados (eram 9.5/4.3) — a cena ficou bem maior (painéis 2,5x, arco bem
  // mais largo), precisa de mais distância pra enquadrar tudo sem cortar,
  // mesmo no "mergulho" mais próximo do scroll.
  // Fase 11 (celular): os dois valores abaixo eram fixos, calibrados pra
  // container largo de desktop — num container estreito e alto (celular em
  // pé) o pop-up mais à esquerda saía cortado. `aspect < 1` (mais alto que
  // largo) agora empurra a câmera ainda mais longe, o suficiente pra caber
  // os pop-ups nas duas pontas (ficam por volta de X=±6.4, meia-largura
  // própria de ~2.5 cada — daí o alvo de ~9 unidades de meia-largura).
  const aspect = width / height;
  const SCENE_HALF_WIDTH = 9.5; // pop-ups giram levemente (rotY) — margem extra pro perfil deles não vazar
  const vFovRad = (CAMERA_FOV_DEG * Math.PI) / 180;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const distanceToFitWidth = (SCENE_HALF_WIDTH / Math.tan(hFovRad / 2)) * 1.3;
  const CAMERA_FAR = Math.max(15, distanceToFitWidth);
  const CAMERA_NEAR = CAMERA_FAR * (6.5 / 15);

  const keyLight = new THREE.PointLight(0xa78bfa, 8, 24);
  keyLight.position.set(3, 3, 5);
  const fillLight = new THREE.PointLight(0x7c3aed, 4, 24);
  fillLight.position.set(-4, -1.5, 3);
  scene.add(keyLight, fillLight, new THREE.AmbientLight(0xffffff, 0.15));

  // Grupo único: tudo que "mergulha"/gira junto conforme o scroll.
  const systemGroup = new THREE.Group();
  scene.add(systemGroup);

  // Fase 5 — todo mesh de vidro (painel + pop-ups) que participa do glitch
  // rítmico entra nesta lista, junto com suas bordas RGB de aberração.
  const glitchTargets: Array<{ mesh: THREE.Mesh; glitchEdges: THREE.LineSegments[] }> = [];

  // ── Painel principal — escala imersiva, quase a largura toda do container ──
  // (rodada "Cérebro de Automação": ~1,15x maior que antes — o salto grande
  // de escala é nos 3 pop-ups, o painel principal ganha só um reforço.)
  const MAIN_W = 10.5;
  const MAIN_H = 3.9;
  const { mesh: mainPanel, glitchEdges: mainPanelGlitchEdges } = createGlassMesh(MAIN_W, MAIN_H, 0.1);
  systemGroup.add(mainPanel);
  glitchTargets.push({ mesh: mainPanel, glitchEdges: mainPanelGlitchEdges });

  const { grid, uniforms: gridUniforms } = createGrid(MAIN_W * 0.94, MAIN_H * 0.86, 14, 6);
  grid.position.z = 0.052;
  mainPanel.add(grid);

  // ── Telas menores flutuando em profundidade, tipo pop-ups holográficos ──
  // Rodada "Cérebro de Automação": os 3 pop-ups saltaram ~2,5x de tamanho e
  // migraram pra um arco bem mais largo ao redor do painel principal — um
  // "Command Center" curvo, não mais 3 telinhas próximas do centro. `rotY`
  // angula cada pop-up de leve pra "encarar" o centro da cena, como telas
  // reais de uma sala de controle curva. Z ainda variado (0.6 / 1.0 / 2.3)
  // pro parallax de profundidade no dolly de scroll.
  const popupSpecs: Array<{
    size: [number, number, number];
    pos: [number, number, number];
    rotY: number;
    title: string;
    accent: string;
    kind: keyof typeof TERMINAL_SCRIPTS;
  }> = [
    { size: [4.75, 2.6, 0.12], pos: [-6.4, 1.8, 0.6], rotY: 0.32, title: 'Lean Six Sigma', accent: '#c4b5fd', kind: 'lean' },
    { size: [5.0, 2.75, 0.12], pos: [6.2, -1.6, 1.0], rotY: -0.32, title: 'Automação IA', accent: '#6ee7b7', kind: 'auto' },
    { size: [4.25, 2.4, 0.12], pos: [0.1, 2.9, 2.3], rotY: 0, title: 'Diagnóstico', accent: '#fbbf24', kind: 'diagnostico' },
  ];
  const terminals: TerminalEmulator[] = [];
  // Fase 9 — as duas flutuações abaixo (posição + rotação) são as ÚNICAS
  // animações GSAP desta cena que rodam pra sempre (repeat:-1) independente
  // de scroll; guardadas aqui pra poder pausar/retomar junto com o rAF quando
  // a seção sai/entra da viewport (ver observeVisibilityLifecycle no fim do
  // arquivo). Os outros gsap.to() da cena (revelação de conexão, glitch) são
  // disparos únicos que terminam sozinhos — não precisam desse controle. Os
  // dois ScrollTrigger.create() também ficam de fora de propósito: um já é
  // "once", e o outro (scrub da câmera) PRECISA continuar reagindo ao scroll
  // mesmo fora da tela, senão a cena reaparece com a pose errada.
  const ambientTweens: gsap.core.Tween[] = [];
  for (const spec of popupSpecs) {
    const { mesh: popup, glitchEdges: popupGlitchEdges } = createGlassMesh(...spec.size);
    popup.position.set(...spec.pos);
    popup.rotation.y = spec.rotY;
    glitchTargets.push({ mesh: popup, glitchEdges: popupGlitchEdges });

    // Sincronia narrativa (Fase 5): o pop-up de Automação dispara um glitch
    // na cena inteira exatamente quando seu terminal reporta o "timeout" —
    // ligado abaixo, depois que triggerGlitch() existir.
    const onErrorStart = spec.kind === 'auto' ? () => triggerGlitch() : undefined;
    const terminal = new TerminalEmulator(spec.title, spec.accent, TERMINAL_SCRIPTS[spec.kind], onErrorStart);
    terminals.push(terminal);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.size[0] * 0.88, spec.size[1] * 0.82),
      new THREE.MeshBasicMaterial({ map: terminal.texture, transparent: true }),
    );
    screen.position.z = spec.size[2] / 2 + 0.005;
    popup.add(screen);

    systemGroup.add(popup);

    // flutuação independente sutil, tipo painel realmente suspenso no ar
    ambientTweens.push(
      gsap.to(popup.position, {
        y: spec.pos[1] + 0.12,
        duration: 1.8 + Math.random() * 0.8,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 0.6,
      }),
    );
    ambientTweens.push(
      gsap.to(popup.rotation, {
        y: (Math.random() - 0.5) * 0.15,
        duration: 2.4 + Math.random(),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      }),
    );
  }

  // ── Anéis de carregamento — motivo clássico de HUD de ficção científica ──
  // Reposicionados pra acompanhar os pop-ups (agora no arco largo) e um
  // pouco maiores (~1,35x), senão ficariam perdidos/minúsculos perto deles.
  const ringSpecs: Array<{ radius: number; pos: [number, number, number]; color: number; speed: number; axis: 'x' | 'y' | 'z' }> = [
    { radius: 0.74, pos: [-6.4, 0.3, 1.1], color: 0xa78bfa, speed: 0.012, axis: 'z' },
    { radius: 0.51, pos: [-6.4, 0.3, 1.1], color: 0x6ee7b7, speed: -0.018, axis: 'z' },
    { radius: 0.68, pos: [6.2, 0.5, 1.4], color: 0x7c3aed, speed: -0.01, axis: 'y' },
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

  // ── Fase 4 — HUD com linhas de conexão dinâmicas (splines) ──────────────
  // Curva (não reta) do painel principal até cada pop-up/nó. Revelada
  // progressivamente via setDrawRange (sem shader de reveal/clipping — é
  // literalmente a técnica sugerida: anima quantos vértices do Line são
  // desenhados, de 0 até o total) quando a seção entra na tela. Depois de
  // desenhada, "pacotes de dados" (pontinhos aditivos) viajam ao longo da
  // MESMA curva em loop — é o substituto sem shader pra "textura deslizando
  // na linha": mais simples de garantir correto, mesmo efeito percebido.
  // Refinamento "Estrutura" (Diretor de Arte): a linha deixou de ser um fio
  // brilhante aditivo (competia com os dados) e virou um TUBO fino — a
  // "fibra óptica" em si é escura/translúcida (sem blending aditivo, sem
  // brilho), só a CASCA existe pra dar volume à conexão. Todo o brilho de
  // verdade fica nos pacotes que viajam por dentro (ver mais abaixo).
  interface HudConnection {
    curve: THREE.QuadraticBezierCurve3;
    geometry: THREE.TubeGeometry;
    tubularSegments: number;
    radialSegments: number;
    drawState: { count: number };
  }

  const CURVE_SAMPLES = 40;
  const TUBE_RADIAL_SEGMENTS = 6;
  const connections: HudConnection[] = [];
  const connectionsGroup = new THREE.Group();
  const PANEL_CENTER = new THREE.Vector3(0, 0, 0.1);

  function addConnection(to: THREE.Vector3, color: number, bulge: number): void {
    const mid = PANEL_CENTER.clone().lerp(to, 0.5);
    mid.y += bulge;
    mid.z += 0.35;
    const curve = new THREE.QuadraticBezierCurve3(PANEL_CENTER, mid, to);
    // Tubo quase 2x mais grosso (era 0.012) — "rodovia de dados" precisa ser
    // vista de longe agora que a cena inteira ficou bem maior.
    const geometry = new THREE.TubeGeometry(curve, CURVE_SAMPLES, 0.022, TUBE_RADIAL_SEGMENTS, false);
    geometry.setDrawRange(0, 0); // começa invisível — o reveal liga isso depois

    const tube = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    connectionsGroup.add(tube);
    connections.push({ curve, geometry, tubularSegments: CURVE_SAMPLES, radialSegments: TUBE_RADIAL_SEGMENTS, drawState: { count: 0 } });
  }

  // 3 ramificações principais — painel → cada pop-up, cores temáticas
  // (roxo/verde/ciano) por serviço. Bulges maiores (eram 0.9/0.9/0.7) pra
  // manter a curva proporcional agora que a distância até cada pop-up quase
  // dobrou.
  addConnection(new THREE.Vector3(...popupSpecs[0].pos), 0xc4b5fd, 1.4);
  addConnection(new THREE.Vector3(...popupSpecs[1].pos), 0x6ee7b7, 1.4);
  addConnection(new THREE.Vector3(...popupSpecs[2].pos), 0x22d3ee, 1.1);
  // 2 ramificações bônus até os anéis (nós de dados) — só pra dar volume,
  // como sugerido, sem precisar rastrear alvo em movimento.
  addConnection(new THREE.Vector3(...ringSpecs[0].pos), 0xa78bfa, 0.6);
  addConnection(new THREE.Vector3(...ringSpecs[2].pos), 0x22d3ee, 0.6);

  systemGroup.add(connectionsGroup);

  // Pacotes de dados — 3 por conexão (eram 2), viajando em loop ao longo da
  // curva. Um único Points compartilhado (mesmo padrão de performance do
  // Data Stream da Fase 3) em vez de um objeto por pacote.
  const PACKETS_PER_CONNECTION = 3;
  const packetGeo = new THREE.BufferGeometry();
  packetGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(connections.length * PACKETS_PER_CONNECTION * 3), 3),
  );
  // Refinamento "Estrutura": agora que o tubo é escuro/discreto, o pacote
  // precisa carregar 100% do brilho — maior e mais intenso que antes.
  // Rodada "Cérebro de Automação": pacote maior (era 0.1) — precisa ler como
  // tráfego ativo de webhook/API de longe, não um pontinho perdido no tubo.
  const packets = new THREE.Points(
    packetGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.16,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  connectionsGroup.add(packets);

  // Os pacotes só começam a "viajar" depois que a última conexão termina de
  // se desenhar — antes disso ficam parados na origem (invisíveis, já que a
  // linha em si ainda nem apareceu).
  let packetsActive = false;

  // Dispara o desenho das conexões quando a seção entra na tela (uma vez só).
  ScrollTrigger.create({
    trigger: mount,
    start: 'top 80%',
    once: true,
    onEnter() {
      connections.forEach((conn, i) => {
        // TubeGeometry é indexada: cada "segmento revelado" corresponde a
        // radialSegments * 2 triângulos * 3 índices. Animar em unidades de
        // segmento (0..tubularSegments) e converter pra índices no onUpdate
        // dá o mesmo efeito de "desenhar do ponto A ao B" que tínhamos com a
        // Line simples, só que aplicado à malha do tubo.
        gsap.to(conn.drawState, {
          count: conn.tubularSegments,
          duration: 1.1,
          ease: 'power2.out',
          delay: i * 0.18,
          onUpdate() {
            const segmentsRevealed = Math.floor(conn.drawState.count);
            conn.geometry.setDrawRange(0, segmentsRevealed * conn.radialSegments * 6);
          },
          onComplete() {
            if (i === connections.length - 1) packetsActive = true;
          },
        });
      });
    },
  });

  // ── Fase 3 — "Data Stream": nuvem de pontos que flui em direção ao painel,
  // com rastro (trail) curto por partícula, simulando dados sendo puxados
  // pro processamento. Estrutura-de-arrays (Float32Array simples, não um
  // array de objetos/Vector3) de propósito — 220 partículas × rastro por
  // quadro é um loop quente, e evitar alocar objeto novo por partícula
  // reduz o trabalho do garbage collector.
  const CLOUD_COUNT = 260; // era 220 — reforço modesto, painel principal ficou ~15% maior
  const TRAIL_LENGTH = 18; // dentro da faixa pedida (15-20 quadros de histórico)
  const ATTRACT_STRENGTH = 0.00085;
  const DAMPING = 0.985;
  const RESPAWN_DIST = 0.4;
  const TARGET_Z = 0.4; // ponto de "processamento", levemente à frente do rosto do painel

  const posX = new Float32Array(CLOUD_COUNT);
  const posY = new Float32Array(CLOUD_COUNT);
  const posZ = new Float32Array(CLOUD_COUNT);
  const velX = new Float32Array(CLOUD_COUNT);
  const velY = new Float32Array(CLOUD_COUNT);
  const velZ = new Float32Array(CLOUD_COUNT);
  // Histórico de posições por partícula, sempre em ordem cronológica (mais
  // antigo no índice 0, mais novo no último) — permite copyWithin (rápido,
  // nativo) em vez de recalcular tudo a cada quadro.
  const trails = new Float32Array(CLOUD_COUNT * TRAIL_LENGTH * 3);

  function spawnParticle(i: number): void {
    const x = (Math.random() - 0.5) * MAIN_W * 1.3;
    const y = (Math.random() - 0.5) * MAIN_H * 1.5;
    const z = 0.5 + Math.random() * 2.4;
    posX[i] = x;
    posY[i] = y;
    posZ[i] = z;
    velX[i] = velY[i] = velZ[i] = 0;
    const base = i * TRAIL_LENGTH * 3;
    for (let t = 0; t < TRAIL_LENGTH; t++) {
      trails[base + t * 3] = x;
      trails[base + t * 3 + 1] = y;
      trails[base + t * 3 + 2] = z;
    }
  }
  for (let i = 0; i < CLOUD_COUNT; i++) spawnParticle(i);

  // "Cabeça" de cada partícula — ponto brilhante na posição atual
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CLOUD_COUNT * 3), 3));
  const pointCloud = new THREE.Points(
    headGeo,
    new THREE.PointsMaterial({
      color: 0xd8b4fe,
      size: 0.045,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  // Rastro — UM único LineSegments pra todas as 220 partículas (não 220
  // objetos Line separados: seria 220 draw calls por quadro só pra isso).
  // Cor por vértice pré-calculada UMA vez (cauda ciano/escura → ponta roxo
  // brilhante) — só as posições mudam a cada quadro.
  const SEGMENTS_PER_PARTICLE = TRAIL_LENGTH - 1;
  const trailVertexCount = CLOUD_COUNT * SEGMENTS_PER_PARTICLE * 2;
  const trailPositions = new Float32Array(trailVertexCount * 3);
  const trailColors = new Float32Array(trailVertexCount * 3);

  const tailColor = new THREE.Color(0x22d3ee); // ciano
  const headColor = new THREE.Color(0xc084fc); // roxo brilhante
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const segBase = i * SEGMENTS_PER_PARTICLE * 2 * 3;
    for (let s = 0; s < SEGMENTS_PER_PARTICLE; s++) {
      const t = s / (SEGMENTS_PER_PARTICLE - 1); // 0 na cauda, 1 na ponta
      const c = tailColor.clone().lerp(headColor, t).multiplyScalar(0.12 + t * 0.88);
      const outA = segBase + s * 2 * 3;
      const outB = outA + 3;
      trailColors[outA] = c.r; trailColors[outA + 1] = c.g; trailColors[outA + 2] = c.b;
      trailColors[outB] = c.r; trailColors[outB + 1] = c.g; trailColors[outB + 2] = c.b;
    }
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
  const trailLines = new THREE.LineSegments(
    trailGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const streamGroup = new THREE.Group();
  streamGroup.add(trailLines, pointCloud);
  systemGroup.add(streamGroup);

  // Chamado a cada quadro — só grava direto nos Float32Array já existentes
  // (setDrawRange/needsUpdate), nunca recria geometria ou aloca por partícula.
  function updateDataStream(): void {
    const headArr = headGeo.attributes.position.array as Float32Array;
    const trailArr = trailGeo.attributes.position.array as Float32Array;

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const dx = -posX[i];
      const dy = -posY[i];
      const dz = TARGET_Z - posZ[i];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

      velX[i] = (velX[i] + (dx / dist) * ATTRACT_STRENGTH) * DAMPING;
      velY[i] = (velY[i] + (dy / dist) * ATTRACT_STRENGTH) * DAMPING;
      velZ[i] = (velZ[i] + (dz / dist) * ATTRACT_STRENGTH) * DAMPING;
      posX[i] += velX[i];
      posY[i] += velY[i];
      posZ[i] += velZ[i];

      if (dist < RESPAWN_DIST) {
        spawnParticle(i); // "processada" — some e reaparece longe, com rastro novo
      } else {
        const base = i * TRAIL_LENGTH * 3;
        trails.copyWithin(base, base + 3, base + TRAIL_LENGTH * 3);
        const lastIdx = base + (TRAIL_LENGTH - 1) * 3;
        trails[lastIdx] = posX[i];
        trails[lastIdx + 1] = posY[i];
        trails[lastIdx + 2] = posZ[i];
      }

      headArr[i * 3] = posX[i];
      headArr[i * 3 + 1] = posY[i];
      headArr[i * 3 + 2] = posZ[i];

      const trailBase = i * TRAIL_LENGTH * 3;
      const segBase = i * SEGMENTS_PER_PARTICLE * 2 * 3;
      for (let s = 0; s < SEGMENTS_PER_PARTICLE; s++) {
        const aIdx = trailBase + s * 3;
        const bIdx = trailBase + (s + 1) * 3;
        const outA = segBase + s * 2 * 3;
        const outB = outA + 3;
        trailArr[outA] = trails[aIdx]; trailArr[outA + 1] = trails[aIdx + 1]; trailArr[outA + 2] = trails[aIdx + 2];
        trailArr[outB] = trails[bIdx]; trailArr[outB + 1] = trails[bIdx + 1]; trailArr[outB + 2] = trails[bIdx + 2];
      }
    }

    headGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.position.needsUpdate = true;
  }

  // ── Scanner — linha fina varrendo o painel principal, efeito radar ──
  // Fase 7: deixou de ser um vaivém (yoyo) e virou uma varredura de sentido
  // único, de baixo pra cima, em loop contínuo de ~8s — a leitura de "scan
  // holográfico" pedida (radar de vaivém lê como "sonar", scan unidirecional
  // lê como "leitura de sistema"). Pra não dar aquele corte seco quando volta
  // pro início, a linha se apaga (opacity → 0) um instante antes de reposicionar
  // no topo/base e reaparece já rodando — sem pulo visual perceptível.
  const SCAN_Y_START = -MAIN_H / 2 + 0.1;
  const SCAN_Y_END = MAIN_H / 2 - 0.1;
  const SCAN_BASE_OPACITY = 0.55;
  const scanLine = new THREE.Mesh(
    new THREE.BoxGeometry(MAIN_W * 0.94, 0.012, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: SCAN_BASE_OPACITY }),
  );
  scanLine.position.z = 0.06;
  scanLine.position.y = SCAN_Y_START;
  mainPanel.add(scanLine);

  gsap
    .timeline({ repeat: -1 })
    .to(scanLine.position, { y: SCAN_Y_END, duration: 7.4, ease: 'sine.inOut' })
    .to(scanLine.material, { opacity: 0, duration: 0.3 }, '-=0.3')
    .set(scanLine.position, { y: SCAN_Y_START })
    .to(scanLine.material, { opacity: SCAN_BASE_OPACITY, duration: 0.3 });

  // ── Raios volumétricos — emanam do centro do painel, tipo "energia" ──
  // Filhos de mainPanel (não de systemGroup direto): assim mergulham junto
  // com o painel no dolly da câmera sem cortar feio contra a geometria —
  // AdditiveBlending + depthWrite:false garante que nunca competem com o
  // z-buffer do vidro, só somam luz por cima.
  // Refinamento "Atmosfera": menos raios, bem mais largos (espalhados, não
  // focados) — leem como neblina luminosa ao redor do painel, não como
  // lasers concorrendo com as conexões/partículas.
  const RAY_COUNT = 5;
  const rayTexture = createRayTexture();
  const rayMaterials: THREE.MeshBasicMaterial[] = [];
  const raysGroup = new THREE.Group();
  raysGroup.position.z = -0.4; // mais atrás do rosto do painel — reforça "luz vindo de dentro/atrás"
  for (let i = 0; i < RAY_COUNT; i++) {
    const rayLength = 4.2 + Math.random() * 1.6;
    const geo = new THREE.PlaneGeometry(1.7 + Math.random() * 0.6, rayLength);
    geo.translate(0, rayLength / 2, 0); // pivô na base — o raio cresce PRA FORA do centro, não atravessa os dois lados
    const mat = new THREE.MeshBasicMaterial({
      map: rayTexture,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    rayMaterials.push(mat);
    const ray = new THREE.Mesh(geo, mat);
    ray.rotation.z = (i / RAY_COUNT) * Math.PI * 2 + Math.random() * 0.3;
    ray.rotation.x = (Math.random() - 0.5) * 0.5; // leve inclinação 3D, não é um leque 2D chapado
    raysGroup.add(ray);
  }
  mainPanel.add(raysGroup);

  // Estado inicial do grupo: entrando de lado, câmera longe (ver ScrollTrigger)
  const START_ROT_Y = -0.5;
  const START_ROT_X = 0.08;
  const START_POS_X = -1.8; // era -1.1 — proporcional à cena bem maior agora
  systemGroup.rotation.y = START_ROT_Y;
  systemGroup.rotation.x = START_ROT_X;
  systemGroup.position.x = START_POS_X;

  // ── Fase 6 — Coreografia de câmera cinematográfica ──────────────────────
  // Antes: a câmera só andava reto no eixo Z (dolly puro). Agora o
  // ScrollTrigger controla um ÂNGULO de órbita além do raio (arco suave ao
  // redor do painel, não uma linha reta), e todo o resto (bobbing contínuo +
  // lookAt dinâmico) roda por conta própria dentro de animate() — não trava
  // no scroll, continua vivo mesmo com a página parada.
  const cameraOrbit = { angle: 0, radius: CAMERA_FAR };
  // Arco bem mais largo (era 0.24 ~14°) — a cena ficou "Command Center", o
  // mergulho de scroll precisa de mais drama pra combinar com a escala nova.
  const ORBIT_ARC = 0.42;
  const lookAtCurrent = new THREE.Vector3(0, 0, 0);

  ScrollTrigger.create({
    trigger: mount,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,
    onUpdate(self) {
      const p = self.progress; // 0 → 1 conforme a seção atravessa a tela
      cameraOrbit.radius = THREE.MathUtils.lerp(CAMERA_FAR, CAMERA_NEAR, p);
      cameraOrbit.angle = THREE.MathUtils.lerp(-ORBIT_ARC / 2, ORBIT_ARC / 2, p);
      systemGroup.rotation.y = THREE.MathUtils.lerp(START_ROT_Y, 0, p);
      systemGroup.rotation.x = THREE.MathUtils.lerp(START_ROT_X, 0, p);
      systemGroup.position.x = THREE.MathUtils.lerp(START_POS_X, 0, p);
    },
  });

  // ── Fase 5 — Glitch / Aberração Cromática ────────────────────────────────
  // "Solavanco" visual rápido (200-500ms): as bordas RGB (ver createGlassMesh)
  // aparecem por cima da borda roxa normal, levemente deslocadas — leitura de
  // aberração cromática sem precisar de um shader de tela cheia (depois do
  // histórico com o UnrealBloomPass, prefiro essa técnica objeto-a-objeto,
  // que eu controlo 100%, a um post-processing novo). Junto, um tremor rápido
  // de posição em cada malha reforça a sensação de "solavanco".
  const GLITCH_DURATION_S = 0.32; // dentro da faixa pedida (200-500ms)

  function triggerGlitch(): void {
    for (const { mesh, glitchEdges } of glitchTargets) {
      for (const edge of glitchEdges) edge.visible = true;
      gsap.to(mesh.position, {
        x: '+=0.045',
        duration: GLITCH_DURATION_S / 4,
        yoyo: true,
        repeat: 3,
        ease: 'none',
        onComplete() {
          for (const edge of glitchEdges) edge.visible = false;
        },
      });
    }
  }

  // Ritmo automático: dispara sozinho a cada 6-12s (faixa pedida), sem
  // depender do usuário rolar a página — é o sistema "processando volume
  // extremo", não uma reação a interação.
  function scheduleNextGlitch(): void {
    const delay = 6000 + Math.random() * 6000;
    setTimeout(() => {
      triggerGlitch();
      scheduleNextGlitch();
    }, delay);
  }
  scheduleNextGlitch();

  // ── Fase 7 (final) — Distorção de Refração ("campo de força") ───────────
  // Objetivo: fazer a nuvem de dados (Fase 3) parecer vista através de um
  // vidro grosso/campo de força, com as coordenadas dela ondulando como
  // calor no ar. UnrealBloomPass e EffectComposer continuam banidos (ver
  // nota do topo do arquivo) — então em vez de um post-processing de tela
  // cheia, a técnica é: renderizar SÓ a nuvem de partículas (streamGroup)
  // numa textura pequena à parte (um WebGLRenderTarget — isso não é
  // EffectComposer, é o mesmo mecanismo de um mapa de sombra/reflexo comum
  // do Three.js) e mostrar essa textura, com UV distorcido, num plano de
  // vidro flutuando entre o painel e os pop-ups. A nuvem passa a existir
  // SÓ ali, nessa versão distorcida — por isso ela sai do layer 0 (o da
  // câmera principal) e vai pro layer 1, exclusivo dessa textura.
  //
  // Decisão consciente: os raios volumétricos (Fase 2) ficaram DE FORA
  // dessa camada. Eles já vivem atrás do vidro físico do painel (material
  // com transmission) e já leem como "energia atrás do vidro" de verdade —
  // duplicar a técnica neles brigaria com o ajuste fino que já existe, sem
  // ganhar nada visualmente.
  const REFRACTION_LAYER = 1;
  streamGroup.traverse((obj) => obj.layers.set(REFRACTION_LAYER));

  // Resolução fixa e modesta (independe do devicePixelRatio da tela) — é o
  // que garante que essa camada extra nunca vira gargalo de framerate,
  // mesmo em telas retina: a nuvem sempre renderiza nesse mesmo tamanho
  // pequeno, custe o que custar a resolução real da janela.
  const refractionTarget = new THREE.WebGLRenderTarget(512, 384, {
    format: THREE.RGBAFormat,
    depthBuffer: true,
    stencilBuffer: false,
  });

  const REFRACTION_PLANE_W = MAIN_W * 1.1;
  const REFRACTION_PLANE_H = MAIN_H * 1.35;
  const refractionUniforms = {
    uTime: { value: 0 },
    uMap: { value: refractionTarget.texture },
  };
  const refractionMaterial = new THREE.ShaderMaterial({
    uniforms: refractionUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        // Duas frequências sobrepostas (uma lenta/larga, outra rápida/fina)
        // dão a ondulação orgânica pedida — "calor no ar", não um zigue-zague
        // mecânico de frequência única.
        float dx = sin(vUv.y * 9.0 + uTime * 0.6) * 0.012 + sin(vUv.y * 23.0 - uTime * 1.1) * 0.005;
        float dy = cos(vUv.x * 7.0 + uTime * 0.5) * 0.012 + cos(vUv.x * 19.0 + uTime * 0.9) * 0.005;
        vec2 distortedUv = clamp(vUv + vec2(dx, dy), 0.0, 1.0);
        gl_FragColor = texture2D(uMap, distortedUv);
      }
    `,
  });
  const refractionPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(REFRACTION_PLANE_W, REFRACTION_PLANE_H),
    refractionMaterial,
  );
  refractionPlane.position.z = 0.5; // entre o rosto do painel e os pop-ups mais próximos
  systemGroup.add(refractionPlane);

  // Paleta que o brilho da grade percorre por baixo do scanner — ciano/verde/
  // roxo, as mesmas cores já usadas no resto da cena ("coesão temática"
  // pedida). Cor e escalar reaproveitados a cada quadro (nunca alocados de
  // novo) pra não pressionar o garbage collector no loop de animação.
  const GRID_GLOW_PALETTE = [new THREE.Color(0x22d3ee), new THREE.Color(0x6ee7b7), new THREE.Color(0xa78bfa)];
  const GRID_GLOW_CYCLE_S = 6; // segundos por trecho do ciclo (3 cores = ~18s de volta completa)
  const gridGlowScratch = new THREE.Color();

  // Glow "neon elegante" via CSS drop-shadow no canvas (ver nota no topo do
  // arquivo — substitui o UnrealBloomPass, que se mostrou quebrado). Dois
  // drop-shadows empilhados: um mais fechado (roxo) e um mais aberto/sutil
  // (verde), ecoando as duas cores que já aparecem nos anéis/telas.
  //
  // Refinamento "Glow Dinâmico": em vez de um filtro estático, o raio de
  // desfoque e a opacidade respiram devagar (seno) — atualizado a cada
  // quadro dentro de animate(), junto com o pulso dos raios volumétricos.

  // Fase 9 — precisa ser cancelável (ver observeVisibilityLifecycle no fim
  // desta função), então guardamos o id em vez de só chamar requestAnimationFrame solto.
  let rafId: number | null = null;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const now = performance.now();
    const t = now * 0.001;

    // Respiração contínua (Fase 6) — roda sempre, independente do scroll:
    // mesmo com a página parada, a câmera flutua levemente, tipo ambiente
    // sem gravidade. Frequências baixas e amplitude minúscula de propósito
    // (regra "anti-náusea" pedida) — um ciclo completo leva ~11-16s, não dá
    // pra perceber como "balanço", só uma presença viva de fundo.
    const bobX = Math.sin(t * 0.55) * 0.05;
    const bobY = Math.sin(t * 0.4 + 1.7) * 0.045;

    // Órbita (arco suave, não reta) + o raio que já vinha do dolly de scroll.
    camera.position.x = Math.sin(cameraOrbit.angle) * cameraOrbit.radius + bobX;
    camera.position.y = bobY;
    camera.position.z = Math.cos(cameraOrbit.angle) * cameraOrbit.radius;

    // LookAt dinâmico, suavizado por lerp — acompanha uma fração pequena da
    // respiração (a câmera "olha" com o corpo todo, não trava o pescoço no
    // mesmo ponto fixo), mas o lerp lento evita qualquer tremor perceptível.
    lookAtCurrent.lerp(new THREE.Vector3(bobX * 0.3, bobY * 0.3, 0.1), 0.04);
    camera.lookAt(lookAtCurrent);

    streamGroup.rotation.y += 0.0006;
    updateDataStream();

    if (packetsActive) {
      const packetPos = packetGeo.attributes.position.array as Float32Array;
      const t = now * 0.001;
      let idx = 0;
      for (const conn of connections) {
        for (let p = 0; p < PACKETS_PER_CONNECTION; p++) {
          // Mais rápido (era 0.22) — precisa ler como tráfego de API/webhook
          // disparando de verdade, não um passeio lento.
          const phase = (t * 0.4 + p / PACKETS_PER_CONNECTION) % 1;
          const point = conn.curve.getPointAt(phase);
          packetPos[idx * 3] = point.x;
          packetPos[idx * 3 + 1] = point.y;
          packetPos[idx * 3 + 2] = point.z;
          idx++;
        }
      }
      packetGeo.attributes.position.needsUpdate = true;
    }
    for (const { mesh, speed, axis } of rings) {
      mesh.rotation[axis] += speed;
    }
    for (const terminal of terminals) {
      terminal.update(now);
    }

    // Pulso lento e contínuo (independe do scroll) + um boost quando o
    // scanner está passando perto do centro do painel — os raios "acendem"
    // em sincronia com o scanner, como pedido.
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.1);
    const scanCenterProximity = 1 - Math.min(1, Math.abs(scanLine.position.y) / (MAIN_H / 2));
    // Refinamento "Atmosfera": teto bem mais baixo (era até ~0.4, agora até
    // ~0.13) — os raios continuam pulsando/reagindo ao scanner, só que como
    // uma respiração de fundo, não uma luz que compete com os dados.
    const rayOpacity = 0.02 + breathe * 0.03 + scanCenterProximity * 0.08;
    for (const mat of rayMaterials) mat.opacity = rayOpacity;

    const glowStrength = 0.4 + breathe * 0.35 + scanCenterProximity * 0.25;
    renderer.domElement.style.filter =
      `drop-shadow(0 0 ${(5 + glowStrength * 4).toFixed(1)}px rgba(167,139,250,${(0.35 + glowStrength * 0.25).toFixed(2)})) ` +
      `drop-shadow(0 0 ${(14 + glowStrength * 10).toFixed(1)}px rgba(110,231,183,${(0.12 + glowStrength * 0.12).toFixed(2)}))`;

    // Fase 7 — a grade acende na altura exata do scanner, com a cor
    // percorrendo devagar a paleta ciano/verde/roxo.
    gridUniforms.uScanY.value = scanLine.position.y;
    const glowPhase = (t / GRID_GLOW_CYCLE_S) % GRID_GLOW_PALETTE.length;
    const glowIndex = Math.floor(glowPhase);
    const glowFrac = glowPhase - glowIndex;
    gridGlowScratch.copy(GRID_GLOW_PALETTE[glowIndex]).lerp(GRID_GLOW_PALETTE[(glowIndex + 1) % GRID_GLOW_PALETTE.length], glowFrac);
    gridUniforms.uGlowColor.value.copy(gridGlowScratch);

    // Fase 7 — renderiza só a nuvem de dados (layer 1) numa textura à parte,
    // pro plano de refração mostrar essa cópia com UV distorcido. Troca de
    // layer na câmera, não EffectComposer: dois render() normais, cada um
    // vendo um recorte diferente da mesma cena.
    refractionUniforms.uTime.value = t;
    camera.layers.set(REFRACTION_LAYER);
    renderer.setRenderTarget(refractionTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    camera.layers.set(0);

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

  // Fase 9 — pausa o rAF (renderer.render() é o custo real, não vale a pena
  // adiar o primeiro frame) e as flutuações ambientes dos pop-ups sempre que
  // a seção sai da viewport; retoma do jeito exato que parou ao voltar.
  observeVisibilityLifecycle(mount, {
    onVisible: () => {
      if (rafId === null) animate();
      for (const tween of ambientTweens) tween.play();
    },
    onHidden: () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      for (const tween of ambientTweens) tween.pause();
    },
  });
}
