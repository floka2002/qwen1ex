import { useState } from 'react';

interface ConnectionConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

interface QueryResult {
  success: boolean;
  message: string;
  rows?: number;
  filename?: string;
}

function App() {
  const [backendUrl, setBackendUrl] = useState('http://localhost:5000');
  const [connection, setConnection] = useState<ConnectionConfig>({
    host: 'localhost',
    port: '5432',
    database: '',
    user: '',
    password: '',
  });
  const [sqlQuery, setSqlQuery] = useState('');
  const [filename, setFilename] = useState('output');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showConnection, setShowConnection] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sqlQuery.trim()) {
      setResult({ success: false, message: 'Введите SQL запрос' });
      return;
    }
    if (!filename.trim()) {
      setResult({ success: false, message: 'Введите имя файла' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${backendUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connection,
          sql: sqlQuery,
          filename: filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: `Ошибка подключения к серверу: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}. Убедитесь, что Python бэкенд запущен.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (result?.filename) {
      window.open(`${backendUrl}/api/download/${result.filename}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Greenplum SQL → Excel</h1>
            <p className="text-xs text-blue-300">Выполнение SQL запросов и экспорт в Excel</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Backend URL */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-sm text-gray-400 whitespace-nowrap">Backend URL:</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            className="flex-1 max-w-md px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="http://localhost:5000"
          />
          <span className="text-xs text-gray-500">(Python Flask сервер)</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel - Connection & Query */}
          <div className="lg:col-span-2 space-y-6">
            {/* Connection Settings */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowConnection(!showConnection)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-white font-medium">Подключение к Greenplum</span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${showConnection ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showConnection && (
                <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Хост</label>
                    <input
                      type="text"
                      value={connection.host}
                      onChange={(e) => setConnection({ ...connection, host: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Порт</label>
                    <input
                      type="text"
                      value={connection.port}
                      onChange={(e) => setConnection({ ...connection, port: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="5432"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">База данных</label>
                    <input
                      type="text"
                      value={connection.database}
                      onChange={(e) => setConnection({ ...connection, database: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="my_database"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Пользователь</label>
                    <input
                      type="text"
                      value={connection.user}
                      onChange={(e) => setConnection({ ...connection, user: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="gpadmin"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">Пароль</label>
                    <input
                      type="password"
                      value={connection.password}
                      onChange={(e) => setConnection({ ...connection, password: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SQL Query */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <span className="text-white font-medium">SQL Запрос</span>
              </div>
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="w-full h-48 px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-green-300 font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-y"
                placeholder="SELECT * FROM my_table LIMIT 100;"
                spellCheck={false}
              />
            </div>

            {/* Filename & Submit */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Имя файла</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="output"
                    />
                    <span className="px-3 py-2 bg-white/10 border border-white/10 border-l-0 rounded-r-lg text-gray-400 text-sm">
                      .xlsx
                    </span>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-green-500/20 disabled:shadow-none"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Выполняется...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Выполнить и экспортировать
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel - Results */}
          <div className="space-y-6">
            {/* Result Status */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-white font-medium">Результат</span>
              </div>

              {!result && !loading && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">Здесь появится результат выполнения запроса</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <p className="text-blue-300 text-sm">Выполнение запроса...</p>
                </div>
              )}

              {result && !loading && (
                <div className={`p-4 rounded-lg ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <div>
                      <p className={`font-medium ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                        {result.success ? 'Успешно!' : 'Ошибка'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">{result.message}</p>
                      {result.success && result.rows !== undefined && (
                        <p className="text-sm text-gray-500 mt-2">
                          Строк: {result.rows}
                        </p>
                      )}
                    </div>
                  </div>

                  {result.success && result.filename && (
                    <button
                      onClick={handleDownload}
                      className="mt-4 w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Скачать {result.filename}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Templates */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-white font-medium">Шаблоны запросов</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Все таблицы', query: "SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename;" },
                  { label: 'Структура таблицы', query: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'your_table' ORDER BY ordinal_position;" },
                  { label: 'Топ 100 записей', query: "SELECT * FROM your_table LIMIT 100;" },
                  { label: 'Количество записей', query: "SELECT COUNT(*) as total FROM your_table;" },
                ].map((template) => (
                  <button
                    key={template.label}
                    onClick={() => setSqlQuery(template.query)}
                    className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    <span className="font-medium">{template.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5 truncate font-mono">{template.query}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-white font-medium">Запуск бэкенда</span>
              </div>
              <div className="bg-black/30 rounded-lg p-3 font-mono text-xs text-gray-400">
                <p className="text-green-400"># Установить зависимости</p>
                <p>pip install flask psycopg2-binary openpyxl</p>
                <p className="text-green-400 mt-2"># Запустить сервер</p>
                <p>python backend.py</p>
                <p className="text-green-400 mt-2"># Сервер запустится на :5000</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
