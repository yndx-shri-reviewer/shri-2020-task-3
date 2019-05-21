# Задание 3 — найди ошибки

В этом репозитории находятся материалы тестового задания "Найди ошибки" для [15-й Школы разработки интерфейсов](https://yandex.ru/promo/academy/shri) (осень 2019, Москва).

Для работы приложения нужен [Node.JS](https://nodejs.org/en/) v10 или выше, а также редактор [VS Code](https://code.visualstudio.com).

## Задание

**Вам дан исходный код приложения, в котором есть ошибки. Некоторые из них — стилистические, а другие — даже не позволят вам запустить приложение. Вам нужно найти все ошибки и исправить их.**

Тестовое приложение — это плагин VS Code для удобного прототипирования интерфейсов с помощью дизайн-системы из первого задания. Вы можете описать в файле `.json` блоки, из которых состоит интерфейс. Плагин добавляет превью (1) и линтер (2) для структуры блоков.

![](https://jing.yandex-team.ru/files/dima117a/extension.png)

### 1. Превью интерфейса

- превью интерфейса доступно для всех файлов `.json`
- превью открывается в отдельной вкладке
  - при выполнении команды `Example: Show preview` через палитру команд
  - при нажатии кнопки сверху от редактора (см. скриншот)
  - при нажатии горячих клавиш **⌘⇧V** (для MacOS) или **Ctrl+Shift+V** (для Windows)
- вкладка превью должна открываться рядом с текущим редактором
- если превью уже открыто, то вместо открытия еще одной вкладки, пользователь должен переходить к уже открытой
- при изменении структуры блоков в редакторе превью должно обновляться
- сейчас превью отображает структуру блоков в виде прямоугольников — реализуйте отображение превью с помощью верстки и JS из первого задания

### 2. Линтер структуры блоков

- линтер применяется для всех файлов `.json`
- линтер подсвечивает ошибочное место в файле и отображает сообщение при наведении мыши
- линтер отображает сообщения на панели `Problems` (**⌘⇧M** для MacOS или **Ctrl+Shift+M** для Windows), сообщения группируются по файлам, при клике происходит переход к ошибочному месту
- сейчас плагин использует линтер-заглушку, проверяющий всего два правило: 1) "запрещены названия полей в верхнем регистре", 2) "в каждом объекте должно быть поле `block`" — подключите в проект линтер из второго задания

### 3. Настройки

Плагин добавляет в настройки VS Code новый раздел `Example` с параметрами:

- `example.linter.enabled` — использовать линтер
- `example.linter.severity.uppercaseNamesIsForbidden` — тип сообщения для правила "запрещены названия полей в верхнем регистре"
- `example.linter.severity.blockNameIsRequired` — тип сообщения для правила "в каждом объекте должно быть поле `block`"

Типы сообщений: `Error`, `Warning`, `Information`, `Hint`.

При изменении конфигурации новые нсатройки должны применяться к работе линтера.

## Как запустить

1. открыть проект в VS Code
2. запустить `npm i`
3. нажать `F5`

Должно открыться еще одно окно VS Code с подключенным плагином.
