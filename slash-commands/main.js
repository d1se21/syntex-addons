// Slash commands: "/" at the start of a line (or after a space) opens a list of what can be put there: headings,
// lists, a task, a quote, a table, code, a callout, a rule, a link to a note, the date and time, and what other
// add-ons offer (today's note, a voice note, a template). Typing filters it, ↑↓ choose, Enter or Tab puts it in,
// Esc closes it; the "/" and what was typed after it are replaced.

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children) node.append(c)
  return node
}
const pad = (n) => String(n).padStart(2, '0')

export default {
  onload(api) {
    const { ViewPlugin, keymap, EditorView } = api.lib.view
    const { Prec } = api.lib.state
    const ru = () => api.language() === 'ru'
    const tt = (r, e) => (ru() ? r : e)

    /** Put `text` in place of the "/" and the query; the caret goes to `caret` within it (or its end). */
    const put = (view, from, to, text, caret = text.length) => {
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + caret }, userEvent: 'input' })
      view.focus()
    }
    /** A block that wants a line of its own: a line break before it when the line has text before the "/". */
    const block = (view, from, to, text, caret) => {
      const line = view.state.doc.lineAt(from)
      const before = view.state.sliceDoc(line.from, from).trim() ? '\n' : ''
      put(view, from, to, before + text, before.length + (caret ?? text.length))
    }
    /** A prefix of the line (heading, list...): the line starts with it. */
    const prefix = (mark) => (view, from, to) => {
      const line = view.state.doc.lineAt(from)
      const rest = view.state.sliceDoc(line.from, from) + view.state.sliceDoc(to, line.to)
      const bare = rest.replace(/^(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
      view.dispatch({ changes: { from: line.from, to: line.to, insert: mark + bare }, selection: { anchor: line.from + mark.length + bare.length }, userEvent: 'input' })
      view.focus()
    }
    const now = () => new Date()
    const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    /** A command of another add-on, when that add-on is on. */
    const command = (id) => (api.commands.list ? api.commands.list().some((c) => c.id === id) : false)

    const items = () => {
      const list = [
        { ru: 'Заголовок 1', en: 'Heading 1', keys: 'h1 # заголовок heading', hint: '#', run: prefix('# ') },
        { ru: 'Заголовок 2', en: 'Heading 2', keys: 'h2 ## заголовок heading', hint: '##', run: prefix('## ') },
        { ru: 'Заголовок 3', en: 'Heading 3', keys: 'h3 ### заголовок heading', hint: '###', run: prefix('### ') },
        { ru: 'Список', en: 'List', keys: 'list bullet список маркер', hint: '-', run: prefix('- ') },
        { ru: 'Нумерованный список', en: 'Numbered list', keys: 'number ordered нумерованный', hint: '1.', run: prefix('1. ') },
        { ru: 'Задача', en: 'Task', keys: 'todo task check задача чек', hint: '[ ]', run: prefix('- [ ] ') },
        { ru: 'Цитата', en: 'Quote', keys: 'quote цитата', hint: '>', run: prefix('> ') },
        { ru: 'Выноска', en: 'Callout', keys: 'callout note выноска', hint: '[!note]', run: (v, f, t) => block(v, f, t, '> [!note] ') },
        { ru: 'Таблица', en: 'Table', keys: 'table таблица', hint: '|', run: (v, f, t) => block(v, f, t, tt('| Столбец 1 | Столбец 2 |\n| --- | --- |\n|  |  |\n', '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n'), tt('| Столбец 1 | Столбец 2 |\n| --- | --- |\n| ', '| Column 1 | Column 2 |\n| --- | --- |\n| ').length) },
        { ru: 'Блок кода', en: 'Code block', keys: 'code код', hint: '```', run: (v, f, t) => block(v, f, t, '```\n\n```\n', 4) },
        { ru: 'Разделитель', en: 'Divider', keys: 'rule divider hr линия разделитель', hint: '---', run: (v, f, t) => block(v, f, t, '---\n') },
        { ru: 'Ссылка на заметку', en: 'Link to a note', keys: 'link ссылка wiki', hint: '[[ ]]', run: (v, f, t) => put(v, f, t, '[[]]', 2) },
        { ru: 'Сегодняшняя дата', en: "Today's date", keys: 'date дата today сегодня', hint: isoDate(now()), run: (v, f, t) => (command('date-time:date') ? (put(v, f, t, ''), api.commands.run('date-time:date')) : put(v, f, t, isoDate(now()))) },
        { ru: 'Текущее время', en: 'Current time', keys: 'time время', hint: `${pad(now().getHours())}:${pad(now().getMinutes())}`, run: (v, f, t) => (command('date-time:time') ? (put(v, f, t, ''), api.commands.run('date-time:time')) : put(v, f, t, `${pad(now().getHours())}:${pad(now().getMinutes())}`)) }
      ]
      // what other add-ons give, while they are on
      if (command('templates:insert')) list.push({ ru: 'Шаблон…', en: 'Template…', keys: 'template шаблон', hint: '', run: (v, f, t) => (put(v, f, t, ''), api.commands.run('templates:insert')) })
      if (command('voice-notes:record')) list.push({ ru: 'Голосовая заметка', en: 'Voice note', keys: 'voice audio голос запись', hint: '', run: (v, f, t) => (put(v, f, t, ''), api.commands.run('voice-notes:record')) })
      if (command('daily-notes:today')) list.push({ ru: 'Сегодняшняя заметка', en: "Today's note", keys: 'daily today ежедневная сегодня', hint: '', run: (v, f, t) => (put(v, f, t, ''), api.commands.run('daily-notes:today')) })
      return list
    }

    /* ---------- the list, one for every editor that shows it ---------- */
    let open = null // { view, from, chosen, shown: [items], box }

    const close = () => {
      open?.box.remove()
      open = null
    }
    api.onDispose(close)

    const queryOf = (o) => o.view.state.sliceDoc(o.from + 1, o.view.state.selection.main.head)

    /** What fits what was typed after the "/". */
    const fitting = () => {
      const q = queryOf(open).toLowerCase()
      return items().filter((it) => !q || `${it.ru} ${it.en} ${it.keys}`.toLowerCase().includes(q))
    }

    const draw = () => {
      if (!open) return
      const shown = fitting()
      if (!shown.length) {
        // nothing fits: the list goes, the "/" stays as typed
        close()
        return
      }
      open.shown = shown
      open.chosen = Math.min(open.chosen, shown.length - 1)
      open.box.replaceChildren(
        ...shown.map((it, i) => {
          const row = el('div', { className: 'sl-row' + (i === open.chosen ? ' on' : '') }, [el('span', { textContent: ru() ? it.ru : it.en }), el('span', { className: 'sl-hint', textContent: it.hint })])
          row.onmousedown = (e) => {
            e.preventDefault()
            apply(i)
          }
          return row
        })
      )
      const at = open.view.coordsAtPos(open.from)
      if (at) {
        const h = open.box.offsetHeight
        const below = at.bottom + 6 + h < window.innerHeight
        open.box.style.left = Math.min(at.left, window.innerWidth - 270) + 'px'
        open.box.style.top = (below ? at.bottom + 6 : Math.max(6, at.top - 6 - h)) + 'px'
      }
      open.box.querySelector('.sl-row.on')?.scrollIntoView({ block: 'nearest' })
    }

    const apply = (i) => {
      if (!open) return
      const { view, from } = open
      const to = view.state.selection.main.head
      // (Enter right after typing, before the list was drawn again: what fits now, not what was shown)
      const it = fitting()[i]
      close()
      if (it) it.run(view, from, to)
    }

    // the "/" typed at the start of a line or after a space opens the list; moving off it closes it
    const watcher = ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.view = view
        }
        update(u) {
          if (open && open.view !== u.view) return
          if (open) {
            const head = u.state.selection.main.head
            if (u.docChanged) open.from = u.changes.mapPos(open.from)
            const q = head > open.from ? u.state.sliceDoc(open.from, head) : ''
            // (a space may be part of the query, «/сегодняшняя заметка»; "/ ", two spaces or a new line end it;
            // what fits nothing closes it when drawn)
            if (head <= open.from || !q.startsWith('/') || /^\/\s|\s\s|\n/.test(q) || q.length > 30) close()
            // (drawn after the update: the editor may not be measured while it updates)
            else requestAnimationFrame(draw)
            return
          }
          if (!u.docChanged || !u.transactions.some((tr) => tr.isUserEvent('input.type'))) return
          const head = u.state.selection.main.head
          if (head < 1 || u.state.sliceDoc(head - 1, head) !== '/') return
          const before = head >= 2 ? u.state.sliceDoc(head - 2, head - 1) : ''
          if (before && !/\s/.test(before)) return
          // (not inside code: there "/" is just a character)
          const line = u.state.doc.lineAt(head)
          if (/^\s*(```|~~~)/.test(line.text)) return
          open = { view: u.view, from: head - 1, chosen: 0, shown: [], box: el('div', { className: 'sl-box' }) }
          document.body.append(open.box)
          requestAnimationFrame(draw)
        }
        destroy() {
          if (open?.view === this.view) close()
        }
      }
    )
    const keys = Prec.highest(
      keymap.of([
        { key: 'ArrowDown', run: () => (open ? ((open.chosen = (open.chosen + 1) % Math.max(1, open.shown.length)), draw(), true) : false) },
        { key: 'ArrowUp', run: () => (open ? ((open.chosen = (open.chosen - 1 + open.shown.length) % Math.max(1, open.shown.length)), draw(), true) : false) },
        { key: 'Enter', run: () => (open ? (apply(open.chosen), true) : false) },
        { key: 'Tab', run: () => (open ? (apply(open.chosen), true) : false) },
        { key: 'Escape', run: () => (open ? (close(), true) : false) }
      ])
    )
    api.editor.addExtension([watcher, keys, EditorView.domEventHandlers({ blur: () => setTimeout(() => open && !open.view.hasFocus && close(), 150) })])

    api.ui.addStyle(`
      .sl-box { position: fixed; z-index: 3000; width: 260px; max-height: 300px; overflow-y: auto; padding: 5px; border-radius: 10px; background: var(--float-bg); border: 1px solid var(--border-2); box-shadow: 0 10px 30px rgba(0,0,0,.35); }
      .sl-row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 10px; border-radius: 6px; font-size: 13px; color: var(--text-2); cursor: pointer; }
      .sl-row.on, .sl-row:hover { background: var(--bg-hover); color: var(--text); }
      .sl-hint { color: var(--text-3); font-family: 'Cascadia Code', Consolas, monospace; font-size: 12px; }
    `)
  }
}
