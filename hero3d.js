// 3D service ring for the home hero. Loaded only on Home, after first paint, and only when WebGL works
// and the visitor has not asked for reduced motion (main.js decides). three.js is pinned in index.html's import map.
import * as THREE from "three";

const N = 6;
const TAU = Math.PI * 2;
const STEP = TAU / N;
const AUTO = STEP / 6; // one card every 6s
const CW = 1.5, CH = 2; // card size, 3:4
const { clamp, lerp } = THREE.MathUtils;
const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const easeOut = (t) => 1 - (1 - t) ** 3;

const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

function cardTexture(item, img, index) {
  const w = 480, h = 640, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.beginPath(); g.roundRect(0, 0, w, h, 36); g.clip();
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  g.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  g.fillStyle = "rgba(18,58,39,.16)"; g.fillRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, h * .38, 0, h);
  grad.addColorStop(0, "rgba(12,42,28,0)"); grad.addColorStop(1, "rgba(12,42,28,.94)");
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(255,255,255,.85)"; g.font = '600 28px "Barlow Condensed", sans-serif'; g.letterSpacing = "4px";
  g.fillText(String(index + 1).padStart(2, "0"), 32, 56);
  // title, wrapped on words, uppercase
  g.fillStyle = "#fff"; g.font = '700 74px "Barlow Condensed", sans-serif'; g.letterSpacing = "0px";
  const words = item.title.toUpperCase().split(" "), lines = [];
  let cur = "";
  for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (g.measureText(t).width > w - 64 && cur) { lines.push(cur); cur = wd; } else cur = t; }
  lines.push(cur);
  const subY = h - 40;
  g.fillStyle = "#dcb862"; g.font = '600 24px Inter, sans-serif'; g.letterSpacing = "3px";
  g.fillText(item.sub.toUpperCase(), 32, subY);
  g.fillStyle = "#fff"; g.font = '700 74px "Barlow Condensed", sans-serif'; g.letterSpacing = "0px";
  lines.reverse().forEach((l, i) => g.fillText(l, 32, subY - 44 - i * 70));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function frameTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 680;
  const g = c.getContext("2d");
  g.strokeStyle = "#c9a24a"; g.lineWidth = 12;
  g.beginPath(); g.roundRect(10, 10, 492, 660, 44); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function sealTexture() {
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.translate(S / 2, S / 2); g.rotate(-0.22);
  g.strokeStyle = g.fillStyle = "#dcb862"; g.lineWidth = 10;
  g.beginPath(); g.arc(0, 0, 236, 0, TAU); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 214, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, 124, 0, TAU); g.stroke();
  g.font = '700 54px "Barlow Condensed", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
  const ring = (text, r, from, to, flip) => {
    const n = text.length;
    for (let i = 0; i < n; i++) {
      const a = lerp(from, to, n === 1 ? .5 : i / (n - 1));
      g.save(); g.rotate(a); g.translate(0, flip ? r : -r); if (flip) g.rotate(Math.PI); g.fillText(text[i], 0, 0); g.restore();
    }
  };
  ring("MEEM TYPING & STAMPS", 170, -1.25, 1.25, false);
  ring("AJMAN · UAE", 170, -0.75, 0.75, true);
  g.font = '700 96px "Barlow Condensed", sans-serif'; g.fillText("MEEM", 0, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function start({ host, items, onActive, onFail, hero }) {
  await Promise.all([
    document.fonts.load('700 64px "Barlow Condensed"'),
    document.fonts.load('600 24px "Barlow Condensed"'),
    document.fonts.load('600 24px Inter'),
  ]).catch(() => {});
  const imgs = await Promise.all(items.map((it) => loadImg(it.img)));

  const coarse = matchMedia("(pointer: coarse)").matches;
  const phone = innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.25 : 1.5));
  const canvas = renderer.domElement;
  canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
  host.append(canvas);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stop(); onFail?.(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  const R = phone ? 2.1 : 2.5;
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xfff3d6, 2.4); sun.position.set(2, 3, 6); scene.add(sun);

  const tilt = new THREE.Group(); scene.add(tilt);
  const ring = new THREE.Group(); tilt.add(ring);
  const plane = new THREE.PlaneGeometry(CW, CH), framePlane = new THREE.PlaneGeometry(CW + 0.1, CH + 0.13);
  const fTex = frameTexture();
  const cards = items.map((it, i) => {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: cardTexture(it, imgs[i], i), transparent: true });
    const mesh = new THREE.Mesh(plane, mat); mesh.userData.i = i;
    const fMat = new THREE.MeshBasicMaterial({ map: fTex, transparent: true, opacity: 0, depthWrite: false });
    const frame = new THREE.Mesh(framePlane, fMat); frame.position.z = 0.004;
    grp.add(mesh, frame); ring.add(grp);
    return { grp, mesh, mat, fMat };
  });

  // Soft floor shadow under the ring and a teal glow behind it (like the plant's contact shadow in the reference)
  const radial = (stops, w = 256, h = 256) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, col]) => r.addColorStop(o, col)); g.fillStyle = r; g.fillRect(0, 0, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.6), new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(2,22,17,.55)"], [1, "rgba(2,22,17,0)"]]), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.32, 0.2); tilt.add(floor);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.4), new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(127,224,203,.34)"], [1, "rgba(127,224,203,0)"]]), transparent: true, depthWrite: false }));
  glow.position.set(0, 0, -1.6); tilt.add(glow);

  // Ambient: a few paper sheets and gold dust. Deliberately sparse and slow.
  const sheets = [];
  const sheetGeo = new THREE.PlaneGeometry(0.9, 1.2);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ color: 0xf6f3ea, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(lerp(-3.6, 3.6, Math.random()), lerp(-1.6, 1.6, Math.random()), lerp(-3.5, -1.2, Math.random()));
    m.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    m.userData.spin = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(0.12);
    scene.add(m); sheets.push(m);
  }
  const DUST = phone ? 50 : 90, dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dp[i * 3] = lerp(-4, 4, Math.random()); dp[i * 3 + 1] = lerp(-2.2, 2.2, Math.random()); dp[i * 3 + 2] = lerp(-2, 4, Math.random()); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xdcb862, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);

  // Stamp + seal (skipped on phones)
  let stamp = null, seal = null;
  if (!phone) {
    stamp = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a6230, roughness: 0.6 }));
    base.position.y = 0.08;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.5, 20), wood); neck.position.y = 0.41;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 16), wood); knob.position.y = 0.72;
    stamp.add(base, neck, knob);
    const holder = new THREE.Group(); holder.add(stamp);
    stamp = holder; stamp.children[0].rotation.set(Math.PI / 2, 0, 0); // up axis -> toward camera
    stamp.rotation.set(0.12, -0.25, 0.2); stamp.scale.setScalar(0.62); stamp.visible = false; scene.add(stamp);
    seal = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), new THREE.MeshBasicMaterial({ map: sealTexture(), transparent: true, opacity: 0, depthWrite: false }));
    seal.position.set(0.3, 0.6, 0.012);
  }

  // State
  let rot = 0, vel = 0, hold = 0, hover = false, dragging = false, active = -1, tween = null;
  let lastStamp = performance.now() + 2500, st = null;
  const pointer = { x: 0, y: 0 };
  const idxAt = () => { let b = 0, d = 9; for (let i = 0; i < N; i++) { const v = Math.abs(wrap(rot + i * STEP)); if (v < d) { d = v; b = i; } } return b; };
  const pause = (ms) => { hold = Math.max(hold, performance.now() + ms); };
  function goTo(i) {
    pause(5000);
    const target = -i * STEP, delta = wrap(target - rot);
    tween = { from: rot, to: rot + delta, t: 0, dur: clamp(Math.abs(delta) / 2, 0.35, 0.9) };
  }
  const step = (d) => goTo((idxAt() + d + N) % N);

  // Input: drag to spin, tap a card to bring it forward, mouse hover tilts and pauses.
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, last: e.clientX, moved: 0 }; dragging = true; tween = null; vel = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (down) { const dx = e.clientX - down.last; down.last = e.clientX; down.moved += Math.abs(dx); rot += dx * 0.006; vel = dx * 0.006 * 60; pause(3000); }
  });
  const release = (e) => {
    if (!down) return;
    const wasTap = down.moved < 6; dragging = false; canvas.style.cursor = "grab";
    if (wasTap) {
      const r = canvas.getBoundingClientRect(), ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera);
      const hit = rc.intersectObjects(cards.map((c) => c.mesh), false)[0];
      if (hit) goTo(hit.object.userData.i);
    } else {
      // settle onto the nearest card after the throw
      const proj = rot + vel * 0.25, i = Math.round(-proj / STEP);
      goTo(((i % N) + N) % N); vel = 0;
    }
    down = null;
  };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
  canvas.addEventListener("pointerleave", () => { hover = false; pointer.x = pointer.y = 0; });
  hero?.addEventListener("focusin", () => (hover = true)); hero?.addEventListener("focusout", () => (hover = false));

  // Layout
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const d = Math.max(4.0, 3.2 / camera.aspect);
    camera.position.set(0, 0.35, R + d); camera.lookAt(0, -0.05, 0);
  }
  new ResizeObserver(resize).observe(host); resize();

  // Frame loop
  const timer = new THREE.Timer(); timer.connect(document);
  const tmpV = new THREE.Vector3();
  function frame(ts) {
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 0.05), now = performance.now();
    if (tween) {
      tween.t += dt / tween.dur; const k = easeOut(Math.min(tween.t, 1)); rot = lerp(tween.from, tween.to, k);
      if (tween.t >= 1) tween = null;
    } else if (!dragging) {
      if (Math.abs(vel) > 0.01) { rot += vel * dt; vel *= 0.92; }
      else if (!hover && now > hold && !st) rot -= AUTO * dt;
    }
    let best = 0, bd = 9;
    cards.forEach((c, i) => {
      const a = rot + i * STEP, co = Math.cos(a);
      c.grp.position.set(Math.sin(a) * R, 0, co * R); c.grp.rotation.y = a;
      c.mat.color.setScalar(clamp((co + 0.35) / 1.35, 0.22, 1));
      const front = clamp((co - 0.94) / 0.06, 0, 1);
      c.fMat.opacity = front; c.grp.scale.setScalar(1 + 0.07 * front);
      const d = Math.abs(wrap(a)); if (d < bd) { bd = d; best = i; }
    });
    if (best !== active) { active = best; onActive?.(best); }
    tilt.rotation.y = lerp(tilt.rotation.y, pointer.x * 0.12, 0.06);
    tilt.rotation.x = lerp(tilt.rotation.x, pointer.y * 0.06, 0.06);
    const t = timer.getElapsed();
    sheets.forEach((s) => { s.rotation.x += s.userData.spin.x * dt; s.rotation.y += s.userData.spin.y * dt; s.rotation.z += s.userData.spin.z * dt; });
    const p = dust.geometry.attributes.position;
    for (let i = 0; i < DUST; i++) { let y = p.getY(i) + dt * 0.06; if (y > 2.4) y = -2.4; p.setY(i, y); }
    p.needsUpdate = true; dust.rotation.y = Math.sin(t * 0.1) * 0.1;

    // Stamp: press on the front card, leave a gold seal, then fade it. Only when idle and the card is centred.
    if (stamp) {
      if (!st && !hover && !dragging && !tween && now - lastStamp > 8000 && bd < 0.05) {
        st = { t: 0, card: cards[best] }; st.card.grp.add(seal); seal.material.opacity = 0; hold = now + 1900;
      }
      if (st) {
        st.t += dt; const T = st.t, surf = st.card.grp.position.z;
        const base = tmpV.copy(st.card.grp.position).add(new THREE.Vector3(0.3, 0.6, 0)).multiplyScalar(1);
        let lift = 1.4;
        if (T < 0.7) lift = lerp(1.4, 0.06, easeOut(T / 0.7)); else if (T < 0.85) lift = 0.06; else if (T < 1.5) lift = lerp(0.06, 1.4, ((T - 0.85) / 0.65) ** 2); else lift = 1.4;
        stamp.visible = T < 1.5; stamp.position.set(base.x, base.y, surf + lift);
        const pressed = T >= 0.7 && T < 1.1;
        st.card.grp.position.z -= pressed ? 0.02 : 0;
        if (T >= 0.72) { const k = clamp((T - 0.72) / 0.18, 0, 1); seal.scale.setScalar(lerp(1.15, 1, k)); seal.material.opacity = T < 3.2 ? k * 0.92 : Math.max(0, 0.92 * (1 - (T - 3.2) / 0.6)); }
        if (T > 3.8) { st.card.grp.remove(seal); seal.material.opacity = 0; stamp.visible = false; st = null; lastStamp = now; }
      }
    }
    renderer.render(scene, camera);
  }

  // Only render while the hero is on screen.
  let running = false;
  const go = () => { if (!running) { running = true; renderer.setAnimationLoop(frame); } };
  const stop = () => { running = false; renderer.setAnimationLoop(null); };
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? go() : stop()), { threshold: 0.05 });
  io.observe(hero || host);
  // Draw once immediately so the ring is there before the first intersection callback
  frame(performance.now());

  return {
    goTo, step,
    stampNow() { lastStamp = -1e9; }, // for testing: stamp as soon as a card is centred
    freeze() { io.disconnect(); stop(); frame(performance.now()); }, // for testing: render one frame and stop
    destroy() { stop(); io.disconnect(); renderer.dispose(); canvas.remove(); },
  };
}
