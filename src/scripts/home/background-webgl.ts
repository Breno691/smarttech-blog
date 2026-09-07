// Fundo contínuo em shader GLSL, atrás da página inteira. Só desktop, via
// import() dinâmico atrás da checagem de device-capability (ver
// home-entry.ts) — chamado depois de initSmoothScroll(), pra já poder ler a
// velocidade do scroll (getScrollVelocity()) desde o primeiro quadro.

import * as THREE from 'three';
import { getScrollVelocity } from './smooth-scroll';

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

// Ruído "fumaça digital" bem sutil, tons quase-preto/roxo/verde escuro (mesma
// paleta da marca: --bg #06060e, --accent #7c3aed, e um verde escuro de apoio).
// u_scrollVelocity agita o ruído quando o usuário rola rápido.
const fragmentShader = /* glsl */ `
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

export function initBackgroundWebGL(): void {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '-1';
  canvas.style.pointerEvents = 'none';
  document.body.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.Camera(); // truque padrão de shader fullscreen — sem projeção 3D real

  const uniforms = {
    u_time: { value: 0 },
    u_scrollVelocity: { value: 0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  };

  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  // Só torna o body transparente depois que o shader confirma que está
  // rodando — se o WebGL falhar por qualquer motivo, o fundo escuro sólido
  // padrão (CSS) continua valendo, nunca fica uma tela quebrada/branca.
  document.documentElement.classList.add('webgl-bg-active');

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_scrollVelocity.value = getScrollVelocity();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
  });
}
