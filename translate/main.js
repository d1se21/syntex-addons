// Translator: the selected text of a note in a window like that of an online translator. On the left the text (its
// language found by itself, or chosen), on the right the translation into the language chosen (kept for next time);
// the translation is copied or put in place of the selection. The text is sent to Google Translate.

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'

// the languages offered, in this order; their names come from the system, in the language of the window
const LANGS = ['en', 'ru', 'uk', 'be', 'kk', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'cs', 'nl', 'sv', 'fi', 'tr', 'el', 'he', 'ar', 'hi', 'zh-CN', 'ja', 'ko', 'vi', 'id', 'th']

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children) node.append(c)
  return node
}
const svg = (d) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  s.setAttribute('viewBox', '0 0 16 16')
  s.setAttribute('class', 'tr-ico')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', d)
  s.append(p)
  return s
}
const SWAP = 'M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13'
const CLOSE = 'M4 4l8 8M12 4l-8 8'

/**
 * What a translator must not touch: links to notes (their names), tags, code, formulas, addresses. They are put
 * aside as ⟦0⟧, ⟦1⟧… (Google leaves those as they are) and put back into the translation.
 */
const KEEP = /```[\s\S]*?```|`[^`\n]+`|\$\$[\s\S]+?\$\$|\$[^$\n]+\$|!?\[\[[^\]\n]+\]\]|\]\([^)\s]+\)|https?:\/\/[^\s)>\]]*[^\s)>\].,;:!?]|(?<=^|\s)#[\p{L}\p{N}_/-]+/gu
export function protect(text) {
  const kept = []
  const out = text.replace(KEEP, (m) => `⟦${kept.push(m) - 1}⟧`)
  return { out, back: (t) => t.replace(/⟦\s*(\d+)\s*⟧/g, (m, i) => kept[Number(i)] ?? m) }
}

/** A failure of a translation: 'limit' (too many requests, the service answered 429), 'service' (another answer), 'net'. */
class TranslateError extends Error {
  constructor(kind, status) {
    super(kind + (status ? ' ' + status : ''))
    this.kind = kind
    this.status = status
  }
}

// the translations made in this run of Syntex (not asked for again), the newest last; at most this many
const cache = new Map()
const CACHE_MAX = 200
// after a 429, nothing is asked by itself until then (a press on "Try again" still asks)
let quietUntil = 0

/**
 * The text in another language, and the language it was found to be in. Through api.net (the permission "internet"
 * of the manifest, to translate.googleapis.com only): the window of Syntex itself reaches no network.
 */
export async function translate(api, text, from, to) {
  const key = `${from}|${to}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const kept = protect(text)
  let res
  try {
    res = await api.net.fetch(`${ENDPOINT}&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'q=' + encodeURIComponent(kept.out)
    })
  } catch {
    throw new TranslateError('net')
  }
  if (res.status === 429) {
    quietUntil = Date.now() + 60_000
    throw new TranslateError('limit', 429)
  }
  if (!res.ok) throw new TranslateError('service', res.status)
  let data
  try {
    data = JSON.parse(res.text)
  } catch {
    throw new TranslateError('service', res.status)
  }
  const r = { text: kept.back((data[0] ?? []).map((part) => part[0] ?? '').join('')), detected: data[2] ?? from }
  cache.set(key, r)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
  return r
}

// the window open now (one at a time), closed when the add-on is switched off
let current = null

export default {
  onload(api) {
    const ru = () => api.language() === 'ru'
    const tt = (r, e) => (ru() ? r : e)
    const names = () => {
      try {
        return new Intl.DisplayNames([api.language()], { type: 'language' })
      } catch {
        return null
      }
    }
    const nameOf = (code) => {
      const n = names()?.of(code)
      return n ? n[0].toUpperCase() + n.slice(1) : code
    }
    const settings = () => ({ to: api.language(), ...api.data.get({}) })

    /** The window for a note and the text selected in it. */
    const open = (note) => {
      const text = note.selection()
      if (!text.trim()) return api.ui.notice(tt('Выделите текст, который нужно перевести', 'Select the text to translate'))
      current?.close()

      const langOptions = (select, withAuto) => {
        if (withAuto) select.append(el('option', { value: 'auto', textContent: tt('Определить язык', 'Detect language') }))
        for (const code of LANGS) select.append(el('option', { value: code, textContent: nameOf(code) }))
      }
      const from = el('select', { className: 'tr-from', title: tt('Язык текста', 'Language of the text') })
      langOptions(from, true)
      from.value = 'auto'
      const to = el('select', { className: 'tr-to', title: tt('Язык перевода', 'Language of the translation') })
      langOptions(to, false)
      to.value = LANGS.includes(settings().to) ? settings().to : 'en'
      const detected = el('span', { className: 'tr-detected' })
      const swap = el('button', { className: 'tr-swap', title: tt('Поменять языки местами', 'Swap the languages') }, [svg(SWAP)])
      const src = el('textarea', { className: 'tr-src', value: text, spellcheck: false })
      const out = el('div', { className: 'tr-out', tabIndex: 0 })
      const status = el('div', { className: 'tr-status' })
      const copy = el('button', { className: 'btn tr-copy', textContent: tt('Копировать', 'Copy') })
      const replace = el('button', { className: 'btn primary tr-replace', textContent: tt('Заменить выделенное', 'Replace the selection') })
      const close = el('button', { className: 'tr-x', title: tt('Закрыть (Esc)', 'Close (Esc)') }, [svg(CLOSE)])

      const box = el('div', { className: 'tr-box', role: 'dialog' }, [
        el('div', { className: 'tr-head' }, [el('span', { className: 'tr-title', textContent: tt('Перевод', 'Translation') }), close]),
        el('div', { className: 'tr-langs' }, [el('div', { className: 'tr-side' }, [el('div', { className: 'select' }, [from]), detected]), swap, el('div', { className: 'tr-side' }, [el('div', { className: 'select' }, [to])])]),
        el('div', { className: 'tr-panes' }, [src, el('div', { className: 'tr-right' }, [out, status])]),
        el('div', { className: 'tr-foot' }, [
          el('span', { className: 'tr-note', textContent: tt('Текст отправляется в Google Переводчик', 'The text is sent to Google Translate') }),
          copy,
          replace
        ])
      ])
      const backdrop = el('div', { className: 'tr-backdrop' }, [box])

      // the translation of what is in the field now; an older answer that comes late is dropped
      let asked = 0
      let found = null
      // what is shown now was made for this (the same text and languages again ask nothing)
      let shownFor = null
      const say = (text, retry = false) => {
        status.textContent = text
        if (retry) {
          const again = el('button', { className: 'tr-retry', textContent: tt('Повторить', 'Try again') })
          again.onclick = () => run(true)
          status.append(' ', again)
        }
      }
      const run = async (force = false) => {
        const mine = ++asked
        const q = src.value
        if (!q.trim()) {
          out.textContent = ''
          detected.textContent = ''
          say('')
          shownFor = null
          return
        }
        const key = `${from.value}|${to.value}|${q}`
        if (!force && key === shownFor) return
        // the service limited the requests a moment ago: nothing is asked by itself until the pause is over
        if (!force && Date.now() < quietUntil && !cache.has(key)) {
          say(tt('Сервис перевода временно ограничил запросы. Попробуйте через минуту.', 'The translation service limited the requests for a while. Try again in a minute.'), true)
          return
        }
        say(tt('Перевожу…', 'Translating…'))
        box.classList.add('busy')
        try {
          let r = await translate(api, q, from.value, to.value)
          // the text is already in the language asked for: the other usual one (Russian <-> English)
          if (from.value === 'auto' && r.detected === to.value) {
            const other = to.value === 'en' ? 'ru' : 'en'
            r = { ...(await translate(api, q, 'auto', other)), detected: r.detected }
            if (mine === asked) to.value = other
          }
          if (mine !== asked) return
          found = r.detected
          out.textContent = r.text
          detected.textContent = from.value === 'auto' && found ? tt('Определён: ', 'Detected: ') + nameOf(found) : ''
          shownFor = `${from.value}|${to.value}|${q}`
          say('')
        } catch (e) {
          if (mine !== asked) return
          const kind = e instanceof TranslateError ? e.kind : 'net'
          if (kind === 'limit') say(tt('Сервис перевода временно ограничил запросы. Попробуйте через минуту.', 'The translation service limited the requests for a while. Try again in a minute.'), true)
          else if (kind === 'service') say(tt(`Сервис перевода ответил ошибкой (код ${e.status}). Попробуйте позже.`, `The translation service answered with an error (code ${e.status}). Try again later.`), true)
          else say(tt('Нет связи с сервисом перевода. Проверьте интернет и попробуйте ещё раз.', 'No connection to the translation service. Check the internet and try again.'), true)
        } finally {
          if (mine === asked) box.classList.remove('busy')
        }
      }
      // typed in the left field: asked once the typing stops for a moment, not on every letter
      let timer = null
      const later = () => {
        clearTimeout(timer)
        timer = setTimeout(run, 900)
      }

      src.addEventListener('input', later)
      from.addEventListener('change', () => run())
      to.addEventListener('change', () => {
        api.data.set({ ...settings(), to: to.value })
        run()
      })
      swap.onclick = () => {
        const fromNow = from.value === 'auto' ? found : from.value
        if (!fromNow || !LANGS.includes(fromNow)) return
        from.value = to.value
        to.value = fromNow
        api.data.set({ ...settings(), to: to.value })
        if (out.textContent) src.value = out.textContent
        run()
      }
      copy.onclick = async () => {
        if (!out.textContent) return
        await api.ui.copy(out.textContent)
        api.ui.notice(tt('Перевод скопирован', 'The translation is copied'))
      }
      replace.onclick = () => {
        if (!out.textContent) return
        const text = out.textContent
        shut()
        // (the note's selection is what is replaced: the window was over it all the time)
        if (!note.insert(text)) api.ui.notice(tt('Заметка уже закрыта', 'The note is closed'))
      }

      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          shut()
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          e.stopPropagation()
          replace.click()
        }
      }
      const shut = () => {
        clearTimeout(timer)
        asked++
        window.removeEventListener('keydown', onKey, true)
        backdrop.remove()
        if (current?.backdrop === backdrop) current = null
      }
      close.onclick = shut
      // a click on the dark around the window closes it (not a selection that ends there)
      let downOn = null
      backdrop.addEventListener('mousedown', (e) => (downOn = e.target))
      backdrop.addEventListener('click', (e) => e.target === backdrop && downOn === backdrop && shut())
      window.addEventListener('keydown', onKey, true)

      document.body.append(backdrop)
      current = { backdrop, close: shut }
      out.focus()
      run()
    }

    api.menus.editor('end', (note) =>
      note.selection().trim()
        ? [{ label: { ru: 'Перевести', en: 'Translate' }, command: 'translate', separatorBefore: true, action: () => open(note) }]
        : []
    )
    api.commands.add({
      id: 'translate',
      name: { ru: 'Перевести выделенное', en: 'Translate the selection' },
      keys: 'Ctrl+Shift+Y',
      run: () => {
        const note = api.editor.active()
        if (note) open(note)
      }
    })
    api.onDispose(() => current?.close())
  },
  onunload() {
    current?.close()
  }
}
