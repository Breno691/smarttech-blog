// Cena Three.js "Gêmeo Digital" (Fase 8, v4 — "Digital War Room") — sala de
// controle de BI corporativa, dark mode, mostrando a IA construindo
// ferramentas reais de Lean Six Sigma (SIPOC, VSM, Histograma, Pareto,
// Ishikawa, VSM To-Be, Carta de Controle) em vez de efeitos abstratos de
// ficção científica. Reconstruído do zero a pedido do usuário: sem nuvens de
// partículas, sem lasers, sem geometria flutuante aleatória — só diagramas
// precisos (linhas ortogonais, caixas) desenhados com
// `ctx.strokeRect`/`ctx.lineTo`/`ctx.arc` num Canvas2D projetado numa tela de
// vidro dentro da cena 3D, mais painéis HTML (Project Charter e log do
// sistema, entre outros) que digitam o conteúdo em tempo real.
//
// Construído ETAPA POR ETAPA a pedido do usuário: as 5 fases do ciclo DMAIC
// (Define 0-20s, Measure 20-40s, Analyze 40-60s, Improve 60-100s, Control
// 100-140s — Improve e Control ganharam 40s cada, o dobro, pra dar tempo de
// ler o 5W2H e o Termo de Encerramento com calma) estão TODAS construídas. O
// loop de 140s (`gsap.timeline({repeat: -1})`) fecha o ciclo sozinho e
// reinicia do zero, voltando pro SIPOC da Define sem vazar traço gráfico nem
// valor de estado da volta anterior — ver
// o `.set()` explícito no início do bloco Define em `buildTimeline()`.
//
// Sem post-processing (UnrealBloomPass segue banido nesse projeto, ver a
// nota no topo de dashboard-3d.ts) — aqui nem chega a ser necessário, o
// visual é deliberadamente plano/preciso, não "brilhante".
//
// Só é carregado via import() dinâmico, depois que device-capability.ts
// confirmar que o aparelho aguenta — nunca baixado em modo 'reduced' (ver
// home-entry.ts).

import * as THREE from 'three';
import { gsap } from 'gsap';
import { observeVisibilityLifecycle } from './visibility-lifecycle';

type TwinPhase = 'define' | 'measure' | 'analyze' | 'improve' | 'control';

const PHASE_COLOR: Record<TwinPhase, string> = {
  define: '#fbbf24',
  measure: '#22d3ee',
  analyze: '#ef4444',
  improve: '#34d399',
  control: '#34d399',
};

// ── Paleta "Corporate BI / Dark Mode" — nada de roxo/neon sci-fi ────────────
const COLOR_CORP_BG = '#0b1220';
const COLOR_CORP_BLUE = '#3b82f6'; // azul corporativo — estrutura/dados neutros
const COLOR_CORP_CYAN = '#22d3ee'; // ciano — "a IA está trabalhando aqui"
const COLOR_CORP_RED = '#ef4444'; // vermelho — gargalo identificado
const COLOR_CORP_GRAY = '#64748b'; // conectores neutros
const COLOR_CORP_GREEN = '#34d399'; // verde — solução aplicada (Improve/Control)

// Vidro translúcido — mesma receita de createGlassMesh em dashboard-3d.ts,
// reimplementada aqui porque cada cena WebGL deste projeto é um arquivo único
// e independente. Usado só como "moldura de monitor" ao redor da tela SIPOC.
function createGlassPanel(width: number, height: number, depth: number, edgeColor: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0d0d1c,
    roughness: 0.3,
    transmission: 0.5,
    thickness: 0.6,
    metalness: 0.1,
    clearcoat: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.8 }),
  );
  mesh.add(edges);
  return mesh;
}

// ── Utilitários de desenho compartilhados entre as telas Canvas2D ──────────
// (SIPOC, VSM, Histograma) — cada fase do DMAIC ganha sua própria tela, mas
// todas falam o mesmo vocabulário visual: grade de fundo, caixas com
// strokeRect, setas ortogonais com ponta triangular. Extraído de dentro de
// SipocScreen pra ser reaproveitado por MeasureScreen (Fase 2) e pelas
// próximas fases.
interface BoxLabel {
  letter: string;
  word: string;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Interpola entre duas cores hex — usado na Fase 4 (Improve) pra "recalcular"
// a escada de Lead Time ao vivo (vermelho do gargalo → verde da solução), em
// vez de um corte seco de cor.
function lerpColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.replace('#', ''), 16);
  const b = parseInt(hexB.replace('#', ''), 16);
  const r = Math.round(THREE.MathUtils.lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(THREE.MathUtils.lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(THREE.MathUtils.lerp(a & 255, b & 255, t));
  return `rgb(${r},${g},${bl})`;
}

function drawScreenBackground(ctx: CanvasRenderingContext2D, w: number, h: number, title: string): void {
  ctx.fillStyle = COLOR_CORP_BG;
  ctx.fillRect(0, 0, w, h);

  // Grade fina de fundo — leitura de "software de BI", sem competir com o diagrama.
  ctx.strokeStyle = 'rgba(148,163,184,0.08)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= w; gx += 80) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 0; gy <= h; gy += 80) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 26px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(title, 70, 40);
}

function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: BoxLabel, alpha: number, color: string, big = false, alert = false, asHeader = false): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = alert ? 'rgba(239,68,68,0.16)' : 'rgba(15,23,42,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = big ? 3 : 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  if (asHeader) {
    // A caixa expandida vira um título no topo assim que o conteúdo interno
    // aparece — evita colidir com o texto dele.
    ctx.textBaseline = 'top';
    ctx.font = '700 22px "Courier New", monospace';
    ctx.fillText(`${label.letter} — ${label.word}`, x + w / 2, y + 18);
  } else if (label.letter) {
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${big ? 46 : 34}px "Courier New", monospace`;
    ctx.fillText(label.letter, x + w / 2, y + h / 2 - (big ? 26 : 18));
    ctx.font = `700 ${big ? 20 : 15}px "Courier New", monospace`;
    ctx.fillText(label.word, x + w / 2, y + h / 2 + (big ? 22 : 20));
  } else {
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${big ? 24 : 19}px "Courier New", monospace`;
    ctx.fillText(label.word, x + w / 2, y + h / 2);
  }
  ctx.restore();
}

// Quebra texto corrido em várias linhas dentro de uma largura máxima —
// necessário a partir da Fase 4/5 "consultivas" (5W2H, explicação da Carta de
// Controle, Termo de Encerramento), que têm parágrafos de verdade em vez de
// só rótulos curtos. Espera que o chamador já tenha ajustado
// fillStyle/font/textAlign('left')/textBaseline('top') antes de chamar.
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(testLine).width > maxWidth) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
  return lineY + lineHeight;
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.strokeStyle = COLOR_CORP_GRAY;
  ctx.fillStyle = COLOR_CORP_GRAY;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Diagrama SIPOC — desenhado com precisão de software de engenharia ──────
// (linhas retas, caixas com strokeRect, tipografia monospace) numa única
// CanvasTexture, projetada na "tela principal" da sala de guerra.
const SIPOC_LABELS: BoxLabel[] = [
  { letter: 'S', word: 'SUPPLIER' },
  { letter: 'I', word: 'INPUT' },
  { letter: 'P', word: 'PROCESS' },
  { letter: 'O', word: 'OUTPUT' },
  { letter: 'C', word: 'CUSTOMER' },
];
const PROCESS_INDEX = 2;
const PROCESS_SUBSTEPS = ['RECEBIMENTO', 'TRIAGEM MANUAL', 'ROTEAMENTO'];
const BOTTLENECK_INDEX = 1; // "Triagem Manual" — o gargalo isolado nesta fase

class SipocScreen {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1600;
    this.canvas.height = 900;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.render(0, 0, 0, 0);
  }

  update(sipocReveal: number, processZoom: number, subReveal: number, t: number): void {
    this.render(sipocReveal, processZoom, subReveal, t);
  }

  private render(sipocReveal: number, processZoom: number, subReveal: number, t: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    drawScreenBackground(ctx, w, h, 'SIPOC — VISÃO MACRO DO PROCESSO');

    const boxW = 260;
    const boxH = 130;
    const gap = 40;
    const boxY = 300;
    const startX = 70;
    const boxRects = SIPOC_LABELS.map((_, i) => ({ x: startX + i * (boxW + gap), y: boxY, w: boxW, h: boxH }));

    // S / I / O / C — esmaecem progressivamente conforme o zoom analítico
    // isola o Process, mas nunca somem de vez (mantém contexto do macro-fluxo).
    const fade = 1 - processZoom * 0.75;
    for (let i = 0; i < SIPOC_LABELS.length; i++) {
      if (i === PROCESS_INDEX) continue;
      const progress = clamp01(sipocReveal - i);
      if (progress <= 0) continue;
      const rect = boxRects[i];
      drawBox(ctx, rect.x, rect.y + (1 - progress) * 16, rect.w, rect.h, SIPOC_LABELS[i], progress * fade, COLOR_CORP_BLUE);
    }

    // Setas ortogonais entre as caixas — as que tocam o Process continuam
    // visíveis mesmo com o zoom (é o fio condutor até o detalhe).
    for (let i = 0; i < SIPOC_LABELS.length - 1; i++) {
      const p1 = clamp01(sipocReveal - i);
      const p2 = clamp01(sipocReveal - (i + 1));
      if (p1 <= 0 || p2 <= 0) continue;
      const a = boxRects[i];
      const b = boxRects[i + 1];
      const touchesProcess = i === PROCESS_INDEX - 1 || i === PROCESS_INDEX;
      const alpha = Math.min(p1, p2) * (touchesProcess ? 1 : fade);
      drawArrow(ctx, a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, alpha);
    }

    // "P" — participa do zoom analítico: cresce da posição original até uma
    // área expandida, onde as 3 sub-etapas aparecem.
    const pOriginal = boxRects[PROCESS_INDEX];
    const pExpanded = { x: 210, y: 470, w: 1180, h: 360 };
    const pRect = {
      x: THREE.MathUtils.lerp(pOriginal.x, pExpanded.x, processZoom),
      y: THREE.MathUtils.lerp(pOriginal.y, pExpanded.y, processZoom),
      w: THREE.MathUtils.lerp(pOriginal.w, pExpanded.w, processZoom),
      h: THREE.MathUtils.lerp(pOriginal.h, pExpanded.h, processZoom),
    };
    const pProgress = clamp01(sipocReveal - PROCESS_INDEX);
    if (pProgress > 0) {
      drawBox(ctx, pRect.x, pRect.y, pRect.w, pRect.h, SIPOC_LABELS[PROCESS_INDEX], pProgress, COLOR_CORP_CYAN, true, false, subReveal > 0);
    }

    // Conectores diagonais tracejados — reforça "drill-down", não um corte seco.
    if (processZoom > 0.02) {
      ctx.save();
      ctx.strokeStyle = `rgba(34,211,238,${(processZoom * 0.5).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(pOriginal.x, pOriginal.y + pOriginal.h);
      ctx.lineTo(pExpanded.x, pExpanded.y);
      ctx.moveTo(pOriginal.x + pOriginal.w, pOriginal.y + pOriginal.h);
      ctx.lineTo(pExpanded.x + pExpanded.w, pExpanded.y);
      ctx.stroke();
      ctx.restore();
    }

    // Sub-etapas do Process — só aparecem depois que o zoom praticamente
    // terminou, senão elas ficariam distorcidas dentro de uma caixa ainda
    // crescendo.
    if (processZoom > 0.85 && subReveal > 0) {
      const subW = 320;
      const subH = 170;
      const subGap = 60;
      const subStartX = pExpanded.x + (pExpanded.w - (subW * 3 + subGap * 2)) / 2;
      const subY = pExpanded.y + 100;
      for (let i = 0; i < PROCESS_SUBSTEPS.length; i++) {
        const progress = clamp01(subReveal - i);
        if (progress <= 0) continue;
        const x = subStartX + i * (subW + subGap);
        const isBottleneck = i === BOTTLENECK_INDEX;
        const pulse = isBottleneck ? 0.75 + 0.25 * Math.sin(t * 4) : 1;
        drawBox(
          ctx,
          x,
          subY + (1 - progress) * 16,
          subW,
          subH,
          { letter: '', word: PROCESS_SUBSTEPS[i] },
          progress * pulse,
          isBottleneck ? COLOR_CORP_RED : COLOR_CORP_CYAN,
          false,
          isBottleneck,
        );
        if (i > 0) {
          const prevProgress = clamp01(subReveal - (i - 1));
          if (prevProgress > 0) drawArrow(ctx, x - subGap, subY + subH / 2, x, subY + subH / 2, Math.min(progress, prevProgress));
        }
      }
    }

    this.texture.needsUpdate = true;
  }
}

// Dimensões físicas do "monitor" — módulo-level (não só dentro de
// createScreenMesh) porque a Fase 11 (celular) precisa delas também na hora
// de calcular a distância da câmera que faz a tela caber em QUALQUER
// proporção de tela, não só a paisagem larga de desktop.
const SCREEN_W = 9.4;
const SCREEN_H = SCREEN_W * (900 / 1600);
const CAMERA_FOV_DEG = 45;

// Distância mínima de câmera pra caber o monitor inteiro (largura E altura)
// dentro do campo de visão, seja qual for a proporção do container. Sem
// isso, a distância fixa calibrada pra desktop (paisagem larga) faz a tela
// "vazar" pras laterais num container estreito e alto (celular em pé) — o
// FOV horizontal encolhe muito mais que o vertical quando o aspect ratio
// cai abaixo de 1, e uma distância pensada só pro caso largo não compensa.
function computeCameraDistance(vFovDeg: number, aspect: number, margin = 1.25): number {
  const vFovRad = (vFovDeg * Math.PI) / 180;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const distForWidth = SCREEN_W / 2 / Math.tan(hFovRad / 2);
  const distForHeight = SCREEN_H / 2 / Math.tan(vFovRad / 2);
  return Math.max(distForWidth, distForHeight) * margin;
}

// Tela genérica de "monitor de vidro" — usada pela SIPOC (Fase 1) e pela
// VSM/Histograma (Fase 2); todas as fases compartilham as mesmas dimensões
// físicas e posição, então o crossfade entre elas (ver applyGroupOpacity)
// acontece pixel a pixel sem saltos de enquadramento.
function createScreenMesh(texture: THREE.CanvasTexture, edgeColor: number): THREE.Mesh {
  const frame = createGlassPanel(SCREEN_W + 0.25, SCREEN_H + 0.25, 0.12, edgeColor);
  const screenMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
  screen.position.z = 0.12 / 2 + 0.01;
  frame.add(screen);
  return frame;
}

// Aplica opacidade a um grupo Three.js inteiro (usado pro crossfade entre as
// telas de cada fase) — percorre todos os materiais do frame de vidro e da
// tela dentro dele, e esconde o grupo (visible=false) quando a opacidade
// chega a zero, pra não gastar draw call à toa com algo invisível.
function applyGroupOpacity(root: THREE.Object3D, opacity: number): void {
  root.visible = opacity > 0.001;
  root.traverse((obj) => {
    const material = (obj as THREE.Mesh | THREE.LineSegments).material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const mat of Array.isArray(material) ? material : [material]) {
      mat.transparent = true;
      mat.opacity = opacity;
    }
  });
}

// ── VSM + Histograma — Fase 2 (Measure) ─────────────────────────────────────
// Mesmo vocabulário visual da SIPOC (grade, strokeRect, setas), só que agora
// provando o gargalo com duas ferramentas reais de Lean Six Sigma: o mapa de
// fluxo de valor (com a "escada" de lead time) e o histograma de frequência.
interface VsmStage {
  label: string;
  bottleneck: boolean;
}

const VSM_STAGES: VsmStage[] = [
  { label: 'RECEPÇÃO DE PEDIDO', bottleneck: false },
  { label: 'ANÁLISE DE CRÉDITO MANUAL', bottleneck: true },
  { label: 'LIBERAÇÃO', bottleneck: false },
];

// Alturas relativas (0-1) das barras do histograma — assimetria à direita
// deliberada (cauda longa): a maioria dos pedidos processa rápido, mas o
// gargalo produz uma cauda de atrasos raros e extremos, nunca uma curva normal.
const HISTOGRAM_BARS = [0.95, 0.74, 0.52, 0.36, 0.24, 0.16, 0.1, 0.06, 0.03];
const HISTOGRAM_SLA_BIN = 3; // a partir desta barra, o tempo já estoura o SLA de 2h

class MeasureScreen {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1600;
    this.canvas.height = 900;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.render(0, 0, 0, 0);
  }

  update(vsmBoxReveal: number, vsmLadderReveal: number, histogramReveal: number, t: number): void {
    this.render(vsmBoxReveal, vsmLadderReveal, histogramReveal, t);
  }

  private render(vsmBoxReveal: number, vsmLadderReveal: number, histogramReveal: number, t: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    drawScreenBackground(ctx, w, h, 'VALUE STREAM MAP — FLUXO ATUAL DO PROCESSO');

    const boxW = 380;
    const boxH = 110;
    const gap = 60;
    const boxY = 140;
    const startX = 90;
    const boxRects = VSM_STAGES.map((_, i) => ({ x: startX + i * (boxW + gap), y: boxY, w: boxW, h: boxH }));

    for (let i = 0; i < VSM_STAGES.length; i++) {
      const progress = clamp01(vsmBoxReveal - i);
      if (progress <= 0) continue;
      const stage = VSM_STAGES[i];
      const rect = boxRects[i];
      const pulse = stage.bottleneck ? 0.75 + 0.25 * Math.sin(t * 4) : 1;
      drawBox(ctx, rect.x, rect.y + (1 - progress) * 16, rect.w, rect.h, { letter: '', word: stage.label }, progress * pulse, stage.bottleneck ? COLOR_CORP_RED : COLOR_CORP_BLUE, false, stage.bottleneck);
    }
    for (let i = 0; i < VSM_STAGES.length - 1; i++) {
      const p1 = clamp01(vsmBoxReveal - i);
      const p2 = clamp01(vsmBoxReveal - (i + 1));
      if (p1 <= 0 || p2 <= 0) continue;
      const a = boxRects[i];
      const b = boxRects[i + 1];
      drawArrow(ctx, a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, Math.min(p1, p2));
    }

    // Escada de Lead Time (dente de serra): baixa sob as caixas boas, dispara
    // e fica vermelha sob o gargalo — o tempo perdido precisa ser VISTO, não
    // só lido num número.
    this.drawLeadTimeLadder(boxRects, vsmLadderReveal);

    // O histograma só começa a aparecer depois que a escada já contou a
    // história visual do gargalo — evita competir por atenção na tela.
    if (histogramReveal > 0) this.drawHistogram(histogramReveal);

    this.texture.needsUpdate = true;
  }

  private drawLeadTimeLadder(boxRects: { x: number; y: number; w: number; h: number }[], reveal: number): void {
    if (reveal <= 0) return;
    const ctx = this.ctx;
    const lowY = 430;
    const highY = 310;
    const [r0, r1, r2] = boxRects;
    // Percurso da linha: baixo sob a caixa boa, sobe sob o gargalo, desce de novo.
    const points: { x: number; y: number; color: string }[] = [
      { x: r0.x, y: lowY, color: COLOR_CORP_BLUE },
      { x: r0.x + r0.w, y: lowY, color: COLOR_CORP_BLUE },
      { x: r1.x, y: highY, color: COLOR_CORP_RED },
      { x: r1.x + r1.w, y: highY, color: COLOR_CORP_RED },
      { x: r2.x, y: lowY, color: COLOR_CORP_BLUE },
      { x: r2.x + r2.w, y: lowY, color: COLOR_CORP_BLUE },
    ];
    const totalX = points[points.length - 1].x - points[0].x;
    const revealX = points[0].x + totalX * reveal;

    ctx.save();
    ctx.lineWidth = 3;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a.x >= revealX) break;
      const clippedB = b.x > revealX ? { x: revealX, y: THREE.MathUtils.lerp(a.y, b.y, (revealX - a.x) / (b.x - a.x)) } : b;
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(clippedB.x, clippedB.y);
      ctx.stroke();
    }
    ctx.restore();

    // Rótulos de tempo — só aparecem quando o trecho correspondente já foi desenhado.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 18px "Courier New", monospace';
    if (revealX > r0.x + r0.w * 0.6) {
      ctx.fillStyle = COLOR_CORP_BLUE;
      ctx.textBaseline = 'top';
      ctx.fillText('2 MIN — VALUE ADDED', r0.x + r0.w / 2, lowY + 14);
    }
    if (revealX > r1.x + r1.w * 0.6) {
      ctx.fillStyle = COLOR_CORP_RED;
      ctx.textBaseline = 'bottom';
      ctx.fillText('42H — NON-VALUE ADDED', r1.x + r1.w / 2, highY - 12);
    }
    if (revealX >= r2.x + r2.w * 0.6) {
      ctx.fillStyle = COLOR_CORP_BLUE;
      ctx.textBaseline = 'top';
      ctx.fillText('2 MIN — VALUE ADDED', r2.x + r2.w / 2, lowY + 14);
    }
    ctx.restore();
  }

  private drawHistogram(reveal: number): void {
    const ctx = this.ctx;
    const chartX = 90;
    const chartRight = 1510;
    const baseY = 850;
    const topY = 610;
    const maxBarH = baseY - topY;
    const n = HISTOGRAM_BARS.length;
    const barGap = 8;
    const barW = (chartRight - chartX - barGap * (n - 1)) / n;

    ctx.save();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 22px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('DISTRIBUIÇÃO DE FREQUÊNCIA — TEMPO DE PROCESSAMENTO', chartX, topY - 60);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = COLOR_CORP_GRAY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartX, baseY);
    ctx.lineTo(chartRight, baseY);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < n; i++) {
      const progress = clamp01(reveal - i);
      if (progress <= 0) continue;
      const x = chartX + i * (barW + barGap);
      const barH = HISTOGRAM_BARS[i] * maxBarH * progress;
      const isTail = i >= HISTOGRAM_SLA_BIN;
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = isTail ? 'rgba(239,68,68,0.55)' : 'rgba(59,130,246,0.6)';
      ctx.strokeStyle = isTail ? COLOR_CORP_RED : COLOR_CORP_BLUE;
      ctx.lineWidth = 2;
      ctx.fillRect(x, baseY - barH, barW, barH);
      ctx.strokeRect(x, baseY - barH, barW, barH);
      ctx.restore();
    }

    // Linha de limite de SLA — só entra quase no fim da revelação das barras,
    // senão "adiantaria" a conclusão antes da prova estatística completa.
    const slaProgress = clamp01((reveal - (n - 1.5)) / 1.5);
    if (slaProgress > 0) {
      const slaX = chartX + HISTOGRAM_SLA_BIN * (barW + barGap) - barGap / 2;
      ctx.save();
      ctx.globalAlpha = slaProgress;
      ctx.strokeStyle = COLOR_CORP_RED;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(slaX, topY - 20);
      ctx.lineTo(slaX, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLOR_CORP_RED;
      ctx.font = '700 16px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('LIMITE SLA: 2H', slaX + 10, topY - 24);
      ctx.restore();
    }
  }
}

// ── VSM To-Be — Fase 4 (Improve) ────────────────────────────────────────────
// Reaproveita a MESMA disposição de caixas e a mesma técnica de "escada" da
// Fase 2 (Measure) — a história agora é inversa: a IA arranca o nó manual
// (um X vermelho risca a caixa até ela sumir), instala a automação no lugar
// (caixa verde-ciano brilhante) e recalcula a escada de Lead Time ao vivo, do
// pico vermelho de 42h até uma linha rasteira e verde.
const IMPROVE_STAGE_LABELS = ['RECEPÇÃO DE PEDIDO', 'ANÁLISE DE CRÉDITO MANUAL', 'LIBERAÇÃO'];
const IMPROVE_BOTTLENECK_INDEX = 1;
const AUTOMATION_LABEL = 'AUTOMAÇÃO N8N / AI ROUTING';

// Plano de Ação 5W2H — realismo consultivo pedido pelo usuário: nenhum Master
// Black Belt pula da causa raiz direto pra solução sem documentar o PLANO
// antes de executar. Aparece 60-68s, ANTES do VSM To-Be (que só começa depois
// que o plano "foi aprovado na tela").
interface FiveW2HRow {
  label: string;
  text: string;
}
const FIVE_W2H_ROWS: FiveW2HRow[] = [
  { label: 'WHAT — O QUE', text: 'Substituição da triagem manual por Webhooks n8n.' },
  { label: 'WHY — POR QUÊ', text: 'Erradicar o gargalo de 42h (Wait Time).' },
  { label: 'WHO — QUEM', text: 'SmartOps IA + API Gateway.' },
  { label: 'HOW — COMO', text: 'Regras de roteamento condicional via payload JSON.' },
];

class ImproveScreen {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1600;
    this.canvas.height = 900;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.render(0, 0, 0, 0, 0, 0);
  }

  update(actionPlanReveal: number, actionPlanFade: number, boxReveal: number, destroyProgress: number, automationReveal: number, ladderCrush: number, t: number): void {
    this.render(actionPlanReveal, actionPlanFade, boxReveal, destroyProgress, automationReveal, ladderCrush, t);
  }

  private render(actionPlanReveal: number, actionPlanFade: number, boxReveal: number, destroyProgress: number, automationReveal: number, ladderCrush: number, t: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const title = actionPlanFade < 0.5 ? 'IMPROVE — PLANO DE AÇÃO (5W2H)' : 'IMPROVE — VALUE STREAM MAP (ESTADO FUTURO)';
    drawScreenBackground(ctx, w, h, title);

    const planAlpha = 1 - clamp01(actionPlanFade);
    if (planAlpha > 0.01) this.drawActionPlan(actionPlanReveal, planAlpha);

    const boxW = 380;
    const boxH = 110;
    const gap = 60;
    const boxY = 140;
    const startX = 90;
    const boxRects = IMPROVE_STAGE_LABELS.map((_, i) => ({ x: startX + i * (boxW + gap), y: boxY, w: boxW, h: boxH }));

    // Recepção e Liberação — reaparecem exatamente como na Fase 2, sem drama.
    for (const i of [0, 2]) {
      const progress = clamp01(boxReveal - i);
      if (progress <= 0) continue;
      const rect = boxRects[i];
      drawBox(ctx, rect.x, rect.y + (1 - progress) * 16, rect.w, rect.h, { letter: '', word: IMPROVE_STAGE_LABELS[i] }, progress, COLOR_CORP_BLUE);
    }

    // O nó do meio — primeiro reaparece no estado antigo (vermelho, o
    // gargalo), depois é riscado por um X e desaparece, dando lugar à caixa
    // de automação verde-ciano brilhante.
    const bRect = boxRects[IMPROVE_BOTTLENECK_INDEX];
    const boxProgress = clamp01(boxReveal - IMPROVE_BOTTLENECK_INDEX);
    const oldBoxAlpha = boxProgress * (1 - destroyProgress);
    if (oldBoxAlpha > 0.01) {
      drawBox(ctx, bRect.x, bRect.y, bRect.w, bRect.h, { letter: '', word: IMPROVE_STAGE_LABELS[IMPROVE_BOTTLENECK_INDEX] }, oldBoxAlpha, COLOR_CORP_RED, false, true);
    }
    // O X risca e marca a destruição, mas precisa sumir assim que a
    // automação assume o lugar — senão fica um X vermelho preso pra sempre
    // em cima da caixa verde nova, como se ela também estivesse marcada.
    const destroyMarkAlpha = destroyProgress * (1 - automationReveal);
    if (destroyMarkAlpha > 0.01) this.drawDestroyMark(bRect, destroyProgress, destroyMarkAlpha);
    if (automationReveal > 0) this.drawAutomationBox(bRect, automationReveal, t);

    // Setas ortogonais — sempre neutras, o fluxo em si nunca foi o problema.
    for (let i = 0; i < IMPROVE_STAGE_LABELS.length - 1; i++) {
      const p1 = clamp01(boxReveal - i);
      const p2 = clamp01(boxReveal - (i + 1));
      if (p1 <= 0 || p2 <= 0) continue;
      const a = boxRects[i];
      const b = boxRects[i + 1];
      drawArrow(ctx, a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, Math.min(p1, p2));
    }

    if (boxReveal > 0) this.drawLeadTimeLadder(boxRects, ladderCrush);

    this.texture.needsUpdate = true;
  }

  // Escala "Enterprise" (rodada de legibilidade): fonte quase 2x maior que a
  // entrega original, caixas mais altas e mais largas pra acomodar o texto
  // sem cortar nem espremer — o usuário só aprova texto legível a 1m de tela.
  private drawActionPlan(reveal: number, screenAlpha: number): void {
    const ctx = this.ctx;
    const labelX = 90;
    const labelW = 320;
    const textX = 450;
    const textW = 1060;
    const startY = 165;
    const rowH = 180;
    const rowBoxH = 155;

    for (let i = 0; i < FIVE_W2H_ROWS.length; i++) {
      const progress = clamp01(reveal - i);
      if (progress <= 0) continue;
      const row = FIVE_W2H_ROWS[i];
      const y = startY + i * rowH + (1 - progress) * 16;

      ctx.save();
      ctx.globalAlpha = screenAlpha * progress;
      ctx.fillStyle = 'rgba(59,130,246,0.16)';
      ctx.fillRect(labelX, y, labelW, rowBoxH);
      ctx.strokeStyle = COLOR_CORP_BLUE;
      ctx.lineWidth = 3;
      ctx.strokeRect(labelX, y, labelW, rowBoxH);
      ctx.fillStyle = COLOR_CORP_CYAN;
      ctx.font = '800 34px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.label, labelX + labelW / 2, y + rowBoxH / 2);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '700 36px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      wrapText(ctx, row.text, textX, y + rowBoxH / 2 - 22, textW, 46);
      ctx.restore();
    }
  }

  private drawDestroyMark(rect: { x: number; y: number; w: number; h: number }, progress: number, alpha: number): void {
    const ctx = this.ctx;
    const pad = 16;
    const x1 = rect.x + pad;
    const y1 = rect.y + pad;
    const x2 = rect.x + rect.w - pad;
    const y2 = rect.y + rect.h - pad;
    // Cada braço do X "risca" progressivamente, do início ao ponto atual —
    // mesma técnica de revelação por interpolação usada na escada.
    ctx.save();
    ctx.globalAlpha = clamp01(progress * 1.5) * alpha;
    ctx.strokeStyle = COLOR_CORP_RED;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const drawArm = (ax: number, ay: number, bx: number, by: number) => {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(THREE.MathUtils.lerp(ax, bx, progress), THREE.MathUtils.lerp(ay, by, progress));
      ctx.stroke();
    };
    drawArm(x1, y1, x2, y2);
    drawArm(x2, y1, x1, y2);
    ctx.restore();
  }

  private drawAutomationBox(rect: { x: number; y: number; w: number; h: number }, alpha: number, t: number): void {
    const ctx = this.ctx;
    const pulse = 0.85 + 0.15 * Math.sin(t * 3);
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.shadowColor = COLOR_CORP_GREEN;
    ctx.shadowBlur = 30 * pulse;
    ctx.fillStyle = 'rgba(52,211,153,0.16)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = COLOR_CORP_GREEN;
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLOR_CORP_GREEN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 20px "Courier New", monospace';
    const words = AUTOMATION_LABEL.split(' / ');
    ctx.fillText(words[0], rect.x + rect.w / 2, rect.y + rect.h / 2 - 14);
    ctx.fillText(words[1], rect.x + rect.w / 2, rect.y + rect.h / 2 + 14);
    ctx.restore();
  }

  private drawLeadTimeLadder(boxRects: { x: number; y: number; w: number; h: number }[], crush: number): void {
    const ctx = this.ctx;
    const lowY = 430;
    const peakY = THREE.MathUtils.lerp(310, lowY, crush);
    const peakColor = lerpColor(COLOR_CORP_RED, COLOR_CORP_GREEN, crush);
    const [r0, r1, r2] = boxRects;
    const points: { x: number; y: number; color: string }[] = [
      { x: r0.x, y: lowY, color: COLOR_CORP_BLUE },
      { x: r0.x + r0.w, y: lowY, color: COLOR_CORP_BLUE },
      { x: r1.x, y: peakY, color: peakColor },
      { x: r1.x + r1.w, y: peakY, color: peakColor },
      { x: r2.x, y: lowY, color: COLOR_CORP_BLUE },
      { x: r2.x + r2.w, y: lowY, color: COLOR_CORP_BLUE },
    ];

    ctx.save();
    ctx.lineWidth = 3;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    // Rótulo cruza de "42H — NON-VALUE ADDED" pra "PROCESSO INSTANTÂNEO
    // (API)" no meio do esmagamento — não é um corte seco, é um crossfade.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 18px "Courier New", monospace';
    const oldLabelAlpha = clamp01(1 - crush * 2);
    const newLabelAlpha = clamp01(crush * 2 - 1);
    if (oldLabelAlpha > 0.01) {
      ctx.globalAlpha = oldLabelAlpha;
      ctx.fillStyle = COLOR_CORP_RED;
      ctx.textBaseline = 'bottom';
      ctx.fillText('42H — NON-VALUE ADDED', r1.x + r1.w / 2, peakY - 12);
    }
    if (newLabelAlpha > 0.01) {
      ctx.globalAlpha = newLabelAlpha;
      ctx.fillStyle = COLOR_CORP_GREEN;
      ctx.textBaseline = 'top';
      ctx.fillText('PROCESSO INSTANTÂNEO (API)', r1.x + r1.w / 2, peakY + 14);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOR_CORP_BLUE;
    ctx.textBaseline = 'top';
    ctx.fillText('2 MIN — VALUE ADDED', r0.x + r0.w / 2, lowY + 14);
    ctx.fillText('2 MIN — VALUE ADDED', r2.x + r2.w / 2, lowY + 14);
    ctx.restore();
  }
}

// ── Pareto + Ishikawa — Fase 3 (Analyze) ────────────────────────────────────
// Mesmo vocabulário visual das telas anteriores. Duas ferramentas na mesma
// tela: o Pareto isola QUAL causa pesa mais (triagem estatística), o Ishikawa
// mostra COMO a IA chegou lá (varredura das 6 famílias de causa até travar na
// raiz). O Pareto encolhe (paretoFade) enquanto o Ishikawa se monta
// (ishikawaFrame) — troca dentro da MESMA tela, não é um crossfade de mesh
// como o de SIPOC→VSM (aqui as duas ferramentas cabem lado a lado na mesma
// história, então a transição é interna ao canvas).
interface ParetoCategory {
  label: string;
  pct: number; // % do total de atraso atribuído a esta causa (soma = 100)
}

const PARETO_CATEGORIES: ParetoCategory[] = [
  { label: 'APROVAÇÃO MANUAL', pct: 68 },
  { label: 'FALTA DE INFO. DO CLIENTE', pct: 12 },
  { label: 'ERRO DE CADASTRO', pct: 8 },
  { label: 'SISTEMA FORA DO AR', pct: 6 },
  { label: 'DOCUMENTAÇÃO INCOMPLETA', pct: 4 },
  { label: 'OUTROS', pct: 2 },
];

interface IshikawaBone {
  label: string;
  side: 'top' | 'bottom';
  boneX: number; // ponto de encontro da espinha com a coluna central
  scanOrder: number; // ordem em que o scanner varre esta espinha — MÉTODO é a última (a causa raiz)
  rootCause: boolean;
}

const ISHIKAWA_BONES: IshikawaBone[] = [
  { label: 'MÃO DE OBRA', side: 'top', boneX: 360, scanOrder: 0, rootCause: false },
  { label: 'MEDIDA', side: 'bottom', boneX: 480, scanOrder: 1, rootCause: false },
  { label: 'MÁQUINA', side: 'top', boneX: 600, scanOrder: 2, rootCause: false },
  { label: 'MEIO AMBIENTE', side: 'bottom', boneX: 720, scanOrder: 3, rootCause: false },
  { label: 'MATERIAL', side: 'top', boneX: 840, scanOrder: 4, rootCause: false },
  { label: 'MÉTODO', side: 'bottom', boneX: 960, scanOrder: 5, rootCause: true },
];
const ISHIKAWA_SPINE_Y = 460;
const ISHIKAWA_HEAD_X = 1350; // caixa da cabeça (250px de largura) precisa caber nos 1600px do canvas

class AnalyzeScreen {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1600;
    this.canvas.height = 900;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.render(0, 0, 0, 0, 0, 0);
  }

  update(paretoReveal: number, paretoHighlight: number, paretoFade: number, ishikawaFrame: number, ishikawaScan: number, t: number): void {
    this.render(paretoReveal, paretoHighlight, paretoFade, ishikawaFrame, ishikawaScan, t);
  }

  private render(paretoReveal: number, paretoHighlight: number, paretoFade: number, ishikawaFrame: number, ishikawaScan: number, t: number): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    drawScreenBackground(ctx, w, h, 'ANALYZE — CAUSA RAIZ DO GARGALO');

    const paretoAlpha = 1 - clamp01(paretoFade);
    if (paretoAlpha > 0.01) this.drawPareto(paretoReveal, paretoHighlight, paretoAlpha, t);
    if (ishikawaFrame > 0) this.drawIshikawa(ishikawaFrame, ishikawaScan, t);

    this.texture.needsUpdate = true;
  }

  private drawPareto(reveal: number, highlight: number, screenAlpha: number, t: number): void {
    const ctx = this.ctx;
    const chartX = 130;
    const chartRight = 1420;
    const baseY = 800;
    const topY = 140;
    const maxBarH = baseY - topY;
    const n = PARETO_CATEGORIES.length;
    const barGap = 24;
    const barW = (chartRight - chartX - barGap * (n - 1)) / n;

    ctx.save();
    ctx.globalAlpha = screenAlpha;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 22px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('GRÁFICO DE PARETO — CAUSAS DO ATRASO (REGRA 80/20)', chartX, topY - 70);

    // Eixo esquerdo (frequência, implícito nas barras) e eixo direito
    // (% acumulada) — as duas escalas compartilham o mesmo espaço vertical
    // porque as categorias já estão em % do total, o que faz os dois eixos
    // baterem ponto a ponto.
    ctx.strokeStyle = COLOR_CORP_GRAY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartX, baseY);
    ctx.lineTo(chartRight, baseY);
    ctx.stroke();

    ctx.font = '600 14px "Courier New", monospace';
    ctx.fillStyle = COLOR_CORP_GRAY;
    ctx.textAlign = 'left';
    for (let pct = 0; pct <= 100; pct += 20) {
      const y = baseY - (pct / 100) * maxBarH;
      ctx.globalAlpha = screenAlpha * 0.5;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
      ctx.globalAlpha = screenAlpha;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, chartRight + 12, y);
    }

    let cumPct = 0;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const progress = clamp01(reveal - i);
      const cat = PARETO_CATEGORIES[i];
      const x = chartX + i * (barW + barGap);
      const barH = (cat.pct / 100) * maxBarH * progress;
      const isFirst = i === 0;
      const barLit = isFirst && highlight > 0;
      const pulse = barLit ? 0.75 + 0.25 * Math.sin(t * 4) : 1;

      if (progress > 0) {
        ctx.save();
        ctx.globalAlpha = screenAlpha * progress * pulse;
        ctx.fillStyle = barLit ? 'rgba(239,68,68,0.55)' : 'rgba(59,130,246,0.6)';
        ctx.strokeStyle = barLit ? COLOR_CORP_RED : COLOR_CORP_BLUE;
        ctx.lineWidth = barLit ? 3 : 2;
        ctx.fillRect(x, baseY - barH, barW, barH);
        ctx.strokeRect(x, baseY - barH, barW, barH);

        ctx.fillStyle = barLit ? COLOR_CORP_RED : '#cbd5e1';
        ctx.font = '700 13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Rótulo em duas linhas, curto o bastante pra caber na largura da barra.
        const words = cat.label.split(' ');
        const mid = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, mid).join(' '), x + barW / 2, baseY + 32);
        ctx.fillText(words.slice(mid).join(' '), x + barW / 2, baseY + 48);
        ctx.restore();
      }

      cumPct += cat.pct;
      points.push({ x: x + barW / 2, y: baseY - (cumPct / 100) * maxBarH * progress });
    }

    // Linha de % acumulada — só liga pontos cujas barras já apareceram.
    ctx.save();
    ctx.strokeStyle = COLOR_CORP_CYAN;
    ctx.fillStyle = COLOR_CORP_CYAN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      if (clamp01(reveal - i) <= 0) break;
      const p = points[i];
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    if (started) ctx.stroke();
    for (let i = 0; i < n; i++) {
      if (clamp01(reveal - i) <= 0) break;
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Destaque da Regra 80/20 — só depois que todas as barras já apareceram.
    if (highlight > 0 && points.length > 0) {
      const p0 = points[0];
      ctx.save();
      ctx.globalAlpha = screenAlpha * clamp01(highlight);
      ctx.strokeStyle = COLOR_CORP_RED;
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLOR_CORP_RED;
      ctx.font = '800 20px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('68% — REGRA 80/20', p0.x + 20, p0.y - 10);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawIshikawa(frame: number, scan: number, t: number): void {
    const ctx = this.ctx;
    const spineStartX = 150;
    const spineEndX = ISHIKAWA_HEAD_X - 40;
    const drawX = spineStartX + (spineEndX - spineStartX) * clamp01(frame);

    ctx.save();
    ctx.globalAlpha = clamp01(frame * 2); // entra rápido, satura em meio segundo de progresso

    // Espinha central — seta grossa apontando pra "cabeça" (o problema).
    ctx.strokeStyle = COLOR_CORP_BLUE;
    ctx.fillStyle = COLOR_CORP_BLUE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(spineStartX, ISHIKAWA_SPINE_Y);
    ctx.lineTo(drawX, ISHIKAWA_SPINE_Y);
    ctx.stroke();

    // Cabeça (o problema) — só aparece quando a espinha já quase terminou.
    if (frame > 0.6) {
      const headAlpha = clamp01((frame - 0.6) / 0.4);
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * headAlpha;
      drawBox(ctx, ISHIKAWA_HEAD_X - 40, ISHIKAWA_SPINE_Y - 55, 250, 110, { letter: '', word: 'LEAD TIME > 42H' }, 1, COLOR_CORP_RED, true, true);
      ctx.beginPath();
      ctx.moveTo(spineEndX, ISHIKAWA_SPINE_Y);
      ctx.lineTo(ISHIKAWA_HEAD_X - 40, ISHIKAWA_SPINE_Y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    if (frame < 0.9) return; // espinha ainda formando — cedo demais pras costelas aparecerem

    // Scanner — barra vertical translúcida varrendo da esquerda pra direita,
    // como uma rede neural percorrendo os nós até travar na causa raiz.
    const scanClamped = clamp01(scan / ISHIKAWA_BONES.length);
    if (scan < ISHIKAWA_BONES.length) {
      const scanX = THREE.MathUtils.lerp(300, 1050, scanClamped);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = COLOR_CORP_CYAN;
      ctx.fillRect(scanX - 3, 120, 6, 700);
      ctx.restore();
    }

    for (const bone of ISHIKAWA_BONES) {
      const boneProgress = clamp01(scan - bone.scanOrder);
      if (boneProgress <= 0) continue;
      const beingScannedNow = scan > bone.scanOrder && scan < bone.scanOrder + 1;
      const settledColor = bone.rootCause ? COLOR_CORP_RED : COLOR_CORP_GRAY;
      const color = beingScannedNow ? COLOR_CORP_CYAN : settledColor;
      const pulse = bone.rootCause && boneProgress >= 1 ? 0.7 + 0.3 * Math.sin(t * 5) : 1;

      const dir = bone.side === 'top' ? -1 : 1;
      const labelX = bone.boneX - 130;
      const labelY = ISHIKAWA_SPINE_Y + dir * 150;
      const endX = THREE.MathUtils.lerp(bone.boneX, labelX, boneProgress);
      const endY = THREE.MathUtils.lerp(ISHIKAWA_SPINE_Y, labelY, boneProgress);

      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = bone.rootCause && boneProgress >= 1 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(bone.boneX, ISHIKAWA_SPINE_Y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (boneProgress >= 1) {
        ctx.fillStyle = color;
        ctx.font = `${bone.rootCause ? '800 20px' : '700 16px'} "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = bone.side === 'top' ? 'bottom' : 'top';
        ctx.fillText(bone.label, labelX, labelY + (bone.side === 'top' ? -8 : 8));

        // Sub-texto de diagnóstico — só na causa raiz, só quando ela já travou.
        if (bone.rootCause) {
          ctx.font = '700 14px "Courier New", monospace';
          ctx.fillText('FALTA DE AUTOMAÇÃO /', labelX, labelY + (bone.side === 'top' ? -32 : 32));
          ctx.fillText('PROCESSO MANUAL', labelX, labelY + (bone.side === 'top' ? -50 : 50));
        }
      }
      ctx.restore();
    }
  }
}

// ── Carta de Controle (SPC) — Fase 5 (Control) ──────────────────────────────
// Fecha o ciclo DMAIC: prova que a melhoria da Fase 4 é estatisticamente
// estável, não sorte de um dia bom. Mesmo vocabulário visual das telas
// anteriores (drawScreenBackground, eixos com ctx.lineTo, pontos com
// ctx.arc). As duas séries (antes/depois) usam a MESMA escala vertical de
// propósito — é isso que faz a redução de variabilidade saltar aos olhos.
const CONTROL_PRE_DATA = [42, 58, 33, 71, 25, 60, 20, 85, 38, 92, 48, 30, 65, 55, 40];
const CONTROL_POST_DATA = [15, 13, 16, 14, 15.5, 13.5, 14.5, 16, 13, 15, 14, 15.5, 14.5, 13.5, 14.5];
const CONTROL_PRE_UCL = 80;
const CONTROL_PRE_MEAN = 48;
const CONTROL_PRE_LCL = 16;
const CONTROL_POST_UCL = 19;
const CONTROL_POST_MEAN = 14.5; // mesmo número do "Novo Lead Time" da Fase 4 — a prova bate com a promessa
const CONTROL_POST_LCL = 10;
const CONTROL_MAX_VALUE = 100;

// Bloco didático — usuário pediu que a Carta de Controle se EXPLIQUE, não só
// se prove. Fica ao lado do gráfico (por isso o gráfico encolheu de largura).
const CONTROL_EXPLANATION_TITLE = 'O QUE É ISSO?';
const CONTROL_EXPLANATION_BODY =
  'A Carta de Controle (SPC) garante a estabilidade. O LSC (Limite Superior) e o LIC (Limite Inferior) representam a variação natural tolerada. Pontos dentro dessa faixa provam que o processo não voltará a falhar.';

// Termo de Encerramento — o fechamento formal que uma consultoria de verdade
// sempre entrega: não basta provar o resultado, é preciso documentar o
// handover. Substitui o gráfico no fim da fase (120-140s) e reina absoluto
// até o loop reiniciar — o carimbo verde fica na tela até o último segundo.
interface ClosureEntry {
  label: string;
  text: string;
}
const CLOSURE_ENTRIES: ClosureEntry[] = [
  { label: 'ENTREGA 1', text: 'Automação n8n implementada e documentada.' },
  { label: 'ENTREGA 2', text: 'Lead Time reduzido de 42h para 14min.' },
  { label: 'ENTREGA 3', text: 'Setup de monitoramento via IA ativo.' },
  { label: 'RESULTADO FINAL', text: 'Economia validada de R$ 1,2M/ano.' },
];

class ControlScreen {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1600;
    this.canvas.height = 900;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.render(0, 0, 0, 0, 0, 0, 0);
  }

  update(
    axesReveal: number,
    historyReveal: number,
    shiftProgress: number,
    futureReveal: number,
    explanationReveal: number,
    chartMinimize: number,
    closureReveal: number,
  ): void {
    this.render(axesReveal, historyReveal, shiftProgress, futureReveal, explanationReveal, chartMinimize, closureReveal);
  }

  private render(
    axesReveal: number,
    historyReveal: number,
    shiftProgress: number,
    futureReveal: number,
    explanationReveal: number,
    chartMinimize: number,
    closureReveal: number,
  ): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const title = closureReveal > 0.5 ? 'CONTROL — TERMO DE ENCERRAMENTO DE PROJETO' : 'CONTROL — CARTA DE CONTROLE (SPC)';
    drawScreenBackground(ctx, w, h, title);

    // O gráfico (+ o bloco didático ao lado) encolhe e some sob uma "cortina"
    // da cor de fundo conforme chartMinimize avança — dá lugar ao Termo de
    // Encerramento sem precisar remultiplicar alpha através de métodos que já
    // gerenciam a própria opacidade internamente (mais seguro que compor
    // globalAlpha aninhado, que NÃO multiplica sozinho no Canvas2D).
    const shrink = clamp01(chartMinimize);
    if (axesReveal > 0 && shrink < 0.999) {
      ctx.save();
      const scale = THREE.MathUtils.lerp(1, 0.82, shrink);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      this.drawChart(axesReveal, historyReveal, shiftProgress, futureReveal);
      this.drawExplanationPanel(explanationReveal);
      ctx.restore();

      if (shrink > 0.01) {
        ctx.save();
        ctx.globalAlpha = shrink;
        ctx.fillStyle = COLOR_CORP_BG;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    if (closureReveal > 0) this.drawClosureReport(closureReveal);

    this.texture.needsUpdate = true;
  }

  private drawChart(axesReveal: number, historyReveal: number, shiftProgress: number, futureReveal: number): void {
    const ctx = this.ctx;
    const chartX = 100;
    const chartRight = 830; // ~46% da largura — o resto vai pro bloco didático, agora bem maior (pedido de legibilidade)
    const topY = 140;
    const baseY = 800;
    const n = CONTROL_PRE_DATA.length + CONTROL_POST_DATA.length;
    const stepX = (chartRight - chartX) / (n - 1);
    const valueToY = (v: number) => baseY - (v / CONTROL_MAX_VALUE) * (baseY - topY);

    ctx.save();
    ctx.globalAlpha = clamp01(axesReveal);
    ctx.strokeStyle = COLOR_CORP_GRAY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chartX, baseY);
    ctx.lineTo(chartRight, baseY);
    ctx.moveTo(chartX, topY - 20);
    ctx.lineTo(chartX, baseY);
    ctx.stroke();
    ctx.restore();

    // As 3 linhas de controle "despencam" da faixa larga (pré) pra faixa
    // estreita e baixa (pós) via shiftProgress — o recálculo ao vivo pedido.
    const uclY = valueToY(THREE.MathUtils.lerp(CONTROL_PRE_UCL, CONTROL_POST_UCL, shiftProgress));
    const meanY = valueToY(THREE.MathUtils.lerp(CONTROL_PRE_MEAN, CONTROL_POST_MEAN, shiftProgress));
    const lclY = valueToY(THREE.MathUtils.lerp(CONTROL_PRE_LCL, CONTROL_POST_LCL, shiftProgress));
    const bandColor = lerpColor(COLOR_CORP_GRAY, COLOR_CORP_GREEN, shiftProgress);

    ctx.save();
    ctx.globalAlpha = clamp01(axesReveal);
    ctx.strokeStyle = bandColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(chartX, uclY);
    ctx.lineTo(chartRight, uclY);
    ctx.moveTo(chartX, lclY);
    ctx.lineTo(chartRight, lclY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(chartX, meanY);
    ctx.lineTo(chartRight, meanY);
    ctx.stroke();

    ctx.font = '700 20px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = bandColor;
    ctx.textBaseline = 'bottom';
    ctx.fillText('LSC', chartRight + 10, uclY + 7);
    ctx.fillText('LIC', chartRight + 10, lclY + 7);
    ctx.textBaseline = 'middle';
    ctx.fillText('MÉDIA', chartRight + 10, meanY);
    ctx.restore();

    // Divisor entre as duas eras — só aparece quando os dados pós-intervenção
    // começam a entrar, marcando visualmente onde a Fase 4 (Improve) agiu.
    if (futureReveal > 0) {
      const dividerX = chartX + (CONTROL_PRE_DATA.length - 0.5) * stepX;
      ctx.save();
      ctx.globalAlpha = clamp01(futureReveal / 2);
      ctx.strokeStyle = COLOR_CORP_GREEN;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(dividerX, topY - 20);
      ctx.lineTo(dividerX, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '700 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLOR_CORP_GREEN;
      ctx.fillText('INTERVENÇÃO (IMPROVE)', dividerX, topY - 16);
      ctx.restore();
    }

    // Pontos históricos (pré-intervenção) — vermelho/cinza, alta oscilação,
    // alguns estourando o limite original.
    this.drawSeries(CONTROL_PRE_DATA, 0, stepX, chartX, valueToY, historyReveal, (v) => (v > CONTROL_PRE_UCL || v < CONTROL_PRE_LCL ? COLOR_CORP_RED : COLOR_CORP_GRAY));

    // Pontos atuais (pós-intervenção) — verde, estáveis ao redor da nova média.
    if (futureReveal > 0) {
      this.drawSeries(CONTROL_POST_DATA, CONTROL_PRE_DATA.length, stepX, chartX, valueToY, futureReveal, () => COLOR_CORP_GREEN);
    }
  }

  private drawSeries(
    data: number[],
    startIndex: number,
    stepX: number,
    chartX: number,
    valueToY: (v: number) => number,
    reveal: number,
    colorFor: (v: number) => string,
  ): void {
    const ctx = this.ctx;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < data.length; i++) {
      const progress = clamp01(reveal - i);
      if (progress <= 0) {
        prev = null;
        continue;
      }
      const x = chartX + (startIndex + i) * stepX;
      const y = valueToY(data[i]);
      const color = colorFor(data[i]);
      if (prev) {
        ctx.save();
        ctx.globalAlpha = progress;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      prev = { x, y };
    }
  }

  // Escala "Enterprise": bloco quase 50% mais largo e fonte bem maior — o
  // texto que explica a Carta de Controle precisa ser lido de longe, não
  // examinado de perto.
  private drawExplanationPanel(reveal: number): void {
    if (reveal <= 0.01) return;
    const ctx = this.ctx;
    const boxX = 890;
    const boxY = 150;
    const boxW = 640;
    const boxH = 560;

    ctx.save();
    ctx.globalAlpha = clamp01(reveal);
    ctx.fillStyle = 'rgba(15,23,42,0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = COLOR_CORP_CYAN;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = COLOR_CORP_CYAN;
    ctx.font = '800 36px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(CONTROL_EXPLANATION_TITLE, boxX + 32, boxY + 32);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '700 30px "Courier New", monospace';
    wrapText(ctx, CONTROL_EXPLANATION_BODY, boxX + 32, boxY + 100, boxW - 64, 44);
    ctx.restore();
  }

  // Escala "Enterprise": título, entregas e carimbo bem maiores — este é o
  // documento final que a pessoa lê pra fechar o projeto, não pode parecer
  // letra miúda de contrato.
  private drawClosureReport(reveal: number): void {
    const ctx = this.ctx;
    const cx = 800;

    // Título — "TERMO DE ENCERRAMENTO DE PROJETO" + subtítulo em inglês,
    // mesmo idioma bilíngue já usado nos outros painéis (ROOT CAUSE ANALYSIS,
    // FUTURE STATE SPECS etc.) — leitura de dashboard corporativo real.
    const titleAlpha = clamp01(reveal / 0.12);
    if (titleAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = titleAlpha;
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '800 46px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('TERMO DE ENCERRAMENTO DE PROJETO', cx, 108);
      ctx.fillStyle = COLOR_CORP_GRAY;
      ctx.font = '700 20px "Courier New", monospace';
      ctx.fillText('PROJECT CLOSURE REPORT', cx, 168);
      ctx.restore();
    }

    // As 4 entregas, uma de cada vez — mesmo padrão de revelação escalonada
    // usado em toda a cena (clamp01 por índice).
    const rowY = 235;
    const rowH = 108;
    const rowStagger = 0.13;
    for (let i = 0; i < CLOSURE_ENTRIES.length; i++) {
      const start = 0.18 + i * rowStagger;
      const progress = clamp01((reveal - start) / rowStagger);
      if (progress <= 0) continue;
      const entry = CLOSURE_ENTRIES[i];
      const y = rowY + i * rowH + (1 - progress) * 12;
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = COLOR_CORP_GREEN;
      ctx.font = '800 28px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`[${entry.label}]`, cx - 460, y);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '700 28px "Courier New", monospace';
      ctx.fillText(entry.text, cx - 460 + 370, y);
      ctx.restore();
    }

    // O carimbo final — pop de escala + leve rotação, o "selo" pedido, só
    // trava depois que as 4 entregas já apareceram. Imponente: quase o dobro
    // do tamanho original.
    const stampProgress = clamp01((reveal - 0.75) / 0.25);
    if (stampProgress > 0.01) {
      ctx.save();
      ctx.globalAlpha = stampProgress;
      ctx.translate(cx, 760);
      ctx.rotate(-0.08);
      const stampScale = THREE.MathUtils.lerp(1.3, 1, stampProgress);
      ctx.scale(stampScale, stampScale);
      ctx.fillStyle = 'rgba(52,211,153,0.14)';
      ctx.fillRect(-380, -75, 760, 150);
      ctx.strokeStyle = COLOR_CORP_GREEN;
      ctx.lineWidth = 6;
      ctx.strokeRect(-380, -75, 760, 150);
      ctx.fillStyle = COLOR_CORP_GREEN;
      ctx.font = '800 40px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PROJETO CONCLUÍDO', 0, -26);
      ctx.fillText('HANDOVER REALIZADO', 0, 30);
      ctx.restore();
    }
  }
}

// ── Project Charter (HTML, canto esquerdo) — digita ao vivo ────────────────
// Texto real no DOM (não textura) — mais nítido, e mais fácil de estilar como
// um documento de verdade. Cada campo digita em seu próprio horário, imitando
// um documento sendo preenchido automaticamente pela IA.
type CharterField = 'business' | 'scope' | 'ctq';
interface CharterLine {
  field: CharterField;
  text: string;
  startAt: number; // ms desde o início da fase Define
}

const CHARTER_SCRIPT: CharterLine[] = [
  { field: 'business', text: '4.502 pedidos travados. Prejuízo diário estimado: R$ 45.000.', startAt: 0 },
  { field: 'scope', text: 'Processo de Triagem (Setor B).', startAt: 6000 },
  { field: 'ctq', text: 'Reduzir Lead Time de 42h para < 2h.', startAt: 11000 },
];
const CHARTER_TYPE_SPEED_MS = 28;

class ProjectCharterHud {
  private readonly spans: Partial<Record<CharterField, HTMLElement>> = {};
  private startedAt = 0;

  constructor(root: HTMLElement | null) {
    if (!root) return;
    (['business', 'scope', 'ctq'] as const).forEach((field) => {
      const el = root.querySelector<HTMLElement>(`[data-field="${field}"] span`);
      if (el) this.spans[field] = el;
    });
  }

  start(): void {
    this.startedAt = performance.now();
    for (const field of Object.keys(this.spans) as CharterField[]) {
      this.spans[field]!.textContent = '';
    }
  }

  update(now: number): void {
    if (!this.startedAt) return;
    const elapsed = now - this.startedAt;
    for (const line of CHARTER_SCRIPT) {
      const span = this.spans[line.field];
      if (!span) continue;
      const localElapsed = elapsed - line.startAt;
      if (localElapsed < 0) continue;
      span.textContent = line.text.slice(0, Math.min(line.text.length, Math.floor(localElapsed / CHARTER_TYPE_SPEED_MS)));
    }
  }
}

// ── Baseline de Medição (HTML, canto esquerdo) — substitui o Project Charter
// quando a fase Measure começa; mesmo slot na tela, mesmo idioma de digitação
// ao vivo, só troca o conteúdo (documento de negócio → painel de métricas).
type BaselineField = 'leadtime' | 'sigma' | 'pce';
interface BaselineLine {
  field: BaselineField;
  text: string;
  startAt: number; // ms desde o início da fase Measure
}

const BASELINE_SCRIPT: BaselineLine[] = [
  { field: 'leadtime', text: '42h 15min (Alvo: < 2h)', startAt: 2000 },
  { field: 'sigma', text: '1.8σ — Crítico', startAt: 9000 },
  { field: 'pce', text: '2.4% (Process Cycle Efficiency)', startAt: 15000 },
];
const BASELINE_TYPE_SPEED_MS = 26;

class BaselineHud {
  private readonly spans: Partial<Record<BaselineField, HTMLElement>> = {};
  private startedAt = 0;

  constructor(root: HTMLElement | null) {
    if (!root) return;
    (['leadtime', 'sigma', 'pce'] as const).forEach((field) => {
      const el = root.querySelector<HTMLElement>(`[data-field="${field}"] span`);
      if (el) this.spans[field] = el;
    });
  }

  start(): void {
    this.startedAt = performance.now();
    for (const field of Object.keys(this.spans) as BaselineField[]) {
      this.spans[field]!.textContent = '';
    }
  }

  update(now: number): void {
    if (!this.startedAt) return;
    const elapsed = now - this.startedAt;
    for (const line of BASELINE_SCRIPT) {
      const span = this.spans[line.field];
      if (!span) continue;
      const localElapsed = elapsed - line.startAt;
      if (localElapsed < 0) continue;
      span.textContent = line.text.slice(0, Math.min(line.text.length, Math.floor(localElapsed / BASELINE_TYPE_SPEED_MS)));
    }
  }
}

// ── Root Cause Analysis (HTML, canto esquerdo) — substitui o Baseline quando
// a fase Analyze começa; mesmo slot, mesmo idioma de digitação ao vivo.
type RootCauseField = 'diagnostico' | 'regra8020' | 'causaraiz' | 'classificacao';
interface RootCauseLine {
  field: RootCauseField;
  text: string;
  startAt: number; // ms desde o início da fase Analyze
}

const ROOT_CAUSE_SCRIPT: RootCauseLine[] = [
  { field: 'diagnostico', text: 'IA Deep Learning concluído.', startAt: 1000 },
  { field: 'regra8020', text: '68% do atraso gerado por 1 única etapa.', startAt: 6000 },
  { field: 'causaraiz', text: 'Análise de Crédito Manual.', startAt: 11500 },
  { field: 'classificacao', text: 'Desperdício de Espera (Wait Time).', startAt: 16500 },
];
const ROOT_CAUSE_TYPE_SPEED_MS = 24;

class RootCauseHud {
  private readonly spans: Partial<Record<RootCauseField, HTMLElement>> = {};
  private startedAt = 0;

  constructor(root: HTMLElement | null) {
    if (!root) return;
    (['diagnostico', 'regra8020', 'causaraiz', 'classificacao'] as const).forEach((field) => {
      const el = root.querySelector<HTMLElement>(`[data-field="${field}"] span`);
      if (el) this.spans[field] = el;
    });
  }

  start(): void {
    this.startedAt = performance.now();
    for (const field of Object.keys(this.spans) as RootCauseField[]) {
      this.spans[field]!.textContent = '';
    }
  }

  update(now: number): void {
    if (!this.startedAt) return;
    const elapsed = now - this.startedAt;
    for (const line of ROOT_CAUSE_SCRIPT) {
      const span = this.spans[line.field];
      if (!span) continue;
      const localElapsed = elapsed - line.startAt;
      if (localElapsed < 0) continue;
      span.textContent = line.text.slice(0, Math.min(line.text.length, Math.floor(localElapsed / ROOT_CAUSE_TYPE_SPEED_MS)));
    }
  }
}

// ── Future State Specs (HTML, canto esquerdo) — substitui o Root Cause
// Analysis quando a fase Improve começa; mesmo slot, mesmo idioma de
// digitação ao vivo.
type FutureStateField = 'intervencao' | 'leadtime' | 'nva' | 'roi';
interface FutureStateLine {
  field: FutureStateField;
  text: string;
  startAt: number; // ms desde o início da fase Improve
}

const FUTURE_STATE_SCRIPT: FutureStateLine[] = [
  { field: 'intervencao', text: 'Roteamento Dinâmico (IA + n8n).', startAt: 1000 },
  { field: 'leadtime', text: '14min 30s (Redução de 99%).', startAt: 6000 },
  { field: 'nva', text: 'Eliminado.', startAt: 11000 },
  { field: 'roi', text: 'Economia de R$ 1,2M/ano.', startAt: 15500 },
];
const FUTURE_STATE_TYPE_SPEED_MS = 24;

class FutureStateHud {
  private readonly spans: Partial<Record<FutureStateField, HTMLElement>> = {};
  private startedAt = 0;

  constructor(root: HTMLElement | null) {
    if (!root) return;
    (['intervencao', 'leadtime', 'nva', 'roi'] as const).forEach((field) => {
      const el = root.querySelector<HTMLElement>(`[data-field="${field}"] span`);
      if (el) this.spans[field] = el;
    });
  }

  start(): void {
    this.startedAt = performance.now();
    for (const field of Object.keys(this.spans) as FutureStateField[]) {
      this.spans[field]!.textContent = '';
    }
  }

  update(now: number): void {
    if (!this.startedAt) return;
    const elapsed = now - this.startedAt;
    for (const line of FUTURE_STATE_SCRIPT) {
      const span = this.spans[line.field];
      if (!span) continue;
      const localElapsed = elapsed - line.startAt;
      if (localElapsed < 0) continue;
      span.textContent = line.text.slice(0, Math.min(line.text.length, Math.floor(localElapsed / FUTURE_STATE_TYPE_SPEED_MS)));
    }
  }
}

// ── Continuous Monitoring (HTML, canto esquerdo) — substitui o Future State
// Specs quando a fase Control começa; último painel do ciclo, mesmo slot,
// mesmo idioma de digitação ao vivo.
type ContinuousField = 'status' | 'sla' | 'sigma' | 'audit';
interface ContinuousLine {
  field: ContinuousField;
  text: string;
  startAt: number; // ms desde o início da fase Control
}

const CONTINUOUS_MONITORING_SCRIPT: ContinuousLine[] = [
  { field: 'status', text: 'Monitoramento Contínuo (Ativo).', startAt: 1000 },
  { field: 'sla', text: '99,98% (Estabilizado).', startAt: 6000 },
  { field: 'sigma', text: '6.0σ (World-Class).', startAt: 11000 },
  { field: 'audit', text: 'Automatizado via IA.', startAt: 15500 },
];
const CONTINUOUS_MONITORING_TYPE_SPEED_MS = 24;

class ContinuousMonitoringHud {
  private readonly spans: Partial<Record<ContinuousField, HTMLElement>> = {};
  private startedAt = 0;

  constructor(root: HTMLElement | null) {
    if (!root) return;
    (['status', 'sla', 'sigma', 'audit'] as const).forEach((field) => {
      const el = root.querySelector<HTMLElement>(`[data-field="${field}"] span`);
      if (el) this.spans[field] = el;
    });
  }

  start(): void {
    this.startedAt = performance.now();
    for (const field of Object.keys(this.spans) as ContinuousField[]) {
      this.spans[field]!.textContent = '';
    }
  }

  update(now: number): void {
    if (!this.startedAt) return;
    const elapsed = now - this.startedAt;
    for (const line of CONTINUOUS_MONITORING_SCRIPT) {
      const span = this.spans[line.field];
      if (!span) continue;
      const localElapsed = elapsed - line.startAt;
      if (localElapsed < 0) continue;
      span.textContent = line.text.slice(0, Math.min(line.text.length, Math.floor(localElapsed / CONTINUOUS_MONITORING_TYPE_SPEED_MS)));
    }
  }
}

// ── Log do sistema (HTML, canto direito) — terminal realista ────────────────
// Mesmo idioma do Project Charter (DOM real, não canvas) — o timestamp de
// cada linha já é o texto literal exibido, cronometrado pra "bater" com o
// instante real em que a linha aparece.
interface SystemLogLine {
  text: string;
  startAt: number;
}

// Cada fase tem seu próprio roteiro de log — start(script) troca o conteúdo
// e reseta o terminal, mesmo padrão de troca de conteúdo do BaselineHud acima.
const SYSTEM_LOG_SCRIPT_DEFINE: SystemLogLine[] = [
  { text: '[00.0s] [ERP_SYNC] Conectando ao SAP_HANA via API...', startAt: 0 },
  { text: '[05.2s] [DATA_MINING] Extraindo 1.2M logs de evento (30 dias).', startAt: 5200 },
  { text: '[10.8s] [AI_DIAGNOSTIC] Anomalia detectada: 68% do atraso concentrado no nó "Triagem_Manual".', startAt: 10800 },
  { text: '[15.0s] [DEFINE] SIPOC mapeado. Project Charter travado. Iniciando medição (Measure).', startAt: 15000 },
];
const SYSTEM_LOG_SCRIPT_MEASURE: SystemLogLine[] = [
  { text: '[20.0s] [VSM_MAPPING] Traçando Fluxo de Valor atual...', startAt: 0 },
  { text: '[25.5s] [TIME_TRACK] Calculando escada de Lead Time (Value vs Non-Value Added).', startAt: 5500 },
  { text: '[32.2s] [STATS_CORE] Plotando distribuição de frequência. Assimetria severa à direita (Long Tail) detectada.', startAt: 12200 },
  { text: '[38.0s] [MEASURE] Baseline estatístico travado. Avançando para fase de Análise de Causa Raiz (Analyze).', startAt: 18000 },
];
const SYSTEM_LOG_SCRIPT_ANALYZE: SystemLogLine[] = [
  { text: '[40.0s] [AI_ANALYZE] Aplicando algoritmo de clusterização nos logs de erro...', startAt: 0 },
  { text: '[44.5s] [PARETO_CALC] Regra 80/20 confirmada. Frequência vital isolada.', startAt: 4500 },
  { text: '[51.2s] [ISHIKAWA_GEN] Estruturando matriz de causa e efeito (6M)...', startAt: 11200 },
  { text: '[57.8s] [ROOT_CAUSE] Causa raiz isolada na ramificação "MÉTODO". Gargalo humano. Pronta para Intervenção (Improve).', startAt: 17800 },
];
const SYSTEM_LOG_SCRIPT_IMPROVE: SystemLogLine[] = [
  { text: '[60.0s] [IMPROVE] Iniciando simulação de Estado Futuro (VSM To-Be)...', startAt: 0 },
  { text: '[70.0s] [ACTION_PLAN] Matriz 5W2H gerada. Iniciando deploy das ações.', startAt: 10000 },
  { text: '[87.0s] [AUTOMATION] Substituindo nó manual por webhook n8n...', startAt: 27000 },
  { text: '[96.0s] [DEPLOY] Novo fluxo otimizado. Lead Time recalculado. Preparando Controle (Control).', startAt: 36000 },
];
const SYSTEM_LOG_SCRIPT_CONTROL: SystemLogLine[] = [
  { text: '[100.0s] [CONTROL] Inicializando Carta de Controle (I-MR) em tempo real...', startAt: 0 },
  { text: '[106.0s] [SPC_CALC] Plotando histórico (Pré-Intervenção). Variabilidade fora de controle estatístico.', startAt: 6000 },
  { text: '[112.0s] [STABILITY] Plotando dados atuais (Pós-Intervenção). Recalculando Limites de Controle (LSC/LIC).', startAt: 12000 },
  { text: '[123.0s] [HANDOVER] Gerando Termo de Encerramento Executivo. Transferência de governança concluída.', startAt: 23000 },
];
const SYSTEM_LOG_TYPE_SPEED_MS = 16;

class SystemLogHud {
  private script: SystemLogLine[] = [];
  private lines: HTMLElement[] = [];
  private startedAt = 0;

  constructor(private readonly container: HTMLElement | null) {}

  start(script: SystemLogLine[]): void {
    this.script = script;
    this.startedAt = performance.now();
    if (!this.container) return;
    this.container.innerHTML = '';
    this.lines = script.map(() => {
      const p = document.createElement('p');
      p.className = 'twin-logs-line';
      this.container!.appendChild(p);
      return p;
    });
  }

  update(now: number): void {
    if (!this.startedAt) return;
    const elapsed = now - this.startedAt;
    this.script.forEach((line, i) => {
      const localElapsed = elapsed - line.startAt;
      if (localElapsed < 0 || !this.lines[i]) return;
      this.lines[i].textContent = line.text.slice(0, Math.min(line.text.length, Math.floor(localElapsed / SYSTEM_LOG_TYPE_SPEED_MS)));
    });
  }
}

// ── Orquestrador ─────────────────────────────────────────────────────────
interface TwinState {
  sipocReveal: number; // 0→5 — quantas caixas do SIPOC já apareceram
  processZoom: number; // 0→1 — zoom analítico na caixa "Process"
  subReveal: number; // 0→3 — quantas sub-etapas do Process já apareceram
  sipocOpacity: number; // 1→0 — fade-out da tela SIPOC ao entrar em Measure
  measureOpacity: number; // 0→1 — fade-in da tela VSM/Histograma
  vsmBoxReveal: number; // 0→3 — quantas caixas do VSM já apareceram
  vsmLadderReveal: number; // 0→1 — progresso da escada de Lead Time (esquerda→direita)
  histogramReveal: number; // 0→9 — quantas barras do histograma já apareceram
  analyzeOpacity: number; // 0→1 — fade-in da tela Pareto/Ishikawa
  paretoReveal: number; // 0→6 — quantas barras do Pareto já apareceram
  paretoHighlight: number; // 0→1 — destaque da Regra 80/20 na 1ª barra
  paretoFade: number; // 0→1 — o Pareto encolhe pra dar lugar ao Ishikawa
  ishikawaFrame: number; // 0→1 — espinha + cabeça do Ishikawa se formando
  ishikawaScan: number; // 0→6 — scanner varrendo as 6 espinhas (Método é a última)
  improveOpacity: number; // 0→1 — fade-in da tela VSM To-Be
  actionPlanReveal: number; // 0→4 — quantas linhas do 5W2H já apareceram
  actionPlanFade: number; // 0→1 — o plano de ação encolhe pra dar lugar ao VSM To-Be
  improveBoxReveal: number; // 0→3 — quantas caixas do VSM To-Be já reapareceram
  destroyProgress: number; // 0→1 — o X que risca e apaga o nó manual
  automationReveal: number; // 0→1 — a caixa de automação verde-ciano entrando no lugar
  ladderCrush: number; // 0→1 — o pico vermelho de 42h sendo esmagado até virar linha verde
  controlOpacity: number; // 0→1 — fade-in da Carta de Controle
  controlAxesReveal: number; // 0→1 — eixos + bandas LSC/Média/LIC desenhando
  controlHistoryReveal: number; // 0→15 — pontos pré-intervenção aparecendo
  controlShiftProgress: number; // 0→1 — as bandas despencam e se estreitam
  controlFutureReveal: number; // 0→15 — pontos pós-intervenção aparecendo
  explanationReveal: number; // 0→1 — bloco didático explicando a Carta de Controle
  chartMinimize: number; // 0→1 — o gráfico encolhe pra dar lugar ao Termo de Encerramento
  closureReveal: number; // 0→1 — título + 4 entregas + carimbo do Termo de Encerramento
}

class DigitalTwinSimulation {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sipoc: SipocScreen;
  private readonly sipocMesh: THREE.Mesh;
  private readonly measure: MeasureScreen;
  private readonly measureMesh: THREE.Mesh;
  private readonly analyze: AnalyzeScreen;
  private readonly analyzeMesh: THREE.Mesh;
  private readonly improve: ImproveScreen;
  private readonly improveMesh: THREE.Mesh;
  private readonly control: ControlScreen;
  private readonly controlMesh: THREE.Mesh;
  private readonly charter: ProjectCharterHud;
  private readonly charterEl: HTMLElement | null;
  private readonly baseline: BaselineHud;
  private readonly baselineEl: HTMLElement | null;
  private readonly rootCause: RootCauseHud;
  private readonly rootCauseEl: HTMLElement | null;
  private readonly futureState: FutureStateHud;
  private readonly futureStateEl: HTMLElement | null;
  private readonly continuousMonitoring: ContinuousMonitoringHud;
  private readonly continuousMonitoringEl: HTMLElement | null;
  private readonly systemLog: SystemLogHud;
  private readonly hudLetters: HTMLElement[];
  private readonly hudCaption: HTMLElement | null;
  private timeline!: gsap.core.Timeline; // atribuída em buildTimeline() — precisa existir pra pause()/resume() (Fase 9)
  private rafId: number | null = null;
  private phase: TwinPhase = 'define';
  private readonly state: TwinState = {
    sipocReveal: 0,
    processZoom: 0,
    subReveal: 0,
    sipocOpacity: 1,
    measureOpacity: 0,
    vsmBoxReveal: 0,
    vsmLadderReveal: 0,
    histogramReveal: 0,
    analyzeOpacity: 0,
    paretoReveal: 0,
    paretoHighlight: 0,
    paretoFade: 0,
    ishikawaFrame: 0,
    ishikawaScan: 0,
    improveOpacity: 0,
    actionPlanReveal: 0,
    actionPlanFade: 0,
    improveBoxReveal: 0,
    destroyProgress: 0,
    automationReveal: 0,
    ladderCrush: 0,
    controlOpacity: 0,
    controlAxesReveal: 0,
    controlHistoryReveal: 0,
    controlShiftProgress: 0,
    controlFutureReveal: 0,
    explanationReveal: 0,
    chartMinimize: 0,
    closureReveal: 0,
  };

  constructor(mount: HTMLElement) {
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';
    mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, width / height, 0.1, 100);
    // Distância adaptativa (Fase 11) — antes era um "12" fixo, calibrado só
    // pra containers largos de desktop; agora se recalcula pra qualquer
    // proporção, inclusive celular em pé (ver computeCameraDistance acima).
    this.camera.position.set(0, 0.15, computeCameraDistance(CAMERA_FOV_DEG, width / height));
    this.camera.lookAt(0, 0.1, 0);

    // Iluminação neutra/fria — corporativa, não "neon sci-fi".
    const keyLight = new THREE.PointLight(0x3b82f6, 6, 40);
    keyLight.position.set(3, 4, 7);
    const fillLight = new THREE.PointLight(0x22d3ee, 3, 40);
    fillLight.position.set(-4, -2, 6);
    this.scene.add(keyLight, fillLight, new THREE.AmbientLight(0xffffff, 0.28));

    this.sipoc = new SipocScreen();
    this.sipocMesh = createScreenMesh(this.sipoc.texture, 0x3b82f6);
    this.sipocMesh.position.set(0, 0.25, 0);
    this.scene.add(this.sipocMesh);

    // Tela de Measure fica levemente atrás da SIPOC (mesma posição x/y) —
    // evita z-fighting das duas caixas de vidro durante o crossfade de 2s em
    // que ambas ficam parcialmente visíveis.
    this.measure = new MeasureScreen();
    this.measureMesh = createScreenMesh(this.measure.texture, 0x22d3ee);
    this.measureMesh.position.set(0, 0.25, -0.05);
    this.scene.add(this.measureMesh);

    // Mais uma camada atrás — mesma lógica de z-offset pra evitar z-fighting
    // durante o crossfade Measure→Analyze.
    this.analyze = new AnalyzeScreen();
    this.analyzeMesh = createScreenMesh(this.analyze.texture, 0xef4444);
    this.analyzeMesh.position.set(0, 0.25, -0.1);
    this.scene.add(this.analyzeMesh);

    // Mais uma camada atrás — mesma lógica de z-offset pra evitar z-fighting
    // durante o crossfade Analyze→Improve.
    this.improve = new ImproveScreen();
    this.improveMesh = createScreenMesh(this.improve.texture, 0x34d399);
    this.improveMesh.position.set(0, 0.25, -0.15);
    this.scene.add(this.improveMesh);

    // Última camada, mais atrás de todas — crossfade Improve→Control.
    this.control = new ControlScreen();
    this.controlMesh = createScreenMesh(this.control.texture, 0x22d3ee);
    this.controlMesh.position.set(0, 0.25, -0.2);
    this.scene.add(this.controlMesh);

    this.charterEl = mount.querySelector<HTMLElement>('.twin-charter-hud');
    this.baselineEl = mount.querySelector<HTMLElement>('.twin-baseline-hud');
    this.rootCauseEl = mount.querySelector<HTMLElement>('.twin-rootcause-hud');
    this.futureStateEl = mount.querySelector<HTMLElement>('.twin-futurestate-hud');
    this.continuousMonitoringEl = mount.querySelector<HTMLElement>('.twin-continuous-hud');
    this.charter = new ProjectCharterHud(this.charterEl);
    this.baseline = new BaselineHud(this.baselineEl);
    this.rootCause = new RootCauseHud(this.rootCauseEl);
    this.futureState = new FutureStateHud(this.futureStateEl);
    this.continuousMonitoring = new ContinuousMonitoringHud(this.continuousMonitoringEl);
    this.systemLog = new SystemLogHud(mount.querySelector<HTMLElement>('.twin-logs-lines'));

    this.hudLetters = Array.from(mount.querySelectorAll<HTMLElement>('.twin-dmaic-letters span'));
    this.hudCaption = mount.querySelector<HTMLElement>('.twin-dmaic-caption');

    this.buildTimeline();
    this.animate();

    window.addEventListener('resize', () => this.handleResize(mount));
  }

  private setPhase(phase: TwinPhase): void {
    this.phase = phase;
    this.updateHud(phase);
    if (phase === 'define') {
      this.charter.start();
      this.systemLog.start(SYSTEM_LOG_SCRIPT_DEFINE);
      this.setPanelOpacity(this.charterEl, 1);
      this.setPanelOpacity(this.baselineEl, 0);
      this.setPanelOpacity(this.rootCauseEl, 0);
      this.setPanelOpacity(this.futureStateEl, 0);
      this.setPanelOpacity(this.continuousMonitoringEl, 0);
    }
    if (phase === 'measure') {
      this.baseline.start();
      this.systemLog.start(SYSTEM_LOG_SCRIPT_MEASURE);
      this.setPanelOpacity(this.charterEl, 0);
      this.setPanelOpacity(this.baselineEl, 1);
    }
    if (phase === 'analyze') {
      this.rootCause.start();
      this.systemLog.start(SYSTEM_LOG_SCRIPT_ANALYZE);
      this.setPanelOpacity(this.baselineEl, 0);
      this.setPanelOpacity(this.rootCauseEl, 1);
    }
    if (phase === 'improve') {
      this.futureState.start();
      this.systemLog.start(SYSTEM_LOG_SCRIPT_IMPROVE);
      this.setPanelOpacity(this.rootCauseEl, 0);
      this.setPanelOpacity(this.futureStateEl, 1);
    }
    if (phase === 'control') {
      this.continuousMonitoring.start();
      this.systemLog.start(SYSTEM_LOG_SCRIPT_CONTROL);
      this.setPanelOpacity(this.futureStateEl, 0);
      this.setPanelOpacity(this.continuousMonitoringEl, 1);
    }
  }

  private setPanelOpacity(el: HTMLElement | null, opacity: number): void {
    if (el) el.style.opacity = String(opacity);
  }

  private updateHud(phase: TwinPhase): void {
    for (const el of this.hudLetters) {
      if (el.dataset.phase === phase) {
        el.classList.add('is-active');
        el.style.color = PHASE_COLOR[phase];
        el.style.textShadow = `0 0 14px ${PHASE_COLOR[phase]}88`;
      } else {
        el.classList.remove('is-active');
        el.style.color = '';
        el.style.textShadow = '';
      }
    }
    if (this.hudCaption) {
      const captions: Record<TwinPhase, string> = {
        define: 'DEFINE — Mapeando o processo (SIPOC)',
        measure: 'MEASURE — VSM + Histograma de Frequência',
        analyze: 'ANALYZE — Pareto + Ishikawa (Causa Raiz)',
        improve: 'IMPROVE — VSM To-Be (Automação n8n)',
        control: 'CONTROL — Carta de Controle (SPC)',
      };
      this.hudCaption.textContent = captions[phase];
      this.hudCaption.style.color = PHASE_COLOR[phase];
    }
  }

  // UMA gsap.timeline em loop dita só os valores escalares de estado — nunca
  // toca objetos Three.js/DOM diretamente. O rAF loop (animate) é quem lê
  // esse estado a cada quadro. Todo tween usa fromTo com valor inicial
  // explícito — lição da rodada anterior: qualquer campo tocado por mais de
  // uma fase PRECISA de reset explícito na fase Define, senão "vaza" o valor
  // do fim de um loop pro início do próximo.
  //
  // Loop total: 140s (rodada "respiro de leitura" — Define/Measure/Analyze
  // mantêm 20s cada, mas Improve e Control ganharam 40s cada, o dobro, pra
  // dar tempo de ler o 5W2H e o Termo de Encerramento com calma, sem pressa).
  // As 5 FASES do DMAIC (Define 0-20s, Measure 20-40s, Analyze 40-60s,
  // Improve 60-100s, Control 100-140s) estão todas construídas — o ciclo
  // fecha aqui e reinicia sozinho (gsap.timeline com repeat:-1), voltando
  // pro SIPOC da Define sem vazar nenhum traço ou valor de estado da volta
  // anterior (ver o `.set()` logo abaixo, que reseta TODO campo tocado por
  // mais de uma fase antes de a Define recomeçar a desenhar).
  private buildTimeline(): void {
    this.timeline = gsap.timeline({ repeat: -1 });
    const s = this.state;

    // ── DEFINE (0-20s) ──
    this.timeline
      .call(() => this.setPhase('define'), [], 0)
      // Reset explícito de todo campo que outras fases também tocam — senão
      // o valor final de uma volta "vaza" pro início da próxima (regra do
      // comentário acima).
      .set(
        s,
        {
          sipocOpacity: 1,
          measureOpacity: 0,
          vsmBoxReveal: 0,
          vsmLadderReveal: 0,
          histogramReveal: 0,
          analyzeOpacity: 0,
          paretoReveal: 0,
          paretoHighlight: 0,
          paretoFade: 0,
          ishikawaFrame: 0,
          ishikawaScan: 0,
          improveOpacity: 0,
          actionPlanReveal: 0,
          actionPlanFade: 0,
          improveBoxReveal: 0,
          destroyProgress: 0,
          automationReveal: 0,
          ladderCrush: 0,
          controlOpacity: 0,
          controlAxesReveal: 0,
          controlHistoryReveal: 0,
          controlShiftProgress: 0,
          controlFutureReveal: 0,
          explanationReveal: 0,
          chartMinimize: 0,
          closureReveal: 0,
        },
        0,
      )
      // 0-9s: as 5 caixas do SIPOC aparecem em sequência, conectadas.
      .fromTo(s, { sipocReveal: 0 }, { sipocReveal: 5, duration: 9, ease: 'power1.out' }, 0)
      // 10-16s: zoom analítico no "Process".
      .fromTo(s, { processZoom: 0 }, { processZoom: 1, duration: 6, ease: 'power2.inOut' }, 10)
      // 16-19.5s: as 3 sub-etapas aparecem, a do meio (Triagem Manual) em alerta.
      .fromTo(s, { subReveal: 0 }, { subReveal: 3, duration: 3.5, ease: 'power1.out' }, 16)

      // ── MEASURE (20-40s) ──
      .call(() => this.setPhase('measure'), [], 20)
      // 20-22s: crossfade das telas — a SIPOC "some suavemente" enquanto o
      // VSM/Histograma aparece no mesmo monitor.
      .fromTo(s, { sipocOpacity: 1 }, { sipocOpacity: 0, duration: 2, ease: 'power1.inOut' }, 20)
      .fromTo(s, { measureOpacity: 0 }, { measureOpacity: 1, duration: 2, ease: 'power1.inOut' }, 20)
      // 20-26s: as 3 caixas do VSM aparecem em sequência (Recepção → Análise
      // de Crédito Manual, o gargalo → Liberação).
      .fromTo(s, { vsmBoxReveal: 0 }, { vsmBoxReveal: 3, duration: 6, ease: 'power1.out' }, 20)
      // 24-30s: a escada de Lead Time se desenha da esquerda pra direita,
      // disparando e ficando vermelha sob o gargalo.
      .fromTo(s, { vsmLadderReveal: 0 }, { vsmLadderReveal: 1, duration: 6, ease: 'power2.inOut' }, 24)
      // 30-38s: o histograma cresce barra a barra — a prova estatística
      // (assimetria à direita) do que a escada já mostrou visualmente.
      .fromTo(s, { histogramReveal: 0 }, { histogramReveal: 9, duration: 8, ease: 'power1.out' }, 30)

      // ── ANALYZE (40-60s) ──
      .call(() => this.setPhase('analyze'), [], 40)
      // 40-42s: crossfade das telas — o VSM/Histograma sai, Pareto/Ishikawa entra.
      .fromTo(s, { measureOpacity: 1 }, { measureOpacity: 0, duration: 2, ease: 'power1.inOut' }, 40)
      .fromTo(s, { analyzeOpacity: 0 }, { analyzeOpacity: 1, duration: 2, ease: 'power1.inOut' }, 40)
      // 40-46s: as 6 barras do Pareto aparecem em ordem decrescente, com a
      // linha de % acumulada subindo junto.
      .fromTo(s, { paretoReveal: 0 }, { paretoReveal: 6, duration: 6, ease: 'power1.out' }, 40)
      // 46-49s: destaque da Regra 80/20 na barra "Aprovação Manual".
      .fromTo(s, { paretoHighlight: 0 }, { paretoHighlight: 1, duration: 3, ease: 'power1.out' }, 46)
      // 49-51s: o Pareto encolhe e o Ishikawa (espinha + cabeça) se forma.
      .fromTo(s, { paretoFade: 0 }, { paretoFade: 1, duration: 2, ease: 'power1.inOut' }, 49)
      .fromTo(s, { ishikawaFrame: 0 }, { ishikawaFrame: 1, duration: 2, ease: 'power1.out' }, 49)
      // 51-59s: o scanner varre as 6 famílias de causa (6M) — MÉTODO é a
      // última e trava em vermelho como a causa raiz.
      .fromTo(s, { ishikawaScan: 0 }, { ishikawaScan: 6, duration: 8, ease: 'power1.inOut' }, 51)

      // ── IMPROVE (60-100s, 40s) ── — dobrou de duração (rodada "respiro de
      // leitura"): a matriz 5W2H fica ESTÁTICA na tela por ~18s antes de dar
      // lugar ao VSM To-Be, tempo real pra ler as 4 linhas com calma.
      .call(() => this.setPhase('improve'), [], 60)
      // 60-62s: crossfade das telas — o Pareto/Ishikawa sai, o VSM To-Be entra.
      .fromTo(s, { analyzeOpacity: 1 }, { analyzeOpacity: 0, duration: 2, ease: 'power1.inOut' }, 60)
      .fromTo(s, { improveOpacity: 0 }, { improveOpacity: 1, duration: 2, ease: 'power1.inOut' }, 60)
      // 60-66s: a matriz 5W2H (What/Why/Who/How) aparece linha a linha —
      // o Plano de Ação antes da execução.
      .fromTo(s, { actionPlanReveal: 0 }, { actionPlanReveal: 4, duration: 6, ease: 'power1.out' }, 60)
      // 66-78s: HOLD — a matriz fica parada na tela, só pra leitura (nada de
      // novo acontece; é aqui que o "respiro" pedido mora de verdade).
      // 78-80s: com o plano "aprovado na tela", ele encolhe pra dar lugar ao VSM.
      .fromTo(s, { actionPlanFade: 0 }, { actionPlanFade: 1, duration: 2, ease: 'power1.inOut' }, 78)
      // 80-83s: as 3 caixas do VSM reaparecem — a do meio ainda no estado
      // antigo (vermelho, o gargalo), pra reconectar com o que já foi visto.
      .fromTo(s, { improveBoxReveal: 0 }, { improveBoxReveal: 3, duration: 3, ease: 'power1.out' }, 80)
      // 83-86s: a IA "arranca" o nó manual — um X vermelho risca a caixa até ela sumir.
      .fromTo(s, { destroyProgress: 0 }, { destroyProgress: 1, duration: 3, ease: 'power2.in' }, 83)
      // 86-89s: a automação entra no lugar, brilhando em verde-ciano.
      .fromTo(s, { automationReveal: 0 }, { automationReveal: 1, duration: 3, ease: 'power1.out' }, 86)
      // 89-97s: a escada é esmagada ao vivo — o pico vermelho de 42h desce
      // até virar uma linha rasteira e verde (o "processo instantâneo").
      // 97-100s: HOLD — a escada fica parada, já achatada e verde, antes do
      // corte pra Control.
      .fromTo(s, { ladderCrush: 0 }, { ladderCrush: 1, duration: 8, ease: 'power3.out' }, 89)

      // ── CONTROL (100-140s, 40s) ── — também dobrou de duração: o gráfico +
      // a explicação "O QUE É ISSO?" ficam visíveis por 20s inteiros antes do
      // Termo de Encerramento tomar conta da tela pelos 20s finais (e reinar
      // absoluto — o carimbo fica até o fim da fase, sem pressa nenhuma).
      .call(() => this.setPhase('control'), [], 100)
      // 100-102s: crossfade das telas — o VSM To-Be sai, a Carta de Controle entra.
      .fromTo(s, { improveOpacity: 1 }, { improveOpacity: 0, duration: 2, ease: 'power1.inOut' }, 100)
      .fromTo(s, { controlOpacity: 0 }, { controlOpacity: 1, duration: 2, ease: 'power1.inOut' }, 100)
      // 100-102.5s: eixos + bandas LSC/Média/LIC (estado "pré", largo) desenham.
      .fromTo(s, { controlAxesReveal: 0 }, { controlAxesReveal: 1, duration: 2.5, ease: 'power1.out' }, 100)
      // 101-104s: o bloco didático ("O QUE É ISSO?") aparece ao lado do gráfico.
      .fromTo(s, { explanationReveal: 0 }, { explanationReveal: 1, duration: 3, ease: 'power1.out' }, 101)
      // 102.5-108s: os 15 pontos históricos aparecem em sequência, com alta variabilidade.
      .fromTo(s, { controlHistoryReveal: 0 }, { controlHistoryReveal: 15, duration: 5.5, ease: 'power1.out' }, 102.5)
      // 108-109s: a banda despenca e se estreita — a prova de que o processo mudou.
      .fromTo(s, { controlShiftProgress: 0 }, { controlShiftProgress: 1, duration: 1, ease: 'power3.inOut' }, 108)
      // 109-114s: os pontos pós-intervenção aparecem, estáveis, ao redor da nova média.
      // 114-120s: HOLD — gráfico e explicação ficam parados, completos, só
      // pra leitura (os 20s de "processar a estabilização" pedidos).
      .fromTo(s, { controlFutureReveal: 0 }, { controlFutureReveal: 15, duration: 5, ease: 'power1.out' }, 109)
      // 120-122s: o gráfico + o bloco didático encolhem e somem.
      .fromTo(s, { chartMinimize: 0 }, { chartMinimize: 1, duration: 2, ease: 'power1.inOut' }, 120)
      // 122-127s: o Termo de Encerramento surge — título, as 4 entregas, e o
      // carimbo final "PROJETO CONCLUÍDO — HANDOVER REALIZADO".
      // 127-140s: HOLD — o Termo (com o carimbo) reina absoluto na tela até o
      // fim da fase, sem pressa nenhuma pra ler.
      .fromTo(s, { closureReveal: 0 }, { closureReveal: 1, duration: 5, ease: 'power1.out' }, 122)

      .set({}, {}, 140);
  }

  // Fase 9 — pausa/retoma a cena inteira quando ela sai/entra da viewport
  // (ver visibility-lifecycle.ts). Precisa parar as DUAS fontes de trabalho:
  // o rAF (renderer.render()/updates por quadro) E a timeline GSAP (que tem
  // seu próprio ticker interno e continuaria avançando o tempo mesmo sem
  // ninguém chamando animate()). `.pause()`/`.play()` do GSAP preservam a
  // posição exata da timeline — não reseta nem "pula" nada ao retomar.
  pause(): void {
    this.timeline.pause();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resume(): void {
    this.timeline.play();
    if (this.rafId === null) this.animate();
  }

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const t = now * 0.001;
    const s = this.state;

    this.sipoc.update(s.sipocReveal, s.processZoom, s.subReveal, t);
    this.measure.update(s.vsmBoxReveal, s.vsmLadderReveal, s.histogramReveal, t);
    this.analyze.update(s.paretoReveal, s.paretoHighlight, s.paretoFade, s.ishikawaFrame, s.ishikawaScan, t);
    this.improve.update(s.actionPlanReveal, s.actionPlanFade, s.improveBoxReveal, s.destroyProgress, s.automationReveal, s.ladderCrush, t);
    this.control.update(
      s.controlAxesReveal,
      s.controlHistoryReveal,
      s.controlShiftProgress,
      s.controlFutureReveal,
      s.explanationReveal,
      s.chartMinimize,
      s.closureReveal,
    );
    applyGroupOpacity(this.sipocMesh, s.sipocOpacity);
    applyGroupOpacity(this.measureMesh, s.measureOpacity);
    applyGroupOpacity(this.analyzeMesh, s.analyzeOpacity);
    applyGroupOpacity(this.improveMesh, s.improveOpacity);
    applyGroupOpacity(this.controlMesh, s.controlOpacity);
    this.charter.update(now);
    this.baseline.update(now);
    this.rootCause.update(now);
    this.futureState.update(now);
    this.continuousMonitoring.update(now);
    this.systemLog.update(now);

    // Câmera — respiração sutil, sem dolly dramático: uma sala de controle
    // corporativa precisa parecer estável, não cinematográfica.
    this.camera.position.x = Math.sin(t * 0.15) * 0.08;
    this.camera.position.y = 0.15 + Math.sin(t * 0.12 + 1) * 0.05;
    this.camera.lookAt(0, 0.1, 0);

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize(mount: HTMLElement): void {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // Recalcula a distância (não só o aspect) — importante no celular, onde
    // girar o aparelho troca retrato↔paisagem e muda MUITO a proporção.
    this.camera.position.z = computeCameraDistance(CAMERA_FOV_DEG, w / h);
    this.camera.updateProjectionMatrix();
  }
}

export function initDigitalTwin(mount: HTMLElement): void {
  if (!mount.clientWidth || !mount.clientHeight) return;
  const simulation = new DigitalTwinSimulation(mount);

  // Mesmo padrão do placeholder CSS de dashboard-3d.ts: fica no DOM, só some
  // visualmente agora que o 3D real está desenhando por cima.
  const fallback = mount.querySelector<HTMLElement>('.twin-visual-fallback');
  if (fallback) fallback.style.opacity = '0';

  // Fase 9 — a cena roda desde a construção acima (é rápido demais pra valer
  // a pena adiar o primeiro frame até o observer confirmar visibilidade), mas
  // pausa quase imediatamente se a seção já nasce fora da tela (comum, já que
  // fica mais abaixo na home) e sempre que o usuário rolar pra longe dela.
  observeVisibilityLifecycle(mount, {
    onVisible: () => simulation.resume(),
    onHidden: () => simulation.pause(),
  });
}
