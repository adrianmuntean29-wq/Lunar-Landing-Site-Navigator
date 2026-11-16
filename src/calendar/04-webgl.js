/* Landing calendar, runs inside startApp() and shares its scope with the other files here (see tools/build_js.py): the
   WebGL renderer of the 3D map: buffers, shaders, camera matrices, drawing. */
/* ---------- WebGL ---------- */
var canvas = $('#gl'), viewport = $('#viewport');
var gl = null;
try { gl = canvas.getContext('webgl', {antialias: true, alpha: false}); } catch (err) { gl = null; }
var prog, wprog, bufs = {}, idxCount = 0, wallCount = 0, VP = new Float32Array(16), W = 1, Hh = 1;
if (!gl){
  var msg = document.createElement('div'); msg.className = 'nogl';
  msg.textContent = 'This browser cannot show the 3D map (WebGL unavailable). The candidate sites and charts still work.';
  viewport.appendChild(msg);
} else {
  var deriv = gl.getExtension('OES_standard_derivatives');
  var VS = 'attribute vec3 aPos;attribute vec3 aNor;attribute float aLight;attribute float aLayer;attribute float aHill;attribute float aTone;' +
    'uniform mat4 uMVP;uniform vec3 uSun;' +
    'varying float vLight;varying float vLayer;varying float vHill;varying float vTone;varying float vLam;varying vec2 vXZ;' +
    'void main(){vLight=aLight;vLayer=aLayer;vHill=aHill;vTone=aTone;vLam=dot(aNor,uSun);vXZ=aPos.xz;gl_Position=uMVP*vec4(aPos,1.0);}';
  var FS = (deriv ? '#extension GL_OES_standard_derivatives : enable\n#define DERIV 1\n' : '') +
    'precision mediump float;uniform float uMode;' +
    'varying float vLight;varying float vLayer;varying float vHill;varying float vTone;varying float vLam;varying vec2 vXZ;' +
    'vec3 ramp3(float t,vec3 a,vec3 b,vec3 c){return t<0.5?mix(a,b,t*2.0):mix(b,c,t*2.0-1.0);}' +
    'void main(){vec3 base=vec3(0.78,0.75,0.70)*(0.84+0.32*vTone);vec3 col;' +
    'if(uMode<0.5){float lam=clamp(vLam*3.0,0.0,1.0);float direct=vLight*(0.52+0.48*lam);' +
    'col=vec3(0.026,0.032,0.048)+vec3(0.055,0.065,0.085)*vHill+base*direct;}' +
    'else if(uMode<1.5){float t=pow(clamp(vLayer,0.0,1.0),0.7);col=ramp3(t,vec3(0.035,0.04,0.06),vec3(0.62,0.36,0.10),vec3(1.0,0.88,0.58))*(0.72+0.28*vHill);}' +
    'else{float t=clamp(vLayer,0.0,1.0);col=ramp3(t,vec3(0.035,0.04,0.06),vec3(0.13,0.33,0.66),vec3(0.70,0.88,1.0))*(0.72+0.28*vHill);}' +
    '\n#ifdef DERIV\n' +
    'vec2 gq=vXZ/' + MAP.grid.toFixed(1) + ';vec2 gd=abs(fract(gq-0.5)-0.5)/fwidth(gq);float line=1.0-min(min(gd.x,gd.y),1.0);' +
    'float r=length(vXZ);float cq=degrees(2.0*atan(r/3474.8))/' + MAP.ring.toFixed(2) + ';float ring=1.0-min(abs(fract(cq-0.5)-0.5)/fwidth(cq),1.0);' +
    'col+=vec3(0.55,0.62,0.72)*(line*0.06+ring*0.24);' +
    '\n#endif\n' +
    'gl_FragColor=vec4(col,1.0);}';
  var VSW = 'attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uMVP;uniform float uBase;uniform float uTop;varying float vL;varying float vY;' +
    'void main(){vL=0.55+0.45*max(dot(aNor,normalize(vec3(-0.4,0.5,0.75))),0.0);vY=(aPos.y-uBase)/(uTop-uBase);gl_Position=uMVP*vec4(aPos,1.0);}';
  var FSW = 'precision mediump float;varying float vL;varying float vY;' +
    'void main(){vec3 c=mix(vec3(0.06,0.07,0.09),vec3(0.18,0.19,0.21),clamp(vY,0.0,1.0));gl_FragColor=vec4(c*vL*1.15,1.0);}';
  var compile = function(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  var link = function(vs, fs){ var p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  prog = link(VS, FS); wprog = link(VSW, FSW);
  var mk = function(data, usage){ var bb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bb); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW); return bb; };
  bufs.pos = mk(new Float32Array(NV*3), gl.DYNAMIC_DRAW);
  bufs.nor = mk(nor); bufs.hill = mk(hill); bufs.tone = mk(tone);
  bufs.light = mk(light, gl.DYNAMIC_DRAW); bufs.layer = mk(layer, gl.DYNAMIC_DRAW);
  var idx = new Uint16Array((N - 1)*(N - 1)*6), p = 0;
  for (var j = 0; j < N - 1; j++) for (var i = 0; i < N - 1; i++){
    var a = j*N + i, bq = a + 1, c = a + N, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = bq; idx[p++] = bq; idx[p++] = c; idx[p++] = d;
  }
  bufs.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  idxCount = idx.length;
  bufs.wpos = mk(new Float32Array(4*(N - 1)*6*3), gl.DYNAMIC_DRAW);
  bufs.wnor = mk(new Float32Array(4*(N - 1)*6*3), gl.DYNAMIC_DRAW);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.0196, 0.0275, 0.039, 1);
}
function baseY(){ return HMINr*state.exag - 1.6; }
function updateGeometry(){
  if (!gl) return;
  var pos = new Float32Array(NV*3), e = state.exag;
  for (var v = 0; v < NV; v++){ pos[v*3] = vx[v]; pos[v*3 + 1] = vh[v]*e; pos[v*3 + 2] = vz[v]; }
  gl.bindBuffer(gl.ARRAY_BUFFER, bufs.pos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
  var wp = [], wn = [], yb = baseY();
  var edges = [
    {get: function(s){ return s; }, fixed: 0, axis: 'row', n: [0, 0, -1]},
    {get: function(s){ return s; }, fixed: N - 1, axis: 'row', n: [0, 0, 1]},
    {get: function(s){ return s; }, fixed: 0, axis: 'col', n: [-1, 0, 0]},
    {get: function(s){ return s; }, fixed: N - 1, axis: 'col', n: [1, 0, 0]}
  ];
  edges.forEach(function(ed){
    for (var s = 0; s < N - 1; s++){
      var v0 = ed.axis === 'row' ? ed.fixed*N + s : s*N + ed.fixed;
      var v1 = ed.axis === 'row' ? ed.fixed*N + s + 1 : (s + 1)*N + ed.fixed;
      var A = [vx[v0], vh[v0]*e, vz[v0]], B = [vx[v1], vh[v1]*e, vz[v1]], A2 = [vx[v0], yb, vz[v0]], B2 = [vx[v1], yb, vz[v1]];
      [A, A2, B, B, A2, B2].forEach(function(P){ wp.push(P[0], P[1], P[2]); wn.push(ed.n[0], ed.n[1], ed.n[2]); });
    }
  });
  wallCount = wp.length/3;
  gl.bindBuffer(gl.ARRAY_BUFFER, bufs.wpos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(wp));
  gl.bindBuffer(gl.ARRAY_BUFFER, bufs.wnor); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(wn));
}

/* ---------- matrices ---------- */
function perspective(fovy, aspect, near, far){ var f = 1/Math.tan(fovy/2), nf = 1/(near - far); return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far + near)*nf,-1, 0,0,2*far*near*nf,0]; }
function lookAt(e, c){
  var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
  var xx = zz, xy = 0, xz = -zx, xl = Math.hypot(xx, xy, xz); xx /= xl; xz /= xl;
  var yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
  return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx*e[0] + xy*e[1] + xz*e[2]), -(yx*e[0] + yy*e[1] + yz*e[2]), -(zx*e[0] + zy*e[1] + zz*e[2]), 1];
}
function mul(a, b){ var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++){ var s = 0; for (var k = 0; k < 4; k++) s += a[k*4 + r]*b[c*4 + k]; o[c*4 + r] = s; } return o; }
function invert(a){
  var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
  var b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12;
  var b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  var det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06; if (!det) return null; det = 1/det;
  return [(a11*b11-a12*b10+a13*b09)*det,(a02*b10-a01*b11-a03*b09)*det,(a31*b05-a32*b04+a33*b03)*det,(a22*b04-a21*b05-a23*b03)*det,
    (a12*b08-a10*b11-a13*b07)*det,(a00*b11-a02*b08+a03*b07)*det,(a32*b02-a30*b05-a33*b01)*det,(a20*b05-a22*b02+a23*b01)*det,
    (a10*b10-a11*b08+a13*b06)*det,(a01*b08-a00*b10-a03*b06)*det,(a30*b04-a31*b02+a33*b00)*det,(a21*b02-a20*b04-a23*b00)*det,
    (a11*b07-a10*b09-a12*b06)*det,(a00*b09-a01*b07+a02*b06)*det,(a31*b01-a30*b03-a32*b00)*det,(a20*b03-a21*b01+a22*b00)*det];
}
function eyePos(){ return [CX + cam.dist*Math.cos(cam.pitch)*Math.sin(cam.yaw), cam.dist*Math.sin(cam.pitch), CZ + cam.dist*Math.cos(cam.pitch)*Math.cos(cam.yaw)]; }
function updateVP(){ VP = mul(perspective(40*DEG, W/Hh, 0.5*Math.max(1, SC/2), 600*SC), lookAt(eyePos(), [CX, -1, CZ])); }
function project(x, y, z){
  var m = VP, cx = m[0]*x + m[4]*y + m[8]*z + m[12], cy = m[1]*x + m[5]*y + m[9]*z + m[13], cw = m[3]*x + m[7]*y + m[11]*z + m[15];
  if (cw <= 0.05) return null;
  return [(cx/cw*0.5 + 0.5)*W, (0.5 - cy/cw*0.5)*Hh];
}

function draw(){
  if (!gl) return;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  var s = sunAt(state.t), ce = Math.cos(s.el*DEG);
  var sunDir = [ce*Math.sin(s.az*DEG), Math.sin(s.el*DEG), -ce*Math.cos(s.az*DEG)];
  gl.useProgram(prog);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uMVP'), false, VP);
  gl.uniform3fv(gl.getUniformLocation(prog, 'uSun'), sunDir);
  gl.uniform1f(gl.getUniformLocation(prog, 'uMode'), state.mode);
  [['aPos', bufs.pos, 3], ['aNor', bufs.nor, 3], ['aLight', bufs.light, 1], ['aLayer', bufs.layer, 1], ['aHill', bufs.hill, 1], ['aTone', bufs.tone, 1]].forEach(function(a){
    var loc = gl.getAttribLocation(prog, a[0]); if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, a[1]); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, a[2], gl.FLOAT, false, 0, 0);
  });
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx);
  gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0);
  for (var l = 0; l < 6; l++) gl.disableVertexAttribArray(l);
  gl.useProgram(wprog);
  gl.uniformMatrix4fv(gl.getUniformLocation(wprog, 'uMVP'), false, VP);
  gl.uniform1f(gl.getUniformLocation(wprog, 'uBase'), baseY());
  gl.uniform1f(gl.getUniformLocation(wprog, 'uTop'), HMAXr*state.exag);
  [['aPos', bufs.wpos], ['aNor', bufs.wnor]].forEach(function(a){
    var loc = gl.getAttribLocation(wprog, a[0]); if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, a[1]); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  });
  gl.drawArrays(gl.TRIANGLES, 0, wallCount);
  for (var m = 0; m < 6; m++) gl.disableVertexAttribArray(m);
}

