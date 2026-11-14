// More Themes: palettes for the dark and the light look of Syntex.
// Every palette is a set of the CSS variables of Syntex (styles.css of this add-on), switched on by a class on <html>:
// mt-dark-<id> works while Syntex is dark, mt-light-<id> while it is light, so "as the system" picks between the two.
// "Your colours": four colours chosen by the user (background, panels, text, accent); the other variables are mixed
// from them and written into a <style> of this add-on. Saved themes: such four colours kept under a name.
// The settings show every theme as a card (a little picture of its colours); the colours are picked in a box of the
// add-on's own (the one of the system looked foreign in Syntex).

const DARK = [
  { id: 'default', label: 'Syntex' },
  { id: 'nord', label: 'Nord' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'catppuccin', label: 'Catppuccin Mocha' },
  { id: 'contrast', label: { ru: 'Высокий контраст', en: 'High contrast' } },
  { id: 'custom', label: { ru: 'Свои цвета', en: 'Your colours' } }
]

const LIGHT = [
  { id: 'default', label: 'Syntex' },
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
// the variables of Syntex the four colours stand for (for the pictures of the cards)
const VARS = { bg: '--bg-app', panel: '--bg-panel', text: '--text', accent: '--accent' }

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

/** #rrggbb from hue (0–360), saturation and value (0–1), and back. */
const fromHsv = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return hex([f(5) * 255, f(3) * 255, f(1) * 255])
}
const toHsv = (c) => {
  const [r, g, b] = rgb(c).map((x) => x / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

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

/** The four colours of a theme of the add-on, read from its rule in styles.css (null when it is not there). */
function readTheme(kind, id) {
  for (const sheet of document.styleSheets) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const r of rules) {
      if (!r.selectorText?.includes(`.mt-${kind}-${id}[`)) continue
      const out = {}
      for (const [k, v] of Object.entries(VARS)) out[k] = r.style.getPropertyValue(v).trim() || START[kind][k]
      return out
    }
  }
  return null
}

const el = (tag, cls, props = {}) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, props)

// the <style> with the palettes of one's own, taken away when the add-on is switched off
let customStyle = null

export default {
  onload(api) {
    const ru = () => api.language() === 'ru'
    const say = (t) => (typeof t === 'string' ? t : ru() ? t.ru : t.en)
    const settings = () => ({ ...DEFAULTS, ...api.data.get({}) })
    const colours = (kind) => ({ ...START[kind], ...(settings().custom?.[kind] ?? {}) })
    // the themes the user saved under a name: { dark: [{ id, name, colours }], light: [...] }; chosen, they are
    // "p-<id>"
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

    // what the settings show, drawn again after every change (a theme chosen, saved, deleted, a colour picked)
    const drawers = new Set()
    const redraw = () => drawers.forEach((d) => d())
    const set = (patch) => {
      api.data.set({ ...settings(), ...patch })
      apply()
      redraw()
    }

    /** The colours now of "Your colours" of that kind, kept under a name and chosen at once. */
    const savePreset = async (kind) => {
      const name = (await api.ui.prompt(ru() ? 'Название темы' : 'Name of the theme', ''))?.trim()
      if (!name) return
      const id = Date.now().toString(36)
      const all = { dark: presets('dark'), light: presets('light') }
      all[kind] = [...all[kind], { id, name: name.slice(0, 40), colours: colours(kind) }]
      set({ presets: all, [kind]: 'p-' + id })
      writeCustom()
      redraw()
    }
    const deletePreset = async (kind, p) => {
      const sure = await api.ui.confirm(ru() ? 'Удалить тему?' : 'Delete the theme?', ru() ? `«${p.name}» пропадёт из списка тем.` : `"${p.name}" goes from the list of themes.`, ru() ? 'Удалить' : 'Delete')
      if (!sure) return
      const all = { dark: presets('dark'), light: presets('light') }
      all[kind] = all[kind].filter((x) => x.id !== p.id)
      // (the theme that was on goes back to the look of Syntex)
      set({ presets: all, ...(settings()[kind] === 'p-' + p.id ? { [kind]: 'default' } : {}) })
      writeCustom()
      redraw()
    }

    /* ---------- the picker of a colour: a box of the add-on, in the look of Syntex ---------- */

    /**
     * A square of saturation and brightness, a strip of hues, the code of the colour and a few colours to start from.
     * `onLive` while the mouse moves (the window shows it at once), `onPick` when it is let go or the code is typed.
     */
    const openPicker = (anchor, value, onLive, onPick) => {
      const r = anchor.getBoundingClientRect()
      api.ui.popup({
        x: r.left - 6,
        y: r.bottom + 8,
        mount: (box, close) => {
          let hsv = toHsv(value)
          let now = value
          const root = el('div', 'mt-picker')
          const sv = el('div', 'mt-sv')
          const svKnob = el('i', 'mt-sv-knob')
          sv.append(svKnob)
          const hue = el('div', 'mt-hue')
          const hueKnob = el('i', 'mt-hue-knob')
          hue.append(hueKnob)
          const row = el('div', 'mt-picker-row')
          const swatch = el('span', 'mt-picker-swatch')
          const code = el('input', 'mt-picker-code', { spellcheck: false, maxLength: 7 })
          row.append(swatch, code)
          // colours to start from: the ones of the theme that is on now
          const starts = el('div', 'mt-picker-starts')
          const cs = getComputedStyle(document.documentElement)
          const seen = new Set()
          for (const v of ['--accent', '--text', '--bg-app', '--bg-panel', '--hl-kw', '--hl-str', '--hl-num', '--hl-fn', '--hl-type', '--hl-op', '--danger-text']) {
            const c = cs.getPropertyValue(v).trim().toLowerCase()
            if (!/^#[0-9a-f]{6}$/.test(c) || seen.has(c)) continue
            seen.add(c)
            const b = el('button', 'mt-picker-start', { title: c })
            b.style.background = c
            b.onclick = () => {
              hsv = toHsv(c)
              show(c)
              onPick(c)
            }
            starts.append(b)
          }
          root.append(sv, hue, row, starts)
          box.append(root)

          const show = (c) => {
            now = c
            sv.style.setProperty('--hue', fromHsv(hsv.h, 1, 1))
            svKnob.style.left = hsv.s * 100 + '%'
            svKnob.style.top = (1 - hsv.v) * 100 + '%'
            svKnob.style.background = c
            hueKnob.style.left = (hsv.h / 360) * 100 + '%'
            swatch.style.background = c
            if (document.activeElement !== code) code.value = c
          }
          show(value)

          // dragged in the square or along the strip: the colour follows the mouse, kept when it is let go
          const dragOn = (area, at) => {
            area.addEventListener('pointerdown', (e) => {
              if (e.button !== 0) return
              e.preventDefault()
              area.setPointerCapture(e.pointerId)
              const move = (ev) => {
                const b = area.getBoundingClientRect()
                at(Math.min(1, Math.max(0, (ev.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (ev.clientY - b.top) / b.height)))
                const c = fromHsv(hsv.h, hsv.s, hsv.v)
                show(c)
                onLive(c)
              }
              const up = () => {
                area.removeEventListener('pointermove', move)
                area.removeEventListener('pointerup', up)
                onPick(now)
              }
              area.addEventListener('pointermove', move)
              area.addEventListener('pointerup', up)
              move(e)
            })
          }
          dragOn(sv, (x, y) => {
            hsv = { ...hsv, s: x, v: 1 - y }
          })
          dragOn(hue, (x) => {
            hsv = { ...hsv, h: Math.min(359.9, x * 360) }
          })
          // the code typed: taken as soon as it is a whole colour; Enter closes the box
          code.oninput = () => {
            const v = code.value.trim().replace(/^([0-9a-f]{6})$/i, '#$1').toLowerCase()
            if (!/^#[0-9a-f]{6}$/.test(v)) return
            hsv = toHsv(v)
            show(v)
            onPick(v)
          }
          code.onkeydown = (e) => {
            if (e.key === 'Enter') close()
          }
          code.onblur = () => (code.value = now)
        }
      })
    }

    /* ---------- the cards of the themes ---------- */

    /** The colours a card shows: those of the theme, of "Your colours" or of a saved theme. */
    const cardColours = (kind, id) => {
      if (id === 'default') return START[kind]
      if (id === 'custom') return colours(kind)
      if (id.startsWith('p-')) return { ...START[kind], ...(presets(kind).find((p) => 'p-' + p.id === id)?.colours ?? {}) }
      return readTheme(kind, id) ?? START[kind]
    }

    /** One theme as a small picture of a window: the panel on the left, lines of text, a dot of the accent. */
    const card = (kind, id, name, saved) => {
      const c = cardColours(kind, id)
      const b = el('button', 'mt-card' + (settings()[kind] === id ? ' on' : ''), { title: name })
      b.dataset.theme = id
      const pic = el('span', 'mt-card-pic')
      pic.style.background = c.bg
      pic.style.borderColor = mix(c.bg, c.text, 0.14)
      const side = el('i', 'mt-card-side')
      side.style.background = c.panel
      side.style.borderColor = mix(c.panel, c.text, 0.1)
      const lines = el('span', 'mt-card-lines')
      for (const w of [70, 92, 54]) {
        const l = el('i')
        l.style.width = w + '%'
        l.style.background = mix(c.text, c.bg, w === 70 ? 0 : 0.45)
        lines.append(l)
      }
      const dot = el('i', 'mt-card-dot')
      dot.style.background = c.accent
      pic.append(side, lines, dot)
      const label = el('span', 'mt-card-name', { textContent: name })
      b.append(pic, label)
      b.onclick = () => set({ [kind]: id })
      if (saved) {
        const del = el('span', 'mt-card-del', { title: ru() ? 'Удалить тему' : 'Delete the theme', textContent: '×' })
        del.setAttribute('role', 'button')
        del.setAttribute('aria-label', del.title)
        del.onclick = (e) => {
          e.stopPropagation()
          void deletePreset(kind, saved)
        }
        b.append(del)
      }
      return b
    }

    /** The row of the themes of one kind: every theme as a card, the saved ones after the others. */
    const themesRow = (kind) => ({
      id: kind,
      type: 'mount',
      title: kind === 'dark' ? { ru: 'Тёмная тема', en: 'Dark theme' } : { ru: 'Светлая тема', en: 'Light theme' },
      desc: kind === 'dark' ? { ru: 'Пока в Syntex тёмная тема', en: 'While Syntex is dark' } : { ru: 'Пока в Syntex светлая тема', en: 'While Syntex is light' },
      mount: (box) => {
        const grid = el('div', 'mt-cards')
        grid.dataset.kind = kind
        const draw = () => {
          grid.replaceChildren(
            ...(kind === 'dark' ? DARK : LIGHT).map((t) => card(kind, t.id, say(t.label))),
            ...presets(kind).map((p) => card(kind, 'p-' + p.id, p.name, p))
          )
        }
        draw()
        drawers.add(draw)
        box.append(grid)
        return () => drawers.delete(draw)
      }
    })

    /** Four colour wells (each opens the picker), a reset and "Save…"; a colour picked turns "Your colours" on. */
    const customRow = (kind) => ({
      id: 'custom-' + kind,
      type: 'mount',
      title: kind === 'dark' ? { ru: 'Свои цвета тёмной темы', en: 'Your colours, dark' } : { ru: 'Свои цвета светлой темы', en: 'Your colours, light' },
      desc: { ru: 'Выбранный цвет включает «Свои цвета»', en: 'A colour picked switches to "Your colours"' },
      mount: (box) => {
        const wrap = el('div', 'mt-wells')
        const wells = {}
        for (const k of KEYS) {
          const label = el('span', 'mt-well')
          const well = el('button', 'mt-well-btn', { title: say(k.label) })
          well.dataset.key = k.id
          well.setAttribute('aria-label', say(k.label))
          well.style.background = colours(kind)[k.id]
          well.onclick = () => {
            if (settings()[kind] !== 'custom') set({ [kind]: 'custom' })
            openPicker(
              well,
              colours(kind)[k.id],
              (c) => {
                well.style.background = c
                writeCustom({ [kind]: { [k.id]: c } })
              },
              (c) => {
                well.style.background = c
                const s = settings()
                set({ [kind]: 'custom', custom: { ...(s.custom ?? {}), [kind]: { ...colours(kind), [k.id]: c } } })
                writeCustom()
              }
            )
          }
          label.append(well, el('span', '', { textContent: say(k.label) }))
          wrap.append(label)
          wells[k.id] = well
        }
        const draw = () => {
          for (const k of KEYS) wells[k.id].style.background = colours(kind)[k.id]
        }
        const reset = el('button', 'btn mt-reset', { textContent: ru() ? 'Сбросить' : 'Reset', title: ru() ? 'Вернуть цвета Syntex' : 'Back to the colours of Syntex' })
        reset.onclick = () => {
          const custom = { ...(settings().custom ?? {}) }
          delete custom[kind]
          set({ custom })
          writeCustom()
          redraw()
        }
        const save = el('button', 'btn mt-save', { textContent: ru() ? 'Сохранить…' : 'Save…', title: ru() ? 'Сохранить эти цвета как тему со своим названием' : 'Keep these colours as a theme with a name' })
        save.onclick = () => void savePreset(kind)
        wrap.append(reset, save)
        box.append(wrap)
        drawers.add(draw)
        return () => drawers.delete(draw)
      }
    })

    api.settings.add([themesRow('dark'), customRow('dark'), themesRow('light'), customRow('light')])
  },
  onunload() {
    customStyle?.remove()
    customStyle = null
  }
}
