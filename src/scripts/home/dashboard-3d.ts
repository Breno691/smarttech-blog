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
      new THREE.Vector3(
        (Math.random() - 0.5) * 2.6,
        (Math.random() - 0.5) * 1.5,
        0.35 + Math.random() * 0.55,
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
  const NODE_CONNECT_DISTANCE = 1.3;
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
    nodeGroup.rotation.y += 0.0025;
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
