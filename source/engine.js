/* ================================================ the vault (WebGL)
   Linear HDR pipeline: planar floor reflection -> lit scene (MSAA) -> dual-filter bloom -> ACES, fringe, vignette, dither.
   Surfaces are lit in the shader from every nearby lamp: a grazing uplight stripe on its own wall,
   bounce from those stripes onto everything else, the two rings as line lights, and the visitor's torch. */
const V = (function vault() {
  const canvas = $("#vault");
  const nogl = () => { document.documentElement.classList.add("nogl"); return null; };
  if (!window.THREE) return nogl();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false }); } catch (e) { return nogl(); }
  const gl = renderer.getContext(); if (!gl) return nogl();
  const caps = renderer.capabilities, ext = renderer.extensions;
  const HDR = (caps.isWebGL2 && ext.has("EXT_color_buffer_float")) || ext.has("EXT_color_buffer_half_float");
  const FT = HDR ? THREE.HalfFloatType : THREE.UnsignedByteType;
  let DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(1); renderer.autoClear = true;

  const FOG = 0.024, FOV = 55, SPAN = 2 * Math.tan(FOV * Math.PI / 360);
  const W = 11, HH = 9, BAY = 3.4, Z0 = 24, RING_R = 3.2, RING_Y = 4.4, LAMP_Y = 0.62;
  const DOOR_Z = Z0 - 16 * BAY;
  const CHZ = (k) => DOOR_Z - (5 + k * 4) * BAY;
  const NB = 16 + 5 + 6 * 4 + 7, Z1 = Z0 - NB * BAY, LEN = Z0 - Z1, zc = (Z0 + Z1) / 2;
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const LAMP = lin(0xB7F05E), RINGC = lin(0xC8FF7A);

  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 420);
  const aniso = caps.getMaxAnisotropy();
  function tex(w, h, draw, rx = 1, ry = 1, srgb = true) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = aniso; if (srgb) t.encoding = THREE.sRGBEncoding; return t;
  }
  function grit(g, w, h, n, a, lo = 0, hi = 255) { for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? hi : lo; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } }

  /* ---------------- lamp state lives in a tiny texture the shaders read */
  const lampData = new Uint8Array(NB * 2 * 4), lampTex = new THREE.DataTexture(lampData, NB, 2, THREE.RGBAFormat);
  lampTex.magFilter = lampTex.minFilter = THREE.NearestFilter; lampTex.needsUpdate = true;
  const U = {
    uLamp: { value: lampTex }, uNB: { value: NB }, uBay: { value: BAY }, uZ0: { value: Z0 }, uW: { value: W }, uLampY: { value: LAMP_Y },
    uLampCol: { value: new THREE.Vector3(LAMP.r, LAMP.g, LAMP.b).multiplyScalar(4.2) },
    uRingCol: { value: new THREE.Vector3(RINGC.r, RINGC.g, RINGC.b) },
    uRing0: { value: new THREE.Vector4(0, RING_Y, DOOR_Z + 0.12, 1) }, uRing1: { value: new THREE.Vector4(0, RING_Y, Z1 + 0.5, 0) }, uRingR: { value: new THREE.Vector2(RING_R, RING_R) },
    uDoorZ: { value: DOOR_Z }, uDoorOpen: { value: 0 }, uTorch: { value: new THREE.Vector4(0, 3, 10, 0) }, uAmb: { value: new THREE.Vector3(0.0009, 0.0013, 0.001) },
    uMirror: { value: 1 }, uFog: { value: FOG }, uTime: { value: 0 },
  };
  const LIGHT = `
    uniform sampler2D uLamp; uniform float uNB, uBay, uZ0, uW, uLampY; uniform vec3 uLampCol, uRingCol;
    uniform vec4 uRing0, uRing1, uTorch; uniform vec2 uRingR; uniform float uDoorZ, uDoorOpen; uniform vec3 uAmb;
    float lampI(float k, float s){ if (k < 0.0 || k > uNB - 1.0) return 0.0; return texture2D(uLamp, vec2((k + 0.5) / uNB, s < 0.0 ? 0.25 : 0.75)).r * 2.0; }
    float gate(float pz, float lz){ return (pz - uDoorZ) * (lz - uDoorZ) < 0.0 ? uDoorOpen * 0.16 : 1.0; }
    float prof(float h){ return h < 0.0 ? 0.0 : 0.16 + 0.84 * exp(-h / 2.3); }
    // each lit stripe of wall behaves like a soft vertical line light; this is the bounce everything else receives
    vec3 bounce(vec3 P, vec3 N){
      vec3 sum = vec3(0.0); float kc = floor((uZ0 - P.z) / uBay);
      for (int j = -3; j <= 3; j++) {
        float k = kc + float(j); float zk = uZ0 - (k + 0.5) * uBay;
        for (int q = 0; q < 2; q++) {
          float s = q == 0 ? -1.0 : 1.0; float I = lampI(k, s); if (I <= 0.0) continue; I *= gate(P.z, zk);
          vec3 C = vec3(s * (uW * 0.5 - 0.07), clamp(P.y, uLampY + 0.06, uLampY + 6.8), zk);
          vec3 L = C - P; float d2 = dot(L, L) + 0.04; vec3 l = L * inversesqrt(d2);
          float rc = max(dot(N, l), 0.0);
          vec3 F = vec3(s * (uW * 0.5 - 0.16), uLampY + 0.05, zk); vec3 Lf = F - P; float f2 = dot(Lf, Lf) + 0.02;
          float lens = max(dot(N, Lf * inversesqrt(f2)), 0.0) * 0.022 / f2;
          sum += I * (rc * prof(C.y - uLampY) * 0.075 / (d2 + 0.25 * d2 * d2 * 0.02) + lens);
        }
      }
      return sum * uLampCol;
    }
    vec3 ringL(vec3 P, vec3 N, vec4 R, float rad){
      if (R.w <= 0.001) return vec3(0.0);
      vec3 d = P - R.xyz; float r = length(d.xy); vec2 dir = r > 1e-4 ? d.xy / r : vec2(0.0, -1.0);
      vec3 np = R.xyz + vec3(dir * rad, 0.0); vec3 L = np - P; float d2 = dot(L, L) + 0.03;
      vec3 Lc = R.xyz - P; float c2 = dot(Lc, Lc) + 1.0;
      return uRingCol * R.w * (max(dot(N, L * inversesqrt(d2)), 0.0) * 0.9 / pow(d2, 0.8) + max(dot(N, Lc * inversesqrt(c2)), 0.0) * rad * 0.35 / c2);
    }
    vec3 lightAt(vec3 P, vec3 N){
      vec3 E = uAmb + bounce(P, N) + ringL(P, N, uRing0, uRingR.x) + ringL(P, N, uRing1, uRingR.y);
      vec3 Lt = uTorch.xyz - P; float t2 = dot(Lt, Lt) + 0.6; E += vec3(0.55, 0.75, 0.45) * uTorch.w * max(dot(N, Lt * inversesqrt(t2)), 0.0) / t2;
      return E;
    }
    // the uplight on this wall: a beam that widens with height, energy spread over its width, plus a soft wash and the lens glare
    vec3 stripes(vec3 P, vec3 N, float s){
      vec3 sum = vec3(0.0); float kc = floor((uZ0 - P.z) / uBay); vec3 n0 = vec3(-s, 0.0, 0.0);
      for (int j = -2; j <= 2; j++) {
        float k = kc + float(j); float I = lampI(k, s); if (I <= 0.0) continue;
        float zk = uZ0 - (k + 0.5) * uBay; I *= gate(P.z, zk);
        float h = P.y - uLampY, hp = max(h, 0.0), dz = P.z - zk;
        float pr = prof(h), sg = 0.05 + hp * 0.012, core = exp(-dz * dz / (2.0 * sg * sg)) * (0.05 / sg) * pr;
        float sw = 0.24 + hp * 0.04, wash = exp(-dz * dz / (2.0 * sw * sw)) * (0.12 / sw) * pr + exp(-dz * dz / 0.7) * 0.22 * exp(-hp / 0.7);
        float on = smoothstep(-0.06, 0.22, h);
        vec3 F = vec3(s * (uW * 0.5 - 0.16), uLampY + 0.05, zk); vec3 L = F - P; float d2 = dot(L, L);
        float glare = 0.006 / (d2 + 0.003);
        vec3 l = L * inversesqrt(d2 + 1e-4);
        float relief = clamp(1.0 + 3.4 * dot(N - n0, l), 0.2, 2.4);
        sum += I * ((core + wash) * on + glare) * relief;
      }
      return sum * uLampCol;
    }`;
  const VERT = `
    uniform float uMirror; varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec2 vUv; varying vec3 vRaw;
    void main(){
      mat4 M = modelMatrix;
      #ifdef USE_INSTANCING
        M = modelMatrix * instanceMatrix;
      #endif
      vec4 w = M * vec4(position, 1.0); vec4 mv = viewMatrix * w; vRaw = w.xyz;
      vN = normalize(mat3(M) * normal); vT = normalize(mat3(M) * vec3(1.0, 0.0, 0.0)); vW = w.xyz;
      if (uMirror < 0.0) { vW.y = -vW.y; vN.y = -vN.y; vT.y = -vT.y; }
      vUv = uv; gl_Position = projectionMatrix * mv;
    }`;
  const FRAG = `
    ${LIGHT}
    uniform sampler2D map, hmap; uniform vec2 uRep, uTexel; uniform float uRelief, uSide, uAlb, uFog; uniform vec3 uEmit;
    #ifdef FLOOR
      uniform sampler2D tRefl; uniform vec2 uRes; uniform float uRough;
    #endif
    varying vec3 vW; varying vec3 vN; varying vec3 vT; varying vec2 vUv; varying vec3 vRaw;
    void main(){
      float vDist = length(vRaw - cameraPosition);
      vec2 uv = vUv * uRep;
      vec3 alb = pow(texture2D(map, uv).rgb, vec3(2.2)) * uAlb;
      float h0 = texture2D(hmap, uv).r, hx = texture2D(hmap, uv + vec2(uTexel.x, 0.0)).r, hy = texture2D(hmap, uv + vec2(0.0, uTexel.y)).r;
      vec3 B = normalize(cross(vN, vT)), N = normalize(vN - (hx - h0) * uRelief * vT - (hy - h0) * uRelief * B);
      if (!gl_FrontFacing) N = -N;
      vec3 E = lightAt(vW, N);
      #ifdef WALL
        E += stripes(vW, N, uSide);
      #endif
      vec3 col = alb * E + uEmit;
      #ifdef FLOOR
        vec2 suv = gl_FragCoord.xy / uRes + (N.xz - vec2(0.0)) * 0.012;
        vec3 R = vec3(0.0); float ws = 0.0;
        for (int i = 0; i < 9; i++) { float f = float(i) - 4.0; float w = exp(-f * f / 7.0); vec2 o = vec2(0.0, f * uRough * 0.004);
          R += (texture2D(tRefl, suv + o + vec2(-0.0011, 0.0)).rgb + texture2D(tRefl, suv + o + vec2(0.0011, 0.0)).rgb) * w; ws += 2.0 * w; }
        R /= ws;
        vec3 V = normalize(cameraPosition - vW); float ct = clamp(V.y, 0.0, 1.0);
        float F = 0.035 + 0.965 * pow(1.0 - ct, 5.0); float seam = smoothstep(0.25, 0.55, h0);
        col = col * (1.0 - F) + R * F * mix(0.35, 0.95, seam);
      #endif
      col = mix(vec3(0.0004, 0.0007, 0.0005), col, exp(-pow(uFog * vDist, 2.0)));
      gl_FragColor = vec4(col, 1.0);
    }`;
  function surf(opts) {
    const d = {}; if (opts.wall) d.WALL = ""; if (opts.floor) d.FLOOR = "";
    const m = new THREE.ShaderMaterial({
      defines: d, vertexShader: VERT, fragmentShader: FRAG, side: opts.side || THREE.FrontSide,
      uniforms: Object.assign({}, U, {
        map: { value: opts.map }, hmap: { value: opts.hmap || opts.map }, uRep: { value: new THREE.Vector2(...(opts.rep || [1, 1])) },
        uTexel: { value: new THREE.Vector2(1 / (opts.hw || 512), 1 / (opts.hh || 512)) }, uRelief: { value: opts.relief ?? 1.2 }, uSide: { value: opts.wallSide || 0 },
        uAlb: { value: opts.alb ?? 1 }, uEmit: { value: opts.emit || new THREE.Vector3() },
        tRefl: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uRough: { value: 1 },
      }),
    });
    return m;
  }

  /* ---------------- shell */
  const wallA = tex(256, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#6a6f6b"); bg.addColorStop(1, "#757a75");
    g.fillStyle = bg; g.fillRect(0, 0, w, h); grit(g, w, h, 5000, 0.12, 40, 150);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(0,0,0,${0.05 * rnd()})`; g.fillRect(rnd() * w, 0, 1 + rnd() * 3, h); }
    g.fillStyle = "#2a2e2b"; g.fillRect(0, 0, 4, h); [0.34, 0.67].forEach((f) => g.fillRect(0, h * f, w, 3));
  }, NB, 1);
  const wallH = tex(256, 512, (g, w, h) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); grit(g, w, h, 7000, 0.18, 90, 170);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${0},${0},0)`; }
    for (let i = 0; i < 60; i++) { const v = rnd() < 0.5 ? 100 : 150; g.fillStyle = `rgba(${v},${v},${v},.25)`; g.fillRect(rnd() * w, 0, 1, h); }
    const groove = (x, y, ww, hh) => { g.fillStyle = "#1e1e1e"; g.fillRect(x, y, ww, hh); };
    groove(0, 0, 4, h); [0.34, 0.67].forEach((f) => groove(0, h * f, w, 3));
    [[14, 0.34 * h - 12], [w - 14, 0.34 * h - 12], [14, 0.67 * h + 14], [w - 14, 0.67 * h + 14], [14, 18], [w - 14, 18], [14, h - 18], [w - 14, h - 18]].forEach(([x, y]) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, 5); rg.addColorStop(0, "#f4f4f4"); rg.addColorStop(1, "#808080"); g.fillStyle = rg; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    });
  }, NB, 1, false);
  const floorA = tex(512, 256, (g, w, h) => { g.fillStyle = "#2c302d"; g.fillRect(0, 0, w, h); grit(g, w, h, 4000, 0.1, 10, 90); g.fillStyle = "#101210"; g.fillRect(0, 0, w, 2); [128, 256, 384].forEach((x) => g.fillRect(x, 0, 2, h)); }, 1, NB);
  const floorH = tex(512, 256, (g, w, h) => { g.fillStyle = "#909090"; g.fillRect(0, 0, w, h); grit(g, w, h, 3000, 0.15, 70, 180); g.fillStyle = "#101010"; g.fillRect(0, 0, w, 3); [128, 256, 384].forEach((x) => g.fillRect(x - 1, 0, 3, h)); }, 1, NB, false);
  const ceilA = tex(512, 256, (g, w, h) => { g.fillStyle = "#4a4e4b"; g.fillRect(0, 0, w, h); grit(g, w, h, 2000, 0.1); g.fillStyle = "#1a1c1b"; g.fillRect(0, 0, w, 4); g.fillRect(w / 2 - 2, 0, 4, h); }, 1, NB);
  const mk = (geo, mat, pos, rot, parent = world) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); parent.add(m); return m; };
  const wallOpt = { map: wallA, hmap: wallH, rep: [NB, 1], hw: 256, hh: 512, relief: 2.6, alb: 0.75, wall: true };
  mk(new THREE.PlaneGeometry(LEN, HH), surf(Object.assign({}, wallOpt, { wallSide: -1 })), [-W / 2, HH / 2, zc], [0, Math.PI / 2, 0]);
  mk(new THREE.PlaneGeometry(LEN, HH), surf(Object.assign({}, wallOpt, { wallSide: 1 })), [W / 2, HH / 2, zc], [0, -Math.PI / 2, 0]);
  const floorMat = surf({ map: floorA, hmap: floorH, rep: [1, NB], hw: 512, hh: 256, relief: 1.4, alb: 0.5, floor: true });
  const floor = mk(new THREE.PlaneGeometry(W, LEN), floorMat, [0, 0, zc], [-Math.PI / 2, 0, 0]);
  mk(new THREE.PlaneGeometry(W, LEN), surf({ map: ceilA, rep: [1, NB], hw: 512, hh: 256, relief: 0.8, alb: 0.6 }), [0, HH, zc], [Math.PI / 2, 0, 0]);

  /* ---------------- lamp fixtures: housing + lens (HDR emissive, it is what blooms) + the beam in the haze */
  const NL = NB * 2, L = [];
  for (let k = 0; k < NB; k++) { const z = Z0 - (k + 0.5) * BAY; [-1, 1].forEach((s) => L.push({ k, z, s, cur: 0, on: Infinity, boost: 0, inside: z < DOOR_Z })); }
  const housingMat = surf({ map: tex(64, 64, (g) => { g.fillStyle = "#3a3f3b"; g.fillRect(0, 0, 64, 64); grit(g, 64, 64, 300, 0.2); }), relief: 0.5, alb: 0.9 });
  const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.16, 0.34), housingMat, NL);
  const lens = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }), NL);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), black = new THREE.Color(0, 0, 0);
  L.forEach((l, i) => {
    q.setFromEuler(e3.set(0, 0, 0)); m4.compose(new THREE.Vector3(l.s * (W / 2 - 0.21), LAMP_Y - 0.03, l.z), q, one); housing.setMatrixAt(i, m4);
    q.setFromEuler(e3.set(-Math.PI / 2, 0, l.s * 0.0)); m4.compose(new THREE.Vector3(l.s * (W / 2 - 0.16), LAMP_Y + 0.052, l.z), q, one); lens.setMatrixAt(i, m4); lens.setColorAt(i, black);
  });
  world.add(housing); world.add(lens);
  const TL = 6.8, tgeo = new THREE.CylinderGeometry(0.02, 0.02, TL, 10, 32, false), tIdx = new Float32Array(NL * 2);
  L.forEach((l, i) => tIdx.set([l.k, l.s], i * 2)); tgeo.setAttribute("aIdx", new THREE.InstancedBufferAttribute(tIdx, 2));
  const tubes = new THREE.InstancedMesh(tgeo, new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uTL: { value: TL } }),
    vertexShader: `attribute vec2 aIdx; uniform sampler2D uLamp; uniform float uNB, uTL, uDoorZ, uDoorOpen; varying float vH; varying float vI; varying float vD;
      void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vec4 mv = viewMatrix * w; vD = length(mv.xyz); vH = position.y / uTL + 0.5;
        vI = texture2D(uLamp, vec2((aIdx.x + 0.5) / uNB, aIdx.y < 0.0 ? 0.25 : 0.75)).r * 2.0; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uLampCol; uniform float uTL, uFog; varying float vH; varying float vI; varying float vD;
      void main(){ float h = vH * uTL; float p = 0.16 + 0.84 * exp(-h / 2.3); float tip = smoothstep(1.0, 0.93, vH);
        vec3 c = uLampCol * vI * p * 1.5 * tip; c = mix(vec3(0.0004, 0.0007, 0.0005), c, exp(-pow(uFog * vD, 2.0))); gl_FragColor = vec4(c, 1.0); }`,
  }), NL);
  L.forEach((l, i) => { q.setFromEuler(e3.set(0, 0, 0)); m4.compose(new THREE.Vector3(l.s * (W / 2 - 0.07), LAMP_Y + 0.06 + TL / 2, l.z), q, one); tubes.setMatrixAt(i, m4); });
  world.add(tubes);
  const bgeo = new THREE.InstancedBufferGeometry(); bgeo.copy(new THREE.PlaneGeometry(1, 1, 1, 24)); bgeo.instanceCount = NL;
  const aBase = new Float32Array(NL * 3), aIdx = new Float32Array(NL * 2);
  L.forEach((l, i) => { aBase.set([l.s * (W / 2 - 0.12), LAMP_Y, l.z], i * 3); aIdx.set([l.k, l.s], i * 2); });
  bgeo.setAttribute("aBase", new THREE.InstancedBufferAttribute(aBase, 3)); bgeo.setAttribute("aIdx", new THREE.InstancedBufferAttribute(aIdx, 2));
  const beamMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uHaze: { value: 0.16 } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform sampler2D uLamp; uniform float uNB, uFog, uMirror, uDoorZ, uDoorOpen; attribute vec3 aBase; attribute vec2 aIdx; varying float vA; varying float vX; varying float vH;
      void main(){
        float h = (position.y + 0.5) * 7.4; vec3 cp = cameraPosition; if (uMirror < 0.0) cp.y = -cp.y;
        vec2 tc = normalize(cp.xz - aBase.xz); vec2 rt = vec2(-tc.y, tc.x);
        float w = 0.03 + h * 0.032; vec3 p = aBase + vec3(rt.x * position.x * w * 2.4, h, rt.y * position.x * w * 2.4);
        float I = texture2D(uLamp, vec2((aIdx.x + 0.5) / uNB, aIdx.y < 0.0 ? 0.25 : 0.75)).r * 2.0;
        if ((cp.z - uDoorZ) * (aBase.z - uDoorZ) < 0.0) I *= uDoorOpen;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = I * exp(-pow(uFog * length(mv.xyz), 2.0)) / (1.0 + h * h * 0.05) * smoothstep(0.0, 0.5, h); vX = position.x * 2.0; vH = h;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uLampCol; uniform float uHaze; varying float vA; varying float vX; varying float vH;
      void main(){ float a = exp(-vX * vX * 5.0) * vA * uHaze * 0.010; gl_FragColor = vec4(uLampCol * a, 1.0); }`,
  });
  world.add(Object.assign(new THREE.Mesh(bgeo, beamMat), { frustumCulled: false }));

  /* ---------------- motes: round, drifting, and only bright where a beam crosses them */
  const DN = reduce ? 0 : 1800, dp = new Float32Array(DN * 3), dS = new Float32Array(DN), dP = new Float32Array(DN);
  for (let i = 0; i < DN; i++) { dp[i * 3] = (rnd() - 0.5) * (W - 0.6); dp[i * 3 + 1] = rnd() * HH; dp[i * 3 + 2] = Z0 - rnd() * LEN; dS[i] = 0.014 + rnd() * rnd() * 0.05; dP[i] = rnd(); }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute("position", new THREE.BufferAttribute(dp, 3)); dgeo.setAttribute("aS", new THREE.BufferAttribute(dS, 1)); dgeo.setAttribute("aP", new THREE.BufferAttribute(dP, 1));
  const uScale = { value: 800 }, dustLit = { value: 0.3 };
  const dust = new THREE.Points(dgeo, new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uScale, uH: { value: HH - 0.3 }, uLit: dustLit }),
    vertexShader: `${LIGHT}
      attribute float aS; attribute float aP; uniform float uTime, uScale, uFog, uH; varying float vA;
      void main(){ vec3 p = position; float sp = 0.035 + 0.06 * fract(aP * 7.31);
        p.y = mod(p.y + uTime * sp, uH); p.x += sin(uTime * 0.31 + aP * 6.283) * 0.25; p.z += cos(uTime * 0.23 + aP * 4.1) * 0.2;
        float kc = floor((uZ0 - p.z) / uBay); float lit = 0.0;
        for (int j = -1; j <= 1; j++) { float k = kc + float(j); float zk = uZ0 - (k + 0.5) * uBay;
          for (int q = 0; q < 2; q++) { float s = q == 0 ? -1.0 : 1.0; float I = lampI(k, s); if (I <= 0.0) continue;
            float hh = max(p.y - uLampY, 0.0); float wdt = 0.22 + hh * 0.03; vec2 d = vec2(p.x - s * (uW * 0.5 - 0.12), p.z - zk);
            lit += I * exp(-dot(d, d) / (wdt * wdt)) / (1.0 + hh * hh * 0.05); } }
        vec3 rd = p - uRing0.xyz; float rr = abs(length(rd.xy) - uRingR.x); lit += uRing0.w * 0.4 * exp(-(rr * rr + rd.z * rd.z) * 0.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = max(-mv.z, 0.3);
        float tw = 0.5 + 0.5 * sin(uTime * (1.1 + aP * 1.7) + aP * 40.0);
        vA = (0.06 + lit * 1.6) * (0.6 + 0.4 * tw) * smoothstep(0.0, 0.6, p.y) * smoothstep(uH, uH - 1.4, p.y) * exp(-pow(uFog * d, 2.0));
        gl_PointSize = clamp(aS * uScale / d, 1.0, 48.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uLampCol; uniform float uLit; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; float a = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r)); if (a < 0.003) discard;
        gl_FragColor = vec4(uLampCol * 0.06 * a * vA * uLit, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  world.add(dust);

  /* ---------------- burst of dust off the door seam when it opens */
  const BN = reduce ? 0 : 700, bp = new Float32Array(BN * 3), bv = new Float32Array(BN * 3), bs = new Float32Array(BN);
  for (let i = 0; i < BN; i++) { const a = rnd() * Math.PI * 2, r = RING_R * (0.96 + rnd() * 0.06); bp.set([Math.cos(a) * r, RING_Y + Math.sin(a) * r, DOOR_Z + 0.2], i * 3); const sp = 0.4 + rnd() * 1.6; bv.set([Math.cos(a) * sp * 0.6 + (rnd() - 0.5) * 0.4, Math.sin(a) * sp * 0.5 + rnd() * 0.3, 0.6 + rnd() * 2.2], i * 3); bs[i] = 0.02 + rnd() * 0.05; }
  const bgeo2 = new THREE.BufferGeometry(); bgeo2.setAttribute("position", new THREE.BufferAttribute(bp, 3)); bgeo2.setAttribute("aV", new THREE.BufferAttribute(bv, 3)); bgeo2.setAttribute("aS", new THREE.BufferAttribute(bs, 1));
  const burstT = { value: -10 };
  const burst = new THREE.Points(bgeo2, new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uScale, uBT: burstT }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aV; attribute float aS; uniform float uTime, uBT, uScale, uFog; varying float vA;
      void main(){ float t = uTime - uBT; float k = 1.6; vec3 p = position + aV * (1.0 - exp(-k * t)) / k + vec3(0.0, -0.18 * t * t, 0.0); p.y = max(p.y, 0.02);
        vA = t < 0.0 ? 0.0 : smoothstep(0.0, 0.15, t) * exp(-t * 0.55); vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = max(-mv.z, 0.3);
        vA *= exp(-pow(uFog * d, 2.0)); gl_PointSize = clamp(aS * uScale / d, 1.0, 40.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uRingCol; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c, c) * 20.0); if (a * vA < 0.003) discard; gl_FragColor = vec4(uRingCol * 0.5 * a * vA, 1.0); }`,
  }));
  burst.frustumCulled = false; world.add(burst);

  /* ---------------- rings (HDR emissive; they also light the room through ringL) */
  function ring(z) {
    const grp = new THREE.Group(); grp.position.set(0, RING_Y, z); world.add(grp);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    grp.add(new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.045, 16, 256), mat));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.11, 12, 256), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    grp.add(inner);
    return { grp, mat, inner, I: 1, tI: 1, z, px: 0, py: RING_Y, sc: 1, tx: 0, ty: RING_Y, ts: 1, charge: 0 };
  }
  const R0 = ring(DOOR_Z + 0.12), R1 = ring(Z1 + 0.5);

  /* ---------------- bulkhead with a round opening, and the board-room wall */
  const bulkA = tex(1024, 840, (g, w, h) => {
    g.fillStyle = "#5f6560"; g.fillRect(0, 0, w, h); grit(g, w, h, 9000, 0.12, 30, 160);
    const cx = w / 2, cy = h * (1 - RING_Y / HH), pr = w / W;
    for (let r = RING_R * 1.1; r < RING_R * 2.7; r += 0.34) { g.strokeStyle = "rgba(20,22,21,.8)"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r * pr, 0, 7); g.stroke(); g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r * pr + 3, 0, 7); g.stroke(); }
    [0.09, 0.91].forEach((f) => { g.fillStyle = "#1d201e"; g.fillRect(w * f - 3, 0, 6, h); });
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, x = cx + Math.cos(a) * RING_R * pr * 1.06, y = cy + Math.sin(a) * RING_R * pr * 1.06; g.fillStyle = "#b9beb9"; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  });
  const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, HH); sh.lineTo(-W / 2, HH); sh.lineTo(-W / 2, 0);
  const hole = new THREE.Path(); hole.absarc(0, RING_Y, RING_R * 1.0, 0, Math.PI * 2, true); sh.holes.push(hole);
  const bulkGeo = new THREE.ShapeGeometry(sh, 64); { const uv = bulkGeo.attributes.uv, p = bulkGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / HH); }
  mk(bulkGeo, surf({ map: bulkA, hw: 1024, hh: 840, relief: 3, alb: 0.6, side: THREE.DoubleSide }), [0, 0, DOOR_Z], [0, 0, 0]);
  const endA = tex(1024, 840, (g, w, h) => {
    g.fillStyle = "#596059"; g.fillRect(0, 0, w, h); grit(g, w, h, 7000, 0.12, 30, 160);
    const cx = w / 2, cy = h * (1 - RING_Y / HH), pr = w / W;
    for (let r = RING_R * 1.15; r < RING_R * 2.9; r += 0.42) { g.strokeStyle = "rgba(20,22,21,.7)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r * pr, 0, 7); g.stroke(); }
  });
  mk(new THREE.PlaneGeometry(W, HH), surf({ map: endA, hw: 1024, hh: 840, relief: 2, alb: 0.55 }), [0, HH / 2, Z1 + 0.01], [0, 0, 0]);

  /* ---------------- the door: slab hinged on its left edge; face turns with the dial; bolts retract per lock */
  const SR = RING_R * 0.965;
  const slabA = tex(1024, 1024, (g, w) => {
    const c = w / 2, rr = w / 2;
    const bg = g.createRadialGradient(c, c * 0.85, 0, c, c, rr); bg.addColorStop(0, "#7a817c"); bg.addColorStop(1, "#4d534f");
    g.fillStyle = bg; g.fillRect(0, 0, w, w); grit(g, w, w, 14000, 0.12, 20, 200);
    for (let i = 0; i < 260; i++) { const a = rnd() * Math.PI * 2; g.strokeStyle = `rgba(255,255,255,${0.03 * rnd()})`; g.lineWidth = 1; g.beginPath(); g.arc(c, c, rr * (0.3 + rnd() * 0.65), a, a + 0.3 + rnd()); g.stroke(); }
    [0.94, 0.8, 0.56, 0.3].forEach((f) => { g.strokeStyle = "#1b1e1c"; g.lineWidth = 6; g.beginPath(); g.arc(c, c, rr * f, 0, 7); g.stroke(); g.strokeStyle = "rgba(255,255,255,.22)"; g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, rr * f + 4, 0, 7); g.stroke(); });
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, x = c + Math.cos(a) * rr * 0.87, y = c + Math.sin(a) * rr * 0.87; g.fillStyle = "#c6cbc7"; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.fillStyle = "#2a2d2b"; g.beginPath(); g.arc(x + 1.5, y + 1.5, 2.5, 0, 7); g.fill(); }
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; g.save(); g.translate(c + Math.cos(a) * rr * 0.68, c + Math.sin(a) * rr * 0.68); g.rotate(a + Math.PI / 2); g.fillStyle = "#e2e6e2"; g.font = "300 58px Newsreader, Georgia, serif"; g.textAlign = "center"; g.fillText(String(i + 1), 0, 20); g.restore(); }
    g.font = "600 24px 'IBM Plex Mono', monospace"; g.fillStyle = "#d6dbd6"; g.textAlign = "center";
    const label = "ALDERBROOK · FOUR TESTS · FY29 · ";
    for (let k = 0; k < 2; k++) for (let i = 0; i < label.length; i++) { const a = -Math.PI / 2 + (i / label.length + k * 0.5) * Math.PI - Math.PI * 0.08; g.save(); g.translate(c + Math.cos(a) * rr * 0.5, c + Math.sin(a) * rr * 0.5); g.rotate(a + Math.PI / 2); g.fillText(label[i], 0, 0); g.restore(); }
    const hub = g.createRadialGradient(c, c, 0, c, c, rr * 0.26); hub.addColorStop(0, "#8a918c"); hub.addColorStop(1, "#555b57"); g.fillStyle = hub; g.beginPath(); g.arc(c, c, rr * 0.26, 0, 7); g.fill();
  });
  const hinge = new THREE.Group(); hinge.position.set(-SR, RING_Y, DOOR_Z - 0.2); world.add(hinge);
  const slab = new THREE.Group(); slab.position.set(SR, 0, 0); hinge.add(slab);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(SR, SR, 0.36, 96, 1, true), surf({ map: housingMat.uniforms.map.value, relief: 0.2, alb: 0.6, side: THREE.DoubleSide })); drum.rotation.x = Math.PI / 2; slab.add(drum);
  const face = new THREE.Mesh(new THREE.CircleGeometry(SR, 128), surf({ map: slabA, hw: 1024, hh: 1024, relief: 3.2, alb: 0.55 })); face.position.z = 0.181; slab.add(face);
  const back = new THREE.Mesh(new THREE.CircleGeometry(SR, 64), surf({ map: slabA, relief: 1, alb: 0.3 })); back.position.z = -0.181; back.rotation.y = Math.PI; slab.add(back);
  const pin = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(LAMP.r * 9, LAMP.g * 9, LAMP.b * 9) })); pin.position.z = 0.19; slab.add(pin);
  const boltGeo = new THREE.BoxGeometry(0.24, 0.7, 0.14), bolts = [];
  [Math.PI / 2, 0, -Math.PI / 2, Math.PI].forEach((a) => {
    const m = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: 0x000000 })); const g = new THREE.Group(); g.rotation.z = a - Math.PI / 2; g.add(m); slab.add(g);
    m.position.set(0, SR * 0.9, 0.24); bolts.push({ m, open: 0, t: 0 });
  });

  /* ---------------- chamber doorways and placards */
  const chambers = [];
  function chamberDoors(list) {
    list.forEach((c, k) => {
      const s = k % 2 === 0 ? -1 : 1, z = CHZ(k), ry = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      const frame = tex(512, 840, (g, w, h) => {
        g.clearRect(0, 0, w, h); g.strokeStyle = "#ffffff"; g.lineWidth = 5; g.strokeRect(24, 24, w - 48, h - 30);
        g.globalAlpha = 0.35; g.lineWidth = 2; g.strokeRect(46, 46, w - 92, h - 70); g.globalAlpha = 1;
        g.fillStyle = "#ffffff"; g.font = "300 230px Newsreader, Georgia, serif"; g.textAlign = "center"; g.fillText(String(k + 1).padStart(2, "0"), w / 2, h * 0.46);
        g.font = "600 34px 'IBM Plex Mono', monospace"; g.globalAlpha = 0.7; g.fillText(c.q, w / 2, h * 0.58);
      });
      mk(new THREE.PlaneGeometry(2.7, 4.6), new THREE.MeshBasicMaterial({ color: 0x000000 }), [s * (W / 2 - 0.015), 2.35, z], [0, ry, 0]);
      const fm = new THREE.MeshBasicMaterial({ map: frame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(LAMP.r * 0.5, LAMP.g * 0.5, LAMP.b * 0.5) });
      mk(new THREE.PlaneGeometry(2.9, 4.75), fm, [s * (W / 2 - 0.03), 2.4, z], [0, ry, 0]);
      const pt = tex(1024, 260, (g, w) => { g.clearRect(0, 0, w, 260); g.fillStyle = "#b7f05e"; g.font = "600 44px 'IBM Plex Mono', monospace"; g.fillText("CHAMBER " + String(k + 1).padStart(2, "0"), 30, 80); g.fillStyle = "#e6ede7"; g.font = "400 104px Newsreader, Georgia, serif"; g.fillText(c.n, 26, 205); });
      const pm = new THREE.MeshBasicMaterial({ map: pt, transparent: true, color: new THREE.Color(0.9, 0.9, 0.9) });
      mk(new THREE.PlaneGeometry(4.2, 1.07), pm, [s * (W / 2 - 0.03), 5.75, z], [0, ry, 0]);
      chambers.push({ fm, pm, z, s, lit: 0, tl: 0, hover: 0 });
    });
  }
  function litChamber(k, on) { if (chambers[k]) chambers[k].tl = on ? 1 : 0; }
  function hoverChamber(k) { chambers.forEach((c, i) => (c.hover = i === k ? 1 : 0)); }

  /* ---------------- post: scene -> bloom chain -> composite */
  const RT = (w, h, depth, ms) => {
    const o = { type: FT, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth, stencilBuffer: false };
    if (ms && caps.isWebGL2 && THREE.WebGLMultisampleRenderTarget) { const r = new THREE.WebGLMultisampleRenderTarget(w, h, o); r.samples = 4; return r; }
    return new THREE.WebGLRenderTarget(w, h, o);
  };
  const rtMain = RT(4, 4, true, true), rtRefl = RT(4, 4, true, false);
  const down = [], up = [];
  for (let i = 0; i < 5; i++) down.push(RT(4, 4)); for (let i = 0; i < 4; i++) up.push(RT(4, 4));
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const QV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() }, uTh: { value: HDR ? 0.9 : 0.72 }, uKnee: { value: 0.6 } }, vertexShader: QV,
    fragmentShader: `uniform sampler2D t; uniform vec2 px; uniform float uTh, uKnee; varying vec2 vUv;
      vec3 f(vec2 o){ vec3 c = texture2D(t, vUv + o).rgb; float b = max(c.r, max(c.g, c.b)); float s = clamp(b - uTh + uKnee, 0.0, 2.0 * uKnee); s = s * s / (4.0 * uKnee + 1e-4); return c * max(s, b - uTh) / max(b, 1e-4); }
      void main(){ vec3 c = (f(vec2(-px.x, -px.y)) + f(vec2(px.x, -px.y)) + f(vec2(-px.x, px.y)) + f(px)) * 0.25; gl_FragColor = vec4(min(c, vec3(60.0)), 1.0); }` });
  const dn = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: QV,
    fragmentShader: `uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb * 4.0 + texture2D(t, vUv + vec2(-px.x, -px.y)).rgb + texture2D(t, vUv + vec2(px.x, -px.y)).rgb + texture2D(t, vUv + vec2(-px.x, px.y)).rgb + texture2D(t, vUv + px).rgb; gl_FragColor = vec4(c / 8.0, 1.0); }` });
  const upM = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, tH: { value: null }, px: { value: new THREE.Vector2() }, uMix: { value: 1 } }, vertexShader: QV,
    fragmentShader: `uniform sampler2D t, tH; uniform vec2 px; uniform float uMix; varying vec2 vUv;
      void main(){ vec2 o = px; vec3 c = texture2D(t, vUv + vec2(-o.x * 2.0, 0.0)).rgb + texture2D(t, vUv + vec2(o.x * 2.0, 0.0)).rgb + texture2D(t, vUv + vec2(0.0, -o.y * 2.0)).rgb + texture2D(t, vUv + vec2(0.0, o.y * 2.0)).rgb
        + (texture2D(t, vUv + vec2(-o.x, o.y)).rgb + texture2D(t, vUv + vec2(o.x, o.y)).rgb + texture2D(t, vUv + vec2(-o.x, -o.y)).rgb + texture2D(t, vUv + vec2(o.x, -o.y)).rgb) * 2.0;
        gl_FragColor = vec4(c / 12.0 + texture2D(tH, vUv).rgb * uMix, 1.0); }` });
  const comp = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, tB: { value: null }, uBloom: { value: 0.075 }, uExpo: { value: 0.92 }, uTime: U.uTime, uRes: { value: new THREE.Vector2() }, uCA: { value: 0.006 }, uLDR: { value: HDR ? 0 : 1 } }, vertexShader: QV,
    fragmentShader: `uniform sampler2D t, tB; uniform float uBloom, uExpo, uTime, uCA, uLDR; uniform vec2 uRes; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main(){
        vec2 c = vUv - 0.5; float r2 = dot(c, c); vec2 off = c * r2 * uCA;
        vec3 col = vec3(texture2D(t, vUv - off).r, texture2D(t, vUv).g, texture2D(t, vUv + off).b);
        vec3 b = texture2D(tB, vUv).rgb;
        col = (col + b * uBloom) * uExpo;
        col = mix(aces(col), col, uLDR);
        col = pow(col, vec3(1.0 / 2.2));
        col *= 1.0 - smoothstep(0.12, 0.62, r2) * 0.45;
        float n = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7) + hash(gl_FragCoord.xy * 1.37 + fract(uTime * 3.7) * 37.1) - 1.0;
        col += n * (1.5 / 255.0) + n * 0.012 * (1.0 - smoothstep(0.0, 0.25, dot(col, vec3(0.33))));
        gl_FragColor = vec4(col, 1.0);
      }` });
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
  let RW = 4, RH = 4;
  function resize() {
    const w = Math.max(2, Math.round(innerWidth * DPR)), h = Math.max(2, Math.round(innerHeight * DPR)); RW = w; RH = h;
    renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    rtMain.setSize(w, h); rtRefl.setSize(Math.round(w / 2), Math.round(h / 2));
    let dw = Math.round(w / 2), dh = Math.round(h / 2);
    for (let i = 0; i < 5; i++) { down[i].setSize(Math.max(1, dw), Math.max(1, dh)); if (i < 4) up[i].setSize(Math.max(1, dw), Math.max(1, dh)); dw = Math.round(dw / 2); dh = Math.round(dh / 2); }
    uScale.value = h / SPAN; floorMat.uniforms.uRes.value.set(w, h); comp.uniforms.uRes.value.set(w, h);
  }
  addEventListener("resize", resize); resize();
  floorMat.uniforms.tRefl.value = rtRefl.texture;

  /* ---------------- camera rig */
  const st = { x: 0, y: RING_Y, z: Z0 - 2, yaw: 0, tx: 0, ty: RING_Y, tz: Z0 - 2, tyaw: 0, rate: 1.6, mx: 0, my: 0, sx: 0, sy: 0, par: 1, swing: 0, tswing: 0, shake: 0, dial: 0, torch: 0.9, ttorch: 0.9, expo: 1, texpo: 1, hy: 0, thy: 0 };
  let ptr = { x: innerWidth / 2, y: innerHeight / 2, seen: false };
  addEventListener("pointermove", (e) => { st.mx = e.clientX / innerWidth - 0.5; st.my = e.clientY / innerHeight - 0.5; ptr = { x: e.clientX, y: e.clientY, seen: true }; });
  function fit(rect, rz, fill = 1) {
    const H = innerHeight, D = 2 * RING_R * H / (SPAN * rect.width * fill), k = SPAN * D / H;
    return { z: rz + D, y: RING_Y - (H / 2 - (rect.top + rect.height / 2)) * k, x: -((rect.left + rect.width / 2) - innerWidth / 2) * k };
  }
  function to(p, rate) { st.tx = p.x ?? 0; st.ty = p.y ?? 2.6; st.tz = p.z; st.tyaw = p.yaw ?? 0; st.par = p.par ?? 1; if (rate) st.rate = rate; }
  function jump() { st.x = st.tx; st.y = st.ty; st.z = st.tz; st.yaw = st.tyaw; }

  /* ---------------- lamp switching: a travelling wave, each lamp strikes with a short flicker */
  function ignite(from, toZ, speed = 26, inside = false) {
    const now = performance.now() / 1000;
    L.forEach((l) => { if (l.inside !== inside || l.on < Infinity) return; if (l.z <= from + 0.01 && l.z >= toZ) l.on = now + (from - l.z) / speed + rnd() * 0.12; });
  }
  function allOn() { const now = performance.now() / 1000; L.forEach((l) => { if (l.on === Infinity) l.on = now - 5; }); }
  function wave(fromZ, dir = 1, speed = 40, amt = 0.9) { const now = performance.now() / 1000; L.forEach((l) => { l.pulse = now + Math.abs(l.z - fromZ) / speed; l.pamt = amt; }); }
  const flick = (e) => e < 0.05 ? 0.9 : e < 0.1 ? 0.08 : e < 0.17 ? 0.75 : e < 0.23 ? 0.2 : e < 0.42 ? 0.55 + (e - 0.23) * 2.4 : 1;

  /* ---------------- adaptive quality */
  let fAcc = 0, fN = 0, lowered = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), lc = new THREE.Color();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05), t = now / 1000; last = now; U.uTime.value = reduce ? 0 : t;
    fAcc += dt; fN++; if (fN === 90) { const avg = fAcc / fN; if (avg > 0.034 && lowered < 2) { lowered++; DPR = Math.max(0.75, DPR * 0.72); resize(); } fAcc = 0; fN = 0; }
    const a = reduce ? 1 : 1 - Math.exp(-dt * st.rate), b = 1 - Math.exp(-dt * 3);
    st.x += (st.tx - st.x) * a; st.y += (st.ty - st.y) * a; st.z += (st.tz - st.z) * a; st.yaw += (st.tyaw - st.yaw) * a;
    st.sx += (st.mx * st.par - st.sx) * b; st.sy += (st.my * st.par - st.sy) * b;
    st.shake *= Math.exp(-dt * 3.2); st.hy += (st.thy - st.hy) * a; st.expo += (st.texpo - st.expo) * b; st.torch += (st.ttorch - st.torch) * b;
    const bob = reduce ? 0 : Math.sin(t * 0.6) * 0.02, sk = reduce ? 0 : st.shake;
    const jx = sk * (Math.sin(t * 61) * 0.6 + Math.sin(t * 37) * 0.4) * 0.04, jy = sk * (Math.sin(t * 53) * 0.5 + Math.sin(t * 29) * 0.5) * 0.04;
    cam.position.set(st.x + st.sx * 0.5 + jx, st.y + bob - st.sy * 0.25 + jy, st.z);
    cam.lookAt(st.x + st.sx * 0.18 + Math.sin(st.yaw + st.hy) * 30 + jx * 3, st.y - st.sy * 0.1, st.z - Math.cos(st.yaw + st.hy) * 30);
    cam.updateMatrixWorld();
    // lamps into the data texture
    L.forEach((l, i) => {
      const e = t - l.on; let v = e < 0 ? 0 : reduce ? 1 : flick(e);
      if (v === 1) v = 1 + Math.sin(t * 1.7 + i * 1.3) * 0.012;
      if (l.pulse !== undefined) { const pe = t - l.pulse; if (pe > 0 && pe < 1.4) v *= 1 + l.pamt * Math.exp(-pe * 3.2) * Math.min(1, pe * 12); }
      l.cur = v;
      const o = ((l.s < 0 ? 0 : NB) + l.k) * 4; lampData[o] = Math.min(255, Math.round(v * 127.5));
      lc.setRGB(LAMP.r * 16 * v, LAMP.g * 16 * v, LAMP.b * 16 * v); lens.setColorAt(i, lc);
    });
    lampTex.needsUpdate = true; lens.instanceColor.needsUpdate = true;
    // rings
    [R0, R1].forEach((r, i) => {
      r.I += (r.tI - r.I) * b; const p = (reduce ? 1 : 0.93 + 0.07 * Math.sin(t * 1.3 + i)) * r.I * (1 + r.charge * 1.8);
      const c2 = reduce ? 1 : 1 - Math.exp(-dt * 2.4); r.px += (r.tx - r.px) * c2; r.py += (r.ty - r.py) * c2; r.sc += (r.ts - r.sc) * c2;
      r.grp.position.set(r.px, r.py, r.z); r.grp.scale.setScalar(r.sc); r.grp.visible = r.I > 0.005;
      r.mat.color.setRGB(RINGC.r * 7 * p, RINGC.g * 7 * p, RINGC.b * 7 * p); r.inner.material.color.setRGB(RINGC.r * 0.5 * p, RINGC.g * 0.5 * p, RINGC.b * 0.5 * p);
      const u = i === 0 ? U.uRing0.value : U.uRing1.value; u.set(r.px, r.py, r.z, p * 0.9); U.uRingR.value.setComponent(i, RING_R * r.sc);
    });
    // bolts, door, dial
    bolts.forEach((bo) => { bo.t += (bo.open - bo.t) * (reduce ? 1 : 1 - Math.exp(-dt * 7)); bo.m.position.y = SR * (0.9 - 0.16 * bo.t); bo.m.material.color.setRGB(0.55 + (LAMP.r * 2.2 - 0.55) * bo.t, 0.07 + (LAMP.g * 2.2 - 0.07) * bo.t, 0.04 + (LAMP.b * 2.2 - 0.04) * bo.t); });
    st.swing += (st.tswing - st.swing) * (reduce ? 1 : 1 - Math.exp(-dt * 1.1)); hinge.rotation.y = st.swing; U.uDoorOpen.value = Math.min(1, -st.swing / 1.2);
    face.rotation.z = -st.dial * Math.PI / 180;
    chambers.forEach((c) => { c.lit += (Math.max(c.tl, c.hover * 0.7) - c.lit) * b; const g = 0.45 + c.lit * 3.2 + (c.lit > 0.5 && !reduce ? Math.sin(t * 2.2) * 0.25 : 0); c.fm.color.setRGB(LAMP.r * g, LAMP.g * g, LAMP.b * g); });
    // torch: a faint light that follows the pointer onto the walls
    if (ptr.seen && st.torch > 0.01) {
      ndc.set(ptr.x / innerWidth * 2 - 1, -(ptr.y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
      const o = ray.ray.origin, d = ray.ray.direction; let tt = 60;
      if (d.x > 1e-4) tt = Math.min(tt, (W / 2 - o.x) / d.x); if (d.x < -1e-4) tt = Math.min(tt, (-W / 2 - o.x) / d.x);
      if (d.y > 1e-4) tt = Math.min(tt, (HH - o.y) / d.y); if (d.y < -1e-4) tt = Math.min(tt, (0 - o.y) / d.y);
      const hp = o.clone().addScaledVector(d, Math.max(0.5, tt - 1.1)); const tv = U.uTorch.value; tv.x += (hp.x - tv.x) * b; tv.y += (hp.y - tv.y) * b; tv.z += (hp.z - tv.z) * b;
    }
    U.uTorch.value.w = st.torch * 0.55;
    comp.uniforms.uExpo.value = st.expo;
    if (!document.hidden) {
      // 1. reflection: mirror the world in the floor plane and render from the same camera
      world.scale.y = -1; floor.visible = false; U.uMirror.value = -1; renderer.setRenderTarget(rtRefl); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
      world.scale.y = 1; floor.visible = true; U.uMirror.value = 1;
      // 2. the lit scene
      renderer.setRenderTarget(rtMain); renderer.clear(); renderer.render(scene, cam);
      // 3. bloom: bright pass, four downsamples, four upsamples
      bright.uniforms.t.value = rtMain.texture; bright.uniforms.px.value.set(1 / RW, 1 / RH); pass(bright, down[0]);
      for (let i = 1; i < 5; i++) { dn.uniforms.t.value = down[i - 1].texture; dn.uniforms.px.value.set(1 / down[i - 1].width, 1 / down[i - 1].height); pass(dn, down[i]); }
      let src = down[4];
      for (let i = 3; i >= 0; i--) { upM.uniforms.t.value = src.texture; upM.uniforms.tH.value = down[i].texture; upM.uniforms.px.value.set(1 / src.width, 1 / src.height); pass(upM, up[i]); src = up[i]; }
      // 4. composite to screen
      comp.uniforms.t.value = rtMain.texture; comp.uniforms.tB.value = up[0].texture; pass(comp, null);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    DOOR_Z, Z1, CHZ, fit, to, jump, ignite, allOn, chamberDoors, litChamber, hoverChamber, st, wave,
    rings: [R0, R1], dust: (v) => (dustLit.value = v),
    bolt: (i, open) => (bolts[i].open = open ? 1 : 0),
    collapse: (i, rect) => { const r = [R0, R1][i], D = cam.position.z - r.z, k = SPAN * D / innerHeight; r.tx = cam.position.x + (rect.left + rect.width / 2 - innerWidth / 2) * k; r.ty = cam.position.y + (innerHeight / 2 - (rect.top + rect.height / 2)) * k; r.ts = rect.width * k / (2 * RING_R); },
    uncollapse: (i) => { const r = [R0, R1][i]; r.tx = 0; r.ty = RING_Y; r.ts = 1; },
    swing: (open) => (st.tswing = open ? -1.95 : 0),
    approach: () => ignite(Z0, DOOR_Z, 22, false),
    interior: () => ignite(DOOR_Z, Z1, 30, true),
    chamberPose: (k) => { const c = chambers[k]; return { x: -c.s * 2.2, y: 2.9, z: c.z + 10, yaw: c.s * 0.1 }; },
    shake: (v) => (st.shake = Math.max(st.shake, v)),
    burst: () => (burstT.value = performance.now() / 1000),
    charge: (p) => (R0.charge = p),
    dial: (deg) => (st.dial = deg),
    torch: (v) => (st.ttorch = v),
    haze: (v) => (beamMat.uniforms.uHaze.value = v),
  };
})();
