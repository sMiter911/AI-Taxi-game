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
 * Minibus taxi livery: bold two-tone body with a body-wide Battenburg-style
 * checker field covering the lower half of the panel (not a thin bumper
 * strip), a solid accent band with "TAXI" route signage lettering above it —
 * the classic Johannesburg minibus-taxi look.
 */
export function createTaxiLiveryTexture(stripeColor: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 256);

  // White/cream upper body base.
  ctx.fillStyle = "#f7f7f4";
  ctx.fillRect(0, 0, 512, 256);

  // Body-wide checker field across the lower ~45% of the panel — large cells,
  // full width and full remaining height so it reads as a livery pattern
  // covering the body, not a decorative accent line.
  const checkTop = 148;
  const cell = 32;
  const cols = Math.ceil(512 / cell);
  const rows = Math.ceil((256 - checkTop) / cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? stripeColor : "#141414";
      ctx.fillRect(c * cell, checkTop + r * cell, cell, cell);
    }
  }

  // Solid accent band separating the checker field from the upper body,
  // carrying the "TAXI" route signage lettering.
  ctx.fillStyle = stripeColor;
  ctx.fillRect(0, checkTop - 46, 512, 46);
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, checkTop - 50, 512, 4);
  ctx.fillRect(0, checkTop - 4, 512, 4);
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TAXI", 130, checkTop - 23);
  ctx.fillText("TAXI", 390, checkTop - 23);
  ctx.beginPath();
  ctx.arc(256, checkTop - 23, 14, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Window-band texture: tinted glass panes separated by dark pillar bars so
 * the greenhouse reads as individual windows rather than one flat black
 * rectangle. Tiled along the body length via texture.repeat.
 */
export function createWindowPaneTexture(paneCount = 6): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 128);
  // Glass base with a subtle vertical gradient for a cheap "reflection" read.
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#8fb8d6");
  grad.addColorStop(0.35, "#3f6a86");
  grad.addColorStop(1, "#182d3c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);

  // Diagonal glare streak.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, 90);
  ctx.lineTo(180, 0);
  ctx.lineTo(240, 0);
  ctx.lineTo(60, 128);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Pillar bars between individual panes.
  const paneW = 512 / paneCount;
  ctx.fillStyle = "#12181d";
  for (let i = 0; i <= paneCount; i++) {
    const x = Math.round(i * paneW);
    ctx.fillRect(x - 3, 0, 6, 128);
  }
  // Top/bottom window-frame trim.
  ctx.fillRect(0, 0, 512, 6);
  ctx.fillRect(0, 122, 512, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial spoke pattern for a wheel hub/rim so rotation is visually readable. */
export function createWheelHubTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, 128, 128);
  const cx = 64;
  const cy = 64;
  ctx.translate(cx, cy);
  const spokes = 5;
  ctx.fillStyle = "#d8d8d8";
  for (let i = 0; i < spokes; i++) {
    ctx.save();
    ctx.rotate((i / spokes) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -4);
    ctx.lineTo(4, -58);
    ctx.lineTo(-4, -58);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.fillStyle = "#eaeaea";
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#555555";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Outer tire rim ring for contrast against the dark tire.
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 61, 0, Math.PI * 2);
  ctx.stroke();

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

/** Police livery: body-wide blue/yellow Battenburg checker field with "POLICE" lettering across a solid band. */
export function createPoliceLiveryTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 256);

  // Body-wide Battenburg checker field across the lower ~45% of the panel.
  const checkTop = 148;
  const cell = 26;
  const cols = Math.ceil(512 / cell);
  const rows = Math.ceil((256 - checkTop) / cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#0b3d91" : "#ffd400";
      ctx.fillRect(c * cell, checkTop + r * cell, cell, cell);
    }
  }

  // Solid navy "POLICE" band above the checker field.
  ctx.fillStyle = "#0b3d91";
  ctx.fillRect(0, checkTop - 46, 512, 46);
  ctx.fillStyle = "#ffd400";
  ctx.fillRect(0, checkTop - 50, 512, 4);
  ctx.fillRect(0, checkTop - 4, 512, 4);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("P O L I C E", 256, checkTop - 23);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
