// Tags: #tags in the text are coloured and can be clicked (Ctrl+click puts the caret in them instead). A click opens the
// Tags tab: every tag of the vault with the number of notes, and the notes of the chosen one with the line it stands
// on; a click on a line opens the note there.

const TAG = /(^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_\-/]*)/gu
const ICON = 'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16'
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children) node.append(c)
  return node
}

export default {
  onload(api) {
    const { ViewPlugin, Decoration, MatchDecorator, EditorView } = api.lib.view
    const { syntaxTree } = api.lib.language
    const tt = (r, e) => (api.language() === 'ru' ? r : e)

    /* ---------- in the text ---------- */
    const marks = new MatchDecorator({
      regexp: TAG,
      decorate: (add, from, to, m, view) => {
        const start = from + m[1].length
        // not in code, a link or a heading's # (a heading has a space after its #)
        const node = syntaxTree(view.state).resolveInner(start, 1)
        for (let n = node; n; n = n.parent) if (/Code|URL|Link|HTML/.test(n.name)) return
        add(start, to, Decoration.mark({ class: 'tg-tag', attributes: { 'data-tag': m[2] } }))
      }
    })
    const plugin = ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.decorations = marks.createDeco(view)
        }
        update(u) {
          this.decorations = marks.updateDeco(u, this.decorations)
        }
      },
      { decorations: (p) => p.decorations }
    )
    const clicks = EditorView.domEventHandlers({
      mousedown: (e) => {
        const tag = e.target instanceof Element ? e.target.closest('.tg-tag') : null
        // (Ctrl+click: the caret goes into the tag, to change it, as with links)
        if (!tag || e.button !== 0 || e.ctrlKey || e.metaKey) return false
        e.preventDefault()
        show(tag.getAttribute('data-tag'))
        return true
      }
    })
    api.editor.addExtension([plugin, clicks])

    /* ---------- the tab of the tags ---------- */
    let chosen = null
    let redraw = () => undefined
    const mountView = (root) => {
      root.classList.add('tg-root')
      const search = el('input', { className: 'tg-find', placeholder: tt('Найти тег…', 'Find a tag…'), spellcheck: false })
      const list = el('div', { className: 'tg-list' })
      const notes = el('div', { className: 'tg-notes' })
      root.append(el('div', { className: 'tg-side' }, [search, list]), notes)
      let index = []
      const load = async () => {
        index = await api.vault.links()
        draw()
      }
      const draw = () => {
        // tag (lower case) -> { name as written most, places }
        const tags = new Map()
        for (const f of index)
          for (const t of f.tags) {
            const key = t.target.toLowerCase()
            const e = tags.get(key) ?? { name: t.target, places: [] }
            e.places.push({ path: f.path, line: t.line, snippet: t.snippet })
            tags.set(key, e)
          }
        const q = search.value.trim().toLowerCase().replace(/^#/, '')
        const all = [...tags.entries()].sort((a, b) => new Set(b[1].places.map((p) => p.path)).size - new Set(a[1].places.map((p) => p.path)).size || a[0].localeCompare(b[0]))
        list.replaceChildren(
          ...(all.length
            ? all
                .filter(([key]) => !q || key.includes(q))
                .map(([key, e]) => {
                  const b = el('button', { className: 'tg-row' + (chosen?.toLowerCase() === key ? ' on' : '') }, [el('span', { textContent: '#' + e.name }), el('span', { className: 'tg-n', textContent: String(new Set(e.places.map((p) => p.path)).size) })])
                  b.onclick = () => {
                    chosen = e.name
                    draw()
                  }
                  return b
                })
            : [el('div', { className: 'tg-empty', textContent: tt('Тегов пока нет. Напишите в заметке, например, #проект.', 'No tags yet. Write one in a note, #project say.') })])
        )
        const e = chosen ? tags.get(chosen.toLowerCase()) : null
        if (!e) {
          notes.replaceChildren(el('div', { className: 'tg-empty', textContent: all.length ? tt('Выберите тег слева.', 'Choose a tag on the left.') : '' }))
          return
        }
        const byNote = new Map()
        for (const p of e.places) byNote.set(p.path, [...(byNote.get(p.path) ?? []), p])
        notes.replaceChildren(
          el('div', { className: 'tg-head', textContent: `#${e.name} · ${tt('заметок', 'notes')}: ${byNote.size}` }),
          ...[...byNote.entries()].map(([path, places]) =>
            el('div', { className: 'tg-note' }, [
              el('button', { className: 'tg-note-name', textContent: path.replace(/\.md$/i, ''), onclick: () => api.vault.open(path) }),
              ...places.map((p) => el('button', { className: 'tg-line', textContent: p.snippet, title: tt(`Строка ${p.line}`, `Line ${p.line}`), onclick: () => api.vault.open(path, p.line) }))
            ])
          )
        )
      }
      search.oninput = draw
      redraw = () => void load()
      void load()
      return () => {
        redraw = () => undefined
      }
    }
    api.views.add({ id: 'main', title: { ru: 'Теги', en: 'Tags' }, mount: mountView })
    // (a note that changed may have new tags)
    let later = null
    api.events.on('vault-change', () => {
      clearTimeout(later)
      later = setTimeout(() => redraw(), 600)
    })
    api.onDispose(() => clearTimeout(later))

    const show = (tag) => {
      chosen = tag ?? chosen
      api.views.open('main')
      redraw()
    }
    api.commands.add({ id: 'open', name: { ru: 'Все теги', en: 'All tags' }, run: () => show(null) })
    api.rail.add({ id: 'open', title: { ru: 'Теги', en: 'Tags' }, icon: ICON, command: 'open', run: () => show(null) })

    api.ui.addStyle(`
      .tg-tag { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border-radius: 4px; padding: 0 2px; cursor: pointer; }
      .tg-tag:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
      .tg-root { display: flex; height: 100%; min-height: 0; background: var(--bg-app); }
      .tg-side { width: 240px; flex: none; display: flex; flex-direction: column; border-right: 1px solid var(--border); padding: 10px; gap: 8px; }
      .tg-find { height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--outline); background: var(--bg-panel); color: var(--text); outline: none; }
      .tg-find:focus { border-color: var(--accent); }
      .tg-list { flex: 1; overflow-y: auto; }
      .tg-row { display: flex; justify-content: space-between; width: 100%; padding: 7px 10px; border-radius: 7px; font-size: 13px; color: var(--text-2); text-align: left; }
      .tg-row:hover { background: var(--bg-hover); color: var(--text); }
      .tg-row.on { background: var(--bg-hover); color: var(--text); box-shadow: inset 2px 0 0 var(--accent); }
      .tg-n { color: var(--text-3); }
      .tg-notes { flex: 1; min-width: 0; overflow-y: auto; padding: 16px 20px; }
      .tg-head { color: var(--text); font-size: 16px; font-weight: 600; margin-bottom: 12px; }
      .tg-note { margin-bottom: 14px; }
      .tg-note-name { display: block; color: var(--text); font-weight: 500; padding: 4px 0; text-align: left; }
      .tg-note-name:hover { color: var(--accent); }
      .tg-line { display: block; width: 100%; text-align: left; padding: 5px 10px; border-radius: 6px; color: var(--text-3); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tg-line:hover { background: var(--bg-hover); color: var(--text-2); }
      .tg-empty { color: var(--text-3); font-size: 13px; line-height: 1.5; padding: 8px; }
    `)
  }
}
