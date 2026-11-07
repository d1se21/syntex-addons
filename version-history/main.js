// Version history: while a note is being written, its text is kept now and then (every 10 minutes of editing, and
// when it is opened), the last versions of every note. "Versions of the note" shows them by time, with what changed
// against the note as it is now, and puts an older one back. The versions live in the notes folder
// (.syntex/history), hidden from the tree, so they travel with the notes.

const DIR = '.syntex/history'
const MAX_NOTE = 2 * 1024 * 1024
const pad = (n) => String(n).padStart(2, '0')

/**
 * The name of the file of the versions of a note: its path with the characters a file name cannot hold written as
 * %XX (one note, one file: a/b.md and a__b.md never share one).
 */
const nameOf = (path) => path.replace(/\\/g, '/').replace(/\.md$/i, '').replace(/[%/:*?"<>|]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')) + '.json'
const fileOf = (path) => DIR + '/' + nameOf(path)

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children) node.append(c)
  return node
}

/** How many lines of `a` are not in `b`, and of `b` not in `a` (for the list: quick even for big notes). */
function countChanges(a, b) {
  const left = new Map()
  for (const l of a.split('\n')) left.set(l, (left.get(l) ?? 0) + 1)
  let add = 0
  for (const l of b.split('\n')) {
    const k = left.get(l) ?? 0
    if (k) left.set(l, k - 1)
    else add++
  }
  let del = 0
  for (const k of left.values()) del += k
  return { add, del }
}

/** What changed from `a` to `b`, line by line: [{ kind: 'same' | 'add' | 'del', text }] (a plain LCS; big texts by blocks). */
function diffLines(a, b) {
  const x = a.split('\n')
  const y = b.split('\n')
  if (x.length * y.length > 4_000_000) {
    // too big to compare line by line in a moment: the whole text as changed
    return [...x.map((text) => ({ kind: 'del', text })), ...y.map((text) => ({ kind: 'add', text }))]
  }
  const n = x.length
  const m = y.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ kind: 'same', text: x[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ kind: 'del', text: x[i++] })
    else out.push({ kind: 'add', text: y[j++] })
  }
  while (i < n) out.push({ kind: 'del', text: x[i++] })
  while (j < m) out.push({ kind: 'add', text: y[j++] })
  return out
}

export default {
  onload(api) {
    const ru = () => api.language() === 'ru'
    const tt = (r, e) => (ru() ? r : e)
    const settings = () => ({ every: 10, keep: 50, ...api.data.get({}) })

    /* ---------- the versions on disk ---------- */
    const readVersions = async (path) => {
      try {
        const data = JSON.parse(await api.vault.read(fileOf(path)))
        return Array.isArray(data.versions) ? data.versions.filter((v) => v && typeof v.text === 'string' && Number.isFinite(v.at)) : []
      } catch {
        return []
      }
    }
    const writeVersions = (path, versions) => api.vault.write(fileOf(path), JSON.stringify({ path, versions }, null, 1), true)

    // (one note at a time: two saves close together must not both read the old list and lose a version)
    const queues = new Map()
    const inQueue = (path, job) => {
      const run = (queues.get(path) ?? Promise.resolve()).then(job, job)
      queues.set(path, run)
      return run.finally(() => queues.get(path) === run && queues.delete(path))
    }

    // When the last version of each note was kept: a save within the interval reads nothing (the file of the versions
    // holds up to 100 copies of the note, and a note is saved after every pause in typing)
    const keptAt = new Map()

    /** Keep the text of the note as a version: always (force), or when the last one is older than the interval. */
    const keep = (path, force = false) =>
      inQueue(path, async () => {
        if (!/\.md$/i.test(path)) return
        if (!force && keptAt.has(path) && Date.now() - keptAt.get(path) < settings().every * 60_000) return
        let text
        try {
          text = await api.vault.read(path)
        } catch {
          return
        }
        if (text.length > MAX_NOTE) return
        const versions = await readVersions(path)
        const last = versions[versions.length - 1]
        if (last) keptAt.set(path, last.at)
        if (last && last.text === text) return
        if (!force && last && Date.now() - last.at < settings().every * 60_000) return
        versions.push({ at: Date.now(), text })
        keptAt.set(path, versions[versions.length - 1].at)
        while (versions.length > settings().keep) versions.shift()
        await writeVersions(path, versions)
        if (shownPath === path) void draw()
      }).catch(() => undefined)

    // opened: its text as it was before this session's edits; saved: now and then while it is written
    api.events.on('note-open', (path) => path && void keep(path, false))
    api.events.on('note-save', (path) => void keep(path, false))

    // a note renamed or moved in Syntex takes its versions along (API 8); one sent to the recycle bin keeps them,
    // for when it comes back
    const follow = (from, to) =>
      inQueue(from, async () => {
        keptAt.delete(from)
        keptAt.delete(to)
        if (!(await api.vault.exists(fileOf(from)))) return
        const there = await readVersions(to)
        if (!there.length) {
          if (await api.vault.exists(fileOf(to))) return
          await api.vault.rename(fileOf(from), nameOf(to).replace(/\.json$/, ''))
          return
        }
        // (both have versions: one list, by time)
        const all = [...there, ...(await readVersions(from))].sort((a, b) => a.at - b.at)
        while (all.length > settings().keep) all.shift()
        await writeVersions(to, all)
        await api.vault.write(fileOf(from), JSON.stringify({ path: from, versions: [] }), true)
      }).catch(() => undefined)
    if (api.apiVersion >= 8)
      api.events.on('path-move', ({ from, to }) => {
        if (!to || from === to || from.startsWith('.syntex/')) return
        if (/\.md$/i.test(from)) {
          void follow(from, to).then(() => {
            if (shownPath === from) {
              shownPath = to
              void draw()
            }
          })
          return
        }
        // a folder: the notes now in it were in the old one (once the tree is read again)
        setTimeout(() => {
          for (const p of api.vault.list()) if (p.startsWith(to + '/')) void follow(from + p.slice(to.length), p)
        }, 1500)
      })

    /* ---------- the tab of the versions ---------- */
    let shownPath = null
    let draw = async () => undefined

    const when = (at) => {
      const d = new Date(at)
      const today = new Date()
      const day = d.toDateString() === today.toDateString() ? tt('сегодня', 'today') : d.toDateString() === new Date(Date.now() - 86400000).toDateString() ? tt('вчера', 'yesterday') : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
      return `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    const mountView = (root) => {
      root.classList.add('vh-root')
      const head = el('div', { className: 'vh-head' })
      const list = el('div', { className: 'vh-list' })
      const preview = el('div', { className: 'vh-preview' })
      const tools = el('div', { className: 'vh-tools' })
      root.append(head, el('div', { className: 'vh-body' }, [list, el('div', { className: 'vh-right' }, [tools, preview])]))
      let chosen = -1
      let mode = 'diff'
      draw = async () => {
        const path = shownPath
        if (!path) {
          head.textContent = tt('Откройте заметку и выберите «Версии заметки».', 'Open a note and choose "Versions of the note".')
          list.replaceChildren()
          preview.replaceChildren()
          tools.replaceChildren()
          return
        }
        const versions = await readVersions(path)
        let now = ''
        try {
          now = await api.vault.read(path)
        } catch {
          /* the note is gone: its versions are still here */
        }
        head.replaceChildren(el('span', { className: 'vh-title', textContent: path.replace(/\.md$/i, '') }), el('span', { className: 'vh-count', textContent: tt(`версий: ${versions.length}`, `${versions.length} versions`) }))
        if (!versions.length) {
          list.replaceChildren(el('div', { className: 'vh-empty', textContent: tt('Версий пока нет: они появятся, пока вы пишете (раз в несколько минут).', 'No versions yet: they appear while you write (every few minutes).') }))
          preview.replaceChildren()
          tools.replaceChildren()
          return
        }
        if (chosen < 0 || chosen >= versions.length) chosen = versions.length - 1
        list.replaceChildren(
          ...versions
            .map((v, i) => {
              const { add, del } = countChanges(v.text, now)
              const same = v.text === now
              const row = el('button', { className: 'vh-row' + (i === chosen ? ' on' : '') }, [
                el('span', { className: 'vh-when', textContent: when(v.at) }),
                el('span', { className: 'vh-diff', textContent: same ? tt('как сейчас', 'as now') : `+${del} −${add}` })
              ])
              row.title = tt('Чем эта версия отличается от заметки сейчас: строк, которых теперь нет (+) и которые появились после (−)', 'How this version differs from the note now: lines gone since (+) and lines added since (−)')
              row.onclick = () => {
                chosen = i
                void draw()
              }
              return row
            })
            .reverse()
        )
        const v = versions[chosen]
        const restore = el('button', {
          className: 'btn',
          textContent: tt('Вернуть эту версию', 'Put this version back'),
          disabled: v.text === now,
          onclick: async () => {
            if (!(await api.ui.confirm(tt('Вернуть версию?', 'Put the version back?'), tt(`Текст заметки станет таким, каким он был ${when(v.at)}. Нынешний текст сохранится как версия.`, `The note will read as it did ${when(v.at)}. Its text of now is kept as a version.`), tt('Вернуть', 'Put back')))) return
            await keep(path, true)
            await api.vault.write(path, v.text, true)
            api.ui.notice(tt('Версия возвращена', 'The version is back'))
            void draw()
          }
        })
        const copy = el('button', {
          className: 'btn',
          textContent: tt('Скопировать текст', 'Copy the text'),
          onclick: async () => {
            try {
              await (api.ui.copy ? api.ui.copy(v.text) : navigator.clipboard.writeText(v.text))
              api.ui.notice(tt('Скопировано', 'Copied'), 1500)
            } catch {
              api.ui.notice(tt('Не удалось скопировать', 'Could not copy'))
            }
          }
        })
        const toggle = el('div', { className: 'vh-mode' }, [
          el('button', { className: mode === 'diff' ? 'on' : '', textContent: tt('Отличия от текущей', 'Changes since'), onclick: () => ((mode = 'diff'), void draw()) }),
          el('button', { className: mode === 'text' ? 'on' : '', textContent: tt('Текст версии', 'The text'), onclick: () => ((mode = 'text'), void draw()) })
        ])
        tools.replaceChildren(toggle, el('span', { className: 'vh-grow' }), copy, restore)
        if (mode === 'text') preview.replaceChildren(el('pre', { className: 'vh-text', textContent: v.text }))
        else {
          const d = diffLines(v.text, now)
          const changed = d.some((x) => x.kind !== 'same')
          preview.replaceChildren(
            changed
              ? el(
                  'div',
                  { className: 'vh-lines' },
                  d.map((x) => el('div', { className: 'vh-line ' + x.kind, textContent: (x.kind === 'del' ? '+ ' : x.kind === 'add' ? '− ' : '  ') + (x.text || ' ') }))
                )
              : el('div', { className: 'vh-empty', textContent: tt('Эта версия совпадает с заметкой сейчас.', 'This version is the note as it is now.') })
          )
        }
      }
      void draw()
      return () => {
        draw = async () => undefined
      }
    }
    api.views.add({ id: 'main', title: { ru: 'Версии', en: 'Versions' }, mount: mountView })

    const showFor = (path) => {
      shownPath = path
      void keep(path, false).then(() => draw())
      api.views.open('main')
      void draw()
    }
    const showActive = () => {
      const note = api.editor.active()
      if (!note) return api.ui.notice(tt('Откройте заметку', 'Open a note first'))
      showFor(note.path)
    }
    api.commands.add({ id: 'show', name: { ru: 'Версии заметки', en: 'Versions of the note' }, keys: 'Ctrl+Alt+H', run: showActive })
    api.commands.add({ id: 'keep', name: { ru: 'Сохранить версию заметки сейчас', en: 'Keep a version of the note now' }, run: () => {
      const note = api.editor.active()
      if (!note) return api.ui.notice(tt('Откройте заметку', 'Open a note first'))
      void keep(note.path, true).then(() => api.ui.notice(tt('Версия сохранена', 'Version kept'), 1500))
    } })
    api.menus.editor('end', (note) => [{ label: { ru: 'Версии заметки…', en: 'Versions of the note…' }, command: 'show', action: () => showFor(note.path) }])
    api.menus.file((path, isFolder) => (isFolder || !/\.md$/i.test(path) ? [] : [{ label: { ru: 'Версии…', en: 'Versions…' }, action: () => showFor(path) }]))

    api.settings.add([
      {
        id: 'every',
        type: 'select',
        title: { ru: 'Как часто', en: 'How often' },
        desc: { ru: 'Новая версия, пока заметку правят, не чаще, чем раз в…', en: 'A new version while the note is edited, at most once in…' },
        options: [5, 10, 30, 60].map((m) => ({ value: String(m), label: { ru: `${m} мин`, en: `${m} min` } })),
        value: () => String(settings().every),
        onChange: (v) => api.data.set({ ...settings(), every: Number(v) })
      },
      {
        id: 'keep',
        type: 'select',
        title: { ru: 'Сколько хранить', en: 'How many to keep' },
        desc: { ru: 'Последних версий каждой заметки', en: 'The last versions of every note' },
        options: [20, 50, 100].map((n) => ({ value: String(n), label: String(n) })),
        value: () => String(settings().keep),
        onChange: (v) => api.data.set({ ...settings(), keep: Number(v) })
      }
    ])

    api.ui.addStyle(`
      .vh-root { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg-app); }
      .vh-head { display: flex; align-items: baseline; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border); color: var(--text-3); }
      .vh-title { color: var(--text); font-size: 16px; font-weight: 600; }
      .vh-body { flex: 1; min-height: 0; display: flex; }
      .vh-list { width: 230px; flex: none; overflow-y: auto; border-right: 1px solid var(--border); padding: 6px; }
      .vh-row { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 10px; border-radius: 7px; text-align: left; color: var(--text-2); font-size: 13px; }
      .vh-row:hover { background: var(--bg-hover); color: var(--text); }
      .vh-row.on { background: var(--bg-hover); color: var(--text); box-shadow: inset 2px 0 0 var(--accent); }
      .vh-diff { color: var(--text-3); font-variant-numeric: tabular-nums; }
      .vh-right { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .vh-tools { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
      .vh-tools .btn { height: 30px; padding: 0 12px; }
      .vh-grow { flex: 1; }
      .vh-mode { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--bg-panel); }
      .vh-mode button { padding: 5px 10px; border-radius: 6px; font-size: 12.5px; color: var(--text-3); }
      .vh-mode button.on { background: var(--bg-hover); color: var(--text); }
      .vh-preview { flex: 1; min-height: 0; overflow: auto; padding: 12px 16px; }
      .vh-text, .vh-lines { margin: 0; font-family: 'Cascadia Code', Consolas, monospace; font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; color: var(--text-2); }
      .vh-line.del { background: rgb(80 200 120 / 0.13); color: var(--text); }
      .vh-line.add { background: rgb(240 90 90 / 0.13); color: var(--text-3); text-decoration: line-through; }
      .vh-empty { padding: 14px; color: var(--text-3); font-size: 13px; line-height: 1.5; }
    `)
  }
}
