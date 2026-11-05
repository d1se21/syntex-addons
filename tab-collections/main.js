// Tab collections, like tab groups in Chrome or Edge. A collection is a run of tabs side by side with a colour and a
// name: its chip stands before its first tab (a click folds it, a right click opens its editor, the cross closes
// it), and a line of its colour runs under its tabs; the right-click menu of a tab of it folds or closes it too.
// The chip drags the whole collection (let go on another collection, it goes before or after it, never inside).
// A dragged tab held for a moment over another tab joins that one's collection, or makes a new collection with it;
// a tab dragged out of the run leaves it, a tab dropped inside the run joins it. The collections are kept with the
// add-on's data, by tab id.

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
    toNew: 'Добавить вкладку в новую коллекцию',
    toExisting: 'Добавить вкладку в коллекцию',
    unnamed: 'Без названия',
    leave: 'Убрать из коллекции',
    namePlaceholder: 'Назовите эту коллекцию',
    newTab: 'Новая вкладка в коллекции',
    edit: 'Изменить коллекцию',
    fold: 'Свернуть',
    unfold: 'Развернуть',
    ungroup: 'Разгруппировать',
    close: 'Закрыть коллекцию'
  },
  en: {
    toNew: 'Add the tab to a new collection',
    toExisting: 'Add the tab to a collection',
    unnamed: 'Unnamed',
    leave: 'Remove from the collection',
    namePlaceholder: 'Name this collection',
    newTab: 'New tab in the collection',
    edit: 'Edit the collection',
    fold: 'Fold',
    unfold: 'Unfold',
    ungroup: 'Ungroup',
    close: 'Close the collection'
  }
}

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const child of children) node.append(child)
  return node
}

export default {
  onload(api) {
    const t = () => TEXT[api.language()] ?? TEXT.en
    /** { collections: [{ id, name, color, folded, tabs: [tab id, ...] }] } */
    const state = api.data.get({ collections: [] })
    const save = () => api.data.set(state)
    const colorOf = (c) => COLORS.find((x) => x.id === c.color)?.value ?? COLORS[0].value
    const collectionOf = (tabId) => state.collections.find((c) => c.tabs.includes(tabId))
    const nextColor = () => {
      const used = new Set(state.collections.map((c) => c.color))
      return (COLORS.find((x) => !used.has(x.id)) ?? COLORS[state.collections.length % COLORS.length]).id
    }
    /** The tabs of a collection, in the order of their strip. */
    const tabsOf = (c, tabs = api.tabs.list()) =>
      tabs.filter((x) => c.tabs.includes(x.id)).sort((a, b) => (a.window === b.window ? a.index - b.index : a.window < b.window ? -1 : 1))
    const takeOut = (tabId) => {
      for (const c of state.collections) c.tabs = c.tabs.filter((id) => id !== tabId)
    }

    // tabs held over a collection while being dragged: once dropped, they are put next to it wherever they fell
    const joining = new Set()

    // A tab replaced by another one in its very place (a note opened in an empty tab: Syntex puts the note's tab
    // there, then closes the empty one) hands its collection over to the new tab. So each tab is remembered with
    // where it was last and when it first appeared.
    let before = new Map(api.tabs.list().map((tab) => [tab.id, tab]))
    const firstSeen = new Map()
    const HEIR_MS = 2000

    let updating = false
    /** Bring the collections in line with the tabs there are and with their order, then draw them. */
    const update = () => {
      // (moving a tab here tells of a change again: that one is part of this update)
      if (updating) return
      updating = true
      try {
        reconcile()
        draw()
      } finally {
        updating = false
      }
    }

    const reconcile = () => {
      let tabs = api.tabs.list()
      const now = new Map(tabs.map((tab) => [tab.id, tab]))
      const at = Date.now()
      for (const tab of tabs) if (!firstSeen.has(tab.id)) firstSeen.set(tab.id, at)
      const heirOf = (was) =>
        tabs
          .filter((tab) => tab.window === was.window && Math.abs(tab.index - was.index) <= 1 && at - firstSeen.get(tab.id) < HEIR_MS && !collectionOf(tab.id))
          .sort((a, b) => Math.abs(a.index - was.index) - Math.abs(b.index - was.index))[0]
      let changed = false

      // closed tabs leave, or hand their place over
      for (const c of state.collections) {
        c.tabs = c.tabs.flatMap((id) => {
          if (now.has(id)) return [id]
          changed = true
          joining.delete(id)
          const was = before.get(id)
          const heir = was && heirOf(was)
          return heir ? [heir.id] : []
        })
        // a tab brought to the front opens its folded collection
        if (c.folded && c.tabs.some((id) => now.get(id)?.active && !before.get(id)?.active)) {
          c.folded = false
          changed = true
        }
      }

      // tabs that were held over a collection go next to its other tabs
      for (const id of [...joining]) {
        joining.delete(id)
        const c = collectionOf(id)
        const others = c ? tabsOf(c, tabs).filter((x) => x.id !== id) : []
        if (others.length) api.tabs.move(id, others[others.length - 1].id)
      }
      tabs = api.tabs.list()

      // the order rules: a tab dragged out of the run of its collection leaves it, a tab dropped inside a run joins it
      for (const c of state.collections) {
        const run = tabsOf(c, tabs)
        if (run.length < 2) continue
        const window = run[0].window
        const strip = tabs.filter((x) => x.window === window).sort((a, b) => a.index - b.index)
        const touches = (x) => strip.slice(Math.max(0, x.index - 1), x.index + 2).some((y) => y.id !== x.id && c.tabs.includes(y.id))
        let strays = run.filter((x) => x.window !== window || !touches(x))
        // none touches another (two tabs, one dragged away): the one that went the farthest is the one that left
        // (the other may have shifted by one, into the place the dragged one left)
        if (strays.length === run.length) {
          const shift = (x) => (before.get(x.id)?.window !== x.window ? Infinity : Math.abs((before.get(x.id)?.index ?? x.index) - x.index))
          const far = Math.max(...strays.map(shift))
          const farthest = strays.filter((x) => shift(x) === far)
          strays = far > 0 && farthest.length === 1 ? farthest : []
        }
        if (strays.length && strays.length < run.length) {
          c.tabs = c.tabs.filter((id) => !strays.some((s) => s.id === id))
          changed = true
        }
        const positions = tabsOf(c, tabs).filter((x) => x.window === window).map((x) => x.index)
        for (const x of strip.slice(Math.min(...positions), Math.max(...positions) + 1)) {
          if (!collectionOf(x.id)) {
            c.tabs.push(x.id)
            changed = true
          }
        }
      }

      const kept = state.collections.filter((c) => c.tabs.length)
      if (kept.length !== state.collections.length) {
        state.collections = kept
        changed = true
      }
      if (changed) save()
      before = new Map(api.tabs.list().map((tab) => [tab.id, tab]))
      for (const id of firstSeen.keys()) if (!now.has(id)) firstSeen.delete(id)
    }

    const draw = () => {
      const tabs = api.tabs.list()
      for (const tab of tabs) {
        const c = collectionOf(tab.id)
        if (!c) {
          api.tabs.decorate(tab.id, null)
          continue
        }
        const isFirst = tabsOf(c, tabs)[0]?.id === tab.id
        const chip = isFirst
          ? {
              label: c.name,
              color: colorOf(c),
              folded: c.folded,
              onClick: () => (c.folded ? setFolded(c, false) : fold(c)),
              onMenu: (x, y) => editor(c, x, y),
              onClose: () => closeCollection(c),
              onHover: (x, y) => c.folded && hoverList(c, x, y),
              onDragTo: (target, side) => moveCollection(c, target, side),
              onLeave: leaveSoon
            }
          : undefined
        api.tabs.decorate(tab.id, { color: colorOf(c), chip, hidden: c.folded && !isFirst })
      }
    }

    const setFolded = (c, folded) => {
      c.folded = folded
      save()
      update()
    }

    /** Folded, a collection shows only its chip; a tab of it that is in front gives way to the nearest other tab. */
    const fold = (c) => {
      const tabs = api.tabs.list()
      for (const front of tabs.filter((x) => x.active && c.tabs.includes(x.id))) {
        const others = tabs.filter((x) => x.window === front.window && !c.tabs.includes(x.id))
        if (others.length) {
          others.sort((a, b) => Math.abs(a.index - front.index) - Math.abs(b.index - front.index))
          api.tabs.activate(others[0].id)
        } else {
          // nowhere else to go in that window: a new empty tab after the collection, like a browser does
          api.tabs.open({ after: tabsOf(c, tabs).pop()?.id })
        }
      }
      setFolded(c, true)
    }

    /**
     * The chip dragged and let go before or after a tab: the whole collection moves there, keeping its order. Let go on
     * a tab of another collection, it goes before or after that whole collection: collections never nest.
     */
    const moveCollection = (c, target, side) => {
      if (c.tabs.includes(target)) return
      const other = collectionOf(target)
      const run = other ? tabsOf(other) : []
      const anchor = other ? (side === 'before' ? run[0].id : run[run.length - 1].id) : target
      const mine = tabsOf(c)
      if (!mine.length) return
      // the tabs go one by one: in between, the collection looks torn apart, and the order rules must not see that
      updating = true
      try {
        if (side === 'before') api.tabs.move(mine[0].id, anchor, 'before')
        else api.tabs.move(mine[0].id, anchor)
        for (let i = 1; i < mine.length; i++) api.tabs.move(mine[i].id, mine[i - 1].id)
      } finally {
        updating = false
      }
      before = new Map(api.tabs.list().map((tab) => [tab.id, tab]))
      save()
      update()
    }

    const closeCollection = (c) => {
      const ids = [...c.tabs]
      state.collections = state.collections.filter((x) => x !== c)
      save()
      for (const id of ids) api.tabs.close(id)
      update()
    }

    /** A tab into a collection, right after its other tabs. */
    const join = (c, tabId) => {
      takeOut(tabId)
      const last = tabsOf(c).pop()
      c.tabs.push(tabId)
      if (last && last.id !== tabId) api.tabs.move(tabId, last.id)
    }

    /** A new collection, unnamed, with its editor open at once to name it, like a browser. */
    const create = (tabId) => {
      const c = { id: `c${Date.now()}`, name: '', color: nextColor(), folded: false, tabs: [] }
      state.collections.push(c)
      join(c, tabId)
      save()
      update()
      requestAnimationFrame(() => {
        const r = api.tabs.rectOf(tabId)
        if (r) editor(c, r.left, r.bottom + 4)
      })
    }

    // A folded collection lists its tabs under the chip while the mouse is on it, as a browser does: the list stays
    // while the mouse goes over from the chip to it, and goes a moment after the mouse has left both.
    let closeList = null
    let leaveTimer = null
    const stayOpen = () => {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    const leaveSoon = () => {
      stayOpen()
      leaveTimer = setTimeout(() => {
        closeList?.()
        closeList = null
      }, 250)
    }
    api.onDispose(stayOpen)

    const ICON = {
      tab: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
      plus: 'M12 5v14M5 12h14',
      pencil: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'
    }
    const icon = (d) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      // (the class icon of Syntex: its lines are as wide as those of every other icon)
      svg.setAttribute('class', 'icon tc-icon')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', d)
      svg.append(path)
      return svg
    }

    /** The list of a folded collection: its tabs (a click brings one to the front, which opens the collection), a new tab, the editor. */
    const hoverList = (c, x, y) => {
      stayOpen()
      const close = api.ui.popup({
        x,
        y,
        mount: (box, closeBox) => {
          box.onmouseenter = stayOpen
          box.onmouseleave = leaveSoon
          const row = (label, d, action, cls = '') => {
            const b = el('button', { className: 'tc-row' + cls }, [icon(d), el('span', { textContent: label })])
            b.onclick = () => {
              closeBox()
              action()
            }
            return b
          }
          const list = el('div', { className: 'tc-list' }, tabsOf(c).map((tab) => row(tab.title, ICON.tab, () => api.tabs.activate(tab.id))))
          list.style.setProperty('--c', colorOf(c))
          box.append(
            list,
            el('div', { className: 'tc-sep' }),
            row(t().newTab, ICON.plus, () => {
              const id = api.tabs.open({ after: tabsOf(c).pop()?.id })
              if (!id) return
              takeOut(id)
              c.tabs.push(id)
              c.folded = false
              save()
              update()
            }),
            row(t().edit, ICON.pencil, () => editor(c, x, y))
          )
        }
      })
      closeList = close
    }

    /** The editor of a collection, like the one of a tab group in a browser: its name, its colour and what to do. */
    const editor = (c, x, y) => {
      api.ui.popup({
        x,
        y,
        mount: (box, close) => {
          const name = el('input', { className: 'tc-name', value: c.name, placeholder: t().namePlaceholder, spellcheck: false })
          name.oninput = () => {
            c.name = name.value
            save()
            draw()
          }
          name.onkeydown = (e) => e.key === 'Enter' && close()
          const colors = el(
            'div',
            { className: 'tc-colors' },
            COLORS.map((col) => {
              const dot = el('button', { className: 'tc-color' + (col.id === c.color ? ' on' : ''), title: col[api.language()] ?? col.en })
              dot.style.setProperty('--c', col.value)
              dot.onclick = () => {
                c.color = col.id
                save()
                draw()
                for (const d of colors.children) d.classList.toggle('on', d === dot)
              }
              return dot
            })
          )
          const item = (label, action, danger) => {
            const b = el('button', { className: 'tc-item' + (danger ? ' danger' : ''), textContent: label })
            b.onclick = () => {
              close()
              action()
            }
            return b
          }
          box.append(
            name,
            colors,
            el('div', { className: 'tc-sep' }),
            item(t().newTab, () => {
              const id = api.tabs.open({ after: tabsOf(c).pop()?.id })
              if (!id) return
              takeOut(id)
              c.tabs.push(id)
              c.folded = false
              save()
              update()
            }),
            item(c.folded ? t().unfold : t().fold, () => (c.folded ? setFolded(c, false) : fold(c))),
            item(t().ungroup, () => {
              state.collections = state.collections.filter((x) => x !== c)
              save()
              update()
            }),
            el('div', { className: 'tc-sep' }),
            item(t().close, () => closeCollection(c), true)
          )
          requestAnimationFrame(() => {
            name.focus()
            name.select()
          })
        }
      })
    }

    // the right-click menu of a tab: into a new collection, into one there is, or out of its own
    api.menus.tab((tab) => {
      const own = collectionOf(tab.id)
      const others = state.collections.filter((c) => c !== own)
      const items = [{ label: t().toNew, action: () => create(tab.id) }]
      if (others.length) {
        items.push({
          label: t().toExisting,
          children: others.map((c) => ({
            label: c.name || t().unnamed,
            swatch: colorOf(c),
            action: () => {
              join(c, tab.id)
              save()
              update()
            }
          }))
        })
      }
      if (own) {
        items.push({ label: own.folded ? t().unfold : t().fold, separatorBefore: true, action: () => (own.folded ? setFolded(own, false) : fold(own)) })
        items.push({
          label: t().leave,
          action: () => {
            own.tabs = own.tabs.filter((id) => id !== tab.id)
            // out of the run: the tab goes after the collection
            const last = tabsOf(own).pop()
            if (last) api.tabs.move(tab.id, last.id)
            save()
            update()
          }
        })
        items.push({ label: t().close, danger: true, action: () => closeCollection(own) })
      }
      return items
    })

    // a dragged tab held over another one: into that one's collection, or a new collection of the two
    api.tabs.onHold((dragged, target) => {
      const there = collectionOf(target)
      if (there?.tabs.includes(dragged)) return
      takeOut(dragged)
      if (there) there.tabs.push(dragged)
      else state.collections.push({ id: `c${Date.now()}`, name: '', color: nextColor(), folded: false, tabs: [target, dragged] })
      joining.add(dragged)
      save()
      draw()
    })

    // a move of a tab tells of several changes in a row (the tab leaves its place, then comes to the new one): the
    // collections follow the tabs once those have settled, not the step in between, where the tab seems closed
    let pending = null
    api.tabs.onChange(() => {
      if (pending === null) pending = setTimeout(() => {
        pending = null
        update()
      }, 0)
    })
    api.onDispose(() => pending !== null && clearTimeout(pending))
    api.ui.addStyle(`
      .tc-name { width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--outline); background: var(--bg-app); color: var(--text); font-size: 13px; outline: none; }
      .tc-name:focus { border-color: var(--accent); }
      .tc-colors { display: flex; gap: 8px; padding: 10px 4px 6px; }
      .tc-color { width: 18px; height: 18px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15); }
      .tc-color.on { box-shadow: 0 0 0 2px var(--float-bg), 0 0 0 4px var(--c); }
      .tc-sep { height: 1px; margin: 6px 2px; background: var(--border); }
      .tc-item { display: block; width: 100%; text-align: left; padding: 7px 10px; border-radius: 6px; font-size: 13px; color: var(--text-2); }
      .tc-item:hover { background: var(--bg-hover); color: var(--text); }
      .tc-item.danger { color: var(--danger-text); }
      .tc-list { position: relative; padding-left: 8px; }
      .tc-list::before { content: ''; position: absolute; left: 2px; top: 2px; bottom: 2px; width: 3px; border-radius: 2px; background: var(--c); }
      .tc-row { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 220px; max-width: 320px; padding: 7px 10px; border-radius: 6px; font-size: 13px; color: var(--text-2); text-align: left; }
      .tc-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tc-row:hover { background: var(--bg-hover); color: var(--text); }
      .tc-icon { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; color: var(--text-3); }
    `)
    update()
  }
}
