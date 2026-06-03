import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

const NODE_COLORS: Record<string, string> = {
  Module: '#89b4fa',
  Function: '#a6e3a1',
  Class: '#fab387',
  Variable: '#f9e2af',
  Interface: '#cba6f7',
  TypeAlias: '#89dceb',
};

const EDGE_STYLES: Record<string, { style: string; color: string }> = {
  Import: { style: 'dashed', color: '#89b4fa' },
  Call: { style: 'solid', color: '#a6e3a1' },
  References: { style: 'solid', color: '#585b70' },
  Extends: { style: 'solid', color: '#fab387' },
  Implements: { style: 'dotted', color: '#cba6f7' },
};

interface GraphPageProps {
  projectId: string | null;
}

export default function GraphPage({ projectId }: GraphPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [containerReady, setContainerReady] = useState(false);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch(`http://127.0.0.1:3456/api/projects/${projectId}/graph`)
      .then((r) => r.json())
      .then((data) => setGraphData(data))
      .catch(console.error);
  }, [projectId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      setContainerReady(true);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerReady(true);
          observer.disconnect();
          break;
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!graphData || !containerRef.current || !containerReady) return;
    if (cyRef.current) cyRef.current.destroy();

    const nodes = (graphData.nodes || []).map((n: any) => ({
      data: {
        id: n.id,
        label: n.name,
        kind: n.kind,
        filePath: n.file_path,
        startLine: n.start_line,
        endLine: n.end_line,
        language: n.language,
        metrics: n.metrics,
      },
    }));

    const edges = (graphData.edges || []).map((e: any) => ({
      data: {
        id: `${e.from_id}-${e.to_id}-${e.kind}`,
        source: e.from_id,
        target: e.to_id,
        kind: e.kind,
      },
    }));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (el: any) =>
              NODE_COLORS[el.data('kind')] || '#89b4fa',
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            color: '#cdd6f4',
            'font-size': '10px',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            width: 30,
            height: 30,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': (el: any) =>
              EDGE_STYLES[el.data('kind')]?.color || '#585b70',
            'line-style': (el: any) =>
              EDGE_STYLES[el.data('kind')]?.style || 'solid',
            'target-arrow-color': (el: any) =>
              EDGE_STYLES[el.data('kind')]?.color || '#585b70',
            'target-arrow-shape': 'triangle',
            width: 1.5,
            'arrow-scale': 0.8,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        nodeDimensionsIncludeLabels: true,
        numIter: 1000,
      } as any,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode({
        id: node.data('id'),
        name: node.data('label'),
        kind: node.data('kind'),
        filePath: node.data('filePath'),
        startLine: node.data('startLine'),
        endLine: node.data('endLine'),
        language: node.data('language'),
        metrics: node.data('metrics'),
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData, containerReady]);

  if (!projectId) return <p>Run an analysis first.</p>;
  if (!graphData) return <p>Loading graph data...</p>;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 500,
          background: '#1e1e2e',
          borderRadius: 8,
        }}
      />
      {selectedNode && (
        <div
          style={{
            width: 260,
            background: '#313244',
            borderRadius: 8,
            padding: 16,
            fontSize: 13,
          }}
        >
          <h3 style={{ margin: '0 0 8px', color: NODE_COLORS[selectedNode.kind] || '#89b4fa' }}>
            {selectedNode.name}
          </h3>
          <p style={{ margin: '4px 0', color: '#a6adc8' }}>
            Kind: {selectedNode.kind}
          </p>
          <p style={{ margin: '4px 0', color: '#a6adc8' }}>
            File: {selectedNode.filePath}
          </p>
          <p style={{ margin: '4px 0', color: '#a6adc8' }}>
            Lines: {selectedNode.startLine}-{selectedNode.endLine}
          </p>
          {selectedNode.metrics && (
            <>
              <hr style={{ borderColor: '#45475a', margin: '12px 0' }} />
              <p style={{ margin: '4px 0', color: '#a6adc8' }}>
                Complexity: {selectedNode.metrics.cyclomatic_complexity?.toFixed(1) || '0'}
              </p>
              <p style={{ margin: '4px 0', color: '#a6adc8' }}>
                LOC: {selectedNode.metrics.lines_of_code || 0}
              </p>
              <p style={{ margin: '4px 0', color: '#a6adc8' }}>
                Coupling: Ca={selectedNode.metrics.afferent_coupling || 0}, Ce={selectedNode.metrics.efferent_coupling || 0}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}