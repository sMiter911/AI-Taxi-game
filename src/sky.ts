import * as THREE from "three";

/**
 * Vertical-gradient sky using a CanvasTexture mapped onto a large background sphere.
 * A warm horizon-glow stop is blended in between top and bottom for a saturated,
 * "golden hour over the city" character instead of a flat pale gradient.
 */
export function createSkyDome(
  topColor: string,
  bottomColor: string,
  horizonColor = "#ff9d5c",
  radius = 480,
): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topColor);
  grad.addColorStop(0.55, topColor);
  grad.addColorStop(0.82, horizonColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1000;
  return mesh;
}
