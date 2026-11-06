// Daily notes: one note a day (Ctrl+Alt+D, the button on the left, or the start page), made from a template, in a folder
// of their own, named by the date in the form chosen in the settings. The previous and the next daily note are a
// command away.

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FORMATS = ['YYYY-MM-DD', 'DD.MM.YYYY', 'D MMMM YYYY']
const ICON = 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3'
const pad = (n) => String(n).padStart(2, '0')

/** The name of the daily note of a day, without .md. */
function nameFor(d, format, language) {
  if (format === 'DD.MM.YYYY') return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  if (format === 'D MMMM YYYY') return language === 'ru' ? `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}` : `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The day a daily note is of, read from its name in any of the forms (or null when the name is not a date). */
function dateOf(name) {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(name)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(name)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(name)
  if (m && MONTHS_RU.includes(m[2])) return new Date(+m[3], MONTHS_RU.indexOf(m[2]), +m[1])
  m = /^(\S+) (\d{1,2}), (\d{4})$/.exec(name)
  if (m && MONTHS_EN.includes(m[1])) return new Date(+m[3], MONTHS_EN.indexOf(m[1]), +m[2])
  return null
}
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children) node.append(c)
  return node
}

export default {
  onload(api) {
    const ru = () => api.language() === 'ru'
    const tt = (r, e) => (ru() ? r : e)
    const settings = () => ({ folder: tt('Ежедневные', 'Daily'), format: FORMATS[0], template: '', ...api.data.get({}) })
    const setSettings = (patch) => api.data.set({ ...settings(), ...patch })
    const folderOf = () => settings().folder.replace(/^\/+|\/+$/g, '').trim()
    const pathFor = (d) => {
      const f = folderOf()
      return (f ? f + '/' : '') + nameFor(d, settings().format, api.language()) + '.md'
    }

    /** The daily notes there are, oldest first: { path, date }. */
    const dailyNotes = () => {
      const f = folderOf()
      return api.vault
        .list()
        .filter((p) => (f ? p.startsWith(f + '/') && p.split('/').length === f.split('/').length + 1 : !p.includes('/')))
        .map((p) => ({ path: p, date: dateOf(p.split('/').pop().replace(/\.md$/i, '')) }))
        .filter((x) => x.date)
        .sort((a, b) => a.date - b.date)
    }

    /** The text a new daily note starts with: the template note (if set and there), or the built-in one. */
    const startText = async (d) => {
      const title = nameFor(d, settings().format, api.language())
      const weekday = (ru() ? DAYS_RU : DAYS_EN)[d.getDay()]
      const now = new Date()
      let text = ru() ? '# {{title}}\n\n{{weekday}}\n\n## Задачи\n\n- [ ] \n\n## Заметки\n\n' : '# {{title}}\n\n{{weekday}}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n'
      const t = settings().template.trim()
      if (t) {
        const path = /\.md$/i.test(t) ? t : t + '.md'
        try {
          text = await api.vault.read(path)
        } catch {
          api.ui.notice(tt(`Шаблон «${t}» не найден: взят обычный`, `The template "${t}" is not there: the usual one is used`), 5000)
        }
      }
      return text
        .replace(/\{\{\s*(title|название)\s*\}\}/gi, title)
        .replace(/\{\{\s*(date|дата)\s*\}\}/gi, dayKey(d))
        .replace(/\{\{\s*(weekday|день недели|день)\s*\}\}/gi, weekday.charAt(0).toUpperCase() + weekday.slice(1))
        .replace(/\{\{\s*(time|время)\s*\}\}/gi, `${pad(now.getHours())}:${pad(now.getMinutes())}`)
    }

    /** Open the daily note of a day, making it (and its folder) when it is not there. */
    const openDay = async (d) => {
      const path = pathFor(d)
      try {
        if (!(await api.vault.exists(path))) {
          if (folderOf() && api.vault.createFolder) await api.vault.createFolder(folderOf())
          await api.vault.write(path, await startText(d), true)
        }
        api.vault.open(path)
      } catch (e) {
        api.ui.notice(e instanceof Error ? e.message : String(e), 6000)
      }
    }
    const today = () => void openDay(new Date())

    /** The daily note before or after the one open now (or today, when the open note is not a daily one). */
    const step = (dir) => {
      const open = api.editor.active()?.path
      const name = open?.split('/').pop().replace(/\.md$/i, '')
      const from = (name && dateOf(name)) || new Date()
      const key = dayKey(from)
      const list = dailyNotes()
      const next = dir < 0 ? [...list].reverse().find((x) => dayKey(x.date) < key) : list.find((x) => dayKey(x.date) > key)
      if (next) api.vault.open(next.path)
      else api.ui.notice(dir < 0 ? tt('Более ранних ежедневных заметок нет', 'No earlier daily note') : tt('Более поздних ежедневных заметок нет', 'No later daily note'))
    }

    api.commands.add({ id: 'today', name: { ru: 'Сегодняшняя заметка', en: "Today's note" }, keys: 'Ctrl+Alt+D', run: today })
    api.commands.add({ id: 'previous', name: { ru: 'Предыдущая ежедневная заметка', en: 'Previous daily note' }, run: () => step(-1) })
    api.commands.add({ id: 'next', name: { ru: 'Следующая ежедневная заметка', en: 'Next daily note' }, run: () => step(1) })
    api.rail.add({ id: 'today', title: { ru: 'Сегодняшняя заметка', en: "Today's note" }, icon: ICON, command: 'today', run: today })

    // on the start page: today, and the last days there are notes for (drawn again when files change)
    const drawers = new Set()
    api.events.on('vault-change', () => drawers.forEach((d) => d()))
    api.startPage.add({
      title: { ru: 'Ежедневные заметки', en: 'Daily notes' },
      mount: (box) => {
        const draw = () => {
          const list = dailyNotes().slice(-6).reverse()
          const todayPath = pathFor(new Date())
          box.replaceChildren(
            el('div', { className: 'dn-list' }, [
              el('button', { className: 'dn-row dn-today', textContent: tt('Сегодня', 'Today') + ' · ' + nameFor(new Date(), settings().format, api.language()), onclick: today }),
              ...list
                .filter((x) => x.path !== todayPath)
                .map((x) => {
                  const wd = (ru() ? DAYS_RU : DAYS_EN)[x.date.getDay()]
                  return el('button', { className: 'dn-row', onclick: () => api.vault.open(x.path) }, [
                    el('span', { textContent: x.path.split('/').pop().replace(/\.md$/i, '') }),
                    el('span', { className: 'dn-wd', textContent: wd })
                  ])
                })
            ])
          )
        }
        draw()
        drawers.add(draw)
        return () => drawers.delete(draw)
      }
    })

    // settings: the folder, the form of the name, the template
    const textRow = (id, title, desc, value, onSave, placeholder, suggest) => ({
      id,
      type: 'mount',
      title,
      desc,
      mount: (box) => {
        const input = el('input', { className: 'dn-input', value: value(), placeholder, spellcheck: false })
        if (suggest) {
          const list = el('datalist', { id: 'dn-' + id })
          for (const p of suggest()) list.append(el('option', { value: p }))
          input.setAttribute('list', 'dn-' + id)
          box.append(list)
        }
        const save = () => onSave(input.value.trim())
        input.onchange = save
        input.onkeydown = (e) => e.key === 'Enter' && (save(), input.blur())
        box.append(input)
      }
    })
    const example = new Date(2026, 10, 6)
    api.settings.add([
      textRow('folder', { ru: 'Папка', en: 'Folder' }, { ru: 'Куда кладутся ежедневные заметки (пусто — в корень)', en: 'Where daily notes go (empty: the top of the vault)' }, () => settings().folder, (v) => setSettings({ folder: v }), tt('Ежедневные', 'Daily')),
      {
        id: 'format',
        type: 'select',
        title: { ru: 'Имя заметки', en: 'Name of the note' },
        options: FORMATS.map((f) => ({ value: f, label: { ru: nameFor(example, f, 'ru'), en: nameFor(example, f, 'en') } })),
        value: () => settings().format,
        onChange: (v) => setSettings({ format: v })
      },
      textRow(
        'template',
        { ru: 'Шаблон', en: 'Template' },
        { ru: 'Заметка, с которой начинается новая; в ней можно писать {{название}}, {{дата}}, {{день недели}}, {{время}}. Пусто — обычный шаблон', en: 'A note a new one starts with; it may hold {{title}}, {{date}}, {{weekday}}, {{time}}. Empty: the usual one' },
        () => settings().template,
        (v) => setSettings({ template: v.replace(/\.md$/i, '') }),
        tt('например, Шаблоны/День', 'e.g. Templates/Day'),
        () => api.vault.list().map((p) => p.replace(/\.md$/i, ''))
      )
    ])

    api.ui.addStyle(`
      .dn-list { display: flex; flex-direction: column; gap: 2px; }
      .dn-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 10px; border-radius: 7px; text-align: left; color: var(--text-2); font-size: 13px; }
      .dn-row:hover { background: var(--bg-hover); color: var(--text); }
      .dn-today { color: var(--text); font-weight: 500; }
      .dn-wd { color: var(--text-3); }
      .dn-input { width: 220px; height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--outline); background: var(--bg-app); color: var(--text); outline: none; box-sizing: border-box; }
      .dn-input:focus { border-color: var(--accent); }
    `)
  }
}
