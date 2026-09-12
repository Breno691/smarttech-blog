// Fundo contínuo em shader GLSL, atrás da página inteira. Só desktop, via
// import() dinâmico atrás da checagem de device-capability (ver
// home-entry.ts) — chamado depois de initSmoothScroll(), pra já poder ler a
// velocidade do scroll (getScrollVelocity()) desde o primeiro quadro.
//
// 12/set/2026: reescrito de Three.js pra WebGL puro — o visual é idêntico
// (mesmo shader, pixel por pixel), só a "cola" que desenha o triângulo na
// tela mudou. Three.js inteiro (505KB) só pra desenhar um retângulo cheio de
// tela era o maior peso do site, maior que qualquer outra coisa.

import { getScrollVelocity } from './smooth-scroll';

const vertexShaderSrc = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Ruído "fumaça digital" bem sutil, tons quase-preto/roxo/verde escuro (mesma
// paleta da marca: --bg #06060e, --accent #7c3aed, e um verde escuro de apoio).
// u_scrollVelocity agita o ruído quando o usuário rola rápido.
const fragmentShaderSrc = `
  precision highp float;
  uniform float u_time;
  uniform float u_scrollVelocity;
  uniform vec2 u_resolution;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453123); }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float agitation = 1.0 + clamp(abs(u_scrollVelocity) * 0.15, 0.0, 2.5);

    vec2 p = uv * 2.4 + vec2(0.0, u_time * 0.02);
    float n = noise(p * 3.0 + u_time * 0.05 * agitation);
    n += 0.5 * noise(p * 6.0 - u_time * 0.03 * agitation);
    n *= 0.55;

    vec3 colorA = vec3(0.024, 0.024, 0.055); // --bg
    vec3 colorB = vec3(0.09, 0.05, 0.16);    // roxo escuro
    vec3 colorC = vec3(0.02, 0.07, 0.06);    // verde esverdeado escuro

    vec3 color = mix(colorA, colorB, smoothstep(0.3, 0.75, n));
    color = mix(color, colorC, smoothstep(0.55, 0.9, n) * 0.35);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

export function initBackgroundWebGL(): void {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  document.body.prepend(canvas);

  const gl = (canvas.getContext('webgl', { antialias: false }) ||
    canvas.getContext('experimental-webgl', { antialias: false })) as WebGLRenderingContext | null;
  // Sem WebGL disponível: o fundo escuro sólido padrão (CSS) continua
  // valendo, nunca fica tela quebrada/branca — mesma garantia de antes.
  if (!gl) return;

  const program = gl.createProgram()!;
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexShaderSrc));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc));
  gl.linkProgram(program);
  gl.useProgram(program);

  // Triângulo único cobrindo a tela toda (mais barato que 2 triângulos/quad,
  // mesmo resultado visual já que só o que cai dentro do viewport é pintado).
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, 'u_time');
  const uScrollVelocity = gl.getUniformLocation(program, 'u_scrollVelocity');
  const uResolution = gl.getUniformLocation(program, 'u_resolution');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(uResolution, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  document.documentElement.classList.add('webgl-bg-active');

  const start = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    gl!.uniform1f(uTime, (performance.now() - start) / 1000);
    gl!.uniform1f(uScrollVelocity, getScrollVelocity());
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }
  animate();
}
