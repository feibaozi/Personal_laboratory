import { useState } from 'react';

interface LineagePageProps {
  projectId: string | null;
}

interface LineageNode {
  symbol_id: string;
  name: string;
  kind: string;
  file_path: string;
  start_line: number;
  depth: number;
  relation: string;
}

const KIND_COLORS: Record<string, string> = {
  Module: '#89b4fa',
  Function: '#a6e3a1',
  Class: '#fab387',
  Variable: '#f9e2af',
  Interface: '#cba6f7',
  TypeAlias: '#89dceb',
};

export default function LineagePage({ projectId }: LineagePageProps) {
  const [symbol, setSymbol] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrace = async () => {
    if (!projectId || !symbol) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `http://127.0.0.1:3456/api/projects/${projectId}/lineage?symbol=${encodeURIComponent(symbol)}`
      );
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) return <p>Run an analysis first.</p>;

  const upstream: LineageNode[] = result?.upstream || [];
  const downstream: LineageNode[] = result?.downstream || [];

  return (
    <div>
      <h2>Lineage Trace</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol name..."
          style={{
            padding: 8,
            borderRadius: 4,
            border: 'none',
            flex: 1,
            background: '#313244',
            color: '#cdd6f4',
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleTrace()}
        />
        <button
          onClick={handleTrace}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: loading ? '#45475a' : '#89b4fa',
            border: 'none',
            borderRadius: 4,
            color: '#1e1e2e',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {loading ? 'Tracing...' : 'Trace'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#f38ba820', border: '1px solid #f38ba8', borderRadius: 4, padding: 12, color: '#f38ba8', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
            <div style={{ background: '#1e1e2e', borderRadius: 8, padding: 16, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#89b4fa' }}>{upstream.length}</div>
              <div style={{ color: '#a6adc8', fontSize: 13 }}>Upstream</div>
            </div>
            <div style={{ background: '#1e1e2e', borderRadius: 8, padding: 16, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#a6e3a1' }}>{downstream.length}</div>
              <div style={{ color: '#a6adc8', fontSize: 13 }}>Downstream</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#89b4fa', marginBottom: 12 }}>▲ Upstream Dependencies</h3>
              {upstream.length === 0 ? (
                <p style={{ color: '#585b70', fontStyle: 'italic' }}>No upstream dependencies</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upstream.map((node, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#1e1e2e',
                        borderRadius: 6,
                        padding: '8px 12px',
                        borderLeft: `3px solid ${KIND_COLORS[node.kind] || '#89b4fa'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{node.name}</span>
                        <span style={{ fontSize: 11, background: '#313244', padding: '2px 8px', borderRadius: 10, color: '#a6adc8' }}>
                          {node.kind}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#585b70', marginTop: 2 }}>
                        {node.file_path}:{node.start_line}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#a6e3a1', marginBottom: 12 }}>▼ Downstream Dependents</h3>
              {downstream.length === 0 ? (
                <p style={{ color: '#585b70', fontStyle: 'italic' }}>No downstream dependents</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {downstream.map((node, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#1e1e2e',
                        borderRadius: 6,
                        padding: '8px 12px',
                        borderLeft: `3px solid ${KIND_COLORS[node.kind] || '#a6e3a1'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{node.name}</span>
                        <span style={{ fontSize: 11, background: '#313244', padding: '2px 8px', borderRadius: 10, color: '#a6adc8' }}>
                          {node.kind}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#585b70', marginTop: 2 }}>
                        {node.file_path}:{node.start_line}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}