// More Themes: palettes for the dark and the light look of Syntex.
// Every palette is a set of the CSS variables of Syntex (styles.css of this add-on), switched on by a class on <html>:
// mt-dark-<id> works while Syntex is dark, mt-light-<id> while it is light, so "as the system" picks between the two.
// "Your colours": four colours chosen by the user (background, panels, text, accent); the other variables are mixed
// from them and written into a <style> of this add-on.

const DARK = [
  { id: 'default', label: { ru: 'Как в Syntex', en: 'As in Syntex' } },
  { id: 'nord', label: 'Nord' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'catppuccin', label: 'Catppuccin Mocha' },
  { id: 'contrast', label: { ru: 'Высокий контраст', en: 'High contrast' } },
  { id: 'custom', label: { ru: 'Свои цвета', en: 'Your colours' } }
]

const LIGHT = [
  { id: 'default', label: { ru: 'Как в Syntex', en: 'As in Syntex' } },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'catppuccin', label: 'Catppuccin Latte' },
  { id: 'sepia', label: { ru: 'Сепия', en: 'Sepia' } },
  { id: 'contrast', label: { ru: 'Высокий контраст', en: 'High contrast' } },
  { id: 'custom', label: { ru: 'Свои цвета', en: 'Your colours' } }
]

// the dark look of Syntex itself is the one the add-on starts with; Nord and the others are a choice
const DEFAULTS = { dark: 'default', light: 'default' }

// the four colours a palette of one's own is made of, and where they start: the colours of Syntex
const KEYS = [
  { id: 'bg', label: { ru: 'Фон', en: 'Background' } },
  { id: 'panel', label: { ru: 'Панели', en: 'Panels' } },
  { id: 'text', label: { ru: 'Текст', en: 'Text' } },
  { id: 'accent', label: { ru: 'Акцент', en: 'Accent' } }
]
const START = {
  dark: { bg: '#1e2127', panel: '#22262c', text: '#ffffff', accent: '#ffffff' },
  light: { bg: '#ffffff', panel: '#f3f4f6', text: '#15181d', accent: '#15181d' }
}

const rgb = (c) => {
  const h = /^#?([0-9a-f]{6})$/i.exec(c)?.[1] ?? '000000'
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const hex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
/** a with a share t of b in it */
const mix = (a, b, t) => {
  const B = rgb(b)
  return hex(rgb(a).map((v, i) => v + (B[i] - v) * t))
}
const alpha = (c, a) => `rgba(${rgb(c).join(', ')}, ${a})`

/** All the variables of Syntex from the four colours (the colours of code and of errors stay those of Syntex). */
function palette(kind, c) {
  const { bg, panel, text, accent } = c
  const dark = kind === 'dark'
  return {
    '--bg-app': bg,
    '--bg-panel': panel,
    '--bg-hover': mix(panel, text, dark ? 0.12 : 0.08),
    '--bg-field': bg,
    '--border': mix(bg, text, dark ? 0.1 : 0.12),
    '--border-2': mix(bg, text, dark ? 0.15 : 0.18),
    '--outline': mix(bg, text, 0.32),
    '--text': text,
    '--text-2': mix(text, bg, 0.14),
    '--text-3': mix(text, bg, 0.27),
    '--text-muted': mix(text, bg, 0.42),
    '--accent': accent,
    '--accent-hover': mix(accent, text, 0.18),
    '--code-bg': mix(bg, text, dark ? 0.06 : 0.05),
    '--float-bg': dark ? mix(panel, text, 0.06) : bg,
    '--drag-bg': dark ? mix(panel, text, 0.07) : bg,
    '--drag-border': mix(bg, text, 0.2),
    '--logo-hi': text,
    '--logo-lo': mix(text, bg, 0.4),
    '--toggle-off': mix(bg, text, dark ? 0.18 : 0.2),
    '--ov': dark ? '255 255 255' : '0 0 0',
    '--selection': alpha(accent, dark ? 0.26 : 0.22),
    '--selection-blur': alpha(accent, dark ? 0.13 : 0.11),
    '--backdrop': alpha(mix(bg, '#000000', 0.4), dark ? 0.72 : 0.38)
  }
}

// the <style> with the palettes of one's own, taken away when the add-on is switched off
let customStyle = null

export default {
  onload(api) {
    const ru = () => api.language() === 'ru'
    const say = (t) => (typeof t === 'string' ? t : ru() ? t.ru : t.en)
    const settings = () => ({ ...DEFAULTS, ...api.data.get({}) })
    const colours = (kind) => ({ ...START[kind], ...(settings().custom?.[kind] ?? {}) })
    // the themes the user saved under a name: { dark: [{ id, name, colours }], light: [...] }; in the list of themes
    // they are "p-<id>"
    const presets = (kind) => (Array.isArray(settings().presets?.[kind]) ? settings().presets[kind] : [])

    // the palettes of one's own and the saved ones: rules under their classes
    customStyle?.remove()
    const style = (customStyle = document.createElement('style'))
    style.id = 'mt-custom'
    document.head.append(style)
    const rule = (kind, cls, c) => {
      const vars = palette(kind, { ...START[kind], ...c })
      return `:root.mt-${kind}-${cls}[data-theme='${kind}'] {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
    }
    const writeCustom = (live = {}) => {
      style.textContent = ['dark', 'light']
        .flatMap((kind) => [rule(kind, 'custom', { ...colours(kind), ...(live[kind] ?? {}) }), ...presets(kind).map((p) => rule(kind, 'p-' + p.id, p.colours))])
        .join('\n')
    }
    writeCustom()

    // the classes that are on now, so that a change takes the old one off
    const on = { dark: null, light: null }
    const apply = () => {
      const s = settings()
      for (const kind of ['dark', 'light']) {
        const list = [...(kind === 'dark' ? DARK : LIGHT), ...presets(kind).map((p) => ({ id: 'p-' + p.id }))]
        const id = list.some((t) => t.id === s[kind]) ? s[kind] : 'default'
        const cls = id === 'default' ? null : `mt-${kind}-${id}`
        if (cls === on[kind]) continue
        if (on[kind]) api.ui.rootClass(on[kind], false)
        if (cls) api.ui.rootClass(cls, true)
        on[kind] = cls
      }
    }
    apply()

    // the two lists of themes: the rows are kept, so that a theme saved or deleted shows in them (the settings are
    // drawn again from the rows whenever the data of the add-on changes)
    const optionsFor = (kind, s = settings()) => [
      ...(kind === 'dark' ? DARK : LIGHT).map((t) => ({ value: t.id, label: t.label })),
      ...(Array.isArray(s.presets?.[kind]) ? s.presets[kind] : []).map((p) => ({ value: 'p-' + p.id, label: p.name }))
    ]
    const selects = {}
    const set = (patch) => {
      const next = { ...settings(), ...patch }
      // (the options first: the lists are drawn again by the change of the data)
      for (const kind of ['dark', 'light']) if (selects[kind]) selects[kind].options = optionsFor(kind, next)
      api.data.set(next)
      apply()
    }
    // the rows that list the saved themes, drawn again after a save or a delete
    const savedDrawers = new Set()
    const redrawSaved = () => savedDrawers.forEach((d) => d())

    /** The colours now of "Your colours" of that kind, kept under a name and chosen at once. */
    const savePreset = async (kind) => {
      const name = (await api.ui.prompt(ru() ? 'Название темы' : 'Name of the theme', ''))?.trim()
      if (!name) return
      const id = Date.now().toString(36)
      const all = { dark: presets('dark'), light: presets('light') }
      all[kind] = [...all[kind], { id, name: name.slice(0, 40), colours: colours(kind) }]
      set({ presets: all, [kind]: 'p-' + id })
      writeCustom()
      redrawSaved()
    }
    const deletePreset = async (kind, p) => {
      const sure = await api.ui.confirm(ru() ? 'Удалить тему?' : 'Delete the theme?', ru() ? `«${p.name}» пропадёт из списка тем.` : `"${p.name}" goes from the list of themes.`, ru() ? 'Удалить' : 'Delete')
      if (!sure) return
      const all = { dark: presets('dark'), light: presets('light') }
      all[kind] = all[kind].filter((x) => x.id !== p.id)
      // (the theme that was on goes back to the look of Syntex)
      set({ presets: all, ...(settings()[kind] === 'p-' + p.id ? { [kind]: 'default' } : {}) })
      writeCustom()
      redrawSaved()
    }

    /** Four colour wells and a reset; a colour picked makes the palette of one's own the theme of that kind. */
    const customRow = (kind) => ({
      id: 'custom-' + kind,
      type: 'mount',
      title: kind === 'dark' ? { ru: 'Свои цвета тёмной темы', en: 'Your colours, dark' } : { ru: 'Свои цвета светлой темы', en: 'Your colours, light' },
      desc: { ru: 'Выбранный цвет включает «Свои цвета»', en: 'A colour picked switches to "Your colours"' },
      mount: (box) => {
        const wrap = document.createElement('div')
        wrap.className = 'mt-wells'
        const inputs = {}
        for (const k of KEYS) {
          const label = document.createElement('label')
          label.className = 'mt-well'
          const input = document.createElement('input')
          input.type = 'color'
          input.value = colours(kind)[k.id]
          input.dataset.key = k.id
          // dragged through the picker: shown at once, kept when let go
          input.oninput = () => {
            if (settings()[kind] !== 'custom') set({ [kind]: 'custom' })
            writeCustom({ [kind]: { [k.id]: input.value } })
          }
          input.onchange = () => {
            const s = settings()
            set({ [kind]: 'custom', custom: { ...(s.custom ?? {}), [kind]: { ...colours(kind), [k.id]: input.value } } })
            writeCustom()
          }
          const name = document.createElement('span')
          name.textContent = say(k.label)
          label.append(input, name)
          wrap.append(label)
          inputs[k.id] = input
        }
        const reset = document.createElement('button')
        reset.className = 'btn mt-reset'
        reset.textContent = ru() ? 'Сбросить' : 'Reset'
        reset.title = ru() ? 'Вернуть цвета Syntex' : 'Back to the colours of Syntex'
        reset.onclick = () => {
          const custom = { ...(settings().custom ?? {}) }
          delete custom[kind]
          set({ custom })
          writeCustom()
          for (const k of KEYS) inputs[k.id].value = START[kind][k.id]
        }
        const save = document.createElement('button')
        save.className = 'btn mt-save'
        save.textContent = ru() ? 'Сохранить…' : 'Save…'
        save.title = ru() ? 'Сохранить эти цвета как тему со своим названием' : 'Keep these colours as a theme with a name'
        save.onclick = () => void savePreset(kind)
        wrap.append(reset, save)
        box.append(wrap)
      }
    })

    /** The saved themes of both kinds: four dots of their colours, the name (a click turns it on) and a cross. */
    const savedRow = {
      id: 'saved',
      type: 'mount',
      title: { ru: 'Сохранённые темы', en: 'Saved themes' },
      desc: { ru: 'Появляются в списках тем выше', en: 'They are in the lists of themes above' },
      mount: (box) => {
        const list = document.createElement('div')
        list.className = 'mt-saved'
        const draw = () => {
          list.replaceChildren()
          const all = ['dark', 'light'].flatMap((kind) => presets(kind).map((p) => ({ kind, p })))
          if (!all.length) {
            const none = document.createElement('span')
            none.className = 'mt-saved-none'
            none.textContent = ru() ? 'Пока нет: «Сохранить…» у своих цветов' : 'None yet: "Save…" by your colours'
            list.append(none)
            return
          }
          for (const { kind, p } of all) {
            const item = document.createElement('div')
            item.className = 'mt-saved-item' + (settings()[kind] === 'p-' + p.id ? ' on' : '')
            item.dataset.preset = p.id
            const pick = document.createElement('button')
            pick.className = 'mt-saved-pick'
            pick.title = ru() ? 'Включить' : 'Turn on'
            const dots = document.createElement('span')
            dots.className = 'mt-saved-dots'
            for (const k of KEYS) {
              const d = document.createElement('i')
              d.style.background = p.colours?.[k.id] ?? START[kind][k.id]
              dots.append(d)
            }
            const name = document.createElement('span')
            name.className = 'mt-saved-name'
            name.textContent = p.name
            const kindLabel = document.createElement('span')
            kindLabel.className = 'mt-saved-kind'
            kindLabel.textContent = kind === 'dark' ? (ru() ? 'тёмная' : 'dark') : ru() ? 'светлая' : 'light'
            pick.append(dots, name, kindLabel)
            pick.onclick = () => {
              set({ [kind]: 'p-' + p.id })
              redrawSaved()
            }
            const del = document.createElement('button')
            del.className = 'mt-saved-del'
            del.title = ru() ? 'Удалить' : 'Delete'
            del.setAttribute('aria-label', del.title)
            del.textContent = '×'
            del.onclick = () => void deletePreset(kind, p)
            item.append(pick, del)
            list.append(item)
          }
        }
        draw()
        savedDrawers.add(draw)
        box.append(list)
        return () => savedDrawers.delete(draw)
      }
    }

    selects.dark = {
      id: 'dark',
      type: 'select',
      title: { ru: 'Тёмная тема', en: 'Dark theme' },
      desc: { ru: 'Пока в Syntex тёмная тема', en: 'While Syntex is dark' },
      options: optionsFor('dark'),
      value: () => settings().dark,
      onChange: (v) => {
        set({ dark: v })
        redrawSaved()
      }
    }
    selects.light = {
      id: 'light',
      type: 'select',
      title: { ru: 'Светлая тема', en: 'Light theme' },
      desc: { ru: 'Пока в Syntex светлая тема', en: 'While Syntex is light' },
      options: optionsFor('light'),
      value: () => settings().light,
      onChange: (v) => {
        set({ light: v })
        redrawSaved()
      }
    }
    api.settings.add([selects.dark, customRow('dark'), selects.light, customRow('light'), savedRow])
  },
  onunload() {
    customStyle?.remove()
    customStyle = null
  }
}
