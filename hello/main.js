// Пример аддона Syntex. Скопируйте папку hello в <папка заметок>/.syntex/plugins/
// и включите аддон в «Настройки → Аддоны».

export default {
  onload(api) {
    const ru = () => api.language() === 'ru'
    const settings = () => ({ greeting: 'short', ...api.data.get({}) })

    // команда: появляется в списке команд (Ctrl+Shift+P) и в настройках горячих клавиш
    const greet = () => {
      const long = settings().greeting === 'long'
      const text = ru() ? (long ? 'Здравствуйте! Заметок в папке: ' : 'Привет! Заметок: ') : long ? 'Good day! Notes in the folder: ' : 'Hi! Notes: '
      api.ui.notice(text + api.vault.list().length)
    }
    api.commands.add({ id: 'greet', name: { ru: 'Поздороваться', en: 'Say hello' }, keys: 'Ctrl+Alt+H', run: greet })

    // пункт в меню текста (в списке «Вставка») и в меню дерева файлов
    api.menus.editor('insert', (note) => [
      { label: { ru: 'Подпись', en: 'Signature' }, icon: 'file', action: () => note.insert('\n— ' + (ru() ? 'с приветом' : 'best regards') + '\n') }
    ])
    api.menus.file((path, isFolder) =>
      isFolder ? [] : [{ label: { ru: 'Сколько знаков?', en: 'How many characters?' }, action: async () => api.ui.notice(String((await api.vault.read(path)).length)) }]
    )

    // настройка аддона: видна в «Настройки → Аддоны» под ним, пока он включён
    api.settings.add([
      {
        id: 'greeting',
        type: 'select',
        title: { ru: 'Приветствие', en: 'Greeting' },
        options: [
          { value: 'short', label: { ru: 'Короткое', en: 'Short' } },
          { value: 'long', label: { ru: 'Вежливое', en: 'Polite' } }
        ],
        value: () => settings().greeting,
        onChange: (greeting) => api.data.set({ ...settings(), greeting })
      }
    ])

    // блок на стартовой странице (пустая вкладка), под недавними заметками и закладками
    api.startPage.add({
      title: { ru: 'Привет', en: 'Hello' },
      mount: (el) => {
        el.textContent = (ru() ? 'Заметок в папке: ' : 'Notes in the folder: ') + api.vault.list().length
      }
    })

    // расширение редактора: слово TODO подсвечивается во всех заметках (из модулей CodeMirror самого Syntex)
    const { Decoration, ViewPlugin, MatchDecorator } = api.lib.view
    const todo = new MatchDecorator({ regexp: /TODO/g, decoration: Decoration.mark({ class: 'hello-todo' }) })
    api.editor.addExtension(
      ViewPlugin.define(
        (view) => ({
          decorations: todo.createDeco(view),
          update(u) {
            this.decorations = todo.updateDeco(u, this.decorations)
          }
        }),
        { decorations: (p) => p.decorations }
      )
    )
    api.ui.addStyle('.hello-todo { background: rgba(255, 200, 0, 0.3); border-radius: 3px }')

    // текст под каждой заметкой; вызывается снова, когда меняется текст или выделение
    api.statusBar.add((note) => (note.text().includes('TODO') ? 'TODO' : null))

    // события
    api.events.on('note-save', () => api.data.set({ ...settings(), saves: (settings().saves ?? 0) + 1 }))

    // всё, что добавлено через api, убирается само, когда аддон выключают;
    // для остального есть api.onDispose(() => { ... })
  },

  onunload() {}
}
