'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { generateBuilding } from '@/lib/generator/building';
import type { Building, Part } from '@/lib/types';

// ── pony tail: geometry pool — one alloc, reused everywhere ──
const GEO: Record<string, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
};

// ── pony tail: material pool — keyed by color+emissive ──
const matPool = new Map<string, THREE.MeshStandardMaterial>();
function getMat(color: string, emissive?: string): THREE.MeshStandardMaterial {
  const key = `${color}|${emissive ?? ''}`;
  let mat = matPool.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      emissive: emissive ?? '#000000',
      emissiveIntensity: emissive ? 0.8 : 0,
      roughness: 0.6,
      metalness: 0.3,
    });
    matPool.set(key, mat);
  }
  return mat;
}

// ── pony tail: helpers for matrix ops ──
const _dummy = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();

function setPartMatrix(part: Part): void {
  _dummy.position.set(...part.position);
  _dummy.rotation.set(...part.rotation);
  _dummy.scale.set(...part.scale);
  _dummy.updateMatrix();
}

// clone + bake Part transform into geometry vertices (for mergeGeometries)
function bakeTransform(geo: THREE.BufferGeometry, part: Part): THREE.BufferGeometry {
  const cloned = geo.clone();
  cloned.applyMatrix4(
    new THREE.Matrix4().compose(
      _pos.set(...part.position),
      _quat.setFromEuler(_euler.set(...part.rotation)),
      _scl.set(...part.scale),
    ),
  );
  return cloned;
}

function createGroup(building: Building): THREE.Group {
  const group = new THREE.Group();

  // classify parts
  const bodyParts: Part[] = [];
  // ponytail: group window planes by material key → one InstancedMesh per key
  const windowGroups = new Map<string, Part[]>();
  const signParts: Part[] = [];

  for (const part of building.parts) {
    if (part.text) {
      signParts.push(part);
    } else if (part.type === 'plane') {
      const key = `${part.color}|${part.emissive ?? ''}`;
      if (!windowGroups.has(key)) windowGroups.set(key, []);
      windowGroups.get(key)!.push(part);
    } else {
      bodyParts.push(part);
    }
  }

  // body parts — group by material, merge geometries per group into one mesh
  const bodyByMat = new Map<string, Part[]>();
  for (const part of bodyParts) {
    const key = `${part.color}|${part.emissive ?? ''}`;
    if (!bodyByMat.has(key)) bodyByMat.set(key, []);
    bodyByMat.get(key)!.push(part);
  }
  for (const [key, parts] of bodyByMat) {
    const geos = parts.map((p) => bakeTransform(GEO[p.type], p));
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
    const mesh = new THREE.Mesh(merged, getMat(parts[0].color, parts[0].emissive));
    group.add(mesh);
  }

  // windows — InstancedMesh, one per material key for batching
  for (const [, parts] of windowGroups) {
    if (parts.length === 0) continue;
    const mat = getMat(parts[0].color, parts[0].emissive);
    const instanced = new THREE.InstancedMesh(GEO.plane, mat, parts.length);
    parts.forEach((part, i) => {
      setPartMatrix(part);
      instanced.setMatrixAt(i, _dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    group.add(instanced);
  }

  // signs/billboards — individual meshes, emissive-only (no PointLight)
  for (const part of signParts) {
    const mesh = new THREE.Mesh(GEO[part.type], getMat(part.color, part.emissive));
    mesh.position.set(...part.position);
    mesh.rotation.set(...part.rotation);
    mesh.scale.set(...part.scale);
    group.add(mesh);
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

const BUILDING_SPACING = 8;

export default function CityCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#110022');

    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 300);
    // ponytail: pull camera back for the 5×5 grid
    camera.position.set(35, 25, 35);
    camera.lookAt(0, 5, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.update();

    const ambient = new THREE.AmbientLight('#221144', 0.6);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight('#8899cc', '#221144', 0.7);
    scene.add(hemiLight);

    // ground — scale up for the larger grid
    const groundSize = BUILDING_SPACING * 8;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#111122',
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const gridHelper = new THREE.PolarGridHelper(groundSize * 0.45, 64, 32, 128);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // ── buildings — 5×5 grid (25 buildings) ──
    const GRID = 5;

    const buildingSpecs: BuildingSpec[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const seed = row * 100 + col;
        // ponytail: use seed-driven rng inside generateBuilding, not Math.random here
        buildingSpecs.push({ params: {}, seed });
      }
    }

    const buildings = generateBuildings(buildingSpecs);
    const offset = ((GRID - 1) * BUILDING_SPACING) / 2;
    buildings.forEach((building, i) => {
      const row = Math.floor(i / GRID);
      const col = i % GRID;
      const group = createGroup(building);
      group.position.x = col * BUILDING_SPACING - offset;
      group.position.z = row * BUILDING_SPACING - offset;
      scene.add(group);
    });

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

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
