import * as THREE from "three";
import { createRoadWorld, LANE_X, SEGMENT_LENGTH } from "./road";
import { createMinibus } from "./vehicle";
import { createSkyDome } from "./sky";

const app = document.getElementById("app")!;

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

// ---------- Scene ----------
const scene = new THREE.Scene();
const SKY_TOP = "#5fa3d0";
const SKY_BOTTOM = "#d9c9a3";
const FOG_COLOR = "#c9d6df";
scene.fog = new THREE.Fog(FOG_COLOR, 40, 150);
scene.add(createSkyDome(SKY_TOP, SKY_BOTTOM));

// ---------- Camera ----------
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
const CAMERA_OFFSET = new THREE.Vector3(0, 4.4, 9.5);
const LOOKAHEAD = new THREE.Vector3(0, 1.2, -12);
camera.position.copy(CAMERA_OFFSET);

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a3f2e, 0.65);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d6, 2.0);
sun.position.set(-25, 35, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(sun.target);

const ambient = new THREE.AmbientLight(0xffffff, 0.18);
scene.add(ambient);

// ---------- Road world ----------
const roadWorld = createRoadWorld();
scene.add(roadWorld.group);

// ---------- Taxi ----------
const taxi = createMinibus({ bodyColor: 0xf4f4f4, livery: "taxi", stripeColor: "#e8b400" });
taxi.group.position.set(LANE_X[1], 0, 0);
scene.add(taxi.group);

// ---------- Police obstacle (attached to a road segment so it recycles with the scroll) ----------
const policeVan = createMinibus({ bodyColor: 0xffffff, livery: "police" });
policeVan.group.position.set(LANE_X[0], 0, -SEGMENT_LENGTH * 0.35);
policeVan.group.rotation.y = Math.PI; // face oncoming toward the player
roadWorld.segments[2].add(policeVan.group);

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Lane-switch controls ----------
let currentLane = 1; // 0 = left, 1 = center, 2 = right
let targetX = LANE_X[currentLane];

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "ArrowLeft" || e.code === "KeyA") {
    currentLane = Math.max(0, currentLane - 1);
    targetX = LANE_X[currentLane];
  } else if (e.code === "ArrowRight" || e.code === "KeyD") {
    currentLane = Math.min(2, currentLane + 1);
    targetX = LANE_X[currentLane];
  }
});

// ---------- Animation loop ----------
const FORWARD_SPEED = 22; // units/sec, world scroll speed (perceived taxi speed)
const LANE_LERP = 6.0; // how snappy the lane tween is
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Scroll the world toward the camera to sell forward motion.
  roadWorld.update(FORWARD_SPEED * dt);

  // Ease the taxi laterally into its target lane (tween, not a snap).
  taxi.group.position.x = THREE.MathUtils.damp(taxi.group.position.x, targetX, LANE_LERP, dt);
  // Subtle body roll/bank into the lane change for extra feel.
  const lateralVel = targetX - taxi.group.position.x;
  taxi.group.rotation.z = THREE.MathUtils.damp(taxi.group.rotation.z, THREE.MathUtils.clamp(lateralVel * 0.12, -0.12, 0.12), 8, dt);
  // Gentle idle bob for life.
  taxi.group.position.y = Math.sin(t * 8) * 0.01;

  // Spin wheels on both vehicles to sell motion.
  const wheelSpin = FORWARD_SPEED * dt * 2.6;
  for (const w of taxi.wheels) w.rotation.x -= wheelSpin;
  for (const w of policeVan.wheels) w.rotation.x -= wheelSpin;

  // Chase camera: follow behind/above the taxi, look slightly ahead down the road.
  const desiredPos = new THREE.Vector3(
    taxi.group.position.x * 0.6,
    CAMERA_OFFSET.y,
    CAMERA_OFFSET.z,
  );
  camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredPos.x, 5, dt);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredPos.y, 5, dt);
  camera.position.z = desiredPos.z;
  const lookTarget = new THREE.Vector3(
    taxi.group.position.x * 0.3 + LOOKAHEAD.x,
    LOOKAHEAD.y,
    LOOKAHEAD.z,
  );
  camera.lookAt(lookTarget);

  // Keep sun aimed relative to the taxi so shadows stay in-frame as the world scrolls.
  sun.position.set(taxi.group.position.x - 25, 35, taxi.group.position.z + 20);
  sun.target.position.set(taxi.group.position.x, 0, taxi.group.position.z);

  renderer.render(scene, camera);
}
animate();
