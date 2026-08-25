import * as THREE from "three";

/** Utility to build small procedural CanvasTextures. Kept dependency-free. */

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

/** Dashed lane-marking texture: white dashes on transparent, tiled along road length. */
export function createLaneMarkingTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(64, 512);
  ctx.clearRect(0, 0, 64, 512);
  ctx.fillStyle = "#f2f2f2";
  const dashLen = 180;
  const gapLen = 140;
  let y = 0;
  while (y < 512) {
    ctx.fillRect(20, y, 24, dashLen);
    y += dashLen + gapLen;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Asphalt texture with subtle noise speckle for roughness variation look. */
export function createAsphaltTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = "#3a3a3e";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.random() * 30 - 15;
    const shade = 58 + v;
    ctx.fillStyle = `rgb(${shade},${shade},${shade + 2})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Simple brick/window pattern for building facades. */
export function createBuildingFacadeTexture(baseColor: string, windowColor: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 256);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  const winW = 14;
  const winH = 20;
  const gapX = 10;
  const gapY = 16;
  ctx.fillStyle = windowColor;
  for (let y = gapY; y < 256 - winH; y += winH + gapY) {
    for (let x = gapX; x < 128 - winW; x += winW + gapX) {
      if (Math.random() > 0.15) {
        ctx.fillRect(x, y, winW, winH);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Minibus taxi livery: bold diagonal stripe band, used as a decal texture on body panels. */
export function createTaxiLiveryTexture(stripeColor: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(0, 0, 512, 256);
  ctx.save();
  ctx.translate(0, 140);
  ctx.rotate(-0.12);
  ctx.fillStyle = stripeColor;
  ctx.fillRect(-50, 0, 700, 46);
  ctx.fillStyle = "#161616";
  ctx.fillRect(-50, 46, 700, 10);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Police livery: blue/white checker-ish band with "JMPD" style blocking (no text needed, just blocks). */
export function createPoliceLiveryTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#0b3d91";
  ctx.fillRect(0, 90, 512, 60);
  ctx.fillStyle = "#ffd400";
  ctx.fillRect(0, 86, 512, 6);
  ctx.fillRect(0, 148, 512, 6);
  // checker blocks (Battenburg-style) at front/rear
  ctx.fillStyle = "#0b3d91";
  const cell = 22;
  for (let i = 0; i < 512 / cell; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(i * cell, 92, cell, 24);
    }
  }
  ctx.fillStyle = "#ffd400";
  for (let i = 0; i < 512 / cell; i++) {
    if (i % 2 !== 0) {
      ctx.fillRect(i * cell, 92, cell, 24);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
