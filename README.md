# Greenplum SQL → Excel

Веб-приложение для выполнения SQL-запросов на Greenplum и экспорта результатов в Excel.

## 🏗 Архитектура

```
┌─────────────────────┐       HTTP/JSON       ┌──────────────────────┐
│   React Frontend    │ ─────────────────────▶ │  Python/Flask API    │
│   (порт 3000)       │ ◀───────────────────── │  (порт 5000)         │
└─────────────────────┘    Excel файл           └──────────┬───────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │   Greenplum DB   │
                                                  │   (порт 5432)    │
                                                  └──────────────────┘
```

## 🚀 Быстрый старт (проверка без Greenplum)

### 1. Установите Python зависимости

```bash
pip install -r requirements.txt
```

### 2. Запустите бэкенд в демо-режиме

```bash
python backend.py
```

Вы увидите:
```
=======================================================
  Greenplum SQL to Excel - Backend Server
=======================================================
  Режим:          🧪 ДЕМО-РЕЖИМ (без подключения к БД)
  Output dir:     /path/to/output
  Server:         http://localhost:5000
  Health check:   http://localhost:5000/api/health
-------------------------------------------------------
  💡 Для подключения к реальной БД:
     export DEMO_MODE=false
     python backend.py
=======================================================
```

### 3. Откройте фронтенд

Откройте `dist/index.html` в браузере или запустите dev-сервер:

```bash
npm run dev
```

### 4. Проверьте работу

1. Убедитесь что **Backend URL** = `http://localhost:5000`
2. Выберите шаблон запроса (например "Все таблицы")
3. Укажите имя файла (например `test`)
4. Нажмите **"Выполнить и экспортировать"**
5. Нажмите **"Скачать"** для получения Excel файла

## 🧪 Проверка через curl

### Health check
```bash
curl http://localhost:5000/api/health
```
Ожидаемый ответ:
```json
{
  "status": "ok",
  "mode": "DEMO",
  "timestamp": "2024-...",
  "output_dir": "...",
  "message": "Демо-режим активен"
}
```

### Выполнение запроса (демо)
```bash
curl -X POST http://localhost:5000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "host": "localhost",
    "port": "5432",
    "database": "test",
    "user": "test",
    "password": "test",
    "sql": "SELECT * FROM users LIMIT 100",
    "filename": "test_output.xlsx"
  }'
```

Ожидаемый ответ:
```json
{
  "success": true,
  "message": "[ДЕМО] Файл создан: test_output.xlsx (тестовые данные)",
  "rows": 20,
  "filename": "abc12345_test_output.xlsx"
}
```

### Скачивание файла
```bash
curl -O http://localhost:5000/api/download/<filename_from_response>
```

## 🔴 Подключение к реальному Greenplum

### 1. Запустите бэкенд в продакшн-режиме

```bash
export DEMO_MODE=false
python backend.py
```

### 2. Укажите реальные параметры подключения

В веб-интерфейсе раскройте секцию "Подключение к Greenplum" и укажите:
- **Хост**: адрес вашего Greenplum master-узла
- **Порт**: обычно 5432
- **База данных**: имя БД
- **Пользователь**: логин
- **Пароль**: пароль

### 3. Выполните SQL запрос

Введите SQL и нажмите "Выполнить и экспортировать".

## 📁 Структура проекта

```
├── src/
│   ├── App.tsx          # React фронтенд
│   ├── main.tsx         # Точка входа
│   └── index.css        # Стили (Tailwind)
├── backend.py           # Python Flask сервер
├── requirements.txt     # Python зависимости
├── index.html           # HTML шаблон
├── package.json         # Node.js зависимости
└── output/              # Сгенерированные Excel файлы (создаётся автоматически)
```

## ⚠️ Возможные проблемы

| Проблема | Решение |
|----------|---------|
| CORS ошибка | Убедитесь что `flask-cors` установлен и `CORS(app)` вызван в backend.py |
| "Ошибка подключения к серверу" | Проверьте что бэкенд запущен на порту 5000 |
| Файл не скачивается | Проверьте что URL бэкенда корректный (не `localhost` если открываете удалённо) |
| psycopg2 ошибка | Установите `psycopg2-binary` (не `psycopg2`) |

## 🔧 Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DEMO_MODE` | `true` | Если `true` — работает без реальной БД |
| `QUERY_TIMEOUT` | `300` | Максимальное время выполнения SQL (сек) |
