import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface DocsPageProps {
  projectId: string | null;
}

export default function DocsPage({ projectId }: DocsPageProps) {
  const [content, setContent] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch(`http://127.0.0.1:3456/api/projects/${projectId}/docs`)
      .then((r) => r.json())
      .then((data) => {
        if (data.content) setContent(data.content);
      })
      .catch(() => {});
  }, [projectId]);

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    setContent('');

    try {
      const response = await fetch(
        `http://127.0.0.1:3456/api/projects/${projectId}/docs/stream`
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Stream failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.done) break;
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.chunk) {
                setContent((prev) => (prev || '') + parsed.chunk);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!projectId) return <p>Run an analysis first.</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Architecture Documentation</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '8px 16px',
            background: generating ? '#45475a' : '#89b4fa',
            border: 'none',
            borderRadius: 4,
            color: '#1e1e2e',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {generating ? 'Generating...' : content ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: '#f38ba820',
            border: '1px solid #f38ba8',
            borderRadius: 4,
            padding: 12,
            marginBottom: 16,
            color: '#f38ba8',
          }}
        >
          {error}
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>
            Make sure an LLM provider is configured (set LLM_PROVIDER env var, defaults to ollama).
          </p>
        </div>
      )}

      {content ? (
        <div
          style={{
            background: '#1e1e2e',
            borderRadius: 8,
            padding: 24,
            lineHeight: 1.7,
            fontSize: 14,
            maxWidth: 900,
            color: '#cdd6f4',
          }}
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 style={{ color: '#f5c2e7', margin: '24px 0 12px', borderBottom: '1px solid #313244', paddingBottom: 8 }}>{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 style={{ color: '#cba6f7', margin: '20px 0 10px', borderBottom: '1px solid #313244', paddingBottom: 6 }}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ color: '#89b4fa', margin: '16px 0 8px' }}>{children}</h3>
              ),
              strong: ({ children }) => (
                <strong style={{ color: '#f9e2af' }}>{children}</strong>
              ),
              em: ({ children }) => (
                <em style={{ color: '#a6adc8' }}>{children}</em>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.startsWith('language-');
                if (isBlock) {
                  return (
                    <code style={{ display: 'block', background: '#181825', padding: 16, borderRadius: 6, fontSize: 13, overflow: 'auto', border: '1px solid #313244' }}>
                      {children}
                    </code>
                  );
                }
                return <code style={{ background: '#313244', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}>{children}</code>;
              },
              pre: ({ children }) => <div style={{ margin: '12px 0' }}>{children}</div>,
              ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
              p: ({ children }) => <p style={{ margin: '8px 0' }}>{children}</p>,
              blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: '3px solid #89b4fa', paddingLeft: 12, margin: '12px 0', color: '#a6adc8' }}>{children}</blockquote>
              ),
              a: ({ children, href }) => (
                <a href={href} style={{ color: '#89b4fa', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{children}</a>
              ),
              table: ({ children }) => (
                <table style={{ borderCollapse: 'collapse', width: '100%', margin: '12px 0' }}>{children}</table>
              ),
              th: ({ children }) => (
                <th style={{ border: '1px solid #45475a', padding: '8px 12px', background: '#313244', color: '#cba6f7' }}>{children}</th>
              ),
              td: ({ children }) => (
                <td style={{ border: '1px solid #45475a', padding: '8px 12px' }}>{children}</td>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : generating ? (
        <div style={{ color: '#a6adc8', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="generating-dot" style={{ animation: 'pulse 1.5s infinite' }}>●</span>
          Connecting to LLM...
          <style>{`@keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }`}</style>
        </div>
      ) : (
        <p style={{ color: '#a6adc8' }}>
          Click "Generate" to create architecture documentation using LLM.
          Requires an LLM provider (defaults to Ollama on localhost:11434).
        </p>
      )}
    </div>
  );
}