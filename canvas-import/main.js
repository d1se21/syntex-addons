// Canvas import: boards of JSON Canvas (.canvas files, as Obsidian makes them, https://jsoncanvas.org) are opened in the
// Interactive board add-on. A click on a .canvas makes a .board next to it (the .canvas is left as it is) and opens it;
// the next click opens the same board, unless the .canvas changed since. A board can be saved back as a .canvas.
//
// What does not come over: the side of a card an arrow starts or ends at (the board picks it itself), the background
// pictures of groups, and the look of Markdown in text (it is shown as written).

const BOARD = 'board'
const CANVAS = 'canvas'

// sizes of the board's cards: the smallest it allows, and what a card has when it says nothing
const MIN = { text: [90, 50], sticky: [90, 90], note: [150, 52], image: [60, 40], link: [160, 52], frame: [160, 100], shape: [70, 50], todo: [130, 70] }
const DEF = { text: [220, 110], sticky: [180, 180], note: [250, 108], image: [260, 180], link: [280, 70], frame: [560, 360], shape: [170, 110], todo: [230, 140] }

// the six colours of JSON Canvas ("1"..."6") and the board's colours closest to them
const PRESETS = { 1: '#f28b82', 2: '#fcad70', 3: '#fdd663', 4: '#81c995', 5: '#78d9ec', 6: '#c58af9' }
const IMAGE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i
// where a converted board starts: its top left corner, so that it is in sight when it is opened
const ORIGIN = 60

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v) => (typeof v === 'string' ? v : '')
const baseName = (p) => p.split('/').pop()

/** A colour of JSON Canvas ("1"..."6" or "#rrggbb") as the board keeps it; undefined for none. */
export function colorFromCanvas(c) {
  if (typeof c !== 'string' || !c) return undefined
  if (PRESETS[c]) return PRESETS[c]
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c.toLowerCase() : undefined
}

/** A colour of the board as JSON Canvas writes it: one of its six when it is one of them. */
export function colorToCanvas(c) {
  if (!c) return undefined
  const preset = Object.entries(PRESETS).find(([, hex]) => hex === c.toLowerCase())
  return preset ? preset[0] : c
}

/** Text whose every line is an item of a task list ("- [ ] a", "- [x] b"): the lines of a check list; else null. */
function todoLines(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return null
  const out = []
  for (const l of lines) {
    const m = /^\s*[-*+]\s+\[([ xX])\]\s?(.*)$/.exec(l)
    if (!m) return null
    out.push(`[${m[1] === ' ' ? ' ' : 'x'}] ${m[2]}`)
  }
  return out
}

/** A path as it is compared: forward slashes, no leading ./ or /, one form of Unicode, any case. */
const keyOf = (p) => p.normalize('NFC').toLowerCase()
function cleanPath(file) {
  let p = file.trim().replace(/\\/g, '/')
  if (/%[0-9a-f]{2}/i.test(p)) {
    try {
      p = decodeURIComponent(p)
    } catch {
      // a % that is part of the name
    }
  }
  return p.replace(/^(\.\/|\/)+/, '').normalize('NFC')
}

/**
 * What a `file` of a .canvas is in this vault: its vault path, or null when there is no such file.
 * The path in a .canvas starts at the root of the vault it was made in (Obsidian's), which here may be a folder
 * inside the vault, or the file may have been moved: so it is looked for as written, then from each folder above the
 * .canvas, then as the end of a path, then by its name alone; of several, the one nearest to the .canvas.
 */
export function makeResolver(allFiles, canvasPath = '') {
  const byKey = new Map(allFiles.map((p) => [keyOf(p), p]))
  const folders = []
  const parts = canvasPath.split('/').slice(0, -1)
  for (let i = parts.length; i > 0; i--) folders.push(parts.slice(0, i).join('/'))
  const canvasKey = keyOf(canvasPath)
  // how many folders a path shares with the .canvas
  const near = (p) => {
    const a = keyOf(p).split('/')
    const b = canvasKey.split('/')
    let i = 0
    while (i < a.length - 1 && i < b.length - 1 && a[i] === b[i]) i++
    return i
  }
  const nearest = (list) => (list.length ? list.reduce((best, p) => (near(p) > near(best) ? p : best)) : null)
  return (file) => {
    const p = cleanPath(str(file))
    if (!p) return null
    const tries = /\.[^./]+$/.test(p) ? [p] : [p, p + '.md']
    for (const t of tries) {
      const k = keyOf(t)
      if (byKey.has(k)) return byKey.get(k)
      for (const f of folders) {
        const hit = byKey.get(keyOf(f + '/' + t))
        if (hit) return hit
      }
      const tail = nearest(allFiles.filter((x) => keyOf(x).endsWith('/' + k)))
      if (tail) return tail
      const name = '/' + k.split('/').pop()
      const named = nearest(allFiles.filter((x) => ('/' + keyOf(x)).endsWith(name)))
      if (named) return named
    }
    return null
  }
}

/**
 * The data of a board (as the Interactive board keeps it in a .board file) made from the text of a .canvas file.
 * `resolve(file)` gives the vault path of a file the .canvas points to, or null when it is not in the vault (such a
 * node becomes a text card with its name). Throws when the text is not a JSON Canvas.
 */
export function canvasToBoard(text, resolve = (f) => cleanPath(str(f)) || null) {
  let src
  try {
    src = JSON.parse(text.replace(/^﻿/, '') || '{}')
  } catch {
    throw new Error('not JSON')
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('not a canvas')
  const nodes = Array.isArray(src.nodes) ? src.nodes : []
  const edges = Array.isArray(src.edges) ? src.edges : []

  const taken = new Set()
  const idOf = new Map()
  const freshId = (want) => {
    let id = typeof want === 'string' && want ? want : Math.random().toString(36).slice(2, 10)
    while (taken.has(id)) id += '_'
    taken.add(id)
    return id
  }

  const frames = []
  const cards = []
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const x = num(n.x)
    const y = num(n.y)
    if (x === null || y === null) continue
    let card
    if (n.type === 'text') {
      const t = str(n.text)
      const todo = todoLines(t)
      card = todo ? { type: 'todo', text: todo.join('\n') } : { type: 'text', text: t }
    } else if (n.type === 'file') {
      const file = str(n.file)
      const found = resolve(file)
      if (found && /\.md$/i.test(found)) card = { type: 'note', note: found }
      else if (found && IMAGE.test(found)) card = { type: 'image', src: found }
      // a file the board has no card for (a PDF, another canvas) or that is not in the vault: its name, as text
      else card = { type: 'text', text: '📎 ' + (file || '?') }
    } else if (n.type === 'link') {
      const url = str(n.url)
      card = url ? { type: 'link', url } : { type: 'text', text: '' }
    } else if (n.type === 'group') {
      card = { type: 'frame', text: str(n.label) }
    } else {
      // a kind of node of a newer JSON Canvas: kept as what it says, so nothing goes missing silently
      card = { type: 'text', text: str(n.text) || str(n.label) || str(n.url) || str(n.file) }
    }
    const [mw, mh] = MIN[card.type]
    const [dw, dh] = DEF[card.type]
    const w = num(n.width)
    const h = num(n.height)
    card = {
      id: freshId(n.id),
      ...card,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.max(mw, w ?? dw)),
      h: Math.round(Math.max(mh, h ?? dh))
    }
    const color = colorFromCanvas(n.color)
    if (color) card.color = color
    if (typeof n.id === 'string') idOf.set(n.id, card.id)
    ;(card.type === 'frame' ? frames : cards).push(card)
  }
  // the board draws frames under the cards in the order they come: a big group goes under the smaller ones inside it
  frames.sort((a, b) => b.w * b.h - a.w * a.h)
  const all = [...frames, ...cards]

  // moved so that its top left corner is where the board looks when it is opened
  if (all.length) {
    const dx = ORIGIN - Math.min(...all.map((c) => c.x))
    const dy = ORIGIN - Math.min(...all.map((c) => c.y))
    for (const c of all) {
      c.x += dx
      c.y += dy
    }
  }

  const links = []
  const pairs = new Set()
  for (const e of edges) {
    if (!e || typeof e !== 'object') continue
    let from = idOf.get(e.fromNode)
    let to = idOf.get(e.toNode)
    if (!from || !to || from === to) continue
    const atStart = e.fromEnd === 'arrow'
    const atEnd = e.toEnd === undefined ? true : e.toEnd === 'arrow'
    let head = atStart && atEnd ? 'both' : atEnd ? 'end' : 'none'
    // an arrow at the start only: the same arrow the other way
    if (atStart && !atEnd) {
      ;[from, to] = [to, from]
      head = 'end'
    }
    // the board keeps one arrow from a card to another
    if (pairs.has(from + '\n' + to)) continue
    pairs.add(from + '\n' + to)
    const link = { id: freshId(e.id), from, to, head, style: 'solid' }
    if (str(e.label)) link.label = e.label
    const color = colorFromCanvas(e.color)
    if (color) link.color = color
    links.push(link)
  }
  return { v: 3, cards: all, links, settings: { grid: 'dots', snapGrid: false, guides: true } }
}

/** The text of a .board file for these data (as the Interactive board writes it). */
export const boardText = (board) => JSON.stringify(board, null, 1) + '\n'

/** The text of a .canvas file made from the text of a .board file. Throws when it is not a board. */
export function boardToCanvas(text) {
  let b
  try {
    b = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new Error('not JSON')
  }
  if (!b || !Array.isArray(b.cards) || !Array.isArray(b.links)) throw new Error('not a board')
  const nodes = []
  const ids = new Set()
  for (const c of b.cards) {
    if (!c || typeof c.id !== 'string' || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue
    const type = DEF[c.type] ? c.type : 'text'
    const n = { id: c.id, x: Math.round(c.x), y: Math.round(c.y), width: Math.round(c.w ?? DEF[type][0]), height: Math.round(c.h ?? DEF[type][1]) }
    if (type === 'note' && c.note) Object.assign(n, { type: 'file', file: c.note })
    else if (type === 'image' && c.src) Object.assign(n, { type: 'file', file: c.src })
    else if (type === 'link' && c.url) Object.assign(n, { type: 'link', url: c.url })
    else if (type === 'frame') Object.assign(n, { type: 'group', ...(c.text ? { label: c.text } : {}) })
    else if (type === 'todo') {
      const lines = str(c.text).split('\n').map((l) => {
        const m = /^\[([ xX])\]\s?(.*)$/.exec(l)
        return m ? `- [${m[1] === ' ' ? ' ' : 'x'}] ${m[2]}` : l
      })
      Object.assign(n, { type: 'text', text: lines.join('\n') })
    } else Object.assign(n, { type: 'text', text: str(c.text) })
    // a sticky note without a colour of its own is yellow on the board
    const color = colorToCanvas(c.color || (type === 'sticky' ? PRESETS[3] : undefined))
    if (color) n.color = color
    nodes.push(n)
    ids.add(c.id)
  }
  const edges = []
  for (const l of b.links) {
    if (!l || typeof l.id !== 'string' || !ids.has(l.from) || !ids.has(l.to)) continue
    const head = l.head ?? 'end'
    const e = { id: l.id, fromNode: l.from, toNode: l.to, fromEnd: head === 'both' ? 'arrow' : 'none', toEnd: head === 'none' ? 'none' : 'arrow' }
    if (l.label) e.label = l.label
    const color = colorToCanvas(l.color)
    if (color) e.color = color
    edges.push(e)
  }
  return JSON.stringify({ nodes, edges }, null, '\t') + '\n'
}

/** A short mark of a text, to see whether a .canvas changed since it was converted. */
function signature(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36) + ':' + text.length
}

export default {
  onload(api) {
    const tt = (ru, en) => (api.language() === 'ru' ? ru : en)
    // which board each .canvas was converted to, and what the .canvas was then
    const data = () => api.data.get({ made: {} })
    const remember = (canvas, board, sig) => {
      const d = data()
      api.data.set({ ...d, made: { ...d.made, [canvas]: { board, sig } } })
    }

    const known = () => new Set(api.vault.listFiles().map((p) => p.toLowerCase()))
    /** `base.ext`, or `base 2.ext`... when that is taken. */
    const freePath = (base, ext) => {
      const taken = known()
      let p = `${base}.${ext}`
      for (let i = 2; taken.has(p.toLowerCase()); i++) p = `${base} ${i}.${ext}`
      return p
    }
    const hasBoards = () => api.commands.list().some((c) => c.id.startsWith('boards:'))
    const noBoards = () =>
      api.ui.notice(tt('Чтобы открыть доску, поставьте аддон «Интерактивная доска» (Аддоны → Каталог).', 'To open the board, install the Interactive board add-on (Add-ons → Catalog).'), 7000)

    /**
     * The board for a .canvas: the one made before when the .canvas has not changed since, else a new one
     * (or, when asked, that one made again). Its path, or null when the .canvas could not be read.
     */
    const convert = async (canvas, { quiet = false, ask = true, force = false } = {}) => {
      let text
      try {
        text = await api.vault.read(canvas)
      } catch {
        if (!quiet) api.ui.notice(tt('Не удалось прочитать ', 'Could not read ') + baseName(canvas))
        return null
      }
      // an empty file (or a canvas with nothing on it) is said so: no empty board is made of it
      let empty = !text.replace(/^﻿/, '').trim()
      if (!empty) {
        try {
          const src = JSON.parse(text.replace(/^﻿/, ''))
          empty = !!src && typeof src === 'object' && !Array.isArray(src) && !(Array.isArray(src.nodes) && src.nodes.length)
        } catch {
          /* not JSON: said below */
        }
      }
      if (empty) {
        if (!quiet) api.ui.notice(tt(`«${baseName(canvas)}» пуст: доска из него не сделана`, `"${baseName(canvas)}" is empty: no board was made of it`), 5000)
        return null
      }
      const sig = signature(text)
      const before = data().made[canvas]
      const files = known()
      const had = before && files.has(before.board.toLowerCase()) ? before.board : null
      if (had && before.sig === sig && !force) return had
      let target = null
      if (had && ask) {
        const again = await api.ui.confirm(
          force ? tt('Сделать доску заново', 'Make the board again') : tt('Canvas изменился', 'The canvas changed'),
          force
            ? tt(
                `Из «${baseName(canvas)}» уже сделана доска «${baseName(had)}». Сделать её заново? Правки на доске пропадут.`,
                `The board "${baseName(had)}" was already made from "${baseName(canvas)}". Make it again? Changes made on the board are lost.`
              )
            : tt(
                `«${baseName(canvas)}» изменился после того, как из него сделали доску «${baseName(had)}». Сделать её заново? Правки на доске пропадут.`,
                `"${baseName(canvas)}" changed since the board "${baseName(had)}" was made from it. Make the board again? Changes made on the board are lost.`
              ),
          tt('Сделать заново', 'Make again')
        )
        if (!again) return had
        target = had
      }
      let board
      try {
        board = canvasToBoard(text, makeResolver(api.vault.listFiles(), canvas))
      } catch {
        if (!quiet) api.ui.notice(tt(`«${baseName(canvas)}» — не JSON Canvas`, `"${baseName(canvas)}" is not a JSON Canvas`), 5000)
        return null
      }
      target ??= freePath(canvas.replace(/\.canvas$/i, ''), BOARD)
      await api.vault.write(target, boardText(board), true)
      remember(canvas, target, sig)
      return target
    }

    const openCanvas = async (canvas, force = false) => {
      const board = await convert(canvas, { force })
      if (!board) return
      if (hasBoards()) api.vault.open(board)
      else noBoards()
    }

    const convertMany = async (paths) => {
      if (!paths.length) {
        api.ui.notice(tt('Файлов .canvas нет', 'There are no .canvas files'))
        return
      }
      let ok = 0
      for (const p of paths) if (await convert(p, { quiet: true, ask: false })) ok++
      const failed = paths.length - ok
      api.ui.notice(
        tt(`Досок из .canvas: ${ok}`, `Boards from .canvas files: ${ok}`) + (failed ? tt(`, не прочитано: ${failed}`, `, not read: ${failed}`) : ''),
        5000
      )
    }
    const canvasesIn = (folder) => api.vault.listFiles(CANVAS).filter((p) => !folder || p.startsWith(folder + '/'))

    const exportBoard = async (path) => {
      let text
      try {
        text = boardToCanvas(await api.vault.read(path))
      } catch {
        api.ui.notice(tt('Данные доски повреждены', 'The data of this board is damaged'), 5000)
        return
      }
      const target = freePath(path.replace(/\.board$/i, ''), CANVAS)
      await api.vault.write(target, text, true)
      // that .canvas came from this board: a click on it opens the board, not a copy of it
      remember(target, path, signature(text))
      api.ui.notice(tt('Сохранено: ', 'Saved: ') + baseName(target), 4000)
    }

    api.files.handle(CANVAS, (p) => void openCanvas(p))

    api.commands.add({
      id: 'convert-all',
      name: { ru: 'Сделать доски из всех .canvas', en: 'Make boards of every .canvas' },
      run: () => void convertMany(canvasesIn(''))
    })

    api.menus.file((path, isFolder) => {
      if (isFolder) {
        if (!canvasesIn(path).length) return []
        return [{ label: { ru: 'Сделать доски из .canvas в папке', en: 'Make boards of the .canvas files here' }, action: () => void convertMany(canvasesIn(path)) }]
      }
      if (/\.canvas$/i.test(path)) return [{ label: { ru: 'Конвертировать в доску', en: 'Convert to a board' }, action: () => void openCanvas(path, true) }]
      if (/\.board$/i.test(path)) return [{ label: { ru: 'Сохранить как .canvas', en: 'Save as .canvas' }, action: () => void exportBoard(path) }]
      return []
    })

    // a .canvas or its board renamed, moved or sent to the recycle bin: what was made from what follows
    api.events.on('path-move', ({ from, to }) => {
      const made = { ...data().made }
      let changed = false
      const moved = (p) => (p === from ? to : p.startsWith(from + '/') && to ? to + p.slice(from.length) : p.startsWith(from + '/') ? null : p)
      for (const [canvas, entry] of Object.entries(made)) {
        const c = moved(canvas)
        const b = moved(entry.board)
        if (c === canvas && b === entry.board) continue
        changed = true
        delete made[canvas]
        if (c && b) made[c] = { ...entry, board: b }
      }
      if (changed) api.data.set({ ...data(), made })
    })
  }
}
