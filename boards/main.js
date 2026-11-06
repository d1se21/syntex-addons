// Boards: an interactive board in a tab of its own; each board is a file of its own kind (Boards/Name.board, its data
// as JSON), opened by a click on it in the tree. Boards of older versions (notes with a block of data) are moved to
// such files once.
// Cards of several kinds (text, sticky notes, notes of the vault with
// a preview, pictures, links, check lists, shapes, frames), arrows with labels, selection by frame or by group, undo,
// alignment, snapping, search, a minimap, and a right-click menu on everything. Each board is a note in the "Boards"
// folder (a fenced block with its data), so it lives in the vault, is backed up and synced with it.

const FOLDER = 'Boards'
const EXT = 'board'
const FENCE = 'syntex-board'
const CLIP = 'syntex-board:'
const NS = 'http://www.w3.org/2000/svg'
const GRID = 24

const COLORS = ['', '#8ab4f8', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#fcad70', '#78d9ec', '#ff8bcb']
const STICKY = '#fdd663'
const DEF = { text: [220, 110], sticky: [180, 180], note: [250, 108], image: [260, 180], link: [280, 70], frame: [560, 360], shape: [170, 110], todo: [230, 140] }
const MIN = { text: [90, 50], sticky: [90, 90], note: [150, 52], image: [60, 40], link: [160, 52], frame: [160, 100], shape: [70, 50], todo: [130, 70] }
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
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'
}
/** An icon drawn like the icons of Syntex (lines of the same width, in the colour of the text). */
const icon = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', 'bd-ico' + (name === 'more' ? ' bd-ico-dots' : ''))
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', ICONS[name])
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

const newBoard = () => ({ v: 2, cards: [], links: [], view: { x: 0, y: 0, k: 1 }, settings: { grid: 'dots', snapGrid: false, guides: true } })

const sizeOf = (c) => ({ w: c.w ?? DEF[c.type][0], h: c.h ?? DEF[c.type][1] })
const rectOf = (c) => ({ x: c.x, y: c.y, ...sizeOf(c) })
const boundsOf = (cards) => {
  const x0 = Math.min(...cards.map((c) => c.x))
  const y0 = Math.min(...cards.map((c) => c.y))
  const x1 = Math.max(...cards.map((c) => c.x + sizeOf(c).w))
  const y1 = Math.max(...cards.map((c) => c.y + sizeOf(c).h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
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
  const ids = new Set(cards.map((c) => c.id))
  const links = b.links.filter((l) => l && typeof l.id === 'string' && ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
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
      const cardEls = new Map()
      // cards just made and being written for the first time: left empty, they are taken back
      const fresh = new Set()
      const notes = new Map() // vault path -> { title, excerpt }

      /* ---------- the frame of the tab ---------- */
      const select = el('select', { className: 'bd-select' })
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
      const guides = svgEl('svg', { class: 'bd-links bd-guides', width: 1, height: 1 })
      world.append(frameLayer, links, cardLayer, guides)
      const band = el('div', { className: 'bd-band', hidden: true })
      const hint = el('div', { className: 'bd-hint' })
      const floatBar = el('div', { className: 'bd-float', hidden: true })
      const zoomLabel = el('button', { className: 'bd-zoom-label', title: '100%' })
      const zoomBox = el('div', { className: 'bd-zoombox' }, [
        el('button', { textContent: '−', title: tt('Уменьшить', 'Zoom out'), onclick: () => zoomBy(1 / 1.25) }),
        zoomLabel,
        el('button', { textContent: '+', title: tt('Увеличить', 'Zoom in'), onclick: () => zoomBy(1.25) }),
        el('button', { title: tt('Вписать всё (Shift+1)', 'Fit everything (Shift+1)'), onclick: () => fit() }, [icon('fit')])
      ])
      const mini = el('canvas', { className: 'bd-mini', width: 180, height: 120 })
      const searchBox = el('div', { className: 'bd-search', hidden: true })
      const searchInput = el('input', { placeholder: tt('Найти на доске…', 'Find on the board…'), spellcheck: false })
      const searchCount = el('span', { className: 'bd-search-count' })
      searchBox.append(searchInput, searchCount, el('button', { textContent: '×', onclick: () => closeSearch() }))
      canvas.append(world, band, hint, floatBar, zoomBox, mini, searchBox)
      root.append(toolbar, canvas)
      canvas.dataset.dropFiles = ''

      /* ---------- saving and history ---------- */
      const write = async () => {
        clearTimeout(saveTimer)
        saveTimer = null
        if (!dirty || !board || broken || !path) return
        dirty = false
        const text = serialize(nameOf(path), board)
        lastWritten = text
        written.push(text)
        if (written.length > 12) written.shift()
        try {
          await api.vault.write(path, text, true)
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
        canvas.dataset.grid = board.settings.grid
        canvas.style.backgroundSize = `${GRID * k}px ${GRID * k}px`
        canvas.style.backgroundPosition = `${x}px ${y}px`
        zoomLabel.textContent = Math.round(k * 100) + '%'
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
      /** Where the line from the middle of the card towards a point leaves the edge of the card. */
      const edgeToward = (c, tx, ty) => {
        const s = sizeOf(c)
        const cx = c.x + s.w / 2
        const cy = c.y + s.h / 2
        const dx = tx - cx
        const dy = ty - cy
        if (!dx && !dy) return { x: cx, y: cy }
        const f = Math.min(dx ? s.w / 2 / Math.abs(dx) : Infinity, dy ? s.h / 2 / Math.abs(dy) : Infinity)
        return { x: cx + dx * f, y: cy + dy * f }
      }
      const centerOf = (c) => {
        const s = sizeOf(c)
        return { x: c.x + s.w / 2, y: c.y + s.h / 2 }
      }
      const drawLinks = () => {
        linkLayer.replaceChildren()
        const byId = new Map(board.cards.map((c) => [c.id, c]))
        for (const l of board.links) {
          const a = byId.get(l.from)
          const b = byId.get(l.to)
          if (!a || !b) continue
          const ca = centerOf(a)
          const cb = centerOf(b)
          let p
          let q
          let ctrl = null
          if (l.curve) {
            const mx = (ca.x + cb.x) / 2
            const my = (ca.y + cb.y) / 2
            const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1
            ctrl = { x: mx - ((cb.y - ca.y) / len) * len * 0.22, y: my + ((cb.x - ca.x) / len) * len * 0.22 }
            p = edgeToward(a, ctrl.x, ctrl.y)
            q = edgeToward(b, ctrl.x, ctrl.y)
          } else {
            p = edgeToward(a, cb.x, cb.y)
            q = edgeToward(b, ca.x, ca.y)
          }
          const g = svgEl('g', { class: 'bd-link' + (selLink === l.id ? ' on' : ''), 'data-id': l.id })
          const d = ctrl ? `M${p.x} ${p.y} Q${ctrl.x} ${ctrl.y} ${q.x} ${q.y}` : `M${p.x} ${p.y} L${q.x} ${q.y}`
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
            const mid = ctrl ? { x: 0.25 * p.x + 0.5 * ctrl.x + 0.25 * q.x, y: 0.25 * p.y + 0.5 * ctrl.y + 0.25 * q.y } : { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
            const text = svgEl('text', { x: mid.x, y: mid.y, class: 'bd-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' })
            text.textContent = l.label
            g.append(text)
          }
          linkLayer.append(g)
        }
      }
      const addLink = (from, to) => {
        if (from === to || board.links.some((l) => l.from === from && l.to === to)) return null
        const l = { id: uid(), from, to, head: 'end', style: 'solid' }
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

      const shapeSvg = (card) => {
        const s = sizeOf(card)
        const svg = svgEl('svg', { class: 'bd-shape-svg', viewBox: `0 0 ${s.w} ${s.h}`, preserveAspectRatio: 'none' })
        const attrs = { class: 'bd-shape-fill', 'vector-effect': 'non-scaling-stroke' }
        let shape
        if (card.shape === 'ellipse') shape = svgEl('ellipse', { cx: s.w / 2, cy: s.h / 2, rx: s.w / 2 - 1, ry: s.h / 2 - 1, ...attrs })
        else if (card.shape === 'diamond') shape = svgEl('polygon', { points: `${s.w / 2},1 ${s.w - 1},${s.h / 2} ${s.w / 2},${s.h - 1} 1,${s.h / 2}`, ...attrs })
        else shape = svgEl('rect', { x: 1, y: 1, width: s.w - 2, height: s.h - 2, rx: 12, ...attrs })
        svg.append(shape)
        return svg
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
          body.append(el('div', { className: 'bd-text', textContent: card.text ?? '' }))
        } else if (card.type === 'shape') {
          body.append(shapeSvg(card), el('div', { className: 'bd-text bd-shape-text', textContent: card.text ?? '' }))
        } else if (card.type === 'frame') {
          body.append(el('div', { className: 'bd-frame-title', textContent: card.text || tt('Рамка', 'Frame') }))
        } else if (card.type === 'note') {
          const info = notes.get(card.note)
          const ok = !info?.gone && api.vault.list().includes(card.note)
          const open = el('button', { className: 'bd-open', title: tt('Открыть заметку', 'Open the note'), textContent: '↗' })
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
            list.append(el('label', { className: 'bd-todo-row' + (done ? ' done' : '') }, [box, el('span', { textContent: m ? m[2] : line })]))
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
        const grip = el('div', { className: 'bd-grip' })
        grip.addEventListener('pointerdown', (e) => gripDown(e, card, grip))
        node.append(grip)
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
        hint.hidden = board.cards.length > 0 && !broken
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
        selLink = link
        refreshSel()
      }
      const refreshSel = () => {
        for (const [id, node] of cardEls) node.classList.toggle('on', sel.has(id))
        drawLinks()
        placeFloat()
        drawMini()
      }

      const floatBtn = (name, title, onclick) => el('button', { className: 'bd-fbtn', title, onclick }, [icon(name)])
      const placeFloat = () => {
        floatBar.replaceChildren()
        const cards = selected()
        if (editing || arrowMode || (!cards.length && !selLink)) {
          floatBar.hidden = true
          return
        }
        let anchor
        if (cards.length) {
          const b = boundsOf(cards)
          anchor = { x: b.x + b.w / 2, y: b.y }
          const sw = el('button', { className: 'bd-fbtn bd-fcolor', title: tt('Цвет', 'Colour') })
          sw.style.setProperty('--c', cards.length === 1 && cards[0].color ? cards[0].color : 'transparent')
          sw.onclick = (e) => menuAtButton(e, colorMenu(cards))
          floatBar.append(sw)
          if (cards.length === 1) floatBar.append(floatBtn('arrow', tt('Стрелка отсюда (A)', 'Arrow from here (A)'), () => startArrowMode(cards[0])))
          floatBar.append(
            floatBtn('copy', tt('Дублировать (Ctrl+Shift+D)', 'Duplicate (Ctrl+Shift+D)'), () => duplicate()),
            floatBtn(cards.every((c) => c.locked) ? 'unlock' : 'lock', tt('Закрепить / открепить', 'Lock / unlock'), () => toggleLock(cards)),
            floatBtn('more', tt('Меню', 'Menu'), (e) => menuAtButton(e, cards.length > 1 ? multiMenu() : cardMenu(cards[0]))),
            floatBtn('trash', tt('Удалить (Delete)', 'Delete (Delete)'), () => removeSelected())
          )
        } else {
          const l = board.links.find((x) => x.id === selLink)
          const a = l && byId(l.from)
          const b = l && byId(l.to)
          if (!a || !b) {
            floatBar.hidden = true
            return
          }
          const m = { x: (centerOf(a).x + centerOf(b).x) / 2, y: (centerOf(a).y + centerOf(b).y) / 2 }
          anchor = { x: m.x, y: m.y - 14 }
          floatBar.append(
            floatBtn('pencil', tt('Подпись', 'Label'), () => editLabel(l)),
            floatBtn('dash', tt('Вид линии', 'Line style'), (e) => menuAtButton(e, linkMenu(l))),
            floatBtn('reverse', tt('Развернуть', 'Reverse'), () => reverseLink(l)),
            floatBtn('trash', tt('Удалить', 'Delete'), () => removeSelected())
          )
        }
        floatBar.hidden = false
        const r = canvas.getBoundingClientRect()
        const s = toScreen(anchor.x, anchor.y)
        const w = floatBar.offsetWidth || 160
        floatBar.style.left = clamp(s.x - r.left - w / 2, 6, Math.max(6, r.width - w - 6)) + 'px'
        floatBar.style.top = Math.max(6, s.y - r.top - 46) + 'px'
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

      const addCard = (props, at, edit = true) => {
        const [dw, dh] = DEF[props.type]
        const w = props.w ?? dw
        const h = props.h ?? dh
        const p = freeSpot(w, h, at)
        const card = { id: uid(), x: p.x, y: p.y, ...props }
        if (card.w === undefined && (w !== dw || h !== dh)) card.w = w
        // frames go to the back of the array, the rest to the front
        if (card.type === 'frame') board.cards.unshift(card)
        else board.cards.push(card)
        makeCard(card)
        setSel([card.id])
        commit()
        hint.hidden = true
        if (edit && ['text', 'sticky', 'shape', 'todo', 'frame'].includes(card.type)) {
          fresh.add(card.id)
          startEdit(card)
        }
        return card
      }

      const cloneCards = (cards, dx, dy) => {
        const ids = new Map(cards.map((c) => [c.id, uid()]))
        const copies = cards.map((c) => ({ ...JSON.parse(JSON.stringify(c)), id: ids.get(c.id), x: c.x + dx, y: c.y + dy }))
        const arrows = board.links.filter((l) => ids.has(l.from) && ids.has(l.to)).map((l) => ({ ...l, id: uid(), from: ids.get(l.from), to: ids.get(l.to) }))
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
        hint.hidden = true
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
              const arrows = (src.links ?? []).filter((l) => ids.has(l.from) && ids.has(l.to)).map((l) => ({ ...l, id: uid(), from: ids.get(l.from), to: ids.get(l.to) }))
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
        hint.hidden = board.cards.length > 0
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
        const wrap = node.querySelector(frame ? '.bd-frame-title' : '.bd-body')
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
        field.focus()
        if (target === 'all') field.select()
        else field.setSelectionRange(field.value.length, field.value.length)
        const done = (cancel) => {
          if (editing !== card.id) return
          editing = null
          const isNew = fresh.delete(card.id)
          const empty = !(cancel ? card.text ?? '' : field.value).replace(/\[( |x)\]/gi, '').trim()
          if (isNew && empty && card.type !== 'frame') {
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
            hint.hidden = board.cards.length > 0
            canvas.focus()
            return
          }
          if (!cancel && field.value !== (card.text ?? '')) {
            card.text = field.value
            commit()
          }
          renderCard(card)
          placeFloat()
          canvas.focus()
        }
        field.onblur = () => done(false)
        field.onkeydown = (e) => {
          e.stopPropagation()
          if (e.key === 'Escape') done(true)
          else if (e.key === 'Enter' && (e.ctrlKey || frame)) done(false)
          else if (e.key === 'Enter' && card.type === 'todo') {
            e.preventDefault()
            const at = field.selectionStart
            field.setRangeText('\n[ ] ', at, field.selectionEnd, 'end')
          }
        }
        field.onpointerdown = (e) => e.stopPropagation()
      }
      const editLabel = async (l) => {
        const v = await api.ui.prompt(tt('Подпись стрелки', 'Label of the arrow'), l.label ?? '')
        if (v === null) return
        l.label = v.trim() || undefined
        drawLinks()
        commit()
      }
      const reverseLink = (l) => {
        ;[l.from, l.to] = [l.to, l.from]
        drawLinks()
        commit()
      }
      /** Double click: edit a card of text, open a note or a link. */
      const activate = (card) => {
        if (card.locked && !['note', 'link'].includes(card.type)) return
        if (card.type === 'note') {
          if (api.vault.list().includes(card.note)) api.vault.open(card.note)
        } else if (card.type === 'link') window.open(normUrl(card.url))
        else if (card.type === 'image') void files.openFile(card.src)
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
          if (board.settings.snapGrid) {
            if (!gx) nx = Math.round(nx / GRID) * GRID
            if (!gy) ny = Math.round(ny / GRID) * GRID
          }
        } else if (!off && board.settings.snapGrid) {
          nx = Math.round(nx / GRID) * GRID
          ny = Math.round(ny / GRID) * GRID
        }
        return { dx: nx - box.x, dy: ny - box.y, lines }
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
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const next = new Set(sel)
          if (next.has(card.id)) next.delete(card.id)
          else next.add(card.id)
          setSel(next)
          return
        }
        if (!sel.has(card.id)) setSel([card.id])
        else if (selLink) setSel(sel)
        let moving = withMembers(selected()).filter((c) => !c.locked)
        if (!moving.length) return
        const origin = new Map(moving.map((c) => [c.id, { x: c.x, y: c.y }]))
        const start = { x: e.clientX, y: e.clientY }
        const startAlt = e.altKey
        let box = boundsOf(moving)
        let moved = false
        node.setPointerCapture(e.pointerId)
        const move = (ev) => {
          const k = board.view.k
          let dx = (ev.clientX - start.x) / k
          let dy = (ev.clientY - start.y) / k
          if (!moved) {
            if (Math.hypot(dx, dy) * k < 3) return
            moved = true
            if (startAlt) {
              // Alt: the copies are what is dragged, the originals stay
              const made = cloneCards(moving, 0, 0)
              insertClones(made, true)
              moving = made.copies
              origin.clear()
              for (const c of moving) origin.set(c.id, { x: c.x, y: c.y })
              box = boundsOf(moving)
            }
            canvas.classList.add('moving')
          }
          const snapped = snapMove(box, dx, dy, new Set(moving.map((c) => c.id)), ev.altKey && !startAlt)
          dx = snapped.dx
          dy = snapped.dy
          for (const c of moving) {
            const o = origin.get(c.id)
            c.x = Math.round(o.x + dx)
            c.y = Math.round(o.y + dy)
            place(c)
          }
          showGuides(snapped.lines)
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
        }
        node.addEventListener('pointermove', move)
        node.addEventListener('pointerup', up)
        node.addEventListener('pointercancel', up)
      }

      const gripDown = (e, card, grip) => {
        if (e.button !== 0 || card.locked) return
        e.stopPropagation()
        setSel([card.id])
        const s0 = sizeOf(card)
        const from = { x: e.clientX, y: e.clientY }
        const ratio = s0.w / s0.h
        const [mw, mh] = MIN[card.type]
        grip.setPointerCapture(e.pointerId)
        const move = (ev) => {
          const k = board.view.k
          let w = clamp(s0.w + (ev.clientX - from.x) / k, mw, 1600)
          let h = clamp(s0.h + (ev.clientY - from.y) / k, mh, 1600)
          if (card.type === 'image' && !ev.altKey) h = w / ratio
          if (board.settings.snapGrid && !ev.altKey) {
            w = Math.round((card.x + w) / GRID) * GRID - card.x
            h = card.type === 'image' ? w / ratio : Math.round((card.y + h) / GRID) * GRID - card.y
          }
          card.w = Math.round(Math.max(mw, w))
          card.h = Math.round(Math.max(mh, h))
          place(card)
          if (card.type === 'shape') renderCard(card)
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
      const cardAt = (cx, cy) => {
        const hit = document.elementFromPoint(cx, cy)?.closest('.bd-card')
        return hit ? byId(hit.dataset.id) : null
      }
      const tempTo = (from, p) => {
        const c = centerOf(from)
        const e = edgeToward(from, p.x, p.y)
        temp.setAttribute('x1', e.x ?? c.x)
        temp.setAttribute('y1', e.y ?? c.y)
        temp.setAttribute('x2', p.x)
        temp.setAttribute('y2', p.y)
        temp.setAttribute('visibility', 'visible')
      }
      /** Let go of an arrow on a card: it joins them; on an empty place: a new card is made there and joined. */
      const dropArrow = (from, cx, cy) => {
        temp.setAttribute('visibility', 'hidden')
        const target = cardAt(cx, cy)
        if (target && target.id !== from.id) addLink(from.id, target.id)
        else if (!target) {
          const p = toWorld(cx, cy)
          const c = batch(() => {
            const made = addCard({ type: 'text' }, { x: p.x + 90, y: p.y }, false)
            addLink(from.id, made.id)
            return made
          })
          fresh.add(c.id)
          startEdit(c)
        }
      }
      const portDown = (e, card, port) => {
        if (e.button !== 0 || card.locked) return
        e.stopPropagation()
        port.setPointerCapture(e.pointerId)
        const move = (ev) => tempTo(card, toWorld(ev.clientX, ev.clientY))
        move(e)
        const up = (ev) => {
          port.removeEventListener('pointermove', move)
          port.removeEventListener('pointerup', up)
          port.removeEventListener('pointercancel', up)
          dropArrow(card, ev.clientX, ev.clientY)
        }
        port.addEventListener('pointermove', move)
        port.addEventListener('pointerup', up)
        port.addEventListener('pointercancel', up)
      }
      /** "Arrow from here" in a menu: the next click on a card finishes the arrow. */
      const startArrowMode = (card) => {
        arrowMode = { from: card }
        canvas.classList.add('arrowing')
        placeFloat()
        tempTo(card, centerOf(card))
        api.ui.notice(tt('Щёлкните по карточке, куда ведёт стрелка (Esc — отмена)', 'Click the card the arrow goes to (Esc cancels)'), 3500)
      }
      const stopArrowMode = () => {
        arrowMode = null
        canvas.classList.remove('arrowing')
        temp.setAttribute('visibility', 'hidden')
        placeFloat()
      }
      const finishArrowMode = (card) => {
        const from = arrowMode?.from
        stopArrowMode()
        if (from && card && from.id !== card.id) addLink(from.id, card.id)
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
        searchCount.textContent = q ? `${hits.length ? hitAt + 1 : 0}/${hits.length}` : ''
        if (hits.length && center) centerOn(hits[0])
      }
      const nextHit = (step) => {
        if (!hits.length) return
        hitAt = (hitAt + step + hits.length) % hits.length
        searchCount.textContent = `${hitAt + 1}/${hits.length}`
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
          const all = board.cards.length ? boundsOf([...board.cards, { type: 'text', ...view, w: view.w, h: view.h }]) : view
          const pad = 20
          const s = Math.min((W - 8) / (all.w + pad), (H - 8) / (all.h + pad))
          const ox = (W - all.w * s) / 2 - all.x * s
          const oy = (H - all.h * s) / 2 - all.y * s
          mini._map = { s, ox, oy }
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
      mini.addEventListener('pointerdown', (e) => {
        if (!mini._map || !board) return
        mini.setPointerCapture(e.pointerId)
        const go = (ev) => {
          const b = mini.getBoundingClientRect()
          const { s, ox, oy } = mini._map
          const wx = ((ev.clientX - b.left) * (mini.width / b.width) - ox) / s
          const wy = ((ev.clientY - b.top) * (mini.height / b.height) - oy) / s
          const r = canvas.getBoundingClientRect()
          board.view.x = r.width / 2 - wx * board.view.k
          board.view.y = r.height / 2 - wy * board.view.k
          applyView()
        }
        go(e)
        const up = () => {
          mini.removeEventListener('pointermove', go)
          mini.removeEventListener('pointerup', up)
          saveView()
        }
        mini.addEventListener('pointermove', go)
        mini.addEventListener('pointerup', up)
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
      const menuAtButton = (e, items) => {
        const r = e.currentTarget.getBoundingClientRect()
        showMenu(r.left, r.bottom + 6, items)
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
        { label: tt('Картинка…', 'Picture…'), action: () => pickImages(at) },
        { label: tt('Ссылка…', 'Link…'), action: () => void askLink(at) },
        { sep: true },
        { label: tt('Рамка', 'Frame'), hint: 'F', action: () => addCard({ type: 'frame', text: '' }, at) },
        {
          label: tt('Фигура', 'Shape'),
          children: [
            { label: tt('Прямоугольник', 'Rectangle'), action: () => addCard({ type: 'shape', shape: 'rect' }, at) },
            { label: tt('Эллипс', 'Ellipse'), action: () => addCard({ type: 'shape', shape: 'ellipse' }, at) },
            { label: tt('Ромб', 'Diamond'), action: () => addCard({ type: 'shape', shape: 'diamond' }, at) }
          ]
        }
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

      const cardMenu = (card) => {
        const items = []
        const one = [card]
        if (card.type === 'note') {
          items.push({ label: tt('Открыть заметку', 'Open the note'), hint: tt('двойной клик', 'double click'), action: () => api.vault.open(card.note) })
          items.push({ label: tt('Показать в проводнике', 'Show in Explorer'), action: () => void files.reveal(card.note) })
          items.push({ label: tt('Скопировать имя', 'Copy the name'), action: () => void copyText(nameOf(card.note)) })
        } else if (card.type === 'link') {
          items.push({ label: tt('Открыть в браузере', 'Open in the browser'), hint: tt('двойной клик', 'double click'), action: () => window.open(normUrl(card.url)) })
          items.push({ label: tt('Скопировать адрес', 'Copy the address'), action: () => void copyText(card.url) })
          items.push({
            label: tt('Изменить…', 'Edit…'),
            action: async () => {
              const v = await api.ui.prompt(tt('Адрес ссылки', 'Link address'), card.url)
              if (v?.trim()) setProp(one, 'url', normUrl(v.trim()))
            }
          })
          items.push({
            label: tt('Название…', 'Title…'),
            action: async () => {
              const v = await api.ui.prompt(tt('Название ссылки', 'Title of the link'), card.text ?? '')
              if (v !== null) setProp(one, 'text', v.trim() || undefined)
            }
          })
        } else if (card.type === 'image') {
          items.push({ label: tt('Открыть картинку', 'Open the picture'), hint: tt('двойной клик', 'double click'), action: () => void files.openFile(card.src) })
          items.push({ label: tt('Показать в проводнике', 'Show in Explorer'), action: () => void files.reveal(card.src) })
          items.push({
            label: tt('Исходный размер', 'Original size'),
            action: () => {
              const img = new Image()
              img.onload = () => {
                card.w = img.naturalWidth
                card.h = img.naturalHeight
                place(card)
                drawLinks()
                commit()
              }
              img.src = urlOf(card.src)
            }
          })
        } else if (card.type === 'frame') {
          items.push({ label: tt('Название…', 'Name…'), hint: tt('двойной клик', 'double click'), action: () => startEdit(card, 'all') })
          items.push({ label: tt('Подогнать под содержимое', 'Fit to the contents'), disabled: !membersOf(card).length, action: () => fitFrame(card) })
          items.push({
            label: tt('Выделить содержимое', 'Select the contents'),
            disabled: !membersOf(card).length,
            action: () => setSel(membersOf(card).map((c) => c.id))
          })
          items.push({ label: tt('Приблизить к рамке', 'Zoom to the frame'), action: () => fitRect(rectOf(card), 2) })
        } else {
          items.push({ label: tt('Изменить текст', 'Edit text'), hint: tt('двойной клик', 'double click'), action: () => startEdit(card) })
        }
        if (card.type === 'shape') {
          items.push({
            label: tt('Форма', 'Shape'),
            children: ['rect', 'ellipse', 'diamond'].map((s) => ({
              label: { rect: tt('Прямоугольник', 'Rectangle'), ellipse: tt('Эллипс', 'Ellipse'), diamond: tt('Ромб', 'Diamond') }[s],
              checked: (card.shape ?? 'rect') === s,
              action: () => setProp(one, 'shape', s)
            }))
          })
        }
        items.push({ sep: true })
        items.push({ label: tt('Цвет', 'Colour'), children: colorMenu(one) })
        if (['text', 'sticky', 'shape', 'todo', 'note'].includes(card.type)) items.push({ label: tt('Размер текста', 'Text size'), children: fontMenu(one) })
        if (card.type === 'text') items.push({ label: tt('Превратить в стикер', 'Make it a sticky note'), action: () => ((card.type = 'sticky'), (card.color ??= STICKY), rebuildOne(card)) })
        if (card.type === 'sticky') items.push({ label: tt('Превратить в карточку', 'Make it a plain card'), action: () => ((card.type = 'text'), rebuildOne(card)) })
        items.push({ sep: true })
        items.push({ label: tt('Стрелка отсюда', 'Arrow from here'), hint: 'A', action: () => startArrowMode(card) })
        items.push({ label: tt('Дублировать', 'Duplicate'), hint: 'Ctrl+Shift+D', action: () => duplicate() })
        items.push({ label: tt('Копировать', 'Copy'), hint: 'Ctrl+C', action: () => void copySel() })
        items.push({ label: tt('Вырезать', 'Cut'), hint: 'Ctrl+X', action: () => void cutSel() })
        items.push({ label: tt('Порядок', 'Order'), children: orderMenu(one) })
        items.push({ label: tt('Обернуть в рамку', 'Wrap in a frame'), hint: 'Ctrl+G', action: () => wrapInFrame(one) })
        items.push({ label: card.locked ? tt('Открепить', 'Unlock') : tt('Закрепить', 'Lock'), action: () => toggleLock(one) })
        items.push({ sep: true })
        if (card.type === 'frame') {
          items.push({ label: tt('Удалить рамку', 'Delete the frame'), hint: 'Del', danger: true, action: () => removeSelected() })
          items.push({ label: tt('Удалить рамку с содержимым', 'Delete the frame with its contents'), danger: true, action: () => removeFrameWithContents(card) })
        } else items.push({ label: tt('Удалить', 'Delete'), hint: 'Del', danger: true, action: () => removeSelected() })
        return items
      }
      /** The kind of a card changed: it is drawn again. */
      const rebuildOne = (card) => {
        cardEls.get(card.id)?.remove()
        cardEls.delete(card.id)
        makeCard(card)
        restack()
        commit()
      }

      const multiMenu = () => {
        const cards = selected()
        return [
          { label: tt('Цвет', 'Colour'), children: colorMenu(cards) },
          ...arrangeMenu(cards),
          { label: tt('Порядок', 'Order'), children: orderMenu(cards) },
          { sep: true },
          { label: tt('Обернуть в рамку', 'Wrap in a frame'), hint: 'Ctrl+G', action: () => wrapInFrame(cards) },
          { label: tt('Дублировать', 'Duplicate'), hint: 'Ctrl+Shift+D', action: () => duplicate() },
          { label: tt('Копировать', 'Copy'), hint: 'Ctrl+C', action: () => void copySel() },
          { label: tt('Вырезать', 'Cut'), hint: 'Ctrl+X', action: () => void cutSel() },
          { label: cards.every((c) => c.locked) ? tt('Открепить всё', 'Unlock all') : tt('Закрепить всё', 'Lock all'), action: () => toggleLock(cards) },
          { label: tt('Приблизить к выделенному', 'Zoom to the selection'), action: () => fitSelection() },
          { sep: true },
          { label: tt('Удалить', 'Delete') + ` (${cards.length})`, hint: 'Del', danger: true, action: () => removeSelected() }
        ]
      }

      const linkMenu = (l) => [
        { label: tt('Подпись…', 'Label…'), hint: tt('двойной клик', 'double click'), action: () => void editLabel(l) },
        {
          label: tt('Линия', 'Line'),
          children: [
            { label: tt('Сплошная', 'Solid'), checked: (l.style ?? 'solid') === 'solid', action: () => linkProp(l, 'style', 'solid') },
            { label: tt('Пунктир', 'Dashed'), checked: l.style === 'dashed', action: () => linkProp(l, 'style', 'dashed') },
            { label: tt('Точки', 'Dotted'), checked: l.style === 'dotted', action: () => linkProp(l, 'style', 'dotted') }
          ]
        },
        {
          label: tt('Концы', 'Ends'),
          children: [
            { label: tt('Стрелка на конце', 'Arrow at the end'), checked: (l.head ?? 'end') === 'end', action: () => linkProp(l, 'head', 'end') },
            { label: tt('Стрелки с обеих сторон', 'Arrows at both ends'), checked: l.head === 'both', action: () => linkProp(l, 'head', 'both') },
            { label: tt('Без стрелок', 'No arrows'), checked: l.head === 'none', action: () => linkProp(l, 'head', 'none') }
          ]
        },
        {
          label: tt('Форма', 'Shape'),
          children: [
            { label: tt('Прямая', 'Straight'), checked: !l.curve, action: () => linkProp(l, 'curve', undefined) },
            { label: tt('Изогнутая', 'Curved'), checked: !!l.curve, action: () => linkProp(l, 'curve', true) }
          ]
        },
        { label: tt('Цвет', 'Colour'), children: [{ colors: { current: l.color, pick: (c) => linkProp(l, 'color', c || undefined) } }] },
        { label: tt('Развернуть', 'Reverse'), action: () => reverseLink(l) },
        { sep: true },
        { label: tt('Удалить', 'Delete'), hint: 'Del', danger: true, action: () => removeSelected() }
      ]
      const linkProp = (l, key, value) => {
        if (value === undefined) delete l[key]
        else l[key] = value
        drawLinks()
        commit()
      }

      const viewMenu = () => [
        { label: tt('Вписать всё', 'Fit everything'), hint: 'Shift+1', action: () => fit() },
        { label: tt('Масштаб 100%', 'Zoom 100%'), hint: 'Ctrl+0', action: () => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1) },
        { label: tt('Приблизить', 'Zoom in'), hint: 'Ctrl+=', action: () => zoomBy(1.25) },
        { label: tt('Отдалить', 'Zoom out'), hint: 'Ctrl+−', action: () => zoomBy(1 / 1.25) },
        { sep: true },
        {
          label: tt('Сетка', 'Grid'),
          children: [
            { label: tt('Точки', 'Dots'), checked: board.settings.grid === 'dots', action: () => setSetting('grid', 'dots') },
            { label: tt('Линии', 'Lines'), checked: board.settings.grid === 'lines', action: () => setSetting('grid', 'lines') },
            { label: tt('Без сетки', 'None'), checked: board.settings.grid === 'none', action: () => setSetting('grid', 'none') }
          ]
        },
        { label: tt('Прилипать к сетке', 'Snap to the grid'), checked: !!board.settings.snapGrid, action: () => setSetting('snapGrid', !board.settings.snapGrid) },
        { label: tt('Направляющие по краям карточек', 'Guides to the edges of cards'), checked: board.settings.guides !== false, action: () => setSetting('guides', board.settings.guides === false) },
        { label: tt('Мини-карта', 'Minimap'), checked: !mini.hidden, action: () => setSetting('minimap', mini.hidden) }
      ]
      const setSetting = (key, value) => {
        board.settings[key] = value
        applyView()
        changed()
      }

      const canvasMenu = (at) => [
        { label: tt('Добавить', 'Add'), children: addItems(at) },
        { label: tt('Вставить', 'Paste'), hint: 'Ctrl+V', action: () => void pasteHere(at) },
        { label: tt('Выбрать всё', 'Select all'), hint: 'Ctrl+A', disabled: !board.cards.length, action: () => setSel(board.cards.map((c) => c.id)) },
        { sep: true },
        { label: tt('Вид', 'View'), children: viewMenu() },
        { label: tt('Найти на доске…', 'Find on the board…'), hint: 'Ctrl+F', action: () => openSearch() },
        { label: tt('Экспорт', 'Export'), children: exportMenu() },
        { sep: true },
        { label: tt('Отменить', 'Undo'), hint: 'Ctrl+Z', disabled: hist.i <= 0, action: () => undo() },
        { label: tt('Повторить', 'Redo'), hint: 'Ctrl+Y', disabled: hist.i >= hist.stack.length - 1, action: () => redo() }
      ]

      const toMarkdown = () => {
        const lines = [`# ${nameOf(path)}`, '']
        const label = (c) =>
          c.type === 'note' ? `[[${nameOf(c.note)}]]` : c.type === 'link' ? `[${c.text || hostOf(c.url)}](${c.url})` : c.type === 'image' ? `![[${nameOf(c.src)}]]` : (c.text ?? '').replace(/\n+/g, ' ').trim() || '…'
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
        select.hidden = !paths.length
        return paths
      }
      const createBoard = async (dir = FOLDER) => {
        const raw = await api.ui.prompt(tt('Название доски', 'Name of the board'), '')
        const name = raw?.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/[. ]+$/, '')
        if (!name) return null
        if (dir && !(await api.vault.exists(dir))) await files.folder(dir)
        const taken = new Set(boardPaths().map((p) => p.toLowerCase()))
        const at = dir ? dir + '/' : ''
        let next = `${at}${name}.${EXT}`
        for (let i = 2; taken.has(next.toLowerCase()); i++) next = `${at}${name} ${i}.${EXT}`
        await api.vault.write(next, serialize(nameOf(next), newBoard()), true)
        fillSelect()
        await openPath(next)
        select.value = next
        return next
      }
      const boardMenu = () => [
        { label: tt('Новая доска…', 'New board…'), action: () => void createBoard() },
        { sep: true },
        {
          label: tt('Переименовать…', 'Rename…'),
          disabled: !path,
          action: async () => {
            const v = await api.ui.prompt(tt('Новое название', 'New name'), nameOf(path))
            const name = v?.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim()
            if (!name || name === nameOf(path)) return
            await write()
            try {
              const was = path
              const next = await files.rename(path, name)
              path = next
              const d = data()
              const views = { ...(d.views ?? {}) }
              if (views[was]) views[next] = views[was]
              delete views[was]
              api.data.set({ ...d, last: next, views })
              // the title line of the note says the new name
              dirty = true
              await write()
              await new Promise((r) => setTimeout(r, 300))
              fillSelect()
              select.value = next
            } catch (e) {
              api.ui.notice(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e), 6000)
            }
          }
        },
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

      /* ---------- picking a note ---------- */
      const pickNote = (at) => {
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
                        addCard({ type: 'note', note: n }, at, false)
                      }
                      return b
                    })
                  : [el('div', { className: 'bd-found-none', textContent: tt('Ничего не найдено', 'Nothing found') })])
              )
            }
            input.oninput = render
            input.onkeydown = (e) => e.key === 'Enter' && list.firstChild?.click?.()
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
        if (arrowMode) tempTo(arrowMode.from, mouse)
      })

      canvas.addEventListener('pointerdown', (e) => {
        if (!board || e.target.closest('.bd-float, .bd-zoombox, .bd-mini, .bd-search')) return
        canvas.focus()
        if (arrowMode) {
          // a click on a card is handled by the card; here it was an empty place
          if (e.target.closest('.bd-card')) return
          const from = arrowMode.from
          stopArrowMode()
          const p = toWorld(e.clientX, e.clientY)
          const c = batch(() => {
            const made = addCard({ type: 'text' }, { x: p.x + 90, y: p.y }, false)
            addLink(from.id, made.id)
            return made
          })
          fresh.add(c.id)
          startEdit(c)
          return
        }
        const onLink = e.target.closest('.bd-link')
        if (onLink && e.button === 0) {
          e.stopPropagation()
          setSel([], onLink.dataset.id)
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
          if (e.shiftKey) {
            board.view.x -= e.deltaY
            applyView()
            saveView()
          } else zoomAt(e.clientX - r.left, e.clientY - r.top, board.view.k * Math.exp(-e.deltaY * 0.0015))
        },
        { passive: false }
      )

      canvas.addEventListener('dblclick', (e) => {
        if (!board || broken || e.target.closest('.bd-card, .bd-float, .bd-zoombox, .bd-mini, .bd-search')) return
        const l = e.target.closest('.bd-link')
        if (l) {
          const link = board.links.find((x) => x.id === l.dataset.id)
          if (link) void editLabel(link)
          return
        }
        addCard({ type: 'text' }, toWorld(e.clientX, e.clientY))
      })

      canvas.addEventListener('contextmenu', (e) => {
        if (!board || e.target.closest('.bd-search, .bd-mini')) return
        e.preventDefault()
        if (broken) return
        const at = toWorld(e.clientX, e.clientY)
        mouse = at
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
          if (types.includes('text/syntex-path')) e.dataTransfer.dropEffect = 'copy'
        }
      })
      canvas.addEventListener('drop', async (e) => {
        if (!board || broken) return
        // a note (or a picture) dragged from the tree: a card of it where it was let go
        const fromTree = e.dataTransfer?.getData('text/syntex-path')
        if (fromTree) {
          e.preventDefault()
          e.stopPropagation()
          const at = toWorld(e.clientX, e.clientY)
          if (/\.md$/i.test(fromTree)) addCard({ type: 'note', note: fromTree }, at, false)
          else if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(fromTree)) {
            const dims = await new Promise((resolve) => {
              const img = new Image()
              img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
              img.onerror = () => resolve({ w: 260, h: 180 })
              img.src = urlOf(fromTree)
            })
            const w = Math.min(340, dims.w || 260)
            addCard({ type: 'image', src: fromTree, w, h: Math.round((w * (dims.h || 180)) / (dims.w || 260)) }, at, false)
          } else api.ui.notice(tt('На доску можно положить заметку или картинку', 'A note or a picture can be put on the board'))
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
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          removeSelected()
        } else if (e.key === 'Escape') {
          if (arrowMode) stopArrowMode()
          else if (!searchBox.hidden) closeSearch()
          else setSel([])
        } else if (e.key.startsWith('Arrow') && sel.size) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
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
          else if (code === 'KeyA' && sel.size === 1) startArrowMode(selected()[0])
          else if (code === 'KeyH') setTool('hand')
          else if (code === 'KeyV') setTool('select')
        }
      })
      let keyTimer = null
      root.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          spaceDown = false
          canvas.classList.remove('hand')
        }
      })
      const setTool = (t) => {
        tool = t
        canvas.classList.toggle('hand', t === 'hand')
        syncToolbar()
      }

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
        mini.hidden = board.settings.minimap === false
        hist = { stack: [snapshot()], i: 0 }
        rebuild()
        applyView()
        hint.hidden = board.cards.length > 0 && !broken
        hint.textContent = broken
          ? tt('Данные доски повреждены, доска не изменяется: исправьте её заметку или создайте новую.', 'The data of this board is damaged, so it is left alone: fix its note or make a new board.')
          : tt(
              'Двойной клик по пустому месту — новая карточка. Правая кнопка мыши — меню. Колесо — масштаб, пробел или средняя кнопка — двигать поле. Кружок у края карточки тянется к другой карточке — так появляется стрелка. Заметки и картинки можно перетащить сюда из дерева.',
              'Double click an empty place for a new card. Right click for the menu. The wheel zooms; Space or the middle button moves the field. Drag the dot at the edge of a card to another card to make an arrow. Notes and pictures can be dragged here from the tree.'
            )
        canvas.classList.toggle('readonly', broken)
        syncToolbar()
      }

      const openPath = async (next) => {
        if (editing) root.querySelector('.bd-edit')?.blur()
        await write()
        path = next
        if (!path) {
          board = null
          cardEls.clear()
          frameLayer.replaceChildren()
          cardLayer.replaceChildren()
          linkLayer.replaceChildren()
          floatBar.hidden = true
          hint.hidden = false
          hint.textContent = tt('Доска — это поле с карточками и стрелками. Создайте первую.', 'A board is a field with cards and arrows. Make the first one.')
          syncToolbar()
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

      /* ---------- the toolbar ---------- */
      const undoBtn = btn('undo', undo, tt('Отменить (Ctrl+Z)', 'Undo (Ctrl+Z)'), 'bd-icon')
      const redoBtn = btn('redo', redo, tt('Повторить (Ctrl+Y)', 'Redo (Ctrl+Y)'), 'bd-icon')
      const handBtn = btn('hand', () => setTool(tool === 'hand' ? 'select' : 'hand'), tt('Рука: двигать поле (H)', 'Hand: move the field (H)'), 'bd-icon')
      const addBtn = btn('+ ' + tt('Добавить', 'Add'), (e) => board && !broken && menuAtButton(e, addItems(null)))
      const moreBtn = btn('more', (e) => menuAtButton(e, boardMenu()), tt('Меню доски', 'Board menu'), 'bd-icon')
      const viewBtn = btn(tt('Вид', 'View'), (e) => board && menuAtButton(e, viewMenu()))
      const findBtn = btn('search', () => board && openSearch(), tt('Найти на доске (Ctrl+F)', 'Find on the board (Ctrl+F)'), 'bd-icon')
      const syncToolbar = () => {
        undoBtn.disabled = hist.i <= 0
        redoBtn.disabled = hist.i >= hist.stack.length - 1
        handBtn.classList.toggle('on', tool === 'hand')
        for (const b of [addBtn, viewBtn, findBtn, handBtn]) b.disabled = !board || broken
      }
      select.onchange = () => void openPath(select.value)
      select.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        showMenu(e.clientX, e.clientY, boardMenu())
      })
      toolbar.append(select, moreBtn, el('span', { className: 'bd-sep' }), addBtn, handBtn, undoBtn, redoBtn, el('span', { className: 'bd-grow' }), findBtn, viewBtn)

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
          if (!path || !changedPaths.includes(path)) fillSelect()
          else if (!dirty && !editing) {
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
      void openPath(first).then(() => fillSelect())
      const onResize = () => (board ? (applyView(), undefined) : undefined)
      window.addEventListener('resize', onResize)

      return () => {
        window.removeEventListener('resize', onResize)
        clearTimeout(keyTimer)
        cancelAnimationFrame(miniFrame)
        void write()
        if (controller) controller = null
      }
    }

    api.views.add({ id: 'main', title: { ru: 'Доски', en: 'Boards' }, mount: mountBoards })

    /* ====================================================================== the rest */

    api.commands.add({ id: 'open', name: { ru: 'Открыть доски', en: 'Open boards' }, keys: 'Ctrl+Alt+B', run: openBoards })
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
              label: { ru: 'Новая доска здесь…', en: 'New board here…' },
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
      .bd-select { height: 30px; min-width: 140px; max-width: 240px; }
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
      .bd-hit { stroke: transparent; stroke-width: 16; fill: none; pointer-events: stroke; cursor: pointer; }
      .bd-link.on .bd-line { stroke: var(--accent); }
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
      .bd-shape-fill { fill: color-mix(in srgb, var(--c, transparent) 22%, var(--float-bg)); stroke: var(--c, var(--text-3)); stroke-width: 2; }
      .t-shape:not(.colored) .bd-shape-fill { fill: var(--float-bg); stroke: var(--text-3); }
      .t-shape.on .bd-shape-fill { stroke: var(--accent); }
      .bd-shape-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px 16px; }
      .t-shape .bd-edit { text-align: center; }
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
      .bd-port { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); opacity: 0; cursor: crosshair; border: 2px solid var(--bg-app); z-index: 2; }
      .bd-port.p-r { right: -8px; top: 50%; margin-top: -7px; } .bd-port.p-l { left: -8px; top: 50%; margin-top: -7px; }
      .bd-port.p-t { top: -8px; left: 50%; margin-left: -7px; } .bd-port.p-b { bottom: -8px; left: 50%; margin-left: -7px; }
      .bd-card:hover .bd-port, .bd-card.on .bd-port { opacity: 1; }
      .bd-card.locked .bd-port, .bd-card.locked .bd-grip { display: none; }
      .bd-grip { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; opacity: 0; z-index: 2;
        background: linear-gradient(135deg, transparent 50%, var(--text-3) 50%, var(--text-3) 58%, transparent 58%, transparent 72%, var(--text-3) 72%, var(--text-3) 80%, transparent 80%); }
      .bd-card:hover .bd-grip, .bd-card.on .bd-grip { opacity: .7; }
      .bd-canvas.searching .bd-card:not(.hit) { opacity: .25; }
      .bd-card.hit { box-shadow: 0 0 0 2px #fdd663; }
      .bd-band { position: absolute; border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); pointer-events: none; z-index: 5; }
      .bd-hint { position: absolute; left: 50%; top: 38%; transform: translateX(-50%); max-width: 420px; text-align: center; color: var(--text-3); font-size: 14px; line-height: 1.55; pointer-events: none; }
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
    `)
  }
}
