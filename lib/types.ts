// Core data model for procedural 3D urban objects.
// All geometry is composed from Three.js-compatible primitives.
// JSON serialization IS the save format — City → JSON.stringify → file.

export type PartType = 'box' | 'plane' | 'cylinder';

export interface Part {
  type: PartType;
  position: [number, number, number];
  rotation: [number, number, number]; // euler angles in radians
  scale: [number, number, number];
  color: string; // CSS hex like "#ff00ff"
  emissive?: string; // for neon/LED, defaults to none
  text?: string; // for LED signs (renderer decides how to display)
}

export interface Building {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  parts: Part[];
}

export interface City {
  seed: number;
  buildings: Building[];
}

export interface BuildingParams {
  width?: number; // default 2, range 1-4
  depth?: number; // default 2, range 1-4
  floors?: number; // default random 2-20, drives window rows and total height
  floorHeight?: number; // default 1
  windowStyle?: 'regular' | 'wide' | 'narrow'; // default 'regular'
  acProbability?: number; // 0-1, default 0.7
  signProbability?: number; // 0-1, default 0.3
  signText?: string; // default random from word pool
  palette?: 'cyberpunk' | 'brutalist' | 'glass' | string[]; // default 'cyberpunk'
}
