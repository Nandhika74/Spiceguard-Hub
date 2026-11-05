import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SpiceGuard3DCanvasProps {
  progressPercentage: number;
}

export const SpiceGuard3DCanvas: React.FC<SpiceGuard3DCanvasProps> = ({
  progressPercentage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 220;

    // Scene setup
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.6, 5.2);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.2);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x34d399, 1.1);
    fillLight.position.set(-5, -2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xd96b1c, 1.5, 12);
    rimLight.position.set(2, 2, -3);
    scene.add(rimLight);

    // Composite 3D Group: SpiceGuard Spectral IoT Sensor & Turmeric Core
    const sensorGroup = new THREE.Group();
    scene.add(sensorGroup);

    // 1. Outer Brushed Forest-Green Anodized Ring (Primary Silhouette)
    const outerRingGeo = new THREE.TorusGeometry(1.25, 0.12, 24, 64);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: 0x164e33,
      metalness: 0.65,
      roughness: 0.28,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    sensorGroup.add(outerRing);

    // 2. Inner Copper/Turmeric Accent Ring (Secondary Read)
    const innerRingGeo = new THREE.TorusGeometry(0.95, 0.055, 20, 64);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0xc4540c,
      metalness: 0.75,
      roughness: 0.22,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 5;
    sensorGroup.add(innerRing);

    // 3. Central Spectral Core (Turmeric / Curcumin Molecular Sphere)
    const coreGeo = new THREE.IcosahedronGeometry(0.58, 3);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xe59824,
      emissive: 0x8a3b08,
      emissiveIntensity: 0.35,
      metalness: 0.2,
      roughness: 0.3,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    sensorGroup.add(coreMesh);

    // 4. Wireframe Spectral Scan Cage around Core
    const cageGeo = new THREE.IcosahedronGeometry(0.74, 1);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0x2b734c,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    sensorGroup.add(cageMesh);

    // 5. Orbiting Volatile Compound / Sensor Nodes
    const nodesGroup = new THREE.Group();
    sensorGroup.add(nodesGroup);

    const nodeGeo = new THREE.SphereGeometry(0.075, 16, 16);
    const nodeMatGreen = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    const nodeMatAmber = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });

    const nodeCount = 8;
    const nodes: { mesh: THREE.Mesh; angle: number; radius: number; speed: number; yOffset: number }[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const radius = 1.55 + (i % 2) * 0.22;
      const mesh = new THREE.Mesh(nodeGeo, i % 2 === 0 ? nodeMatGreen : nodeMatAmber);
      mesh.position.set(Math.cos(angle) * radius, Math.sin(angle * 2) * 0.25, Math.sin(angle) * radius);
      nodesGroup.add(mesh);
      nodes.push({
        mesh,
        angle,
        radius,
        speed: 0.35 + (i % 3) * 0.12,
        yOffset: (i % 2 === 0 ? 1 : -1) * 0.22,
      });
    }

    // Interactive pointer drag
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let targetRotX = 0.15;
    let targetRotY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      targetRotY += dx * 0.008;
      targetRotX = Math.max(-0.8, Math.min(0.8, targetRotX + dy * 0.008));
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Animation Loop
    const clock = new THREE.Clock();
    let animFrameId = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (!isDragging) {
        targetRotY += 0.004;
      }

      sensorGroup.rotation.y += (targetRotY - sensorGroup.rotation.y) * 0.08;
      sensorGroup.rotation.x += (targetRotX - sensorGroup.rotation.x) * 0.08;

      innerRing.rotation.z = elapsed * 0.35;
      cageMesh.rotation.y = -elapsed * 0.25;
      cageMesh.rotation.x = Math.sin(elapsed * 0.4) * 0.2;

      const pulse = 1 + Math.sin(elapsed * 2.2) * 0.035;
      coreMesh.scale.set(pulse, pulse, pulse);

      nodes.forEach((n) => {
        const a = n.angle + elapsed * n.speed;
        n.mesh.position.x = Math.cos(a) * n.radius;
        n.mesh.position.z = Math.sin(a) * n.radius;
        n.mesh.position.y = Math.sin(elapsed * 1.5 + n.angle) * n.yOffset;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      if (newW > 0 && newH > 0) {
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      outerRingGeo.dispose();
      outerRingMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
      nodeGeo.dispose();
      nodeMatGreen.dispose();
      nodeMatAmber.dispose();
      renderer.dispose();
      if (domElem.parentNode === container) {
        container.removeChild(domElem);
      }
    };
  }, [progressPercentage]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[210px] cursor-grab active:cursor-grabbing select-none relative"
      title="Drag to rotate 3D SpiceGuard Spectral Sensor"
    />
  );
};
