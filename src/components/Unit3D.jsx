import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Procedurally-built steel equipment — a real WebGL model, no external asset needed.
// kind: 'vessel' | 'tank' | 'spool' | 'skid'
function buildUnit(kind) {
  const g = new THREE.Group()
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb9c9, metalness: 0.92, roughness: 0.34, envMapIntensity: 1 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x49586d, metalness: 0.75, roughness: 0.55, envMapIntensity: 0.8 })
  const accent = new THREE.MeshStandardMaterial({ color: 0x5b87f7, metalness: 0.55, roughness: 0.4, envMapIntensity: 0.9 })

  const cyl = (rt, rb, h, mat, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  const tor = (r, t, mat) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 18, 44), mat)
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  const sph = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), mat)

  if (kind === 'tank') {
    g.add(cyl(1.05, 1.05, 2.7, steel))
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.7, 48), steel); roof.position.y = 1.7; g.add(roof)
    const rim = tor(1.06, 0.05, dark); rim.rotation.x = Math.PI / 2; rim.position.y = 1.35; g.add(rim)
    const skirt = cyl(1.06, 1.14, 0.4, dark); skirt.position.y = -1.55; g.add(skirt)
    const noz = cyl(0.12, 0.12, 0.5, accent); noz.rotation.z = Math.PI / 2; noz.position.set(1.25, 0.4, 0); g.add(noz)
    const fl = tor(0.16, 0.05, accent); fl.rotation.y = Math.PI / 2; fl.position.set(1.5, 0.4, 0); g.add(fl)
  } else if (kind === 'spool') {
    const r = 0.34
    const a = cyl(r, r, 2.4, steel); a.rotation.z = Math.PI / 2; a.position.set(0, 0.5, 0); g.add(a)
    const b = cyl(r, r, 1.5, steel); b.position.set(1.2, -0.25, 0); g.add(b)
    const joint = sph(r + 0.04, steel); joint.position.set(1.2, 0.5, 0); g.add(joint)
    const f1 = tor(r + 0.12, 0.06, dark); f1.rotation.y = Math.PI / 2; f1.position.set(-1.2, 0.5, 0); g.add(f1)
    const f2 = tor(r + 0.12, 0.06, dark); f2.rotation.x = Math.PI / 2; f2.position.set(1.2, -1.05, 0); g.add(f2)
    const valve = box(0.34, 0.34, 0.34, accent); valve.position.set(0.2, 0.5, 0); g.add(valve)
  } else if (kind === 'skid') {
    const L = 3, W = 1.7, beamH = 0.13
    const railZ = [W / 2, -W / 2]
    railZ.forEach((z) => { const b = box(L, beamH, 0.16, dark); b.position.set(0, -0.85, z); g.add(b) })
    ;[L / 2, -L / 2].forEach((x) => { const b = box(0.16, beamH, W, dark); b.position.set(x, -0.85, 0); g.add(b) })
    ;[[L / 2 - 0.2, W / 2 - 0.2], [-(L / 2 - 0.2), W / 2 - 0.2], [L / 2 - 0.2, -(W / 2 - 0.2)], [-(L / 2 - 0.2), -(W / 2 - 0.2)]]
      .forEach(([x, z]) => { const leg = box(0.13, 0.8, 0.13, dark); leg.position.set(x, -0.45, z); g.add(leg) })
    const v = cyl(0.68, 0.68, 2.1, steel); v.rotation.z = Math.PI / 2; v.position.y = 0.15; g.add(v)
    ;[1.05, -1.05].forEach((x) => { const hd = sph(0.68, steel); hd.scale.x = 0.55; hd.position.set(x, 0.15, 0); g.add(hd) })
    const noz = cyl(0.12, 0.12, 0.5, accent); noz.position.set(0, 1.0, 0); g.add(noz)
  } else { // vessel — horizontal pressure vessel on saddles
    const len = 3, r = 0.95
    const body = cyl(r, r, len, steel); body.rotation.z = Math.PI / 2; g.add(body)
    ;[len / 2, -len / 2].forEach((x) => { const hd = sph(r, steel); hd.scale.x = 0.55; hd.position.x = x; g.add(hd) })
    ;[0.95, -0.95].forEach((x) => { const s = box(0.42, 0.72, 1.85, dark); s.position.set(x, -0.96, 0); g.add(s) })
    const noz = cyl(0.16, 0.16, 0.55, accent); noz.position.set(-0.2, r + 0.22, 0); g.add(noz)
    const fl = tor(0.22, 0.06, accent); fl.rotation.x = Math.PI / 2; fl.position.set(-0.2, r + 0.5, 0); g.add(fl)
    const noz2 = cyl(0.1, 0.1, 0.42, accent); noz2.position.set(0.9, r + 0.12, 0); g.add(noz2)
  }
  g.position.y = 0.1
  return g
}

export default function Unit3D({ kind = 'vessel' }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})

  useEffect(() => {
    const mount = mountRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = mount.clientWidth || 360, h = mount.clientHeight || 260

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100)
    camera.position.set(0.4, 1.3, 6.4)
    camera.lookAt(0, 0, 0)

    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    scene.add(new THREE.AmbientLight(0x6f7e96, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(4, 6, 5); scene.add(key)
    const fill = new THREE.DirectionalLight(0x5b87f7, 0.55); fill.position.set(-5, 2, 3); scene.add(fill)
    const rim = new THREE.DirectionalLight(0x3bd09a, 0.5); rim.position.set(-2, -3, -5); scene.add(rim)

    const pivot = new THREE.Group(); scene.add(pivot)

    const st = stateRef.current
    Object.assign(st, { renderer, scene, camera, pivot, pmrem, model: null, targetY: -0.55, curY: -0.55, targetX: 0.06, curX: 0.06, dragging: false, auto: !reduce, reduce })

    let px = 0, py = 0
    const down = (e) => { st.dragging = true; st.auto = false; px = e.clientX; py = e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId) }
    const move = (e) => { if (!st.dragging) return; st.targetY += (e.clientX - px) * 0.008; st.targetX = Math.max(-0.5, Math.min(0.6, st.targetX + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY }
    const up = () => { if (!st.dragging) return; st.dragging = false; if (!st.reduce) setTimeout(() => { st.auto = true }, 2500) }
    renderer.domElement.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)

    const ro = new ResizeObserver(() => { const W = mount.clientWidth, H = mount.clientHeight; if (W && H) { renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix() } })
    ro.observe(mount)

    let raf
    const tick = () => {
      if (st.auto && !st.dragging) st.targetY += 0.0045
      st.curY += (st.targetY - st.curY) * 0.08
      st.curX += (st.targetX - st.curX) * 0.08
      pivot.rotation.set(st.curX, st.curY, 0)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose() })
      pmrem.dispose(); renderer.dispose()
      renderer.domElement.parentNode?.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const st = stateRef.current
    if (!st.pivot) return
    if (st.model) { st.pivot.remove(st.model); st.model.traverse((o) => { if (o.geometry) o.geometry.dispose() }) }
    st.model = buildUnit(kind)
    st.pivot.add(st.model)
  }, [kind])

  return <div className="unit3d" ref={mountRef} />
}
