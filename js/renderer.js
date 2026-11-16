'use strict';
// CraftMine PE — WebGL-рендерер
(function (CM) {
  const VS = `
attribute vec3 aPos;
attribute vec2 aUV;
attribute float aLight;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uOffset;
uniform float uFogNear;
uniform float uFogFar;
varying vec2 vUV;
varying float vLight;
varying float vFog;
void main() {
  vec4 vp = uView * vec4(aPos + uOffset, 1.0);
  gl_Position = uProj * vp;
  vUV = aUV;
  vLight = aLight;
  vFog = clamp((length(vp.xyz) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;

  const FS = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform float uAlphaTest;
varying vec2 vUV;
varying float vLight;
varying float vFog;
void main() {
  vec4 c = texture2D(uTex, vUV);
  if (c.a < uAlphaTest) discard;
  gl_FragColor = vec4(mix(c.rgb * vLight, uFogColor, vFog), c.a);
}`;

  // ---- матрицы (column-major) ----
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function lookDir(eye, d) {
    // правый вектор = d x up
    let rx = -d[2], ry = 0, rz = d[0];
    let rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    // up = r x d
    const ux = ry * d[2] - rz * d[1], uy = rz * d[0] - rx * d[2], uz = rx * d[1] - ry * d[0];
    return new Float32Array([
      rx, ux, -d[0], 0,
      ry, uy, -d[1], 0,
      rz, uz, -d[2], 0,
      -(rx * eye[0] + ry * eye[1] + rz * eye[2]),
      -(ux * eye[0] + uy * eye[1] + uz * eye[2]),
      (d[0] * eye[0] + d[1] * eye[1] + d[2] * eye[2]), 1]);
  }
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  function frustumPlanes(m) {
    const row = (i) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
    const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
    const planes = [];
    for (const [a, s] of [[r0, 1], [r0, -1], [r1, 1], [r1, -1], [r2, 1], [r2, -1]])
      planes.push([r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]]);
    return planes;
  }
  function boxVisible(planes, x0, y0, z0, x1, y1, z1) {
    for (const p of planes) {
      const x = p[0] > 0 ? x1 : x0, y = p[1] > 0 ? y1 : y0, z = p[2] > 0 ? z1 : z0;
      if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false;
    }
    return true;
  }

  // Куб [0,1]^3: углы каждой грани (снаружи: низ-лево, низ-право, верх-право, верх-лево)
  const CUBE = [
    { c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], slot: 2, shade: 0.8 },
    { c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], slot: 2, shade: 0.8 },
    { c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], slot: 0, shade: 1.0 },
    { c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], slot: 1, shade: 0.5 },
    { c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], slot: 2, shade: 0.65 },
    { c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], slot: 2, shade: 0.65 },
  ];
  const QUAD_UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  function tileUV(tile) {
    const st = 1 / CM.Textures.perRow, e = 0.0008;
    return [(tile % CM.Textures.perRow) * st + e, Math.floor(tile / CM.Textures.perRow) * st + e, st - 2 * e];
  }

  // Вершины куба; tex — [верх, низ, бок]; xf — преобразование точки [0,1]^3
  // Вершины набора коробок (каждая [x0,y0,z0,x1,y1,z1] в [0,1]^3); tex — [верх, низ, бок];
  // xf — преобразование точки; UV берутся по координатам грани, как в мире
  function shapeVerts(boxes, tex, xf, light) {
    const out = new Float32Array(boxes.length * 36 * 6);
    let o = 0;
    CUBE.forEach((f, fi) => {
      const [u0, v0, st] = tileUV(tex[f.slot]);
      for (const b of boxes) {
        const vs = f.c.map((c) => {
          const p = [c[0] ? b[3] : b[0], c[1] ? b[4] : b[1], c[2] ? b[5] : b[2]];
          let tu, tv;
          if (fi < 2) { tu = p[2]; tv = 1 - p[1]; } else if (fi < 4) { tu = p[0]; tv = p[2]; } else { tu = p[0]; tv = 1 - p[1]; }
          const q = xf(p);
          return [q[0], q[1], q[2], u0 + tu * st, v0 + tv * st, f.shade * light];
        });
        for (const k of [0, 1, 2, 0, 2, 3]) { out.set(vs[k], o); o += 6; }
      }
    });
    return out;
  }
  function cubeVerts(tex, xf, light) { return shapeVerts([[0, 0, 0, 1, 1, 1]], tex, xf, light); }

  class Renderer {
    constructor(canvas, iconMode) {
      this.canvas = canvas;
      const opts = iconMode
        ? { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }
        : { antialias: false, alpha: false, powerPreference: 'high-performance' };
      const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
      if (!gl) throw new Error('WebGL не поддерживается');
      this.gl = gl;
      this.sky = [0.53, 0.75, 0.98];
      this.scale = 1;

      const prog = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(prog, sh);
      }
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      this.prog = prog;
      this.a = {
        pos: gl.getAttribLocation(prog, 'aPos'),
        uv: gl.getAttribLocation(prog, 'aUV'),
        light: gl.getAttribLocation(prog, 'aLight'),
      };
      this.u = {};
      for (const n of ['uProj', 'uView', 'uOffset', 'uFogNear', 'uFogFar', 'uTex', 'uFogColor', 'uAlphaTest'])
        this.u[n] = gl.getUniformLocation(prog, n);
      gl.enableVertexAttribArray(this.a.pos);
      gl.enableVertexAttribArray(this.a.uv);
      gl.enableVertexAttribArray(this.a.light);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, CM.Textures.atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(this.u.uTex, 0);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.frontFace(gl.CCW);
      gl.cullFace(gl.BACK);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.dyn = { buf: gl.createBuffer(), count: 0 };
    }

    _drawDynamic(arr, mode) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dyn.buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      this._bind(this.dyn);
      gl.drawArrays(mode, 0, arr.length / 6);
    }

    _drawOverlays(ex) {
      const gl = this.gl;
      gl.uniform3f(this.u.uOffset, 0, 0, 0);
      if (ex.crack) {
        const { x, y, z, stage } = ex.crack;
        const t = CM.TILES['crack_' + stage];
        const e = 0.004, bb = ex.crack.bounds || [0, 0, 0, 1, 1, 1];
        const box = [[bb[0] - e, bb[1] - e, bb[2] - e, bb[3] + e, bb[4] + e, bb[5] + e]];
        const v = shapeVerts(box, [t, t, t], (p) => [x + p[0], y + p[1], z + p[2]], 1);
        gl.enable(gl.BLEND); gl.depthMask(false); gl.disable(gl.CULL_FACE);
        gl.uniform1f(this.u.uAlphaTest, 0.01);
        this._drawDynamic(v, gl.TRIANGLES);
      }
      if (ex.selection) {
        const { x, y, z } = ex.selection;
        const e = 0.003, [u0, v0] = tileUV(CM.TILES.outline);
        const bb = ex.selection.bounds || [0, 0, 0, 1, 1, 1];
        const lerp = (a, i) => (a ? bb[i + 3] + e : bb[i] - e);
        const P = (a, b, c) => [x + lerp(a, 0), y + lerp(b, 1), z + lerp(c, 2), u0, v0, 0.55];
        const L = [];
        for (let i = 0; i < 4; i++) {
          const a = i & 1, b = i >> 1;
          L.push(P(0, a, b), P(1, a, b), P(a, 0, b), P(a, 1, b), P(a, b, 0), P(a, b, 1));
        }
        const arr = new Float32Array(L.length * 6);
        L.forEach((v, i) => arr.set(v, i * 6));
        gl.enable(gl.BLEND); gl.depthMask(false);
        gl.uniform1f(this.u.uAlphaTest, 0.01);
        this._drawDynamic(arr, gl.LINES);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // Блок в руке: рисуется в пространстве камеры поверх мира
    _drawHand(hand) {
      const gl = this.gl;
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const proj = perspective(70 * Math.PI / 180, this.canvas.width / this.canvas.height, 0.05, 10);
      gl.uniformMatrix4fv(this.u.uProj, false, proj);
      gl.uniformMatrix4fv(this.u.uView, false, IDENT);
      gl.uniform3f(this.u.uOffset, 0, 0, 0);
      gl.uniform1f(this.u.uFogNear, 100);
      gl.uniform1f(this.u.uFogFar, 200);
      const sw = Math.sin(hand.swing * Math.PI);
      // hand.arm — пустая рука; иначе предмет (коробки + текстура)
      const arm = !!hand.arm;
      const scale = arm ? [0.24, 0.24, 0.95] : [0.62, 0.62, 0.62];
      const ry = (arm ? -0.38 : 0.78) - sw * 0.45;
      const rx = (arm ? 0.42 : 0.16) + sw * 0.7;
      const px = (arm ? 0.6 : 0.66) + hand.bobX - sw * 0.25;
      const py = (arm ? -0.56 : -0.6) + hand.bobY - sw * 0.12;
      const pz = (arm ? -0.85 : -1.05) - sw * 0.2;
      const cyR = Math.cos(ry), syR = Math.sin(ry), cxR = Math.cos(rx), sxR = Math.sin(rx);
      const xf = (p) => {
        const x = (p[0] - 0.5) * scale[0], y = (p[1] - 0.5) * scale[1], z = (p[2] - 0.5) * scale[2];
        const x1 = x * cyR + z * syR, z1 = -x * syR + z * cyR;
        const y1 = y * cxR - z1 * sxR, z2 = y * sxR + z1 * cxR;
        return [x1 + px, y1 + py, z2 + pz];
      };
      const boxes = arm ? [[0, 0, 0, 1, 1, 1]] : hand.boxes;
      const tex = arm ? [CM.TILES.skin, CM.TILES.skin, CM.TILES.skin] : hand.tex;
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.uniform1f(this.u.uAlphaTest, 0.5);
      this._drawDynamic(shapeVerts(boxes, tex, xf, hand.light), gl.TRIANGLES);
    }

    // Изометрическая иконка предмета (только для рендерера, созданного с iconMode)
    drawIcon(boxes, tex) {
      const gl = this.gl;
      const w = this.canvas.width, h = this.canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(this.u.uProj, false, IDENT);
      gl.uniformMatrix4fv(this.u.uView, false, IDENT);
      gl.uniform3f(this.u.uOffset, 0, 0, 0);
      gl.uniform1f(this.u.uFogNear, 100);
      gl.uniform1f(this.u.uFogFar, 200);
      gl.uniform3fv(this.u.uFogColor, [0, 0, 0]);
      const c45 = Math.SQRT1_2, c30 = Math.cos(Math.PI / 6), s30 = 0.5, S = 1.1;
      const xf = (p) => {
        const x = p[0] - 0.5, y = p[1] - 0.5, z = p[2] - 0.5;
        const x1 = x * c45 + z * c45, z1 = -x * c45 + z * c45;
        const y2 = y * c30 - z1 * s30, z2 = y * s30 + z1 * c30;
        return [x1 * S, y2 * S, -z2 * 0.5];
      };
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.uniform1f(this.u.uAlphaTest, 0.5);
      this._drawDynamic(shapeVerts(boxes, tex, xf, 1), gl.TRIANGLES);
      return this.canvas.toDataURL();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.scale;
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }

    createMesh(arr) {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      return { buf, count: arr.length / 6 };
    }

    deleteMesh(m) { this.gl.deleteBuffer(m.buf); }

    _bind(m) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
      gl.vertexAttribPointer(this.a.pos, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(this.a.uv, 2, gl.FLOAT, false, 24, 12);
      gl.vertexAttribPointer(this.a.light, 1, gl.FLOAT, false, 24, 20);
    }

    // cam: {x,y,z,yaw,pitch}, R — дальность прорисовки в чанках
    render(world, cam, R, underwater, extras) {
      const gl = this.gl;
      this.resize();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      const fog = underwater ? [0.12, 0.25, 0.6] : this.sky;
      gl.clearColor(fog[0], fog[1], fog[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!world) return;

      const CS = CM.CS;
      const far = (R + 1) * CS * 1.2;
      const proj = perspective(70 * Math.PI / 180, this.canvas.width / this.canvas.height, 0.05, far);
      const cp = Math.cos(cam.pitch);
      const dir = [-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp];
      const view = lookDir([cam.x, cam.y, cam.z], dir);
      const planes = frustumPlanes(mul(proj, view));

      gl.uniformMatrix4fv(this.u.uProj, false, proj);
      gl.uniformMatrix4fv(this.u.uView, false, view);
      gl.uniform3fv(this.u.uFogColor, fog);
      if (underwater) {
        gl.uniform1f(this.u.uFogNear, 2);
        gl.uniform1f(this.u.uFogFar, 18);
      } else {
        gl.uniform1f(this.u.uFogNear, R * CS * 0.55);
        gl.uniform1f(this.u.uFogFar, R * CS * 0.95);
      }

      const visible = [];
      for (const ch of world.chunks.values()) {
        if (!ch.meshed) continue;
        const x0 = ch.cx * CS, z0 = ch.cz * CS;
        if (!boxVisible(planes, x0, 0, z0, x0 + CS, ch.maxY + 1, z0 + CS)) continue;
        visible.push(ch);
      }

      // Непрозрачные блоки (и листва с альфа-тестом)
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.uniform1f(this.u.uAlphaTest, 0.5);
      for (const ch of visible) {
        if (!ch.opaque) continue;
        gl.uniform3f(this.u.uOffset, ch.cx * CS, 0, ch.cz * CS);
        this._bind(ch.opaque);
        gl.drawArrays(gl.TRIANGLES, 0, ch.opaque.count);
      }

      // Вода — полупрозрачная, от дальних чанков к ближним
      const water = visible.filter((c) => c.water);
      water.sort((a, b) => {
        const da = (a.cx * CS + 8 - cam.x) ** 2 + (a.cz * CS + 8 - cam.z) ** 2;
        const db = (b.cx * CS + 8 - cam.x) ** 2 + (b.cz * CS + 8 - cam.z) ** 2;
        return db - da;
      });
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.uniform1f(this.u.uAlphaTest, 0.01);
      for (const ch of water) {
        gl.uniform3f(this.u.uOffset, ch.cx * CS, 0, ch.cz * CS);
        this._bind(ch.water);
        gl.drawArrays(gl.TRIANGLES, 0, ch.water.count);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);

      if (extras) {
        this._drawOverlays(extras);
        if (extras.hand) this._drawHand(extras.hand);
      }
    }

    // Луч из камеры через точку экрана (в CSS-пикселях)
    screenRay(cam, sx, sy) {
      const cp = Math.cos(cam.pitch);
      const f = [-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp];
      const r = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      const w = window.innerWidth, h = window.innerHeight;
      const t = Math.tan(35 * Math.PI / 180);
      const nx = (sx / w * 2 - 1) * t * (w / h), ny = (1 - sy / h * 2) * t;
      const d = [f[0] + r[0] * nx + u[0] * ny, f[1] + r[1] * nx + u[1] * ny, f[2] + r[2] * nx + u[2] * ny];
      const l = Math.hypot(d[0], d[1], d[2]);
      return [d[0] / l, d[1] / l, d[2] / l];
    }
  }

  CM.Renderer = Renderer;
})(window.CM);
