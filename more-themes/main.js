// More Themes: palettes for the dark and the light look of Syntex.
// Every palette is a set of the CSS variables of Syntex (styles.css of this add-on), switched on by a class on <html>:
// mt-dark-<id> works while Syntex is dark, mt-light-<id> while it is light, so "as the system" picks between the two.

const DARK = [
  { id: 'default', label: { ru: 'Как в Syntex', en: 'As in Syntex' } },
  { id: 'nord', label: 'Nord' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'catppuccin', label: 'Catppuccin Mocha' },
  { id: 'contrast', label: { ru: 'Высокий контраст', en: 'High contrast' } }
]

const LIGHT = [
  { id: 'default', label: { ru: 'Как в Syntex', en: 'As in Syntex' } },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'catppuccin', label: 'Catppuccin Latte' },
  { id: 'sepia', label: { ru: 'Сепия', en: 'Sepia' } },
  { id: 'contrast', label: { ru: 'Высокий контраст', en: 'High contrast' } }
]

const DEFAULTS = { dark: 'nord', light: 'default' }

export default {
  onload(api) {
    const settings = () => ({ ...DEFAULTS, ...api.data.get({}) })

    // the classes that are on now, so that a change takes the old one off
    let on = { dark: null, light: null }
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
      {
        id: 'light',
        type: 'select',
        title: { ru: 'Светлая тема', en: 'Light theme' },
        desc: { ru: 'Пока в Syntex светлая тема', en: 'While Syntex is light' },
        options: LIGHT.map((t) => ({ value: t.id, label: t.label })),
        value: () => settings().light,
        onChange: (v) => set({ light: v })
      }
    ])
  },
  onunload() {}
}
