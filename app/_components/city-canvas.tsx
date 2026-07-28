'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { generateBuilding } from '@/lib/generator/building';
import type { Building, Part } from '@/lib/types';

type CameraMode = 'orbit' | 'fps';

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

// ── concrete wall texture — lazy-init, only on client (SSR-safe) ──
let concreteTex: THREE.Texture | null = null;
function ensureConcreteTex(): THREE.Texture {
  if (!concreteTex) {
    const loader = new THREE.TextureLoader();
    concreteTex = loader.load('/concrete.jpg');
    concreteTex.wrapS = THREE.RepeatWrapping;
    concreteTex.wrapT = THREE.RepeatWrapping;
    concreteTex.colorSpace = THREE.SRGBColorSpace;
  }
  return concreteTex;
}

function getConcreteMat(color: string): THREE.MeshStandardMaterial {
  const key = `concrete|${color}`;
  let mat = matPool.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: ensureConcreteTex(),
      color,
      roughness: 0.85,
      metalness: 0.05,
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

  // body parts — boxes get concrete texture, cylinders get solid mat
  const bodyBoxes = new Map<string, Part[]>();
  const bodyProps = new Map<string, Part[]>();
  for (const part of bodyParts) {
    const key = `${part.color}|${part.emissive ?? ''}`;
    if (part.type === 'box') {
      if (!bodyBoxes.has(key)) bodyBoxes.set(key, []);
      bodyBoxes.get(key)!.push(part);
    } else {
      if (!bodyProps.has(key)) bodyProps.set(key, []);
      bodyProps.get(key)!.push(part);
    }
  }
  for (const [, parts] of bodyBoxes) {
    const geos = parts.map((p) => bakeTransform(GEO.box, p));
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
    const mesh = new THREE.Mesh(merged, getConcreteMat(parts[0].color));
    group.add(mesh);
  }
  for (const [, parts] of bodyProps) {
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

const BUILDING_SPACING = 4;
const ROAD_WIDTH = 8;
const SIDEWALK_WIDTH = 1.5;
const HALF_ROAD = ROAD_WIDTH / 2;
const SIDEWALK_EDGE = HALF_ROAD + SIDEWALK_WIDTH; // 5.5 — curb-to-building setback
const BUILDINGS_PER_SIDE = 12;
const AVENUE_SEPARATION = 18; // distance between avenue centerlines
const BUILDINGS_LATERAL = 12; // ponytail: outer lateral rows, continuous (no cross streets)

export default function CityCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<CameraMode>('orbit');
  const [mode, setMode] = useState<CameraMode>('orbit');

  // fps camera look state
  const fpsYaw = useRef(0);
  const fpsPitch = useRef(0);
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const pointerDelta = useRef({ x: 0, y: 0 });
  const SENSITIVITY = 0.003;

  // virtual joystick state
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const joystickActive = useRef(false);
  const joystickCenter = useRef({ x: 0, y: 0 });
  const moveInput = useRef({ x: 0, y: 0 });
  const JOYSTICK_RADIUS = 55;
  const MOVE_SPEED = 6;

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
    scene.background = new THREE.Color('#c0c5ca');
    scene.fog = new THREE.Fog('#c0c5ca', 40, 160);

    // orbit camera
    const orbitCam = new THREE.PerspectiveCamera(50, width / height, 1, 300);
    orbitCam.position.set(25, 22, 60);
    orbitCam.lookAt(0, 5, -AVENUE_SEPARATION);

    const controls = new OrbitControls(orbitCam, renderer.domElement);
    controls.target.set(0, 5, -AVENUE_SEPARATION);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.update();

    // fps camera — eye height, on the first avenue sidewalk
    const fpsCam = new THREE.PerspectiveCamera(70, width / height, 0.5, 300);
    fpsCam.position.set(0, 1.7, 0);
    fpsYaw.current = 0;
    fpsPitch.current = 0;
    fpsCam.rotation.order = 'YXZ';
    fpsCam.rotation.set(0, 0, 0); // looks down -Z, along first avenue

    let lastTime = performance.now();

    const ambient = new THREE.AmbientLight('#8899aa', 2.0);
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight('#ccddee', '#445566', 1.0);
    scene.add(hemiLight);

    // directional sun — weak, diffuse overcast (nuclear winter)
    const sun = new THREE.DirectionalLight('#ddeeff', 0.6);
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

    // ground — covers all avenues + cross streets + lateral rows
    const avenueLength = (BUILDINGS_PER_SIDE - 1) * BUILDING_SPACING;
    const cityDepth = 2 * AVENUE_SEPARATION + SIDEWALK_EDGE * 4 + BUILDING_SPACING * 2;
    const groundSize = Math.max(avenueLength + 50, cityDepth + 30);
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#1a1a1e',
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // shared materials
    const roadMat = new THREE.MeshStandardMaterial({
      color: '#2e2e30',
      roughness: 0.9,
      metalness: 0.05,
    });
    const sidewalkMatShared = new THREE.MeshStandardMaterial({
      color: '#6e6e72',
      roughness: 0.75,
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

    // ── generate all buildings (3 avenues × 24 + 2 lateral rows × 12 = 96) ──
    const AVENUE_Z = [0, -AVENUE_SEPARATION, -2 * AVENUE_SEPARATION];
    const totalBuildings = BUILDINGS_PER_SIDE * 2 * AVENUE_Z.length + BUILDINGS_LATERAL * 2;
    const buildingSpecs: BuildingSpec[] = [];
    for (let i = 0; i < totalBuildings; i++) {
      buildingSpecs.push({ params: {}, seed: i });
    }
    const allBuildings = generateBuildings(buildingSpecs);
    let bIdx = 0;

    // cross street X positions — buildings must not overlap
    const crossPositions = [startX, 0, startX + avenueLength];
    const overlapsCrossStreet = (bx: number, buildingWidth: number) => {
      const halfW = buildingWidth / 2;
      for (const cx of crossPositions) {
        if (bx + halfW > cx - SIDEWALK_EDGE && bx - halfW < cx + SIDEWALK_EDGE) {
          return true;
        }
      }
      return false;
    };

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
        const bx = startX + i * BUILDING_SPACING;
        if (overlapsCrossStreet(bx, building.parts[0].scale[0])) continue;
        const depth = building.parts[0].scale[2];
        const group = createGroup(building);
        group.position.x = bx;
        group.position.z = zCenter - (SIDEWALK_EDGE + depth / 2);
        setShadows(group);
        scene.add(group);
      }

      // north side buildings (face Z- toward road, rotated 180°)
      for (let i = 0; i < BUILDINGS_PER_SIDE; i++) {
        const building = allBuildings[bIdx++];
        const bx = startX + i * BUILDING_SPACING;
        if (overlapsCrossStreet(bx, building.parts[0].scale[0])) continue;
        const depth = building.parts[0].scale[2];
        const group = createGroup(building);
        group.position.x = bx;
        group.position.z = zCenter + (SIDEWALK_EDGE + depth / 2);
        group.rotation.y = Math.PI;
        setShadows(group);
        scene.add(group);
      }
    }

    // ── three perpendicular cross streets (wide, two-way) ──
    // connect first avenue south curb to last avenue north curb
    const crossZ0 = AVENUE_Z[0] - HALF_ROAD; // -4
    const crossZ1 = AVENUE_Z[2] + HALF_ROAD; // -40
    const crossLength = Math.abs(crossZ1 - crossZ0);
    const crossMidZ = (crossZ0 + crossZ1) / 2;

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

    // ── lateral building rows (continuous, no cross streets) ──
    // Back-to-back with avenue buildings, separated by an alley (BUILDING_SPACING)
    // North of avenue 0 outer side — faces outward (+Z)
    const lateralNorthZ = AVENUE_Z[0] + SIDEWALK_EDGE + BUILDING_SPACING;
    for (let i = 0; i < BUILDINGS_LATERAL; i++) {
      const building = allBuildings[bIdx++];
      const bx = startX + i * BUILDING_SPACING;
      const depth = building.parts[0].scale[2];
      const group = createGroup(building);
      group.position.x = bx;
      group.position.z = lateralNorthZ + depth / 2;
      group.rotation.y = Math.PI;
      setShadows(group);
      scene.add(group);
    }

    // South of last avenue outer side — faces outward (-Z)
    const lateralSouthZ = AVENUE_Z[2] - SIDEWALK_EDGE - BUILDING_SPACING;
    for (let i = 0; i < BUILDINGS_LATERAL; i++) {
      const building = allBuildings[bIdx++];
      const bx = startX + i * BUILDING_SPACING;
      const depth = building.parts[0].scale[2];
      const group = createGroup(building);
      group.position.x = bx;
      group.position.z = lateralSouthZ - depth / 2;
      group.rotation.y = 0;
      setShadows(group);
      scene.add(group);
    }

    function animate() {
      requestAnimationFrame(animate);
      const m = modeRef.current;
      controls.enabled = m === 'orbit';
      if (m === 'orbit') {
        controls.update();
      } else {
        // apply accumulated pointer delta
        fpsYaw.current -= pointerDelta.current.x * SENSITIVITY;
        fpsPitch.current -= pointerDelta.current.y * SENSITIVITY;
        fpsPitch.current = Math.max(-Math.PI / 2.4, Math.min(Math.PI / 2.4, fpsPitch.current));
        pointerDelta.current.x = 0;
        pointerDelta.current.y = 0;
        fpsCam.rotation.set(fpsPitch.current, fpsYaw.current, 0);

        // joystick movement
        const { x: mx, y: my } = moveInput.current;
        if (mx !== 0 || my !== 0) {
          const now = performance.now();
          const dt = Math.min((now - lastTime) / 1000, 0.1);
          lastTime = now;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(fpsCam.quaternion);
          forward.y = 0;
          forward.normalize();
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(fpsCam.quaternion);
          right.y = 0;
          right.normalize();
          fpsCam.position.addScaledVector(right, mx * MOVE_SPEED * dt);
          fpsCam.position.addScaledVector(forward, my * MOVE_SPEED * dt);
          fpsCam.position.y = 1.7;
        } else {
          lastTime = performance.now();
        }
      }
      const activeCam = m === 'orbit' ? orbitCam : fpsCam;
      renderer.render(scene, activeCam);
    }
    animate();

    function onResize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      orbitCam.aspect = w / h;
      orbitCam.updateProjectionMatrix();
      fpsCam.aspect = w / h;
      fpsCam.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // pointer drag handlers for FPS look
    function onPointerDown(e: PointerEvent) {
      if (modeRef.current !== 'fps') return;
      isDragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      container!.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      pointerDelta.current.x += dx;
      pointerDelta.current.y += dy;
      lastPointer.current = { x: e.clientX, y: e.clientY };
    }
    function onPointerUp() {
      isDragging.current = false;
    }
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointerleave', onPointerUp);

    // joystick handlers
    function handleJoystick(cx: number, cy: number) {
      const dx = cx - joystickCenter.current.x;
      const dy = cy - joystickCenter.current.y;
      const r = JOYSTICK_RADIUS;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(dist, r);
      const nx = dist > 0 ? (dx / dist) * (clamped / r) : 0;
      const ny = dist > 0 ? (dy / dist) * (clamped / r) : 0;
      moveInput.current.x = nx;
      moveInput.current.y = -ny; // invert Y: up = forward
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${nx * r * 0.7}px, ${ny * r * 0.7}px)`;
      }
    }
    function onJoystickDown(e: PointerEvent) {
      e.stopPropagation();
      e.preventDefault();
      joystickActive.current = true;
      const rect = joystickRef.current!.getBoundingClientRect();
      joystickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      joystickRef.current!.setPointerCapture(e.pointerId);
      handleJoystick(e.clientX, e.clientY);
    }
    function onJoystickMove(e: PointerEvent) {
      if (!joystickActive.current) return;
      handleJoystick(e.clientX, e.clientY);
    }
    function onJoystickUp() {
      joystickActive.current = false;
      moveInput.current.x = 0;
      moveInput.current.y = 0;
      if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
    }
    const joyEl = joystickRef.current!;
    joyEl.addEventListener('pointerdown', onJoystickDown);
    joyEl.addEventListener('pointermove', onJoystickMove);
    joyEl.addEventListener('pointerup', onJoystickUp);
    joyEl.addEventListener('pointerleave', onJoystickUp);

    return () => {
      joyEl.removeEventListener('pointerdown', onJoystickDown);
      joyEl.removeEventListener('pointermove', onJoystickMove);
      joyEl.removeEventListener('pointerup', onJoystickUp);
      joyEl.removeEventListener('pointerleave', onJoystickUp);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerleave', onPointerUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: '100vh' }}>
      <button
        onClick={() => {
          setMode((m) => {
            const next = m === 'orbit' ? 'fps' : 'orbit';
            modeRef.current = next;
            return next;
          });
        }}
        className="absolute top-4 right-4 z-10 px-4 py-2 rounded bg-cyan-500/80 text-white font-mono text-sm
                   hover:bg-cyan-400/90 transition-colors backdrop-blur-sm border border-cyan-400/30"
        style={{ textShadow: '0 0 8px rgba(0,255,255,0.5)' }}
      >
        {mode === 'orbit' ? '🎥 FPS' : '🛰️ Orbit'}
      </button>
      {mode === 'fps' && (
        <div
          ref={joystickRef}
          className="absolute bottom-8 left-8 z-10 rounded-full border-2 border-cyan-400/40 bg-cyan-500/10"
          style={{ width: JOYSTICK_RADIUS * 2, height: JOYSTICK_RADIUS * 2, touchAction: 'none' }}
        >
          <div
            ref={knobRef}
            className="absolute rounded-full bg-cyan-400/60"
            style={{
              width: JOYSTICK_RADIUS * 0.8,
              height: JOYSTICK_RADIUS * 0.8,
              top: '50%',
              left: '50%',
              marginLeft: -(JOYSTICK_RADIUS * 0.4),
              marginTop: -(JOYSTICK_RADIUS * 0.4),
            }}
          />
        </div>
      )}
    </div>
  );
}
