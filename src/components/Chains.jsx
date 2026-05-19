import { useEffect, useRef, useMemo } from 'react'
import { Scene, PerspectiveCamera, WebGLRenderer, SphereGeometry,
         MeshPhongMaterial, Mesh, LineBasicMaterial, BufferGeometry,
         Vector3, Points, PointsMaterial, AmbientLight, PointLight,
         QuadraticBezierCurve3, TorusGeometry, Sprite, SpriteMaterial,
         CanvasTexture, BufferAttribute } from 'three'


// ── Constants ────────────────────────────────────────────────
const STATE_CFG = {
  completed:           { color: 0xffffff, emissive: 0x88ffcc, radius: 0.38, opacity: 1.0,  ring: false },
  in_progress:         { color: 0x4fc3f7, emissive: 0x0077aa, radius: 0.36, opacity: 1.0,  ring: true  },
  in_progress_at_risk: { color: 0xff6b6b, emissive: 0xaa1100, radius: 0.36, opacity: 1.0,  ring: true  },
  available:           { color: 0xaaaacc, emissive: 0x333366, radius: 0.30, opacity: 0.90, ring: false },
  locked:              { color: 0x333344, emissive: 0x111122, radius: 0.22, opacity: 0.55, ring: false },
  placeholder:         { color: 0x222233, emissive: 0x111122, radius: 0.14, opacity: 0.30, ring: false },
}

const EDGE_COLOR_NORMAL = 0x334466
const EDGE_COLOR_COREQ  = 0x6366f1
const EDGE_COLOR_HL     = 0xf59e0b
const EDGE_COLOR_BLOCK  = 0xef4444

// ── Layout: assign 3D positions ──────────────────────────────
function buildGraph(chainDisplay, coReqEdges, blockedCodes) {
  const stateMap = {}
  for (const node of chainDisplay) stateMap[node.code] = node.state

  const prereqMap  = {}
  const childrenOf = {}
  const coReqSet   = new Set(coReqEdges || [])
  const blockedSet = new Set(blockedCodes || [])

  // Build edges from sequential chain order
  const codes = chainDisplay.map(n => n.code)
  const seen  = new Set()
  for (let i = 0; i < codes.length; i++) {
    if (seen.has(codes[i])) continue
    seen.add(codes[i])
    prereqMap[codes[i]]  = prereqMap[codes[i]]  || []
    childrenOf[codes[i]] = childrenOf[codes[i]] || []
  }

  // Build parent→child from coReqEdges + infer chain edges
  // We use a simple topological layout: BFS from roots
  const allEdges = []
  for (const edge of coReqSet) {
    const [a, b] = edge.split('->')
    if (!prereqMap[b])  prereqMap[b]  = []
    if (!childrenOf[a]) childrenOf[a] = []
    if (!prereqMap[b].includes(a))  prereqMap[b].push(a)
    if (!childrenOf[a].includes(b)) childrenOf[a].push(b)
    allEdges.push({ from: a, to: b, type: 'coreq' })
  }

  // Assign layers via BFS
  const layer = {}
  const inDeg = {}
  for (const code of codes) inDeg[code] = (prereqMap[code] || []).length
  const queue = codes.filter(c => inDeg[c] === 0)
  queue.forEach(c => { layer[c] = 0 })
  const visited = new Set(queue)
  while (queue.length) {
    const cur = queue.shift()
    for (const ch of (childrenOf[cur] || [])) {
      const newL = (layer[cur] ?? 0) + 1
      layer[ch] = Math.max(layer[ch] ?? 0, newL)
      if (!visited.has(ch)) { visited.add(ch); queue.push(ch) }
    }
  }
  // Fallback: sequential layer for remaining
  codes.forEach((c, i) => { if (layer[c] === undefined) layer[c] = Math.floor(i / 5) })

  // Group by layer
  const byLayer = {}
  for (const c of codes) {
    const l = layer[c] ?? 0
    if (!byLayer[l]) byLayer[l] = []
    byLayer[l].push(c)
  }

  const maxLayer = Math.max(...Object.keys(byLayer).map(Number))
  const positions = {}
  const LAYER_GAP = 3.5
  const NODE_GAP  = 2.2

  for (let l = 0; l <= maxLayer; l++) {
    const nodes = byLayer[l] || []
    const count = nodes.length
    nodes.forEach((code, i) => {
      const x = l * LAYER_GAP - (maxLayer * LAYER_GAP) / 2
      const y = (i - (count - 1) / 2) * NODE_GAP
      const z = (Math.random() - 0.5) * 1.2
      positions[code] = new THREE.Vector3(x, y, z)
    })
  }

  // Normal chain edges (adjacent nodes in each layer boundary)
  for (let l = 0; l < maxLayer; l++) {
    const from = byLayer[l]  || []
    const to   = byLayer[l+1] || []
    if (from.length === 1) {
      for (const t of to) {
        if (!allEdges.find(e => e.from === from[0] && e.to === t))
          allEdges.push({ from: from[0], to: t, type: 'normal' })
      }
    } else if (to.length === 1) {
      for (const f of from) {
        if (!allEdges.find(e => e.from === f && e.to === to[0]))
          allEdges.push({ from: f, to: to[0], type: 'normal' })
      }
    }
  }

  return { stateMap, positions, allEdges, blockedSet, coReqSet }
}

// ── Label sprites (canvas texture) ──────────────────────────
function makeLabel(code, color) {
  const c = document.createElement('canvas')
  c.width  = 256
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 256, 64)
  ctx.font = 'bold 22px monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = code.replace(/_CSE|_SWE|_CEN|_BCE/g, '')
  ctx.fillText(label, 128, 32)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.2, 0.55, 1)
  return sprite
}

// ── Main component ───────────────────────────────────────────
export default function Chains({ chains: chainDisplay, coReqEdges, blockedCodes }) {
  const mountRef  = useRef(null)
  const stateRef  = useRef({})

  const graphData = useMemo(
    () => buildGraph(chainDisplay || [], coReqEdges || [], blockedCodes || []),
    [chainDisplay, coReqEdges, blockedCodes]
  )

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const W = el.clientWidth  || 900
    const H = el.clientHeight || 600

    // ── Scene ────────────────────────────────────────────────
    const scene    = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a14)

    // Subtle star field
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(3000)
    for (let i = 0; i < 3000; i++) starPos[i] = (Math.random() - 0.5) * 120
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.5 })
    scene.add(new THREE.Points(starGeo, starMat))

    // ── Camera ───────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200)
    camera.position.set(0, 0, 22)

    // ── Renderer ─────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    el.appendChild(renderer.domElement)

    // ── Lighting ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x223366, 1.2))
    const point = new THREE.PointLight(0x4488ff, 2.5, 60)
    point.position.set(0, 8, 10)
    scene.add(point)

    // ── Nodes ────────────────────────────────────────────────
    const { stateMap, positions, allEdges, blockedSet } = graphData
    const nodeMap = {}   // code → { mesh, ring, label }
    const allNodes = (chainDisplay || []).filter(n => n.state !== 'placeholder')

    for (const node of allNodes) {
      const { code, state } = node
      const cfg = STATE_CFG[state] || STATE_CFG.locked
      const pos = positions[code]
      if (!pos) continue

      const geo  = new THREE.SphereGeometry(cfg.radius, 28, 28)
      const mat  = new THREE.MeshPhongMaterial({
        color:       cfg.color,
        emissive:    cfg.emissive,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity:     cfg.opacity,
        shininess:   80,
      })
      if (blockedSet.has(code)) {
        mat.color.set(0xff4444)
        mat.emissive.set(0x880000)
      }
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.userData = { code, state, origColor: mat.color.clone(), origEmissive: mat.emissive.clone() }
      scene.add(mesh)

      // Pulse ring for in-progress
      let ring = null
      if (cfg.ring) {
        const rGeo = new THREE.TorusGeometry(cfg.radius + 0.12, 0.04, 8, 40)
        const rMat = new THREE.MeshBasicMaterial({
          color: state === 'in_progress_at_risk' ? 0xff4444 : 0x4fc3f7,
          transparent: true, opacity: 0.7,
        })
        ring = new THREE.Mesh(rGeo, rMat)
        ring.position.copy(pos)
        scene.add(ring)
      }

      // Label sprite
      const labelColor = state === 'locked' ? '#334' : state === 'completed' ? '#aaffcc' : '#cce4ff'
      const label = makeLabel(code, labelColor)
      label.position.set(pos.x, pos.y - cfg.radius - 0.42, pos.z)
      scene.add(label)

      nodeMap[code] = { mesh, ring, label }
    }

    // ── Edges ─────────────────────────────────────────────────
    const edgeObjects = []
    for (const edge of allEdges) {
      const a = positions[edge.from]
      const b = positions[edge.to]
      if (!a || !b) continue

      const mid    = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
      mid.y       += (Math.random() - 0.5) * 0.8
      const curve  = new THREE.QuadraticBezierCurve3(a, mid, b)
      const pts    = curve.getPoints(30)
      const geo    = new THREE.BufferGeometry().setFromPoints(pts)
      const color  = edge.type === 'coreq' ? EDGE_COLOR_COREQ : EDGE_COLOR_NORMAL
      const mat    = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: edge.type === 'coreq' ? 0.7 : 0.28,
      })
      const line = new THREE.Line(geo, mat)
      line.userData = { from: edge.from, to: edge.to, type: edge.type, baseColor: color, baseOpacity: mat.opacity }
      scene.add(line)
      edgeObjects.push(line)
    }

    // ── Raycaster for hover ───────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse     = new THREE.Vector2()
    const meshList  = Object.values(nodeMap).map(n => n.mesh)
    let hoveredCode = null

    function getRelMouse(e) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1
    }

    function onMouseMove(e) {
      getRelMouse(e)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(meshList)
      const hit  = hits.length ? hits[0].object.userData.code : null

      if (hit === hoveredCode) return
      hoveredCode = hit

      // Reset all
      for (const [code, { mesh }] of Object.entries(nodeMap)) {
        mesh.material.emissiveIntensity = 0.6
        mesh.material.color.copy(mesh.userData.origColor)
        mesh.material.emissive.copy(mesh.userData.origEmissive)
        mesh.material.opacity = STATE_CFG[mesh.userData.state]?.opacity ?? 1
      }
      for (const line of edgeObjects) {
        line.material.color.set(line.userData.baseColor)
        line.material.opacity = line.userData.baseOpacity
      }

      if (!hit) { renderer.domElement.style.cursor = 'default'; return }
      renderer.domElement.style.cursor = 'pointer'

      // Highlight hit node
      const n = nodeMap[hit]
      if (n) {
        n.mesh.material.emissiveIntensity = 1.8
        n.mesh.material.color.set(0xf59e0b)
        n.mesh.material.emissive.set(0xb05000)
      }

      // Highlight connected edges + dim others
      const connectedNodes = new Set([hit])
      for (const line of edgeObjects) {
        const { from, to, type } = line.userData
        if (from === hit || to === hit) {
          line.material.color.set(type === 'coreq' ? EDGE_COLOR_COREQ : EDGE_COLOR_HL)
          line.material.opacity = 0.9
          connectedNodes.add(from)
          connectedNodes.add(to)
        } else {
          line.material.opacity = 0.04
        }
      }
      // Dim unconnected nodes
      for (const [code, { mesh }] of Object.entries(nodeMap)) {
        if (!connectedNodes.has(code)) {
          mesh.material.opacity = 0.12
        }
      }
    }

    renderer.domElement.addEventListener('mousemove', onMouseMove)

    // ── Orbit controls (manual, no dep needed) ───────────────
    let isDragging = false
    let lastX = 0, lastY = 0
    let rotX = 0, rotY = 0, targetRotX = 0, targetRotY = 0
    let zoom = 22, targetZoom = 22

    renderer.domElement.addEventListener('mousedown', e => {
      isDragging = true; lastX = e.clientX; lastY = e.clientY
    })
    window.addEventListener('mouseup', () => { isDragging = false })
    window.addEventListener('mousemove', e => {
      if (!isDragging) return
      targetRotY += (e.clientX - lastX) * 0.004
      targetRotX += (e.clientY - lastY) * 0.004
      targetRotX  = Math.max(-1.1, Math.min(1.1, targetRotX))
      lastX = e.clientX; lastY = e.clientY
    })
    renderer.domElement.addEventListener('wheel', e => {
      targetZoom = Math.max(8, Math.min(45, targetZoom + e.deltaY * 0.04))
      e.preventDefault()
    }, { passive: false })

    // ── Animation loop ────────────────────────────────────────
    let frame = 0
    let animId

    function animate() {
      animId = requestAnimationFrame(animate)
      frame++

      // Smooth camera
      rotX += (targetRotX - rotX) * 0.08
      rotY += (targetRotY - rotY) * 0.08
      zoom += (targetZoom - zoom) * 0.08

      camera.position.x = zoom * Math.sin(rotY) * Math.cos(rotX)
      camera.position.y = zoom * Math.sin(rotX)
      camera.position.z = zoom * Math.cos(rotY) * Math.cos(rotX)
      camera.lookAt(0, 0, 0)

      // Pulse rings
      for (const { ring, mesh } of Object.values(nodeMap)) {
        if (ring) {
          const s = 1 + 0.12 * Math.sin(frame * 0.06)
          ring.scale.set(s, s, 1)
          ring.material.opacity = 0.4 + 0.3 * Math.sin(frame * 0.06)
          ring.lookAt(camera.position)
        }
        // Gentle float
        if (mesh.userData.state === 'completed') {
          mesh.position.y = positions[mesh.userData.code]?.y + 0.06 * Math.sin(frame * 0.03 + mesh.id)
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ───────────────────────────────────────────────
    function onResize() {
      const w = el.clientWidth, h = el.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // ── Cleanup ──────────────────────────────────────────────
    stateRef.current = { animId, renderer, scene }
    return () => {
      cancelAnimationFrame(animId)
      renderer.domElement.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [graphData])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 560, background: '#0a0a14', borderRadius: 8 }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 560 }} />

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14,
        display: 'flex', flexWrap: 'wrap', gap: '8px 14px',
        fontSize: 11, color: '#8899bb', fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        {[
          ['#88ffcc', 'Completed'],
          ['#4fc3f7', 'In progress'],
          ['#ff6b6b', 'At risk / Blocked'],
          ['#aaaacc', 'Available'],
          ['#445', 'Locked'],
          ['#6366f1', '— Co-req'],
          ['#f59e0b', '— Prerequisite'],
        ].map(([color, label]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              display: 'inline-block',
              width: label.startsWith('—') ? 18 : 9,
              height: label.startsWith('—') ? 2 : 9,
              borderRadius: label.startsWith('—') ? 1 : '50%',
              background: color,
            }} />
            {label.replace('— ', '')}
          </span>
        ))}
      </div>

      {/* Controls hint */}
      <div style={{
        position: 'absolute', top: 12, right: 14,
        fontSize: 11, color: '#445566', fontFamily: 'monospace',
        pointerEvents: 'none', textAlign: 'right', lineHeight: 1.7,
      }}>
        drag to rotate · scroll to zoom · hover to highlight
      </div>
    </div>
  )
}