import * as THREE from "three";
import { createTaxiLiveryTexture, createPoliceLiveryTexture, createSignboardTexture } from "./textures";

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
 * Builds a stylized low-poly Toyota-Quantum-esque minibus silhouette from primitives:
 * body box, roof/window band, wheels, bumpers. A CanvasTexture livery band is applied
 * to the body sides for the "taxi stripe" / "JMPD Battenburg" look.
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

  // Main body (boxy minibus silhouette)
  const bodyW = 2.0;
  const bodyH = 1.45;
  const bodyL = 4.4;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW, bodyH, bodyL),
    [
      plainBodyMat, // +x
      plainBodyMat, // -x
      plainBodyMat, // +y (roof handled separately, keep plain)
      plainBodyMat, // -y
      bodyMat, // +z (front) show livery
      bodyMat, // -z (rear)
    ],
  );
  body.position.y = WHEEL_RADIUS + bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Side livery panels (flat boxes overlaid on left/right sides so the stripe reads clearly)
  const sideGeo = new THREE.PlaneGeometry(bodyL - 0.3, bodyH - 0.25);
  const leftPanel = new THREE.Mesh(sideGeo, bodyMat);
  leftPanel.position.set(bodyW / 2 + 0.006, body.position.y, 0);
  leftPanel.rotation.y = Math.PI / 2;
  group.add(leftPanel);
  const rightPanel = new THREE.Mesh(sideGeo, bodyMat);
  rightPanel.position.set(-bodyW / 2 - 0.006, body.position.y, 0);
  rightPanel.rotation.y = -Math.PI / 2;
  group.add(rightPanel);

  // Window band (upper greenhouse) - dark glass with a cool blue tint and a glossy,
  // slightly reflective finish so it reads clearly against the body livery.
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x16283a,
    emissive: 0x0a1520,
    emissiveIntensity: 0.4,
    roughness: 0.08,
    metalness: 0.85,
  });
  const windowBand = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW - 0.08, 0.5, bodyL - 0.6),
    windowMat,
  );
  windowBand.position.y = body.position.y + bodyH / 2 - 0.05;
  windowBand.castShadow = true;
  group.add(windowBand);

  // Roof cap
  const roofMat =
    opts.livery === "police"
      ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 })
      : new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4, metalness: 0.3 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.05, 0.16, bodyL - 0.5), roofMat);
  roof.position.y = windowBand.position.y + 0.33;
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
    redLightMesh.position.set(-0.22, roof.position.y + 0.16, 0);
    const blueLightMesh = new THREE.Mesh(barGeo, blueMat);
    blueLightMesh.position.set(0.22, roof.position.y + 0.16, 0);
    const barBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.08, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }),
    );
    barBase.position.set(0, roof.position.y + 0.1, 0);
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
  sign.position.set(0, roof.position.y + (opts.livery === "police" ? 0.34 : 0.17), bodyL * 0.12);
  sign.castShadow = true;
  group.add(sign);

  // Front & rear bumpers — kept narrower than the wheel track so the wheels visibly
  // poke out past the bumper corners from the chase-cam's straight-behind angle.
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.2 });
  const bumperGeo = new THREE.BoxGeometry(bodyW - 0.3, 0.32, 0.22);
  const frontBumper = new THREE.Mesh(bumperGeo, bumperMat);
  frontBumper.position.set(0, WHEEL_RADIUS + 0.1, bodyL / 2 + 0.05);
  frontBumper.castShadow = true;
  group.add(frontBumper);
  const rearBumper = new THREE.Mesh(bumperGeo, bumperMat);
  rearBumper.position.set(0, WHEEL_RADIUS + 0.1, -bodyL / 2 - 0.05);
  rearBumper.castShadow = true;
  group.add(rearBumper);

  // Headlights / taillights (small emissive boxes)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff8e0, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0x880000, emissiveIntensity: 1.0 });
  const lightGeo = new THREE.BoxGeometry(0.28, 0.16, 0.05);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(side * (bodyW / 2 - 0.25), body.position.y + 0.1, bodyL / 2 + 0.08);
    group.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(side * (bodyW / 2 - 0.25), body.position.y + 0.1, -bodyL / 2 - 0.08);
    group.add(tail);
  }

  // Wheels
  // Tire kept dark but not pure black, and a bright hub, so the wheel reads as a distinct
  // shape against the ground shadow instead of disappearing into it.
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.75, metalness: 0.1 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.7 });
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.32, 16);
  const hubGeo = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.45, WHEEL_RADIUS * 0.45, 0.34, 12);
  // Wheels sit slightly proud of the body sides (real minibus wheel-arch look) so they
  // stay visible past the body/bumper silhouette from directly behind — round 1's wheels
  // were flush with the body and vanished behind the (wider) bumper.
  const wheelPositions: [number, number][] = [
    [bodyW / 2 + 0.16, bodyL / 2 - 0.75],
    [-(bodyW / 2 + 0.16), bodyL / 2 - 0.75],
    [bodyW / 2 + 0.16, -bodyL / 2 + 0.75],
    [-(bodyW / 2 + 0.16), -bodyL / 2 + 0.75],
  ];
  for (const [x, z] of wheelPositions) {
    const wheelGroup = new THREE.Group();
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(wheel, hub);
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
