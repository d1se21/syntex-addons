// Tab collections: tabs gathered into coloured collections, like tab groups in a browser. A collection has a name
// and a colour, shown on its tabs (a line under them, its name before the first one); folded, only its name is left.
// Everything is in the right-click menu of a tab. The collections are kept with the add-on's data, by tab id.

const COLORS = [
  { id: 'grey', value: '#a3a9b3', ru: 'Серый', en: 'Grey' },
  { id: 'blue', value: '#8ab4f8', ru: 'Синий', en: 'Blue' },
  { id: 'red', value: '#f28b82', ru: 'Красный', en: 'Red' },
  { id: 'yellow', value: '#fdd663', ru: 'Жёлтый', en: 'Yellow' },
  { id: 'green', value: '#81c995', ru: 'Зелёный', en: 'Green' },
  { id: 'pink', value: '#ff8bcb', ru: 'Розовый', en: 'Pink' },
  { id: 'purple', value: '#c58af9', ru: 'Фиолетовый', en: 'Purple' },
  { id: 'cyan', value: '#78d9ec', ru: 'Голубой', en: 'Cyan' },
  { id: 'orange', value: '#fcad70', ru: 'Оранжевый', en: 'Orange' }
]

const TEXT = {
  ru: {
    toNew: 'Добавить в новую коллекцию',
    toExisting: 'Добавить в коллекцию',
    newName: 'Название коллекции',
    defaultName: (n) => `Коллекция ${n}`,
    rename: 'Переименовать коллекцию…',
    color: 'Цвет',
    newTab: 'Новая вкладка в коллекции',
    fold: 'Свернуть коллекцию',
    unfold: 'Развернуть коллекцию',
    leave: 'Убрать вкладку из коллекции',
    ungroup: 'Разгруппировать',
    closeAll: 'Закрыть вкладки коллекции',
    closeTitle: 'Закрыть вкладки?',
    closeText: (name, n) => `Все вкладки коллекции «${name}» (${n}) закроются, а сама коллекция исчезнет.`,
    closeOk: 'Закрыть'
  },
  en: {
    toNew: 'Add to a new collection',
    toExisting: 'Add to a collection',
    newName: 'Name of the collection',
    defaultName: (n) => `Collection ${n}`,
    rename: 'Rename the collection…',
    color: 'Colour',
    newTab: 'New tab in the collection',
    fold: 'Fold the collection',
    unfold: 'Unfold the collection',
    leave: 'Take the tab out of the collection',
    ungroup: 'Ungroup',
    closeAll: 'Close the tabs of the collection',
    closeTitle: 'Close the tabs?',
    closeText: (name, n) => `All the tabs of “${name}” (${n}) will close, and the collection goes away.`,
    closeOk: 'Close'
  }
}

export default {
  onload(api) {
    const t = () => TEXT[api.language()] ?? TEXT.en
    /** { collections: [{ id, name, color, folded, tabs: [tab id, ...] }] } */
    let state = api.data.get({ collections: [] })
    const save = () => api.data.set(state)
    const colorOf = (c) => COLORS.find((x) => x.id === c.color)?.value ?? COLORS[0].value
    const collectionOf = (tabId) => state.collections.find((c) => c.tabs.includes(tabId))

    // A tab that is replaced by another one in its place (a note opened in an empty tab: Syntex puts the note's tab
    // there, then closes the empty one) hands its collection over to the new tab. So each tab is remembered with
    // where it was last and when it first appeared.
    let before = new Map(api.tabs.list().map((tab) => [tab.id, tab]))
    const firstSeen = new Map()
    const HEIR_MS = 2000

    /** Bring the collections in line with the tabs there are, and draw them on the tabs. */
    const update = () => {
      const tabs = api.tabs.list()
      const now = new Map(tabs.map((tab) => [tab.id, tab]))
      const at = Date.now()
      for (const tab of tabs) if (!firstSeen.has(tab.id)) firstSeen.set(tab.id, at)
      const heirOf = (was) =>
        tabs
          .filter((tab) => tab.window === was.window && Math.abs(tab.index - was.index) <= 1 && at - firstSeen.get(tab.id) < HEIR_MS && !collectionOf(tab.id))
          .sort((a, b) => Math.abs(a.index - was.index) - Math.abs(b.index - was.index))[0]
      let changed = false
      for (const c of state.collections) {
        c.tabs = c.tabs.flatMap((id) => {
          if (now.has(id)) return [id]
          changed = true
          const was = before.get(id)
          const heir = was && heirOf(was)
          return heir ? [heir.id] : []
        })
        // a tab brought to the front opens its folded collection, like a click on a group in a browser
        if (c.folded && c.tabs.some((id) => now.get(id)?.active && !before.get(id)?.active)) {
          c.folded = false
          changed = true
        }
      }
      const kept = state.collections.filter((c) => c.tabs.length)
      if (kept.length !== state.collections.length) changed = true
      state.collections = kept
      if (changed) save()
      before = now
      for (const id of firstSeen.keys()) if (!now.has(id)) firstSeen.delete(id)

      for (const tab of tabs) {
        const c = collectionOf(tab.id)
        if (!c) {
          api.tabs.decorate(tab.id, null)
          continue
        }
        // the first tab of the collection in its window carries the name
        const first = tabs.filter((x) => c.tabs.includes(x.id) && x.window === tab.window).sort((a, b) => a.index - b.index)[0]
        const isFirst = first?.id === tab.id
        api.tabs.decorate(tab.id, {
          color: colorOf(c),
          label: isFirst ? c.name : undefined,
          labelOnly: c.folded && isFirst,
          hidden: c.folded && !isFirst
        })
      }
    }

    /** The tabs of a collection stay side by side: a tab that joins goes after the last of them. */
    const join = (c, tabId) => {
      const last = api.tabs
        .list()
        .filter((x) => c.tabs.includes(x.id))
        .sort((a, b) => a.index - b.index)
        .pop()
      c.tabs.push(tabId)
      if (last && last.id !== tabId) api.tabs.move(tabId, last.id)
    }

    const leave = (tabId) => {
      for (const c of state.collections) c.tabs = c.tabs.filter((id) => id !== tabId)
    }

    const create = async (tab) => {
      const name = await api.ui.prompt(t().newName, t().defaultName(state.collections.length + 1))
      if (name === null) return
      const used = new Set(state.collections.map((c) => c.color))
      const color = (COLORS.find((x) => !used.has(x.id)) ?? COLORS[state.collections.length % COLORS.length]).id
      leave(tab.id)
      state.collections.push({ id: `c${Date.now()}`, name: name.trim() || t().defaultName(state.collections.length + 1), color, folded: false, tabs: [tab.id] })
      save()
      update()
    }

    /** Folded, a collection shows only its name; a tab of it that is in front gives way to the nearest other tab. */
    const fold = (c) => {
      const tabs = api.tabs.list()
      for (const front of tabs.filter((x) => x.active && c.tabs.includes(x.id))) {
        const others = tabs.filter((x) => x.window === front.window && !c.tabs.includes(x.id))
        // nowhere else to go in that window: the collection stays open
        if (!others.length) return
        others.sort((a, b) => Math.abs(a.index - front.index) - Math.abs(b.index - front.index))
        api.tabs.activate(others[0].id)
      }
      c.folded = true
      save()
      update()
    }

    const changeAndDraw = (fn) => () => {
      fn()
      save()
      update()
    }

    api.menus.tab((tab) => {
      const c = collectionOf(tab.id)
      const lang = api.language()
      if (!c) {
        const items = [{ label: t().toNew, action: () => void create(tab) }]
        if (state.collections.length) {
          items.push({
            label: t().toExisting,
            children: state.collections.map((other) => ({
              label: other.name,
              swatch: colorOf(other),
              action: changeAndDraw(() => join(other, tab.id))
            }))
          })
        }
        return items
      }
      return [
        {
          label: t().rename,
          action: async () => {
            const name = await api.ui.prompt(t().newName, c.name)
            if (name !== null && name.trim()) changeAndDraw(() => (c.name = name.trim()))()
          }
        },
        {
          label: t().color,
          children: COLORS.map((x) => ({
            label: x[lang] ?? x.en,
            swatch: x.value,
            hint: x.id === c.color ? '✓' : undefined,
            action: changeAndDraw(() => (c.color = x.id))
          }))
        },
        {
          label: t().newTab,
          action: () => {
            const last = api.tabs.list().filter((x) => c.tabs.includes(x.id)).sort((a, b) => a.index - b.index).pop()
            const id = api.tabs.open({ after: last?.id ?? tab.id })
            if (id)
              changeAndDraw(() => {
                c.tabs.push(id)
                c.folded = false
              })()
          }
        },
        { label: c.folded ? t().unfold : t().fold, action: () => (c.folded ? changeAndDraw(() => (c.folded = false))() : fold(c)) },
        { label: t().leave, separatorBefore: true, action: changeAndDraw(() => leave(tab.id)) },
        { label: t().ungroup, action: changeAndDraw(() => (state.collections = state.collections.filter((x) => x !== c))) },
        {
          label: t().closeAll,
          danger: true,
          separatorBefore: true,
          action: async () => {
            if (!(await api.ui.confirm(t().closeTitle, t().closeText(c.name, c.tabs.length), t().closeOk))) return
            const ids = [...c.tabs]
            state.collections = state.collections.filter((x) => x !== c)
            save()
            for (const id of ids) api.tabs.close(id)
            update()
          }
        }
      ]
    })

    api.tabs.onChange(update)
    update()
  }
}
