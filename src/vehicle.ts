import * as THREE from "three";
import {
  createTaxiLiveryTexture,
  createPoliceLiveryTexture,
  createSignboardTexture,
  createWindowPaneTexture,
  createWheelHubTexture,
} from "./textures";

export interface MinibusOptions {
  bodyColor: number;
  livery: "taxi" | "police";
  stripeColor?: string;
}

export interface PoliceFlashers {
  redMat: THREE.MeshStandardMaterial;
  blueMat: THREE.MeshStandardMaterial;
  redLight: THREE.PointLight;
  blueLight: THREE.PointLight;
}

export interface Minibus {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  flashers?: PoliceFlashers;
}

const WHEEL_RADIUS = 0.42;

/**
 * Builds a triangular-prism "wedge" solid (a real slanted surface, not a flat decal)
 * that bridges the cabin roofline down to the lower hood line, so the windshield rake
 * is an actual geometric step in the silhouette instead of a painted-on plane sitting
 * flush against a vertical box face.
 *   backZ/backY   -> the back-top corner (meets the cabin roof edge)
 *   frontZ/frontY -> the front-bottom corner (meets the hood's top-front edge)
 * The third corner of the cross-section triangle is the right angle at (backZ, frontY).
 */
function buildWedge(width: number, backZ: number, backY: number, frontZ: number, frontY: number): THREE.BufferGeometry {
  const hw = width / 2;
  const A0 = [-hw, backY, backZ];
  const A1 = [hw, backY, backZ];
  const B0 = [-hw, frontY, frontZ];
  const B1 = [hw, frontY, frontZ];
  const C0 = [-hw, frontY, backZ];
  const C1 = [hw, frontY, backZ];

  const verts: number[] = [];
  const pushTri = (p0: number[], p1: number[], p2: number[]) => {
    verts.push(...p0, ...p1, ...p2);
  };
  // Slanted top surface (the visible "windshield" ramp).
  pushTri(A0, B0, B1);
  pushTri(A0, B1, A1);
  // Bottom surface (sits on the hood roof line).
  pushTri(C0, C1, B1);
  pushTri(C0, B1, B0);
  // Back surface (meets the cabin front wall).
  pushTri(A0, A1, C1);
  pushTri(A0, C1, C0);
  // End caps (triangles closing the left/right sides).
  pushTri(A0, C0, B0);
  pushTri(A1, B1, C1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a trapezoidal "frustum" box: narrower at the top than the bottom (a genuine
 * tumblehome taper), instead of a uniform rectangular box. Used for the rear panel so the
 * silhouette actually narrows toward the roofline when viewed dead-on from behind — the
 * one angle the fixed rear-chase camera actually uses on every straight stretch of road.
 * Face/material index order matches THREE.BoxGeometry's convention (+x,-x,+y,-y,+z,-z) so
 * it's a drop-in replacement for a BoxGeometry + material-array mesh.
 */
function buildTaperedBox(bottomWidth: number, topWidth: number, height: number, depth: number): THREE.BufferGeometry {
  const hwB = bottomWidth / 2;
  const hwT = topWidth / 2;
  const hh = height / 2;
  const hd = depth / 2;
  // Bottom (y=-hh) is full width; top (y=+hh) is narrower.
  const B0 = [-hwB, -hh, -hd];
  const B1 = [hwB, -hh, -hd];
  const B2 = [hwB, -hh, hd];
  const B3 = [-hwB, -hh, hd];
  const T0 = [-hwT, hh, -hd];
  const T1 = [hwT, hh, -hd];
  const T2 = [hwT, hh, hd];
  const T3 = [-hwT, hh, hd];

  const positions: number[] = [];
  const uvs: number[] = [];
  const groups: { start: number; count: number; materialIndex: number }[] = [];
  const pushQuad = (p0: number[], p1: number[], p2: number[], p3: number[], materialIndex: number) => {
    const start = positions.length / 3;
    positions.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    groups.push({ start, count: 6, materialIndex });
  };
  // +x (right side, sloped inward toward the top)
  pushQuad(B1, T1, T2, B2, 0);
  // -x (left side, sloped inward toward the top)
  pushQuad(B3, T3, T0, B0, 1);
  // +y (top cap)
  pushQuad(T0, T3, T2, T1, 2);
  // -y (bottom cap)
  pushQuad(B0, B1, B2, B3, 3);
  // +z (front face)
  pushQuad(B2, T2, T3, B3, 4);
  // -z (back face — this is the panel that gets the livery texture)
  pushQuad(B0, T0, T1, B1, 5);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  for (const g of groups) {
    geo.addGroup(g.start, g.count, g.materialIndex);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Adds four thin diagonal strips across each vertical edge of a box region, faking a
 * chamfered/rounded corner via an extra angled face rather than a perfectly sharp 90°. */
function addCornerChamfers(
  group: THREE.Group,
  halfW: number,
  height: number,
  centerY: number,
  zBack: number,
  zFront: number,
  mat: THREE.Material,
) {
  const size = 0.15;
  const geo = new THREE.BoxGeometry(size, height, size);
  const corners: [number, number][] = [
    [halfW, zBack],
    [halfW, zFront],
    [-halfW, zBack],
    [-halfW, zFront],
  ];
  for (const [x, z] of corners) {
    const strip = new THREE.Mesh(geo, mat);
    strip.position.set(x, centerY, z);
    strip.rotation.y = Math.PI / 4;
    strip.castShadow = true;
    group.add(strip);
  }
}

/**
 * Builds a stylized low-poly Toyota-Quantum-esque minibus silhouette. Unlike earlier
 * rounds, the body is NOT a single uniform box: it is three box segments of different
 * width/height (rear panel, tall cabin, lower/narrower hood) joined by a sloped wedge
 * solid at the cabin/hood step, plus chamfer strips softening the sharpest vertical
 * edges — so the silhouette actually reads as a vehicle profile (hood lower than the
 * roofline, raked windscreen step, non-90-degree corners) rather than a delivery van.
 */
export function createMinibus(opts: MinibusOptions): Minibus {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const liveryTex =
    opts.livery === "taxi"
      ? createTaxiLiveryTexture(opts.stripeColor ?? "#e8b400")
      : createPoliceLiveryTexture();
  liveryTex.wrapS = THREE.RepeatWrapping;
  liveryTex.wrapT = THREE.ClampToEdgeWrapping;
  liveryTex.repeat.set(1, 1);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.35,
  });
  const plainBodyMat = new THREE.MeshStandardMaterial({
    color: opts.bodyColor,
    roughness: 0.45,
    metalness: 0.35,
  });

  // ---- Body silhouette: rear box (full height) + cabin box (full height) + hood box
  // (lower & narrower), instead of one uniform box. Camera is a fixed rear-chase view,
  // so the rear box gets the most silhouette/edge treatment (chamfers) since it's what's
  // actually in frame; the hood only needs to read correctly in side/3-quarter profile
  // during lane changes.
  const bodyW = 2.0;
  const bodyH = 1.45;
  const bodyL = 4.4;
  const hoodH = bodyH * 0.62;
  const hoodW = bodyW * 0.88;
  const rearLen = 1.05;
  const hoodLen = 1.05;
  const cabinLen = bodyL - rearLen - hoodLen;

  const rearZ0 = -bodyL / 2;
  const rearZ1 = rearZ0 + rearLen;
  const cabinZ0 = rearZ1;
  const cabinZ1 = cabinZ0 + cabinLen;
  const hoodZ0 = cabinZ1;
  const hoodZ1 = bodyL / 2;

  const fullTopY = WHEEL_RADIUS + bodyH;
  const hoodTopY = WHEEL_RADIUS + hoodH;

  // Rear section — this is the face dead-center in the fixed rear-chase camera essentially
  // the whole game, so unlike round 4 (a full-width/full-height box with only chamfered
  // edges) it's now a genuine tapered frustum: full width at the bumper, ~30% narrower at
  // the roofline. That taper is a real silhouette change visible from directly behind on
  // every straight stretch, not just during a banked lane change.
  const rearTopW = bodyW * 0.7;
  const rearBox = new THREE.Mesh(buildTaperedBox(bodyW, rearTopW, bodyH, rearLen), [
    plainBodyMat,
    plainBodyMat,
    plainBodyMat,
    plainBodyMat,
    plainBodyMat,
    bodyMat,
  ]);
  rearBox.position.set(0, WHEEL_RADIUS + bodyH / 2, (rearZ0 + rearZ1) / 2);
  rearBox.castShadow = true;
  rearBox.receiveShadow = true;
  group.add(rearBox);

  // Cabin midsection — same height/width as the rear (raised roofline), forms the
  // passenger box between the tapered rear and the lower hood.
  const cabinBox = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, cabinLen), plainBodyMat);
  cabinBox.position.set(0, WHEEL_RADIUS + bodyH / 2, (cabinZ0 + cabinZ1) / 2);
  cabinBox.castShadow = true;
  cabinBox.receiveShadow = true;
  group.add(cabinBox);
  addCornerChamfers(group, bodyW / 2, bodyH, cabinBox.position.y, cabinZ0, cabinZ1, plainBodyMat);

  // Hood/nose section — lower and narrower than the cabin, giving the profile an
  // actual taper toward the front instead of a uniform rectangular van box.
  const hoodBox = new THREE.Mesh(
    new THREE.BoxGeometry(hoodW, hoodH, hoodLen),
    [plainBodyMat, plainBodyMat, plainBodyMat, plainBodyMat, bodyMat, plainBodyMat],
  );
  hoodBox.position.set(0, WHEEL_RADIUS + hoodH / 2, (hoodZ0 + hoodZ1) / 2);
  hoodBox.castShadow = true;
  hoodBox.receiveShadow = true;
  group.add(hoodBox);

  // Windshield wedge: a real sloped solid (not a decal) bridging the cabin roof down to
  // the hood's top-front edge, giving the profile a genuine windshield-rake step.
  const wedgeGeo = buildWedge(hoodW * 0.97, cabinZ1, fullTopY, hoodZ0 + hoodLen * 0.55, hoodTopY);
  // Glass-tinted (not flat black) since the elevated chase cam actually sees down over
  // the roof onto this slope — it reads as the windshield surface itself.
  const wedgeMat = new THREE.MeshStandardMaterial({
    color: 0x6fa0c2,
    emissive: 0x0a1520,
    emissiveIntensity: 0.2,
    roughness: 0.15,
    metalness: 0.6,
  });
  const wedge = new THREE.Mesh(wedgeGeo, wedgeMat);
  wedge.castShadow = true;
  group.add(wedge);

  // Side livery panels (flat decals overlaid on the rear+cabin sides so the checker
  // stripe reads clearly there — this is where the chase cam and lane-change lean
  // actually see the vehicle).
  const sideLen = rearLen + cabinLen;
  const sideGeo = new THREE.PlaneGeometry(sideLen - 0.3, bodyH - 0.25);
  const sideZCenter = (rearZ0 + cabinZ1) / 2;
  const leftPanel = new THREE.Mesh(sideGeo, bodyMat);
  leftPanel.position.set(bodyW / 2 + 0.006, rearBox.position.y, sideZCenter);
  leftPanel.rotation.y = Math.PI / 2;
  group.add(leftPanel);
  const rightPanel = new THREE.Mesh(sideGeo, bodyMat);
  rightPanel.position.set(-bodyW / 2 - 0.006, rearBox.position.y, sideZCenter);
  rightPanel.rotation.y = -Math.PI / 2;
  group.add(rightPanel);

  // Window band (upper greenhouse) over the rear+cabin roofline — tinted glass with
  // pillar lines breaking it into individual panes.
  const windowLen = sideLen - 0.3;
  const paneCount = Math.max(4, Math.round(windowLen / 0.7));
  const windowTex = createWindowPaneTexture(paneCount);
  const windowMat = new THREE.MeshStandardMaterial({
    map: windowTex,
    color: 0xffffff,
    emissive: 0x0a1520,
    emissiveIntensity: 0.15,
    roughness: 0.12,
    metalness: 0.75,
    envMapIntensity: 1.4,
  });
  const windowSideMat = new THREE.MeshStandardMaterial({
    color: 0x16283a,
    roughness: 0.15,
    metalness: 0.75,
  });
  // Narrower than the body (continues the rear taper upward into the greenhouse) so the
  // front/back window-band caps step inward instead of matching the full body width.
  const windowBandW = bodyW * 0.82;
  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(windowBandW, 0.5, windowLen), [
    windowSideMat,
    windowSideMat,
    windowSideMat,
    windowSideMat,
    windowMat,
    windowMat,
  ]);
  windowBand.position.y = fullTopY - 0.05;
  windowBand.position.z = sideZCenter;
  windowBand.castShadow = true;
  group.add(windowBand);

  // Side glass panels (wrap the pane texture around the left/right sides too).
  const sideWindowGeo = new THREE.PlaneGeometry(windowLen - 0.4, 0.42);
  const leftWindow = new THREE.Mesh(sideWindowGeo, windowMat);
  leftWindow.position.set(bodyW / 2 + 0.012, windowBand.position.y, sideZCenter);
  leftWindow.rotation.y = Math.PI / 2;
  group.add(leftWindow);
  const rightWindow = new THREE.Mesh(sideWindowGeo, windowMat);
  rightWindow.position.set(-bodyW / 2 - 0.012, windowBand.position.y, sideZCenter);
  rightWindow.rotation.y = -Math.PI / 2;
  group.add(rightWindow);

  // Small angled windshield glass decal sitting on the wedge's slanted face (glass look
  // on top of the real geometric step, rather than being the only thing creating it).
  const windshieldGeo = new THREE.PlaneGeometry(hoodW - 0.1, 0.5);
  const windshield = new THREE.Mesh(windshieldGeo, windowMat);
  const wedgeMidZ = (cabinZ1 + (hoodZ0 + hoodLen * 0.55)) / 2;
  const wedgeMidY = (fullTopY + hoodTopY) / 2;
  windshield.position.set(0, wedgeMidY + 0.02, wedgeMidZ);
  const rakeAngle = Math.atan2(fullTopY - hoodTopY, cabinZ1 - (hoodZ0 + hoodLen * 0.55));
  windshield.rotation.x = -(Math.PI / 2 - Math.abs(rakeAngle));
  windshield.castShadow = true;
  group.add(windshield);

  // Roof cap
  const roofMat =
    opts.livery === "police"
      ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 })
      : new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4, metalness: 0.3 });
  const roofW = bodyW * 0.66;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.16, windowLen - 0.15), roofMat);
  roof.position.y = windowBand.position.y + 0.33;
  roof.position.z = sideZCenter;
  roof.castShadow = true;
  group.add(roof);

  let flashers: PoliceFlashers | undefined;

  if (opts.livery === "police") {
    // Light bar on roof: alternating red/blue boxes that actually cast light, plus emissive glow.
    const barGroup = new THREE.Group();
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xff1a1a,
      emissive: 0xff1a1a,
      emissiveIntensity: 1.6,
      roughness: 0.3,
    });
    const blueMat = new THREE.MeshStandardMaterial({
      color: 0x1a4dff,
      emissive: 0x1a4dff,
      emissiveIntensity: 1.6,
      roughness: 0.3,
    });
    const barGeo = new THREE.BoxGeometry(0.28, 0.16, 0.5);
    const redLightMesh = new THREE.Mesh(barGeo, redMat);
    redLightMesh.position.set(-0.22, roof.position.y + 0.16, roof.position.z);
    const blueLightMesh = new THREE.Mesh(barGeo, blueMat);
    blueLightMesh.position.set(0.22, roof.position.y + 0.16, roof.position.z);
    const barBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.08, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }),
    );
    barBase.position.set(0, roof.position.y + 0.1, roof.position.z);
    const redLight = new THREE.PointLight(0xff2222, 3.5, 6, 2);
    redLight.position.copy(redLightMesh.position);
    const blueLight = new THREE.PointLight(0x2244ff, 3.5, 6, 2);
    blueLight.position.copy(blueLightMesh.position);
    barGroup.add(barBase, redLightMesh, blueLightMesh, redLight, blueLight);
    barGroup.children.forEach((c) => {
      if (c instanceof THREE.Mesh) c.castShadow = true;
    });
    group.add(barGroup);
    flashers = { redMat, blueMat, redLight, blueLight };
  }

  // Roof sign / signage box: raised block above the roof — taxi route board or police
  // "POLICE" light-bar label — visible above the silhouette from the chase-cam angle.
  const signTex = createSignboardTexture(
    opts.livery === "police" ? "POLICE" : "TAXI",
    opts.livery === "police" ? "#0b3d91" : "#e8b400",
    "#ffffff",
  );
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: opts.livery === "police" ? 0x0b3d91 : 0xe8b400,
    emissiveMap: signTex,
    emissiveIntensity: 0.5,
    roughness: 0.4,
  });
  const signSideMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  const signGeo = new THREE.BoxGeometry(1.1, 0.34, 0.32);
  const sign = new THREE.Mesh(signGeo, [signSideMat, signSideMat, signSideMat, signSideMat, signMat, signMat]);
  sign.position.set(0, roof.position.y + (opts.livery === "police" ? 0.34 : 0.17), sideZCenter + bodyL * 0.06);
  sign.castShadow = true;
  group.add(sign);

  // Front & rear bumpers — kept narrower than the wheel track so the wheels visibly
  // poke out past the bumper corners from the chase-cam's straight-behind angle.
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.2 });
  const rearBumperGeo = new THREE.BoxGeometry(bodyW - 0.3, 0.32, 0.22);
  const frontBumperGeo = new THREE.BoxGeometry(hoodW - 0.2, 0.28, 0.2);
  const frontBumper = new THREE.Mesh(frontBumperGeo, bumperMat);
  frontBumper.position.set(0, WHEEL_RADIUS + 0.1, hoodZ1 + 0.05);
  frontBumper.castShadow = true;
  group.add(frontBumper);
  const rearBumper = new THREE.Mesh(rearBumperGeo, bumperMat);
  rearBumper.position.set(0, WHEEL_RADIUS + 0.1, rearZ0 - 0.05);
  rearBumper.castShadow = true;
  group.add(rearBumper);

  // Headlights / taillights (small emissive boxes)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff8e0, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0x880000, emissiveIntensity: 1.0 });
  const lightGeo = new THREE.BoxGeometry(0.28, 0.16, 0.05);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(side * (hoodW / 2 - 0.22), hoodBox.position.y, hoodZ1 + 0.08);
    group.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(side * (bodyW / 2 - 0.25), rearBox.position.y, rearZ0 - 0.08);
    group.add(tail);
  }

  // Wheels
  // Tire kept dark but not pure black. A separate lighter/metallic hub cap AND a proud
  // chrome rim ring (torus) sit outside the tire face, so there's a real 3D light-catching
  // edge rather than a flat texture trying to fake rim/spoke detail.
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.75, metalness: 0.1 });
  const hubTex = createWheelHubTexture();
  const hubMat = new THREE.MeshStandardMaterial({ map: hubTex, roughness: 0.35, metalness: 0.6 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    emissive: 0x333333,
    emissiveIntensity: 0.25,
    roughness: 0.12,
    metalness: 0.95,
  });
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.32, 20);
  const hubGeo = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, 0.4, 20);
  // Proud chrome rim ring: sits right at the tire's outer face plane, with a thick tube
  // sticking well out past the flat tire disc — an actual protruding, light-catching 3D
  // edge (brightened with a touch of emissive so it still reads in the vehicle's own
  // shadow), not reliant on a texture map to fake the highlight.
  const rimGeo = new THREE.TorusGeometry(WHEEL_RADIUS * 0.82, WHEEL_RADIUS * 0.16, 8, 20);
  // Spoke bars: the torus rim alone is rotationally symmetric, so a spinning wheel with
  // only a rim looks static — nothing on it changes as it rotates. Three bars crossing
  // through the hub (six visible arms) give the wheel real asymmetric detail so rotation
  // is actually visible as the spokes sweep around each frame.
  const spokeMat = new THREE.MeshStandardMaterial({
    color: 0xd8d8d8,
    roughness: 0.3,
    metalness: 0.85,
  });
  const spokeGeo = new THREE.BoxGeometry(0.07, WHEEL_RADIUS * 1.5, 0.06);
  // Wheels sit slightly proud of the body sides (real minibus wheel-arch look) so they
  // stay visible past the body/bumper silhouette from directly behind.
  const wheelPositions: [number, number][] = [
    [bodyW / 2 + 0.16, hoodZ1 - 0.75],
    [-(bodyW / 2 + 0.16), hoodZ1 - 0.75],
    [bodyW / 2 + 0.16, rearZ0 + 0.75],
    [-(bodyW / 2 + 0.16), rearZ0 + 0.75],
  ];
  for (const [x, z] of wheelPositions) {
    const wheelGroup = new THREE.Group();
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(wheel, hub);
    // Rim rings on both axle faces (both sides are visible at different points during
    // lane changes / camera lean, so both get the proud ring rather than guessing side).
    for (const faceOffset of [0.16, -0.16]) {
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.y = Math.PI / 2;
      rim.position.x = faceOffset;
      rim.castShadow = true;
      wheelGroup.add(rim);
      // 3 bars through the hub center, offset 60° apart, = 6 spoke arms sweeping the
      // wheel face as wheelGroup spins about its local X axis in the animation loop.
      for (let s = 0; s < 3; s++) {
        const spoke = new THREE.Mesh(spokeGeo, spokeMat);
        spoke.position.x = faceOffset;
        spoke.rotation.x = (s * Math.PI) / 3;
        spoke.castShadow = true;
        wheelGroup.add(spoke);
      }
    }
    wheelGroup.position.set(x, WHEEL_RADIUS, z);
    group.add(wheelGroup);
    wheels.push(wheelGroup);
  }

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
    }
  });

  return { group, wheels, flashers };
}
