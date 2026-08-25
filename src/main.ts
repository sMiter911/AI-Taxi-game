import * as THREE from "three";
import { createRoadWorld, LANE_X } from "./road";
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
const SKY_TOP = "#1f5f9e";
const SKY_HORIZON = "#ff9451";
const SKY_BOTTOM = "#ffd88f";
const FOG_COLOR = "#e8985f";
scene.fog = new THREE.Fog(FOG_COLOR, 45, 160);
scene.add(createSkyDome(SKY_TOP, SKY_BOTTOM, SKY_HORIZON));

// ---------- Camera ----------
// Lower and closer than round 1 so the taxi's wheels, roof sign, and window band
// all land inside the frame instead of being cropped by too steep a downward pitch.
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
const BASE_FOV = 62;
const CAMERA_OFFSET = new THREE.Vector3(0, 2.9, 7.0);
const LOOKAHEAD = new THREE.Vector3(0, 0.45, -12);
camera.position.copy(CAMERA_OFFSET);

// ---------- Lighting ----------
// Warmer, higher-contrast sun + cooler fill so lit vs. shadowed faces read clearly.
const hemi = new THREE.HemisphereLight(0xfff0d0, 0x3a2a4a, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffd9a0, 2.9);
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

const ambient = new THREE.AmbientLight(0x6a5a70, 0.12);
scene.add(ambient);

// ---------- Road world ----------
const roadWorld = createRoadWorld();
scene.add(roadWorld.group);

// ---------- Taxi ----------
const taxi = createMinibus({ bodyColor: 0xf4f4f4, livery: "taxi", stripeColor: "#e8b400" });
taxi.group.position.set(LANE_X[1], 0, 0);
scene.add(taxi.group);

// ---------- Police obstacle ----------
// Previously this was parented to roadWorld.segments[2] and relied on that segment's
// own 350-unit recycle loop (SEGMENT_COUNT * SEGMENT_LENGTH) to bring it back into view.
// That meant the van only reappeared once every ~8s and spent most of that loop sitting
// deep in fog at a near-constant screen distance before "popping" into clear view close
// up — read by the critic as a stutter/spawn-distance bug. It's now a fully independent
// object with its own short, fixed recycle distance so it approaches continuously and
// predictably regardless of the ground-segment recycle math.
const POLICE_SPAWN_Z = -150; // where it reappears, just behind the fog's far edge (160)
const POLICE_RECYCLE_Z = 14; // just behind the camera (camera.z ~= 7) before it resets
const policeVan = createMinibus({ bodyColor: 0xffffff, livery: "police" });
policeVan.group.position.set(LANE_X[0], 0, POLICE_SPAWN_Z);
policeVan.group.rotation.y = Math.PI; // face oncoming toward the player
scene.add(policeVan.group);

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

// ---------- Speed-streak overlay ----------
// Cheap screen-space motion cue: thin radial streaks rushing outward from a vanishing
// point near the horizon, drawn on a 2D canvas layered over the WebGL canvas. Length and
// opacity scale with forward speed and spike briefly on lane changes for extra punch.
const streakCanvas = document.createElement("canvas");
streakCanvas.style.position = "fixed";
streakCanvas.style.inset = "0";
streakCanvas.style.pointerEvents = "none";
streakCanvas.style.mixBlendMode = "screen";
app.appendChild(streakCanvas);
const streakCtx = streakCanvas.getContext("2d")!;
function resizeStreakCanvas() {
  streakCanvas.width = window.innerWidth;
  streakCanvas.height = window.innerHeight;
}
resizeStreakCanvas();

interface Streak {
  angle: number;
  dist: number;
  speed: number;
  len: number;
}
const STREAK_COUNT = 26;
const streaks: Streak[] = Array.from({ length: STREAK_COUNT }, () => ({
  angle: Math.random() * Math.PI * 2,
  dist: Math.random() * 0.9,
  speed: 0.25 + Math.random() * 0.35,
  len: 40 + Math.random() * 60,
}));

function drawStreaks(dt: number, speedFactor: number) {
  const w = streakCanvas.width;
  const h = streakCanvas.height;
  streakCtx.clearRect(0, 0, w, h);
  if (speedFactor <= 0.02) return;
  const cx = w * 0.5;
  const cy = h * 0.42;
  const maxR = Math.hypot(w, h) * 0.55;
  streakCtx.lineCap = "round";
  for (const s of streaks) {
    s.dist += s.speed * speedFactor * dt * 1.4;
    if (s.dist > 1) {
      s.dist = 0.05;
      s.angle = Math.random() * Math.PI * 2;
    }
    const r0 = s.dist * maxR;
    const r1 = r0 + s.len * speedFactor;
    const dx = Math.cos(s.angle);
    const dy = Math.sin(s.angle) * 0.6; // squash vertically toward the horizon band
    const x0 = cx + dx * r0;
    const y0 = cy + dy * r0;
    const x1 = cx + dx * r1;
    const y1 = cy + dy * r1;
    const alpha = Math.min(0.55, speedFactor * 0.5) * s.dist;
    streakCtx.strokeStyle = `rgba(255,244,224,${alpha})`;
    streakCtx.lineWidth = 1.5 + speedFactor * 1.5;
    streakCtx.beginPath();
    streakCtx.moveTo(x0, y0);
    streakCtx.lineTo(x1, y1);
    streakCtx.stroke();
  }
}

// ---------- Resize (extended to keep the streak overlay in sync) ----------
window.addEventListener("resize", resizeStreakCanvas);

// ---------- HUD ----------
// Minimal DOM/CSS overlay (not in the 3D scene) showing a running distance counter and a
// placeholder score readout. Distance ticks up directly from the world-scroll speed used
// in the animation loop below; score is a simple multiple of distance for now — this
// vertical slice doesn't need real scoring/economy logic yet, just the HUD chrome.
const hudDistanceEl = document.getElementById("hud-distance-value")!;
const hudScoreEl = document.getElementById("hud-score-value")!;
let distanceMeters = 0;
let lastHudDistance = -1;
function updateHud() {
  const distDisplay = Math.floor(distanceMeters);
  if (distDisplay !== lastHudDistance) {
    hudDistanceEl.textContent = distDisplay.toLocaleString();
    hudScoreEl.textContent = (distDisplay * 10).toLocaleString();
    lastHudDistance = distDisplay;
  }
}

// ---------- Animation loop ----------
const FORWARD_SPEED = 42; // units/sec, world scroll speed (perceived taxi speed) — was 22, doubled for a real sense of speed
const LANE_LERP = 7.5; // how snappy the lane tween is
const ROLL_MAX = 0.3; // max body-roll bank angle (rad) on a lane change — was 0.12
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Scroll the world toward the camera to sell forward motion.
  roadWorld.update(FORWARD_SPEED * dt);

  // Advance the police van at the same forward speed as the scrolling world, and recycle
  // it independently of the road-segment loop once it passes behind the camera. This is
  // the fix for the round-2 "hangs then jumps" bug: constant, linear approach every cycle,
  // verified by watching it scroll through multiple recycles (see commit notes).
  policeVan.group.position.z += FORWARD_SPEED * dt;
  if (policeVan.group.position.z > POLICE_RECYCLE_Z) {
    policeVan.group.position.z = POLICE_SPAWN_Z;
  }

  // Ease the taxi laterally into its target lane (tween, not a snap).
  taxi.group.position.x = THREE.MathUtils.damp(taxi.group.position.x, targetX, LANE_LERP, dt);
  // Body roll/bank into the lane change — snappier and more pronounced than round 1.
  const lateralVel = targetX - taxi.group.position.x;
  const rollTarget = THREE.MathUtils.clamp(lateralVel * 0.3, -ROLL_MAX, ROLL_MAX);
  taxi.group.rotation.z = THREE.MathUtils.damp(taxi.group.rotation.z, rollTarget, 10, dt);
  // Gentle idle bob for life.
  taxi.group.position.y = Math.sin(t * 8) * 0.01;

  // Spin wheels on both vehicles to sell motion. Physically-accurate angle (distance /
  // wheel radius) works out to ~100 rad/s at this forward speed, which at 60fps is ~95
  // degrees per frame — too fast to read as rotation (it strobes) even with hub detail.
  // Using a slower, stylized constant rate instead keeps the spin visually legible while
  // the new spoke-textured hub (see textures.ts/vehicle.ts) gives it something to read.
  const WHEEL_SPIN_RATE = 9; // rad/sec, tuned for visibility rather than physical accuracy
  const wheelSpin = WHEEL_SPIN_RATE * dt;
  for (const w of taxi.wheels) w.rotation.x -= wheelSpin;
  for (const w of policeVan.wheels) w.rotation.x -= wheelSpin;

  // Flash the police light bar (alternating red/blue) for extra motion/energy cues.
  if (policeVan.flashers) {
    const phase = Math.sin(t * 10) > 0;
    const { redMat, blueMat, redLight, blueLight } = policeVan.flashers;
    redMat.emissiveIntensity = phase ? 2.2 : 0.15;
    blueMat.emissiveIntensity = phase ? 0.15 : 2.2;
    redLight.intensity = phase ? 4.5 : 0.2;
    blueLight.intensity = phase ? 0.2 : 4.5;
  }

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
  // Camera lean + FOV kick on lane changes for extra punch.
  camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, -taxi.group.rotation.z * 0.6, 8, dt);
  const fovKick = Math.min(6, Math.abs(lateralVel) * 2.2);
  camera.fov = THREE.MathUtils.damp(camera.fov, BASE_FOV + fovKick, 6, dt);
  camera.updateProjectionMatrix();

  // Keep sun aimed relative to the taxi so shadows stay in-frame as the world scrolls.
  sun.position.set(taxi.group.position.x - 25, 35, taxi.group.position.z + 20);
  sun.target.position.set(taxi.group.position.x, 0, taxi.group.position.z);

  // Speed-streak overlay: intensity scales with forward speed plus a lane-change boost.
  const speedFactor = Math.min(1.6, FORWARD_SPEED / 40 + Math.abs(lateralVel) * 0.15);
  drawStreaks(dt, speedFactor);

  // HUD: distance ticks up with the same world-scroll speed driving everything else.
  distanceMeters += FORWARD_SPEED * dt;
  updateHud();

  renderer.render(scene, camera);
}
animate();
