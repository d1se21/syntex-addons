// Templates: the notes of a folder ("Шаблоны" / "Templates") are templates. "Insert a template" puts one at the caret,
// "New note from a template" makes a note of it; {{название}}, {{дата}}, {{время}}, {{день недели}} (or {{title}},
// {{date}}, {{time}}, {{weekday}}) become the name of the note, the date, the time and the day.

const DAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const pad = (n) => String(n).padStart(2, '0')
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children) node.append(c)
  return node
}

export default {
  onload(api) {
    const ru = () => api.language() === 'ru'
    const tt = (r, e) => (ru() ? r : e)
    const settings = () => ({ folder: tt('Шаблоны', 'Templates'), ...api.data.get({}) })
    const folder = () => settings().folder.replace(/^\/+|\/+$/g, '').trim()
    const templates = () => {
      const f = folder()
      return api.vault
        .list()
        .filter((p) => (f ? p.startsWith(f + '/') : !p.includes('/')))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }
    const nameOf = (p) => p.split('/').pop().replace(/\.md$/i, '')

    /** The text of a template, with its words filled in for a note of that name. */
    const fill = (text, title) => {
      const d = new Date()
      const weekday = (ru() ? DAYS_RU : DAYS_EN)[d.getDay()]
      // (functions, not strings: a "$&" or "$1" in the name of a note is put in as typed)
      return text
        .replace(/\{\{\s*(title|название)\s*\}\}/gi, () => title)
        .replace(/\{\{\s*(date|дата)\s*\}\}/gi, () => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
        .replace(/\{\{\s*(time|время)\s*\}\}/gi, () => `${pad(d.getHours())}:${pad(d.getMinutes())}`)
        .replace(/\{\{\s*(weekday|день недели)\s*\}\}/gi, () => weekday.charAt(0).toUpperCase() + weekday.slice(1))
    }

    /** No templates yet: the folder is made, with one to start from. */
    const firstTemplate = async () => {
      const f = folder() || tt('Шаблоны', 'Templates')
      const path = `${f}/${tt('Встреча', 'Meeting')}.md`
      const ok = await api.ui.confirm(
        tt('Шаблонов пока нет', 'No templates yet'),
        tt(`Шаблоны — это заметки в папке «${f}». Создать её с примером шаблона?`, `Templates are the notes of the folder "${f}". Make it, with a template to start from?`),
        tt('Создать', 'Make it')
      )
      if (!ok) return
      if (api.vault.createFolder) await api.vault.createFolder(f)
      await api.vault.write(
        path,
        tt(
          '# {{название}}\n\n{{день недели}}, {{дата}}, {{время}}\n\n## Участники\n\n- \n\n## Обсудили\n\n- \n\n## Решили\n\n- [ ] \n',
          '# {{title}}\n\n{{weekday}}, {{date}}, {{time}}\n\n## People\n\n- \n\n## Talked about\n\n- \n\n## Decided\n\n- [ ] \n'
        ),
        true
      )
      api.vault.open(path)
    }

    /** A list of the templates to choose from (a box in the middle of the window), then `done(path)`. */
    const choose = (title, done) => {
      const list = templates()
      if (!list.length) return void firstTemplate()
      api.ui.popup({
        x: Math.round(window.innerWidth / 2 - 150),
        y: 120,
        mount: (box, close) => {
          const input = el('input', { className: 'tp-find', placeholder: title, spellcheck: false })
          const rows = el('div', { className: 'tp-list' })
          let at = 0
          const render = () => {
            const q = input.value.trim().toLowerCase()
            const shown = list.filter((p) => !q || nameOf(p).toLowerCase().includes(q))
            at = Math.min(at, Math.max(0, shown.length - 1))
            rows.replaceChildren(
              ...(shown.length
                ? shown.map((p, i) => {
                    const b = el('button', { className: 'tp-row' + (i === at ? ' on' : ''), textContent: nameOf(p) })
                    b.onclick = () => {
                      close()
                      done(p)
                    }
                    return b
                  })
                : [el('div', { className: 'tp-none', textContent: tt('Ничего не найдено', 'Nothing found') })])
            )
            rows._shown = shown
          }
          input.oninput = () => ((at = 0), render())
          input.onkeydown = (e) => {
            const shown = rows._shown ?? []
            if (e.key === 'ArrowDown') ((at = (at + 1) % Math.max(1, shown.length)), render(), e.preventDefault())
            else if (e.key === 'ArrowUp') ((at = (at - 1 + shown.length) % Math.max(1, shown.length)), render(), e.preventDefault())
            else if (e.key === 'Enter' && shown[at]) {
              close()
              done(shown[at])
            }
          }
          box.append(el('div', { className: 'tp-title', textContent: title }), input, rows)
          render()
          requestAnimationFrame(() => input.focus())
        }
      })
    }

    const insert = () => {
      const note = api.editor.active()
      if (!note) return api.ui.notice(tt('Откройте заметку', 'Open a note first'))
      choose(tt('Вставить шаблон', 'Insert a template'), async (p) => {
        try {
          note.insert(fill(await api.vault.read(p), nameOf(note.path)))
        } catch (e) {
          api.ui.notice(e instanceof Error ? e.message : String(e), 5000)
        }
      })
    }

    const newFrom = (dir = '') =>
      choose(tt('Новая заметка из шаблона', 'New note from a template'), async (p) => {
        const raw = await api.ui.prompt(tt('Название заметки', 'Name of the note'), nameOf(p))
        const name = raw?.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/[. ]+$/, '')
        if (!name) return
        const at = dir ? dir + '/' : ''
        let path = `${at}${name}.md`
        for (let i = 2; await api.vault.exists(path); i++) path = `${at}${name} ${i}.md`
        try {
          await api.vault.write(path, fill(await api.vault.read(p), name), true)
          api.vault.open(path)
        } catch (e) {
          api.ui.notice(e instanceof Error ? e.message : String(e), 5000)
        }
      })

    api.commands.add({ id: 'insert', name: { ru: 'Вставить шаблон', en: 'Insert a template' }, keys: 'Ctrl+Alt+T', run: insert })
    api.commands.add({ id: 'new', name: { ru: 'Новая заметка из шаблона', en: 'New note from a template' }, run: () => newFrom('') })
    api.menus.editor('insert', () => [{ label: { ru: 'Шаблон…', en: 'Template…' }, icon: 'file', command: 'insert', action: insert }])
    api.menus.file((path, isFolder) => (isFolder ? [{ label: { ru: 'Новая заметка из шаблона…', en: 'New note from a template…' }, action: () => newFrom(path) }] : []))

    api.settings.add([
      {
        id: 'folder',
        type: 'mount',
        title: { ru: 'Папка шаблонов', en: 'Folder of the templates' },
        desc: { ru: 'Каждая заметка в ней — шаблон', en: 'Every note in it is a template' },
        mount: (box) => {
          const input = el('input', { className: 'tp-input', value: settings().folder, spellcheck: false })
          const save = () => api.data.set({ ...settings(), folder: input.value.trim() })
          input.onchange = save
          input.onkeydown = (e) => e.key === 'Enter' && (save(), input.blur())
          box.append(input)
        }
      }
    ])

    api.ui.addStyle(`
      .tp-title { padding: 4px 6px 8px; color: var(--text-3); font-size: 12px; }
      .tp-find, .tp-input { width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--outline); background: var(--bg-app); color: var(--text); outline: none; }
      .tp-input { width: 220px; }
      .tp-find:focus, .tp-input:focus { border-color: var(--accent); }
      .tp-list { margin-top: 6px; max-height: 300px; min-width: 280px; overflow-y: auto; }
      .tp-row { display: block; width: 100%; text-align: left; padding: 7px 10px; border-radius: 6px; font-size: 13px; color: var(--text-2); }
      .tp-row:hover, .tp-row.on { background: var(--bg-hover); color: var(--text); }
      .tp-none { padding: 8px 10px; color: var(--text-3); font-size: 13px; }
    `)
  }
}
