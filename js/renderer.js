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

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const opts = { antialias: false, alpha: false, powerPreference: 'high-performance' };
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
    render(world, cam, R, underwater) {
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
    }
  }

  CM.Renderer = Renderer;
})(window.CM);
