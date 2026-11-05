// Voice notes: record from the microphone into the note (Ctrl+Alt+R, or Insert in the right-click menu), and choose
// the microphone in the add-on's settings. Syntex lets the window use the microphone only while this add-on is on
// (the "microphone" permission of manifest.json). Playing sound files in a note is part of Syntex itself.

const TEXT = {
  ru: {
    record: 'Записать голосовую заметку',
    menu: 'Голосовая заметка',
    stop: 'Стоп и вставить',
    cancel: 'Отмена',
    openNote: 'Откройте заметку, чтобы записать голос',
    closed: 'Заметку закрыли: запись сохранена в папке вложений',
    micError: 'Микрофон недоступен. Проверьте, что Windows разрешает приложениям доступ к микрофону и что он подключён.',
    mic: 'Микрофон',
    micDesc: 'С какого устройства записываются голосовые заметки',
    micDefault: 'Устройство по умолчанию',
    micUnnamed: 'Микрофон',
    micGone: 'Сохранённое устройство (не подключено)',
    test: 'Проверить',
    stopTest: 'Стоп',
    tooLong: 'Запись длится 35 минут: это предел, она остановлена и вставлена'
  },
  en: {
    record: 'Record a voice note',
    menu: 'Voice note',
    stop: 'Stop and insert',
    cancel: 'Cancel',
    openNote: 'Open a note to record into',
    closed: 'The note was closed: the recording is kept in the attachments',
    micError: 'The microphone is not available. Check that Windows lets desktop apps use it and that it is plugged in.',
    mic: 'Microphone',
    micDesc: 'Which device voice notes are recorded from',
    micDefault: 'Default device',
    micUnnamed: 'Microphone',
    micGone: 'Saved device (not connected)',
    test: 'Test',
    stopTest: 'Stop',
    tooLong: 'The recording reached 35 minutes, the limit: it was stopped and inserted'
  }
}

// 22 kHz mono 16-bit is 44 100 bytes a second: 35 minutes stay under the 100 MB Syntex keeps for one sound file
const MAX_SECONDS = 35 * 60

/** A recording (whatever the browser produced, usually webm/opus) as a mono 16-bit WAV file at 22 kHz. */
async function blobToWav(blob) {
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    const rate = 22050
    const length = Math.max(1, Math.floor(decoded.duration * rate))
    // all channels into one
    const mono = new Float32Array(decoded.length)
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c)
      for (let i = 0; i < decoded.length; i++) mono[i] += channel[i] / decoded.numberOfChannels
    }
    // down to 22 kHz by linear interpolation: plenty for a voice, and the file stays small
    const samples = new Int16Array(length)
    const ratio = decoded.sampleRate / rate
    for (let i = 0; i < length; i++) {
      const pos = i * ratio
      const i0 = Math.floor(pos)
      const i1 = Math.min(i0 + 1, mono.length - 1)
      const f = pos - i0
      const v = mono[i0] * (1 - f) + mono[i1] * f
      samples[i] = Math.round(Math.max(-1, Math.min(1, v)) * 0x7fff)
    }
    const bytes = new Uint8Array(44 + samples.length * 2)
    const view = new DataView(bytes.buffer)
    const text = (at, s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i))
    }
    text(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    text(8, 'WAVE')
    text(12, 'fmt ')
    view.setUint32(16, 16, true) // size of the format block
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, rate, true)
    view.setUint32(28, rate * 2, true) // bytes per second
    view.setUint16(32, 2, true) // bytes per sample frame
    view.setUint16(34, 16, true) // bits per sample
    text(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    bytes.set(new Uint8Array(samples.buffer), 44)
    return bytes
  } finally {
    void ctx.close()
  }
}

/** The microphone chosen in the settings; if that device is gone, the default one. */
async function openMic(deviceId) {
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } })
    } catch {
      /* unplugged or renamed: fall back to the default microphone */
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const child of children) node.append(child)
  return node
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default {
  onload(api) {
    const t = () => TEXT[api.language()] ?? TEXT.en
    // (the same id as when voice notes were built in: the microphone chosen then is still here)
    const data = () => api.data.get({ mic: '' })

    let close = null
    const record = () => {
      if (close) return // one recording at a time
      // the recording goes into the note it was started in, even if another tab is in front when it ends
      const note = api.editor.active()
      if (!note) return api.ui.notice(t().openNote)
      const finish = () => {
        close?.()
        close = null
      }
      close = api.ui.panel({ mount: (box) => recorderBar(box, note, finish) })
    }

    /** A small bar at the bottom of the window: records until Stop, then puts the WAV file into the note. */
    const recorderBar = (box, note, finish) => {
      let recorder = null
      let stream = null
      let cancelled = false
      // Stop pressed while the microphone is still opening: the recording ends as soon as it has begun
      let stopAsked = false
      let startedAt = null
      const elapsed = () => (startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000))
      const chunks = []
      const time = el('span', { className: 'voice-time', textContent: clock(0) })
      const stop = el('button', { className: 'btn voice-stop', textContent: t().stop })
      const cancel = el('button', { className: 'btn', textContent: t().cancel })
      // the loudness while recording: strips that run to the left, like the voice message of a messenger is made
      const LEVELS = 32
      const levels = el('span', { className: 'voice-levels' })
      const strips = Array.from({ length: LEVELS }, () => levels.appendChild(el('i')))
      let meter = null
      box.append(el('div', { className: 'voice-bar', role: 'status' }, [el('span', { className: 'voice-dot' }), time, levels, stop, cancel]))

      openMic(data().mic)
        .then((s) => {
          if (cancelled) return s.getTracks().forEach((track) => track.stop())
          stream = s
          recorder = new MediaRecorder(s)
          recorder.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data)
          }
          recorder.onstop = async () => {
            s.getTracks().forEach((track) => track.stop())
            if (cancelled) return
            try {
              const wav = await blobToWav(new Blob(chunks, { type: recorder.mimeType }))
              finish()
              if (!note.insertEmbed(await api.vault.saveAttachment('Recording.wav', wav))) api.ui.notice(t().closed)
            } catch (e) {
              finish()
              api.ui.notice(e instanceof Error ? e.message : String(e), 6000)
            }
          }
          recorder.onerror = () => {
            api.ui.notice(t().micError, 7000)
            // what was recorded so far is kept: the recording ends as if Stop was pressed
            if (recorder.state !== 'inactive') recorder.stop()
            else finish()
          }
          try {
            const ctx = new AudioContext()
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 512
            ctx.createMediaStreamSource(s).connect(analyser)
            const buf = new Uint8Array(analyser.fftSize)
            const history = new Array(LEVELS).fill(0)
            const id = setInterval(() => {
              analyser.getByteTimeDomainData(buf)
              let peak = 0
              for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
              history.push(Math.min(1, peak / 90))
              history.shift()
              strips.forEach((strip, i) => (strip.style.height = Math.round(10 + history[i] * 90) + '%'))
            }, 70)
            meter = () => {
              clearInterval(id)
              void ctx.close()
            }
          } catch {
            /* no meter: the recording goes on */
          }
          recorder.start(250)
          startedAt = Date.now()
          if (stopAsked) recorder.stop()
        })
        .catch(() => {
          api.ui.notice(t().micError, 7000)
          finish()
        })

      const timer = setInterval(() => {
        time.textContent = clock(elapsed())
        // the WAV of a longer recording would be over the 100 MB the vault keeps: it ends (and is kept) before that
        if (elapsed() >= MAX_SECONDS && !stop.disabled) {
          api.ui.notice(t().tooLong, 7000)
          stop.onclick()
        }
      }, 500)
      const onKey = (e) => {
        // an Esc that closes a menu, a dialog or a popup is theirs; the recording is cancelled only by an Esc meant for
        // the note, and only in its first seconds: a longer recording is never thrown away by a stray key (Cancel is there)
        if (e.key === 'Escape' && elapsed() < 5 && !document.querySelector('.ctx-menu, .backdrop, .dialog-backdrop, .qs-backdrop, .addon-popup')) {
          e.stopPropagation()
          finish()
        }
      }
      window.addEventListener('keydown', onKey, true)
      stop.onclick = () => {
        stop.disabled = true
        if (recorder) {
          if (recorder.state !== 'inactive') recorder.stop()
        } else stopAsked = true
      }
      cancel.onclick = finish

      return () => {
        clearInterval(timer)
        window.removeEventListener('keydown', onKey, true)
        meter?.()
        // leaving without Stop: nothing is kept (after Stop the file is already being made)
        if (!stop.disabled) cancelled = true
        if (recorder && recorder.state !== 'inactive') recorder.stop()
        if (cancelled) stream?.getTracks().forEach((track) => track.stop())
      }
    }

    /** The choice of the microphone, and a test that shows how loud it hears you. */
    const micPicker = (box) => {
      let alive = true
      let stopTest = null
      let starting = false
      const select = el('select')
      const test = el('button', { className: 'btn', textContent: t().test })
      const meter = el('span', { className: 'mic-meter', hidden: true }, [el('i')])
      box.append(el('div', { className: 'mic-picker' }, [el('span', { className: 'select' }, [select]), test, meter]))

      const fill = async () => {
        let devices = []
        try {
          devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
        } catch {
          /* no list: only the default device */
        }
        if (!alive) return
        const value = data().mic
        const options = [{ value: '', label: t().micDefault }, ...devices.map((d, i) => ({ value: d.deviceId, label: d.label || `${t().micUnnamed} ${i + 1}` }))]
        if (value && !devices.some((d) => d.deviceId === value)) options.push({ value, label: t().micGone })
        select.replaceChildren(...options.map((o) => el('option', { value: o.value, textContent: o.label })))
        select.value = value
      }
      const endTest = () => {
        stopTest?.()
        stopTest = null
        meter.hidden = true
        test.textContent = t().test
      }
      select.onchange = () => {
        endTest()
        api.data.set({ ...data(), mic: select.value })
      }
      test.onclick = async () => {
        if (stopTest) return endTest()
        // a second click while the microphone is still opening must not open it twice
        if (starting) return
        starting = true
        try {
          const stream = await openMic(data().mic).finally(() => (starting = false))
          // the settings were closed while the microphone was opening: let it go at once
          if (!alive) return stream.getTracks().forEach((track) => track.stop())
          void fill() // the names of the devices are only given once the microphone has been allowed
          const ctx = new AudioContext()
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 512
          ctx.createMediaStreamSource(stream).connect(analyser)
          const buf = new Uint8Array(analyser.fftSize)
          const timer = setInterval(() => {
            analyser.getByteTimeDomainData(buf)
            let peak = 0
            for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
            meter.firstChild.style.width = Math.min(1, peak / 80) * 100 + '%'
          }, 60)
          stopTest = () => {
            clearInterval(timer)
            stream.getTracks().forEach((track) => track.stop())
            void ctx.close()
          }
          meter.hidden = false
          test.textContent = t().stopTest
        } catch {
          api.ui.notice(t().micError, 7000)
        }
      }
      void fill()
      navigator.mediaDevices.addEventListener('devicechange', fill)
      return () => {
        alive = false
        navigator.mediaDevices.removeEventListener('devicechange', fill)
        stopTest?.()
      }
    }

    api.commands.add({ id: 'record', name: { en: TEXT.en.record, ru: TEXT.ru.record }, keys: 'Ctrl+Alt+R', run: record })
    api.menus.editor('insert', () => [{ label: { en: TEXT.en.menu, ru: TEXT.ru.menu }, icon: 'mic', command: 'record', action: record }])
    api.settings.add([{ id: 'mic', type: 'mount', title: { en: TEXT.en.mic, ru: TEXT.ru.mic }, desc: { en: TEXT.en.micDesc, ru: TEXT.ru.micDesc }, mount: micPicker }])
    api.onDispose(() => close?.())
  }
}
