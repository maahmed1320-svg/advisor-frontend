import { useMemo, useState, useCallback } from 'react'
import s from './Chains.module.css'

const STATE_COLOR = {
  completed:           { fill:'#111', stroke:'#111', text:'#fff' },
  in_progress:         { fill:'#fff', stroke:'#111', text:'#111' },
  available:           { fill:'#fff', stroke:'#777', text:'#444' },
  locked:              { fill:'#fff', stroke:'#ddd', text:'#bbb' },
}

const NODE_W   = 120
const NODE_H   = 40
const COL_W    = 156
const ROW_H    = 62

function buildGraph(chains) {
  const stateMap    = {}
  const childrenMap = {}
  const parentsMap  = {}

  for (const chain of chains) {
    for (let i = 0; i < chain.length; i++) {
      const { code, state } = chain[i]
      stateMap[code] = state
      if (i < chain.length - 1) {
        const childCode = chain[i + 1].code
        if (!childrenMap[code])     childrenMap[code]     = new Set()
        if (!parentsMap[childCode]) parentsMap[childCode] = new Set()
        childrenMap[code].add(childCode)
        parentsMap[childCode].add(code)
      }
    }
  }

  const allCodes = new Set(chains.flat().map(n => n.code))
  const roots    = [...allCodes].filter(c => !parentsMap[c])
  return { stateMap, childrenMap, parentsMap, roots }
}

function assignLayers(roots, childrenMap, parentsMap) {
  const layer = {}
  const queue = [...roots]
  roots.forEach(r => { layer[r] = 0 })
  while (queue.length) {
    const node = queue.shift()
    for (const child of (childrenMap[node] || [])) {
      const parents = [...(parentsMap[child] || [])]
      const newL = Math.max(...parents.map(p => layer[p] ?? 0)) + 1
      if (layer[child] === undefined || layer[child] < newL) {
        layer[child] = newL
        queue.push(child)
      }
    }
  }
  return layer
}

function assignPositions(layer, childrenMap, parentsMap) {
  const byLayer = {}
  for (const [code, l] of Object.entries(layer)) {
    if (!byLayer[l]) byLayer[l] = []
    byLayer[l].push(code)
  }
  const pos = {}
  const maxLayer = Math.max(...Object.keys(byLayer).map(Number))
  for (let l = 0; l <= maxLayer; l++) {
    const nodes = (byLayer[l] || []).sort((a, b) => {
      const avg = arr => arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0
      const pa = [...(parentsMap[a]||[])].map(p=>pos[p]?.row??0)
      const pb = [...(parentsMap[b]||[])].map(p=>pos[p]?.row??0)
      return avg(pa) - avg(pb)
    })
    nodes.forEach((code, i) => { pos[code] = { col: l, row: i } })
  }
  return { pos, byLayer, maxLayer }
}

// Get all ancestors of a node (for highlight)
function getAncestors(code, parentsMap) {
  const visited = new Set()
  const queue   = [code]
  while (queue.length) {
    const cur = queue.shift()
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const p of (parentsMap[cur] || [])) queue.push(p)
  }
  return visited
}

// Get all ancestor EDGES
function getAncestorEdges(code, parentsMap) {
  const nodes = getAncestors(code, parentsMap)
  const edges = new Set()
  for (const node of nodes) {
    for (const parent of (parentsMap[node] || [])) {
      if (nodes.has(parent)) edges.add(`${parent}->${node}`)
    }
  }
  return edges
}

export default function Chains({ chains }) {
  const [hovered, setHovered] = useState(null)

  const { stateMap, childrenMap, parentsMap, roots } = useMemo(
    () => buildGraph(chains), [chains]
  )
  const layer = useMemo(
    () => assignLayers(roots, childrenMap, parentsMap), [roots, childrenMap, parentsMap]
  )
  const { pos, byLayer, maxLayer } = useMemo(
    () => assignPositions(layer, childrenMap, parentsMap), [layer, childrenMap, parentsMap]
  )

  // On hover: compute highlighted nodes + edges
  const { hlNodes, hlEdges } = useMemo(() => {
    if (!hovered) return { hlNodes: null, hlEdges: null }
    const hlNodes = getAncestors(hovered, parentsMap)
    hlNodes.add(hovered)
    const hlEdges = getAncestorEdges(hovered, parentsMap)
    return { hlNodes, hlEdges }
  }, [hovered, parentsMap])

  const isAnyHovered = !!hovered

  const maxRows = Math.max(...Object.values(byLayer).map(a => a.length))
  const svgW    = (maxLayer + 1) * COL_W + NODE_W + 20
  const svgH    = maxRows * ROW_H + NODE_H + 20

  function cx(code) { return pos[code].col * COL_W + NODE_W / 2 + 10 }
  function cy(code) { return pos[code].row * ROW_H + NODE_H / 2 + 10 }

  const edges = []
  for (const [parent, children] of Object.entries(childrenMap)) {
    for (const child of children) {
      if (pos[parent] && pos[child]) edges.push({ from: parent, to: child })
    }
  }

  return (
    <div className={s.wrap}>
      <svg
        width="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ overflow:'visible', display:'block', cursor:'default' }}
      >
        <defs>
          {/* Arrow markers for all states */}
          {[
            ['arr-dim',      '#eee'],
            ['arr-normal',   '#ccc'],
            ['arr-hl',       '#f59e0b'],
            ['arr-hl-merge', '#ef4444'],
          ].map(([id, color]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M1 2L9 5L1 8" fill="none" stroke={color}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
          ))}
        </defs>

        {/* Edges */}
        {edges.map(({ from, to }) => {
          const x1 = cx(from) + NODE_W / 2
          const y1 = cy(from)
          const x2 = cx(to)   - NODE_W / 2 - 3
          const y2 = cy(to)

          const edgeKey     = `${from}->${to}`
          const isHl        = hlEdges?.has(edgeKey)
          const isMultiP    = (parentsMap[to]?.size ?? 0) > 1
          const isDim       = isAnyHovered && !isHl

          let stroke, strokeW, dash, marker
          if (isDim) {
            stroke = '#eee'; strokeW = 0.6; dash = 'none'; marker = 'url(#arr-dim)'
          } else if (isHl && isMultiP) {
            stroke = '#ef4444'; strokeW = 2; dash = 'none'; marker = 'url(#arr-hl-merge)'
          } else if (isHl) {
            stroke = '#f59e0b'; strokeW = 2; dash = 'none'; marker = 'url(#arr-hl)'
          } else {
            stroke = '#ccc'; strokeW = 0.8
            dash   = isMultiP ? '3 2' : 'none'
            marker = 'url(#arr-normal)'
          }

          let d
          if (Math.abs(y1 - y2) < 2) {
            d = `M${x1} ${y1} L${x2} ${y2}`
          } else {
            const mx = x1 + (x2 - x1) * 0.4
            d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
          }

          return (
            <path key={edgeKey} d={d} fill="none"
              stroke={stroke} strokeWidth={strokeW}
              strokeDasharray={dash} markerEnd={marker}
              style={{ transition:'stroke 0.15s, stroke-width 0.15s, opacity 0.15s' }}
            />
          )
        })}

        {/* Nodes */}
        {Object.keys(pos).map(code => {
          const state    = stateMap[code] ?? 'locked'
          const c        = STATE_COLOR[state] ?? STATE_COLOR.locked
          const isHl     = hlNodes?.has(code)
          const isDim    = isAnyHovered && !isHl
          const isHover  = code === hovered
          const isMultiP = (parentsMap[code]?.size ?? 0) > 1

          const x = cx(code) - NODE_W / 2
          const y = cy(code) - NODE_H / 2

          // Override colors when highlighted
          let fill   = c.fill
          let stroke = c.stroke
          let text   = c.text
          let strokeW = isMultiP ? 1.5 : 0.8
          let opacity = 1

          if (isDim) {
            opacity = 0.2
          } else if (isHover) {
            fill = '#f59e0b'; stroke = '#d97706'; text = '#fff'; strokeW = 2
          } else if (isHl) {
            // ancestor — keep original color but brighten border
            stroke = '#f59e0b'; strokeW = 1.8
          }

          const label = code.replace('_CSE','').replace('_SWE','').replace('_CEN','')

          return (
            <g key={code}
              style={{ cursor:'pointer', transition:'opacity 0.15s' }}
              opacity={opacity}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect x={x} y={y} width={NODE_W} height={NODE_H}
                rx={NODE_H/2}
                fill={fill} stroke={stroke} strokeWidth={strokeW}
                strokeDasharray={isMultiP && !isHl && !isDim ? '4 2' : 'none'}
                style={{ transition:'fill 0.15s, stroke 0.15s' }}
              />
              <text x={cx(code)} y={cy(code)}
                textAnchor="middle" dominantBaseline="central"
                fontSize="17" fontFamily="monospace" fill={text}
                style={{ pointerEvents:'none', userSelect:'none' }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover hint */}
      {!hovered && (
        <div className={s.hint}>Hover a course to highlight its prerequisite chain</div>
      )}
      {hovered && (
        <div className={s.hoverInfo}>
          <span className={s.hoveredCode}>{hovered}</span>
          {parentsMap[hovered]?.size > 0 && (
            <span className={s.prereqList}>
              requires: {[...(parentsMap[hovered]||[])].join(' + ')}
            </span>
          )}
          {(parentsMap[hovered]?.size ?? 0) === 0 && (
            <span className={s.prereqList}>no prerequisites</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className={s.legend}>
        {[
          ['#111','#111','#fff','Done'],
          ['#fff','#111','#111','In progress'],
          ['#fff','#777','#444','Available'],
          ['#fff','#ddd','#bbb','Locked'],
        ].map(([fill,stroke,text,label]) => (
          <span key={label} className={s.legendItem}>
            <svg width="24" height="14" viewBox="0 0 24 14">
              <rect x="1" y="1" width="22" height="12" rx="6"
                fill={fill} stroke={stroke} strokeWidth="0.8"/>
            </svg>
            {label}
          </span>
        ))}
        <span className={s.legendItem}>
          <svg width="24" height="14" viewBox="0 0 24 14">
            <rect x="1" y="1" width="22" height="12" rx="6"
              fill="#fff" stroke="#777" strokeWidth="1.5" strokeDasharray="4 2"/>
          </svg>
          Needs 2+ prereqs
        </span>
      </div>
    </div>
  )
}
