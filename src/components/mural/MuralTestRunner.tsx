import { useState } from 'react';
import { Play, AlertCircle, CheckCircle2, Loader } from 'lucide-react';

interface TestResult {
  passed: number;
  failed: number;
  details: Array<{
    name: string;
    status: 'pass' | 'fail';
    expected: any;
    actual: any;
    error?: string;
  }>;
}

export function MuralTestRunner() {
  const [identifier, setIdentifier] = useState('76');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTests = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/mural/processes/${identifier}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Processo não encontrado`);
      }

      const data = await response.json();
      const detail = data.detail || data;

      const tests: TestResult['details'] = [];

      // Test 1: Resumo básico existe
      tests.push({
        name: 'Resumo exists',
        status: detail?.resumo ? 'pass' : 'fail',
        expected: 'object',
        actual: typeof detail?.resumo,
      });

      // Test 2: Código processa
      tests.push({
        name: 'Codigo exists',
        status: detail?.resumo?.codigo ? 'pass' : 'fail',
        expected: 'truthy',
        actual: detail?.resumo?.codigo || 'null',
      });

      // Test 3: Número processo existe
      tests.push({
        name: 'Numero processo exists',
        status: detail?.resumo?.numero_processo ? 'pass' : 'fail',
        expected: 'truthy',
        actual: detail?.resumo?.numero_processo || 'null',
      });

      // Test 4: Modalidade existe
      tests.push({
        name: 'Modalidade exists',
        status: detail?.resumo?.modalidade ? 'pass' : 'fail',
        expected: 'truthy',
        actual: detail?.resumo?.modalidade || 'null',
      });

      // Test 5: Status normalizado existe
      tests.push({
        name: 'Status normalizado exists',
        status: detail?.resumo?.status_normalizado ? 'pass' : 'fail',
        expected: 'object',
        actual: typeof detail?.resumo?.status_normalizado,
      });

      // Test 6: Items array existe
      tests.push({
        name: 'Items array exists',
        status: Array.isArray(detail?.itens) ? 'pass' : 'fail',
        expected: 'array',
        actual: Array.isArray(detail?.itens) ? 'array' : typeof detail?.itens,
      });

      // Test 7: Items > 0 (honest data, não fake)
      tests.push({
        name: 'Items count > 0',
        status: (detail?.itens?.length || 0) > 0 ? 'pass' : 'fail',
        expected: '> 0',
        actual: detail?.itens?.length || 0,
      });

      // Test 8: Anexos array existe
      tests.push({
        name: 'Anexos array exists',
        status: Array.isArray(detail?.anexos) ? 'pass' : 'fail',
        expected: 'array',
        actual: Array.isArray(detail?.anexos) ? 'array' : typeof detail?.anexos,
      });

      // Test 9: Histórico array existe
      tests.push({
        name: 'Historico array exists',
        status: Array.isArray(detail?.historico) ? 'pass' : 'fail',
        expected: 'array',
        actual: Array.isArray(detail?.historico) ? 'array' : typeof detail?.historico,
      });

      // Test 10: Link canônico válido
      tests.push({
        name: 'Link canonico starts with http',
        status: detail?.resumo?.link_canonico?.startsWith('http') ? 'pass' : 'fail',
        expected: 'http*',
        actual: detail?.resumo?.link_canonico || 'null',
      });

      const passed = tests.filter((t) => t.status === 'pass').length;
      const failed = tests.filter((t) => t.status === 'fail').length;

      setResult({ passed, failed, details: tests });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-slate-50">
      <h3 className="text-lg font-semibold mb-4">🧪 Teste Dinâmico de Processo Mural</h3>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Código ou número do processo"
          className="flex-1 px-3 py-2 border rounded"
          disabled={loading}
        />
        <button
          onClick={runTests}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
          {loading ? 'Testando...' : 'Testar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex gap-2">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-green-600" />
              <span className="font-semibold">Passou: {result.passed}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-600" />
              <span className="font-semibold">Falhou: {result.failed}</span>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-200">
                <th className="border px-3 py-2 text-left">Teste</th>
                <th className="border px-3 py-2 text-left">Status</th>
                <th className="border px-3 py-2 text-left">Esperado</th>
                <th className="border px-3 py-2 text-left">Obtido</th>
              </tr>
            </thead>
            <tbody>
              {result.details.map((test, idx) => (
                <tr key={idx} className={test.status === 'pass' ? 'bg-green-50' : 'bg-red-50'}>
                  <td className="border px-3 py-2 font-mono text-xs">{test.name}</td>
                  <td className="border px-3 py-2">
                    <span
                      className={
                        test.status === 'pass'
                          ? 'text-green-700 font-semibold'
                          : 'text-red-700 font-semibold'
                      }
                    >
                      {test.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="border px-3 py-2 font-mono text-xs">
                    {typeof test.expected === 'object'
                      ? JSON.stringify(test.expected)
                      : String(test.expected)}
                  </td>
                  <td className="border px-3 py-2 font-mono text-xs">
                    {typeof test.actual === 'object'
                      ? JSON.stringify(test.actual)
                      : String(test.actual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
