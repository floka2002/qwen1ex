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
import psycopg2
import pandas as pd

app = Flask(__name__)

# Директория для хранения сгенерированных файлов
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Максимальное время выполнения запроса (секунды)
QUERY_TIMEOUT = 300


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
        'timestamp': datetime.now().isoformat(),
        'output_dir': OUTPUT_DIR
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
    print("=" * 50)
    print("  Greenplum SQL to Excel - Backend Server")
    print("=" * 50)
    print(f"  Output directory: {OUTPUT_DIR}")
    print(f"  Server running on: http://localhost:5000")
    print("=" * 50)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
