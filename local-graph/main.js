// Mini graph: a small square window in the corner of the open note that shows this note's own links as a graph:
// the notes it links to and the notes that link to it (and, one level further, theirs). A click on a node opens
// that note. The window follows the note in front; it folds to a title bar, or goes with Ctrl+Alt+G.

const TEXT = {
  ru: {
    title: 'Связи',
    toggle: 'Мини-граф заметки: показать или скрыть',
    deeper: 'Показать связи соседей',
    nearer: 'Только прямые связи',
    fold: 'Свернуть',
    unfold: 'Развернуть',
    close: 'Скрыть',
    none: 'Связей нет',
    loading: 'Читаю заметки…',
    size: 'Размер окна',
    corner: 'Угол',
    small: 'Маленькое',
    medium: 'Среднее',
    large: 'Большое',
    br: 'Справа внизу',
    bl: 'Слева внизу',
    tr: 'Справа вверху',
    tl: 'Слева вверху',
    links: 'связей'
  },
  en: {
    title: 'Links',
    toggle: 'Mini graph of the note: show or hide',
    deeper: 'Show the links of the neighbours',
    nearer: 'Direct links only',
    fold: 'Fold',
    unfold: 'Unfold',
    close: 'Hide',
    none: 'No links',
    loading: 'Reading the notes…',
    size: 'Size of the window',
    corner: 'Corner',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    br: 'Bottom right',
    bl: 'Bottom left',
    tr: 'Top right',
    tl: 'Top left',
    links: 'links'
  }
}

const SIZES = { small: 170, medium: 230, large: 300 }
const MAX_NODES = 40
const NS = 'http://www.w3.org/2000/svg'

const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
  return n
}
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children) node.append(c)
  return node
}

const nameOf = (path) => path.split('/').pop().replace(/\.md$/i, '')
const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

/** "a/b/../c" -> "a/c" */
function joinRel(dir, rel) {
  const out = dir ? dir.split('/') : []
  for (const part of rel.split('/')) {
    if (part === '..') out.pop()
    else if (part && part !== '.') out.push(part)
  }
  return out.join('/')
}

/** The targets a note's text links to, as typed: [[Note]], [[folder/Note|alias]], [text](other.md). */
function rawTargets(text) {
  const wiki = []
  const md = []
  let fence = null
  for (const raw of text.split(/\r?\n/)) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(raw)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null
      continue
    }
    if (f) {
      fence = f[1]
      continue
    }
    const line = raw.replace(/(`+)[^`]*?\1/g, (s) => ' '.repeat(s.length))
    for (const m of line.matchAll(/(!?)\[\[([^\]\n]+?)\]\]/g)) {
      let target = m[2].split('|')[0].split('#')[0].split('^')[0].trim()
      if (!target) continue
      // an embedded picture or file is not a link to a note
      if (/\.[a-z0-9]{2,5}$/i.test(target) && !/\.md$/i.test(target)) continue
      wiki.push(target.replace(/\.md$/i, ''))
    }
    for (const m of line.matchAll(/(!?)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (m[1]) continue
      let url = m[2].replace(/^<|>$/g, '')
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) continue
      try {
        url = decodeURIComponent(url)
      } catch {
        /* as typed */
      }
      url = url.split(/[?#]/)[0]
      if (/\.md$/i.test(url)) md.push(url)
    }
  }
  return { wiki, md }
}

export default {
  onload(api) {
    const t = () => TEXT[api.language()] ?? TEXT.en
    const data = () => ({ shown: true, folded: false, depth: 1, size: 'medium', corner: 'br', ...api.data.get({}) })
    const setData = (patch) => api.data.set({ ...data(), ...patch })

    /* ---------------- the index of links ---------------- */

    /** path -> [targets as typed] */
    const raw = new Map()
    /** path -> Set of paths it links to (resolved) */
    let out = new Map()
    /** path -> Set of paths linking to it */
    let inc = new Map()
    let ready = false
    let dirty = true

    const resolveAll = () => {
      const paths = [...raw.keys()]
      const byName = new Map()
      const byPath = new Map()
      for (const p of paths) {
        const lower = p.toLowerCase().replace(/\.md$/i, '')
        byPath.set(lower, p)
        const n = nameOf(p).toLowerCase()
        byName.set(n, [...(byName.get(n) ?? []), p])
      }
      const next = new Map()
      const back = new Map()
      for (const [from, { wiki, md }] of raw) {
        const set = new Set()
        for (const target of wiki) {
          const lower = target.toLowerCase()
          let hit
          if (target.includes('/')) hit = byPath.get(lower) ?? byPath.get(lower.replace(/^\/+/, ''))
          if (!hit) {
            const candidates = (byName.get(lower.split('/').pop()) ?? []).slice().sort((a, b) => a.split('/').length - b.split('/').length)
            hit = candidates.find((c) => dirOf(c) === dirOf(from)) ?? candidates[0]
          }
          if (hit && hit !== from) set.add(hit)
        }
        for (const url of md) {
          const hit = byPath.get(joinRel(dirOf(from), url).toLowerCase().replace(/\.md$/i, ''))
          if (hit && hit !== from) set.add(hit)
        }
        next.set(from, set)
        for (const to of set) back.set(to, (back.get(to) ?? new Set()).add(from))
      }
      out = next
      inc = back
      dirty = false
    }

    const readOne = async (path) => {
      try {
        raw.set(path, rawTargets(await api.vault.read(path)))
      } catch {
        raw.delete(path)
      }
    }

    const readAll = async () => {
      const paths = api.vault.list()
      const alive = new Set(paths)
      for (const p of [...raw.keys()]) if (!alive.has(p)) raw.delete(p)
      for (let i = 0; i < paths.length; i += 24) await Promise.all(paths.slice(i, i + 24).map(readOne))
      ready = true
      dirty = true
      schedule()
    }

    let changed = new Set()
    let changeTimer = null
    const changedSoon = (paths) => {
      for (const p of paths) changed.add(p)
      clearTimeout(changeTimer)
      changeTimer = setTimeout(async () => {
        const batch = [...changed]
        changed = new Set()
        const known = new Set(api.vault.list())
        for (const p of batch) {
          if (!/\.md$/i.test(p)) continue
          if (known.has(p)) await readOne(p)
          else raw.delete(p)
        }
        // a note that came or went may also change what other notes' links point at
        dirty = true
        schedule()
      }, 300)
    }

    /* ---------------- the neighbourhood of one note, laid out ---------------- */

    /** The note, the notes one step away, and (depth 2) their neighbours, at most MAX_NODES, with the links among them. */
    const neighbourhood = (path, depth) => {
      if (dirty) resolveAll()
      const dist = new Map([[path, 0]])
      let frontier = [path]
      for (let d = 1; d <= depth; d++) {
        const next = []
        for (const p of frontier) {
          for (const q of [...(out.get(p) ?? []), ...(inc.get(p) ?? [])]) {
            if (dist.has(q) || dist.size >= MAX_NODES) continue
            dist.set(q, d)
            next.push(q)
          }
        }
        frontier = next
      }
      const ids = [...dist.keys()]
      const edges = []
      for (const a of ids) for (const b of out.get(a) ?? []) if (dist.has(b)) edges.push([a, b])
      return { ids, dist, edges }
    }

    /** A small force layout, the same every time for the same neighbourhood: the note stays in the middle. */
    const layout = (ids, dist, edges) => {
      const n = ids.length
      const pos = ids.map((id, i) => {
        if (i === 0) return { x: 0, y: 0 }
        const a = (i / Math.max(1, n - 1)) * Math.PI * 2 + (dist.get(id) === 2 ? 0.4 : 0)
        const r = dist.get(id) === 1 ? 0.5 : 0.9
        return { x: Math.cos(a) * r, y: Math.sin(a) * r }
      })
      const index = new Map(ids.map((id, i) => [id, i]))
      const k = 0.55 / Math.sqrt(Math.max(1, n) / 4)
      for (let step = 0; step < 160; step++) {
        const cool = 1 - step / 160
        const force = pos.map(() => ({ x: 0, y: 0 }))
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            let dx = pos[i].x - pos[j].x
            let dy = pos[i].y - pos[j].y
            const d = Math.max(0.02, Math.hypot(dx, dy))
            const f = (k * k) / d
            dx /= d
            dy /= d
            force[i].x += dx * f
            force[i].y += dy * f
            force[j].x -= dx * f
            force[j].y -= dy * f
          }
        }
        for (const [a, b] of edges) {
          const i = index.get(a)
          const j = index.get(b)
          let dx = pos[i].x - pos[j].x
          let dy = pos[i].y - pos[j].y
          const d = Math.max(0.02, Math.hypot(dx, dy))
          const f = (d * d) / k
          dx /= d
          dy /= d
          force[i].x -= dx * f
          force[i].y -= dy * f
          force[j].x += dx * f
          force[j].y += dy * f
        }
        for (let i = 1; i < n; i++) {
          force[i].x -= pos[i].x * 0.4
          force[i].y -= pos[i].y * 0.4
          const len = Math.max(0.001, Math.hypot(force[i].x, force[i].y))
          const move = Math.min(len, 0.08 * cool + 0.004)
          pos[i].x += (force[i].x / len) * move
          pos[i].y += (force[i].y / len) * move
        }
      }
      const extent = Math.max(0.01, ...pos.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
      return pos.map((p) => ({ x: p.x / extent, y: p.y / extent }))
    }

    /* ---------------- the window ---------------- */

    let box = null
    let host = null
    let shownFor = ''
    let lastPane = null
    let drawKey = ''

    const visiblePane = (pane) => !!pane && pane.isConnected && pane.offsetParent !== null && pane.getBoundingClientRect().width > 0
    const paneOf = () => {
      if (visiblePane(lastPane)) return lastPane
      return [...document.querySelectorAll('.editor-pane')].find(visiblePane) ?? null
    }

    const remove = () => {
      box?.remove()
      box = null
      host = null
      shownFor = ''
      drawKey = ''
    }

    let rafId = 0
    function schedule() {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        refresh()
      })
    }

    function refresh() {
      const d = data()
      const note = api.editor.active()
      const pane = paneOf()
      if (!d.shown || !note || !pane) return remove()
      if (!box) {
        box = el('div', { className: 'lg-box' })
      }
      if (box.parentElement !== pane) pane.append(box)
      const key = [note.path, d.depth, d.size, d.corner, d.folded, ready, dirty, raw.size].join('|')
      if (key === drawKey) return
      drawKey = key
      draw(note.path, d)
    }

    function draw(path, d) {
      const side = SIZES[d.size] ?? SIZES.medium
      box.className = `lg-box lg-${d.corner}${d.folded ? ' folded' : ''}`
      box.style.setProperty('--lg-size', side + 'px')
      box.replaceChildren()

      const head = el('div', { className: 'lg-head' })
      const title = el('span', { className: 'lg-title', textContent: t().title })
      const count = el('span', { className: 'lg-count' })
      const btn = (label, glyph, onclick) => el('button', { className: 'lg-btn', title: label, textContent: glyph, onclick })
      head.append(
        title,
        count,
        btn(d.depth === 1 ? t().deeper : t().nearer, d.depth === 1 ? '◎' : '●', () => setData({ depth: d.depth === 1 ? 2 : 1 }) || schedule()),
        btn(d.folded ? t().unfold : t().fold, d.folded ? '▢' : '–', () => setData({ folded: !d.folded }) || schedule()),
        btn(t().close, '×', () => setData({ shown: false }) || schedule())
      )
      box.append(head)
      if (d.folded) return

      const body = el('div', { className: 'lg-body' })
      box.append(body)
      if (!ready) {
        body.append(el('div', { className: 'lg-empty', textContent: t().loading }))
        return
      }
      const { ids, dist, edges } = neighbourhood(path, d.depth)
      count.textContent = ids.length > 1 ? `${ids.length - 1}` : ''
      count.title = t().links
      if (ids.length === 1) {
        body.append(el('div', { className: 'lg-empty', textContent: t().none }))
        return
      }
      const pos = layout(ids, dist, edges)
      const R = side / 2 - 20
      const px = (i) => side / 2 + pos[i].x * R
      const py = (i) => (side - 36) / 2 + pos[i].y * (R - 10) + 2
      const root = svg('svg', { width: side, height: side - 36, viewBox: `0 0 ${side} ${side - 36}` })
      const index = new Map(ids.map((id, i) => [id, i]))
      for (const [a, b] of edges) {
        const i = index.get(a)
        const j = index.get(b)
        root.append(svg('line', { x1: px(i), y1: py(i), x2: px(j), y2: py(j), class: 'lg-edge' + (a === path || b === path ? ' near' : '') }))
      }
      const caption = el('div', { className: 'lg-caption', textContent: nameOf(path) })
      ids.forEach((id, i) => {
        const current = i === 0
        const g = svg('g', { class: 'lg-node' + (current ? ' current' : '') + (dist.get(id) === 2 ? ' far' : '') })
        g.append(svg('circle', { cx: px(i), cy: py(i), r: current ? 7 : dist.get(id) === 1 ? 5 : 4 }))
        // a larger invisible target: the dots are small
        g.append(svg('circle', { cx: px(i), cy: py(i), r: 11, class: 'lg-hit' }))
        g.addEventListener('mouseenter', () => (caption.textContent = nameOf(id)))
        g.addEventListener('mouseleave', () => (caption.textContent = nameOf(path)))
        if (!current) g.addEventListener('click', () => api.vault.open(id))
        root.append(g)
      })
      body.append(root, caption)
    }

    /* ---------------- wiring ---------------- */

    api.ui.addStyle(`
      .editor-pane { position: relative; }
      .lg-box { position: absolute; z-index: 20; width: var(--lg-size, 230px); background: var(--float-bg); border: 1px solid var(--border-2); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.3); overflow: hidden; font-size: 12px; color: var(--text-2); }
      .lg-br { right: 18px; bottom: 52px; } .lg-bl { left: 18px; bottom: 52px; } .lg-tr { right: 18px; top: 52px; } .lg-tl { left: 18px; top: 52px; }
      .lg-head { display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 4px 0 10px; border-bottom: 1px solid var(--border); }
      .lg-box.folded .lg-head { border-bottom: 0; }
      .lg-title { flex: 1; color: var(--text); font-weight: 500; }
      .lg-count { color: var(--text-3); margin-right: 4px; }
      .lg-btn { width: 22px; height: 22px; border-radius: 5px; color: var(--text-3); line-height: 1; }
      .lg-btn:hover { background: var(--bg-hover); color: var(--text); }
      .lg-body svg { display: block; }
      .lg-edge { stroke: var(--text-3); stroke-opacity: .35; stroke-width: 1; }
      .lg-edge.near { stroke-opacity: .6; }
      .lg-node circle { fill: var(--text-3); }
      .lg-node.far circle { fill-opacity: .55; }
      .lg-node.current circle { fill: var(--accent); }
      .lg-node .lg-hit { fill: transparent; }
      .lg-node:not(.current) { cursor: pointer; }
      .lg-node:not(.current):hover circle:not(.lg-hit) { fill: var(--text); }
      .lg-caption { height: 36px; padding: 0 10px; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; color: var(--text-2); }
      .lg-empty { height: 120px; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
    `)

    // the pane the user works in: the box goes to the one with the focus
    const onFocus = (e) => {
      const pane = e.target instanceof Element ? e.target.closest('.editor-pane') : null
      if (pane && pane !== lastPane) {
        lastPane = pane
        schedule()
      }
    }
    document.addEventListener('focusin', onFocus, true)
    window.addEventListener('resize', schedule)
    api.onDispose(() => {
      document.removeEventListener('focusin', onFocus, true)
      window.removeEventListener('resize', schedule)
      clearTimeout(changeTimer)
      if (rafId) cancelAnimationFrame(rafId)
      remove()
    })

    api.events.on('note-open', () => schedule())
    api.events.on('note-save', (path) => changedSoon([path]))
    api.events.on('vault-change', (paths) => changedSoon(paths))
    api.tabs.onChange(schedule)

    api.commands.add({
      id: 'toggle',
      name: { ru: TEXT.ru.toggle, en: TEXT.en.toggle },
      keys: 'Ctrl+Alt+G',
      run: () => {
        setData({ shown: !data().shown })
        schedule()
      }
    })

    const choice = (id, titleKey, keys, descKey) => ({
      id,
      type: 'select',
      title: { ru: TEXT.ru[titleKey], en: TEXT.en[titleKey] },
      options: keys.map((k) => ({ value: k, label: { ru: TEXT.ru[k], en: TEXT.en[k] } })),
      value: () => data()[id],
      onChange: (v) => {
        setData({ [id]: v })
        schedule()
      }
    })
    api.settings.add([choice('size', 'size', ['small', 'medium', 'large']), choice('corner', 'corner', ['br', 'bl', 'tr', 'tl'])])

    void readAll()
  }
}
