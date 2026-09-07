// Cena Three.js do painel/dashboard flutuante da seção "Sistema", com GSAP
// ScrollTrigger girando/aproximando o painel conforme o usuário rola a página.
//
// Só é carregado via import() dinâmico, depois que device-capability.ts confirmar
// que o aparelho aguenta — nunca baixado em modo 'reduced' (ver home-entry.ts).

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  // O placeholder em CSS puro (Fase 2) fica por baixo, sem precisar remover do DOM —
  // só escondemos visualmente agora que o 3D real está desenhando por cima.
  const fallback = mount.querySelector<HTMLElement>('.system-visual-fallback');
  if (fallback) fallback.style.opacity = '0';

  window.addEventListener('resize', () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
}
