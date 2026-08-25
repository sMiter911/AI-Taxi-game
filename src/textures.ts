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

/** Simple brick/window pattern for building facades, with a lit/unlit window mix for character. */
export function createBuildingFacadeTexture(baseColor: string, windowColor: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 256);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  const winW = 14;
  const winH = 20;
  const gapX = 10;
  const gapY = 16;
  for (let y = gapY; y < 256 - winH; y += winH + gapY) {
    for (let x = gapX; x < 128 - winW; x += winW + gapX) {
      const r = Math.random();
      if (r > 0.85) continue; // occasional missing pane
      // Most windows are the dark/glass base color; a few glow warm (lit interior) for life.
      ctx.fillStyle = r > 0.72 ? "#ffce7a" : windowColor;
      ctx.fillRect(x, y, winW, winH);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Minibus taxi livery: bold two-tone body with a diagonal accent stripe, a
 * Battenburg-style checker band, and "TAXI" route signage lettering — the
 * classic Johannesburg minibus-taxi look, not a single stripe.
 */
export function createTaxiLiveryTexture(stripeColor: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 256);

  // White body base.
  ctx.fillStyle = "#f7f7f4";
  ctx.fillRect(0, 0, 512, 256);

  // Bold diagonal accent band.
  ctx.save();
  ctx.translate(0, 110);
  ctx.rotate(-0.09);
  ctx.fillStyle = stripeColor;
  ctx.fillRect(-60, 0, 700, 54);
  ctx.fillStyle = "#141414";
  ctx.fillRect(-60, 54, 700, 8);
  ctx.restore();

  // "TAXI" route signage lettering on the accent band.
  ctx.save();
  ctx.translate(0, 110);
  ctx.rotate(-0.09);
  ctx.fillStyle = "#141414";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TAXI", 350, 27);
  ctx.restore();

  // Battenburg-style checker band low on the body.
  const checkY = 190;
  const checkH = 40;
  const cell = 24;
  for (let i = 0; i < 512 / cell; i++) {
    ctx.fillStyle = i % 2 === 0 ? stripeColor : "#141414";
    ctx.fillRect(i * cell, checkY, cell, checkH);
  }
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, checkY - 4, 512, 4);
  ctx.fillRect(0, checkY + checkH, 512, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Small roof-sign decal: bold colored background with centered lettering (taxi route board / police light-bar label). */
export function createSignboardTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 96);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = fg;
  ctx.font = "bold 46px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Police livery: bold blue/yellow Battenburg checker with "POLICE" lettering across the band. */
export function createPoliceLiveryTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#0b3d91";
  ctx.fillRect(0, 84, 512, 72);
  ctx.fillStyle = "#ffd400";
  ctx.fillRect(0, 80, 512, 6);
  ctx.fillRect(0, 154, 512, 6);
  // Battenburg checker blocks at front/rear of the band.
  const cell = 22;
  for (let i = 0; i < 512 / cell; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#0b3d91" : "#ffd400";
    ctx.fillRect(i * cell, 88, cell, 26);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("P O L I C E", 256, 138);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
