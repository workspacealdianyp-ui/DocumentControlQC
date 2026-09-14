import { useEffect, useRef } from 'react'

/* A slow gradient, drawn by the GPU.

   Ported from a shadcn/Tailwind/TypeScript component into this app's
   terms: plain JSX, no utility classes, and its three colours read from
   CSS custom properties so the palette stays in styles.css with every
   other colour rather than being written twice in a second language.

   Four things were added on the way in, all of them about a tool that
   runs all day on a tablet in a workshop:

   - It never paints an empty surface. A machine without WebGL2, or a
     shader that fails to compile, leaves the element's own CSS
     background showing instead of a blank canvas.
   - It stops when it is not being looked at — scrolled out of view, or
     the tab in the background — because a loop nobody can see is just
     battery.
   - prefers-reduced-motion draws one frame and stops. The surface is
     still there; it simply holds still.
   - The device pixel ratio is capped at 2. A phone at 3x would render
     nine pixels for every one anybody sees.

   Parameters are read from a ref inside the loop rather than from the
   effect's dependencies, so changing one adjusts the next frame instead
   of tearing down the GL context and building a new one. */

const SHAPES = { checks: 0, stripes: 1, edge: 2 }

/* The base look. Callers override what they need; nothing here is a
   knob anybody has to turn to get a usable surface. */
const BASE = {
  rotation: -50,
  proportion: 42,
  scale: 0.28,
  speed: 14,
  distortion: 3,
  swirl: 46,
  swirlIterations: 8,
  softness: 100,
  offset: 0,
  shape: 'checks',
  shapeSize: 38,
}

export default function AnimatedGradient({ mode, params, className, style }) {
  const hostRef = useRef(null)
  const canvasRef = useRef(null)
  const paramsRef = useRef({ ...BASE, ...params })
  const colorsRef = useRef(null)

  /* Kept current after every render and read inside the loop, so
     changing a parameter adjusts the next frame rather than tearing
     down the GL context and building a new one. */
  useEffect(() => { paramsRef.current = { ...BASE, ...params } })

  /* The palette lives in styles.css under :root and :root[data-theme].
     `mode` is not read here — it is the signal that those values have
     changed underneath us and are worth reading again. */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const cs = getComputedStyle(host)
    colorsRef.current = [1, 2, 3].map((i) => rgba(cs.getPropertyValue(`--grad-${i}`).trim()))
  }, [mode])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true })
    // No WebGL2: leave the element's CSS background showing.
    if (!gl) return

    const program = build(gl)
    if (!program) return
    gl.useProgram(program.program)

    const u = {}
    for (const name of [
      'u_time', 'u_resolution', 'u_pixelRatio', 'u_scale', 'u_rotation',
      'u_color1', 'u_color2', 'u_color3', 'u_proportion', 'u_softness',
      'u_shape', 'u_shapeScale', 'u_distortion', 'u_swirl', 'u_swirlIterations',
    ]) u[name] = gl.getUniformLocation(program.program, name)

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(host.clientWidth * ratio))
      const h = Math.max(1, Math.round(host.clientHeight * ratio))
      if (canvas.width === w && canvas.height === h) return
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(host)

    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const started = performance.now()
    let frame
    let seen = true

    const draw = (now) => {
      const p = paramsRef.current
      const c = colorsRef.current || [[0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1]]
      // Held at zero for a reader who asked for less motion: the same
      // surface, painted once, not moving.
      const elapsed = still.matches ? 0 : ((now - started) / 1000) * (p.speed / 100) * 5

      gl.uniform1f(u.u_time, elapsed + p.offset * 0.01)
      gl.uniform2f(u.u_resolution, canvas.width, canvas.height)
      gl.uniform1f(u.u_pixelRatio, Math.min(window.devicePixelRatio || 1, 2))
      gl.uniform1f(u.u_scale, p.scale)
      gl.uniform1f(u.u_rotation, (p.rotation * Math.PI) / 180)
      gl.uniform4f(u.u_color1, ...c[0])
      gl.uniform4f(u.u_color2, ...c[1])
      gl.uniform4f(u.u_color3, ...c[2])
      gl.uniform1f(u.u_proportion, p.proportion / 100)
      gl.uniform1f(u.u_softness, p.softness / 100)
      gl.uniform1f(u.u_shape, SHAPES[p.shape] ?? 0)
      gl.uniform1f(u.u_shapeScale, p.shapeSize / 100)
      gl.uniform1f(u.u_distortion, p.distortion / 50)
      gl.uniform1f(u.u_swirl, p.swirl / 100)
      gl.uniform1f(u.u_swirlIterations, p.swirl === 0 ? 0 : p.swirlIterations)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    const loop = (now) => {
      draw(now)
      frame = still.matches ? undefined : requestAnimationFrame(loop)
    }

    const run = () => {
      if (frame !== undefined) return
      if (!seen || document.hidden) return
      frame = requestAnimationFrame(loop)
    }
    const halt = () => {
      if (frame === undefined) return
      cancelAnimationFrame(frame)
      frame = undefined
    }

    /* Off-screen or backgrounded, the loop stops. It is restarted with
       one drawn frame either way, so a surface that comes back into
       view is never blank for a frame. */
    const watcher = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting
      seen ? run() : halt()
    })
    watcher.observe(host)

    const visibility = () => (document.hidden ? halt() : run())
    document.addEventListener('visibilitychange', visibility)

    // A reader who turns motion off mid-session gets the still frame.
    const motion = () => { halt(); requestAnimationFrame(draw) }
    still.addEventListener('change', motion)

    run()
    // One frame immediately, so nothing is blank while rAF waits.
    draw(performance.now())

    return () => {
      halt()
      observer.disconnect()
      watcher.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      still.removeEventListener('change', motion)
      gl.deleteProgram(program.program)
      gl.deleteShader(program.vertex)
      gl.deleteShader(program.fragment)
      gl.deleteBuffer(program.buffer)
    }
  }, [])

  return (
    <div ref={hostRef} className={`ag${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}

/* Compile, link, and say so when it fails rather than handing back a
   program that draws nothing. */
function build(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  if (!vertex || !fragment) return null

  const program = gl.createProgram()
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('AnimatedGradient: link failed —', gl.getProgramInfoLog(program))
    return null
  }

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  return { program, vertex, fragment, buffer }
}

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  console.warn('AnimatedGradient: shader failed —', gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

/* The tokens are written as hex or rgb() like the rest of the palette;
   the shader wants four floats. */
function rgba(value) {
  const v = (value || '').trim()
  if (v.startsWith('#')) {
    const c = v.slice(1)
    const pair = (i) => parseInt(c.length === 3 ? c[i] + c[i] : c.slice(i * 2, i * 2 + 2), 16) / 255
    return [pair(0), pair(1), pair(2), c.length === 8 ? parseInt(c.slice(6, 8), 16) / 255 : 1]
  }
  const n = v.match(/[\d.]+/g)
  if (!n) return [0, 0, 0, 1]
  return [n[0] / 255, n[1] / 255, n[2] / 255, n[3] === undefined ? 1 : Number(n[3])]
}

const VERTEX = `#version 300 es
in vec4 a_position;
void main() { gl_Position = a_position; }`

const FRAGMENT = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = .5 * u_time;

    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);

    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);

    fragColor = vec4(color_mix.rgb, color_mix.a);
}
`
