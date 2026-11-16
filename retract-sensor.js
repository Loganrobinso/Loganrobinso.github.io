// Interactive 3D model of the INL retractable sensor mechanism.
// Stylized reconstruction from the project poster (not the CAD): dimensions are approximate, in mm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function mountRetractableSensor(host, {
  mm = 0.01,                       // scene units per mm
  railX = [115, 395],              // rail stops (mm along the machine)
  stroke = [150, 355],             // carriage travel between the limit switches
  wireY = 30,                      // height of the drive / thermocouple line
  sheathLength = 440,              // thermocouple sheath ahead of the carriage
  tubeStart = 490,                 // where the 1/8" guide tube leaves the end bracket
  turnAt = 560,                    // the tube turns away from the viewer here...
  turnRadius = 130,                // ...with this bend radius
  offset = [380, 520, 40],         // offset section along the run: start, end (mm from the turn), sideways shift
  tubeRun = 1400,                  // how far the tube runs toward the test assembly before fading
  tubeRadius = 2.2,                // drawn slightly thicker than 1/8" so it reads on screen
  moveSeconds = 3.2,               // one insert or retract stroke
  holdSeconds = 1.3,               // pause at each limit switch
  accent = 0x22e3ff,
  showLabels = true,
  reducedMotion = false,
  cameraPos = [6.9, 3.1, 5.3],     // scene units
  cameraTarget = [3.7, 0.25, -1.1],
} = {}) {
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(34, W() / H(), 0.05, 100);
  camera.position.set(...cameraPos);

  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 0.9); rim.position.set(-4, 2, -5); scene.add(rim);

  const mat = {
    alu:   new THREE.MeshStandardMaterial({ color: 0xb9c1c9, metalness: 0.85, roughness: 0.35 }),
    pla:   new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.0, roughness: 0.65 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xa3acb6, metalness: 0.95, roughness: 0.25 }),
    can:   new THREE.MeshStandardMaterial({ color: 0xcfd5dc, metalness: 0.9, roughness: 0.3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 0.9, roughness: 0.35 }),
    sw:    new THREE.MeshStandardMaterial({ color: 0x2a3a8f, roughness: 0.5 }),
    coil:  new THREE.MeshStandardMaterial({ color: 0xe8c93a, roughness: 0.5 }),
    tube:  new THREE.MeshPhysicalMaterial({ color: 0xc8d0d8, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false, emissive: accent, emissiveIntensity: 0.18 }),
    sheath:new THREE.MeshStandardMaterial({ color: 0xe3e7ec, metalness: 0.9, roughness: 0.2, emissive: accent, emissiveIntensity: 0.12 }),
    tip:   new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.2 }),
  };
  const root = new THREE.Group(); root.scale.setScalar(mm); scene.add(root);
  const box = (sx, sy, sz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); root.add(o); return o; };
  const cyl = (r, h, m, x, y, z, axis = 'y', seg = 32) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z);
    if (axis === 'x') o.rotation.z = Math.PI / 2; if (axis === 'z') o.rotation.x = Math.PI / 2; root.add(o); return o;
  };

  // 1" T-slot extrusion along x (cross-section in y-z, slots on all four faces)
  const a = 12.7, s = 3.1, d = 6;
  const prof = new THREE.Shape();
  [[-a,-a],[-s,-a],[-s,-a+d],[s,-a+d],[s,-a],[a,-a],[a,-s],[a-d,-s],[a-d,s],[a,s],[a,a],[s,a],[s,a-d],[-s,a-d],[-s,a],[-a,a],[-a,s],[-a+d,s],[-a+d,-s],[-a,-s]]
    .forEach(([u, v], i) => i ? prof.lineTo(u, v) : prof.moveTo(u, v));
  const hole = new THREE.Path(); hole.absarc(0, 0, 2.6, 0, Math.PI * 2); prof.holes.push(hole);
  const ext = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: 500, bevelEnabled: false }), mat.alu);
  ext.rotation.y = Math.PI / 2; ext.position.set(0, 0, 0); root.add(ext);
  const top = a;

  // drive: printed bracket, geared 12 V motor, MIG push-pull drive rolls, tension latch
  box(84, 12, 58, mat.pla, 58, top + 6, 0);
  box(30, 10, 34, mat.pla, 58, wireY + 10, -20);
  const rollR = 14;
  const rolls = [-1, 1].map(sgn => {
    const g = new THREE.Group(); g.position.set(60, wireY, sgn * (rollR + 0.8)); root.add(g);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(rollR, rollR, 9, 24), mat.steel); g.add(r);
    const groove = new THREE.Mesh(new THREE.TorusGeometry(rollR, 1.3, 8, 24), mat.brass); groove.rotation.x = Math.PI / 2; g.add(groove);
    for (let k = 0; k < 6; k++) { const n = new THREE.Mesh(new THREE.BoxGeometry(2, 9.4, 6), mat.pla); n.position.set(Math.cos(k * Math.PI / 3) * 6, 0, Math.sin(k * Math.PI / 3) * 6); g.add(n); }
    return g;
  });
  box(56, 5, 16, mat.pla, 64, wireY + 9, 0);
  cyl(5, 10, mat.brass, 84, wireY + 15, 0);
  cyl(17, 22, mat.pla, 60, top - 2, -38);                 // gearbox
  cyl(16, 46, mat.can, 60, top - 36, -38);                // motor can
  cyl(4, 6, mat.brass, 60, top - 62, -38);
  // push wire from the drive rolls to the carriage (moves with the carriage)
  const pushLen = 380;
  const push = cyl(0.7, pushLen, mat.steel, 0, wireY, 0, 'x', 10);

  // linear rail, end stops with limit switches and status LEDs (red = retracted, green = inserted)
  box(railX[1] - railX[0], 6, 9, mat.steel, (railX[0] + railX[1]) / 2, top + 3, 0);
  const stops = railX.map((x, i) => {
    box(10, 26, 34, mat.pla, x, top + 13, 0);
    const sw = box(8, 8, 6, mat.sw, x + (i ? -9 : 9), top + 13, 13);
    const lever = box(1.2, 1.2, 10, mat.steel, x + (i ? -14 : 14), top + 17, 13);
    const led = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12),
      new THREE.MeshStandardMaterial({ color: i ? 0x1fd17a : 0xff4040, emissive: i ? 0x1fd17a : 0xff4040, emissiveIntensity: 0.05 }));
    led.position.set(x, top + 28, 8); root.add(led);
    return { sw, lever, led };
  });

  // carriage (rides the rail, clamps the thermocouple, carries the extension-wire connector)
  const car = new THREE.Group(); root.add(car);
  const carBody = new THREE.Mesh(new THREE.BoxGeometry(40, 22, 34), mat.pla); carBody.position.y = top + 6 + 11; car.add(carBody);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 12), mat.alu); clamp.position.set(10, wireY + 9, 0); car.add(clamp);
  const conn = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 10), mat.coil); conn.position.set(16, wireY, 21); car.add(conn);

  // end bracket: constant-force spring and guide-tube support
  const bx = 478;
  box(18, 42, 52, mat.pla, bx, top + 21, 0);
  const springRoll = cyl(10, 8, mat.steel, bx - 2, wireY + 4, -16, 'z');
  const band = box(1, 0.4, 7, mat.steel, 0, wireY + 13.6, -16); band.geometry.translate(0.5, 0, 0);

  // coiled extension wire between the carriage connector and the end bracket (stretches with travel)
  const helixGeo = (length, turns, radius, wire) => {
    const pts = [], n = turns * 20;
    for (let i = 0; i <= n; i++) { const t = i / n, ang = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(t * length, Math.sin(ang) * radius, Math.cos(ang) * radius)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 6);
  };
  const coilZ = 25;                // runs beside the rail so it clears the end stops
  const helix = new THREE.Mesh(helixGeo(100, 12, 5, 0.9), mat.coil); let helixLen = 100;
  root.add(helix);

  // thermocouple path: straight through the rig, a bend away from the viewer, then the long guide tube
  const r = turnRadius, k = 0.5523 * r, [o0, o1, osh] = offset;
  const zt = -r, xt = turnAt + r;
  const P = (x, z) => new THREE.Vector3(x, wireY, z);
  const run = [
    new THREE.CubicBezierCurve3(P(turnAt, 0), P(turnAt + k, 0), P(xt, zt + k), P(xt, zt)),
    new THREE.LineCurve3(P(xt, zt), P(xt, zt - o0)),
    new THREE.CubicBezierCurve3(P(xt, zt - o0), P(xt, zt - (o0 + o1) / 2), P(xt + osh, zt - (o0 + o1) / 2), P(xt + osh, zt - o1)),
    new THREE.LineCurve3(P(xt + osh, zt - o1), P(xt + osh, zt - tubeRun)),
  ];
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(P(stroke[0], 0), P(turnAt, 0))); run.forEach(c => path.add(c));
  const pathLen = path.getLength(), segs = Math.round(pathLen / 4), radial = 10;
  const sheathGeo = new THREE.TubeGeometry(path, segs, 0.8, radial, false);
  const sheath = new THREE.Mesh(sheathGeo, mat.sheath); root.add(sheath);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 10), mat.tip); root.add(tip);
  const tipLight = new THREE.PointLight(accent, 1.2, 1.4); scene.add(tipLight);

  const tubePath = new THREE.CurvePath();
  tubePath.add(new THREE.LineCurve3(P(tubeStart, 0), P(turnAt, 0))); run.forEach(c => tubePath.add(c));
  root.add(new THREE.Mesh(new THREE.TubeGeometry(tubePath, Math.round(tubePath.getLength() / 4), tubeRadius, 14, false), mat.tube));

  // Tron floor: a faint cyan grid that fades into the distance
  const grid = new THREE.GridHelper(3200, 64, accent, accent);
  grid.material.transparent = true; grid.material.opacity = 0.16; grid.material.depthWrite = false;
  grid.position.set(400, -70, -600); root.add(grid);
  scene.fog = new THREE.Fog(0x07090c, 7, 19);

  // labels (HTML overlay, projected each frame)
  const labels = [];
  const label = (text, get) => { const el = document.createElement('div'); el.className = 'rs-label'; el.textContent = text; host.appendChild(el); labels.push({ el, get }); };
  const v = (x, y, z) => () => new THREE.Vector3(x, y, z);
  label('12 V motor + MIG drive rolls', v(60, wireY + 22, 0));
  label('carriage', () => new THREE.Vector3(car.position.x, top + 30, 0));
  label('coiled extension wire', () => new THREE.Vector3((car.position.x + 20 + bx - 9) / 2, wireY - 6, coilZ + 12));
  label('constant-force spring', v(bx + 4, top + 44, -16));
  label('1/8" guide tube → 20 ft to the test assembly', v(xt + 6, wireY + 8, zt - 150));
  label('thermocouple tip', () => tip.position.clone().divideScalar(1));
  const toScreen = new THREE.Vector3();
  const placeLabels = () => {
    labels.forEach(({ el, get }) => {
      toScreen.copy(get()).multiplyScalar(mm).project(camera);
      const vis = showLabels && toScreen.z < 1 && Math.abs(toScreen.x) < 1.02 && Math.abs(toScreen.y) < 1.02;
      el.style.opacity = vis ? 1 : 0;
      const w = el.offsetWidth, h = el.offsetHeight, pad = 6;
      const x = Math.min(Math.max((toScreen.x * 0.5 + 0.5) * W() - w / 2, pad), W() - w - pad);
      const y = Math.min(Math.max((-toScreen.y * 0.5 + 0.5) * H() - h * 1.2, pad + 22), H() - h - pad);
      el.style.transform = `translate(${x}px,${y}px)`;
    });
  };

  // state readout
  const status = document.createElement('div'); status.className = 'rs-status'; host.appendChild(status);

  // pose the mechanism for a carriage position x (mm); returns tip position
  let lastX = stroke[0];
  const pose = (x) => {
    car.position.x = x;
    push.position.x = x - 20 - pushLen / 2;
    const dx = x - lastX; lastX = x;
    rolls.forEach((g, i) => { g.rotation.y += (i ? -1 : 1) * dx / rollR; });
    const coilA = x + 22, coilB = bx - 9;
    helix.position.set(coilA, wireY, coilZ);
    const L = Math.max(coilB - coilA, 1);
    if (Math.abs(L - helixLen) > 0.5) { helix.geometry.dispose(); helix.geometry = helixGeo(L, 12, 5, 0.9); helixLen = L; }
    band.position.x = x + 20; band.scale.x = Math.max(bx - 12 - (x + 20), 1);
    springRoll.rotation.y += -dx / 10;
    const s0 = x + 17 - stroke[0], s1 = Math.min(s0 + sheathLength, pathLen);
    const j0 = Math.floor(s0 / pathLen * segs), j1 = Math.ceil(s1 / pathLen * segs);
    sheathGeo.setDrawRange(j0 * radial * 6, (j1 - j0) * radial * 6);
    tip.position.copy(path.getPointAt(s1 / pathLen));
    tipLight.position.copy(tip.position).multiplyScalar(mm);
    const atIn = x >= stroke[1] - 0.5, atOut = x <= stroke[0] + 0.5;
    stops[0].led.material.emissiveIntensity = atOut ? 2.5 : 0.05;
    stops[1].led.material.emissiveIntensity = atIn ? 2.5 : 0.05;
    stops[0].lever.rotation.y = atOut ? 0.35 : 0; stops[1].lever.rotation.y = atIn ? -0.35 : 0;
  };

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...cameraTarget); controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 2.5; controls.maxDistance = 16; controls.maxPolarAngle = Math.PI * 0.62;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse) { controls.enabled = false; controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = 0.6; }
  controls.update();

  // insert / hold / retract / hold cycle
  const cycle = 2 * (moveSeconds + holdSeconds);
  const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const carriageAt = (t) => {
    const u = t % cycle, [x0, x1] = stroke;
    if (u < holdSeconds) return [x0, 'retracted · red limit lit'];
    if (u < holdSeconds + moveSeconds) return [x0 + (x1 - x0) * ease((u - holdSeconds) / moveSeconds), 'inserting'];
    if (u < 2 * holdSeconds + moveSeconds) return [x1, 'inserted · green limit lit'];
    return [x1 - (x1 - x0) * ease((u - 2 * holdSeconds - moveSeconds) / moveSeconds), 'retracting'];
  };

  let running = false, t0 = performance.now(), paused = 0, raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const t = reducedMotion ? holdSeconds + moveSeconds * 0.6 : (now - t0) / 1000;
    const [x, st] = carriageAt(t); pose(x); status.textContent = reducedMotion ? 'drag to rotate' : st;
    controls.update(); renderer.render(scene, camera); placeLabels();
  };
  const start = () => { if (!running) { running = true; t0 = performance.now() - paused; raf = requestAnimationFrame(frame); } };
  const stop = () => { if (running) { running = false; paused = performance.now() - t0; cancelAnimationFrame(raf); } };
  pose(stroke[0]);

  const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
  ro.observe(host);
  return { start, stop, setLabels: (on) => { showLabels = on; } };
}
