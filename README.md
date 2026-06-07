# PGN/FEN Chess Viewer

Веб-демо для просмотра шахматных партий и позиций в форматах **PGN** и **FEN**. Сайт построен на [Astro](https://astro.build/) и использует библиотеку [@mliebelt/pgn-viewer](https://github.com/mliebelt/pgn-viewer).

**Демо:** [www.chessberry.ru](https://www.chessberry.ru)

## Возможности

- Загрузка партий в формате PGN с заголовками, ходами и вариантами
- Просмотр статических позиций в формате FEN
- Поддержка синтаксиса Obsidian: блоки ` ```pgn ` и ` ```fen `
- Поддержка записи `fen:` в начале PGN (позиция + последующие ходы)
- Интерактивная доска с координатами, нотацией и навигацией по ходам
- Адаптивный размер доски под ширину экрана
- Корректное отображение вариантов в записи партии

## Быстрый старт

### Требования

- [Node.js](https://nodejs.org/) 18 или новее
- npm

### Установка и запуск

```bash
git clone <url-репозитория>
cd astro
npm install
npm run dev
```

Сайт будет доступен по адресу `http://localhost:4321`.

### Сборка для продакшена

```bash
npm run build
```

Результат сборки появится в папке `dist/`. Для локальной проверки собранной версии:

```bash
npm run preview
```

## Использование

1. Вставьте PGN или FEN в текстовое поле.
2. Нажмите **▶ Загрузить PGN**.
3. Партия или позиция отобразятся во встроенном вьювере.

### Примеры ввода

**PGN с заголовками:**

```
[Event "Demo"]
[White "Player 1"]
[Black "Player 2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0
```

**FEN (статическая позиция):**

```
r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3
```

**Блок Obsidian:**

````
```pgn
1. d4 Nf6 2. c4 e6 3. Nc3 Bb4
```
````

**PGN с начальной позицией через `fen:`:**

```
fen: r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4
1. Bxf7+ Kxf7 2. Ng5+ Kg8 3. Qf3# 1-0
```

## Структура проекта

```
astro/
├── src/
│   └── pages/
│       └── index.astro      # Главная страница
├── public/
│   ├── css/
│   │   └── styles.css       # Стили
│   ├── js/
│   │   └── demo.js          # Логика демо-вьювера
│   └── vendor/
│       └── pgn-viewer/
│           └── dist.js      # Библиотека pgn-viewer
├── astro.config.mjs         # Конфигурация Astro
├── package.json
└── dist/                    # Собранный сайт (генерируется при build)
```

## Технологии

| Компонент | Описание |
|-----------|----------|
| [Astro](https://astro.build/) | Статический генератор сайта |
| [@mliebelt/pgn-viewer](https://github.com/mliebelt/pgn-viewer) | Рендер доски и нотации |
| Vanilla JS | Обработка ввода PGN/FEN и управление вьювером |

## Деплой

Проект собирается в статические файлы (`dist/`). Папку `dist/` можно разместить на любом хостинге статических сайтов (GitHub Pages, Netlify, nginx и т.д.).

В `astro.config.mjs` указан базовый URL сайта:

```js
site: 'https://www.chessberry.ru'
```

## Скрипты npm

| Команда | Описание |
|---------|----------|
| `npm run dev` | Локальный сервер разработки |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Просмотр собранной версии |

## Контакты

- Email: **mychessworld@yahoo.com**
- Сайт: [www.chessberry.ru](https://www.chessberry.ru)

## Лицензия

Проект распространяется «как есть». Библиотека [@mliebelt/pgn-viewer](https://github.com/mliebelt/pgn-viewer) имеет собственную лицензию — см. репозиторий автора.
