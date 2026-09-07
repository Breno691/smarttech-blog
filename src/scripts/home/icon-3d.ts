// Ícones 3D dos cards de serviço, com flutuação contínua em loop (Y-axis bobbing)
// e rotação lenta constante. Um único WebGLRenderer compartilhado (scissor test)
// para as 3 cenas, em vez de 3 contextos WebGL separados — mais leve e evita
// esbarrar no limite de contextos WebGL simultâneos do navegador.
//
// Só é carregado via import() dinâmico, junto com dashboard-3d.ts, atrás da
// mesma checagem de device-capability.ts (ver home-entry.ts).

import * as THREE from 'three';
import { gsap } from 'gsap';

const ICON_GEOMETRIES: Record<string, () => THREE.BufferGeometry> = {
  lean: () => new THREE.IcosahedronGeometry(1, 0),
  auto: () => new THREE.TorusKnotGeometry(0.65, 0.22, 100, 16),
  ti: () => new THREE.OctahedronGeometry(1, 0),
};

interface IconEntry {
  mount: HTMLElement;
  mesh: THREE.Mesh;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function initIcon3D(mounts: HTMLElement[]): void {
  if (!mounts.length) return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(true);

  const entries: IconEntry[] = mounts.map((mount) => {
    const scene = new THREE.Scene();
    const light = new THREE.PointLight(0xa78bfa, 6, 10);
    light.position.set(2, 2, 3);
    scene.add(light, new THREE.AmbientLight(0xffffff, 0.25));

    const key = mount.dataset.icon || 'lean';
    const geometry = (ICON_GEOMETRIES[key] || ICON_GEOMETRIES.lean)();
    const material = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
    camera.position.set(0, 0, 3);

    // Y-axis bobbing contínuo via GSAP
    gsap.to(mesh.position, { y: '+=0.18', duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    return { mount, mesh, scene, camera };
  });

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function animate() {
    requestAnimationFrame(animate);
    const dpr = renderer.getPixelRatio();

    for (const entry of entries) {
      entry.mesh.rotation.y += 0.006;
      entry.mesh.rotation.x += 0.002;

      const rect = entry.mount.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      if (!visible || rect.width === 0 || rect.height === 0) continue;

      const x = Math.round(rect.left * dpr);
      const yBottomUp = Math.round((window.innerHeight - rect.bottom) * dpr); // WebGL mede Y de baixo pra cima
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);

      renderer.setViewport(x, yBottomUp, w, h);
      renderer.setScissor(x, yBottomUp, w, h);
      entry.camera.aspect = rect.width / rect.height;
      entry.camera.updateProjectionMatrix();
      renderer.render(entry.scene, entry.camera);
    }
  }
  animate();
}
