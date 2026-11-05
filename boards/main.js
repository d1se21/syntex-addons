// Boards: an interactive board in a tab of its own. Cards with text, cards that are notes of the vault, arrows between
// cards, colours; drag the background to move around, the wheel zooms. Each board is a note in the "Boards" folder
// (a fenced block with its data), so it lives in the vault, is backed up and synced with it, and is never lost with
// the add-on. The tab shows one board at a time; the list at the top switches between them.

const FOLDER = 'Boards'
const FENCE = 'syntex-board'

const TEXT = {
  ru: {
    title: 'Доски',
    open: 'Открыть доски',
    newBoard: 'Новая доска',
    namePrompt: 'Название доски',
    card: 'Карточка',
    note: 'Заметка',
    fit: 'Вписать',
    pickNote: 'Найти заметку…',
    nothing: 'Ничего не найдено',
    empty: 'Досок пока нет',
    emptyHint: 'Доска — это поле с карточками и стрелками. Создайте первую.',
    emptyBoard: 'Двойной клик по пустому месту добавляет карточку. Кружок справа у карточки тянется к другой карточке: так появляется стрелка.',
    addToBoard: 'Добавить на доску',
    openNote: 'Открыть заметку',
    broken: 'Данные доски повреждены, доска не изменяется: исправьте её заметку или создайте новую.',
    placeholder: 'Текст карточки',
    color: 'Цвет',
    delete: 'Удалить (Delete)',
    missing: 'Заметки нет'
  },
  en: {
    title: 'Boards',
    open: 'Open boards',
    newBoard: 'New board',
    namePrompt: 'Name of the board',
    card: 'Card',
    note: 'Note',
    fit: 'Fit',
    pickNote: 'Find a note…',
    nothing: 'Nothing found',
    empty: 'No boards yet',
    emptyHint: 'A board is a field with cards and arrows. Make the first one.',
    emptyBoard: 'A double click on an empty place adds a card. The dot at the right of a card is dragged to another card: that makes an arrow.',
    addToBoard: 'Add to the board',
    openNote: 'Open the note',
    broken: 'The data of this board is damaged, so it is left alone: fix its note or make a new board.',
    placeholder: 'Text of the card',
    color: 'Colour',
    delete: 'Delete (Delete)',
    missing: 'No such note'
  }
}

const COLORS = ['', '#8ab4f8', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#fcad70']
const NS = 'http://www.w3.org/2000/svg'

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const child of children) node.append(child)
  return node
}
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const nameOf = (path) => path.split('/').pop().replace(/\.md$/i, '')

const emptyBoard = () => ({ v: 1, cards: [], links: [], view: { x: 0, y: 0, k: 1 } })

/** The text of a board's note. */
function serialize(name, board) {
  return `# ${name}\n\n> Syntex board. It opens in the Boards tab; its data is the block below.\n\n\`\`\`${FENCE}\n${JSON.stringify(board, null, 1)}\n\`\`\`\n`
}

/** The board in a note's text, or null when there is none or it is damaged. */
function parse(text) {
  const m = new RegExp('```' + FENCE + '\\r?\\n([\\s\\S]*?)\\r?\\n```').exec(text)
  if (!m) return null
  try {
    const b = JSON.parse(m[1])
    if (!b || !Array.isArray(b.cards) || !Array.isArray(b.links)) return null
    b.cards = b.cards.filter((c) => c && typeof c.id === 'string' && Number.isFinite(c.x) && Number.isFinite(c.y))
    const ids = new Set(b.cards.map((c) => c.id))
    b.links = b.links.filter((l) => l && ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
    b.view = b.view && Number.isFinite(b.view.k) ? b.view : { x: 0, y: 0, k: 1 }
    return b
  } catch {
    return null
  }
}

export default {
  onload(api) {
    const t = () => TEXT[api.language()] ?? TEXT.en
    const data = () => api.data.get({ last: '' })

    const boardPaths = () =>
      api.vault
        .list()
        .filter((p) => p.startsWith(FOLDER + '/') && p.split('/').length === 2)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    // a note sent to the board while the tab is not open: added once it is
    let controller = null
    let pendingNotes = []

    const openBoards = () => api.views.open('main')

    /* ---------------- the tab ---------------- */

    const mountBoards = (root) => {
      root.classList.add('bd-root')
      let path = ''
      let board = null
      let broken = false
      let dirty = false
      let saveTimer = null
      let lastWritten = ''
      let selected = null // { kind: 'card' | 'link', id }
      let editing = null
      let alive = true

      /* --- the frame --- */
      const select = el('select', { className: 'bd-select' })
      const btn = (label, onclick, cls = '') => el('button', { className: 'btn bd-btn ' + cls, textContent: label, onclick })
      const swatches = el('div', { className: 'bd-swatches', title: t().color })
      const zoomLabel = el('span', { className: 'bd-zoom' })
      const toolbar = el('div', { className: 'bd-toolbar' })
      const canvas = el('div', { className: 'bd-canvas', tabIndex: 0 })
      const world = el('div', { className: 'bd-world' })
      const links = svgEl('svg', { class: 'bd-links', width: 1, height: 1 })
      const defs = svgEl('defs')
      const marker = svgEl('marker', { id: 'bd-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse' })
      marker.append(svgEl('path', { d: 'M0 0L10 5L0 10z', class: 'bd-arrow-head' }))
      defs.append(marker)
      links.append(defs)
      const linkLayer = svgEl('g')
      const temp = svgEl('line', { class: 'bd-temp', visibility: 'hidden' })
      links.append(linkLayer, temp)
      const cardLayer = el('div', { className: 'bd-cards' })
      world.append(links, cardLayer)
      const hint = el('div', { className: 'bd-hint' })
      canvas.append(world, hint)
      root.append(toolbar, canvas)

      const cardEls = new Map()

      /* --- saving --- */
      const write = async () => {
        clearTimeout(saveTimer)
        saveTimer = null
        if (!dirty || !board || broken || !path) return
        dirty = false
        const text = serialize(nameOf(path), board)
        lastWritten = text
        try {
          await api.vault.write(path, text, true)
        } catch (e) {
          dirty = true
          api.ui.notice(e instanceof Error ? e.message : String(e), 6000)
        }
      }
      const changed = () => {
        dirty = true
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => void write(), 500)
      }

      /* --- the view --- */
      const applyView = () => {
        const { x, y, k } = board.view
        world.style.transform = `translate(${x}px, ${y}px) scale(${k})`
        canvas.style.backgroundSize = `${24 * k}px ${24 * k}px`
        canvas.style.backgroundPosition = `${x}px ${y}px`
        zoomLabel.textContent = Math.round(k * 100) + '%'
      }
      const toWorld = (clientX, clientY) => {
        const r = canvas.getBoundingClientRect()
        return { x: (clientX - r.left - board.view.x) / board.view.k, y: (clientY - r.top - board.view.y) / board.view.k }
      }
      const fit = () => {
        if (!board.cards.length) {
          board.view = { x: 0, y: 0, k: 1 }
        } else {
          const r = canvas.getBoundingClientRect()
          const x0 = Math.min(...board.cards.map((c) => c.x))
          const y0 = Math.min(...board.cards.map((c) => c.y))
          const x1 = Math.max(...board.cards.map((c) => c.x + (c.w ?? 200)))
          const y1 = Math.max(...board.cards.map((c) => c.y + (c.h ?? 110)))
          const k = clamp(Math.min((r.width - 80) / Math.max(1, x1 - x0), (r.height - 80) / Math.max(1, y1 - y0)), 0.2, 1.5)
          board.view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k }
        }
        applyView()
        changed()
      }

      /* --- links (arrows) --- */
      const sizeOf = (c) => ({ w: c.w ?? 200, h: c.h ?? (c.note ? 52 : 110) })
      /** Where the line from the middle of card `a` towards card `b` leaves the edge of `a`. */
      const edgePoint = (a, b) => {
        const sa = sizeOf(a)
        const sb = sizeOf(b)
        const ax = a.x + sa.w / 2
        const ay = a.y + sa.h / 2
        const dx = b.x + sb.w / 2 - ax
        const dy = b.y + sb.h / 2 - ay
        if (!dx && !dy) return { x: ax, y: ay }
        const tt = Math.min(dx ? sa.w / 2 / Math.abs(dx) : Infinity, dy ? sa.h / 2 / Math.abs(dy) : Infinity)
        return { x: ax + dx * tt, y: ay + dy * tt }
      }
      const drawLinks = () => {
        linkLayer.replaceChildren()
        const byId = new Map(board.cards.map((c) => [c.id, c]))
        for (const l of board.links) {
          const a = byId.get(l.from)
          const b = byId.get(l.to)
          if (!a || !b) continue
          const p = edgePoint(a, b)
          const q = edgePoint(b, a)
          const g = svgEl('g', { class: 'bd-link' + (selected?.kind === 'link' && selected.id === l.id ? ' on' : '') })
          g.append(svgEl('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'bd-line', 'marker-end': 'url(#bd-arrow)' }))
          const hit = svgEl('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'bd-hit' })
          hit.addEventListener('pointerdown', (e) => {
            e.stopPropagation()
            select_({ kind: 'link', id: l.id })
            canvas.focus()
          })
          g.append(hit)
          linkLayer.append(g)
        }
      }

      /* --- cards --- */
      const select_ = (what) => {
        selected = what
        for (const [id, node] of cardEls) node.classList.toggle('on', what?.kind === 'card' && what.id === id)
        drawLinks()
        const card = what?.kind === 'card' ? board.cards.find((c) => c.id === what.id) : null
        for (const s of swatches.children) s.classList.toggle('on', !!card && (card.color ?? '') === s.dataset.color)
        swatches.classList.toggle('off', !card)
      }

      const place = (card, node) => {
        const s = sizeOf(card)
        node.style.left = card.x + 'px'
        node.style.top = card.y + 'px'
        node.style.width = s.w + 'px'
        node.style.height = s.h + 'px'
        node.style.setProperty('--c', card.color || 'transparent')
        node.classList.toggle('colored', !!card.color)
      }

      const startEdit = (card, node, body) => {
        if (editing) return
        editing = card.id
        const area = el('textarea', { className: 'bd-edit', value: card.text ?? '', placeholder: t().placeholder, spellcheck: false })
        body.replaceChildren(area)
        area.focus()
        area.setSelectionRange(area.value.length, area.value.length)
        const done = () => {
          if (editing !== card.id) return
          editing = null
          if (area.value !== (card.text ?? '')) {
            card.text = area.value
            changed()
          }
          renderBody(card, body)
        }
        area.onblur = done
        area.onkeydown = (e) => {
          e.stopPropagation()
          if (e.key === 'Escape') {
            area.value = card.text ?? ''
            area.blur()
          }
        }
      }

      const noteExists = (p) => api.vault.list().includes(p)
      const renderBody = (card, body) => {
        body.replaceChildren()
        if (card.note) {
          const ok = noteExists(card.note)
          const open = el('button', { className: 'bd-open', title: t().openNote, textContent: '↗' })
          open.onpointerdown = (e) => e.stopPropagation()
          open.onclick = () => ok && api.vault.open(card.note)
          body.append(el('span', { className: 'bd-note-name' + (ok ? '' : ' gone'), textContent: nameOf(card.note), title: ok ? card.note : t().missing }), open)
        } else {
          body.append(el('div', { className: 'bd-text', textContent: card.text ?? '' }))
        }
      }

      const makeCard = (card) => {
        const node = el('div', { className: 'bd-card' + (card.note ? ' is-note' : '') })
        const body = el('div', { className: 'bd-body' })
        const port = el('div', { className: 'bd-port', title: '→' })
        const grip = el('div', { className: 'bd-grip' })
        node.append(body, port, grip)
        renderBody(card, body)
        place(card, node)
        cardEls.set(card.id, node)
        cardLayer.append(node)

        node.addEventListener('dblclick', (e) => {
          e.stopPropagation()
          if (card.note) {
            if (noteExists(card.note)) api.vault.open(card.note)
          } else startEdit(card, node, body)
        })
        // moving the card
        node.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 || e.target === port || e.target === grip || e.target.closest('textarea, button')) return
          e.stopPropagation()
          select_({ kind: 'card', id: card.id })
          canvas.focus()
          const from = { x: e.clientX, y: e.clientY, cx: card.x, cy: card.y }
          node.setPointerCapture(e.pointerId)
          let moved = false
          const move = (ev) => {
            const k = board.view.k
            const dx = (ev.clientX - from.x) / k
            const dy = (ev.clientY - from.y) / k
            if (!moved && Math.hypot(dx, dy) * k < 3) return
            moved = true
            card.x = Math.round(from.cx + dx)
            card.y = Math.round(from.cy + dy)
            place(card, node)
            drawLinks()
          }
          const up = () => {
            node.removeEventListener('pointermove', move)
            node.removeEventListener('pointerup', up)
            node.removeEventListener('pointercancel', up)
            if (moved) changed()
          }
          node.addEventListener('pointermove', move)
          node.addEventListener('pointerup', up)
          node.addEventListener('pointercancel', up)
        })
        // resizing
        grip.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          select_({ kind: 'card', id: card.id })
          const from = { x: e.clientX, y: e.clientY, ...sizeOf(card) }
          grip.setPointerCapture(e.pointerId)
          const move = (ev) => {
            const k = board.view.k
            card.w = Math.round(clamp(from.w + (ev.clientX - from.x) / k, 120, 800))
            card.h = Math.round(clamp(from.h + (ev.clientY - from.y) / k, card.note ? 40 : 60, 800))
            place(card, node)
            drawLinks()
          }
          const up = () => {
            grip.removeEventListener('pointermove', move)
            grip.removeEventListener('pointerup', up)
            grip.removeEventListener('pointercancel', up)
            changed()
          }
          grip.addEventListener('pointermove', move)
          grip.addEventListener('pointerup', up)
          grip.addEventListener('pointercancel', up)
        })
        // drawing an arrow from the dot to another card
        port.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          port.setPointerCapture(e.pointerId)
          const s = sizeOf(card)
          temp.setAttribute('x1', card.x + s.w)
          temp.setAttribute('y1', card.y + s.h / 2)
          temp.setAttribute('visibility', 'visible')
          const move = (ev) => {
            const p = toWorld(ev.clientX, ev.clientY)
            temp.setAttribute('x2', p.x)
            temp.setAttribute('y2', p.y)
          }
          move(e)
          const up = (ev) => {
            port.removeEventListener('pointermove', move)
            port.removeEventListener('pointerup', up)
            port.removeEventListener('pointercancel', up)
            temp.setAttribute('visibility', 'hidden')
            const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.bd-card')
            const toId = [...cardEls].find(([, n]) => n === target)?.[0]
            if (toId && toId !== card.id && !board.links.some((l) => (l.from === card.id && l.to === toId) || (l.from === toId && l.to === card.id))) {
              board.links.push({ id: uid(), from: card.id, to: toId })
              drawLinks()
              changed()
            }
          }
          port.addEventListener('pointermove', move)
          port.addEventListener('pointerup', up)
          port.addEventListener('pointercancel', up)
        })
        return node
      }

      const addCard = (props, at) => {
        const s = { w: props.note ? 220 : 200, h: props.note ? 52 : 110 }
        const r = canvas.getBoundingClientRect()
        const center = toWorld(r.left + r.width / 2, r.top + r.height / 2)
        // a new card lands where it was asked for, or in the middle of the view, a little off the one before it
        const n = board.cards.length % 6
        const card = { id: uid(), x: Math.round((at?.x ?? center.x - s.w / 2 + n * 16) - (at ? s.w / 2 : 0)), y: Math.round((at?.y ?? center.y - s.h / 2 + n * 16) - (at ? s.h / 2 : 0)), ...props }
        board.cards.push(card)
        const node = makeCard(card)
        select_({ kind: 'card', id: card.id })
        changed()
        if (!props.note) startEdit(card, node, node.querySelector('.bd-body'))
        hint.hidden = true
        return card
      }

      const removeSelected = () => {
        if (!selected || !board) return
        if (selected.kind === 'card') {
          board.cards = board.cards.filter((c) => c.id !== selected.id)
          board.links = board.links.filter((l) => l.from !== selected.id && l.to !== selected.id)
          cardEls.get(selected.id)?.remove()
          cardEls.delete(selected.id)
        } else board.links = board.links.filter((l) => l.id !== selected.id)
        select_(null)
        changed()
        hint.hidden = board.cards.length > 0
      }

      /* --- the canvas: pan, zoom, new card --- */
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !board) return
        canvas.focus()
        select_(null)
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
          if (board.view.x !== from.vx || board.view.y !== from.vy) changed()
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
          const k0 = board.view.k
          const k = clamp(k0 * Math.exp(-e.deltaY * 0.0015), 0.2, 3)
          const px = e.clientX - r.left
          const py = e.clientY - r.top
          board.view.x = px - ((px - board.view.x) * k) / k0
          board.view.y = py - ((py - board.view.y) * k) / k0
          board.view.k = k
          applyView()
          clearTimeout(wheelTimer)
          wheelTimer = setTimeout(changed, 400)
        },
        { passive: false }
      )
      let wheelTimer = null
      canvas.addEventListener('dblclick', (e) => {
        if (!board || broken || e.target.closest('.bd-card')) return
        addCard({ text: '' }, toWorld(e.clientX, e.clientY))
      })
      canvas.addEventListener('keydown', (e) => {
        if (editing || e.target.closest('textarea')) return
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          removeSelected()
        } else if (e.key === 'Escape') select_(null)
      })

      /* --- loading a board --- */
      const show = (text) => {
        cardEls.clear()
        cardLayer.replaceChildren()
        selected = null
        editing = null
        // (an empty note in the folder is a new board; a note with other text and no board in it is left alone)
        const parsed = text === null || !text.trim() ? emptyBoard() : parse(text)
        broken = !parsed
        board = parsed ?? emptyBoard()
        for (const card of board.cards) makeCard(card)
        applyView()
        drawLinks()
        select_(null)
        hint.hidden = board.cards.length > 0 && !broken
        hint.textContent = broken ? t().broken : t().emptyBoard
        canvas.classList.toggle('readonly', broken)
      }

      const openPath = async (next) => {
        await write()
        path = next
        if (!path) {
          board = null
          cardLayer.replaceChildren()
          cardEls.clear()
          linkLayer.replaceChildren()
          hint.hidden = false
          hint.textContent = t().emptyHint
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

      const fillSelect = () => {
        const paths = boardPaths()
        select.replaceChildren(...paths.map((p) => el('option', { value: p, textContent: nameOf(p) })))
        if (path && paths.includes(path)) select.value = path
        select.hidden = !paths.length
        return paths
      }

      const createBoard = async () => {
        const raw = await api.ui.prompt(t().namePrompt, '')
        const name = raw?.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/[. ]+$/, '')
        if (!name) return null
        const taken = new Set(boardPaths())
        let next = `${FOLDER}/${name}.md`
        for (let i = 2; taken.has(next); i++) next = `${FOLDER}/${name} ${i}.md`
        await api.vault.write(next, serialize(nameOf(next), emptyBoard()), true)
        fillSelect()
        await openPath(next)
        select.value = next
        return next
      }

      /* --- the toolbar --- */
      const pickNote = (button) => {
        const r = button.getBoundingClientRect()
        api.ui.popup({
          x: r.left,
          y: r.bottom + 6,
          mount: (box, close) => {
            const input = el('input', { className: 'bd-find', placeholder: t().pickNote, spellcheck: false })
            const list = el('div', { className: 'bd-found' })
            const render = () => {
              const q = input.value.trim().toLowerCase()
              const found = api.vault
                .list()
                .filter((p) => !p.startsWith(FOLDER + '/') && (!q || p.toLowerCase().includes(q)))
                .slice(0, 40)
              list.replaceChildren(
                ...(found.length
                  ? found.map((p) => {
                      const b = el('button', { className: 'bd-found-row', textContent: p.replace(/\.md$/i, '') })
                      b.onclick = () => {
                        close()
                        addCard({ note: p })
                      }
                      return b
                    })
                  : [el('div', { className: 'bd-found-none', textContent: t().nothing })])
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

      select.onchange = () => void openPath(select.value)
      for (const color of COLORS) {
        const s = el('button', { className: 'bd-swatch' + (color ? '' : ' none'), title: t().color })
        s.dataset.color = color
        s.style.setProperty('--c', color || 'transparent')
        s.onclick = () => {
          const card = selected?.kind === 'card' ? board.cards.find((c) => c.id === selected.id) : null
          if (!card) return
          card.color = color || undefined
          place(card, cardEls.get(card.id))
          select_(selected)
          changed()
        }
        swatches.append(s)
      }
      const needBoard = (fn) => (e) => (board && !broken ? fn(e.currentTarget) : undefined)
      toolbar.append(
        select,
        btn(t().newBoard, () => void createBoard()),
        el('span', { className: 'bd-sep' }),
        btn('+ ' + t().card, needBoard(() => addCard({ text: '' }))),
        btn('+ ' + t().note, needBoard((b) => pickNote(b))),
        swatches,
        el('span', { className: 'bd-grow' }),
        btn(t().fit, () => board && fit()),
        zoomLabel,
        btn('🗑', () => removeSelected(), 'bd-trash')
      )
      toolbar.lastChild.title = t().delete

      /* --- the controller the rest of the add-on talks to --- */
      controller = {
        addNotes: (paths) => {
          if (!board || broken) {
            pendingNotes.push(...paths)
            return
          }
          const known = new Set(board.cards.filter((c) => c.note).map((c) => c.note))
          for (const p of paths) if (!known.has(p)) addCard({ note: p })
        },
        externalChange: async (changedPaths) => {
          if (!path || !changedPaths.includes(path)) fillSelect()
          else if (!dirty && !editing) {
            try {
              const text = await api.vault.read(path)
              if (text !== lastWritten) {
                lastWritten = text
                show(text)
              }
            } catch {
              /* the note is gone: the next switch of boards shows it */
            }
          }
          for (const [id, node] of cardEls) {
            const card = board?.cards.find((c) => c.id === id)
            if (card?.note) renderBody(card, node.querySelector('.bd-body'))
          }
        },
        flush: write
      }

      const paths = fillSelect()
      const last = data().last
      void openPath(paths.includes(last) ? last : paths[0] ?? '').then(() => {
        fillSelect()
        if (!paths.length) hint.textContent = t().emptyHint
      })

      return () => {
        alive = false
        clearTimeout(wheelTimer)
        void write()
        if (controller && alive === false) controller = null
      }
    }

    api.views.add({ id: 'main', title: { ru: TEXT.ru.title, en: TEXT.en.title }, mount: mountBoards })

    /* ---------------- the rest ---------------- */

    api.commands.add({ id: 'open', name: { ru: TEXT.ru.open, en: TEXT.en.open }, keys: 'Ctrl+Alt+B', run: openBoards })
    api.rail.add({
      id: 'open',
      title: { ru: TEXT.ru.title, en: TEXT.en.title },
      icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
      command: 'open',
      run: openBoards
    })
    // "Add to the board" in the menu of a note in the tree
    api.menus.file((path, isFolder) =>
      isFolder || !/\.md$/i.test(path) || path.startsWith(FOLDER + '/')
        ? []
        : [
            {
              label: { ru: TEXT.ru.addToBoard, en: TEXT.en.addToBoard },
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
      .bd-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
      .bd-btn { height: 30px; padding: 0 12px; }
      .bd-trash { padding: 0 8px; }
      .bd-select { height: 30px; min-width: 140px; max-width: 240px; }
      .bd-sep { width: 1px; height: 18px; background: var(--border); }
      .bd-grow { flex: 1; }
      .bd-zoom { min-width: 40px; text-align: right; color: var(--text-3); font-size: 12px; }
      .bd-swatches { display: flex; gap: 6px; padding: 0 4px; }
      .bd-swatches.off { opacity: .35; pointer-events: none; }
      .bd-swatch { width: 18px; height: 18px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .18); }
      .bd-swatch.none { background: transparent; box-shadow: inset 0 0 0 1px var(--text-3); }
      .bd-swatch.on { box-shadow: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--text-2); }
      .bd-canvas { position: relative; flex: 1; min-height: 0; overflow: hidden; outline: none; cursor: grab; touch-action: none;
        background-image: radial-gradient(circle, var(--border-2) 1px, transparent 1px); background-size: 24px 24px; }
      .bd-canvas.panning { cursor: grabbing; }
      .bd-world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }
      .bd-links { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
      .bd-line { stroke: var(--text-3); stroke-width: 2; fill: none; }
      .bd-arrow-head { fill: var(--text-3); }
      .bd-hit { stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; }
      .bd-link.on .bd-line { stroke: var(--accent); }
      .bd-temp { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 5 4; }
      .bd-card { position: absolute; box-sizing: border-box; background: var(--float-bg); border: 1px solid var(--border-2); border-radius: 10px; padding: 10px 12px; cursor: default; user-select: none; box-shadow: 0 2px 8px rgb(0 0 0 / .2); }
      .bd-card.colored { border-top: 4px solid var(--c); }
      .bd-card.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 2px 8px rgb(0 0 0 / .2); }
      .bd-body { height: 100%; overflow: hidden; display: flex; align-items: flex-start; gap: 8px; }
      .bd-card.is-note .bd-body { align-items: center; }
      .bd-text { white-space: pre-wrap; word-break: break-word; color: var(--text); font-size: 14px; line-height: 1.45; }
      .bd-note-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-size: 14px; }
      .bd-note-name.gone { color: var(--text-3); text-decoration: line-through; }
      .bd-open { color: var(--text-3); width: 24px; height: 24px; border-radius: 6px; }
      .bd-open:hover { background: var(--bg-hover); color: var(--text); }
      .bd-edit { width: 100%; height: 100%; resize: none; border: 0; outline: none; background: transparent; color: var(--text); font: inherit; font-size: 14px; line-height: 1.45; user-select: text; }
      .bd-port { position: absolute; right: -8px; top: 50%; width: 14px; height: 14px; margin-top: -7px; border-radius: 50%; background: var(--accent); opacity: 0; cursor: crosshair; border: 2px solid var(--bg-app); }
      .bd-card:hover .bd-port, .bd-card.on .bd-port { opacity: 1; }
      .bd-grip { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; opacity: 0;
        background: linear-gradient(135deg, transparent 50%, var(--text-3) 50%, var(--text-3) 58%, transparent 58%, transparent 72%, var(--text-3) 72%, var(--text-3) 80%, transparent 80%); }
      .bd-card:hover .bd-grip, .bd-card.on .bd-grip { opacity: .7; }
      .bd-hint { position: absolute; left: 50%; top: 40%; transform: translateX(-50%); max-width: 380px; text-align: center; color: var(--text-3); font-size: 14px; line-height: 1.5; pointer-events: none; }
      .bd-canvas.readonly .bd-card { opacity: .6; }
      .bd-find { width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; margin-bottom: 6px; border-radius: 7px; border: 1px solid var(--outline); background: var(--bg-app); color: var(--text); outline: none; }
      .bd-find:focus { border-color: var(--accent); }
      .bd-found { max-height: 260px; min-width: 260px; max-width: 360px; overflow-y: auto; }
      .bd-found-row { display: block; width: 100%; text-align: left; padding: 6px 10px; border-radius: 6px; font-size: 13px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bd-found-row:hover { background: var(--bg-hover); color: var(--text); }
      .bd-found-none { padding: 8px 10px; color: var(--text-3); font-size: 13px; }
    `)
  }
}
