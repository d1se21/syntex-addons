// Boards: an interactive board in a tab of its own; each board is a file of its own kind (Name.board, its data as
// JSON), opened by a click on it in the tree. A board is made at once, under a default name, the moment something is put
// on an empty field (or by "New board"); its name is edited in the title of the board. Boards of older versions (notes
// with a block of data in the "Boards" folder) are moved to such files once.
// Cards of several kinds (text, sticky notes, notes of the vault with a preview, pictures, other files, links, check
// lists, shapes of flowcharts, frames), a dock at the bottom to drag them from, arrows bound to the sides of cards (with
// bend points and labels), selection by frame or by group, undo, alignment, snapping to the dots of the grid (Ctrl),
// search, a minimap, and a right-click menu on everything.

const FOLDER = 'Boards'
const EXT = 'board'
const FENCE = 'syntex-board'
const CLIP = 'syntex-board:'
const NS = 'http://www.w3.org/2000/svg'
const GRID = 24

const COLORS = ['', '#8ab4f8', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#fcad70', '#78d9ec', '#ff8bcb']
const STICKY = '#fdd663'
// (the size of a card that keeps none: cards of older versions were made so)
const DEF = { text: [220, 110], sticky: [180, 180], note: [250, 108], image: [260, 180], file: [264, 72], link: [280, 70], frame: [560, 360], shape: [170, 110], todo: [230, 140] }
// (the size a new card is made in: whole steps of the grid, so that a card put on the dots stays on them)
const SIZE = { text: [216, 108], sticky: [168, 168], note: [264, 120], image: [264, 192], file: [264, 72], link: [288, 72], frame: [552, 360], shape: [168, 96], todo: [240, 144] }
const MIN = { text: [90, 50], sticky: [90, 90], note: [150, 52], image: [60, 40], file: [150, 52], link: [160, 52], frame: [160, 100], shape: [48, 36], todo: [130, 70] }
const IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i
/** The shapes of flowcharts (as in Visio and draw.io): their names and the size they are made in. */
const SHAPES = [
  { id: 'rect', ru: 'Процесс', en: 'Process', size: [168, 96] },
  { id: 'terminator', ru: 'Начало / конец', en: 'Start / end', size: [168, 72] },
  { id: 'diamond', ru: 'Решение', en: 'Decision', size: [168, 120] },
  { id: 'parallelogram', ru: 'Данные', en: 'Data', size: [192, 96] },
  { id: 'document', ru: 'Документ', en: 'Document', size: [168, 108] },
  { id: 'cylinder', ru: 'База данных', en: 'Database', size: [144, 120] },
  { id: 'subprocess', ru: 'Подпроцесс', en: 'Subprocess', size: [192, 96] },
  { id: 'manual', ru: 'Ручной ввод', en: 'Manual input', size: [168, 96] },
  { id: 'delay', ru: 'Задержка', en: 'Delay', size: [168, 96] },
  { id: 'hexagon', ru: 'Подготовка', en: 'Preparation', size: [192, 96] },
  { id: 'trapezoid', ru: 'Ручная операция', en: 'Manual operation', size: [192, 96] },
  { id: 'ellipse', ru: 'Эллипс', en: 'Ellipse', size: [144, 96] },
  { id: 'circle', ru: 'Соединитель', en: 'Connector', size: [72, 72] }
]
const SIDES = ['top', 'right', 'bottom', 'left']
const PORT_SIDE = { t: 'top', r: 'right', b: 'bottom', l: 'left' }
const NORMAL = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/** The outline of a shape of size w × h, as the `d` of a path (and the extra lines drawn over it). */
const shapePath = (shape, w, h) => {
  const W = w - 1
  const H = h - 1
  const e = 1
  if (shape === 'ellipse' || shape === 'circle') {
    const rx = w / 2 - 1
    const ry = h / 2 - 1
    return { d: `M${e} ${h / 2}A${rx} ${ry} 0 1 1 ${W} ${h / 2}A${rx} ${ry} 0 1 1 ${e} ${h / 2}Z` }
  }
  if (shape === 'diamond') return { d: `M${w / 2} ${e}L${W} ${h / 2}L${w / 2} ${H}L${e} ${h / 2}Z` }
  if (shape === 'terminator') {
    const r = Math.min(h / 2, w / 2) - 1
    return { d: `M${e + r} ${e}H${W - r}A${r} ${r} 0 0 1 ${W - r} ${H}H${e + r}A${r} ${r} 0 0 1 ${e + r} ${e}Z` }
  }
  if (shape === 'parallelogram') {
    const s = Math.min(w * 0.2, h * 0.5)
    return { d: `M${e + s} ${e}H${W}L${W - s} ${H}H${e}Z` }
  }
  if (shape === 'document') {
    const a = h * 0.1
    return { d: `M${e} ${e}H${W}V${H - a}C${w * 0.75} ${H - 3 * a} ${w * 0.25} ${H + a} ${e} ${H - a}Z` }
  }
  if (shape === 'cylinder') {
    const rx = w / 2 - 1
    const ry = Math.min(h * 0.15, 18)
    return {
      d: `M${e} ${e + ry}A${rx} ${ry} 0 0 1 ${W} ${e + ry}V${H - ry}A${rx} ${ry} 0 0 1 ${e} ${H - ry}Z`,
      extra: `M${e} ${e + ry}A${rx} ${ry} 0 0 0 ${W} ${e + ry}`
    }
  }
  if (shape === 'subprocess') {
    const s = Math.min(14, w * 0.1)
    return { d: `M${e} ${e}H${W}V${H}H${e}Z`, extra: `M${e + s} ${e}V${H}M${W - s} ${e}V${H}` }
  }
  if (shape === 'manual') return { d: `M${e} ${h * 0.3}L${W} ${e}V${H}H${e}Z` }
  if (shape === 'delay') {
    const r = Math.min(h / 2, w / 2) - 1
    return { d: `M${e} ${e}H${W - r}A${r} ${r} 0 0 1 ${W - r} ${H}H${e}Z` }
  }
  if (shape === 'hexagon') {
    const s = Math.min(w * 0.2, h * 0.5)
    return { d: `M${e + s} ${e}H${W - s}L${W} ${h / 2}L${W - s} ${H}H${e + s}L${e} ${h / 2}Z` }
  }
  if (shape === 'trapezoid') {
    const s = Math.min(w * 0.18, h * 0.6)
    return { d: `M${e} ${e}H${W}L${W - s} ${H}H${e + s}Z` }
  }
  const r = Math.min(6, w / 4, h / 4)
  return { d: `M${e + r} ${e}H${W - r}Q${W} ${e} ${W} ${e + r}V${H - r}Q${W} ${H} ${W - r} ${H}H${e + r}Q${e} ${H} ${e} ${H - r}V${e + r}Q${e} ${e} ${e + r} ${e}Z` }
}
/** Where the text of a shape stays inside it: [top, right, bottom, left]. */
const shapeInset = (shape, w, h) => {
  if (shape === 'diamond') return [h * 0.2, w * 0.2, h * 0.2, w * 0.2]
  if (shape === 'ellipse' || shape === 'circle') return [h * 0.14, w * 0.14, h * 0.14, w * 0.14]
  if (shape === 'parallelogram' || shape === 'hexagon') return [6, Math.min(w * 0.2, h * 0.5) + 4, 6, Math.min(w * 0.2, h * 0.5) + 4]
  if (shape === 'trapezoid') return [6, Math.min(w * 0.18, h * 0.6) / 2 + 8, 6, Math.min(w * 0.18, h * 0.6) / 2 + 8]
  if (shape === 'cylinder') return [Math.min(h * 0.15, 18) * 2 + 2, 10, 6, 10]
  if (shape === 'document') return [6, 12, h * 0.16, 12]
  if (shape === 'subprocess') return [6, Math.min(14, w * 0.1) + 8, 6, Math.min(14, w * 0.1) + 8]
  if (shape === 'manual') return [h * 0.26, 12, 6, 12]
  if (shape === 'delay') return [6, Math.min(h / 2, w / 2) * 0.5 + 8, 6, 12]
  if (shape === 'terminator') return [6, Math.min(h / 2, w / 2) * 0.6, 6, Math.min(h / 2, w / 2) * 0.6]
  return [8, 12, 8, 12]
}
/** How far in from the middle of a side of its box the outline of a shape is (an arrow ends on the outline). */
const sideInset = (shape, side, w, h) => {
  if (shape === 'parallelogram' && (side === 'left' || side === 'right')) return Math.min(w * 0.2, h * 0.5) / 2
  if (shape === 'trapezoid' && (side === 'left' || side === 'right')) return Math.min(w * 0.18, h * 0.6) / 2
  if (shape === 'manual' && side === 'top') return h * 0.15
  if (shape === 'document' && side === 'bottom') return h * 0.1
  return 0
}
const FONTS = [13, 15, 19, 26]

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const child of children) node.append(child)
  return node
}
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) node.setAttribute(k, String(v))
  return node
}
const ICONS = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-1.9M5 11h14v10H5z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-12.5 4.3L3 15a1.6 1.6 0 0 1 2.6-1.9L8 15.5',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  pencil: 'M16 4l4 4L8 20H4v-4z',
  reverse: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
  dash: 'M3 12h4M10 12h4M17 12h4',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  card: 'M7 3h7l4 4v14H7zM14 3v4h4',
  sticky: 'M5 4h14v10l-6 6H5zM13 20v-6h6',
  note: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15.5h5M10 9h2',
  media: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 18l2.5-3.5 1.8 2 1.2-1.3 1.5 2.8M11 10.5h.01',
  frame: 'M4 8h16v12H4zM4 4.5h7',
  todo: 'M4.5 6.5l1.5 1.5 2.5-2.5M12 7h8M4.5 12.5l1.5 1.5 2.5-2.5M12 13h8M4.5 18.5l1.5 1.5 2.5-2.5M12 19h8',
  grid: 'M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01',
  chevron: 'M6 9l6 6 6-6',
  chevronUp: 'M7 14l5-5 5 5',
  pointer: 'M6 3.5l12.5 7.5-5.5 1.6-2.6 5.4z',
  map: 'M3 6.5l6-2 6 2 6-2v13l-6 2-6-2-6 2zM9 4.5v13M15 6.5v13',
  open: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  textsize: 'M3.5 18L8 6l4.5 12M5 14h6M14.5 18l3-8 3 8M15.6 15.5h3.8',
  realsize: 'M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6',
  align: 'M4 4v16M8 7h12M8 12h7M8 17h10',
  distribute: 'M4 4v16M20 4v16M9.5 7h5v10h-5z',
  samesize: 'M4 6h7v6H4zM13 6h7v6h-7zM4 16h16',
  curve: 'M4 18C11 18 13 6 20 6',
  ends: 'M5 12h14M15 8l4 4-4 4M9 8l-4 4 4 4',
  keys: 'M3 7h18v10H3zM7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8',
  name: 'M4 7V5h16v2M12 5v14M9 19h6',
  shapes: 'M4 4h7v7H4zM17.5 4a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M7.5 13.5l3.5 6.5H4zM17.5 13l3.5 3.5-3.5 3.5-3.5-3.5z',
  plus: 'M12 5v14M5 12h14'
}
/**
 * The box of an icon, moved onto its drawing so that the icon is in the middle of its button (the hand and the
 * magnifier are drawn off the middle of their grid). Measured once per icon in a hidden svg.
 */
/**
 * The icons of the dock, drawn as the icons of Syntex are: on the grid of 16, with round ends and corners (shown at
 * 22 px with lines of 1.75 px, a little bigger and bolder than the rail, since they are the main tools of the board).
 */
const PAGE16 = 'M9.5 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h7a1.5 1.5 0 0 0 1.5-1.5V4.5zM9.5 1.5v2a1 1 0 0 0 1 1h2'
const DOCK_ICONS = {
  // the arrow of the mouse
  pointer: 'M3.5 2.2 12.6 7.1a.35.35 0 0 1-.06.64L8.9 8.9 7.3 12.6a.35.35 0 0 1-.65-.03z',
  // an open hand: four fingers (the middle one the tallest), the thumb aside, the lines between the fingers
  hand: 'M5 9V3.6a1 1 0 0 1 2 0V2.6a1 1 0 0 1 2 0v1a1 1 0 0 1 2 0v1.5a1 1 0 0 1 2 0V10a4.5 4.5 0 0 1-4.5 4.5H8.2a4 4 0 0 1-3.45-1.97L2.8 9.2a1.1 1.1 0 0 1 1.9-1.1zM7 3.6v4.4M9 3.6v4.4M11 5.1v2.9',
  card: PAGE16,
  sticky: 'M3.5 2.5h9a1 1 0 0 1 1 1V9.5l-4 4h-6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM13.5 9.5h-3a1 1 0 0 0-1 1v3',
  todo: 'M2 4.6l1.3 1.3L5.7 3.5M8 4.6h6M2 10.6l1.3 1.3 2.4-2.4M8 10.6h6',
  note: PAGE16 + 'M5.5 8h5M5.5 10.5h5M5.5 5.5h1.5',
  media: 'M3.5 2.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM2.5 11l3-3 2.6 2.6 1.9-1.9 3.5 3.5M10.5 4.6a.9.9 0 1 0 0 1.8.9.9 0 1 0 0-1.8',
  frame: 'M3.5 5.5h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zM2.5 2.5h5',
  arrow: 'M2.5 8h11M9.5 4l4 4-4 4',
  chevronUp: 'M4.5 10 8 6.5l3.5 3.5'
}
const boxes = new Map()
const boxOf = (name, set = ICONS, size = 24) => {
  const key = size + ':' + name
  if (boxes.has(key)) return boxes.get(key)
  let vb = `0 0 ${size} ${size}`
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('style', `position:fixed;left:-99px;top:0;width:${size}px;height:${size}px;visibility:hidden`)
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', set[name])
    svg.append(p)
    document.body.append(svg)
    const b = p.getBBox()
    svg.remove()
    const r = (v) => Math.round(v * 8) / 8
    if (b.width || b.height) vb = `${r(b.x + b.width / 2 - size / 2)} ${r(b.y + b.height / 2 - size / 2)} ${size} ${size}`
  } catch {
    /* the plain box */
  }
  boxes.set(key, vb)
  return vb
}
/** An icon drawn like the icons of Syntex (lines of the same width, in the colour of the text). */
const icon = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', boxOf(name))
  svg.setAttribute('class', 'bd-ico' + (name === 'more' || name === 'grid' ? ' bd-ico-dots' : ''))
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', ICONS[name])
  svg.append(p)
  return svg
}
/** An icon of the dock (the grid of 16, in the middle of its button). */
const dockIcon = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', boxOf(name, DOCK_ICONS, 16))
  svg.setAttribute('class', 'bd-dico')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', DOCK_ICONS[name])
  svg.append(p)
  return svg
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const nameOf = (path) => path.split('/').pop().replace(/\.(md|board)$/i, '')
const urlOf = (path) => 'syntex://vault/' + path.split('/').map(encodeURIComponent).join('/')
const normUrl = (u) => (/^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u)
const hostOf = (u) => {
  try {
    return new URL(normUrl(u)).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}
const IS_URL = /^(https?:\/\/|www\.)\S+$/i

const newBoard = () => ({ v: 2, cards: [], links: [], view: { x: 0, y: 0, k: 1 }, settings: { grid: 'dots', guides: true } })

const sizeOf = (c) => ({ w: c.w ?? DEF[c.type][0], h: c.h ?? DEF[c.type][1] })
const rectOf = (c) => ({ x: c.x, y: c.y, ...sizeOf(c) })
const boundsOf = (cards) => {
  const x0 = Math.min(...cards.map((c) => c.x))
  const y0 = Math.min(...cards.map((c) => c.y))
  const x1 = Math.max(...cards.map((c) => c.x + sizeOf(c).w))
  const y1 = Math.max(...cards.map((c) => c.y + sizeOf(c).h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** The sides of two cards that face each other (along the axis on which they are further apart). */
const autoSides = (a, b) => {
  const ra = rectOf(a)
  const rb = rectOf(b)
  const dx = rb.x + rb.w / 2 - (ra.x + ra.w / 2)
  const dy = rb.y + rb.h / 2 - (ra.y + ra.h / 2)
  // (the gap between the boxes, not between their middles: a wide card above a narrow one is joined top to bottom)
  const gx = Math.abs(dx) - (ra.w + rb.w) / 2
  const gy = Math.abs(dy) - (ra.h + rb.h) / 2
  if (gx > gy) return dx >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' }
  return dy >= 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' }
}
/** The side of a card nearest to a point. */
const sideNear = (c, p) => {
  const r = rectOf(c)
  const d = { top: Math.abs(p.y - r.y), bottom: Math.abs(p.y - r.y - r.h), left: Math.abs(p.x - r.x), right: Math.abs(p.x - r.x - r.w) }
  return SIDES.reduce((best, s) => (d[s] < d[best] ? s : best), 'top')
}
/** The side of a card that faces a point outside it (by the direction from its middle, its shape taken in). */
const sideToward = (c, p) => {
  const r = rectOf(c)
  const dx = (p.x - r.x - r.w / 2) / (r.w / 2 || 1)
  const dy = (p.y - r.y - r.h / 2) / (r.h / 2 || 1)
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}
/** The point where an arrow is fastened to the side of a card (on the outline of a shape), and the way out of it. */
const anchorOf = (c, side) => {
  const r = rectOf(c)
  const inset = c.type === 'shape' ? sideInset(c.shape ?? 'rect', side, r.w, r.h) : 0
  const [nx, ny] = NORMAL[side]
  const x = side === 'left' ? r.x + inset : side === 'right' ? r.x + r.w - inset : r.x + r.w / 2
  const y = side === 'top' ? r.y + inset : side === 'bottom' ? r.y + r.h - inset : r.y + r.h / 2
  return { x, y, nx, ny }
}

/** The text of a board's file: its data, as JSON (where it is looked at is kept by the add-on, not in the file). */
function serialize(name, board) {
  void name
  const { view, ...content } = board
  void view
  return JSON.stringify({ ...content, v: 3 }, null, 1) + '\n'
}


/** A board read from its data (boards of version 1 are brought up to date), or null when it is damaged. */
function normalize(b) {
  if (!b || !Array.isArray(b.cards) || !Array.isArray(b.links)) return null
  const types = Object.keys(DEF)
  const cards = []
  for (const c of b.cards) {
    if (!c || typeof c.id !== 'string' || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue
    const type = types.includes(c.type) ? c.type : c.note ? 'note' : 'text'
    cards.push({ ...c, type })
  }
  const ids = new Map(cards.map((c) => [c.id, c]))
  const links = b.links
    .filter((l) => l && typeof l.id === 'string' && ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
    .map((l) => {
      const out = { ...l }
      // arrows of older versions went from the middle to the middle: they are bound to the sides facing each other once
      if (!SIDES.includes(out.fromSide) || !SIDES.includes(out.toSide)) {
        const s = autoSides(ids.get(l.from), ids.get(l.to))
        if (!SIDES.includes(out.fromSide)) out.fromSide = s.from
        if (!SIDES.includes(out.toSide)) out.toSide = s.to
      }
      if (Array.isArray(out.pts)) {
        out.pts = out.pts.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => ({ x: p.x, y: p.y }))
        if (!out.pts.length) delete out.pts
      } else delete out.pts
      // (where the label was dragged to: a share of the length and a shift)
      if (!Number.isFinite(out.lt)) delete out.lt
      if (!out.lo || !Number.isFinite(out.lo.x) || !Number.isFinite(out.lo.y)) delete out.lo
      return out
    })
  const view = b.view && Number.isFinite(b.view.k) && Number.isFinite(b.view.x) && Number.isFinite(b.view.y) ? b.view : { x: 0, y: 0, k: 1 }
  return { v: 3, cards, links, view, settings: { ...newBoard().settings, ...(b.settings ?? {}) } }
}

/** A board from the text of its file (JSON), or from a note of an older version (a block of data in it); null when damaged. */
function parse(text) {
  try {
    if (text.trimStart().startsWith('{')) return normalize(JSON.parse(text))
  } catch {
    return null
  }
  const m = new RegExp('```' + FENCE + '\\r?\\n([\\s\\S]*?)\\r?\\n```').exec(text)
  if (!m) return null
  try {
    return normalize(JSON.parse(m[1]))
  } catch {
    return null
  }
}

export default {
  onload(api) {
    const tt = (ru, en) => (api.language() === 'ru' ? ru : en)
    // (API 7 has these; an older Syntex is reached through its own bridge)
    const sx = window.syntex
    const files = {
      openFile: (p) => (api.vault.openFile ? api.vault.openFile(p) : sx.fs.open(p)),
      reveal: (p) => (api.vault.reveal ? api.vault.reveal(p) : sx.fs.reveal(p)),
      rename: (p, n) => (api.vault.rename ? api.vault.rename(p, n) : sx.fs.rename(p, n)),
      duplicate: (p) => (api.vault.duplicate ? api.vault.duplicate(p) : sx.fs.duplicate(p)),
      trash: (p) => (api.vault.trash ? api.vault.trash(p) : sx.fs.trash(p)),
      folder: (p) => (api.vault.createFolder ? api.vault.createFolder(p) : sx.fs.createFolder('', p))
    }
    const clip = {
      copy: (t) => (api.ui.copy ? api.ui.copy(t) : (sx.app.writeClipboard ?? ((x) => navigator.clipboard.writeText(x)))(t)),
      read: () => (api.ui.readClipboard ? api.ui.readClipboard() : sx.app.readClipboard())
    }
    const copyText = (t) =>
      clip.copy(t).then(
        () => api.ui.notice(tt('Скопировано', 'Copied'), 1500),
        () => api.ui.notice(tt('Не удалось скопировать', 'Could not copy'))
      )
    const data = () => api.data.get({ last: '' })
    const boardPaths = () => api.vault.listFiles(EXT).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    // a board just made goes to the bottom of its folder in the tree, where it is seen at once (API 13; an older
    // Syntex keeps it in the order by name)
    const toBottom = (p) => {
      try {
        api.vault.placeLast?.(p)
      } catch {
        /* the tree keeps its order */
      }
    }

    // notes sent to the board while its tab is not open: added once it is
    let controller = null
    let pendingNotes = []
    // a board file clicked while the tab is not open: shown once it is
    let pendingOpen = null
    const openBoards = () => api.views.open('main')
    const openBoardFile = (p) => {
      if (controller) {
        openBoards()
        void controller.open(p)
      } else {
        pendingOpen = p
        openBoards()
      }
    }

    // a click on a .board file (in the tree, a link, the search) opens it here
    api.files.handle(EXT, openBoardFile)

    /**
     * Boards of versions before 1.3 were notes (Boards/Name.md with a block of data): each is moved to Boards/Name.board
     * once; the note goes to the recycle bin (it can be taken back from there).
     */
    const moveOldBoards = async () => {
      const old = api.vault.list().filter((p) => p.startsWith(FOLDER + '/') && p.split('/').length === 2)
      let moved = 0
      for (const p of old) {
        let text
        try {
          text = await api.vault.read(p)
        } catch {
          continue
        }
        if (!text.includes('```' + FENCE)) continue
        const board = parse(text)
        if (!board) continue
        const taken = new Set(api.vault.listFiles(EXT).map((x) => x.toLowerCase()))
        const base = p.replace(/\.md$/i, '')
        let next = base + '.' + EXT
        for (let i = 2; taken.has(next.toLowerCase()); i++) next = `${base} ${i}.${EXT}`
        await api.vault.write(next, serialize(nameOf(next), board), true)
        await files.trash(p)
        const d = data()
        const views = { ...(d.views ?? {}) }
        if (views[p]) views[next] = views[p]
        delete views[p]
        api.data.set({ ...d, views, last: d.last === p ? next : d.last })
        moved++
      }
      if (moved) api.ui.notice(tt(`Доски теперь отдельные файлы .board: перенесено ${moved}. Старые заметки — в корзине.`, `Boards are files of their own now (.board): ${moved} moved. The old notes are in the recycle bin.`), 7000)
      return moved
    }
    const moving = moveOldBoards().catch((e) => api.ui.notice(e instanceof Error ? e.message : String(e), 6000))

    /* ====================================================================== the tab */

    const mountBoards = (root) => {
      root.classList.add('bd-root')
      let path = ''
      let board = null
      let broken = false
      let dirty = false
      let saveTimer = null
      let lastWritten = ''
      // the texts this tab wrote lately: the watcher may tell of one of them after a newer one was written
      const written = []
      let sel = new Set()
      let selLink = null
      // the bend point chosen by a click ({ link, i }): Delete takes it away
      let selBend = null
      let editing = null
      let tool = 'select'
      let spaceDown = false
      let arrowMode = null
      let mouse = { x: 0, y: 0 }
      let pasteShift = 0
      let hits = []
      let hitIds = new Set()
      let hitAt = 0
      let hist = { stack: [], i: -1 }
      let miniFrame = 0
      // the minimap dragged now (see its pointerdown)
      let miniHeld = false
      const cardEls = new Map()
      // cards just made and being written for the first time: left empty, they are taken back
      const fresh = new Set()
      const notes = new Map() // vault path -> { title, excerpt }

      /* ---------- the frame of the tab ---------- */
      // (the list of boards is a menu of the arrow by the title; the select stays, unseen, as the list of record)
      const select = el('select', { className: 'bd-select', hidden: true })
      const selectWrap = el('button', { className: 'bd-boards', title: tt('Доски', 'Boards') }, [icon('chevron')])
      selectWrap.onclick = (e) => menuAtButton(e, boardsList())
      const btn = (label, onclick, title = '', cls = '') =>
        el('button', { className: 'btn bd-btn ' + cls, onclick, title }, ICONS[label] ? [icon(label)] : [document.createTextNode(label)])
      const toolbar = el('div', { className: 'bd-toolbar' })
      const canvas = el('div', { className: 'bd-canvas', tabIndex: 0 })
      const world = el('div', { className: 'bd-world' })
      const frameLayer = el('div', { className: 'bd-layer' })
      const cardLayer = el('div', { className: 'bd-layer' })
      const links = svgEl('svg', { class: 'bd-links', width: 1, height: 1 })
      const defs = svgEl('defs')
      const marker = svgEl('marker', { id: 'bd-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' })
      marker.append(svgEl('path', { d: 'M0 0L10 5L0 10z', class: 'bd-arrow-head' }))
      defs.append(marker)
      const linkLayer = svgEl('g')
      const temp = svgEl('line', { class: 'bd-temp', visibility: 'hidden' })
      links.append(defs, linkLayer, temp)
      // (the handles of the chosen arrow are over the cards: its ends lie on their edges)
      const handleLayer = svgEl('svg', { class: 'bd-links bd-handles', width: 1, height: 1 })
      const guides = svgEl('svg', { class: 'bd-links bd-guides', width: 1, height: 1 })
      world.append(frameLayer, links, cardLayer, handleLayer, guides)
      const band = el('div', { className: 'bd-band', hidden: true })
      const hint = el('div', { className: 'bd-hint' })
      /**
       * The hint of an empty board: shown until the first block is put on that board, then never again on it (a board
       * emptied later shows a clean field).
       */
      const syncHint = () => {
        if (!board) return
        if (broken) {
          hint.hidden = false
          return
        }
        const seen = data().hintsDone ?? []
        // (a block still being typed for the first time does not count: Esc may take it back)
        if (board.cards.some((c) => !fresh.has(c.id)) && path && !seen.includes(path)) api.data.set({ ...data(), hintsDone: [...seen, path].slice(-400) })
        hint.hidden = board.cards.length > 0 || (!!path && seen.includes(path))
      }
      const forgetHint = (p) => {
        const seen = data().hintsDone ?? []
        if (seen.includes(p)) api.data.set({ ...data(), hintsDone: seen.filter((x) => x !== p) })
      }
      /** The boards whose hint is gone, with a board that came under a new name. */
      const movedHints = (d, was, next) => (d.hintsDone ?? []).map((x) => (x === was ? next : x))
      const floatBar = el('div', { className: 'bd-float', hidden: true })
      // bottom left: the history and the zoom
      const zoomLabel = el('button', { className: 'bd-zoom-label', title: tt('Масштаб', 'Zoom') })
      zoomLabel.onclick = (e) => board && menuAtButton(e, zoomMenu(), true)
      const undoBtn = el('button', { className: 'bd-undo', title: tt('Отменить (Ctrl+Z)', 'Undo (Ctrl+Z)'), onclick: () => undo() }, [icon('undo')])
      const redoBtn = el('button', { className: 'bd-redo', title: tt('Повторить (Ctrl+Y)', 'Redo (Ctrl+Y)'), onclick: () => redo() }, [icon('redo')])
      // the snapping to the dots of the grid: on by default, so that boards come out even (Alt while dragging frees a
      // block for a moment); turned off and on here and in "View"
      const snapOn = () => data().snap !== false
      const snapBtn = el('button', { className: 'bd-snap' }, [icon('grid')])
      const syncSnap = () => {
        snapBtn.classList.toggle('on', snapOn())
        snapBtn.title = snapOn() ? tt('Привязка к сетке включена — щёлкните, чтобы выключить (Alt при перетаскивании — без привязки)', 'Snapping to the grid is on: click to turn it off (Alt while dragging: no snapping)') : tt('Привязка к сетке выключена — щёлкните, чтобы включить', 'Snapping to the grid is off: click to turn it on')
      }
      const setSnap = (on) => {
        api.data.set({ ...data(), snap: on })
        syncSnap()
      }
      snapBtn.onclick = () => setSnap(!snapOn())
      syncSnap()
      const zoomBox = el('div', { className: 'bd-zoombox' }, [
        undoBtn,
        redoBtn,
        el('span', { className: 'bd-zoom-sep' }),
        snapBtn,
        el('span', { className: 'bd-zoom-sep' }),
        el('button', { textContent: '−', title: tt('Уменьшить (Ctrl+−)', 'Zoom out (Ctrl+−)'), onclick: () => zoomBy(1 / 1.25) }),
        zoomLabel,
        el('button', { textContent: '+', title: tt('Увеличить (Ctrl+=)', 'Zoom in (Ctrl+=)'), onclick: () => zoomBy(1.25) })
      ])
      // bottom right: the minimap, folded into a button when asked (remembered), unseen when everything is in view
      const mini = el('canvas', { className: 'bd-mini', width: 180, height: 120 })
      const miniFold = el('button', { className: 'bd-mini-fold', title: tt('Свернуть мини-карту', 'Fold the minimap') }, [icon('chevron')])
      const miniOpen = el('button', { className: 'bd-mini-open', title: tt('Мини-карта', 'Minimap') }, [icon('map')])
      const miniBox = el('div', { className: 'bd-minibox' }, [mini, miniFold, miniOpen])
      const setMiniFolded = (on) => {
        miniBox.classList.toggle('folded', on)
        api.data.set({ ...data(), miniFolded: on })
        drawMini()
      }
      miniFold.onclick = () => setMiniFolded(true)
      miniOpen.onclick = () => setMiniFolded(false)
      miniBox.classList.toggle('folded', !!data().miniFolded)
      const searchBox = el('div', { className: 'bd-search', hidden: true })
      const searchInput = el('input', { placeholder: tt('Найти на доске…', 'Find on the board…'), spellcheck: false })
      const searchCount = el('span', { className: 'bd-search-count' })
      searchBox.append(searchInput, searchCount, el('button', { textContent: '×', onclick: () => closeSearch() }))
      const dock = el('div', { className: 'bd-dock' })
      const ghost = el('div', { className: 'bd-ghost', hidden: true })
      canvas.append(world, band, hint, floatBar, zoomBox, miniBox, searchBox, dock, ghost)
      root.append(toolbar, canvas)
      canvas.dataset.dropFiles = ''

      /* ---------- saving and history ---------- */
      const write = async () => {
        clearTimeout(saveTimer)
        saveTimer = null
        if (!dirty || !board || broken) return
        if (!path) {
          // a board shown before it had a file: written the moment something is put on it
          // (nor while the only blocks on it are new ones still being typed: Esc on an empty one takes it back,
          // and no empty file is left behind; the end of the typing saves again)
          if (!board.cards.some((c) => !fresh.has(c.id))) return
          const shown = board
          await materialize()
          if (!path || board !== shown) return
        }
        // (the board made on entering, with nothing on it but a block still being typed: its file stays empty)
        if (untouched && untouched === path && !board.cards.some((c) => !fresh.has(c.id))) {
          dirty = false
          return
        }
        dirty = false
        const text = serialize(nameOf(path), board)
        lastWritten = text
        written.push(text)
        if (written.length > 12) written.shift()
        try {
          await api.vault.write(path, text, true)
          flashSaved()
        } catch (e) {
          dirty = true
          api.ui.notice(e instanceof Error ? e.message : String(e), 6000)
        }
      }
      let viewTimer = null
      /** Where the board is looked at: kept with the add-on's data, by board (never written into the note). */
      const saveView = () => {
        clearTimeout(viewTimer)
        const at = path
        const v = board && { ...board.view }
        viewTimer = setTimeout(() => {
          if (!at || !v) return
          const d = data()
          api.data.set({ ...d, views: { ...(d.views ?? {}), [at]: v } })
        }, 500)
      }
      const changed = () => {
        // (something was done on the board made on entering: it stays)
        if (untouched && untouched === path && board?.cards.some((c) => !fresh.has(c.id))) untouched = null
        dirty = true
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => void write(), 500)
      }
      const snapshot = () => JSON.stringify({ cards: board.cards, links: board.links })
      /** A change of cards or arrows was made: it is kept for undo and saved. */
      let batching = false
      /** Several changes that are one step for the user (a card and the arrow to it): one step of undo. */
      const batch = (fn) => {
        batching = true
        try {
          return fn()
        } finally {
          batching = false
          commit()
        }
      }
      const commit = () => {
        if (batching) return
        const s = snapshot()
        if (s !== hist.stack[hist.i]) {
          hist.stack.length = hist.i + 1
          hist.stack.push(s)
          if (hist.stack.length > 120) hist.stack.shift()
          hist.i = hist.stack.length - 1
        }
        changed()
        drawMini()
        syncToolbar()
      }
      const restore = (i) => {
        if (i < 0 || i >= hist.stack.length) return
        hist.i = i
        const s = JSON.parse(hist.stack[i])
        board.cards = s.cards
        board.links = s.links
        sel = new Set([...sel].filter((id) => board.cards.some((c) => c.id === id)))
        if (selLink && !board.links.some((l) => l.id === selLink)) selLink = null
        rebuild()
        changed()
        syncToolbar()
      }
      const undo = () => restore(hist.i - 1)
      const redo = () => restore(hist.i + 1)

      /* ---------- the view ---------- */
      const applyView = () => {
        const { x, y, k } = board.view
        world.style.transform = `translate(${x}px, ${y}px) scale(${k})`
        // (the handles of the cards and the line of an arrow keep their size on the screen at any zoom: see --ik)
        world.style.setProperty('--ik', String(1 / k))
        canvas.dataset.grid = board.settings.grid
        // the grid follows the zoom: when the cells get too small on the screen, every next
        // step takes twice as many of them, so far away there is no dense mesh
        let step = GRID * k
        while (step < 14) step *= 2
        canvas.style.backgroundSize = `${step}px ${step}px`
        // (a dot is drawn in the middle of its cell: the cells are moved by half a cell so that the dots are where
        // the corners of cards snap to, on whole steps of the grid)
        const half = board.settings.grid === 'dots' ? step / 2 : 0
        canvas.style.backgroundPosition = `${x - half}px ${y - half}px`
        zoomLabel.textContent = Math.round(k * 100) + '%'
        miniBox.hidden = board.settings.minimap === false
        if (selLink) drawLinks()
        placeFloat()
        drawMini()
      }
      const toWorld = (cx, cy) => {
        const r = canvas.getBoundingClientRect()
        return { x: (cx - r.left - board.view.x) / board.view.k, y: (cy - r.top - board.view.y) / board.view.k }
      }
      const toScreen = (wx, wy) => {
        const r = canvas.getBoundingClientRect()
        return { x: r.left + board.view.x + wx * board.view.k, y: r.top + board.view.y + wy * board.view.k }
      }
      const viewCenter = () => {
        const r = canvas.getBoundingClientRect()
        return toWorld(r.left + r.width / 2, r.top + r.height / 2)
      }
      const zoomAt = (px, py, k) => {
        const v = board.view
        const k1 = clamp(k, 0.1, 4)
        v.x = px - ((px - v.x) * k1) / v.k
        v.y = py - ((py - v.y) * k1) / v.k
        v.k = k1
        applyView()
        saveView()
      }
      const zoomBy = (f) => {
        const r = canvas.getBoundingClientRect()
        zoomAt(r.width / 2, r.height / 2, board.view.k * f)
      }
      const fitRect = (b, maxK = 1.5) => {
        const r = canvas.getBoundingClientRect()
        const k = clamp(Math.min((r.width - 120) / Math.max(1, b.w), (r.height - 120) / Math.max(1, b.h)), 0.1, maxK)
        board.view = { k, x: (r.width - b.w * k) / 2 - b.x * k, y: (r.height - b.h * k) / 2 - b.y * k }
        applyView()
        saveView()
      }
      const fit = () => (board.cards.length ? fitRect(boundsOf(board.cards)) : ((board.view = { x: 0, y: 0, k: 1 }), applyView(), saveView()))
      const fitSelection = () => (sel.size ? fitRect(boundsOf(board.cards.filter((c) => sel.has(c.id))), 2) : fit())
      const centerOn = (c) => {
        const r = canvas.getBoundingClientRect()
        const s = sizeOf(c)
        board.view.x = r.width / 2 - (c.x + s.w / 2) * board.view.k
        board.view.y = r.height / 2 - (c.y + s.h / 2) * board.view.k
        applyView()
        saveView()
      }

      /* ---------- arrows ---------- */
      const centerOf = (c) => {
        const s = sizeOf(c)
        return { x: c.x + s.w / 2, y: c.y + s.h / 2 }
      }
      /** The two ends of an arrow: on the sides of the cards it was fastened to. */
      const endsOf = (l) => {
        const a = byId(l.from)
        const b = byId(l.to)
        if (!a || !b) return null
        const auto = !SIDES.includes(l.fromSide) || !SIDES.includes(l.toSide) ? autoSides(a, b) : null
        return { A: anchorOf(a, SIDES.includes(l.fromSide) ? l.fromSide : auto.from), B: anchorOf(b, SIDES.includes(l.toSide) ? l.toSide : auto.to) }
      }
      const dedupe = (pts) => {
        const out = []
        for (const p of pts) {
          const q = out[out.length - 1]
          if (q && Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5) continue
          // (three points on one straight line: the middle one is no corner)
          const o = out[out.length - 2]
          if (o && q && ((Math.abs(o.x - q.x) < 0.5 && Math.abs(q.x - p.x) < 0.5) || (Math.abs(o.y - q.y) < 0.5 && Math.abs(q.y - p.y) < 0.5))) out.pop()
          out.push(p)
        }
        return out
      }
      /** The corners of a line at right angles from A through the bend points to B (out of each side straight first). */
      const elbowPoints = (A, B, pts) => {
        const S = 22
        const A1 = { x: A.x + A.nx * S, y: A.y + A.ny * S }
        const B1 = { x: B.x + B.nx * S, y: B.y + B.ny * S }
        const out = [A, A1]
        const stops = [...pts, B1]
        let horizontal = A.nx !== 0
        let p = A1
        stops.forEach((q, i) => {
          const last = i === stops.length - 1
          if (last && !pts.length && horizontal === (B.nx !== 0)) {
            // side to side of the same kind: a step in the middle
            if (horizontal) {
              const mx = (p.x + q.x) / 2
              out.push({ x: mx, y: p.y }, { x: mx, y: q.y })
            } else {
              const my = (p.y + q.y) / 2
              out.push({ x: p.x, y: my }, { x: q.x, y: my })
            }
          } else if (last && horizontal === (B.nx !== 0)) {
            // (the way into the stub before B goes across B's own direction)
            out.push(horizontal ? { x: p.x, y: q.y } : { x: q.x, y: p.y })
          } else {
            out.push(horizontal ? { x: q.x, y: p.y } : { x: p.x, y: q.y })
            horizontal = !horizontal
          }
          out.push(q)
          p = q
        })
        out.push(B)
        return dedupe(out)
      }
      const bez = (p0, c1, c2, p1, t) => {
        const u = 1 - t
        return {
          x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
          y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y
        }
      }
      /**
       * The way of an arrow: its `d`, points along it (for its label and for finding where a bend point goes) and the
       * points it is steered by (its ends and its bend points).
       */
      const routeOf = (l) => {
        const ends = endsOf(l)
        if (!ends) return null
        const { A, B } = ends
        const pts = l.pts ?? []
        const ctrl = [A, ...pts, B]
        let line
        let d
        if (l.curve) {
          // a smooth line through the bend points, out of each side straight away from the card
          const segs = []
          for (let i = 0; i < ctrl.length - 1; i++) {
            const p0 = ctrl[i]
            const p1 = ctrl[i + 1]
            const len = Math.hypot(p1.x - p0.x, p1.y - p0.y)
            const reach = clamp(len * 0.45, 24, 180)
            const t0 = i === 0 ? { x: A.nx * reach, y: A.ny * reach } : { x: (p1.x - ctrl[i - 1].x) / 6, y: (p1.y - ctrl[i - 1].y) / 6 }
            const t1 = i === ctrl.length - 2 ? { x: -B.nx * reach, y: -B.ny * reach } : { x: (ctrl[i + 2].x - p0.x) / 6, y: (ctrl[i + 2].y - p0.y) / 6 }
            segs.push([p0, { x: p0.x + t0.x, y: p0.y + t0.y }, { x: p1.x - t1.x, y: p1.y - t1.y }, p1])
          }
          d = `M${A.x} ${A.y}` + segs.map(([, c1, c2, p1]) => `C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p1.x} ${p1.y}`).join('')
          line = [A]
          for (const s of segs) for (let k = 1; k <= 16; k++) line.push(bez(s[0], s[1], s[2], s[3], k / 16))
        } else {
          line = l.elbow ? elbowPoints(A, B, pts) : ctrl
          // (the corners are rounded a little, unless "Rounded corners" is turned off for this arrow)
          d = l.sharp ? 'M' + line.map((p) => `${p.x} ${p.y}`).join('L') : roundedD(line)
        }
        // where its label is: a share of its length (the middle by default) and a shift from the line
        const at = along(line, Number.isFinite(l.lt) ? l.lt : 0.5)
        const mid = { x: at.x + (l.lo?.x ?? 0), y: at.y + (l.lo?.y ?? 0) }
        return { d, line, ctrl, mid, A, B }
      }
      /** A line through these points with its corners rounded (by up to 10, less where the pieces are short). */
      const roundedD = (pts, r0 = 10) => {
        let d = `M${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length - 1; i++) {
          const p = pts[i - 1]
          const c = pts[i]
          const n = pts[i + 1]
          const l1 = Math.hypot(c.x - p.x, c.y - p.y)
          const l2 = Math.hypot(n.x - c.x, n.y - c.y)
          const r = Math.min(r0, l1 / 2, l2 / 2)
          if (r < 0.5) {
            d += `L${c.x} ${c.y}`
            continue
          }
          const a = { x: c.x + ((p.x - c.x) * r) / l1, y: c.y + ((p.y - c.y) * r) / l1 }
          const b = { x: c.x + ((n.x - c.x) * r) / l2, y: c.y + ((n.y - c.y) * r) / l2 }
          d += `L${a.x} ${a.y}Q${c.x} ${c.y} ${b.x} ${b.y}`
        }
        const z = pts[pts.length - 1]
        return d + `L${z.x} ${z.y}`
      }
      /** The point at this share (0..1) of the length of a line of points. */
      const along = (line, t) => {
        let total = 0
        for (let i = 1; i < line.length; i++) total += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y)
        const want = total * clamp(t, 0, 1)
        let walked = 0
        for (let i = 1; i < line.length; i++) {
          const seg = Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y)
          if (walked + seg >= want) {
            const f = seg ? (want - walked) / seg : 0
            return { x: line[i - 1].x + (line[i].x - line[i - 1].x) * f, y: line[i - 1].y + (line[i].y - line[i - 1].y) * f }
          }
          walked += seg
        }
        return line[line.length - 1]
      }
      /** The share of the length of a line of points where it comes nearest to `p`, and that point. */
      const nearestOn = (line, p) => {
        let total = 0
        let best = { t: 0.5, x: line[0].x, y: line[0].y, d: Infinity }
        const lens = []
        for (let i = 1; i < line.length; i++) lens.push(Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y))
        const all = lens.reduce((a, b) => a + b, 0) || 1
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1]
          const b = line[i]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len2 = dx * dx + dy * dy
          const f = len2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1) : 0
          const q = { x: a.x + dx * f, y: a.y + dy * f }
          const dd = Math.hypot(p.x - q.x, p.y - q.y)
          if (dd < best.d) best = { t: (total + lens[i - 1] * f) / all, x: q.x, y: q.y, d: dd }
          total += lens[i - 1]
        }
        return best
      }
      const distToSeg = (p, a, b) => {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = dx * dx + dy * dy
        const t = len ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0, 1) : 0
        return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t)
      }
      /** Where among the bend points of an arrow a new one at `p` goes (between the two it is nearest to the line of). */
      const bendIndex = (l, p) => {
        const r = routeOf(l)
        if (!r) return 0
        let best = 0
        let bd = Infinity
        for (let i = 0; i < r.ctrl.length - 1; i++) {
          const dd = distToSeg(p, r.ctrl[i], r.ctrl[i + 1])
          if (dd < bd) {
            bd = dd
            best = i
          }
        }
        return best
      }
      const snapPt = (p, on) => (on ? { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID } : { x: Math.round(p.x), y: Math.round(p.y) })
      const linkMid = new Map()
      const drawLinks = () => {
        linkLayer.replaceChildren()
        handleLayer.replaceChildren()
        linkMid.clear()
        for (const l of board.links) {
          const r = routeOf(l)
          if (!r) continue
          const { d } = r
          linkMid.set(l.id, r.mid)
          const g = svgEl('g', { class: 'bd-link' + (selLink === l.id ? ' on' : ''), 'data-id': l.id })
          const head = l.head ?? 'end'
          const line = svgEl('path', {
            d,
            class: 'bd-line',
            'marker-end': head === 'end' || head === 'both' ? 'url(#bd-arrow)' : null,
            'marker-start': head === 'both' ? 'url(#bd-arrow)' : null
          })
          if (l.color) line.style.stroke = l.color
          if (l.style === 'dashed') line.style.strokeDasharray = '9 6'
          if (l.style === 'dotted') line.style.strokeDasharray = '2 6'
          g.append(line, svgEl('path', { d, class: 'bd-hit' }))
          if (l.label) {
            const text = svgEl('text', { x: r.mid.x, y: r.mid.y, class: 'bd-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' })
            text.textContent = l.label
            g.append(text)
          }
          linkLayer.append(g)
          if (selLink === l.id && !sel.size) {
            // the handles of the chosen arrow: its two ends (dragged to another side or card) and its bend points
            const k = board.view.k
            // (each handle is a small circle seen, in a bigger one not seen that takes the mouse: easy to catch)
            const handle = (cls, p, r0, attrs) => {
              const g = svgEl('g', { class: cls, 'data-link': l.id, ...attrs })
              g.append(svgEl('circle', { cx: p.x, cy: p.y, r: 13 / k, class: 'bd-catch' }), svgEl('circle', { cx: p.x, cy: p.y, r: r0 / k, class: 'bd-dot', 'stroke-width': 2 / k }))
              handleLayer.append(g)
            }
            for (const [end, p] of [['from', r.A], ['to', r.B]]) handle('bd-end', p, 5.5, { 'data-end': end })
            ;(l.pts ?? []).forEach((p, i) => handle('bd-wp' + (selBend && selBend.link === l.id && selBend.i === i ? ' on' : ''), p, 5.5, { 'data-i': i }))
          }
        }
      }
      const addLink = (from, to, fromSide, toSide) => {
        if (from === to || board.links.some((l) => l.from === from && l.to === to)) return null
        const auto = autoSides(byId(from), byId(to))
        const l = { id: uid(), from, to, fromSide: fromSide ?? auto.from, toSide: toSide ?? auto.to, head: 'end', style: 'solid' }
        board.links.push(l)
        drawLinks()
        commit()
        return l
      }

      /* ---------- cards ---------- */
      const loadNote = async (p) => {
        if (notes.has(p)) return
        notes.set(p, { title: nameOf(p), excerpt: '' })
        try {
          const text = await api.vault.read(p)
          const lines = text
            .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
            .split(/\r?\n/)
            .map((s) => s.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '').replace(/[*_`~]|!?\[\[|\]\]/g, '').trim())
            .filter(Boolean)
          // the first line is the title when it repeats the name of the note
          if (lines[0] && lines[0].toLowerCase() === nameOf(p).toLowerCase()) lines.shift()
          notes.set(p, { title: nameOf(p), excerpt: lines.slice(0, 5).join('\n').slice(0, 260) })
        } catch {
          notes.set(p, { title: nameOf(p), excerpt: '', gone: true })
        }
        for (const c of board?.cards ?? []) if (c.type === 'note' && c.note === p) renderCard(c)
      }

      /* ---------- the text of a card, shown formatted (its Markdown is seen only while it is edited) ---------- */
      const noteFor = (target) => {
        const t = target.trim().toLowerCase()
        const all = api.vault.list()
        return all.find((p) => p.toLowerCase() === t || p.toLowerCase() === t + '.md') ?? all.find((p) => nameOf(p).toLowerCase() === t.replace(/\.md$/, '')) ?? null
      }
      // (a link in a card works by a click and is no handle to drag the card by)
      const linkEl = (text, go, cls) => {
        const a = el('a', { className: cls, textContent: text, href: '#' })
        a.onpointerdown = (e) => e.stopPropagation()
        a.ondblclick = (e) => e.stopPropagation()
        a.onclick = (e) => {
          e.preventDefault()
          e.stopPropagation()
          go()
        }
        return a
      }
      const INLINE = /(\*\*|__)(.+?)\1|~~(.+?)~~|==(.+?)==|`([^`]+)`|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*(?!\s)(.+?)\*(?!\w)|(?<![\w_])_(?!\s)(.+?)_(?!\w)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/
      /** A line of Markdown as DOM: bold, italic, struck, marked, code, [[links]], [links](…) and bare addresses. */
      const mdInline = (text) => {
        const frag = document.createDocumentFragment()
        let rest = text
        for (let guard = 0; rest && guard < 200; guard++) {
          const m = INLINE.exec(rest)
          if (!m) break
          if (m.index) frag.append(rest.slice(0, m.index))
          if (m[2] !== undefined) frag.append(el('strong', {}, [mdInline(m[2])]))
          else if (m[3] !== undefined) frag.append(el('s', {}, [mdInline(m[3])]))
          else if (m[4] !== undefined) frag.append(el('mark', {}, [mdInline(m[4])]))
          else if (m[5] !== undefined) frag.append(el('code', { textContent: m[5] }))
          else if (m[6] !== undefined) {
            const target = m[6].split('#')[0]
            const found = noteFor(target)
            frag.append(linkEl(m[7] ?? m[6], () => (found ? api.vault.open(found) : api.ui.notice(tt(`Заметки «${target}» нет`, `No note "${target}"`))), 'bd-wikilink' + (found ? '' : ' gone')))
          } else if (m[8] !== undefined) frag.append(linkEl(m[8], () => window.open(normUrl(m[9])), 'bd-weblink'))
          else if (m[10] !== undefined) frag.append(el('em', {}, [mdInline(m[10])]))
          else if (m[11] !== undefined) frag.append(el('em', {}, [mdInline(m[11])]))
          else if (m[12] !== undefined) frag.append(linkEl(m[12], () => window.open(m[12]), 'bd-weblink'))
          rest = rest.slice(m.index + m[0].length)
        }
        if (rest) frag.append(rest)
        return frag
      }
      /** The text of a card as formatted lines: headings, lists, tasks, quotes. */
      const md = (text) => {
        const box = el('div', { className: 'bd-text bd-md' })
        for (const line of text.split('\n')) {
          let m
          if ((m = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line))) box.append(el('div', { className: 'bd-md-h bd-md-h' + Math.min(3, m[1].length) }, [mdInline(m[2])]))
          else if ((m = /^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line)))
            box.append(el('div', { className: 'bd-md-li bd-md-task' + (m[2] === ' ' ? '' : ' done') }, [el('span', { className: 'bd-md-box', textContent: m[2] === ' ' ? '☐' : '☑' }), el('span', {}, [mdInline(m[3])])]))
          else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(line))) box.append(el('div', { className: 'bd-md-li' }, [el('span', { className: 'bd-md-dot', textContent: '•' }), el('span', {}, [mdInline(m[2])])]))
          else if ((m = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line))) box.append(el('div', { className: 'bd-md-li' }, [el('span', { className: 'bd-md-dot', textContent: m[2] + '.' }), el('span', {}, [mdInline(m[3])])]))
          else if ((m = /^>\s?(.*)$/.exec(line))) box.append(el('div', { className: 'bd-md-quote' }, [mdInline(m[1])]))
          else if (!line.trim()) box.append(el('div', { className: 'bd-md-gap' }))
          else box.append(el('div', {}, [mdInline(line)]))
        }
        return box
      }

      const shapeSvg = (card) => {
        const s = sizeOf(card)
        const svg = svgEl('svg', { class: 'bd-shape-svg', viewBox: `0 0 ${s.w} ${s.h}`, preserveAspectRatio: 'none' })
        const p = shapePath(card.shape ?? 'rect', s.w, s.h)
        svg.append(svgEl('path', { d: p.d, class: 'bd-shape-fill', 'vector-effect': 'non-scaling-stroke' }))
        if (p.extra) svg.append(svgEl('path', { d: p.extra, class: 'bd-shape-line', 'vector-effect': 'non-scaling-stroke' }))
        return svg
      }
      /** The outline and the place of the text of a shape follow its size (while it is resized, say). */
      const redrawShape = (card) => {
        const node = cardEls.get(card.id)
        const old = node?.querySelector('.bd-shape-svg')
        if (!old) return
        old.replaceWith(shapeSvg(card))
        const s = sizeOf(card)
        const [t, r, b, l] = shapeInset(card.shape ?? 'rect', s.w, s.h)
        const text = node.querySelector('.bd-shape-text')
        if (text) text.style.padding = `${t}px ${r}px ${b}px ${l}px`
      }

      const renderCard = (card) => {
        const node = cardEls.get(card.id)
        if (!node) return
        const body = node.querySelector('.bd-body')
        body.replaceChildren()
        node.className = `bd-card t-${card.type}` + (sel.has(card.id) ? ' on' : '') + (card.locked ? ' locked' : '') + (card.color ? ' colored' : '') + (hitIds.has(card.id) ? ' hit' : '')
        if (card.color || card.type === 'sticky') node.style.setProperty('--c', card.color || STICKY)
        else node.style.removeProperty('--c')
        const fs = FONTS[clamp((card.fs ?? 1) | 0, 0, 3)]
        body.style.fontSize = fs + 'px'
        if (card.type === 'text' || card.type === 'sticky') {
          body.append(md(card.text ?? ''))
        } else if (card.type === 'shape') {
          const s = sizeOf(card)
          const [t, r, b, l] = shapeInset(card.shape ?? 'rect', s.w, s.h)
          const text = el('div', { className: 'bd-shape-text' }, [md(card.text ?? '')])
          text.style.padding = `${t}px ${r}px ${b}px ${l}px`
          body.append(shapeSvg(card), text)
        } else if (card.type === 'file') {
          const name = card.src.split('/').pop()
          const dot = name.lastIndexOf('.')
          const ok = api.vault.listFiles().includes(card.src)
          const ico = icon('card')
          ico.classList.add('bd-file-ico')
          body.append(
            el('div', { className: 'bd-file' }, [
              ico,
              el('div', { className: 'bd-file-text' }, [
                el('div', { className: 'bd-file-name' + (ok ? '' : ' gone'), textContent: dot > 0 ? name.slice(0, dot) : name, title: ok ? card.src : tt('Файла нет', 'No such file') }),
                el('div', { className: 'bd-file-path', textContent: card.src.includes('/') ? card.src.slice(0, card.src.lastIndexOf('/')) : tt('Хранилище', 'Vault') })
              ]),
              el('span', { className: 'bd-file-ext', textContent: dot > 0 ? name.slice(dot + 1).toUpperCase() : '' })
            ])
          )
        } else if (card.type === 'frame') {
          body.append(el('div', { className: 'bd-frame-title', textContent: card.text || tt('Рамка', 'Frame') }))
        } else if (card.type === 'note') {
          const info = notes.get(card.note)
          const ok = !info?.gone && api.vault.list().includes(card.note)
          const open = el('button', { className: 'bd-open', title: tt('Открыть заметку (Enter)', 'Open the note (Enter)') }, [icon('open'), el('span', { textContent: tt('Открыть', 'Open') })])
          open.onpointerdown = (e) => e.stopPropagation()
          open.onclick = () => ok && api.vault.open(card.note)
          body.append(
            el('div', { className: 'bd-note-head' }, [
              el('span', { className: 'bd-note-name' + (ok ? '' : ' gone'), textContent: nameOf(card.note), title: ok ? card.note : tt('Заметки нет', 'No such note') }),
              open
            ]),
            el('div', { className: 'bd-note-excerpt', textContent: info?.excerpt ?? '' })
          )
          void loadNote(card.note)
        } else if (card.type === 'image') {
          body.append(el('img', { className: 'bd-img', src: urlOf(card.src), draggable: false, alt: nameOf(card.src) }))
        } else if (card.type === 'link') {
          body.append(
            el('div', { className: 'bd-link-card' }, [
              el('div', { className: 'bd-link-host' }, [icon('link'), el('span', { textContent: card.text || hostOf(card.url) })]),
              el('div', { className: 'bd-link-url', textContent: card.url })
            ])
          )
        } else if (card.type === 'todo') {
          const lines = (card.text ?? '').split('\n')
          const list = el('div', { className: 'bd-todo' })
          lines.forEach((line, i) => {
            const m = /^\[( |x)\]\s?(.*)$/i.exec(line)
            const done = !!m && m[1].toLowerCase() === 'x'
            const box = el('input', { type: 'checkbox', checked: done })
            box.onpointerdown = (e) => e.stopPropagation()
            box.onchange = () => {
              const all = (card.text ?? '').split('\n')
              all[i] = `[${box.checked ? 'x' : ' '}] ${m ? m[2] : line}`
              card.text = all.join('\n')
              commit()
              renderCard(card)
            }
            list.append(el('label', { className: 'bd-todo-row' + (done ? ' done' : '') }, [box, el('span', {}, [mdInline(m ? m[2] : line)])]))
          })
          if (!card.text) list.append(el('div', { className: 'bd-todo-empty', textContent: tt('Двойной клик — добавить пункты', 'Double click to add items') }))
          body.append(list)
        }
        if (card.type === 'shape' || card.type === 'frame') node.dataset.shape = card.shape ?? 'rect'
        node.querySelector('.bd-lock')?.remove()
        if (card.locked) {
          const mark = icon('lock')
          mark.classList.add('bd-lock')
          node.append(mark)
        }
      }

      const place = (card) => {
        const node = cardEls.get(card.id)
        if (!node) return
        const s = sizeOf(card)
        node.style.left = card.x + 'px'
        node.style.top = card.y + 'px'
        node.style.width = s.w + 'px'
        node.style.height = s.h + 'px'
      }

      const makeCard = (card) => {
        const node = el('div', { className: 'bd-card' })
        node.dataset.id = card.id
        node.append(el('div', { className: 'bd-body' }))
        for (const side of ['t', 'r', 'b', 'l']) {
          const port = el('div', { className: 'bd-port p-' + side, title: tt('Потяните к другой карточке — получится стрелка', 'Drag to another card to make an arrow') })
          port.addEventListener('pointerdown', (e) => portDown(e, card, port))
          node.append(port)
        }
        // eight handles of the size, on the corners and the sides (seen on a chosen card; the corner at the bottom
        // right also when the mouse is over it)
        for (const dir of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const grip = el('div', { className: 'bd-rs bd-rs-' + dir + (dir === 'se' ? ' bd-grip' : '') })
          grip.addEventListener('pointerdown', (e) => gripDown(e, card, grip, dir))
          node.append(grip)
        }
        node.addEventListener('pointerdown', (e) => cardDown(e, card, node))
        node.addEventListener('dblclick', (e) => {
          e.stopPropagation()
          activate(card)
        })
        cardEls.set(card.id, node)
        ;(card.type === 'frame' ? frameLayer : cardLayer).append(node)
        renderCard(card)
        place(card)
        return node
      }

      /** Cards in the order of the array: what is later in it is on top (frames have a layer of their own below). */
      const restack = () => {
        for (const c of board.cards) cardEls.get(c.id) && (c.type === 'frame' ? frameLayer : cardLayer).append(cardEls.get(c.id))
      }

      const rebuild = () => {
        cardEls.clear()
        frameLayer.replaceChildren()
        cardLayer.replaceChildren()
        for (const c of board.cards) makeCard(c)
        drawLinks()
        refreshSel()
        syncHint()
        drawMini()
        // (an undo or a new board: what is found is looked for again)
        if (!searchBox.hidden) runSearch(false)
      }

      const byId = (id) => board.cards.find((c) => c.id === id)
      const selected = () => board.cards.filter((c) => sel.has(c.id))

      /** The cards that lie inside a frame (their middle is in it). */
      const membersOf = (frame) => {
        const r = rectOf(frame)
        return board.cards.filter((c) => {
          if (c === frame) return false
          const m = centerOf(c)
          return m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h && (c.type !== 'frame' || sizeOf(c).w * sizeOf(c).h < r.w * r.h)
        })
      }

      /* ---------- selection ---------- */
      const setSel = (ids, link = null) => {
        sel = new Set(ids)
        if (link !== selLink || sel.size) selBend = null
        selLink = link
        refreshSel()
      }
      const refreshSel = () => {
        for (const [id, node] of cardEls) node.classList.toggle('on', sel.has(id))
        drawLinks()
        placeFloat()
        drawMini()
      }

      const floatBtn = (name, title, onclick, cls = '') => {
        const b = el('button', { className: 'bd-fbtn ' + cls, title, onclick }, [icon(name)])
        b.dataset.act = name
        return b
      }
      const colorBtn = (items, current) => {
        const sw = el('button', { className: 'bd-fbtn bd-fcolor', title: tt('Цвет', 'Colour') })
        sw.dataset.act = 'color'
        sw.style.setProperty('--c', current || 'transparent')
        sw.onclick = (e) => menuAtButton(e, items)
        return sw
      }
      const fsep = () => el('span', { className: 'bd-fsep' })
      /**
       * The panel of what is chosen, over it (under it when there is no room above). What is in it depends on what
       * is chosen, as in Miro: its look and its main actions; copying, locking, order and deleting are in "⋯".
       */
      const placeFloat = () => {
        floatBar.replaceChildren()
        const cards = selected()
        if (editing || arrowMode || (!cards.length && !selLink)) {
          floatBar.hidden = true
          return
        }
        let box
        const more = (items) => floatBtn('more', tt('Ещё: копировать, закрепить, порядок, удалить…', 'More: copy, lock, order, delete…'), (e) => menuAtButton(e, items()))
        if (cards.length > 1) {
          box = boundsOf(cards)
          floatBar.append(
            floatBtn('align', tt('Выровнять', 'Align'), (e) => menuAtButton(e, arrangeMenu(cards)[0].children)),
            floatBtn('distribute', tt('Распределить (от трёх блоков)', 'Distribute (three blocks or more)'), (e) => cards.length > 2 && menuAtButton(e, arrangeMenu(cards)[1].children), cards.length > 2 ? '' : 'off'),
            floatBtn('samesize', tt('Одинаковый размер', 'Same size'), (e) => menuAtButton(e, arrangeMenu(cards)[2].children)),
            floatBtn('frame', tt('Обернуть в рамку (Ctrl+G)', 'Wrap in a frame (Ctrl+G)'), () => wrapInFrame(cards)),
            fsep(),
            colorBtn(colorMenu(cards), ''),
            more(multiMenu)
          )
        } else if (cards.length === 1) {
          const c = cards[0]
          box = rectOf(c)
          const one = [c]
          const color = () => colorBtn(colorMenu(one), c.color || (c.type === 'sticky' ? STICKY : ''))
          const size = () => floatBtn('textsize', tt('Размер текста', 'Text size'), (e) => menuAtButton(e, fontMenu(one)))
          const arrow = () => floatBtn('arrow', tt('Стрелка отсюда (A)', 'Arrow from here (A)'), () => startArrowMode(c))
          const open = (title) => floatBtn('open', title, () => activate(c))
          const parts = []
          if (c.type === 'text' || c.type === 'sticky') {
            parts.push(color(), size())
            parts.push(
              c.type === 'text'
                ? floatBtn('sticky', tt('Превратить в стикер', 'Make it a sticky note'), () => ((c.type = 'sticky'), (c.color ??= STICKY), rebuildOne(c)))
                : floatBtn('card', tt('Превратить в карточку', 'Make it a plain card'), () => ((c.type = 'text'), rebuildOne(c)))
            )
            parts.push(fsep(), arrow())
          } else if (c.type === 'shape') {
            parts.push(
              color(),
              size(),
              floatBtn('shapes', tt('Форма', 'Shape'), (e) => menuAtButton(e, SHAPES.map((s) => ({ label: tt(s.ru, s.en), checked: (c.shape ?? 'rect') === s.id, action: () => (setProp(one, 'shape', s.id), redrawShape(c), drawLinks()) })))),
              fsep(),
              arrow()
            )
          } else if (c.type === 'todo') parts.push(color(), size(), fsep(), arrow())
          else if (c.type === 'note') parts.push(open(tt('Открыть заметку (Enter)', 'Open the note (Enter)')), color(), fsep(), arrow())
          else if (c.type === 'image' || c.type === 'file') {
            parts.push(open(tt('Открыть (Enter)', 'Open (Enter)')))
            if (c.type === 'image') parts.push(floatBtn('realsize', tt('Исходный размер', 'Original size'), () => realSize(c)))
            parts.push(fsep(), arrow())
          } else if (c.type === 'link') {
            parts.push(open(tt('Открыть в браузере (Enter)', 'Open in the browser (Enter)')), floatBtn('pencil', tt('Изменить адрес', 'Edit the address'), () => void editLinkUrl(c)), fsep(), arrow())
          } else if (c.type === 'frame') {
            parts.push(
              floatBtn('name', tt('Название', 'Name'), () => startEdit(c, 'all')),
              color(),
              floatBtn('fit', tt('Подогнать под содержимое', 'Fit to the contents'), () => fitFrame(c), membersOf(c).length ? '' : 'off')
            )
          }
          floatBar.append(...parts, more(() => cardMenu(c)))
        } else {
          const l = board.links.find((x) => x.id === selLink)
          const mid = l && linkMid.get(l.id)
          if (!l || !mid) {
            floatBar.hidden = true
            return
          }
          // (over the whole arrow, not its middle: the panel must never cover its bend points or its ends)
          const route = routeOf(l)
          const xs = route ? [...route.line.map((p) => p.x), mid.x] : [mid.x]
          const ys = route ? [...route.line.map((p) => p.y), mid.y] : [mid.y]
          const pad = 12 / board.view.k
          box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad }
          floatBar.append(
            floatBtn('dash', tt('Вид линии', 'Line style'), (e) => menuAtButton(e, lineItems(l))),
            floatBtn('ends', tt('Концы', 'Ends'), (e) => menuAtButton(e, endItems(l))),
            floatBtn('curve', tt('Форма: прямая, изогнутая, ломаная', 'Shape: straight, curved, elbow'), (e) => menuAtButton(e, formItems(l))),
            floatBtn('pencil', tt('Подпись (двойной щелчок по стрелке)', 'Label (double click the arrow)'), () => editLabel(l)),
            colorBtn([{ colors: { current: l.color, pick: (col) => linkProp(l, 'color', col || undefined) } }], l.color || ''),
            more(() => linkMenu(l))
          )
        }
        floatBar.hidden = false
        const r = canvas.getBoundingClientRect()
        const top = toScreen(box.x + box.w / 2, box.y)
        const bottom = toScreen(box.x + box.w / 2, box.y + box.h)
        const w = floatBar.offsetWidth || 200
        const h = floatBar.offsetHeight || 38
        floatBar.style.left = clamp(top.x - r.left - w / 2, 6, Math.max(6, r.width - w - 6)) + 'px'
        // over the block; under it when there is no room above; never out of the field
        const above = top.y - r.top - h - 10
        const below = bottom.y - r.top + 10
        floatBar.style.top = clamp(above >= 6 ? above : below, 6, Math.max(6, r.height - h - 70)) + 'px'
      }

      /* ---------- creating, copying, deleting ---------- */
      /** A free place of the size near `want` (or the middle of the view): a row to the right, then the next row down. */
      const freeSpot = (w, h, want) => {
        const c0 = want ?? viewCenter()
        let x = Math.round(c0.x - w / 2)
        let y = Math.round(c0.y - h / 2)
        if (want) return { x, y }
        const free = (px, py) => !board.cards.some((c) => c.type !== 'frame' && px < c.x + sizeOf(c).w + 16 && px + w + 16 > c.x && py < c.y + sizeOf(c).h + 16 && py + h + 16 > c.y)
        const x0 = x
        const y0 = y
        for (let i = 1; i < 80 && !free(x, y); i++) {
          x = x0 + (i % 4) * (w + 24)
          y = y0 + Math.floor(i / 4) * (h + 24)
        }
        return { x, y }
      }

      /** The size a new card of these properties is made in. */
      const sizeFor = (props) => (props.type === 'shape' ? SHAPES.find((s) => s.id === (props.shape ?? 'rect'))?.size ?? SIZE.shape : SIZE[props.type])
      /**
       * A new card. `at` is the middle of where it goes (null: a free place in the middle of the view); `snap`: its
       * corner on a dot of the grid.
       */
      const addCard = (props, at, edit = true, snap = false) => {
        const [dw, dh] = sizeFor(props)
        const w = props.w ?? dw
        const h = props.h ?? dh
        let p = freeSpot(w, h, at)
        if (snap || snapOn()) p = snapPt(p, true)
        const card = { id: uid(), x: p.x, y: p.y, ...props, w, h }
        // frames go to the back of the array, the rest to the front
        if (card.type === 'frame') board.cards.unshift(card)
        else board.cards.push(card)
        makeCard(card)
        setSel([card.id])
        // (a block to be typed into is "new" before the change is kept: an untouched board stays untouched while it is)
        const typed = edit && ['text', 'sticky', 'shape', 'todo', 'frame'].includes(card.type)
        if (typed) fresh.add(card.id)
        commit()
        syncHint()
        if (typed) startEdit(card)
        return card
      }

      /** The bend points of an arrow moved with its cards. */
      const movedPts = (l, dx, dy) => (Array.isArray(l.pts) && l.pts.length ? { pts: l.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : {})
      const cloneCards = (cards, dx, dy) => {
        const ids = new Map(cards.map((c) => [c.id, uid()]))
        const copies = cards.map((c) => ({ ...JSON.parse(JSON.stringify(c)), id: ids.get(c.id), x: c.x + dx, y: c.y + dy }))
        const arrows = board.links.filter((l) => ids.has(l.from) && ids.has(l.to)).map((l) => ({ ...l, id: uid(), from: ids.get(l.from), to: ids.get(l.to), ...movedPts(l, dx, dy) }))
        return { copies, arrows }
      }
      const insertClones = ({ copies, arrows }, quiet = false) => {
        const frames = copies.filter((c) => c.type === 'frame')
        board.cards.unshift(...frames)
        board.cards.push(...copies.filter((c) => c.type !== 'frame'))
        board.links.push(...arrows)
        // (each new card is put in its place without moving the others: a card held by the mouse must stay where it is in the page)
        for (const c of copies) makeCard(c)
        for (const f of [...frames].reverse()) frameLayer.prepend(cardEls.get(f.id))
        setSel(copies.map((c) => c.id))
        syncHint()
        if (!quiet) commit()
      }
      const duplicate = () => {
        const cards = withMembers(selected())
        if (cards.length) insertClones(cloneCards(cards, 28, 28))
      }
      /** The selection, and the cards inside the frames in it. */
      const withMembers = (cards) => {
        const all = new Map(cards.map((c) => [c.id, c]))
        for (const f of cards.filter((c) => c.type === 'frame')) for (const m of membersOf(f)) all.set(m.id, m)
        return [...all.values()]
      }
      const clipboardText = () => {
        const cards = withMembers(selected())
        const ids = new Set(cards.map((c) => c.id))
        return CLIP + JSON.stringify({ cards, links: board.links.filter((l) => ids.has(l.from) && ids.has(l.to)) })
      }
      let memory = ''
      let memoryClip = null
      const copySel = async () => {
        if (!sel.size) return
        memory = clipboardText()
        pasteShift = 0
        try {
          await clip.copy(memory)
        } catch {
          /* the board's own copy is kept */
        }
        // (what the clipboard holds now: while it still holds it, a paste is of the board's own copy)
        try {
          memoryClip = (await clip.read()).text ?? ''
        } catch {
          memoryClip = null
        }
      }
      const cutSel = async () => {
        await copySel()
        removeSelected(true)
      }
      const pasteHere = async (at) => {
        if (!board || broken) return
        let text = ''
        let image = null
        try {
          const got = await clip.read()
          text = got.text ?? ''
          image = got.image
        } catch {
          /* nothing readable */
        }
        const where = at ?? viewCenter()
        if (!text.startsWith(CLIP) && memory && memoryClip !== null && text === memoryClip) text = memory
        if (text.startsWith(CLIP)) {
          try {
            const src = JSON.parse(text.slice(CLIP.length))
            const cards = (src.cards ?? []).filter((c) => c && DEF[c.type])
            if (cards.length) {
              const b = boundsOf(cards)
              const dx = at ? at.x - b.x - b.w / 2 : 28 * (1 + pasteShift++)
              const dy = at ? at.y - b.y - b.h / 2 : 28 * pasteShift
              const ids = new Map(cards.map((c) => [c.id, uid()]))
              const copies = cards.map((c) => ({ ...c, id: ids.get(c.id), x: Math.round(c.x + dx), y: Math.round(c.y + dy) }))
              const arrows = (src.links ?? []).filter((l) => ids.has(l.from) && ids.has(l.to)).map((l) => ({ ...l, id: uid(), from: ids.get(l.from), to: ids.get(l.to), ...movedPts(l, Math.round(dx), Math.round(dy)) }))
              insertClones({ copies, arrows })
              return
            }
          } catch {
            /* plain text then */
          }
        }
        if (image && image.length) {
          await addImage('Pasted image.png', image, where)
          return
        }
        const t = text.trim()
        if (!t) return
        if (IS_URL.test(t)) addCard({ type: 'link', url: normUrl(t) }, where, false)
        else {
          // as big as the text: about 34 letters to a line of the card, 21 px a line
          const w = clamp(t.length * 7, 180, 360)
          const lines = t.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil((line.length * 7.2) / (w - 24))), 0)
          addCard({ type: 'text', text: t, w, h: clamp(lines * 21 + 24, 60, 440) }, where, false)
        }
      }

      const addImage = async (name, bytes, at) => {
        try {
          const p = await api.vault.saveAttachment(name, bytes)
          const dims = await new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = () => resolve({ w: 260, h: 180 })
            img.src = urlOf(p)
          })
          const w = Math.min(340, dims.w || 260)
          addCard({ type: 'image', src: p, w, h: Math.round((w * (dims.h || 180)) / (dims.w || 260)) }, at, false)
        } catch (e) {
          api.ui.notice(e instanceof Error ? e.message : String(e), 6000)
        }
      }
      const pickImages = (at) => {
        const input = el('input', { type: 'file', accept: 'image/*', multiple: true })
        input.onchange = async () => {
          let i = 0
          for (const f of input.files) {
            const spot = at ? { x: at.x + i * 30, y: at.y + i * 30 } : undefined
            await addImage(f.name || 'image.png', new Uint8Array(await f.arrayBuffer()), spot)
            i++
          }
        }
        input.click()
      }
      const askLink = async (at) => {
        const raw = await api.ui.prompt(tt('Адрес ссылки', 'Link address'), 'https://')
        const u = raw?.trim()
        if (u && u !== 'https://') addCard({ type: 'link', url: normUrl(u) }, at, false)
      }

      const removeSelected = (keepFrameContents = false) => {
        if (!board || broken) return
        if (selLink && !sel.size) {
          board.links = board.links.filter((l) => l.id !== selLink)
          selLink = null
          drawLinks()
          commit()
          placeFloat()
          return
        }
        const ids = new Set([...sel].filter((id) => !byId(id)?.locked))
        if (!ids.size) return
        board.cards = board.cards.filter((c) => !ids.has(c.id))
        board.links = board.links.filter((l) => !ids.has(l.from) && !ids.has(l.to))
        for (const id of ids) {
          cardEls.get(id)?.remove()
          cardEls.delete(id)
        }
        void keepFrameContents
        sel = new Set()
        selLink = null
        refreshSel()
        commit()
        syncHint()
      }
      const removeFrameWithContents = (frame) => {
        const ids = new Set([frame.id, ...membersOf(frame).map((c) => c.id)])
        setSel([...ids])
        for (const id of [...ids]) if (byId(id)?.locked) ids.delete(id)
        sel = ids
        removeSelected()
      }

      /* ---------- editing text ---------- */
      const startEdit = (card, target) => {
        if (editing || broken) return
        const node = cardEls.get(card.id)
        if (!node) return
        const frame = card.type === 'frame'
        const shape = card.type === 'shape'
        // (a shape keeps its outline while its text is typed: the field goes where the text is, inside it)
        const wrap = node.querySelector(frame ? '.bd-frame-title' : shape ? '.bd-shape-text' : '.bd-body')
        if (!wrap) return
        editing = card.id
        placeFloat()
        const field = frame
          ? el('input', { className: 'bd-edit bd-edit-title', value: card.text ?? '', placeholder: tt('Название рамки', 'Name of the frame'), spellcheck: false })
          : el('textarea', {
              className: 'bd-edit',
              value: card.text ?? '',
              spellcheck: false,
              placeholder: card.type === 'todo' ? tt('По пункту на строке', 'One item per line') : tt('Текст', 'Text')
            })
        if (card.type === 'todo') {
          // the list is edited as plain lines: "[ ] to do", "[x] done"
          field.value = (card.text ?? '').split('\n').map((l) => (/^\[( |x)\]/i.test(l) ? l : l ? '[ ] ' + l : l)).join('\n') || '[ ] '
        }
        wrap.replaceChildren(field)
        if (shape) {
          // as high as its lines, in the middle of the shape
          field.rows = 1
          const grow = () => {
            field.style.height = 'auto'
            field.style.height = Math.min(field.scrollHeight, wrap.clientHeight) + 'px'
          }
          field.addEventListener('input', grow)
          grow()
        } else if (!frame) {
          // a card grows down with its text while it is typed (never shrinks by itself)
          field.addEventListener('input', () => {
            const over = field.scrollHeight - field.clientHeight
            if (over > 0) {
              card.h = sizeOf(card).h + over + 4
              place(card)
              drawLinks()
            }
          })
        }
        field.focus()
        if (target === 'all') field.select()
        else field.setSelectionRange(field.value.length, field.value.length)
        const done = (cancel) => {
          if (editing !== card.id) return
          editing = null
          const isNew = fresh.delete(card.id)
          // (Esc ends the typing and keeps what was typed, as a click elsewhere does: nothing typed is lost)
          const empty = !field.value.replace(/\[( |x)\]/gi, '').trim()
          // an empty new card is taken back only by Esc; leaving it by a click elsewhere keeps it
          if (cancel && isNew && empty && card.type !== 'frame') {
            // (and its step of undo with it: making an empty card and taking it back is no step at all)
            board.cards = board.cards.filter((c) => c.id !== card.id)
            board.links = board.links.filter((l) => l.from !== card.id && l.to !== card.id)
            cardEls.get(card.id)?.remove()
            cardEls.delete(card.id)
            sel.delete(card.id)
            if (hist.i > 0) {
              hist.stack.length = hist.i
              hist.i--
            }
            drawLinks()
            changed()
            syncToolbar()
            placeFloat()
            syncHint()
            canvas.focus()
            return
          }
          if (field.value !== (card.text ?? '')) {
            card.text = field.value
            commit()
          } else if (isNew) changed()
          renderCard(card)
          placeFloat()
          canvas.focus()
        }
        field.onblur = () => done(false)
        field.onkeydown = (e) => {
          e.stopPropagation()
          if (e.key === 'Escape') done(true)
          // (in a shape Enter finishes the text, Shift+Enter starts a new line)
          else if (e.key === 'Enter' && (e.ctrlKey || frame || (shape && !e.shiftKey))) {
            e.preventDefault()
            done(false)
          }
          else if (e.key === 'Enter' && card.type === 'todo') {
            e.preventDefault()
            const at = field.selectionStart
            field.setRangeText('\n[ ] ', at, field.selectionEnd, 'end')
          }
        }
        field.onpointerdown = (e) => e.stopPropagation()
      }
      /** The label of an arrow typed in place, on the middle of the arrow (Enter or a click elsewhere keeps it, Esc not). */
      const editLabel = (l) => {
        const mid = linkMid.get(l.id)
        if (!mid || broken) return
        root.querySelector('.bd-label-edit')?.blur()
        const r = canvas.getBoundingClientRect()
        const s = toScreen(mid.x, mid.y)
        const input = el('input', { className: 'bd-label-edit', value: l.label ?? '', placeholder: tt('Подпись', 'Label'), spellcheck: false })
        input.style.left = s.x - r.left + 'px'
        input.style.top = s.y - r.top + 'px'
        canvas.append(input)
        floatBar.hidden = true
        let over = false
        const finish = (keep) => {
          if (over) return
          over = true
          input.remove()
          if (keep && board.links.includes(l) && (input.value.trim() || undefined) !== l.label) {
            l.label = input.value.trim() || undefined
            drawLinks()
            commit()
          }
          placeFloat()
          canvas.focus()
        }
        input.onkeydown = (e) => {
          e.stopPropagation()
          if (e.key === 'Enter') finish(true)
          else if (e.key === 'Escape') finish(false)
        }
        input.onpointerdown = (e) => e.stopPropagation()
        input.onblur = () => finish(true)
        input.focus()
        input.select()
      }
      const reverseLink = (l) => {
        ;[l.from, l.to] = [l.to, l.from]
        ;[l.fromSide, l.toSide] = [l.toSide, l.fromSide]
        if (l.pts) l.pts = [...l.pts].reverse()
        drawLinks()
        commit()
      }
      /** Double click: edit a card of text, open a note or a link. */
      /** A file of a card opened where it opens: a board here, a note in Syntex, anything else in its program. */
      const openAny = (p) => {
        if (/\.board$/i.test(p)) void controller?.open(p)
        else if (/\.md$/i.test(p)) api.vault.open(p)
        else void files.openFile(p)
      }
      const activate = (card) => {
        if (card.locked && !['note', 'link', 'image', 'file'].includes(card.type)) return
        if (card.type === 'note') {
          if (api.vault.list().includes(card.note)) api.vault.open(card.note)
        } else if (card.type === 'link') window.open(normUrl(card.url))
        else if (card.type === 'image' || card.type === 'file') openAny(card.src)
        else startEdit(card)
      }

      /* ---------- moving cards ---------- */
      /** Where the group would stop: against the edges and middles of other cards (guide lines), or against the grid. */
      const snapMove = (box, dx, dy, movingIds, off) => {
        const k = board.view.k
        const th = 7 / k
        let nx = box.x + dx
        let ny = box.y + dy
        const lines = []
        if (!off && board.settings.guides !== false) {
          const others = board.cards.filter((c) => !movingIds.has(c.id) && c.type !== 'frame')
          let bx = th
          let by = th
          let gx = null
          let gy = null
          for (const o of others) {
            const r = rectOf(o)
            for (const mine of [nx, nx + box.w / 2, nx + box.w]) {
              for (const theirs of [r.x, r.x + r.w / 2, r.x + r.w]) {
                if (Math.abs(theirs - mine) < bx) {
                  bx = Math.abs(theirs - mine)
                  gx = { shift: theirs - mine, at: theirs, r }
                }
              }
            }
            for (const mine of [ny, ny + box.h / 2, ny + box.h]) {
              for (const theirs of [r.y, r.y + r.h / 2, r.y + r.h]) {
                if (Math.abs(theirs - mine) < by) {
                  by = Math.abs(theirs - mine)
                  gy = { shift: theirs - mine, at: theirs, r }
                }
              }
            }
          }
          if (gx) {
            nx += gx.shift
            lines.push({ v: true, at: gx.at, from: Math.min(gx.r.y, ny) - 20, to: Math.max(gx.r.y + gx.r.h, ny + box.h) + 20 })
          }
          if (gy) {
            ny += gy.shift
            lines.push({ v: false, at: gy.at, from: Math.min(gy.r.x, nx) - 20, to: Math.max(gy.r.x + gy.r.w, nx + box.w) + 20 })
          }
        }
        // (the grid is kept by the caller: with the snapping on, each card goes onto the dots)
        return { dx: nx - box.x, dy: ny - box.y, lines }
      }
      /** A size of whole steps of the grid near this one (never below the least size of the card). */
      const gridSize = (c, w, h) => {
        const [mw, mh] = MIN[c.type]
        const step = (v, min) => Math.max(Math.ceil(min / GRID), Math.round(v / GRID)) * GRID
        return { w: step(w, mw), h: step(h, mh) }
      }
      /** "Align to the grid": the corners of the cards on the nearest dots, their sizes whole steps of the grid. */
      const alignToGrid = (cards) => {
        const list = cards.filter((c) => !c.locked)
        if (!list.length) return
        for (const c of list) {
          const s = sizeOf(c)
          c.x = Math.round(c.x / GRID) * GRID
          c.y = Math.round(c.y / GRID) * GRID
          const g = gridSize(c, s.w, s.h)
          c.w = g.w
          c.h = g.h
          place(c)
          if (c.type === 'shape') redrawShape(c)
        }
        drawLinks()
        placeFloat()
        commit()
      }
      const showGuides = (lines) => {
        guides.replaceChildren()
        for (const l of lines) {
          guides.append(svgEl('line', l.v ? { x1: l.at, x2: l.at, y1: l.from, y2: l.to, class: 'bd-guide' } : { y1: l.at, y2: l.at, x1: l.from, x2: l.to, class: 'bd-guide' }))
        }
      }

      const cardDown = (e, card, node) => {
        if (e.button !== 0 || e.target.closest('textarea, input, button, .bd-port, .bd-grip')) return
        if (arrowMode) {
          e.stopPropagation()
          finishArrowMode(card)
          return
        }
        if (spaceDown || tool === 'hand') return // the canvas pans
        e.stopPropagation()
        canvas.focus()
        if (tool === 'arrow' && !card.locked) {
          arrowToolDown(e, card, node)
          return
        }
        if (e.shiftKey) {
          const next = new Set(sel)
          if (next.has(card.id)) next.delete(card.id)
          else next.add(card.id)
          setSel(next)
          return
        }
        // Ctrl: a click adds the card to the choice (or takes it out); a drag puts the cards on the dots of the grid
        const ctrlDown = e.ctrlKey || e.metaKey
        if (!ctrlDown) {
          if (!sel.has(card.id)) setSel([card.id])
          else if (selLink) setSel(sel)
        }
        let moving = []
        const origin = new Map()
        // the bend points of the arrows whose both ends are moved go with them
        let bends = []
        const take = () => {
          moving = withMembers(selected()).filter((c) => !c.locked)
          origin.clear()
          for (const c of moving) origin.set(c.id, { x: c.x, y: c.y, ...sizeOf(c) })
          const ids = new Set(moving.map((c) => c.id))
          bends = board.links.filter((l) => l.pts?.length && ids.has(l.from) && ids.has(l.to)).map((l) => ({ l, pts: l.pts.map((p) => ({ ...p })) }))
        }
        if (!ctrlDown) take()
        if (!ctrlDown && !moving.length) return
        const start = { x: e.clientX, y: e.clientY }
        const startAlt = e.altKey
        let box = moving.length ? boundsOf(moving) : null
        let moved = false
        node.setPointerCapture(e.pointerId)
        const move = (ev) => {
          const k = board.view.k
          let dx = (ev.clientX - start.x) / k
          let dy = (ev.clientY - start.y) / k
          if (!moved) {
            if (Math.hypot(dx, dy) * k < 3) return
            moved = true
            if (ctrlDown) {
              // (a card dragged with Ctrl that was not chosen is moved alone)
              if (!sel.has(card.id) || selLink) setSel([card.id])
              take()
              if (!moving.length) return
              box = boundsOf(moving)
            }
            if (startAlt) {
              // Alt: the copies are what is dragged, the originals stay
              const made = cloneCards(moving, 0, 0)
              insertClones(made, true)
              moving = made.copies
              origin.clear()
              for (const c of moving) origin.set(c.id, { x: c.x, y: c.y, ...sizeOf(c) })
              box = boundsOf(moving)
              bends = []
            }
            canvas.classList.add('moving')
          }
          if (!moving.length) return
          const grid = ev.ctrlKey || ev.metaKey
          // the snapping to the grid (on by default): the corner of each card on a dot as it moves; Alt frees it
          const dots = !grid && snapOn() && !(ev.altKey && !startAlt)
          let lines = []
          if (dots) {
            // near the edge or the middle of another block the block holds on to it (a guide line shows), on that
            // side only; elsewhere its corner goes onto a dot of the grid
            const held = snapMove(box, dx, dy, new Set(moving.map((c) => c.id)), false)
            const byX = held.lines.some((l) => l.v)
            const byY = held.lines.some((l) => !l.v)
            lines = held.lines
            for (const c of moving) {
              const o = origin.get(c.id)
              c.x = byX ? Math.round(o.x + held.dx) : Math.round((o.x + dx) / GRID) * GRID
              c.y = byY ? Math.round(o.y + held.dy) : Math.round((o.y + dy) / GRID) * GRID
              if (sizeOf(c).w !== o.w || sizeOf(c).h !== o.h) {
                c.w = o.w
                c.h = o.h
                if (c.type === 'shape') redrawShape(c)
              }
              place(c)
            }
            const o = origin.get(card.id) ?? origin.get(moving[0].id)
            const c = origin.has(card.id) ? card : moving[0]
            dx = c.x - o.x
            dy = c.y - o.y
          } else if (grid) {
            // every card on the dots: its corner on the nearest one, its size whole steps of the grid
            for (const c of moving) {
              const o = origin.get(c.id)
              c.x = Math.round((o.x + dx) / GRID) * GRID
              c.y = Math.round((o.y + dy) / GRID) * GRID
              const g = gridSize(c, o.w, o.h)
              c.w = g.w
              c.h = g.h
              place(c)
              if (c.type === 'shape') redrawShape(c)
            }
            const o = origin.get(card.id) ?? origin.get(moving[0].id)
            const c = origin.has(card.id) ? card : moving[0]
            dx = c.x - o.x
            dy = c.y - o.y
          } else {
            const snapped = snapMove(box, dx, dy, new Set(moving.map((c) => c.id)), ev.altKey && !startAlt)
            dx = snapped.dx
            dy = snapped.dy
            lines = snapped.lines
            for (const c of moving) {
              const o = origin.get(c.id)
              c.x = Math.round(o.x + dx)
              c.y = Math.round(o.y + dy)
              // (a size made even by Ctrl a moment ago goes back when Ctrl is let go)
              if (sizeOf(c).w !== o.w || sizeOf(c).h !== o.h) {
                c.w = o.w
                c.h = o.h
                if (c.type === 'shape') redrawShape(c)
              }
              place(c)
            }
          }
          for (const b of bends) b.l.pts = b.pts.map((p) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) }))
          showGuides(lines)
          drawLinks()
          placeFloat()
          drawMini()
        }
        const up = () => {
          node.removeEventListener('pointermove', move)
          node.removeEventListener('pointerup', up)
          node.removeEventListener('pointercancel', up)
          canvas.classList.remove('moving')
          guides.replaceChildren()
          if (moved) commit()
          else if (ctrlDown) {
            const next = new Set(sel)
            if (next.has(card.id)) next.delete(card.id)
            else next.add(card.id)
            setSel(next)
          }
        }
        node.addEventListener('pointermove', move)
        node.addEventListener('pointerup', up)
        node.addEventListener('pointercancel', up)
      }

      /**
       * A handle of a card pulled: its edges follow the mouse (the handles of the corners move two edges, those of the
       * sides one). A picture keeps its proportions by its corners (Alt frees them). Ctrl: every edge that moves stops
       * on a dot of the grid, and the corner of the card goes onto the nearest one too.
       */
      const gripDown = (e, card, grip, dir = 'se') => {
        if (e.button !== 0 || card.locked) return
        e.stopPropagation()
        setSel([card.id])
        const s0 = sizeOf(card)
        const r0 = { l: card.x, t: card.y, r: card.x + s0.w, b: card.y + s0.h }
        const from = { x: e.clientX, y: e.clientY }
        const ratio = s0.w / s0.h
        const [mw, mh] = MIN[card.type]
        const E = dir.includes('e')
        const W = dir.includes('w')
        const N = dir.includes('n')
        const S = dir.includes('s')
        grip.setPointerCapture(e.pointerId)
        const move = (ev) => {
          const k = board.view.k
          const ctrl = ev.ctrlKey || ev.metaKey
          const snap = ctrl || (snapOn() && !ev.altKey)
          const g = (v) => (snap ? Math.round(v / GRID) * GRID : v)
          const dx = (ev.clientX - from.x) / k
          const dy = (ev.clientY - from.y) / k
          let l = W ? g(r0.l + dx) : ctrl ? g(r0.l) : r0.l
          let t = N ? g(r0.t + dy) : ctrl ? g(r0.t) : r0.t
          let r = E ? g(r0.r + dx) : ctrl ? g(r0.r) : r0.r
          let b = S ? g(r0.b + dy) : ctrl ? g(r0.b) : r0.b
          // (never smaller than the card may be: the edge that moves stops)
          if (r - l < mw) W ? (l = r - mw) : (r = l + mw)
          if (b - t < mh) N ? (t = b - mh) : (b = t + mh)
          if (card.type === 'image' && !ev.altKey && !ctrl && (E || W) && (N || S)) {
            const h = (r - l) / ratio
            if (N) t = b - h
            else b = t + h
          }
          card.x = Math.round(l)
          card.y = Math.round(t)
          card.w = Math.round(Math.min(2400, r - l))
          card.h = Math.round(Math.min(2400, b - t))
          place(card)
          if (card.type === 'shape') redrawShape(card)
          drawLinks()
          placeFloat()
          drawMini()
        }
        const up = () => {
          grip.removeEventListener('pointermove', move)
          grip.removeEventListener('pointerup', up)
          grip.removeEventListener('pointercancel', up)
          commit()
        }
        grip.addEventListener('pointermove', move)
        grip.addEventListener('pointerup', up)
        grip.addEventListener('pointercancel', up)
      }

      /* ---------- drawing an arrow ---------- */
      /** The card under a point of the screen, and the side of it the point is at (its dot, or the nearest side). */
      const cardAt = (cx, cy) => {
        const hit = document.elementFromPoint(cx, cy)
        const node = hit?.closest('.bd-card')
        const card = node ? byId(node.dataset.id) : null
        if (!card) return null
        const port = hit.closest('.bd-port')
        const side = port ? PORT_SIDE[[...port.classList].find((c) => c.startsWith('p-')).slice(2)] : sideNear(card, toWorld(cx, cy))
        return { card, side }
      }
      /** The card an arrow is being drawn to shows its dots (and which side the arrow will come to). */
      let targetNode = null
      const markTarget = (found, side) => {
        const node = found ? cardEls.get(found.id) : null
        if (targetNode && targetNode !== node) targetNode.classList.remove('target', 's-top', 's-right', 's-bottom', 's-left')
        targetNode = node
        if (node) {
          node.classList.remove('s-top', 's-right', 's-bottom', 's-left')
          node.classList.add('target', 's-' + side)
        }
      }
      const tempTo = (a, p) => {
        temp.setAttribute('x1', a.x)
        temp.setAttribute('y1', a.y)
        temp.setAttribute('x2', p.x)
        temp.setAttribute('y2', p.y)
        temp.setAttribute('visibility', 'visible')
      }
      /** A new block at the end of an arrow, fastened by its side that faces the arrow, and typed into at once. */
      const connectNew = (from, fromSide, p, props) => {
        const toSide = OPPOSITE[fromSide]
        const [w, h] = sizeFor(props)
        // (the middle of the new block, so that the middle of its side is where the arrow was let go)
        const [nx, ny] = NORMAL[fromSide]
        const at = { x: p.x + (nx * w) / 2, y: p.y + (ny * h) / 2 }
        const c = batch(() => {
          const made = addCard(props, at, false)
          addLink(from.id, made.id, fromSide, toSide)
          return made
        })
        fresh.add(c.id)
        startEdit(c)
      }
      /** An arrow let go on an empty place: a short list of what to make there, joined to the arrow. */
      const arrowToEmpty = (from, fromSide, p) => {
        const s = toScreen(p.x, p.y)
        const shape = SHAPES.find((x) => x.id === lastShape)
        // (the line stays drawn while the list is open: it shows where the block goes)
        tempTo(anchorOf(from, fromSide), p)
        const done = () => temp.setAttribute('visibility', 'hidden')
        showMenu(s.x + 6, s.y + 6, [
          { label: tt('Карточка', 'Card'), hint: 'T', action: () => (done(), connectNew(from, fromSide, p, { type: 'text' })) },
          { label: tt('Стикер', 'Sticky note'), hint: 'S', action: () => (done(), connectNew(from, fromSide, p, { type: 'sticky', color: STICKY })) },
          { label: tt(shape.ru, shape.en), icon: '◇', action: () => (done(), connectNew(from, fromSide, p, { type: 'shape', shape: shape.id })) },
          {
            label: tt('Заметка из хранилища…', 'Note from the vault…'),
            action: () => {
              done()
              const [w, h] = SIZE.note
              const [ax, ay] = NORMAL[fromSide]
              pickNote({ x: p.x + (ax * w) / 2, y: p.y + (ay * h) / 2 }, false, (made) => addLink(from.id, made.id, fromSide, OPPOSITE[fromSide]))
            }
          }
        ])
        // (closed without a choice: the line goes too)
        const watch = setInterval(() => {
          if (!document.querySelector('.bd-menu')) {
            done()
            clearInterval(watch)
          }
        }, 250)
      }
      /** Let go of an arrow on a card: it joins them at the side it was let go at; on an empty place: a new card. */
      const dropArrow = (from, fromSide, cx, cy) => {
        temp.setAttribute('visibility', 'hidden')
        markTarget(null)
        const found = cardAt(cx, cy)
        if (found && found.card.id !== from.id) addLink(from.id, found.card.id, fromSide, found.side)
        else if (!found) arrowToEmpty(from, fromSide, toWorld(cx, cy))
      }
      const portDown = (e, card, port) => {
        if (e.button !== 0 || card.locked) return
        e.stopPropagation()
        const side = PORT_SIDE[[...port.classList].find((c) => c.startsWith('p-')).slice(2)]
        port.setPointerCapture(e.pointerId)
        const move = (ev) => {
          const found = cardAt(ev.clientX, ev.clientY)
          const target = found && found.card.id !== card.id ? found : null
          markTarget(target?.card, target?.side)
          tempTo(anchorOf(card, side), target ? anchorOf(target.card, target.side) : toWorld(ev.clientX, ev.clientY))
        }
        move(e)
        const up = (ev) => {
          port.removeEventListener('pointermove', move)
          port.removeEventListener('pointerup', up)
          port.removeEventListener('pointercancel', up)
          dropArrow(card, side, ev.clientX, ev.clientY)
        }
        port.addEventListener('pointermove', move)
        port.addEventListener('pointerup', up)
        port.addEventListener('pointercancel', up)
      }
      /**
       * The arrow tool: pressed on a block and dragged, an arrow goes out of the side of it that faces the mouse; let go
       * on a block it joins them, on an empty place it asks what to make there. A click without a drag starts an arrow
       * that the next click on a block finishes.
       */
      const arrowToolDown = (e, card, node) => {
        node.setPointerCapture(e.pointerId)
        let moved = false
        let side = 'right'
        const move = (ev) => {
          if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return
          moved = true
          const p = toWorld(ev.clientX, ev.clientY)
          const found = cardAt(ev.clientX, ev.clientY)
          const target = found && found.card.id !== card.id ? found : null
          markTarget(target?.card, target?.side)
          const to = target ? anchorOf(target.card, target.side) : p
          side = sideToward(card, to)
          tempTo(anchorOf(card, side), to)
        }
        const up = (ev) => {
          node.removeEventListener('pointermove', move)
          node.removeEventListener('pointerup', up)
          node.removeEventListener('pointercancel', up)
          if (ev.type === 'pointercancel') {
            temp.setAttribute('visibility', 'hidden')
            markTarget(null)
            return
          }
          if (moved) dropArrow(card, side, ev.clientX, ev.clientY)
          else startArrowMode(card)
        }
        node.addEventListener('pointermove', move)
        node.addEventListener('pointerup', up)
        node.addEventListener('pointercancel', up)
      }
      /** "Arrow from here" in a menu: the next click on a card finishes the arrow. */
      const startArrowMode = (card) => {
        arrowMode = { from: card }
        canvas.classList.add('arrowing')
        placeFloat()
        tempTo(anchorOf(card, 'right'), anchorOf(card, 'right'))
        api.ui.notice(tt('Щёлкните по карточке, куда ведёт стрелка (Esc — отмена)', 'Click the card the arrow goes to (Esc cancels)'), 3500)
      }
      const stopArrowMode = () => {
        arrowMode = null
        canvas.classList.remove('arrowing')
        temp.setAttribute('visibility', 'hidden')
        markTarget(null)
        placeFloat()
      }
      const finishArrowMode = (card) => {
        const from = arrowMode?.from
        stopArrowMode()
        if (from && card && from.id !== card.id) addLink(from.id, card.id)
      }
      /** In the arrow mode the line follows the mouse from the side of the card that faces it. */
      const arrowModeTo = (p) => {
        const from = arrowMode.from
        tempTo(anchorOf(from, sideToward(from, p)), p)
      }

      /* ---------- bend points and the ends of an arrow ---------- */
      let clickBend = null
      /**
       * The line of an arrow pressed: it is chosen; dragged, a bend point is made where it was taken and follows the
       * mouse (Ctrl: on the dots of the grid). A click on an arrow already chosen makes a bend point there too.
       */
      const linkDown = (e, l) => {
        const wasOn = selLink === l.id && !sel.size
        // (an arrow already chosen is not drawn again: the line pressed must still be there when the mouse is let go,
        // or the click, and the double click for the label, would not come)
        if (!wasOn) setSel([], l.id)
        const start = { x: e.clientX, y: e.clientY }
        const at = toWorld(e.clientX, e.clientY)
        let i = -1
        // (the mouse is caught only once it moves: a double click must still reach the line, for the label)
        const move = (ev) => {
          if (i < 0) {
            if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return
            canvas.setPointerCapture(e.pointerId)
            i = bendIndex(l, at)
            l.pts = [...(l.pts ?? [])]
            l.pts.splice(i, 0, snapPt(at, false))
          }
          l.pts[i] = snapPt(toWorld(ev.clientX, ev.clientY), ev.ctrlKey || ev.metaKey || (snapOn() && !ev.altKey))
          drawLinks()
          placeFloat()
        }
        const up = () => {
          canvas.removeEventListener('pointermove', move)
          canvas.removeEventListener('pointerup', up)
          canvas.removeEventListener('pointercancel', up)
          if (i >= 0) commit()
          else if (wasOn) {
            // (a moment later: the second click of a double click edits the label instead)
            clearTimeout(clickBend)
            clickBend = setTimeout(() => {
              clickBend = null
              if (!board.links.includes(l)) return
              const j = bendIndex(l, at)
              l.pts = [...(l.pts ?? [])]
              l.pts.splice(j, 0, snapPt(at, e.ctrlKey || e.metaKey || (snapOn() && !e.altKey)))
              drawLinks()
              placeFloat()
              commit()
            }, 280)
          }
        }
        canvas.addEventListener('pointermove', move)
        canvas.addEventListener('pointerup', up)
        canvas.addEventListener('pointercancel', up)
      }
      /**
       * The label of an arrow dragged: it keeps the place along the arrow it was put at (a share of its length) and
       * its shift from the line, so it goes with the arrow when the blocks move. Near the line it sticks to it.
       */
      const labelDown = (e, l) => {
        if (!(selLink === l.id && !sel.size)) setSel([], l.id)
        const r0 = routeOf(l)
        if (!r0) return
        const p0 = toWorld(e.clientX, e.clientY)
        const grab = { x: p0.x - r0.mid.x, y: p0.y - r0.mid.y }
        let moved = false
        const move = (ev) => {
          if (!moved) {
            if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return
            moved = true
            canvas.setPointerCapture(e.pointerId)
            floatBar.hidden = true
          }
          const r = routeOf(l)
          const p = toWorld(ev.clientX, ev.clientY)
          const want = { x: p.x - grab.x, y: p.y - grab.y }
          const on = nearestOn(r.line, want)
          l.lt = Math.round(on.t * 1000) / 1000
          const off = { x: Math.round(want.x - on.x), y: Math.round(want.y - on.y) }
          if (Math.hypot(off.x, off.y) * board.view.k < 8) delete l.lo
          else l.lo = off
          drawLinks()
        }
        const up = () => {
          canvas.removeEventListener('pointermove', move)
          canvas.removeEventListener('pointerup', up)
          canvas.removeEventListener('pointercancel', up)
          placeFloat()
          if (moved) commit()
        }
        canvas.addEventListener('pointermove', move)
        canvas.addEventListener('pointerup', up)
        canvas.addEventListener('pointercancel', up)
      }
      /** A bend point dragged (Ctrl: on the dots of the grid). */
      const bendDown = (e, l, i, node) => {
        // (the point is chosen at once, without drawing the arrow again: a double click on it must still reach it)
        selBend = { link: l.id, i }
        for (const g of handleLayer.querySelectorAll('.bd-wp')) g.classList.toggle('on', g === node)
        let moved = false
        const move = (ev) => {
          if (!moved) {
            if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return
            // (caught once it moves: a double click on the point still reaches it, and takes it away)
            canvas.setPointerCapture(e.pointerId)
          }
          moved = true
          l.pts[i] = snapPt(toWorld(ev.clientX, ev.clientY), ev.ctrlKey || ev.metaKey || (snapOn() && !ev.altKey))
          drawLinks()
          placeFloat()
        }
        const up = () => {
          canvas.removeEventListener('pointermove', move)
          canvas.removeEventListener('pointerup', up)
          canvas.removeEventListener('pointercancel', up)
          if (moved) commit()
        }
        canvas.addEventListener('pointermove', move)
        canvas.addEventListener('pointerup', up)
        canvas.addEventListener('pointercancel', up)
      }
      const removeBend = (l, i) => {
        selBend = null
        if (!l.pts?.[i]) return
        l.pts = l.pts.filter((_, j) => j !== i)
        if (!l.pts.length) delete l.pts
        drawLinks()
        placeFloat()
        commit()
      }
      const clearBends = (l) => {
        delete l.pts
        drawLinks()
        placeFloat()
        commit()
      }
      /** An end of an arrow dragged to another side of its card, or to another card. */
      const endDown = (e, l, end) => {
        const other = end === 'from' ? byId(l.to) : byId(l.from)
        const otherSide = end === 'from' ? l.toSide : l.fromSide
        const fixed = anchorOf(other, otherSide)
        let moved = false
        const move = (ev) => {
          if (!moved) {
            if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return
            canvas.setPointerCapture(e.pointerId)
          }
          moved = true
          const found = cardAt(ev.clientX, ev.clientY)
          const target = found && found.card.id !== other.id ? found : null
          markTarget(target?.card, target?.side)
          tempTo(fixed, target ? anchorOf(target.card, target.side) : toWorld(ev.clientX, ev.clientY))
        }
        const up = (ev) => {
          canvas.removeEventListener('pointermove', move)
          canvas.removeEventListener('pointerup', up)
          canvas.removeEventListener('pointercancel', up)
          temp.setAttribute('visibility', 'hidden')
          markTarget(null)
          if (!moved) return
          const found = cardAt(ev.clientX, ev.clientY)
          if (!found || found.card.id === other.id) return
          const from = end === 'from' ? found.card.id : l.from
          const to = end === 'to' ? found.card.id : l.to
          if (board.links.some((x) => x !== l && x.from === from && x.to === to)) return
          l.from = from
          l.to = to
          if (end === 'from') l.fromSide = found.side
          else l.toSide = found.side
          drawLinks()
          placeFloat()
          commit()
        }
        canvas.addEventListener('pointermove', move)
        canvas.addEventListener('pointerup', up)
        canvas.addEventListener('pointercancel', up)
      }

      /* ---------- arranging ---------- */
      const toggleLock = (cards) => {
        const lock = !cards.every((c) => c.locked)
        for (const c of cards) {
          c.locked = lock || undefined
          renderCard(c)
        }
        commit()
        placeFloat()
      }
      const setColor = (cards, color) => {
        for (const c of cards) {
          c.color = color || undefined
          renderCard(c)
        }
        commit()
        placeFloat()
      }
      const setProp = (cards, key, value) => {
        for (const c of cards) {
          if (value === undefined) delete c[key]
          else c[key] = value
          renderCard(c)
        }
        commit()
      }
      const reorder = (cards, mode) => {
        const ids = new Set(cards.map((c) => c.id))
        const keep = board.cards.filter((c) => !ids.has(c.id))
        const moving = board.cards.filter((c) => ids.has(c.id))
        if (mode === 'front') board.cards = [...keep, ...moving]
        else if (mode === 'back') board.cards = [...moving, ...keep]
        else {
          const i = board.cards.findIndex((c) => ids.has(c.id))
          const j = board.cards.length - 1 - [...board.cards].reverse().findIndex((c) => ids.has(c.id))
          const at = mode === 'forward' ? Math.min(keep.length, j + 1 - moving.length + 1) : Math.max(0, i - 1)
          keep.splice(at, 0, ...moving)
          board.cards = keep
        }
        restack()
        commit()
      }
      const align = (cards, how) => {
        if (cards.length < 2) return
        const b = boundsOf(cards)
        for (const c of cards.filter((x) => !x.locked)) {
          const s = sizeOf(c)
          if (how === 'left') c.x = b.x
          else if (how === 'right') c.x = b.x + b.w - s.w
          else if (how === 'hcenter') c.x = Math.round(b.x + (b.w - s.w) / 2)
          else if (how === 'top') c.y = b.y
          else if (how === 'bottom') c.y = b.y + b.h - s.h
          else if (how === 'vcenter') c.y = Math.round(b.y + (b.h - s.h) / 2)
          place(c)
        }
        drawLinks()
        placeFloat()
        commit()
      }
      const distribute = (cards, axis) => {
        if (cards.length < 3) return
        const horizontal = axis === 'h'
        const list = [...cards].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y))
        const b = boundsOf(list)
        const total = list.reduce((n, c) => n + (horizontal ? sizeOf(c).w : sizeOf(c).h), 0)
        const gap = ((horizontal ? b.w : b.h) - total) / (list.length - 1)
        let at = horizontal ? b.x : b.y
        for (const c of list) {
          if (horizontal) c.x = Math.round(at)
          else c.y = Math.round(at)
          at += (horizontal ? sizeOf(c).w : sizeOf(c).h) + gap
          place(c)
        }
        drawLinks()
        placeFloat()
        commit()
      }
      const sameSize = (cards, dim) => {
        const first = sizeOf(cards[0])
        for (const c of cards.slice(1)) {
          if (dim === 'w' || dim === 'both') c.w = first.w
          if (dim === 'h' || dim === 'both') c.h = first.h
          place(c)
          if (c.type === 'shape') renderCard(c)
        }
        drawLinks()
        commit()
      }
      const wrapInFrame = (cards) => {
        if (!cards.length) return
        const b = boundsOf(cards)
        const f = { id: uid(), type: 'frame', x: b.x - 28, y: b.y - 52, w: Math.round(b.w + 56), h: Math.round(b.h + 80), text: '' }
        board.cards.unshift(f)
        makeCard(f)
        setSel([f.id])
        commit()
        startEdit(f, 'all')
      }
      const fitFrame = (frame) => {
        const m = membersOf(frame)
        if (!m.length) return
        const b = boundsOf(m)
        frame.x = b.x - 28
        frame.y = b.y - 52
        frame.w = Math.round(b.w + 56)
        frame.h = Math.round(b.h + 80)
        place(frame)
        commit()
      }

      /* ---------- search ---------- */
      const textOfCard = (c) => [c.text, c.type === 'note' ? nameOf(c.note) : '', c.url, c.src ? nameOf(c.src) : '', c.type === 'note' ? notes.get(c.note)?.excerpt : ''].filter(Boolean).join(' ').toLowerCase()
      const runSearch = (center = true) => {
        const q = board && !searchBox.hidden ? searchInput.value.trim().toLowerCase() : ''
        hits = q ? board.cards.filter((c) => textOfCard(c).includes(q)) : []
        hitAt = 0
        canvas.classList.toggle('searching', !!q)
        hitIds = new Set(hits.map((c) => c.id))
        for (const [id, node] of cardEls) node.classList.toggle('hit', hitIds.has(id))
        searchCount.textContent = q ? `${hits.length ? hitAt + 1 : 0} ${tt('из', 'of')} ${hits.length}` : ''
        if (hits.length && center) centerOn(hits[0])
      }
      const nextHit = (step) => {
        if (!hits.length) return
        hitAt = (hitAt + step + hits.length) % hits.length
        searchCount.textContent = `${hitAt + 1} ${tt('из', 'of')} ${hits.length}`
        centerOn(hits[hitAt])
        setSel([hits[hitAt].id])
      }
      const openSearch = () => {
        searchBox.hidden = false
        searchInput.focus()
        searchInput.select()
      }
      const closeSearch = () => {
        searchBox.hidden = true
        searchInput.value = ''
        runSearch()
        canvas.focus()
      }
      searchInput.oninput = () => runSearch()
      searchInput.onkeydown = (e) => {
        e.stopPropagation()
        if (e.key === 'Escape') closeSearch()
        else if (e.key === 'Enter') nextHit(e.shiftKey ? -1 : 1)
      }

      /* ---------- the minimap ---------- */
      const drawMini = () => {
        if (miniFrame || !board) return
        miniFrame = requestAnimationFrame(() => {
          miniFrame = 0
          const ctx = mini.getContext('2d')
          const W = mini.width
          const H = mini.height
          ctx.clearRect(0, 0, W, H)
          const r = canvas.getBoundingClientRect()
          const v = board.view
          const view = { x: -v.x / v.k, y: -v.y / v.k, w: r.width / v.k, h: r.height / v.k }
          // (a board that is all in view needs no map)
          const b = board.cards.length ? boundsOf(board.cards) : null
          miniBox.classList.toggle('fits', !b || (b.x >= view.x && b.y >= view.y && b.x + b.w <= view.x + view.w && b.y + b.h <= view.y + view.h))
          // (while the map is dragged its scale stays as it was when pressed: the place under the mouse must not move
          // away as the view it follows moves)
          if (!miniHeld) {
            const all = board.cards.length ? boundsOf([...board.cards, { type: 'text', ...view, w: view.w, h: view.h }]) : view
            const pad = 20
            const s = Math.min((W - 8) / (all.w + pad), (H - 8) / (all.h + pad))
            mini._map = { s, ox: (W - all.w * s) / 2 - all.x * s, oy: (H - all.h * s) / 2 - all.y * s }
          }
          const { s, ox, oy } = mini._map
          const css = getComputedStyle(mini)
          for (const c of board.cards) {
            const q = rectOf(c)
            ctx.fillStyle = c.type === 'frame' ? css.getPropertyValue('--border-2') : c.color || css.getPropertyValue('--text-3')
            ctx.globalAlpha = c.type === 'frame' ? 0.5 : sel.has(c.id) ? 1 : 0.7
            ctx.fillRect(q.x * s + ox, q.y * s + oy, Math.max(2, q.w * s), Math.max(2, q.h * s))
          }
          ctx.globalAlpha = 1
          ctx.strokeStyle = css.getPropertyValue('--accent')
          ctx.lineWidth = 1.5
          ctx.strokeRect(view.x * s + ox, view.y * s + oy, view.w * s, view.h * s)
        })
      }
      // the map being dragged: it stays shown (the whole board coming into view half way would hide it under the mouse,
      // and the drag would never end) and keeps its scale until the button is let go
      mini.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !mini._map || !board || miniHeld) return
        miniHeld = true
        miniBox.classList.add('held')
        mini.setPointerCapture(e.pointerId)
        const go = (ev) => {
          const b = mini.getBoundingClientRect()
          if (!b.width) return
          const { s, ox, oy } = mini._map
          const wx = ((ev.clientX - b.left) * (mini.width / b.width) - ox) / s
          const wy = ((ev.clientY - b.top) * (mini.height / b.height) - oy) / s
          const r = canvas.getBoundingClientRect()
          board.view.x = r.width / 2 - wx * board.view.k
          board.view.y = r.height / 2 - wy * board.view.k
          applyView()
        }
        go(e)
        // (let go, or taken away by the system: the drag ends either way, never left half done)
        const up = () => {
          mini.removeEventListener('pointermove', go)
          mini.removeEventListener('pointerup', up)
          mini.removeEventListener('pointercancel', up)
          mini.removeEventListener('lostpointercapture', up)
          miniHeld = false
          miniBox.classList.remove('held')
          saveView()
          drawMini()
        }
        mini.addEventListener('pointermove', go)
        mini.addEventListener('pointerup', up)
        mini.addEventListener('pointercancel', up)
        mini.addEventListener('lostpointercapture', up)
      })

      /* ====================================================================== menus */

      const showMenu = (x, y, items) =>
        api.ui.popup({
          x,
          y,
          mount: (box, close) => {
            box.classList.add('bd-menu')
            box.append(menuList(items, close))
          }
        })
      /** A menu under a button (`up`: over it, for the buttons at the bottom of the field). */
      const menuAtButton = (e, items, up = false) => {
        const r = (e.currentTarget ?? e.target).getBoundingClientRect()
        const tall = items.filter(Boolean).reduce((n, it) => n + (it.sep ? 11 : it.colors ? 40 : 31), 12)
        showMenu(r.left, up ? r.top - 6 - tall : r.bottom + 6, items)
      }
      const menuList = (items, close) => {
        const list = el('div', { className: 'bd-m' })
        for (const it of items.filter(Boolean)) {
          if (it.sep) {
            list.append(el('div', { className: 'bd-m-sep' }))
            continue
          }
          if (it.colors) {
            const row = el('div', { className: 'bd-m-colors' })
            for (const col of COLORS) {
              const dot = el('button', { className: 'bd-swatch' + (col ? '' : ' none') + (col === (it.colors.current ?? '') ? ' on' : ''), title: col ? col : tt('Без цвета', 'No colour') })
              dot.style.setProperty('--c', col || 'transparent')
              dot.onclick = () => {
                close()
                it.colors.pick(col)
              }
              row.append(dot)
            }
            list.append(row)
            continue
          }
          const row = el('div', { className: 'bd-m-item' + (it.disabled ? ' disabled' : '') + (it.danger ? ' danger' : '') })
          const b = el('button', { className: 'bd-m-row', disabled: !!it.disabled })
          b.append(
            el('span', { className: 'bd-m-check', textContent: it.checked ? '✓' : it.icon ?? '' }),
            el('span', { className: 'bd-m-label', textContent: it.label }),
            el('span', { className: 'bd-m-hint', textContent: it.children ? '▸' : it.hint ?? '' })
          )
          row.append(b)
          if (it.children) {
            const sub = el('div', { className: 'bd-m-sub addon-popup-like' })
            sub.append(menuList(it.children, close))
            row.append(sub)
            row.addEventListener('mouseenter', () => {
              sub.classList.remove('flip', 'up')
              const r = sub.getBoundingClientRect()
              if (r.right > window.innerWidth - 6) sub.classList.add('flip')
              if (r.bottom > window.innerHeight - 6) sub.classList.add('up')
            })
          } else if (it.action) {
            b.onclick = () => {
              close()
              it.action()
            }
          }
          list.append(row)
        }
        return list
      }

      const colorMenu = (cards) => [{ colors: { current: cards.length === 1 ? cards[0].color : undefined, pick: (c) => setColor(cards, c) } }]

      const addItems = (at) => [
        { label: tt('Карточка с текстом', 'Text card'), hint: 'T', action: () => addCard({ type: 'text' }, at) },
        { label: tt('Стикер', 'Sticky note'), hint: 'S', action: () => addCard({ type: 'sticky', color: STICKY }, at) },
        { label: tt('Чек-лист', 'Check list'), action: () => addCard({ type: 'todo', text: '[ ] ' }, at) },
        { label: tt('Заметка из хранилища…', 'Note from the vault…'), action: () => pickNote(at) },
        { label: tt('Картинка или файл…', 'Picture or file…'), action: () => pickFile(at) },
        { label: tt('Ссылка…', 'Link…'), action: () => void askLink(at) },
        { sep: true },
        { label: tt('Рамка', 'Frame'), hint: 'F', action: () => addCard({ type: 'frame', text: '' }, at) },
        { label: tt('Фигура', 'Shape'), children: SHAPES.map((s) => ({ label: tt(s.ru, s.en), action: () => addCard({ type: 'shape', shape: s.id }, at) })) }
      ]

      const fontMenu = (cards) => [
        { label: tt('Мелкий', 'Small'), checked: cards.every((c) => (c.fs ?? 1) === 0), action: () => setProp(cards, 'fs', 0) },
        { label: tt('Обычный', 'Normal'), checked: cards.every((c) => (c.fs ?? 1) === 1), action: () => setProp(cards, 'fs', undefined) },
        { label: tt('Крупный', 'Large'), checked: cards.every((c) => c.fs === 2), action: () => setProp(cards, 'fs', 2) },
        { label: tt('Огромный', 'Huge'), checked: cards.every((c) => c.fs === 3), action: () => setProp(cards, 'fs', 3) }
      ]
      const orderMenu = (cards) => [
        { label: tt('На передний план', 'Bring to front'), action: () => reorder(cards, 'front') },
        { label: tt('Вперёд', 'Forward'), action: () => reorder(cards, 'forward') },
        { label: tt('Назад', 'Backward'), action: () => reorder(cards, 'back-one') },
        { label: tt('На задний план', 'Send to back'), action: () => reorder(cards, 'back') }
      ]
      const arrangeMenu = (cards) => [
        {
          label: tt('Выровнять', 'Align'),
          disabled: cards.length < 2,
          children: [
            { label: tt('По левому краю', 'Left'), action: () => align(cards, 'left') },
            { label: tt('По центру', 'Centre horizontally'), action: () => align(cards, 'hcenter') },
            { label: tt('По правому краю', 'Right'), action: () => align(cards, 'right') },
            { sep: true },
            { label: tt('По верхнему краю', 'Top'), action: () => align(cards, 'top') },
            { label: tt('По середине', 'Centre vertically'), action: () => align(cards, 'vcenter') },
            { label: tt('По нижнему краю', 'Bottom'), action: () => align(cards, 'bottom') }
          ]
        },
        {
          label: tt('Распределить', 'Distribute'),
          disabled: cards.length < 3,
          children: [
            { label: tt('По горизонтали', 'Horizontally'), action: () => distribute(cards, 'h') },
            { label: tt('По вертикали', 'Vertically'), action: () => distribute(cards, 'v') }
          ]
        },
        {
          label: tt('Одинаковый размер', 'Same size'),
          disabled: cards.length < 2,
          children: [
            { label: tt('Ширина', 'Width'), action: () => sameSize(cards, 'w') },
            { label: tt('Высота', 'Height'), action: () => sameSize(cards, 'h') },
            { label: tt('Ширина и высота', 'Both'), action: () => sameSize(cards, 'both') }
          ]
        }
      ]

      const realSize = (card) => {
        const img = new Image()
        img.onload = () => {
          card.w = img.naturalWidth
          card.h = img.naturalHeight
          place(card)
          drawLinks()
          placeFloat()
          commit()
        }
        img.src = urlOf(card.src)
      }
      const editLinkUrl = async (card) => {
        const v = await api.ui.prompt(tt('Адрес ссылки', 'Link address'), card.url)
        if (v?.trim()) setProp([card], 'url', normUrl(v.trim()))
      }
      /**
       * The menu of a block, short and in groups: its main action, the clipboard, the arrow and the frame, the order,
       * the lock, deleting. Its look (colour, text size, form) is in the panel over it.
       */
      const cardMenu = (card) => {
        const one = [card]
        const main = []
        if (card.type === 'note') {
          main.push({ label: tt('Открыть заметку', 'Open the note'), hint: 'Enter', action: () => api.vault.open(card.note) })
          main.push({ label: tt('Показать в проводнике', 'Show in Explorer'), action: () => void files.reveal(card.note) })
        } else if (card.type === 'link') {
          main.push({ label: tt('Открыть в браузере', 'Open in the browser'), hint: 'Enter', action: () => window.open(normUrl(card.url)) })
          main.push({ label: tt('Изменить адрес…', 'Edit the address…'), action: () => void editLinkUrl(card) })
          main.push({
            label: tt('Название…', 'Title…'),
            action: async () => {
              const v = await api.ui.prompt(tt('Название ссылки', 'Title of the link'), card.text ?? '')
              if (v !== null) setProp(one, 'text', v.trim() || undefined)
            }
          })
        } else if (card.type === 'image' || card.type === 'file') {
          main.push({ label: card.type === 'image' ? tt('Открыть картинку', 'Open the picture') : tt('Открыть файл', 'Open the file'), hint: 'Enter', action: () => openAny(card.src) })
          main.push({ label: tt('Показать в проводнике', 'Show in Explorer'), action: () => void files.reveal(card.src) })
        } else if (card.type === 'frame') {
          main.push({ label: tt('Название', 'Name'), hint: 'Enter', action: () => startEdit(card, 'all') })
          main.push({ label: tt('Выделить содержимое', 'Select the contents'), disabled: !membersOf(card).length, action: () => setSel(membersOf(card).map((c) => c.id)) })
        } else main.push({ label: tt('Изменить текст', 'Edit the text'), hint: 'Enter', action: () => startEdit(card) })
        return [
          ...main,
          { sep: true },
          { label: tt('Копировать', 'Copy'), hint: 'Ctrl+C', action: () => void copySel() },
          { label: tt('Вырезать', 'Cut'), hint: 'Ctrl+X', action: () => void cutSel() },
          { label: tt('Дублировать', 'Duplicate'), hint: 'Ctrl+Shift+D', action: () => duplicate() },
          { label: tt('Вставить', 'Paste'), hint: 'Ctrl+V', action: () => void pasteHere() },
          { sep: true },
          { label: tt('Стрелка отсюда', 'Arrow from here'), hint: 'A', action: () => startArrowMode(card) },
          { label: tt('Обернуть в рамку', 'Wrap in a frame'), hint: 'Ctrl+G', action: () => wrapInFrame(one) },
          { sep: true },
          { label: tt('Порядок', 'Order'), children: orderMenu(one) },
          { label: tt('Выровнять по сетке', 'Align to the grid'), hint: tt('Ctrl+перетаскивание', 'Ctrl+drag'), disabled: card.locked, action: () => alignToGrid(one) },
          { label: card.locked ? tt('Открепить', 'Unlock') : tt('Закрепить', 'Lock'), action: () => toggleLock(one) },
          { sep: true },
          ...(card.type === 'frame'
            ? [
                { label: tt('Удалить рамку', 'Delete the frame'), hint: 'Del', danger: true, action: () => removeSelected() },
                { label: tt('Удалить рамку с содержимым', 'Delete the frame with its contents'), danger: true, action: () => removeFrameWithContents(card) }
              ]
            : [{ label: tt('Удалить', 'Delete'), hint: 'Del', danger: true, action: () => removeSelected() }])
        ]
      }
      /** The kind of a card changed: it is drawn again. */
      const rebuildOne = (card) => {
        cardEls.get(card.id)?.remove()
        cardEls.delete(card.id)
        makeCard(card)
        restack()
        commit()
        placeFloat()
      }

      const multiMenu = () => {
        const cards = selected()
        return [
          { label: tt('Копировать', 'Copy'), hint: 'Ctrl+C', action: () => void copySel() },
          { label: tt('Вырезать', 'Cut'), hint: 'Ctrl+X', action: () => void cutSel() },
          { label: tt('Дублировать', 'Duplicate'), hint: 'Ctrl+Shift+D', action: () => duplicate() },
          { sep: true },
          { label: tt('Обернуть в рамку', 'Wrap in a frame'), hint: 'Ctrl+G', action: () => wrapInFrame(cards) },
          { sep: true },
          { label: tt('Порядок', 'Order'), children: orderMenu(cards) },
          ...arrangeMenu(cards),
          { label: tt('Выровнять по сетке', 'Align to the grid'), hint: tt('Ctrl+перетаскивание', 'Ctrl+drag'), action: () => alignToGrid(cards) },
          { label: cards.every((c) => c.locked) ? tt('Открепить всё', 'Unlock all') : tt('Закрепить всё', 'Lock all'), action: () => toggleLock(cards) },
          { sep: true },
          { label: tt('Удалить', 'Delete') + ` (${cards.length})`, hint: 'Del', danger: true, action: () => removeSelected() }
        ]
      }

      const lineItems = (l) => [
        { label: tt('Сплошная', 'Solid'), checked: (l.style ?? 'solid') === 'solid', action: () => linkProp(l, 'style', 'solid') },
        { label: tt('Пунктир', 'Dashed'), checked: l.style === 'dashed', action: () => linkProp(l, 'style', 'dashed') },
        { label: tt('Точки', 'Dotted'), checked: l.style === 'dotted', action: () => linkProp(l, 'style', 'dotted') }
      ]
      const endItems = (l) => [
        { label: tt('Стрелка на конце', 'Arrow at the end'), checked: (l.head ?? 'end') === 'end', action: () => linkProp(l, 'head', 'end') },
        { label: tt('Стрелки с обеих сторон', 'Arrows at both ends'), checked: l.head === 'both', action: () => linkProp(l, 'head', 'both') },
        { label: tt('Без стрелок', 'No arrows'), checked: l.head === 'none', action: () => linkProp(l, 'head', 'none') }
      ]
      const formItems = (l) => [
        { label: tt('Прямая', 'Straight'), checked: !l.curve && !l.elbow, action: () => linkShape(l, null) },
        { label: tt('Изогнутая', 'Curved'), checked: !!l.curve, action: () => linkShape(l, 'curve') },
        { label: tt('Ломаная (под прямым углом)', 'Elbow (right angles)'), checked: !!l.elbow && !l.curve, action: () => linkShape(l, 'elbow') },
        { sep: true },
        // (the corners of a line with bends are rounded by default; this turns it off and on)
        { label: tt('Скруглять углы', 'Rounded corners'), checked: !l.sharp, disabled: !!l.curve, action: () => linkProp(l, 'sharp', l.sharp ? undefined : true) }
      ]
      const linkMenu = (l) => [
        { label: tt('Подпись', 'Label'), hint: tt('двойной щелчок', 'double click'), action: () => void editLabel(l) },
        { label: tt('Линия', 'Line'), children: lineItems(l) },
        { label: tt('Концы', 'Ends'), children: endItems(l) },
        { label: tt('Форма', 'Shape'), children: formItems(l) },
        { label: tt('Цвет', 'Colour'), children: [{ colors: { current: l.color, pick: (c) => linkProp(l, 'color', c || undefined) } }] },
        { sep: true },
        { label: tt('Развернуть', 'Reverse'), action: () => reverseLink(l) },
        { label: tt('Убрать точки изгиба', 'Remove the bend points'), disabled: !l.pts?.length, action: () => clearBends(l) },
        {
          label: tt('Подпись — на середину', 'The label back to the middle'),
          disabled: !l.label || (!Number.isFinite(l.lt) && !l.lo),
          action: () => {
            delete l.lt
            delete l.lo
            drawLinks()
            placeFloat()
            commit()
          }
        },
        { sep: true },
        { label: tt('Удалить', 'Delete'), hint: 'Del', danger: true, action: () => removeSelected() }
      ]
      const linkShape = (l, kind) => {
        delete l.curve
        delete l.elbow
        if (kind) l[kind] = true
        drawLinks()
        placeFloat()
        commit()
      }
      const linkProp = (l, key, value) => {
        if (value === undefined) delete l[key]
        else l[key] = value
        drawLinks()
        commit()
      }

      const zoom100 = () => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1)
      /** The menu of the percentage at the bottom left. */
      const zoomMenu = () => [
        { label: tt('Вписать всё', 'Fit everything'), hint: 'Shift+1', action: () => fit() },
        { label: tt('К выделенному', 'Zoom to the selection'), hint: 'Shift+2', disabled: !sel.size, action: () => fitSelection() },
        { label: '100%', hint: 'Shift+0', action: () => zoom100() }
      ]
      /** The list of boards, by the arrow next to the title: a new one first. */
      const boardsList = () => {
        const paths = boardPaths()
        return [
          { label: tt('Новая доска', 'New board'), icon: '+', action: () => void createBoard() },
          ...(paths.length ? [{ sep: true }] : []),
          ...paths.map((p) => ({ label: p.includes('/') ? `${nameOf(p)}  ·  ${p.slice(0, p.lastIndexOf('/'))}` : nameOf(p), checked: p === path, action: () => void controller?.open(p) }))
        ]
      }
      /** The keys of the board, in one window ("⋯ → Keys" and "?"). */
      const KEYS = () => [
        [tt('Блоки', 'Blocks'), [['T', tt('Карточка', 'Card')], ['S', tt('Стикер', 'Sticky note')], ['N', tt('Заметка из хранилища', 'Note from the vault')], ['F', tt('Рамка', 'Frame')], [tt('Двойной щелчок', 'Double click'), tt('Карточка в этом месте', 'A card at this place')], ['Enter', tt('Править текст / открыть', 'Edit the text / open')]]],
        [tt('Инструменты', 'Tools'), [['V', tt('Выбор', 'Select')], ['H', tt('Рука', 'Hand')], ['A', tt('Стрелка', 'Arrow')], [tt('Пробел + перетаскивание', 'Space + drag'), tt('Двигать поле', 'Move the field')], ['Esc', tt('Снять выделение, выйти из инструмента', 'Clear the choice, leave the tool')]]],
        [tt('Правка', 'Editing'), [['Ctrl+Z / Ctrl+Y', tt('Отменить / повторить', 'Undo / redo')], ['Ctrl+C / X / V', tt('Копировать / вырезать / вставить', 'Copy / cut / paste')], ['Ctrl+Shift+D', tt('Дублировать', 'Duplicate')], ['Ctrl+G', tt('Обернуть в рамку', 'Wrap in a frame')], ['Delete', tt('Удалить', 'Delete')], [tt('Стрелки', 'Arrow keys'), tt('Сдвинуть на шаг сетки (Shift — крупно, Alt — на пиксель)', 'Move by a step of the grid (Shift: big, Alt: a pixel)')], ['Tab', tt('К следующему блоку', 'To the next block')], [tt('Ctrl + перетаскивание', 'Ctrl + drag'), tt('Угол и размер — ровно по сетке', 'The corner and the size even on the grid')], [tt('Alt во время перетаскивания', 'Alt while dragging'), tt('Без привязки к сетке', 'Without snapping to the grid')], [tt('Alt + перетаскивание', 'Alt + drag'), tt('Копия блока', 'A copy of the block')]]],
        [tt('Вид', 'View'), [[tt('Колесо', 'Wheel'), tt('Прокрутка (Shift — вбок)', 'Scroll (Shift: sideways)')], [tt('Ctrl + колесо', 'Ctrl + wheel'), tt('Масштаб', 'Zoom')], ['Shift+1', tt('Вписать всё', 'Fit everything')], ['Shift+2', tt('К выделенному', 'To the selection')], ['Shift+0', '100%'], ['Ctrl+F', tt('Найти на доске', 'Find on the board')], ['?', tt('Это окно', 'This window')]]]
      ]
      const showKeys = () => {
        const r = canvas.getBoundingClientRect()
        api.ui.popup({
          x: r.left + r.width / 2 - 260,
          y: r.top + 40,
          mount: (box) => {
            box.classList.add('bd-keys')
            box.append(el('div', { className: 'bd-keys-title', textContent: tt('Горячие клавиши доски', 'Keys of the board') }))
            const grid = el('div', { className: 'bd-keys-grid' })
            for (const [head, rows] of KEYS()) {
              const col = el('div', { className: 'bd-keys-col' }, [el('div', { className: 'bd-keys-head', textContent: head })])
              for (const [k, what] of rows) col.append(el('div', { className: 'bd-keys-row' }, [el('kbd', { textContent: k }), el('span', { textContent: what })]))
              grid.append(col)
            }
            box.append(grid, el('div', { className: 'bd-keys-foot', textContent: tt('Заметки и файлы можно перетащить на доску из дерева файлов.', 'Notes and files can be dragged onto the board from the file tree.') }))
          }
        })
      }
      const wheelZooms = () => !!data().wheelZoom
      const viewMenu = () => [
        {
          label: tt('Колесо мыши', 'The mouse wheel'),
          children: [
            { label: tt('Прокручивает (Ctrl — масштаб)', 'Scrolls (Ctrl zooms)'), checked: !wheelZooms(), action: () => api.data.set({ ...data(), wheelZoom: false }) },
            { label: tt('Масштабирует, как в Miro', 'Zooms, as in Miro'), checked: wheelZooms(), action: () => api.data.set({ ...data(), wheelZoom: true }) }
          ]
        },
        {
          label: tt('Сетка', 'Grid'),
          children: [
            { label: tt('Точки', 'Dots'), checked: board.settings.grid === 'dots', action: () => setSetting('grid', 'dots') },
            { label: tt('Линии', 'Lines'), checked: board.settings.grid === 'lines', action: () => setSetting('grid', 'lines') },
            { label: tt('Без сетки', 'None'), checked: board.settings.grid === 'none', action: () => setSetting('grid', 'none') }
          ]
        },
        { label: tt('Привязка к сетке', 'Snap to the grid'), hint: tt('Alt — без неё', 'Alt: without'), checked: snapOn(), action: () => setSnap(!snapOn()) },
        { label: tt('Направляющие по краям карточек', 'Guides to the edges of cards'), checked: board.settings.guides !== false, action: () => setSetting('guides', board.settings.guides === false) },
        { label: tt('Мини-карта', 'Minimap'), checked: !miniBox.hidden, action: () => setSetting('minimap', miniBox.hidden) }
      ]
      const setSetting = (key, value) => {
        board.settings[key] = value
        applyView()
        changed()
      }

      // the menu of an empty place: what to put here, and the board as a whole
      const canvasMenu = (at) => [
        { label: tt('Вставить', 'Paste'), hint: 'Ctrl+V', action: () => void pasteHere(at) },
        { label: tt('Добавить блок', 'Add a block'), children: addItems(at) },
        { sep: true },
        { label: tt('Выбрать всё', 'Select all'), hint: 'Ctrl+A', disabled: !board.cards.length, action: () => setSel(board.cards.map((c) => c.id)) },
        { label: tt('Вписать всё', 'Fit everything'), hint: 'Shift+1', action: () => fit() }
      ]

      const toMarkdown = () => {
        const lines = [`# ${nameOf(path)}`, '']
        const label = (c) =>
          c.type === 'note' ? `[[${nameOf(c.note)}]]` : c.type === 'link' ? `[${c.text || hostOf(c.url)}](${c.url})` : c.type === 'image' ? `![[${nameOf(c.src)}]]` : c.type === 'file' ? `[[${c.src.split('/').pop()}]]` : (c.text ?? '').replace(/\n+/g, ' ').trim() || '…'
        const frames = board.cards.filter((c) => c.type === 'frame')
        const inFrame = new Set()
        for (const f of frames) {
          lines.push(`## ${f.text || tt('Рамка', 'Frame')}`, '')
          for (const m of membersOf(f).filter((c) => c.type !== 'frame').sort((a, b) => a.y - b.y || a.x - b.x)) {
            inFrame.add(m.id)
            lines.push(m.type === 'todo' ? (m.text ?? '').split('\n').map((l) => '- ' + (l || '[ ]')).join('\n') : `- ${label(m)}`)
          }
          lines.push('')
        }
        const rest = board.cards.filter((c) => c.type !== 'frame' && !inFrame.has(c.id)).sort((a, b) => a.y - b.y || a.x - b.x)
        if (rest.length) {
          if (frames.length) lines.push(`## ${tt('Остальное', 'The rest')}`, '')
          for (const c of rest) lines.push(c.type === 'todo' ? (c.text ?? '').split('\n').map((l) => '- ' + (l || '[ ]')).join('\n') : `- ${label(c)}`)
          lines.push('')
        }
        if (board.links.length) {
          lines.push(`## ${tt('Связи', 'Links')}`, '')
          for (const l of board.links) {
            const a = byId(l.from)
            const b = byId(l.to)
            if (a && b) lines.push(`- ${label(a)} ${l.head === 'none' ? '—' : l.head === 'both' ? '↔' : '→'} ${label(b)}${l.label ? ` (${l.label})` : ''}`)
          }
          lines.push('')
        }
        return lines.join('\n')
      }
      const exportMenu = () => [
        {
          label: tt('Скопировать как Markdown', 'Copy as Markdown'),
          action: async () => {
            await copyText(toMarkdown())
          }
        },
        {
          label: tt('Сохранить как заметку', 'Save as a note'),
          action: async () => {
            const base = `${nameOf(path)} (${tt('конспект', 'outline')})`
            let p = base + '.md'
            for (let i = 2; await api.vault.exists(p); i++) p = `${base} ${i}.md`
            await api.vault.write(p, toMarkdown(), true)
            api.vault.open(p)
          }
        }
      ]

      /* ---------- the list of boards and their menu ---------- */
      let listed = null
      const fillSelect = () => {
        const paths = boardPaths()
        const key = paths.join('\n')
        if (key === listed) {
          if (path && paths.includes(path) && select.value !== path) select.value = path
          return paths
        }
        listed = key
        select.replaceChildren(...paths.map((p) => el('option', { value: p, textContent: nameOf(p) })))
        if (path && paths.includes(path)) select.value = path
        void paths.length
        return paths
      }
      /**
       * A new board, made at once under the default name ("Untitled", "Untitled 1"...) in this folder (the root of the
       * vault by default), opened with its name ready to be typed over - or left as it is.
       */
      /**
       * A board made under the default name and not touched since (its file is empty): it goes away by itself when the
       * user leaves it without doing anything on it (closes the tab, goes to another tab or board).
       */
      let untouched = null
      const makeDefault = async (dir = '') => {
        if (dir && !(await api.vault.exists(dir))) await files.folder(dir)
        const next = freeBoardPath(defaultName(), dir)
        // (a new board under the name of one that was renamed or deleted: its hint is shown again)
        forgetHint(next)
        // (an empty file is an empty board; only an empty file can be taken back without the recycle bin)
        await api.vault.write(next, '', true)
        toBottom(next)
        untouched = next
        return next
      }
      /** The board made and left untouched is taken away (true when it was). */
      const dropUntouched = async () => {
        const p = untouched
        untouched = null
        if (!p || p !== path || !board || board.cards.length) return false
        try {
          // (Syntex removes only a file that is still empty: nothing written is ever lost by this)
          if (sx?.fs?.discard) await sx.fs.discard(p)
          else await files.trash(p)
        } catch {
          return false
        }
        forgetHint(p)
        return true
      }
      const createBoard = async (dir = '') => {
        // (the empty board made on entering, left untouched, gives way to the new one: no second "Untitled")
        if (untouched && untouched === path) await dropUntouched()
        const next = await makeDefault(dir)
        await new Promise((r) => setTimeout(r, 200))
        fillSelect()
        await openPath(next)
        fillSelect()
        select.value = next
        editTitle()
        return next
      }
      /** Boards entered with none yet: a board under the default name is made at once (as in Obsidian). */
      let entering = false
      const enterEmpty = async () => {
        if (entering || path || (board && board.cards.length)) return
        entering = true
        try {
          const next = await makeDefault()
          await new Promise((r) => setTimeout(r, 200))
          fillSelect()
          await openPath(next)
          fillSelect()
          select.value = next
        } finally {
          entering = false
        }
      }
      const boardMenu = () => [
        { label: tt('Новая доска', 'New board'), action: () => void createBoard() },
        { sep: true },
        { label: tt('Переименовать', 'Rename'), action: () => editTitle() },
        {
          label: tt('Дублировать доску', 'Duplicate the board'),
          disabled: !path,
          action: async () => {
            await write()
            const copy = await files.duplicate(path)
            await new Promise((r) => setTimeout(r, 300))
            fillSelect()
            await openPath(copy)
            select.value = copy
            // (the copy's title line says its own name)
            dirty = true
            await write()
          }
        },
        { label: tt('Показать в проводнике', 'Show in Explorer'), disabled: !path, action: () => void files.reveal(path) },
        { label: tt('Экспорт', 'Export'), disabled: !board, children: exportMenu() },
        { label: tt('Горячие клавиши', 'Keys'), hint: '?', action: () => showKeys() },
        { sep: true },
        {
          label: tt('Удалить доску…', 'Delete the board…'),
          danger: true,
          disabled: !path,
          action: async () => {
            if (!(await api.ui.confirm(tt('Удалить доску', 'Delete the board'), tt(`«${nameOf(path)}» уйдёт в корзину.`, `"${nameOf(path)}" goes to the recycle bin.`), tt('Удалить', 'Delete')))) return
            dirty = false
            const gone = path
            await files.trash(gone)
            const d = data()
            if (d.views?.[gone]) {
              const views = { ...d.views }
              delete views[gone]
              api.data.set({ ...d, views })
            }
            await new Promise((r) => setTimeout(r, 400))
            const left = fillSelect().filter((p) => p !== gone)
            await openPath(left[0] ?? '')
            fillSelect()
          }
        }
      ]

      /** A card of a file of the vault: a note with its preview, a picture as it is, any other file as a card of it. */
      const addPath = async (p, at, snap = false) => {
        if (/\.md$/i.test(p)) return addCard({ type: 'note', note: p }, at, false, snap)
        if (IMAGE.test(p)) {
          const dims = await new Promise((resolve) => {
            const img = new Image()
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = () => resolve({ w: 264, h: 180 })
            img.src = urlOf(p)
          })
          // (a tiny picture is shown big enough to be seen and taken)
          const w = clamp(dims.w || 264, 96, 336)
          return addCard({ type: 'image', src: p, w, h: clamp(Math.round((w * (dims.h || 180)) / (dims.w || 264)), 48, 1200) }, at, false, snap)
        }
        return addCard({ type: 'file', src: p }, at, false, snap)
      }
      /** "Picture or file": a file of the vault (pictures first), or one from the computer. */
      const pickFile = (at, snap = false) => {
        const p = at ? toScreen(at.x, at.y) : (() => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2 - 130, y: r.top + 90 } })()
        api.ui.popup({
          x: p.x,
          y: p.y,
          mount: (box, close) => {
            const input = el('input', { className: 'bd-find', placeholder: tt('Найти картинку или файл…', 'Find a picture or a file…'), spellcheck: false })
            const list = el('div', { className: 'bd-found' })
            const all = api.vault
              .listFiles()
              .filter((f) => !/\.(md|board)$/i.test(f))
              .sort((a, b) => (IMAGE.test(b) ? 1 : 0) - (IMAGE.test(a) ? 1 : 0) || a.localeCompare(b, undefined, { numeric: true }))
            const render = () => {
              const q = input.value.trim().toLowerCase()
              const found = all.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 40)
              const disk = el('button', { className: 'bd-found-row bd-found-disk', textContent: tt('Картинка с компьютера…', 'A picture from the computer…') })
              disk.onclick = () => {
                close()
                pickImages(at)
              }
              list.replaceChildren(
                ...found.map((n) => {
                  const b = el('button', { className: 'bd-found-row', textContent: n, title: n })
                  b.onclick = () => {
                    close()
                    void addPath(n, at, snap)
                  }
                  return b
                }),
                ...(found.length ? [] : [el('div', { className: 'bd-found-none', textContent: tt('В хранилище ничего не найдено', 'Nothing found in the vault') })]),
                disk
              )
            }
            input.oninput = render
            input.onkeydown = (e) => {
              if (e.key === 'Enter') list.firstChild?.click?.()
            }
            box.append(input, list)
            render()
            requestAnimationFrame(() => input.focus())
          }
        })
      }

      /* ---------- picking a note ---------- */
      const pickNote = (at, snap = false, then = null) => {
        const p = at ? toScreen(at.x, at.y) : (() => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2 - 130, y: r.top + 90 } })()
        api.ui.popup({
          x: p.x,
          y: p.y,
          mount: (box, close) => {
            const input = el('input', { className: 'bd-find', placeholder: tt('Найти заметку…', 'Find a note…'), spellcheck: false })
            const list = el('div', { className: 'bd-found' })
            const render = () => {
              const q = input.value.trim().toLowerCase()
              const found = api.vault
                .list()
                .filter((n) => !q || n.toLowerCase().includes(q))
                .slice(0, 40)
              list.replaceChildren(
                ...(found.length
                  ? found.map((n) => {
                      const b = el('button', { className: 'bd-found-row', textContent: n.replace(/\.md$/i, '') })
                      b.onclick = () => {
                        close()
                        const made = addCard({ type: 'note', note: n }, at, false, snap)
                        then?.(made)
                      }
                      return b
                    })
                  : [el('div', { className: 'bd-found-none', textContent: tt('Ничего не найдено', 'Nothing found') })])
              )
            }
            input.oninput = render
            input.onkeydown = (e) => {
              // (a handler that returns false stops the key: only Enter does something here, every other key types)
              if (e.key === 'Enter') list.firstChild?.click?.()
            }
            box.append(input, list)
            render()
            requestAnimationFrame(() => input.focus())
          }
        })
      }

      /* ====================================================================== the canvas */

      let mouseInside = false
      canvas.addEventListener('pointerenter', () => (mouseInside = true))
      canvas.addEventListener('pointerleave', () => (mouseInside = false))
      canvas.addEventListener('pointermove', (e) => {
        if (!board) return
        mouseInside = true
        mouse = toWorld(e.clientX, e.clientY)
        if (arrowMode) arrowModeTo(mouse)
      })

      canvas.addEventListener('pointerdown', (e) => {
        if (!board || e.target.closest('.bd-float, .bd-zoombox, .bd-mini, .bd-search, .bd-dock, .bd-shapes, .bd-minibox, .bd-hint-btn, .bd-label-edit')) return
        // (a press anywhere else on the field folds the panel of shapes)
        if (!shapesPanel.hidden) toggleShapes(false)
        canvas.focus()
        if (arrowMode) {
          // a click on a card is handled by the card; here it was an empty place
          if (e.target.closest('.bd-card')) return
          const from = arrowMode.from
          stopArrowMode()
          const p = toWorld(e.clientX, e.clientY)
          arrowToEmpty(from, sideToward(from, p), p)
          return
        }
        const handle = e.target.closest('.bd-wp, .bd-end')
        if (handle && e.button === 0 && !broken) {
          e.stopPropagation()
          const l = board.links.find((x) => x.id === handle.dataset.link)
          if (!l) return
          if (handle.classList.contains('bd-wp')) bendDown(e, l, Number(handle.dataset.i), handle)
          else endDown(e, l, handle.dataset.end)
          return
        }
        // the label of an arrow is dragged along it, or off it (as in draw.io)
        const onLabel = e.target.closest('.bd-label')
        if (onLabel && e.button === 0 && !broken && !spaceDown && tool !== 'hand') {
          e.stopPropagation()
          const l = board.links.find((x) => x.id === onLabel.closest('.bd-link')?.dataset.id)
          if (l) labelDown(e, l)
          return
        }
        const onLink = e.target.closest('.bd-link')
        if (onLink && e.button === 0) {
          e.stopPropagation()
          const l = board.links.find((x) => x.id === onLink.dataset.id)
          if (l && !broken && !spaceDown && tool !== 'hand') linkDown(e, l)
          else setSel([], onLink.dataset.id)
          return
        }
        const pan = e.button === 1 || (e.button === 0 && (spaceDown || tool === 'hand'))
        if (e.button !== 0 && !pan) return
        if (pan) {
          e.preventDefault()
          const from = { x: e.clientX, y: e.clientY, vx: board.view.x, vy: board.view.y }
          canvas.setPointerCapture(e.pointerId)
          canvas.classList.add('panning')
          const move = (ev) => {
            board.view.x = from.vx + ev.clientX - from.x
            board.view.y = from.vy + ev.clientY - from.y
            applyView()
          }
          const up = () => {
            canvas.removeEventListener('pointermove', move)
            canvas.removeEventListener('pointerup', up)
            canvas.removeEventListener('pointercancel', up)
            canvas.classList.remove('panning')
            saveView()
          }
          canvas.addEventListener('pointermove', move)
          canvas.addEventListener('pointerup', up)
          canvas.addEventListener('pointercancel', up)
          return
        }
        // a frame dragged over an empty place: the cards in it are chosen
        const add = e.shiftKey || e.ctrlKey || e.metaKey
        const before = new Set(sel)
        if (!add) setSel([])
        const r = canvas.getBoundingClientRect()
        const from = { x: e.clientX - r.left, y: e.clientY - r.top }
        canvas.setPointerCapture(e.pointerId)
        let moved = false
        const move = (ev) => {
          const x = ev.clientX - r.left
          const y = ev.clientY - r.top
          if (!moved && Math.hypot(x - from.x, y - from.y) < 4) return
          moved = true
          band.hidden = false
          Object.assign(band.style, { left: Math.min(x, from.x) + 'px', top: Math.min(y, from.y) + 'px', width: Math.abs(x - from.x) + 'px', height: Math.abs(y - from.y) + 'px' })
          const a = toWorld(r.left + Math.min(x, from.x), r.top + Math.min(y, from.y))
          const b = toWorld(r.left + Math.max(x, from.x), r.top + Math.max(y, from.y))
          const inside = board.cards.filter((c) => {
            const q = rectOf(c)
            // a frame is chosen only when the band takes all of it; the rest when the band touches them
            return c.type === 'frame' ? q.x >= a.x && q.y >= a.y && q.x + q.w <= b.x && q.y + q.h <= b.y : q.x < b.x && q.x + q.w > a.x && q.y < b.y && q.y + q.h > a.y
          })
          sel = new Set([...(add ? before : []), ...inside.map((c) => c.id)])
          for (const [id, node] of cardEls) node.classList.toggle('on', sel.has(id))
        }
        const up = () => {
          canvas.removeEventListener('pointermove', move)
          canvas.removeEventListener('pointerup', up)
          canvas.removeEventListener('pointercancel', up)
          band.hidden = true
          refreshSel()
        }
        canvas.addEventListener('pointermove', move)
        canvas.addEventListener('pointerup', up)
        canvas.addEventListener('pointercancel', up)
      })

      canvas.addEventListener(
        'wheel',
        (e) => {
          if (!board) return
          e.preventDefault()
          const r = canvas.getBoundingClientRect()
          // the wheel scrolls (Shift: sideways); Ctrl+wheel and the pinch of a touchpad (it comes as Ctrl+wheel)
          // zoom to the mouse. "Zooms, as in Miro" in the View menu turns the plain wheel into the zoom.
          const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1
          if (e.ctrlKey || e.metaKey || (wheelZooms() && !e.shiftKey)) {
            // (a pinch gives small steps, a wheel big ones)
            const f = Math.exp(-e.deltaY * unit * (Math.abs(e.deltaY * unit) < 50 ? 0.01 : 0.0015))
            zoomAt(e.clientX - r.left, e.clientY - r.top, board.view.k * f)
            return
          }
          if (e.shiftKey && !e.deltaX) board.view.x -= e.deltaY * unit
          else {
            board.view.x -= e.deltaX * unit
            board.view.y -= e.deltaY * unit
          }
          applyView()
          saveView()
        },
        { passive: false }
      )

      canvas.addEventListener('dblclick', (e) => {
        if (!board || broken || e.target.closest('.bd-card, .bd-float, .bd-zoombox, .bd-mini, .bd-search, .bd-dock, .bd-shapes, .bd-minibox, .bd-hint-btn, .bd-label-edit')) return
        // a double click on a bend point takes it away
        const wp = e.target.closest('.bd-wp')
        if (wp) {
          const link = board.links.find((x) => x.id === wp.dataset.link)
          if (link) removeBend(link, Number(wp.dataset.i))
          return
        }
        const l = e.target.closest('.bd-link')
        if (l) {
          clearTimeout(clickBend)
          clickBend = null
          const link = board.links.find((x) => x.id === l.dataset.id)
          if (link) void editLabel(link)
          return
        }
        if (e.target.closest('.bd-end')) return
        // (the hand only moves the board: no block made by it either)
        if (tool === 'hand' || spaceDown) return
        addCard({ type: 'text' }, toWorld(e.clientX, e.clientY), true, e.ctrlKey || e.metaKey)
      })

      canvas.addEventListener('contextmenu', (e) => {
        if (!board || e.target.closest('.bd-search, .bd-mini, .bd-dock, .bd-shapes, .bd-minibox, .bd-zoombox, .bd-hint-btn, .bd-label-edit')) return
        e.preventDefault()
        if (broken) return
        const at = toWorld(e.clientX, e.clientY)
        mouse = at
        // the menu of a bend point: take it away, or all of them
        const wpEl = e.target.closest('.bd-wp')
        if (wpEl) {
          const l = board.links.find((x) => x.id === wpEl.dataset.link)
          if (!l) return
          const i = Number(wpEl.dataset.i)
          selBend = { link: l.id, i }
          for (const g of handleLayer.querySelectorAll('.bd-wp')) g.classList.toggle('on', g === wpEl)
          showMenu(e.clientX, e.clientY, [
            { label: tt('Убрать точку', 'Remove the point'), hint: tt('Del · двойной щелчок', 'Del · double click'), action: () => removeBend(l, i) },
            { label: tt('Убрать все точки изгиба', 'Remove all the bend points'), action: () => clearBends(l) }
          ])
          return
        }
        const node = e.target.closest('.bd-card')
        const linkEl = e.target.closest('.bd-link')
        if (node) {
          const card = byId(node.dataset.id)
          if (!card) return
          if (!sel.has(card.id)) setSel([card.id])
          showMenu(e.clientX, e.clientY, sel.size > 1 ? multiMenu() : cardMenu(card))
        } else if (linkEl) {
          const l = board.links.find((x) => x.id === linkEl.dataset.id)
          if (l) {
            setSel([], l.id)
            showMenu(e.clientX, e.clientY, linkMenu(l))
          }
        } else {
          // inside a frame (its middle lets clicks through to the field): the frame's menu, with "Add" for this place
          const frame = board.cards
            .filter((c) => c.type === 'frame' && at.x > c.x && at.y > c.y && at.x < c.x + sizeOf(c).w && at.y < c.y + sizeOf(c).h)
            .sort((a, b) => sizeOf(a).w * sizeOf(a).h - sizeOf(b).w * sizeOf(b).h)[0]
          if (frame) {
            setSel([frame.id])
            showMenu(e.clientX, e.clientY, [{ label: tt('Добавить сюда', 'Add here'), children: addItems(at) }, { label: tt('Вставить', 'Paste'), hint: 'Ctrl+V', action: () => void pasteHere(at) }, { sep: true }, ...cardMenu(frame)])
            return
          }
          if (sel.size) setSel([])
          showMenu(e.clientX, e.clientY, canvasMenu(at))
        }
      })

      // pictures dropped from the desktop
      canvas.addEventListener('dragover', (e) => {
        const types = e.dataTransfer?.types ?? []
        if (types.includes('Files') || types.includes('text/syntex-path')) {
          e.preventDefault()
          // (a note from the tree is put on the board, never moved: the tree keeps it)
          // (an effect the source does not allow would make the browser refuse the drop)
          if (types.includes('text/syntex-path')) e.dataTransfer.dropEffect = /copy|all|uninitialized/i.test(e.dataTransfer.effectAllowed) ? 'copy' : 'move'
          // (the field is lit while something is carried over it)
          canvas.classList.add('dropping')
        }
      })
      canvas.addEventListener('dragleave', (e) => {
        if (!canvas.contains(e.relatedTarget)) canvas.classList.remove('dropping')
      })
      canvas.addEventListener('drop', async (e) => {
        canvas.classList.remove('dropping')
        if (!board || broken) return
        // a note (or a picture) dragged from the tree: a card of it where it was let go
        const fromTree = e.dataTransfer?.getData('text/syntex-path')
        if (fromTree) {
          e.preventDefault()
          e.stopPropagation()
          const at = toWorld(e.clientX, e.clientY)
          // (a folder is no card; this board itself neither)
          if (!api.vault.listFiles().includes(fromTree)) api.ui.notice(tt('На доску можно положить файл, но не папку', 'A file can be put on the board, not a folder'))
          else if (fromTree === path) api.ui.notice(tt('Доску нельзя положить на неё саму', 'A board cannot be put on itself'))
          else await addPath(fromTree, at, e.ctrlKey || e.metaKey)
          return
        }
        const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
        if (!files.length) return
        e.preventDefault()
        const at = toWorld(e.clientX, e.clientY)
        let i = 0
        for (const f of files) await addImage(f.name || 'image.png', new Uint8Array(await f.arrayBuffer()), { x: at.x + i++ * 30, y: at.y + i * 30 })
      })

      root.addEventListener('keydown', (e) => {
        if (!board || editing || e.target.closest('textarea, input, select')) return
        const ctrl = e.ctrlKey || e.metaKey
        const code = e.code
        if (code === 'Space') {
          e.preventDefault()
          if (!spaceDown) {
            spaceDown = true
            canvas.classList.add('hand')
          }
          return
        }
        if (ctrl && code === 'KeyA') {
          e.preventDefault()
          setSel(board.cards.map((c) => c.id))
        } else if (ctrl && code === 'KeyC') {
          e.preventDefault()
          void copySel()
        } else if (ctrl && code === 'KeyX') {
          e.preventDefault()
          void cutSel()
        } else if (ctrl && code === 'KeyV') {
          e.preventDefault()
          void pasteHere()
        } else if (ctrl && e.shiftKey && code === 'KeyD') {
          e.preventDefault()
          duplicate()
        } else if (ctrl && code === 'KeyZ') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (ctrl && code === 'KeyY') {
          e.preventDefault()
          redo()
        } else if (ctrl && code === 'KeyG') {
          e.preventDefault()
          wrapInFrame(selected())
        } else if (ctrl && code === 'KeyF') {
          e.preventDefault()
          openSearch()
        } else if (ctrl && (code === 'Equal' || code === 'NumpadAdd')) {
          e.preventDefault()
          zoomBy(1.25)
        } else if (ctrl && (code === 'Minus' || code === 'NumpadSubtract')) {
          e.preventDefault()
          zoomBy(1 / 1.25)
        } else if (ctrl && code === 'Digit0') {
          e.preventDefault()
          zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1)
        } else if (e.shiftKey && code === 'Digit1') {
          e.preventDefault()
          fit()
        } else if (e.shiftKey && code === 'Digit2') {
          e.preventDefault()
          fitSelection()
        } else if (e.shiftKey && code === 'Digit0') {
          e.preventDefault()
          zoom100()
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          // a bend point chosen: only it goes; otherwise what is chosen
          const bl = selBend && selLink === selBend.link && board.links.find((x) => x.id === selBend.link)
          if (bl && bl.pts?.[selBend.i]) removeBend(bl, selBend.i)
          else removeSelected()
        } else if (e.key === 'Escape') {
          if (!shapesPanel.hidden) toggleShapes(false)
          else if (arrowMode) stopArrowMode()
          else if (!searchBox.hidden) closeSearch()
          else if (tool !== 'select') setTool('select')
          else setSel([])
        } else if (e.key === 'Enter' && sel.size === 1 && !ctrl) {
          // Enter: the text of the chosen block (or its note, its file, its link) is opened
          e.preventDefault()
          activate(selected()[0])
        } else if (e.key === 'Tab' && board.cards.length) {
          // Tab and Shift+Tab: from block to block, in the order they were made; one out of view is brought in
          e.preventDefault()
          const list = board.cards.filter((c) => c.type !== 'frame')
          if (!list.length) return
          const at = sel.size === 1 ? list.findIndex((c) => sel.has(c.id)) : -1
          const next = list[(at + (e.shiftKey ? -1 : 1) + list.length) % list.length] ?? list[0]
          setSel([next.id])
          const r = canvas.getBoundingClientRect()
          const s = toScreen(next.x, next.y)
          const q = sizeOf(next)
          if (s.x < r.left || s.y < r.top || s.x + q.w * board.view.k > r.right || s.y + q.h * board.view.k > r.bottom) centerOn(next)
        } else if (e.key === '?' || (e.shiftKey && code === 'Slash')) {
          e.preventDefault()
          showKeys()
        } else if (e.key.startsWith('Arrow') && sel.size) {
          e.preventDefault()
          // a step of the grid (Shift: four steps; Alt: one pixel, for the fine work)
          const step = e.altKey ? 1 : e.shiftKey ? GRID * 4 : GRID
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          for (const c of withMembers(selected()).filter((x) => !x.locked)) {
            c.x += dx
            c.y += dy
            place(c)
          }
          drawLinks()
          placeFloat()
          clearTimeout(keyTimer)
          keyTimer = setTimeout(commit, 300)
        } else if (!ctrl && !e.altKey) {
          const here = mouseInside ? mouse : null
          if (code === 'KeyT') addCard({ type: 'text' }, here)
          else if (code === 'KeyS') addCard({ type: 'sticky', color: STICKY }, here)
          else if (code === 'KeyF') addCard({ type: 'frame', text: '' }, here)
          else if (code === 'KeyN') pickNote(here)
          else if (code === 'KeyA' && sel.size === 1) startArrowMode(selected()[0])
          else if (code === 'KeyA' || code === 'KeyC') toolByKey(tool === 'arrow' ? 'select' : 'arrow')
          else if (code === 'KeyH') toolByKey('hand')
          else if (code === 'KeyV') toolByKey('select')
        }
      })
      let keyTimer = null
      root.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          spaceDown = false
          canvas.classList.toggle('hand', tool === 'hand')
        }
      })
      const setTool = (t) => {
        tool = t
        canvas.classList.toggle('hand', t === 'hand' || spaceDown)
        canvas.classList.toggle('arrow-tool', t === 'arrow')
        if (t === 'arrow' && sel.size) setSel([])
        syncToolbar()
      }
      // a tool taken by a key (H, A, C: by the place of the key, so «р», «ф», «с» on the Russian layout too) says so: in
      // the hand a click no longer selects, and that must not look like the board stopped answering
      const toolByKey = (t) => {
        if (t === tool) return
        setTool(t)
        if (t === 'hand') api.ui.notice(tt('Рука: мышь двигает доску, блоки не выбираются. V или Esc — снова выбор', 'Hand: the mouse moves the board, blocks are not selected. V or Esc: back to selecting'), 4000)
        else if (t === 'arrow') api.ui.notice(tt('Стрелки: тяните от блока к блоку. V или Esc — снова выбор', 'Arrows: drag from a block to a block. V or Esc: back to selecting'), 4000)
      }
      // the space let go where the board did not hear it (the window left, a dialog came up): the hand of the space
      // never stays on by itself
      const releaseSpace = () => {
        if (!spaceDown) return
        spaceDown = false
        canvas.classList.toggle('hand', tool === 'hand')
      }
      window.addEventListener('blur', releaseSpace)
      root.addEventListener('focusout', (e) => {
        if (!root.contains(e.relatedTarget)) releaseSpace()
      })

      /* ---------- loading a board ---------- */
      const show = (text) => {
        notes.clear()
        sel = new Set()
        selLink = null
        editing = null
        arrowMode = null
        const parsed = text === null || !text.trim() ? newBoard() : parse(text)
        broken = !parsed
        board = parsed ?? newBoard()
        const seen = data().views?.[path]
        if (seen && Number.isFinite(seen.k) && Number.isFinite(seen.x) && Number.isFinite(seen.y)) board.view = { ...seen }
        miniBox.hidden = board.settings.minimap === false
        hist = { stack: [snapshot()], i: 0 }
        rebuild()
        applyView()
        // (a board opened for the first time here is shown whole)
        const fresh0 = !(seen && Number.isFinite(seen.k))
        if (fresh0 && board.cards.length && !broken) requestAnimationFrame(() => board && canvas.clientWidth && fit())
        if (broken) hint.replaceChildren(tt('Данные доски повреждены, доска не изменяется: исправьте её файл .board или создайте новую.', 'The data of this board is damaged, so it is left alone: fix its .board file or make a new board.'))
        else {
          // a short guide, as in Obsidian: how to begin and how to move about (the mouse goes through it)
          const lines = wheelZooms()
            ? [
                tt('Перетащите блок снизу или дважды щёлкните', 'Drag a block from below or double click'),
                tt('Пробел + перетаскивание — двигать поле', 'Space + drag to move the field'),
                tt('Колесо — масштаб', 'The wheel zooms'),
                tt('Стрелка: потяните от кружка на краю блока', 'An arrow: drag from the dot on the edge of a block'),
                tt('? — все горячие клавиши', '? for all the keys')
              ]
            : [
                tt('Перетащите блок снизу или дважды щёлкните', 'Drag a block from below or double click'),
                tt('Пробел + перетаскивание — двигать поле', 'Space + drag to move the field'),
                tt('Ctrl + колесо — масштаб', 'Ctrl + wheel to zoom'),
                tt('Стрелка: потяните от кружка на краю блока', 'An arrow: drag from the dot on the edge of a block'),
                tt('? — все горячие клавиши', '? for all the keys')
              ]
          hint.replaceChildren(...lines.map((t) => el('div', { className: 'bd-hint-line', textContent: t })))
        }
        hint.classList.toggle('bad', broken)
        syncHint()
        dock.hidden = broken
        toggleShapes(false)
        canvas.classList.toggle('readonly', broken)
        syncToolbar()
      }

      const openPath = async (next) => {
        if (editing) root.querySelector('.bd-edit')?.blur()
        // (going to another board from the one made on entering and left untouched: that one goes away)
        if (untouched && untouched === path && next !== path) await dropUntouched()
        await write()
        path = next
        draftName = ''
        showTitle()
        if (!path) {
          // no board yet: an empty one is shown at once, and gets its file when something is put on it
          show(null)
          if (pendingNotes.length && controller) controller.addNotes(pendingNotes.splice(0))
          return
        }
        api.data.set({ ...data(), last: path })
        try {
          const text = await api.vault.read(path)
          lastWritten = text
          show(text)
        } catch {
          show(null)
        }
        if (pendingNotes.length && controller) controller.addNotes(pendingNotes.splice(0))
      }

      /* ---------- the dock at the bottom: every tool in one place ---------- */
      // modes (choice, hand) | blocks | a shape (the last one used) and all the shapes | the arrow tool
      const shapeIcon = (id) => {
        const [w, h] = id === 'circle' ? [18, 18] : id === 'diamond' ? [24, 18] : [26, 17]
        const svg = svgEl('svg', { class: 'bd-dock-shape', viewBox: `-1 -1 ${w + 2} ${h + 2}`, width: w + 2, height: h + 2 })
        const p = shapePath(id, w, h)
        svg.append(svgEl('path', { d: p.d }))
        if (p.extra) svg.append(svgEl('path', { d: p.extra }))
        return svg
      }
      const dockItem = (id, ico, label, key, rest) => ({ id, ico, label, key, ...rest })
      const shapeItem = (s) => ({ id: 'shape-' + s.id, shape: s.id, label: tt(s.ru, s.en), props: { type: 'shape', shape: s.id } })
      const BLOCKS = [
        // (`acc`: what the hint says is added: "Drag to add a card")
        dockItem('text', 'card', tt('Карточка', 'Card'), 'T', { props: { type: 'text' }, acc: tt('карточку', 'a card') }),
        dockItem('sticky', 'sticky', tt('Стикер', 'Sticky'), 'S', { props: { type: 'sticky', color: STICKY }, acc: tt('стикер', 'a sticky note') }),
        dockItem('todo', 'todo', tt('Чек-лист', 'Checklist'), '', { props: { type: 'todo', text: '[ ] ' }, rare: true, acc: tt('чек-лист', 'a check list') }),
        dockItem('note', 'note', tt('Заметка', 'Note'), 'N', { pick: 'note', long: tt('Заметка из хранилища', 'Note from the vault'), acc: tt('заметку из хранилища', 'a note from the vault') }),
        dockItem('media', 'media', tt('Файл', 'File'), '', { pick: 'file', long: tt('Картинка или файл', 'Picture or file'), acc: tt('картинку или файл', 'a picture or a file') }),
        dockItem('frame', 'frame', tt('Рамка', 'Frame'), 'F', { props: { type: 'frame', text: '' }, rare: true, acc: tt('рамку', 'a frame') })
      ]
      let lastShape = SHAPES.some((s) => s.id === data().lastShape) ? data().lastShape : 'rect'
      /** What a thing of the dock makes, put with its middle at `at` (null: a free place in the view). */
      const dropDock = (item, at, snap) => {
        if (!board || broken) return
        if (item.shape && item.shape !== lastShape) {
          lastShape = item.shape
          api.data.set({ ...data(), lastShape })
          syncDock()
        }
        if (item.pick === 'note') pickNote(at, snap)
        else if (item.pick === 'file') pickFile(at, snap)
        else if (item.pick === 'link') void askLink(at)
        else addCard({ ...item.props }, at, true, snap)
      }
      const shapesPanel = el('div', { className: 'bd-shapes', hidden: true })
      const toggleShapes = (open = shapesPanel.hidden) => {
        shapesPanel.hidden = !open
        shapesPanel.classList.remove('dragging')
        shapesBtn.classList.toggle('on', open)
      }
      const dockDown = (e, item, b) => {
        if (e.button !== 0 || !board || broken) return
        e.preventDefault()
        e.stopPropagation()
        b.setPointerCapture(e.pointerId)
        const fromPanel = !!b.closest('.bd-shapes')
        const real = item.id === 'shape-last' ? shapeItem(SHAPES.find((s) => s.id === lastShape)) : item
        const [w, h] = real.props ? sizeFor(real.props) : real.pick === 'note' ? SIZE.note : SIZE.file
        let dragging = false
        const over = (ev) => {
          const r = canvas.getBoundingClientRect()
          const d = dock.getBoundingClientRect()
          const inDock = ev.clientX >= d.left && ev.clientX <= d.right && ev.clientY >= d.top && ev.clientY <= d.bottom
          return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom && !inDock
        }
        const move = (ev) => {
          if (!dragging) {
            if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return
            dragging = true
            // (the panel of shapes steps out of the way of the field while one of its shapes is carried)
            if (fromPanel) shapesPanel.classList.add('dragging')
            ghost.replaceChildren()
            ghost.className = 'bd-ghost' + (real.shape ? ' is-shape' : '') + (real.id === 'sticky' ? ' is-sticky' : '')
            if (real.shape) ghost.append(shapeSvg({ type: 'shape', shape: real.shape, w, h }))
            else ghost.append(el('span', { textContent: real.long ?? real.label }))
            ghost.hidden = false
            canvas.classList.add('placing')
          }
          const r = canvas.getBoundingClientRect()
          const k = board.view.k
          let p = toWorld(ev.clientX, ev.clientY)
          if (ev.ctrlKey || ev.metaKey || (snapOn() && !ev.altKey)) {
            // (on the dots: where the card will be put)
            const c = snapPt({ x: p.x - w / 2, y: p.y - h / 2 }, true)
            p = { x: c.x + w / 2, y: c.y + h / 2 }
          }
          const s = toScreen(p.x - w / 2, p.y - h / 2)
          Object.assign(ghost.style, { left: s.x - r.left + 'px', top: s.y - r.top + 'px', width: w * k + 'px', height: h * k + 'px' })
          ghost.classList.toggle('away', !over(ev))
        }
        const up = (ev) => {
          b.removeEventListener('pointermove', move)
          b.removeEventListener('pointerup', up)
          b.removeEventListener('pointercancel', up)
          ghost.hidden = true
          canvas.classList.remove('placing')
          if (fromPanel) toggleShapes(false)
          if (ev.type === 'pointercancel') return
          if (!dragging) dropDock(real, null, false)
          else if (over(ev)) dropDock(real, toWorld(ev.clientX, ev.clientY), ev.ctrlKey || ev.metaKey || (snapOn() && !ev.altKey))
        }
        b.addEventListener('pointermove', move)
        b.addEventListener('pointerup', up)
        b.addEventListener('pointercancel', up)
      }
      /** What the hint over a button of the dock says: "Drag to add a card · T". */
      const tipOf = (item) => tt('Перетащить, чтобы добавить ', 'Drag to add ') + (item.acc ?? item.label) + (item.key ? ` · ${item.key}` : '')
      // the hint over the button under the mouse (the icon is raised a little, as it is in the rail of Syntex)
      const dockTip = el('div', { className: 'bd-tip', hidden: true })
      canvas.append(dockTip)
      const showTip = (b) => {
        if (!b.dataset.hint || ghost.hidden === false) return
        dockTip.textContent = b.dataset.hint
        dockTip.hidden = false
        const r = canvas.getBoundingClientRect()
        const q = b.getBoundingClientRect()
        const w = dockTip.offsetWidth
        dockTip.style.left = clamp(q.left + q.width / 2 - r.left - w / 2, 6, Math.max(6, r.width - w - 6)) + 'px'
        // (held by its bottom, 10 px over the button: it never lands on the dock, whatever its height comes out)
        dockTip.style.top = 'auto'
        dockTip.style.bottom = r.bottom - q.top + 10 + 'px'
      }
      const hideTip = () => (dockTip.hidden = true)
      // (a press anywhere, or the wheel, takes the hint away)
      canvas.addEventListener('pointerdown', hideTip, true)
      canvas.addEventListener('wheel', hideTip, { capture: true, passive: true })
      /** A button of the dock: its icon only; what it does is said by the hint over it. */
      const toolButton = (kind, ico, tip) => {
        const b = el('button', { className: 'bd-dock-btn' })
        b.dataset.kind = kind
        b.dataset.hint = tip
        // (the hint is drawn by the board; reading aloud needs the name on the button itself)
        b.setAttribute('aria-label', tip)
        b.append(typeof ico === 'string' ? (DOCK_ICONS[ico] ? dockIcon(ico) : icon(ico)) : ico)
        b.addEventListener('pointerenter', () => showTip(b))
        b.addEventListener('pointerleave', hideTip)
        b.addEventListener('pointerdown', hideTip)
        return b
      }
      const blockButton = (item) => {
        const b = toolButton(item.id, item.shape ? shapeIcon(item.shape) : item.ico, tipOf(item))
        if (item.rare) b.classList.add('bd-rare')
        b.addEventListener('pointerdown', (e) => dockDown(e, item, b))
        return b
      }
      const rowButton = (item) => {
        const b = el('button', { className: 'bd-dock-btn bd-shape-row' })
        b.dataset.kind = item.id
        b.append(item.shape ? shapeIcon(item.shape) : icon(item.ico), el('span', { textContent: item.long ?? item.label }))
        b.addEventListener('pointerdown', (e) => dockDown(e, item, b))
        return b
      }
      const modeButton = (t, ico, label, key, tip) => {
        const b = toolButton('tool-' + t, ico, `${label} — ${tip} · ${key}`)
        b.classList.add('bd-mode')
        b.addEventListener('pointerdown', (e) => e.stopPropagation())
        b.onclick = () => board && !broken && setTool(tool === t && t !== 'select' ? 'select' : t)
        return b
      }
      const selectTool = modeButton('select', 'pointer', tt('Выбор', 'Select'), 'V', tt('выделять и двигать блоки', 'choose and move blocks'))
      const handTool = modeButton('hand', 'hand', tt('Рука', 'Hand'), 'H', tt('двигать поле', 'move the field'))
      const arrowTool = modeButton('arrow', 'arrow', tt('Стрелка', 'Arrow'), 'A', tt('потяните от блока к блоку', 'drag from one block to another'))
      const lastItem = { id: 'shape-last', label: tt('Фигура', 'Shape') }
      const shapeMain = toolButton('shape-last', shapeIcon(lastShape), '')
      shapeMain.addEventListener('pointerdown', (e) => dockDown(e, lastItem, shapeMain))
      const shapesBtn = toolButton('shapes', 'chevronUp', tt('Все фигуры блок-схем', 'All the flowchart shapes'))
      shapesBtn.classList.add('bd-dock-more')
      shapesBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
      shapesBtn.addEventListener('click', () => board && !broken && toggleShapes())
      const sep = () => el('span', { className: 'bd-dock-sep' })
      dock.append(selectTool, handTool, sep(), ...BLOCKS.map(blockButton), sep(), el('span', { className: 'bd-dock-pair' }, [shapeMain, shapesBtn]), sep(), arrowTool)
      /** The dock shows the mode in use and the last shape. */
      const syncDock = () => {
        for (const [t, b] of [['select', selectTool], ['hand', handTool], ['arrow', arrowTool]]) b.classList.toggle('on', tool === t)
        const s = SHAPES.find((x) => x.id === lastShape)
        shapeMain.dataset.hint = tipOf({ acc: tt(`фигуру «${s.ru}»`, `the shape "${s.en}"`) })
        shapeMain.firstChild.replaceWith(shapeIcon(lastShape))
      }
      shapesPanel.append(
        el('div', { className: 'bd-shapes-head', textContent: tt('Фигуры блок-схем — перетащите на доску или щёлкните', 'Flowchart shapes — drag one onto the board or click it') }),
        el('div', { className: 'bd-shapes-grid' }, SHAPES.map((s) => rowButton(shapeItem(s)))),
        el('div', { className: 'bd-shapes-head bd-shapes-more', textContent: tt('Ещё блоки', 'More blocks') }),
        el('div', { className: 'bd-shapes-grid' }, [
          ...BLOCKS.filter((b) => b.rare).map(rowButton),
          rowButton(dockItem('link', 'link', tt('Ссылка', 'Link'), '', { pick: 'link', long: tt('Ссылка на сайт', 'A web link') }))
        ])
      )
      canvas.append(shapesPanel)
      // (a wheel over the dock never moves the board; it scrolls the dock sideways when it does not fit)
      for (const box of [dock, shapesPanel]) box.addEventListener('wheel', (e) => e.stopPropagation())
      dock.addEventListener('wheel', (e) => {
        if (dock.scrollWidth > dock.clientWidth) {
          e.preventDefault()
          dock.scrollLeft += e.deltaY || e.deltaX
        }
      })
      // the dock gets narrower with the field: first the names go, then the rare blocks (they are in the panel too)
      const fitDock = () => {
        const w = canvas.clientWidth
        canvas.classList.toggle('bd-compact', w < 980)
        canvas.classList.toggle('bd-tiny', w < 700)
        // (the panel over the chosen block and the map follow the new size of the field)
        if (board && w) applyView()
        // the tab of the boards hidden (another tab in front) or shown again: a board made on entering and left
        // untouched goes away; boards entered again with none make it again
        const shown = w > 0
        if (shown === wasShown) return
        wasShown = shown
        // (after the first board is opened, and a moment later: the tab may be only passing by)
        setTimeout(() => {
          void (initDone ?? Promise.resolve()).then(() => {
            if (wasShown !== shown) return
            if (!shown && untouched && untouched === path) void dropUntouched().then((gone) => gone && openPath('').then(() => fillSelect()))
            else if (shown && !path && !boardPaths().length) void enterEmpty()
          })
        }, 0)
      }
      let wasShown = false
      let initDone = null
      const resizeWatch = new ResizeObserver(fitDock)
      resizeWatch.observe(canvas)

      /* ---------- the title: the name of the board, edited in place ---------- */
      const title = el('input', { className: 'bd-title', spellcheck: false, title: tt('Название доски (щёлкните, чтобы переименовать)', 'Name of the board (click to rename)') })
      // a quiet "Saved" by the name for a moment after each write
      const savedMark = el('span', { className: 'bd-saved', textContent: tt('Сохранено', 'Saved') })
      let savedTimer = null
      const flashSaved = () => {
        savedMark.classList.add('on')
        clearTimeout(savedTimer)
        savedTimer = setTimeout(() => savedMark.classList.remove('on'), 1600)
      }
      const defaultName = () => tt('Без названия', 'Untitled')
      let draftName = ''
      const showTitle = () => {
        title.value = path ? nameOf(path) : draftName || defaultName()
        title.dataset.path = path
      }
      const cleanName = (raw) => (raw ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/[. ]+$/, '')
      /** A free path for a board of this name in this folder: "Name", then "Name 1", "Name 2"... */
      const freeBoardPath = (name, dir = '') => {
        const taken = new Set(api.vault.listFiles().map((p) => p.toLowerCase()))
        const at = dir ? dir + '/' : ''
        let next = `${at}${name}.${EXT}`
        for (let i = 1; taken.has(next.toLowerCase()); i++) next = `${at}${name} ${i}.${EXT}`
        return next
      }
      const renameTo = async (raw) => {
        const name = cleanName(raw)
        // (a board given a name of its own is kept, empty or not)
        if (path && name && name !== nameOf(path) && untouched === path) untouched = null
        if (!path) {
          // (a board not written yet takes the name when it is)
          if (name) draftName = name
          showTitle()
          return
        }
        if (!name || name === nameOf(path)) {
          showTitle()
          return
        }
        await write()
        try {
          const was = path
          const next = await files.rename(path, name)
          path = next
          const d = data()
          const views = { ...(d.views ?? {}) }
          if (views[was]) views[next] = views[was]
          delete views[was]
          api.data.set({ ...d, last: next, views, hintsDone: movedHints(d, was, next) })
          await new Promise((r) => setTimeout(r, 300))
          fillSelect()
          select.value = next
        } catch (e) {
          api.ui.notice(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e), 6000)
        }
        showTitle()
      }
      title.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          title.blur()
        } else if (e.key === 'Escape') {
          showTitle()
          title.blur()
        }
      })
      title.addEventListener('focus', () => title.select())
      title.addEventListener('blur', () => void renameTo(title.value))
      const editTitle = () => {
        title.focus()
        title.select()
      }
      /** The board shown but not written yet gets its file (under its name) the moment something is put on it. */
      let creating = null
      const materialize = () =>
        (creating ??= (async () => {
          try {
            const next = freeBoardPath(draftName || defaultName())
            const text = serialize(nameOf(next), board)
            lastWritten = text
            written.push(text)
            await api.vault.write(next, text, true)
            toBottom(next)
            path = next
            draftName = ''
            syncHint()
            const d = data()
            api.data.set({ ...d, last: next, views: { ...(d.views ?? {}), [next]: { ...board.view } } })
            showTitle()
            setTimeout(() => fillSelect(), 300)
          } catch (e) {
            api.ui.notice(e instanceof Error ? e.message : String(e), 6000)
          } finally {
            creating = null
          }
        })())

      /* ---------- the toolbar: the board and the view only ---------- */
      const moreBtn = btn('more', (e) => menuAtButton(e, boardMenu()), tt('Меню доски', 'Board menu'), 'bd-icon')
      const viewBtn = btn(tt('Вид', 'View'), (e) => board && menuAtButton(e, viewMenu()), tt('Сетка, прилипание, колесо мыши, мини-карта', 'Grid, snapping, the mouse wheel, the minimap'), 'bd-view-btn')
      viewBtn.append(icon('chevron'))
      const findBtn = btn('search', () => board && openSearch(), tt('Найти на доске (Ctrl+F)', 'Find on the board (Ctrl+F)'), 'bd-icon')
      const syncToolbar = () => {
        undoBtn.disabled = hist.i <= 0
        redoBtn.disabled = hist.i >= hist.stack.length - 1
        for (const b of [viewBtn, findBtn]) b.disabled = !board || broken
        title.disabled = !board
        syncDock()
      }
      select.onchange = () => void openPath(select.value)
      toolbar.append(title, selectWrap, select, savedMark, moreBtn, el('span', { className: 'bd-grow' }), findBtn, viewBtn)

      /* ---------- the controller the rest of the add-on talks to ---------- */
      let knownNotes = api.vault.list().join('\n')
      controller = {
        addNotes: (paths) => {
          if (!board || broken) {
            pendingNotes.push(...paths)
            return
          }
          const known = new Set(board.cards.filter((c) => c.type === 'note').map((c) => c.note))
          for (const p of paths) if (!known.has(p)) addCard({ type: 'note', note: p }, null, false)
        },
        externalChange: async (changedPaths) => {
          // (the list of boards always: the open one may have just come under a new name)
          fillSelect()
          if (path && changedPaths.includes(path) && !dirty && !editing) {
            try {
              const text = await api.vault.read(path)
              if (text !== lastWritten && !written.includes(text) && !dirty && !editing) {
                lastWritten = text
                show(text)
              }
            } catch {
              /* the note is gone: the next switch of boards shows it */
            }
          }
          // a note that changed has a new preview; when notes came or went, every note card looks again whether its note is there
          const all = api.vault.list().join('\n')
          const listChanged = all !== knownNotes
          knownNotes = all
          for (const p of changedPaths) notes.delete(p)
          for (const c of board?.cards ?? []) if (c.type === 'note' && (listChanged || changedPaths.includes(c.note))) renderCard(c)
        },
        flush: write,
        /**
         * The board's file (or a folder above it) was renamed, moved or sent to the recycle bin in Syntex - in the tree,
         * say, not in the board's own menu: the board follows it. Otherwise the next save would write the file again
         * under its old name.
         */
        moved: (from, to) => {
          if (!path || (path !== from && !path.startsWith(from + '/'))) return
          const was = path
          if (to === null) {
            dirty = false
            clearTimeout(saveTimer)
            saveTimer = null
            path = ''
            const left = boardPaths().filter((p) => p !== was && !p.startsWith(from + '/'))
            void openPath(left[0] ?? '').then(() => fillSelect())
            return
          }
          const next = to + was.slice(from.length)
          path = next
          if (document.activeElement !== title) showTitle()
          const d = data()
          const views = { ...(d.views ?? {}) }
          if (views[was]) views[next] = views[was]
          delete views[was]
          api.data.set({ ...d, views, last: d.last === was ? next : d.last, hintsDone: movedHints(d, was, next) })
          // (the tree is read again a moment later: the list of boards follows then)
          setTimeout(() => {
            fillSelect()
            if (path === next) select.value = next
          }, 0)
        },
        open: async (p) => {
          fillSelect()
          await openPath(p)
          fillSelect()
          select.value = p
        },
        create: (dir) => void createBoard(dir)
      }

      void moving.then((moved) => moved && controller?.open(data().last && boardPaths().includes(data().last) ? data().last : boardPaths()[0] ?? '').catch(() => undefined))
      const paths = fillSelect()
      const last = data().last
      const first = pendingOpen && paths.includes(pendingOpen) ? pendingOpen : paths.includes(last) ? last : paths[0] ?? ''
      pendingOpen = null
      // (no boards yet: one is made at once, as in Obsidian; it goes away if it is left untouched)
      initDone = openPath(first).then(() => {
        fillSelect()
        if (!first && canvas.clientWidth > 0) return enterEmpty()
      })
      const onResize = () => (board ? (applyView(), undefined) : undefined)
      window.addEventListener('resize', onResize)

      return () => {
        window.removeEventListener('resize', onResize)
        window.removeEventListener('blur', releaseSpace)
        resizeWatch.disconnect()
        clearTimeout(keyTimer)
        cancelAnimationFrame(miniFrame)
        // (the tab closed: the board made on entering and left untouched goes with it)
        void dropUntouched()
        void write()
        if (controller) controller = null
      }
    }

    api.views.add({ id: 'main', title: { ru: 'Доски', en: 'Boards' }, mount: mountBoards })

    /* ====================================================================== the rest */

    api.commands.add({ id: 'open', name: { ru: 'Открыть доски', en: 'Open boards' }, keys: 'Ctrl+Alt+B', run: openBoards })
    api.commands.add({
      id: 'new',
      name: { ru: 'Новая доска', en: 'New board' },
      run: () => {
        if (controller) {
          openBoards()
          controller.create('')
        } else {
          openBoards()
          setTimeout(() => controller?.create(''), 400)
        }
      }
    })
    api.rail.add({
      id: 'open',
      title: { ru: 'Доски', en: 'Boards' },
      icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
      command: 'open',
      run: openBoards
    })
    // "Add to the board" in the menu of a note in the tree
    api.menus.file((path, isFolder) =>
      isFolder
        ? [
            {
              label: { ru: 'Новая доска здесь', en: 'New board here' },
              action: () => {
                if (controller) controller.create(path)
                else {
                  openBoards()
                  setTimeout(() => controller?.create(path), 400)
                }
              }
            }
          ]
        : !/\.md$/i.test(path)
        ? []
        : [
            {
              label: { ru: 'Добавить на доску', en: 'Add to the board' },
              action: () => {
                if (controller) controller.addNotes([path])
                else pendingNotes.push(path)
                openBoards()
              }
            }
          ]
    )
    api.events.on('vault-change', (paths) => void controller?.externalChange(paths))
    api.events.on('path-move', ({ from, to }) => {
      controller?.moved(from, to)
      // (the tab is closed: the board shown last is still found under its new name next time)
      if (!controller) {
        const d = data()
        if (d.last && (d.last === from || d.last.startsWith(from + '/'))) api.data.set({ ...d, last: to === null ? '' : to + d.last.slice(from.length) })
      }
    })
    api.onDispose(() => {
      void controller?.flush()
      controller = null
      pendingNotes = []
    })

    api.ui.addStyle(`
      .bd-root { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg-app); }
      /* (the boxes of the board have a display of their own: hidden ones must still go) */
      .bd-root [hidden] { display: none !important; }
      .bd-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
      .bd-btn { height: 30px; padding: 0 12px; }
      .bd-btn.bd-icon { padding: 0; width: 32px; font-size: 15px; }
      .bd-btn.on { background: var(--accent); color: var(--bg-app); }
      .bd-btn:disabled { opacity: .4; pointer-events: none; }
      .bd-title { height: 30px; min-width: 120px; max-width: 280px; width: 22ch; box-sizing: border-box; padding: 0 8px; border-radius: 7px; border: 1px solid transparent; background: transparent; color: var(--text); font: inherit; font-size: 14px; font-weight: 500; outline: none; text-overflow: ellipsis; }
      .bd-title:hover { background: var(--bg-hover); }
      .bd-title:focus { border-color: var(--accent); background: var(--bg-app); }
      /* (the list of boards: a narrow button with its arrow; the name is in the title before it) */
      .bd-boards { position: relative; flex: none; width: 28px; height: 30px; margin-left: -6px; border-radius: 7px; color: var(--text-3); display: flex; align-items: center; justify-content: center; }
      .bd-boards:hover { background: var(--bg-hover); color: var(--text); }
      .bd-boards::after { content: ''; position: absolute; inset: -3px -2px; }
      .bd-boards .bd-ico { width: 14px; height: 14px; }
      .bd-select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
      .bd-select option { color: var(--text); background: var(--float-bg); }
      .bd-sep { width: 1px; height: 18px; background: var(--border); }
      .bd-grow { flex: 1; }
      .bd-canvas { position: relative; flex: 1; min-height: 0; overflow: hidden; outline: none; cursor: default; touch-action: none; user-select: none; }
      .bd-canvas[data-grid='dots'] { background-image: radial-gradient(circle, var(--border-2) 1px, transparent 1px); }
      .bd-canvas[data-grid='lines'] { background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); }
      .bd-canvas.hand, .bd-canvas.panning { cursor: grab; }
      .bd-canvas.panning { cursor: grabbing; }
      .bd-canvas.arrowing { cursor: crosshair; }
      .bd-canvas.moving .bd-card { transition: none; }
      .bd-world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }
      .bd-layer { position: absolute; left: 0; top: 0; width: 0; height: 0; }
      .bd-links { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
      .bd-line { stroke: var(--text-3); stroke-width: 2; fill: none; }
      .bd-arrow-head { fill: context-stroke; }
      .bd-hit { stroke: transparent; stroke-width: calc(26px * var(--ik, 1)); fill: none; pointer-events: stroke; cursor: pointer; }
      .bd-link.on .bd-line { stroke: var(--accent); }
      /* (a label is taken by the mouse and dragged, as in draw.io) */
      .bd-links .bd-label { pointer-events: all; cursor: move; }
      .bd-link.on .bd-label { fill: var(--accent); }
      .bd-label { fill: var(--text); font-size: 13px; paint-order: stroke; stroke: var(--bg-app); stroke-width: 6px; stroke-linejoin: round; pointer-events: none; }
      .bd-temp { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 5 4; }
      .bd-guide { stroke: #f06ac0; stroke-width: 1; vector-effect: non-scaling-stroke; }
      .bd-card { position: absolute; box-sizing: border-box; background: var(--float-bg); border: 1px solid var(--border-2); border-radius: 10px; padding: 10px 12px; box-shadow: 0 2px 8px rgb(0 0 0 / .2); }
      .bd-card.colored:not(.t-sticky):not(.t-frame):not(.t-shape) { border-top: 4px solid var(--c); }
      .bd-card.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 2px 8px rgb(0 0 0 / .2); }
      .bd-ico { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex: none; display: block; margin: auto; }
      .bd-ico-dots { stroke-width: 3; }
      .bd-lock { position: absolute; right: 6px; top: 6px; width: 12px; height: 12px; opacity: .55; margin: 0; pointer-events: none; }
      .bd-link-host { display: flex; align-items: center; gap: 6px; }
      .bd-link-host .bd-ico { margin: 0; width: 14px; height: 14px; }
      .bd-body { height: 100%; overflow: hidden; }
      .bd-text { white-space: pre-wrap; word-break: break-word; color: var(--text); line-height: 1.45; }
      .t-sticky { background: var(--c); border-color: transparent; color: #1e2127; box-shadow: 0 4px 12px rgb(0 0 0 / .28); }
      .t-sticky .bd-text { color: #1e2127; font-weight: 500; }
      .t-sticky.on { box-shadow: 0 0 0 2px var(--accent), 0 4px 12px rgb(0 0 0 / .28); }
      .t-frame { background: color-mix(in srgb, var(--c, #8f96a3) 8%, transparent); border: 1.5px dashed var(--c, var(--text-3)); box-shadow: none; padding: 0; }
      .t-frame { pointer-events: none; }
      .t-frame .bd-body { overflow: visible; }
      .t-frame .bd-frame-title, .t-frame .bd-grip, .t-frame .bd-port, .t-frame .bd-edit-title { pointer-events: auto; }
      .bd-frame-title { position: absolute; left: 0; right: 0; top: -28px; height: 28px; box-sizing: border-box; cursor: move; padding: 2px 4px; color: var(--text-2); font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .t-shape { background: transparent; border: 0; box-shadow: none; padding: 0; }
      .t-shape .bd-body { position: relative; overflow: visible; }
      .bd-shape-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
      .bd-shape-fill { fill: color-mix(in srgb, var(--c, transparent) 22%, var(--float-bg)); stroke: var(--c, var(--text-3)); stroke-width: 2; stroke-linejoin: round; }
      .bd-shape-line { fill: none; stroke: var(--c, var(--text-3)); stroke-width: 2; }
      .t-shape:not(.colored) .bd-shape-fill { fill: var(--float-bg); stroke: var(--text-3); }
      .t-shape:not(.colored) .bd-shape-line { stroke: var(--text-3); }
      .t-shape.on .bd-shape-fill, .t-shape.on .bd-shape-line { stroke: var(--accent); }
      /* (a shape is shown by its own outline, chosen or not: no box around it) */
      .bd-card.t-shape.on { box-shadow: none; }
      .t-shape .bd-shape-svg { filter: drop-shadow(0 2px 6px rgb(0 0 0 / .18)); }
      .bd-shape-text { position: absolute; inset: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; }
      .bd-shape-text .bd-text { max-height: 100%; overflow: hidden; }
      .t-shape .bd-edit { text-align: center; height: auto; overflow: hidden; }
      .t-file { padding: 0 12px; }
      .bd-file { display: flex; align-items: center; gap: 10px; height: 100%; }
      .bd-file .bd-file-ico { width: 26px; height: 26px; margin: 0; color: var(--text-3); }
      .bd-file-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .bd-file-name { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bd-file-name.gone { color: var(--text-3); text-decoration: line-through; }
      .bd-file-path { color: var(--text-3); font-size: .8em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bd-file-ext { flex: none; font-size: 10px; font-weight: 600; letter-spacing: .04em; color: var(--text-3); border: 1px solid var(--border-2); border-radius: 5px; padding: 1px 5px; }
      .t-note .bd-body { display: flex; flex-direction: column; gap: 6px; }
      .bd-note-head { display: flex; align-items: center; gap: 8px; }
      .bd-note-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-weight: 500; }
      .bd-note-name.gone { color: var(--text-3); text-decoration: line-through; }
      .bd-note-excerpt { flex: 1; overflow: hidden; color: var(--text-3); font-size: .85em; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
      .bd-open { color: var(--text-3); width: 24px; height: 24px; border-radius: 6px; flex: none; }
      .bd-open:hover { background: var(--bg-hover); color: var(--text); }
      .t-image { padding: 0; overflow: hidden; background: var(--bg-panel); }
      .t-image .bd-body { overflow: hidden; }
      .bd-img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
      .bd-link-card { display: flex; flex-direction: column; gap: 4px; justify-content: center; height: 100%; }
      .bd-link-host { color: var(--accent); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bd-link-url { color: var(--text-3); font-size: .85em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bd-todo { display: flex; flex-direction: column; gap: 4px; }
      .bd-todo-row { display: flex; align-items: flex-start; gap: 8px; color: var(--text); line-height: 1.4; cursor: pointer; }
      .bd-todo-row.done span { color: var(--text-3); text-decoration: line-through; }
      .bd-todo-row input { margin-top: .3em; accent-color: var(--accent); }
      .bd-todo-empty { color: var(--text-3); font-size: .9em; }
      .bd-edit { width: 100%; height: 100%; resize: none; border: 0; outline: none; background: transparent; color: inherit; font: inherit; line-height: 1.45; user-select: text; padding: 0; }
      .bd-edit-title { height: auto; font-size: 14px; font-weight: 500; background: var(--bg-app); border: 1px solid var(--accent); border-radius: 6px; padding: 2px 6px; position: relative; }
      .t-sticky .bd-edit { color: #1e2127; }
      /* (a whole size, made as small on the screen at any zoom by a transform: a size of 14px / zoom would be rounded to
         whole pixels inside the zoomed board, its width and its height apart, and a dot would come out an oval) */
      .bd-port { position: absolute; box-sizing: border-box; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); opacity: 0; cursor: crosshair; border: 2px solid var(--bg-app); z-index: 2; transform: scale(var(--ik, 1)); }
      .bd-port.p-r { right: -9px; top: 50%; margin-top: -9px; } .bd-port.p-l { left: -9px; top: 50%; margin-top: -9px; }
      .bd-port.p-t { top: -9px; left: 50%; margin-left: -9px; } .bd-port.p-b { bottom: -9px; left: 50%; margin-left: -9px; }
      /* (an unseen ring around a dot that takes the mouse) */
      .bd-port::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; }
      .bd-card:hover .bd-port, .bd-card.on .bd-port, .bd-card.target .bd-port { opacity: 1; }
      .bd-card.target .bd-port { background: var(--text-3); }
      .bd-card.target.s-top .p-t, .bd-card.target.s-right .p-r, .bd-card.target.s-bottom .p-b, .bd-card.target.s-left .p-l { background: var(--accent); transform: scale(1.35); }
      .bd-handles { pointer-events: none; z-index: 4; }
      .bd-wp, .bd-end { pointer-events: all; cursor: move; fill: var(--bg-app); stroke: var(--accent); }
      .bd-end { fill: var(--accent); stroke: var(--bg-app); cursor: crosshair; }
      /* (the unseen circle around a handle that takes the mouse) */
      .bd-handles .bd-catch { fill: transparent; stroke: none; }
      .bd-wp:hover .bd-dot { fill: color-mix(in srgb, var(--accent) 35%, var(--bg-app)); }
      .bd-wp.on .bd-dot { fill: var(--accent); stroke: var(--bg-app); }
      .bd-end:hover .bd-dot { stroke: var(--accent); }
      .bd-line { stroke-linejoin: round; }
      .bd-dock { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 7; display: flex; align-items: center; gap: 2px; padding: 5px; max-width: calc(100% - 420px); overflow-x: auto; scrollbar-width: none;
        border-radius: 11px; background: var(--float-bg); border: 1px solid var(--border-2); box-shadow: 0 6px 20px rgb(0 0 0 / .3); }
      .bd-dock::-webkit-scrollbar { display: none; }
      .bd-dock-btn { flex: none; width: 36px; height: 36px; border-radius: 8px; color: var(--text-2); cursor: grab; display: flex; align-items: center; justify-content: center; touch-action: none; }
      .bd-dock-btn:hover { background: var(--bg-hover); color: var(--text); }
      .bd-dock-btn .bd-ico { width: 20px; height: 20px; }
      .bd-dock-shape { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; overflow: visible; }
      .bd-dock-sep { flex: none; width: 1px; height: 22px; margin: 0 4px; background: var(--border); }
      .bd-dock-btn.bd-dock-more { width: auto; gap: 5px; padding: 0 8px 0 9px; margin-left: 2px; cursor: pointer; font-size: 13px; }
      .bd-dock-btn.bd-dock-more .bd-ico:last-child { width: 14px; height: 14px; color: var(--text-3); transition: transform .15s; }
      .bd-dock-btn.bd-dock-more.on { background: var(--bg-hover); color: var(--text); }
      .bd-dock-btn.bd-dock-more.on .bd-ico:last-child { transform: rotate(180deg); }
      @media (max-width: 1000px) { .bd-dock-more-label { display: none; } }
      @media (max-width: 900px) { .bd-dock { max-width: calc(100% - 140px); } }
      .bd-shapes { position: absolute; left: 50%; bottom: 74px; transform: translateX(-50%); z-index: 12; box-sizing: border-box; width: min(560px, calc(100% - 32px)); max-height: calc(100% - 90px); overflow-y: auto;
        padding: 10px; border-radius: 12px; background: var(--float-bg); border: 1px solid var(--border-2); box-shadow: 0 10px 30px rgb(0 0 0 / .35); }
      .bd-shapes.dragging { opacity: 0; pointer-events: none; }
      .bd-shapes-head { color: var(--text-3); font-size: 12px; padding: 0 4px 8px; }
      .bd-shapes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 2px; }
      .bd-dock-btn.bd-shape-row { width: auto; height: 38px; justify-content: flex-start; gap: 10px; padding: 0 10px; font-size: 13px; text-align: left; }
      .bd-shape-row .bd-dock-shape { flex: none; width: 30px; }
      .bd-shape-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bd-ghost { position: absolute; z-index: 9; box-sizing: border-box; pointer-events: none; border-radius: 10px; border: 1.5px dashed var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent);
        display: flex; align-items: center; justify-content: center; color: var(--text-2); font-size: 13px; overflow: visible; }
      .bd-ghost.is-sticky { background: color-mix(in srgb, ${STICKY} 45%, transparent); }
      .bd-ghost.is-shape { border: 0; background: none; }
      .bd-ghost.is-shape .bd-shape-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
      .bd-ghost.is-shape .bd-shape-fill { fill: color-mix(in srgb, var(--accent) 10%, transparent); stroke: var(--accent); stroke-dasharray: 5 4; }
      .bd-ghost.is-shape .bd-shape-line { stroke: var(--accent); }
      .bd-ghost.away { opacity: .35; }
      .bd-canvas.placing { cursor: copy; }
      .bd-card.locked .bd-port, .bd-card.locked .bd-grip { display: none; }
      .bd-grip { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; opacity: 0; z-index: 2;
        background: linear-gradient(135deg, transparent 50%, var(--text-3) 50%, var(--text-3) 58%, transparent 58%, transparent 72%, var(--text-3) 72%, var(--text-3) 80%, transparent 80%); }
      .bd-card:hover .bd-grip, .bd-card.on .bd-grip { opacity: .7; }
      .bd-canvas.searching .bd-card:not(.hit) { opacity: .25; }
      .bd-card.hit { box-shadow: 0 0 0 2px #fdd663; }
      .bd-band { position: absolute; border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); pointer-events: none; z-index: 5; }
      .bd-hint { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: min(560px, calc(100% - 48px)); box-sizing: border-box; padding: 14px 22px; border-radius: 10px; white-space: pre-line;
        text-align: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, transparent); font-size: 14px; line-height: 1.75; pointer-events: none; }
      .bd-hint.bad { color: var(--text-2); background: var(--float-bg); }
      .bd-canvas.readonly .bd-card { opacity: .6; }
      .bd-float { position: absolute; z-index: 10; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 10px; background: var(--float-bg); border: 1px solid var(--border-2); box-shadow: 0 6px 20px rgb(0 0 0 / .35); }
      .bd-fbtn { min-width: 28px; height: 28px; border-radius: 6px; color: var(--text-2); font-size: 14px; }
      .bd-fbtn:hover { background: var(--bg-hover); color: var(--text); }
      .bd-fcolor::before { content: ''; display: block; width: 16px; height: 16px; margin: auto; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1.5px var(--text-3); }
      .bd-zoombox { position: absolute; left: 12px; bottom: 12px; z-index: 6; display: flex; align-items: center; border-radius: 9px; background: var(--float-bg); border: 1px solid var(--border-2); overflow: hidden; }
      .bd-zoombox button { height: 30px; min-width: 30px; padding: 0 6px; color: var(--text-2); font-size: 15px; }
      .bd-zoombox button:hover { background: var(--bg-hover); color: var(--text); }
      .bd-zoom-label { font-size: 12px !important; min-width: 48px !important; }
      .bd-mini { position: absolute; right: 12px; bottom: 12px; z-index: 6; width: 180px; height: 120px; border-radius: 9px; background: var(--float-bg); border: 1px solid var(--border-2); cursor: pointer; }
      .bd-search { position: absolute; right: 12px; top: 12px; z-index: 8; display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; border-radius: 9px; background: var(--float-bg); border: 1px solid var(--border-2); }
      .bd-search input { width: 190px; height: 26px; border: 0; outline: 0; background: transparent; color: var(--text); }
      .bd-search-count { color: var(--text-3); font-size: 12px; min-width: 30px; text-align: right; }
      .bd-search button { width: 24px; height: 24px; border-radius: 6px; color: var(--text-3); }
      .bd-menu { padding: 5px; min-width: 210px; }
      .bd-m { display: flex; flex-direction: column; }
      .bd-m-item { position: relative; }
      .bd-m-row { display: flex; align-items: center; gap: 4px; width: 100%; padding: 6px 10px 6px 6px; border-radius: 6px; font-size: 13px; color: var(--text-2); text-align: left; }
      .bd-m-item:hover > .bd-m-row { background: var(--bg-hover); color: var(--text); }
      .bd-m-item.danger > .bd-m-row { color: var(--danger-text); }
      .bd-m-item.disabled > .bd-m-row { opacity: .4; }
      .bd-m-check { width: 18px; text-align: center; color: var(--accent); flex: none; }
      .bd-m-label { flex: 1; white-space: nowrap; }
      .bd-m-hint { color: var(--text-3); font-size: 11px; margin-left: 18px; white-space: nowrap; }
      .bd-m-sep { height: 1px; margin: 5px 4px; background: var(--border); }
      .bd-m-colors { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 10px; max-width: 220px; }
      .bd-m-sub { display: none; position: absolute; left: calc(100% - 2px); top: -6px; padding: 5px; min-width: 200px; border-radius: 10px; background: var(--float-bg); border: 1px solid var(--border-2); box-shadow: 0 10px 30px rgba(0,0,0,.35); z-index: 3; }
      .bd-m-sub.flip { left: auto; right: calc(100% - 2px); }
      .bd-m-sub.up { top: auto; bottom: -6px; }
      .bd-m-item:hover > .bd-m-sub { display: block; }
      .bd-m-item.disabled:hover > .bd-m-sub { display: none; }
      .bd-swatch { width: 20px; height: 20px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .18); }
      .bd-swatch.none { background: transparent; box-shadow: inset 0 0 0 1.5px var(--text-3); }
      .bd-swatch.on { box-shadow: 0 0 0 2px var(--float-bg), 0 0 0 4px var(--text-2); }
      .bd-find { width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; margin-bottom: 6px; border-radius: 7px; border: 1px solid var(--outline); background: var(--bg-app); color: var(--text); outline: none; }
      .bd-find:focus { border-color: var(--accent); }
      .bd-found { max-height: 260px; min-width: 260px; max-width: 360px; overflow-y: auto; }
      .bd-found-row { display: block; width: 100%; text-align: left; padding: 6px 10px; border-radius: 6px; font-size: 13px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bd-found-row:hover { background: var(--bg-hover); color: var(--text); }
      .bd-found-none { padding: 8px 10px; color: var(--text-3); font-size: 13px; }
      .bd-found-disk { margin-top: 4px; border-top: 1px solid var(--border); border-radius: 0 0 6px 6px; color: var(--accent); }

      /* ---- 1.5: the layout of the field (the board above, the tools below, the history and the zoom at the left, the map at the right) ---- */
      .bd-toolbar { gap: 6px; }
      /* (the title is as wide as the name, so that its arrow and the menu stay by it) */
      .bd-title { field-sizing: content; width: auto; min-width: 72px; max-width: 320px; }
      .bd-boards { width: 26px; height: 30px; margin-left: -4px; border-radius: 7px; color: var(--text-3); display: flex; align-items: center; justify-content: center; }
      .bd-boards:hover { background: var(--bg-hover); color: var(--text); }
      .bd-boards .bd-ico { width: 14px; height: 14px; }
      .bd-saved { font-size: 12px; color: var(--text-3); opacity: 0; transition: opacity .3s; pointer-events: none; white-space: nowrap; }
      .bd-saved.on { opacity: 1; transition: none; }
      .bd-view-btn { display: inline-flex; align-items: center; gap: 4px; }
      .bd-view-btn .bd-ico { width: 13px; height: 13px; margin: 0; color: var(--text-3); }

      .bd-zoombox { gap: 0; padding: 0 2px; }
      .bd-zoombox button { color: var(--text); }
      .bd-zoombox button:disabled { opacity: .35; pointer-events: none; }
      .bd-zoombox .bd-ico { width: 16px; height: 16px; }
      .bd-zoom-sep { width: 1px; height: 18px; margin: 0 3px; background: var(--border); }
      .bd-minibox { position: absolute; right: 12px; bottom: 12px; z-index: 6; }
      .bd-minibox .bd-mini { position: static; display: block; }
      .bd-minibox.fits:not(.folded):not(.held):not(:hover) { display: none; }
      .bd-mini-fold { position: absolute; right: 4px; top: 4px; width: 22px; height: 22px; border-radius: 6px; color: var(--text-3); background: var(--float-bg); opacity: 0; display: flex; align-items: center; justify-content: center; }
      .bd-minibox:hover .bd-mini-fold { opacity: 1; }
      .bd-mini-fold:hover { color: var(--text); background: var(--bg-hover); }
      .bd-mini-fold .bd-ico { width: 14px; height: 14px; }
      .bd-mini-open { display: none; width: 34px; height: 34px; border-radius: 9px; background: var(--float-bg); border: 1px solid var(--border-2); color: var(--text); align-items: center; justify-content: center; }
      .bd-mini-open:hover { background: var(--bg-hover); }
      .bd-minibox.folded .bd-mini, .bd-minibox.folded .bd-mini-fold { display: none; }
      .bd-minibox.folded .bd-mini-open { display: flex; }

      .bd-dock { gap: 1px; padding: 4px; max-width: calc(100% - 470px); }
      .bd-dock-btn { width: auto; min-width: 44px; height: 44px; padding: 0 5px; flex-direction: column; gap: 2px; color: var(--text); cursor: grab; }
      .bd-dock-btn .bd-ico { width: 18px; height: 18px; margin: 0; }
      .bd-dock-btn .bd-dock-shape { height: 18px; width: auto; }
      .bd-dock-label { font-size: 10px; line-height: 1; color: var(--text-2); white-space: nowrap; }
      .bd-dock-btn:hover .bd-dock-label { color: var(--text); }
      .bd-dock-btn.bd-mode { cursor: pointer; }
      .bd-dock-btn.on { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
      .bd-dock-btn.on .bd-dock-label { color: var(--accent); }
      .bd-dock-pair { display: flex; align-items: stretch; }
      .bd-dock-btn.bd-dock-more { min-width: 20px; width: 20px; padding: 0; margin: 0; cursor: pointer; }
      .bd-dock-btn.bd-dock-more .bd-ico { width: 14px; height: 14px; color: var(--text-2); }
      .bd-dock-btn.bd-dock-more.on { background: var(--bg-hover); }
      .bd-dock-sep { height: 30px; margin: 0 3px; }
      .bd-shapes-more { padding-top: 10px; }
      .bd-shapes .bd-dock-btn.bd-shape-row { flex-direction: row; height: 36px; min-width: 0; padding: 0 10px; }
      .bd-shapes .bd-dock-btn.bd-shape-row .bd-ico { width: 18px; height: 18px; }
      /* narrower: the names go; narrower still: the rare blocks go (they are in the panel of shapes), the dock goes up */
      .bd-canvas.bd-compact .bd-dock-label { display: none; }
      .bd-canvas.bd-compact .bd-dock-btn { height: 36px; min-width: 36px; }
      .bd-canvas.bd-compact .bd-dock-btn.bd-dock-more { min-width: 18px; width: 18px; }
      .bd-canvas.bd-compact .bd-dock { max-width: calc(100% - 420px); }
      .bd-canvas.bd-tiny .bd-dock .bd-rare { display: none; }
      .bd-canvas.bd-tiny .bd-dock { bottom: 56px; max-width: calc(100% - 20px); }
      .bd-canvas.bd-tiny .bd-shapes { bottom: 104px; }
      .bd-canvas.bd-tiny .bd-minibox:not(.folded) .bd-mini { width: 132px; height: 88px; }
      .bd-canvas.arrow-tool, .bd-canvas.arrow-tool .bd-card { cursor: crosshair; }
      .bd-card.target { box-shadow: 0 0 0 2px var(--accent), 0 2px 8px rgb(0 0 0 / .2); }
      .bd-card.t-shape.target { box-shadow: none; }
      .bd-card.t-shape.target .bd-shape-fill { stroke: var(--accent); }
      .bd-canvas.dropping { box-shadow: inset 0 0 0 2px var(--accent); }

      /* the panel of what is chosen */
      .bd-float { gap: 1px; padding: 3px; border-radius: 9px; }
      .bd-fbtn { width: 28px; min-width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--text); }
      .bd-fbtn { position: relative; }
      .bd-fbtn::after { content: ''; position: absolute; inset: -3px -1px; }
      .bd-fbtn .bd-ico { width: 16px; height: 16px; }
      .bd-fbtn.off { opacity: .35; }
      .bd-fsep { width: 1px; height: 18px; margin: 0 3px; background: var(--border); }
      .bd-label-edit { position: absolute; z-index: 11; transform: translate(-50%, -50%); min-width: 120px; height: 28px; box-sizing: border-box; padding: 0 8px; border-radius: 7px;
        border: 1px solid var(--accent); background: var(--bg-app); color: var(--text); font: inherit; font-size: 13px; text-align: center; outline: none; }

      /* the empty board */
      /* the hint of an empty board: a short guide in the colour of the accent, as in Obsidian; the mouse goes through it */
      .bd-hint { padding: 16px 26px; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); border: 0; box-shadow: none; border-radius: 8px; white-space: nowrap; font-size: 15px; line-height: 1.9; pointer-events: none; }
      .bd-hint.bad { white-space: normal; color: var(--text-2); background: var(--float-bg); }
      .bd-canvas.bd-tiny .bd-hint { font-size: 13px; white-space: normal; }

      /* the keys */
      .bd-keys { padding: 16px 18px; max-width: min(720px, calc(100vw - 40px)); }
      .bd-keys-title { font-weight: 600; font-size: 15px; color: var(--text); margin-bottom: 12px; }
      .bd-keys-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px 24px; }
      .bd-keys-head { color: var(--text-3); font-size: 12px; margin-bottom: 6px; }
      .bd-keys-row { display: flex; align-items: baseline; gap: 10px; font-size: 13px; color: var(--text-2); padding: 2px 0; }
      .bd-keys-row kbd { flex: none; min-width: 64px; font: inherit; font-size: 12px; color: var(--text); background: var(--bg-hover); border-radius: 5px; padding: 1px 6px; }
      .bd-keys-foot { margin-top: 12px; color: var(--text-3); font-size: 12px; }

      /* the text of cards, formatted */
      .bd-md > div { min-height: 1.45em; }
      .bd-md strong { font-weight: 600; }
      .bd-md code { font-family: var(--font-mono, monospace); font-size: .9em; background: color-mix(in srgb, var(--text) 10%, transparent); border-radius: 4px; padding: 0 3px; }
      .bd-md mark { background: color-mix(in srgb, #fdd663 55%, transparent); color: inherit; border-radius: 3px; }
      .bd-md .bd-md-h { font-weight: 600; }
      .bd-md .bd-md-h1 { font-size: 1.35em; }
      .bd-md .bd-md-h2 { font-size: 1.18em; }
      .bd-md .bd-md-li { display: flex; gap: 6px; }
      .bd-md .bd-md-dot { flex: none; color: var(--text-3); min-width: .8em; }
      .bd-md .bd-md-task.done span:last-child { color: var(--text-3); text-decoration: line-through; }
      .bd-md .bd-md-quote { border-left: 3px solid var(--border-2); padding-left: 8px; color: var(--text-2); }
      .bd-md .bd-md-gap { min-height: .6em; }
      .bd-card a { color: var(--accent); text-decoration: none; cursor: pointer; }
      .bd-card a:hover { text-decoration: underline; }
      .bd-card a.gone { color: var(--text-3); text-decoration: line-through; }
      .t-sticky .bd-md .bd-md-dot, .t-sticky .bd-md .bd-md-quote { color: #3a3d44; }
      .t-sticky a { color: #1d4ea8; }
      .bd-open { width: auto; height: 24px; padding: 0 8px; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; font-size: 12px; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
      .bd-open .bd-ico { width: 13px; height: 13px; margin: 0; }
      .bd-open:hover { color: var(--text); background: var(--bg-hover); }

      /* eight handles of the size */
      .bd-grip { background: none; opacity: 1; }
      .bd-rs { position: absolute; z-index: 2; }
      .bd-rs-n, .bd-rs-s { left: calc(12px * var(--ik, 1)); right: calc(12px * var(--ik, 1)); height: calc(10px * var(--ik, 1)); cursor: ns-resize; }
      .bd-rs-n { top: calc(-5px * var(--ik, 1)); } .bd-rs-s { bottom: calc(-5px * var(--ik, 1)); }
      .bd-rs-e, .bd-rs-w { top: calc(12px * var(--ik, 1)); bottom: calc(12px * var(--ik, 1)); width: calc(10px * var(--ik, 1)); cursor: ew-resize; }
      .bd-rs-e { right: calc(-5px * var(--ik, 1)); } .bd-rs-w { left: calc(-5px * var(--ik, 1)); }
      /* (the corners: whole squares made small by a transform, as the dots above; the frame is a shadow, not a border,
         which the browser would round down to a whole pixel) */
      .bd-rs-nw, .bd-rs-ne, .bd-rs-sw, .bd-rs-se { width: 10px; height: 10px; box-sizing: border-box; border-radius: 2px; background: var(--bg-app); box-shadow: inset 0 0 0 1.5px var(--accent); opacity: 0; transform: scale(var(--ik, 1)); }
      .bd-rs-nw::after, .bd-rs-ne::after, .bd-rs-sw::after, .bd-rs-se::after { content: ''; position: absolute; inset: -9px; }
      .bd-rs-nw { left: -5px; top: -5px; cursor: nwse-resize; } .bd-rs-se { right: -5px; bottom: -5px; cursor: nwse-resize; }
      .bd-rs-ne { right: -5px; top: -5px; cursor: nesw-resize; } .bd-rs-sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
      .bd-card.on > .bd-rs { opacity: 1; }
      .bd-card:not(.on) > .bd-rs:not(.bd-rs-se) { pointer-events: none; }
      .bd-card:hover > .bd-rs-se { opacity: .6; }
      .bd-card.locked > .bd-rs { display: none; }
      .bd-port { z-index: 3; }
      .t-frame .bd-rs { pointer-events: auto; }

      /* ---- 1.5.1: the dock as the rail of Syntex: icons only (40 px buttons, icons of 18 px, lines of 1.5 px); the
         icon under the mouse is raised and a hint over it says what it does ---- */
      .bd-dock { gap: 2px; padding: 4px; }
      .bd-dock-label { display: none !important; }
      .bd-dock .bd-dock-btn, .bd-canvas.bd-compact .bd-dock .bd-dock-btn { width: 40px; min-width: 40px; height: 40px; padding: 0; border-radius: 8px; color: var(--text-3); transition: background .1s, color .1s; }
      .bd-dock .bd-dock-btn:hover { background: var(--bg-hover); color: var(--text); }
      .bd-dock .bd-dock-btn > svg { transition: transform .14s ease-out; }
      .bd-dock .bd-dock-btn:hover > svg { transform: translateY(-3px); }
      .bd-dock .bd-dock-btn:active > svg { transform: translateY(-1px); }
      .bd-dock .bd-dock-btn .bd-ico { width: 18px; height: 18px; }
      .bd-dock .bd-dock-btn .bd-ico path, .bd-dock .bd-dock-shape path { vector-effect: non-scaling-stroke; stroke-width: 1.5px; }
      .bd-dock .bd-dock-btn .bd-ico.bd-ico-dots path { stroke-width: 3px; }
      .bd-dock .bd-dock-shape { height: 16px; width: auto; max-width: 26px; }
      .bd-dock .bd-dock-btn.on { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); }
      .bd-dock .bd-dock-btn.bd-dock-more, .bd-canvas.bd-compact .bd-dock .bd-dock-btn.bd-dock-more { width: 20px; min-width: 20px; }
      .bd-dock .bd-dock-btn.bd-dock-more .bd-ico { width: 14px; height: 14px; }
      .bd-dock .bd-dock-btn.bd-dock-more:hover > svg { transform: translateY(-2px); }
      .bd-dock-sep { height: 24px; margin: 0 4px; }
      .bd-tip { position: absolute; z-index: 13; padding: 6px 10px; border-radius: 7px; background: var(--float-bg); border: 1px solid var(--border-2); box-shadow: 0 6px 18px rgb(0 0 0 / .3);
        color: var(--text); font-size: 12.5px; white-space: nowrap; pointer-events: none; animation: bd-tip-in .12s ease-out; }
      @keyframes bd-tip-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
      .bd-canvas.bd-tiny .bd-dock { bottom: 56px; }
      .bd-canvas.bd-tiny .bd-shapes { bottom: 108px; }
      .bd-shapes { bottom: 70px; }
      /* (a narrow field: the dock goes up over the zoom, so the open map goes up over the dock) */
      .bd-canvas.bd-tiny .bd-minibox:not(.folded) { bottom: 108px; }

      /* ---- 1.5.2: the icons of the dock big and bold, in the middle of their buttons; no background under the mouse
         or on the tool in use: the icon itself rises under the mouse, and is brighter (white) when it is the one in use ---- */
      .bd-dock .bd-dock-btn, .bd-canvas.bd-compact .bd-dock .bd-dock-btn { display: grid; place-items: center; padding: 0; background: none !important; box-shadow: none; }
      .bd-dock .bd-dock-btn:active { transform: none; }
      .bd-dock .bd-dock-btn > svg { display: block; margin: 0; }
      .bd-dico { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
      .bd-dico path { stroke-width: 1.75px; vector-effect: non-scaling-stroke; }
      .bd-dock .bd-dock-shape { height: 18px; max-width: 30px; }
      .bd-dock .bd-dock-shape path { stroke-width: 1.75px; }
      .bd-dock .bd-dock-btn { color: var(--text-3); }
      .bd-dock .bd-dock-btn:hover { color: var(--text-2); }
      .bd-dock .bd-dock-btn:hover > svg { transform: translateY(-4px); }
      .bd-dock .bd-dock-btn:active > svg { transform: translateY(-2px); }
      .bd-dock .bd-dock-btn.on, .bd-dock .bd-dock-btn.on:hover { color: var(--text); }
      .bd-dock .bd-dock-btn.on .bd-dico path { stroke-width: 2px; }
      .bd-dock .bd-dock-btn.bd-dock-more .bd-dico { width: 16px; height: 16px; }
      .bd-dock .bd-dock-btn.bd-dock-more:hover > svg { transform: translateY(-3px); }
      :root[data-theme='dark'] .bd-dock .bd-dock-btn.on { color: #fff; }

      /* the snapping to the grid at the bottom left, by the zoom */
      .bd-zoombox .bd-snap { color: var(--text-3); }
      .bd-zoombox .bd-snap.on { color: var(--text); }
    `)
  }
}
