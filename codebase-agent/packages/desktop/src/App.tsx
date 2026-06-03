import { useState, useEffect, Component, ReactNode } from 'react';
import GraphPage from './GraphPage.js';
import DocsPage from './DocsPage.js';
import LineagePage from './LineagePage.js';

type Page = 'dashboard' | 'graph' | 'lineage' | 'docs';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: '#f38ba8' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#a6adc8' }}>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              background: '#89b4fa',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#1e1e2e',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Skeleton({ width, height }: { width: string; height: string }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'linear-gradient(90deg, #313244 25%, #45475a 50%, #313244 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: 6,
      }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <Skeleton width="200px" height="32px" />
      <div style={{ marginTop: 16 }}>
        <Skeleton width="300px" height="20px" />
      </div>
      <div style={{ marginTop: 24 }}>
        <Skeleton width="100%" height="16px" />
        <div style={{ marginTop: 8 }}><Skeleton width="80%" height="16px" /></div>
        <div style={{ marginTop: 8 }}><Skeleton width="60%" height="16px" /></div>
        <div style={{ marginTop: 8 }}><Skeleton width="90%" height="16px" /></div>
      </div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [projectPath, setProjectPath] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://127.0.0.1:3456/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
      });
      const data = await res.json();
      if (data.status === 'error') {
        setError(data.error || data.message || 'Analysis failed');
        return;
      }
      setProjectId(data.projectId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui' }}>
      <nav
        style={{
          width: 220,
          background: '#1e1e2e',
          color: '#cdd6f4',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2 style={{ margin: 0 }}>Codebase Agent</h2>
        <div style={{ marginTop: 16 }}>
          <input
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="Project path..."
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 4,
              border: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !projectPath}
            style={{
              width: '100%',
              marginTop: 8,
              padding: 8,
              background: loading ? '#45475a' : '#89b4fa',
              border: 'none',
              borderRadius: 4,
              cursor: loading || !projectPath ? 'not-allowed' : 'pointer',
              color: '#1e1e2e',
              fontWeight: 'bold',
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
          {error && (
            <div style={{ background: '#f38ba820', border: '1px solid #f38ba8', borderRadius: 4, padding: 8, marginTop: 8 }}>
              <p style={{ color: '#f38ba8', fontSize: 12, margin: 0 }}>
                {error}
              </p>
            </div>
          )}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 24 }}>
          {(['dashboard', 'graph', 'lineage', 'docs'] as Page[]).map((p) => (
            <li
              key={p}
              onClick={() => setPage(p)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: 4,
                background: page === p ? '#313244' : 'transparent',
                textTransform: 'capitalize',
              }}
            >
              {p}
            </li>
          ))}
        </ul>
      </nav>
      <main
        style={{
          flex: 1,
          padding: 24,
          background: '#181825',
          color: '#cdd6f4',
          overflow: 'auto',
        }}
      >
        <ErrorBoundary>
          {page === 'dashboard' && <DashboardPage projectId={projectId} />}
          {page === 'graph' && <GraphPage projectId={projectId} />}
          {page === 'lineage' && <LineagePage projectId={projectId} />}
          {page === 'docs' && <DocsPage projectId={projectId} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function DashboardPage({ projectId }: { projectId: string | null }) {
  const [debt, setDebt] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setDashLoading(true);
    Promise.all([
      fetch(`http://127.0.0.1:3456/api/projects/${projectId}/debt`).then((r) => r.json()),
      fetch(`http://127.0.0.1:3456/api/projects/${projectId}/refactor-suggestions`).then((r) => r.json()),
    ])
      .then(([debtData, suggestionsData]) => {
        setDebt(debtData);
        setSuggestions(suggestionsData);
      })
      .catch(console.error)
      .finally(() => setDashLoading(false));
  }, [projectId]);

  if (!projectId) return <p>Run an analysis to see the dashboard.</p>;
  if (dashLoading) return <DashboardSkeleton />;

  const debtData = Array.isArray(debt) ? debt[0] : debt;

  return (
    <div>
      <h1>
        Health Grade: {debtData?.grade || '?'}
      </h1>
      <p>
        Overall Score: {Number(debtData?.overall || 0).toFixed(1)} / 10
      </p>

      <h3 style={{ marginTop: 24 }}>Dimensions</h3>
      {debtData?.dimensions &&
        Object.entries(debtData.dimensions).map(([key, dim]: any) => (
          <div
            key={key}
            style={{
              margin: '8px 0',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                textTransform: 'capitalize',
                width: 140,
                display: 'inline-block',
              }}
            >
              {key}:
            </span>
            <span>{dim.score?.toFixed?.(1) || dim.score}</span>
            <div
              style={{
                flex: 1,
                marginLeft: 12,
                height: 8,
                background: '#313244',
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min((dim.score || 0) * 10, 100)}%`,
                  background:
                    dim.score >= 7
                      ? '#a6e3a1'
                      : dim.score >= 4
                        ? '#f9e2af'
                        : '#f38ba8',
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        ))}

      {suggestions && (
        <>
          <h3 style={{ marginTop: 24 }}>Code Smells</h3>
          <p>
            {(suggestions.smells || []).length} issues found,
            {(suggestions.tasks || []).length} refactor tasks suggested
          </p>
        </>
      )}
    </div>
  );
}