import * as THREE from "three";
import {
  createAsphaltTexture,
  createLaneMarkingTexture,
  createBuildingFacadeTexture,
  createPedestrianSilhouetteTexture,
} from "./textures";

export const LANE_WIDTH = 3.6;
export const LANE_COUNT = 3;
export const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH];

export const SEGMENT_LENGTH = 50;
export const SEGMENT_COUNT = 7;
const ROAD_WIDTH = LANE_WIDTH * LANE_COUNT + 1.0; // small margin beyond outer lane centers
const SIDEWALK_WIDTH = 3.2;
const CURB_HEIGHT = 0.18;

const facadeColors = [
  ["#d9722e", "#2a1a10"], // burnt-orange brick
  ["#3f6e8c", "#0f1b26"], // saturated teal-blue
  ["#e0a52c", "#241c0c"], // warm gold ochre
  ["#8a3b46", "#1c0d10"], // deep terracotta red
  ["#4c8c5a", "#0e1c12"], // muted jacaranda green
  ["#c9506b", "#26101a"], // punchy coral pink
  ["#5b5f8a", "#15151f"], // dusk indigo
  ["#e8c15a", "#2c2410"], // sunlit sandstone
];

export interface RoadWorld {
  group: THREE.Group;
  segments: THREE.Group[];
  update: (deltaZ: number) => void;
}

// The sun orbits with offset (-x, +z) relative to the taxi (see main.ts), so faces
// pointing toward -x/+z are roughly sun-facing and +x/-z faces are roughly self-shadowed.
// A single uniform material can't show that split, so each building gets two material
// variants (a brighter warm-tinted one for the lit sides, a darker cool-tinted one for
// the shadowed sides) applied per-face via BoxGeometry's material array.
function buildBuilding(seed: number): THREE.Group {
  const g = new THREE.Group();
  const [base, win] = facadeColors[seed % facadeColors.length];
  const w = 4 + (seed % 3) * 1.4;
  const d = 4 + ((seed * 7) % 3) * 1.2;
  const h = 6 + ((seed * 13) % 10);
  const tex = createBuildingFacadeTexture(base, win);
  tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3)));
  const litMat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xfff2d9,
    roughness: 0.8,
    metalness: 0.05,
  });
  // Cool blue-gray tint, not near-black: round 4's 0x4a4d66 multiplied against the
  // (already dark-toned) facade texture crushed toward near-pure-black, reading as a hard
  // cel-shaded split rather than a natural directional shadow. Lightened the tint and
  // added a faint cool emissive floor so the shadow face never fully crushes to black.
  const shadowMat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0x8890ab,
    emissive: 0x14182a,
    emissiveIntensity: 0.35,
    roughness: 0.95,
    metalness: 0.02,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
    shadowMat, // +x (away from sun)
    litMat, // -x (toward sun)
    roofMat,
    roofMat,
    litMat, // +z (toward sun)
    shadowMat, // -z (away from sun)
  ]);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  return g;
}

const PED_SHIRTS = ["#c94f4f", "#4f8fc9", "#4fc98f", "#c9a54f", "#8a4fc9"];

/** Cheap ground-level detail: a flat billboard pedestrian silhouette planted on the
 * sidewalk. Double-sided so it reads from either pass direction, alphaTest keeps the
 * transparent background from sorting/blending oddly against other props. */
function buildPedestrian(seed: number): THREE.Group {
  const g = new THREE.Group();
  const tex = createPedestrianSilhouetteTexture(PED_SHIRTS[seed % PED_SHIRTS.length]);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  const height = 1.6 + (seed % 3) * 0.12;
  const width = height * 0.5;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.y = height / 2;
  plane.castShadow = true;
  g.add(plane);
  return g;
}

function buildStreetlight(): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 8), poleMat);
  pole.position.y = 2.6;
  pole.castShadow = true;
  g.add(pole);

  const armGeo = new THREE.BoxGeometry(1.2, 0.08, 0.08);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(0.6, 5.0, 0);
  arm.castShadow = true;
  g.add(arm);

  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0,
    emissive: 0xffdd88,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), lampMat);
  lamp.position.set(1.15, 4.9, 0);
  g.add(lamp);

  return g;
}

function buildSegment(): THREE.Group {
  const seg = new THREE.Group();

  const asphaltTex = createAsphaltTexture();
  asphaltTex.repeat.set(ROAD_WIDTH / 4, SEGMENT_LENGTH / 4);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95, metalness: 0.02 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  seg.add(road);

  // Lane markings: dashed lines between lanes (2 divider lines for 3 lanes)
  const laneTex = createLaneMarkingTexture();
  laneTex.repeat.set(1, SEGMENT_LENGTH / 8);
  const laneMat = new THREE.MeshStandardMaterial({
    map: laneTex,
    transparent: true,
    roughness: 0.6,
    metalness: 0,
  });
  for (const dividerX of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.4, SEGMENT_LENGTH), laneMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(dividerX, 0.01, 0);
    strip.receiveShadow = true;
    seg.add(strip);
  }
  // Solid outer edge lines
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  for (const edgeX of [-(LANE_WIDTH * 1.5), LANE_WIDTH * 1.5]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.15, SEGMENT_LENGTH), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(edgeX, 0.011, 0);
    edge.receiveShadow = true;
    seg.add(edge);
  }

  // Sidewalks + curbs each side
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.95 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xbdb8ae, roughness: 0.8 });
  for (const side of [-1, 1]) {
    const sidewalkX = side * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2);
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(SIDEWALK_WIDTH, CURB_HEIGHT, SEGMENT_LENGTH),
      sidewalkMat,
    );
    sidewalk.position.set(sidewalkX, CURB_HEIGHT / 2, 0);
    sidewalk.receiveShadow = true;
    sidewalk.castShadow = true;
    seg.add(sidewalk);

    const curbX = side * (ROAD_WIDTH / 2 + 0.08);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, CURB_HEIGHT * 1.6, SEGMENT_LENGTH), curbMat);
    curb.position.set(curbX, CURB_HEIGHT * 0.8, 0);
    curb.receiveShadow = true;
    curb.castShadow = true;
    seg.add(curb);
  }

  // Ground-level detail: a few pedestrian billboards standing on each sidewalk so the
  // street doesn't read as an empty strip between the buildings.
  const pedSpacing = 8.5;
  let pedSeed = 0;
  for (let z = -SEGMENT_LENGTH / 2 + 3; z < SEGMENT_LENGTH / 2; z += pedSpacing) {
    for (const side of [-1, 1]) {
      if ((pedSeed + side) % 3 === 0) {
        // Skip roughly a third of slots so pedestrians cluster naturally rather than
        // lining up in a uniform row.
        pedSeed++;
        continue;
      }
      const ped = buildPedestrian(pedSeed);
      const pedX = side * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH * (0.35 + (pedSeed % 3) * 0.2));
      ped.position.set(pedX, 0, z + ((pedSeed % 2) * 1.4 - 0.7));
      seg.add(ped);
      pedSeed++;
    }
  }

  // Roadside props: alternate buildings / streetlights along the segment, both sides
  const propSpacing = 12.5;
  let i = 0;
  for (let z = -SEGMENT_LENGTH / 2 + 4; z < SEGMENT_LENGTH / 2; z += propSpacing) {
    for (const side of [-1, 1]) {
      const propX = side * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 2.5 + (i % 2) * 2);
      if (i % 3 === 0) {
        const light = buildStreetlight();
        light.position.set(side * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH - 0.4), 0, z);
        seg.add(light);
      } else {
        const building = buildBuilding(Math.floor(i * 3 + side + 7));
        building.position.set(propX, 0, z + (i % 2 === 0 ? 1.5 : -1.5));
        seg.add(building);
      }
    }
    i++;
  }

  return seg;
}

export function createRoadWorld(): RoadWorld {
  const group = new THREE.Group();
  const segments: THREE.Group[] = [];

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const seg = buildSegment();
    seg.position.z = -i * SEGMENT_LENGTH;
    group.add(seg);
    segments.push(seg);
  }

  const totalLength = SEGMENT_COUNT * SEGMENT_LENGTH;

  function update(deltaZ: number) {
    for (const seg of segments) {
      seg.position.z += deltaZ;
      if (seg.position.z > SEGMENT_LENGTH) {
        seg.position.z -= totalLength;
      }
    }
  }

  return { group, segments, update };
}
