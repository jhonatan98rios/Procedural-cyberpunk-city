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

const BUILDING_SPACING = 5;
const ROAD_WIDTH = 8;
const SIDEWALK_WIDTH = 1.5;
const HALF_ROAD = ROAD_WIDTH / 2;
const SIDEWALK_EDGE = HALF_ROAD + SIDEWALK_WIDTH; // 5.5 — curb-to-building setback
const BUILDINGS_PER_SIDE = 12;
const AVENUE_SEPARATION = 30; // distance between avenue centerlines

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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#110022');

    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 300);
    camera.position.set(25, 22, 45);
    camera.lookAt(0, 5, -AVENUE_SEPARATION / 2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, -AVENUE_SEPARATION / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.update();

    const ambient = new THREE.AmbientLight('#443366', 1.2);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight('#aabbdd', '#332244', 0.8);
    scene.add(hemiLight);

    // directional sun — soft shadows across the avenue
    const sun = new THREE.DirectionalLight('#ffeebb', 1.5);
    sun.position.set(40, 35, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    // ground — covers both avenues + cross streets
    const avenueLength = (BUILDINGS_PER_SIDE - 1) * BUILDING_SPACING;
    const groundSize = Math.max(avenueLength + 40, AVENUE_SEPARATION + 40);
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#0a0a14',
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // shared materials
    const roadMat = new THREE.MeshStandardMaterial({
      color: '#2a2a2c',
      roughness: 0.85,
      metalness: 0.05,
    });
    const sidewalkMatShared = new THREE.MeshStandardMaterial({
      color: '#7a7a7e',
      roughness: 0.7,
      metalness: 0.1,
    });

    const roadLength = avenueLength + BUILDING_SPACING * 2;
    const startX = -avenueLength / 2;

    // ponytail: shadow helper
    const setShadows = (group: THREE.Group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    };

    // ── generate all buildings (2 avenues × 24 per avenue = 48) ──
    const AVENUE_Z = [0, -AVENUE_SEPARATION];
    const buildingSpecs: BuildingSpec[] = [];
    for (let i = 0; i < BUILDINGS_PER_SIDE * 2 * AVENUE_Z.length; i++) {
      buildingSpecs.push({ params: {}, seed: i });
    }
    const allBuildings = generateBuildings(buildingSpecs);
    let bIdx = 0;

    for (const zCenter of AVENUE_Z) {
      // asphalt
      const roadGeo = new THREE.PlaneGeometry(roadLength, ROAD_WIDTH);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.005, zCenter);
      road.receiveShadow = true;
      scene.add(road);

      // sidewalks both sides
      const sidewalkGeo = new THREE.PlaneGeometry(roadLength, SIDEWALK_WIDTH);
      for (const side of [-1, 1]) {
        const sw = new THREE.Mesh(sidewalkGeo, sidewalkMatShared);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(0, 0.003, zCenter + side * (HALF_ROAD + SIDEWALK_WIDTH / 2));
        sw.receiveShadow = true;
        scene.add(sw);
      }

      // south side buildings (face Z+ toward road)
      for (let i = 0; i < BUILDINGS_PER_SIDE; i++) {
        const building = allBuildings[bIdx++];
        const depth = building.parts[0].scale[2];
        const group = createGroup(building);
        group.position.x = startX + i * BUILDING_SPACING;
        group.position.z = zCenter - (SIDEWALK_EDGE + depth / 2);
        setShadows(group);
        scene.add(group);
      }

      // north side buildings (face Z- toward road, rotated 180°)
      for (let i = 0; i < BUILDINGS_PER_SIDE; i++) {
        const building = allBuildings[bIdx++];
        const depth = building.parts[0].scale[2];
        const group = createGroup(building);
        group.position.x = startX + i * BUILDING_SPACING;
        group.position.z = zCenter + (SIDEWALK_EDGE + depth / 2);
        group.rotation.y = Math.PI;
        setShadows(group);
        scene.add(group);
      }
    }

    // ── three perpendicular cross streets (wide, two-way) ──
    // connect avenue 1 south curb to avenue 2 north curb
    const crossZ0 = AVENUE_Z[0] - HALF_ROAD; // -4
    const crossZ1 = AVENUE_Z[1] + HALF_ROAD; // -26
    const crossLength = Math.abs(crossZ1 - crossZ0);
    const crossMidZ = (crossZ0 + crossZ1) / 2;
    const crossPositions = [startX, 0, startX + avenueLength];

    const crossRoadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, crossLength);
    const crossSidewalkGeo = new THREE.PlaneGeometry(SIDEWALK_WIDTH, crossLength);

    for (const cx of crossPositions) {
      // cross asphalt (y=0.004 — slightly below avenues to avoid z-fighting)
      const cr = new THREE.Mesh(crossRoadGeo, roadMat);
      cr.rotation.x = -Math.PI / 2;
      cr.position.set(cx, 0.004, crossMidZ);
      cr.receiveShadow = true;
      scene.add(cr);

      // cross sidewalks (both sides in X)
      for (const side of [-1, 1]) {
        const csw = new THREE.Mesh(crossSidewalkGeo, sidewalkMatShared);
        csw.rotation.x = -Math.PI / 2;
        csw.position.set(
          cx + side * (HALF_ROAD + SIDEWALK_WIDTH / 2),
          0.003,
          crossMidZ,
        );
        csw.receiveShadow = true;
        scene.add(csw);
      }
    }

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
