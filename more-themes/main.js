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

    // the palettes of one's own: rules under the class of "custom"
    customStyle?.remove()
    const style = (customStyle = document.createElement('style'))
    style.id = 'mt-custom'
    document.head.append(style)
    const writeCustom = (live = {}) => {
      style.textContent = ['dark', 'light']
        .map((kind) => {
          const vars = palette(kind, { ...colours(kind), ...(live[kind] ?? {}) })
          return `:root.mt-${kind}-custom[data-theme='${kind}'] {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
        })
        .join('\n')
    }
    writeCustom()

    // the classes that are on now, so that a change takes the old one off
    const on = { dark: null, light: null }
    const apply = () => {
      const s = settings()
      for (const kind of ['dark', 'light']) {
        const list = kind === 'dark' ? DARK : LIGHT
        const id = list.some((t) => t.id === s[kind]) ? s[kind] : 'default'
        const cls = id === 'default' ? null : `mt-${kind}-${id}`
        if (cls === on[kind]) continue
        if (on[kind]) api.ui.rootClass(on[kind], false)
        if (cls) api.ui.rootClass(cls, true)
        on[kind] = cls
      }
    }
    apply()

    const set = (patch) => {
      api.data.set({ ...settings(), ...patch })
      apply()
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
        wrap.append(reset)
        box.append(wrap)
      }
    })

    api.settings.add([
      {
        id: 'dark',
        type: 'select',
        title: { ru: 'Тёмная тема', en: 'Dark theme' },
        desc: { ru: 'Пока в Syntex тёмная тема', en: 'While Syntex is dark' },
        options: DARK.map((t) => ({ value: t.id, label: t.label })),
        value: () => settings().dark,
        onChange: (v) => set({ dark: v })
      },
      customRow('dark'),
      {
        id: 'light',
        type: 'select',
        title: { ru: 'Светлая тема', en: 'Light theme' },
        desc: { ru: 'Пока в Syntex светлая тема', en: 'While Syntex is light' },
        options: LIGHT.map((t) => ({ value: t.id, label: t.label })),
        value: () => settings().light,
        onChange: (v) => set({ light: v })
      },
      customRow('light')
    ])
  },
  onunload() {
    customStyle?.remove()
    customStyle = null
  }
}
