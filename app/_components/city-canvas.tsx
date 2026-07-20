'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateBuilding } from '@/lib/generator/building';
import type { Building } from '@/lib/types';

function buildMesh(part: Building['parts'][number]): THREE.Mesh {
  let geometry: THREE.BufferGeometry;
  switch (part.type) {
    case 'box':
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'plane':
      geometry = new THREE.PlaneGeometry(1, 1);
      break;
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
      break;
  }

  const material = new THREE.MeshStandardMaterial({
    color: part.color,
    emissive: part.emissive ? part.emissive : '#000000',
    emissiveIntensity: part.emissive ? 0.8 : 0,
    roughness: 0.6,
    metalness: 0.3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...part.position);
  mesh.rotation.set(...part.rotation);
  mesh.scale.set(...part.scale);
  return mesh;
}

function createGroup(building: Building): THREE.Group {
  const group = new THREE.Group();
  for (const part of building.parts) {
    group.add(buildMesh(part));
  }
  return group;
}

interface BuildingSpec {
  params: Parameters<typeof generateBuilding>[0];
  seed: number;
}

function generateBuildings(specs: BuildingSpec[]): Building[] {
  return specs.map(({ params, seed }) => generateBuilding(params, seed));
}

export default function CityCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0f');
    scene.fog = new THREE.Fog('#0a0a0f', 20, 80);

    // camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 200);
    camera.position.set(15, 10, 15);
    camera.lookAt(0, 5, 0);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.update();

    // lights
    const hemiLight = new THREE.HemisphereLight('#8899cc', '#221144', 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffccaa', 1.5);
    dirLight.position.set(20, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -5;
    scene.add(dirLight);

    // ground
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#111122',
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // grid lines
    const gridHelper = new THREE.PolarGridHelper(25, 32, 24, 128);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // buildings — two variations side by side with different styles
    const buildingSpecs: BuildingSpec[] = [
      { params: { floors: 8, palette: 'cyberpunk', windowStyle: 'regular', sideBillboardProb: 0 }, seed: 42 },
      { params: { floors: 15, palette: 'brutalist', windowStyle: 'wide' }, seed: 99 },
    ];
    const buildings = generateBuildings(buildingSpecs);
    const spacing = 8;
    buildings.forEach((building, i) => {
      const group = createGroup(building);
      const offsetX = (i - (buildings.length - 1) / 2) * spacing;
      group.position.x = offsetX;
      scene.add(group);
    });

    // render loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // resize
    // ponytail: non-null assertion — container is guarded at the top of the effect
    function onResize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '100vh' }}
    />
  );
}
