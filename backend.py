"""
Greenplum SQL to Excel - Backend Server
========================================
Flask сервер для выполнения SQL запросов на Greenplum
и экспорта результатов в Excel файл.

Запуск:
    pip install flask psycopg2-binary openpyxl pandas
    python backend.py

Сервер запустится на http://localhost:5000
"""

import os
import uuid
import traceback
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import psycopg2
import pandas as pd

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для фронтенда

# Директория для хранения сгенерированных файлов
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Максимальное время выполнения запроса (секунды)
QUERY_TIMEOUT = 300

# ДЕМО-РЕЖИМ: если True, не подключается к реальной БД, а возвращает тестовые данные
DEMO_MODE = os.environ.get('DEMO_MODE', 'true').lower() == 'true'


def generate_demo_data(sql: str) -> pd.DataFrame:
    """
    Генерирует тестовые данные на основе SQL запроса (для демо-режима).
    Парсит запрос и возвращает реалистичные мок-данные.
    """
    sql_lower = sql.lower()
    
    # Определяем тип запроса и генерируем соответствующие данные
    if 'pg_tables' in sql_lower or 'information_schema' in sql_lower:
        # Системные таблицы
        data = {
            'schemaname': ['public'] * 8 + ['analytics'] * 4,
            'tablename': [
                'users', 'orders', 'products', 'categories',
                'payments', 'reviews', 'inventory', 'shipping',
                'daily_sales', 'monthly_report', 'user_stats', 'kpi_dashboard'
            ],
        }
        return pd.DataFrame(data)
    
    elif 'information_schema.columns' in sql_lower:
        # Структура таблицы
        data = {
            'column_name': ['id', 'name', 'email', 'created_at', 'status', 'amount', 'description', 'updated_at'],
            'data_type': ['integer', 'varchar', 'varchar', 'timestamp', 'varchar', 'numeric', 'text', 'timestamp'],
            'is_nullable': ['NO', 'YES', 'NO', 'NO', 'YES', 'YES', 'YES', 'YES'],
        }
        return pd.DataFrame(data)
    
    elif 'count' in sql_lower:
        # Агрегатный запрос
        import random
        return pd.DataFrame({'total': [random.randint(1000, 500000)]})
    
    else:
        # Общий случай - генерируем таблицу с данными
        import random
        
        num_rows = 20  # Количество тестовых строк
        
        # Определяем количество колонок из SELECT
        data = {
            'id': list(range(1, num_rows + 1)),
            'name': [f'Запись_{i}' for i in range(1, num_rows + 1)],
            'category': random.choices(['Электроника', 'Одежда', 'Продукты', 'Книги', 'Спорт'], k=num_rows),
            'amount': [round(random.uniform(100, 50000), 2) for _ in range(num_rows)],
            'quantity': [random.randint(1, 100) for _ in range(num_rows)],
            'status': random.choices(['active', 'pending', 'completed', 'cancelled'], k=num_rows),
            'created_date': pd.date_range('2024-01-01', periods=num_rows, freq='D').strftime('%Y-%m-%d').tolist(),
            'description': [f'Описание для записи #{i}' for i in range(1, num_rows + 1)],
        }
        return pd.DataFrame(data)


@app.route('/api/execute', methods=['POST'])
def execute_query():
    """
    Выполняет SQL запрос на Greenplum и сохраняет результат в Excel.
    
    Ожидаемый JSON:
    {
        "host": "localhost",
        "port": "5432",
        "database": "mydb",
        "user": "gpadmin",
        "password": "secret",
        "sql": "SELECT * FROM table LIMIT 100",
        "filename": "output.xlsx"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'Пустой запрос'}), 400
        
        # Извлекаем параметры подключения
        host = data.get('host', 'localhost')
        port = int(data.get('port', 5432))
        database = data.get('database', '')
        user = data.get('user', '')
        password = data.get('password', '')
        
        # SQL запрос и имя файла
        sql = data.get('sql', '').strip()
        filename = data.get('filename', 'output.xlsx')
        
        # Валидация
        if not sql:
            return jsonify({'success': False, 'message': 'SQL запрос не может быть пустым'}), 400
        
        # В демо-режиме не требуем реальные credentials
        if not DEMO_MODE:
            if not database:
                return jsonify({'success': False, 'message': 'Укажите имя базы данных'}), 400
            if not user:
                return jsonify({'success': False, 'message': 'Укажите имя пользователя'}), 400
        
        # Убедимся, что файл имеет расширение .xlsx
        if not filename.endswith('.xlsx'):
            filename += '.xlsx'
        
        # Добавляем уникальный префикс к имени файла
        unique_id = uuid.uuid4().hex[:8]
        safe_filename = f"{unique_id}_{filename}"
        filepath = os.path.join(OUTPUT_DIR, safe_filename)
        
        # === ДЕМО-РЕЖИМ ===
        if DEMO_MODE:
            print(f"[DEMO] Выполнение запроса: {sql[:80]}...")
            
            # Генерируем тестовые данные
            df = generate_demo_data(sql)
            
            # Сохраняем в Excel
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Результат')
                
                worksheet = writer.sheets['Результат']
                for idx, col in enumerate(df.columns):
                    max_len = max(
                        df[col].astype(str).map(len).max(),
                        len(str(col))
                    ) + 2
                    max_len = min(max_len, 50)
                    worksheet.column_dimensions[
                        worksheet.cell(row=1, column=idx + 1).column_letter
                    ].width = max_len
            
            return jsonify({
                'success': True,
                'message': f'[ДЕМО] Файл создан: {filename} (тестовые данные)',
                'rows': len(df),
                'filename': safe_filename
            })
        
        # === РЕАЛЬНЫЙ РЕЖИМ ===
        # Подключение к Greenplum и выполнение запроса
        conn = None
        try:
            conn = psycopg2.connect(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                connect_timeout=10,
                options=f'-c statement_timeout={QUERY_TIMEOUT * 1000}'
            )
            
            # Выполняем запрос
            cursor = conn.cursor()
            cursor.execute(sql)
            
            # Проверяем, возвращает ли запрос данные
            if cursor.description is None:
                # Это запрос без возврата данных (INSERT, UPDATE, DELETE, etc.)
                affected_rows = cursor.rowcount
                conn.commit()
                cursor.close()
                conn.close()
                
                return jsonify({
                    'success': True,
                    'message': f'Запрос выполнен успешно. Затронуто строк: {affected_rows}',
                    'rows': affected_rows,
                    'filename': safe_filename
                })
            
            # Получаем результаты
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            # Создаём DataFrame и сохраняем в Excel
            df = pd.DataFrame(rows, columns=columns)
            
            # Сохраняем в Excel с форматированием
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Результат')
                
                # Автоматическая ширина колонок
                worksheet = writer.sheets['Результат']
                for idx, col in enumerate(df.columns):
                    max_len = max(
                        df[col].astype(str).map(len).max(),
                        len(str(col))
                    ) + 2
                    # Ограничиваем максимальную ширину
                    max_len = min(max_len, 50)
                    worksheet.column_dimensions[
                        worksheet.cell(row=1, column=idx + 1).column_letter
                    ].width = max_len
            
            return jsonify({
                'success': True,
                'message': f'Файл успешно создан: {filename}',
                'rows': len(rows),
                'filename': safe_filename
            })
            
        except psycopg2.OperationalError as e:
            return jsonify({
                'success': False,
                'message': f'Ошибка подключения к Greenplum: {str(e)}'
            }), 500
        except psycopg2.ProgrammingError as e:
            return jsonify({
                'success': False,
                'message': f'Ошибка SQL: {str(e)}'
            }), 400
        except psycopg2.Error as e:
            return jsonify({
                'success': False,
                'message': f'Ошибка базы данных: {str(e)}'
            }), 500
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Внутренняя ошибка сервера: {str(e)}'
        }), 500


@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    """Скачивание сгенерированного Excel файла."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'message': 'Файл не найден'}), 404
    
    return send_file(
        filepath,
        as_attachment=True,
        download_name=filename.split('_', 1)[1] if '_' in filename else filename,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка работоспособности сервера."""
    return jsonify({
        'status': 'ok',
        'mode': 'DEMO' if DEMO_MODE else 'PRODUCTION',
        'timestamp': datetime.now().isoformat(),
        'output_dir': OUTPUT_DIR,
        'message': 'Демо-режим активен' if DEMO_MODE else 'Подключён к реальной БД'
    })


@app.route('/')
def index():
    """Простая страница-заглушка."""
    return '''
    <html>
    <head><title>Greenplum SQL to Excel - API Server</title></head>
    <body style="font-family: sans-serif; padding: 40px; background: #1a1a2e; color: #eee;">
        <h1>🟢 Greenplum SQL to Excel - Backend</h1>
        <p>Сервер работает и ожидает запросы.</p>
        <h3>API Endpoints:</h3>
        <ul>
            <li><code>POST /api/execute</code> - Выполнить SQL запрос</li>
            <li><code>GET /api/download/&lt;filename&gt;</code> - Скачать файл</li>
            <li><code>GET /api/health</code> - Проверка статуса</li>
        </ul>
        <h3>Пример запроса:</h3>
        <pre style="background: #0d0d1a; padding: 15px; border-radius: 8px; overflow-x: auto;">
curl -X POST http://localhost:5000/api/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "host": "gp-master.example.com",
    "port": "5432",
    "database": "analytics",
    "user": "gpadmin",
    "password": "secret",
    "sql": "SELECT * FROM sales LIMIT 100",
    "filename": "sales_report.xlsx"
  }'
        </pre>
    </body>
    </html>
    '''


if __name__ == '__main__':
    mode = "🧪 ДЕМО-РЕЖИМ (без подключения к БД)" if DEMO_MODE else "🔴 ПРОДАКШН (реальная БД)"
    print("=" * 55)
    print("  Greenplum SQL to Excel - Backend Server")
    print("=" * 55)
    print(f"  Режим:          {mode}")
    print(f"  Output dir:     {OUTPUT_DIR}")
    print(f"  Server:         http://localhost:5000")
    print(f"  Health check:   http://localhost:5000/api/health")
    print("-" * 55)
    if DEMO_MODE:
        print("  💡 Для подключения к реальной БД:")
        print("     export DEMO_MODE=false")
        print("     python backend.py")
    else:
        print("  💡 Для демо-режима (без БД):")
        print("     export DEMO_MODE=true")
        print("     python backend.py")
    print("=" * 55)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
