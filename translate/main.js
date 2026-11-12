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
 * The text in another language, and the language it was found to be in. Through api.net (the permission "internet"
 * of the manifest, to translate.googleapis.com only): the window of Syntex itself reaches no network.
 */
async function translate(api, text, from, to) {
  const res = await api.net.fetch(`${ENDPOINT}&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'q=' + encodeURIComponent(text)
  })
  if (!res.ok) throw new Error(String(res.status))
  const data = JSON.parse(res.text)
  return { text: (data[0] ?? []).map((part) => part[0] ?? '').join(''), detected: data[2] ?? from }
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
      const run = async () => {
        const mine = ++asked
        const q = src.value
        if (!q.trim()) {
          out.textContent = ''
          detected.textContent = ''
          status.textContent = ''
          return
        }
        status.textContent = tt('Перевожу…', 'Translating…')
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
          status.textContent = ''
        } catch {
          if (mine !== asked) return
          status.textContent = tt('Нет связи с сервисом перевода. Проверьте интернет и попробуйте ещё раз.', 'No connection to the translation service. Check the internet and try again.')
        } finally {
          if (mine === asked) box.classList.remove('busy')
        }
      }
      let timer = null
      const later = () => {
        clearTimeout(timer)
        timer = setTimeout(run, 450)
      }

      src.addEventListener('input', later)
      from.addEventListener('change', run)
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
