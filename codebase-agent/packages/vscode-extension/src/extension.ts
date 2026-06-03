import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';

let orchestratorProcess: ChildProcess | null = null;
const BASE_URL = 'http://127.0.0.1:3456';

export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('Codebase Agent activated');

  context.subscriptions.push(
    vscode.commands.registerCommand('codebase-agent.analyze', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const projectPath = workspaceFolder.uri.fsPath;
      vscode.window.showInformationMessage(`Analyzing ${projectPath}...`);

      try {
        const res = await fetch(`${BASE_URL}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath }),
        });
        const { projectId } = (await res.json()) as { projectId: string };
        await context.workspaceState.update(
          'codebase-agent.projectId',
          projectId
        );
        vscode.window.showInformationMessage(
          `Analysis complete! Project ID: ${projectId}`
        );
        vscode.commands.executeCommand('codebase-agent.debtView.refresh');
        vscode.commands.executeCommand('codebase-agent.smellView.refresh');
        vscode.commands.executeCommand('codebase-agent.dependencyView.refresh');
      } catch (err: any) {
        vscode.window.showErrorMessage(`Analysis failed: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand(
      'codebase-agent.showDebtDashboard',
      async () => {
        const panel = vscode.window.createWebviewPanel(
          'codebaseAgentDashboard',
          'Codebase Agent Dashboard',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        const projectId = context.workspaceState.get<string>(
          'codebase-agent.projectId'
        );

        if (!projectId) {
          panel.webview.html = '<p>No analysis yet. Run "Codebase Agent: Analyze" first.</p>';
          return;
        }

        try {
          const debtRes = await fetch(
            `${BASE_URL}/api/projects/${projectId}/debt`
          );
          const debt = await debtRes.json();

          panel.webview.html = `<!DOCTYPE html>
<html><body style="font-family:system-ui;padding:20px;background:#181825;color:#cdd6f4">
<h1>Health Grade: ${(debt as any).grade || (debt as any)[0]?.grade || '?'}</h1>
<p>Overall: ${Number((debt as any).overall || (debt as any)[0]?.overall || 0).toFixed(1)} / 10</p>
<pre>${JSON.stringify(debt, null, 2)}</pre>
</body></html>`;
        } catch {
          panel.webview.html = '<p>Failed to load debt data</p>';
        }
      }
    ),

    vscode.commands.registerCommand(
      'codebase-agent.showRefactorSuggestions',
      () => {
        vscode.commands.executeCommand('codebase-agent.smellView.focus');
      }
    ),

    vscode.commands.registerCommand(
      'codebase-agent.showDependencyGraph',
      async () => {
        const projectId = context.workspaceState.get<string>(
          'codebase-agent.projectId'
        );
        if (!projectId) {
          vscode.window.showErrorMessage('No analysis yet. Run "Codebase Agent: Analyze" first.');
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          'codebaseAgentGraph',
          'Dependency Graph',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        try {
          const res = await fetch(`${BASE_URL}/api/projects/${projectId}/graph`);
          const graphData = await res.json();

          const COLORS: Record<string, string> = {
            Module: '#89b4fa', Function: '#a6e3a1', Class: '#fab387',
            Variable: '#f9e2af', Interface: '#cba6f7', TypeAlias: '#89dceb',
          };
          const EDGE_COLORS: Record<string, string> = {
            Import: '#89b4fa', Call: '#a6e3a1', References: '#585b70',
            Extends: '#fab387', Implements: '#cba6f7',
          };

          panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1e1e2e; font-family: system-ui; }
    #cy { width: 100vw; height: 100vh; }
    #detail {
      position: fixed; top: 12px; right: 12px; width: 240px;
      background: #313244; border-radius: 8px; padding: 12px;
      color: #cdd6f4; font-size: 12px; display: none;
    }
    #detail h3 { margin: 0 0 6px; }
  </style>
</head>
<body>
  <div id="cy"></div>
  <div id="detail"></div>
  <script>
    const data = ${JSON.stringify(graphData)};
    const COLORS = ${JSON.stringify(COLORS)};
    const EDGE_COLORS = ${JSON.stringify(EDGE_COLORS)};

    const nodes = (data.nodes || []).map(n => ({ data: n }));
    const edges = (data.edges || []).map(e => ({
      data: { id: e.from_id + '-' + e.to_id + '-' + e.kind, source: e.from_id, target: e.to_id, kind: e.kind }
    }));

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: [...nodes, ...edges],
      style: [
        { selector: 'node', style: {
          'background-color': el => COLORS[el.data('kind')] || '#89b4fa',
          label: 'data(name)', color: '#cdd6f4', 'font-size': '10px',
          'text-valign': 'bottom', 'text-halign': 'center',
          width: 28, height: 28,
        }},
        { selector: 'edge', style: {
          'line-color': el => EDGE_COLORS[el.data('kind')] || '#585b70',
          'target-arrow-color': el => EDGE_COLORS[el.data('kind')] || '#585b70',
          'target-arrow-shape': 'triangle', width: 1.5, 'arrow-scale': 0.8,
        }},
      ],
      layout: { name: 'cose', animate: true, numIter: 1000 },
    });

    cy.on('tap', 'node', evt => {
      const n = evt.target;
      const d = document.getElementById('detail');
      d.style.display = 'block';
      d.innerHTML = '<h3 style="color:' + (COLORS[n.data('kind')] || '#89b4fa') + '">' + n.data('name') + '</h3>' +
        '<p>Kind: ' + n.data('kind') + '</p>' +
        '<p>File: ' + n.data('file_path') + '</p>' +
        '<p>Lines: ' + n.data('start_line') + '-' + n.data('end_line') + '</p>' +
        (n.data('metrics') ? '<p>Complexity: ' + (n.data('metrics').cyclomatic_complexity || 0).toFixed(1) + '</p>' +
        '<p>LOC: ' + (n.data('metrics').lines_of_code || 0) + '</p>' +
        '<p>Ca: ' + (n.data('metrics').afferent_coupling || 0) + ' Ce: ' + (n.data('metrics').efferent_coupling || 0) + '</p>' : '');
    });
    cy.on('tap', evt => { if (evt.target === cy) document.getElementById('detail').style.display = 'none'; });
  </script>
</body></html>`;
        } catch (err: any) {
          panel.webview.html = '<p>Failed to load graph data: ' + err.message + '</p>';
        }
      }
    ),

    vscode.commands.registerCommand(
      'codebase-agent.traceLineage',
      async () => {
        const projectId = context.workspaceState.get<string>(
          'codebase-agent.projectId'
        );
        if (!projectId) {
          vscode.window.showErrorMessage('No analysis yet. Run "Codebase Agent: Analyze" first.');
          return;
        }

        try {
          const graphRes = await fetch(`${BASE_URL}/api/projects/${projectId}/graph`);
          const graphData = await graphRes.json();
          const symbols = (graphData.nodes || []).map((n: any) => n.name);

          const symbol = await vscode.window.showQuickPick(symbols, {
            placeHolder: 'Select a symbol to trace lineage',
          });
          if (!symbol) return;

          const res = await fetch(`${BASE_URL}/api/projects/${projectId}/lineage/${encodeURIComponent(symbol)}`);
          const data = await res.json();

          const panel = vscode.window.createWebviewPanel(
            'codebaseAgentLineage',
            `Lineage: ${symbol}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
          );

          panel.webview.html = `<!DOCTYPE html>
<html><body style="font-family:system-ui;padding:20px;background:#181825;color:#cdd6f4">
<h1 style="color:#89b4fa">Lineage: ${symbol}</h1>
<h2>Upstream Dependencies (${(data.upstream || []).length})</h2>
<ul>${(data.upstream || []).map((u: any) => '<li>' + u.name + ' (' + u.kind + ')</li>').join('')}</ul>
<h2>Downstream Dependents (${(data.downstream || []).length})</h2>
<ul>${(data.downstream || []).map((d: any) => '<li>' + d.name + ' (' + d.kind + ')</li>').join('')}</ul>
<pre style="background:#1e1e2e;padding:12px;border-radius:6px">${JSON.stringify(data, null, 2)}</pre>
</body></html>`;
        } catch (err: any) {
          vscode.window.showErrorMessage('Lineage trace failed: ' + err.message);
        }
      }
    ),

    vscode.commands.registerCommand(
      'codebase-agent.generateDocs',
      async () => {
        const projectId = context.workspaceState.get<string>(
          'codebase-agent.projectId'
        );
        if (!projectId) {
          vscode.window.showErrorMessage('No analysis yet. Run "Codebase Agent: Analyze" first.');
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          'codebaseAgentDocs',
          'Architecture Documentation',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = `<!DOCTYPE html>
<html><body style="font-family:system-ui;padding:20px;background:#181825;color:#cdd6f4">
<h1>Generating Architecture Documentation...</h1>
<div id="content" style="line-height:1.7;max-width:900px;margin-top:16px"></div>
<script>
(async () => {
  const res = await fetch('${BASE_URL}/api/projects/${projectId}/docs/stream');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const el = document.getElementById('content');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.done) { el.innerHTML += '<p style="color:#a6e3a1">\u2714 Documentation complete.</p>'; return; }
          if (parsed.error) { el.innerHTML += '<p style="color:#f38ba8">Error: ' + parsed.error + '</p>'; return; }
          if (parsed.chunk) el.innerHTML += parsed.chunk;
        } catch {}
      }
    }
  }
})();
</script>
</body></html>`;
      }
    )
  );

  const debtProvider = new DebtTreeProvider(context);
  const smellProvider = new SmellTreeProvider(context);
  const depProvider = new DependencyTreeProvider(context);

  vscode.window.registerTreeDataProvider(
    'codebase-agent.debtView',
    debtProvider
  );
  vscode.window.registerTreeDataProvider(
    'codebase-agent.smellView',
    smellProvider
  );
  vscode.window.registerTreeDataProvider(
    'codebase-agent.dependencyView',
    depProvider
  );
}

class DebtTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh() {
    this._onDidChange.fire();
  }

  async getChildren(
    element?: vscode.TreeItem
  ): Promise<vscode.TreeItem[]> {
    if (element) return [];

    const projectId = this.context.workspaceState.get<string>(
      'codebase-agent.projectId'
    );
    if (!projectId) {
      return [
        new vscode.TreeItem(
          'No analysis yet. Run "Codebase Agent: Analyze"'
        ),
      ];
    }

    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/debt`);
      const debt = await res.json();
      const data = Array.isArray(debt) ? debt[0] : debt;
      const grade = data?.grade || '?';
      const overall = data?.overall || 0;

      return [
        new vscode.TreeItem(
          `Health: ${grade} (${Number(overall).toFixed(1)}/10)`,
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    } catch {
      return [new vscode.TreeItem('Failed to load debt data')];
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
}

class SmellTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh() {
    this._onDidChange.fire();
  }

  async getChildren(
    element?: vscode.TreeItem
  ): Promise<vscode.TreeItem[]> {
    if (element) return [];

    const projectId = this.context.workspaceState.get<string>(
      'codebase-agent.projectId'
    );
    if (!projectId) return [new vscode.TreeItem('No analysis yet')];

    try {
      const res = await fetch(
        `${BASE_URL}/api/projects/${projectId}/refactor-suggestions`
      );
      const data = await res.json();
      const smells = data?.smells || [];

      if (smells.length === 0) {
        return [new vscode.TreeItem('No code smells detected!')];
      }

      return smells.map(
        (s: any) =>
          new vscode.TreeItem(
            `[${s.severity}] ${s.symbolName || s.symbol_name}: ${s.description}`,
            vscode.TreeItemCollapsibleState.None
          )
      );
    } catch {
      return [new vscode.TreeItem('Failed to load smells')];
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
}

class DepNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly nodeId: string,
    public readonly kind: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children?: DepNode[]
  ) {
    super(label, collapsibleState);
    const icons: Record<string, string> = {
      Module: 'package', Function: 'symbol-method', Class: 'symbol-class',
      Variable: 'symbol-variable', Interface: 'symbol-interface', TypeAlias: 'symbol-type-parameter',
    };
    this.iconPath = new vscode.ThemeIcon(icons[kind] || 'symbol-misc');
    this.description = kind;
  }
}

class DependencyTreeProvider implements vscode.TreeDataProvider<DepNode> {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private graphData: any = null;

  constructor(private context: vscode.ExtensionContext) {}

  refresh() {
    this.graphData = null;
    this._onDidChange.fire();
  }

  async ensureData() {
    if (this.graphData) return;
    const projectId = this.context.workspaceState.get<string>('codebase-agent.projectId');
    if (!projectId) return;
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/graph`);
      this.graphData = await res.json();
    } catch {
      this.graphData = null;
    }
  }

  async getChildren(element?: DepNode): Promise<DepNode[]> {
    await this.ensureData();
    if (!this.graphData) return [new DepNode('No analysis yet', '', '', vscode.TreeItemCollapsibleState.None)];

    const nodes: any[] = this.graphData.nodes || [];
    const edges: any[] = this.graphData.edges || [];

    if (!element) {
      const modules = nodes.filter((n: any) => n.kind === 'Module');
      if (modules.length === 0) return [new DepNode('No modules found', '', '', vscode.TreeItemCollapsibleState.None)];
      return modules.map((m: any) => {
        const childEdges = edges.filter((e: any) => e.from_id === m.id);
        const hasChildren = childEdges.length > 0;
        return new DepNode(m.name, m.id, m.kind, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
      });
    }

    const outEdges = edges.filter((e: any) => e.from_id === element.nodeId);
    const result: DepNode[] = [];
    for (const edge of outEdges) {
      const target = nodes.find((n: any) => n.id === edge.to_id);
      if (!target) continue;
      const targetEdges = edges.filter((e: any) => e.from_id === target.id);
      const hasChildren = targetEdges.length > 0;
      const node = new DepNode(
        `${target.name} (${edge.kind})`,
        target.id,
        target.kind,
        hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
      );
      result.push(node);
    }
    return result;
  }

  getTreeItem(element: DepNode): vscode.TreeItem {
    return element;
  }
}

export function deactivate() {
  if (orchestratorProcess) {
    orchestratorProcess.kill();
    orchestratorProcess = null;
  }
}