use serde::{Deserialize, Serialize};
use crate::graph::types::*;
use crate::graph::query;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineageResult {
    pub symbol: String,
    pub symbol_id: String,
    pub downstream: Vec<LineageNode>,
    pub upstream: Vec<LineageNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineageNode {
    pub symbol_id: String,
    pub name: String,
    pub kind: SymbolKind,
    pub file_path: String,
    pub start_line: usize,
    pub depth: usize,
    pub relation: RelationKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SymbolKind {
    Module,
    Class,
    Function,
    Variable,
    Interface,
    TypeAlias,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationKind {
    Direct,
    Indirect,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactReport {
    pub symbol: String,
    pub symbol_id: String,
    pub direct_impact: Vec<String>,
    pub indirect_impact: Vec<String>,
    pub affected_files: Vec<String>,
    pub affected_test_files: Vec<String>,
    pub total_impacted_symbols: usize,
}

pub fn trace_full_lineage(
    graph: &DependencyGraph,
    symbol_name: &str,
    max_depth: usize,
) -> Option<LineageResult> {
    let candidates = graph.find_by_name(symbol_name);
    if candidates.is_empty() {
        return None;
    }

    let node_id = &candidates[0].id;

    let downstream = query::find_downstream_dependencies(graph, node_id, max_depth);
    let upstream = query::find_upstream_dependencies(graph, node_id, max_depth);

    Some(LineageResult {
        symbol: symbol_name.to_string(),
        symbol_id: node_id.clone(),
        downstream: downstream
            .into_iter()
            .map(|n| LineageNode {
                symbol_id: n.id,
                name: n.name,
                kind: match n.kind {
                    NodeKind::Function => SymbolKind::Function,
                    NodeKind::Class => SymbolKind::Class,
                    NodeKind::Module => SymbolKind::Module,
                    NodeKind::Variable => SymbolKind::Variable,
                    NodeKind::Interface => SymbolKind::Interface,
                    NodeKind::TypeAlias => SymbolKind::TypeAlias,
                },
                file_path: n.file_path,
                start_line: n.start_line,
                depth: 0,
                relation: RelationKind::Direct,
            })
            .collect(),
        upstream: upstream
            .into_iter()
            .map(|n| LineageNode {
                symbol_id: n.id,
                name: n.name,
                kind: match n.kind {
                    NodeKind::Function => SymbolKind::Function,
                    NodeKind::Class => SymbolKind::Class,
                    NodeKind::Module => SymbolKind::Module,
                    NodeKind::Variable => SymbolKind::Variable,
                    NodeKind::Interface => SymbolKind::Interface,
                    NodeKind::TypeAlias => SymbolKind::TypeAlias,
                },
                file_path: n.file_path,
                start_line: n.start_line,
                depth: 0,
                relation: RelationKind::Direct,
            })
            .collect(),
    })
}

pub fn impact_analysis(
    graph: &DependencyGraph,
    symbol_name: &str,
) -> Option<ImpactReport> {
    let candidates = graph.find_by_name(symbol_name);
    if candidates.is_empty() {
        return None;
    }

    let node_id = &candidates[0].id;
    let all_downstream =
        query::find_downstream_dependencies(graph, node_id, usize::MAX);

    let direct: Vec<_> = all_downstream
        .iter()
        .filter(|n| {
            graph.edges.iter().any(|e| e.from_id == *node_id && e.to_id == n.id)
        })
        .collect();

    let indirect: Vec<_> = all_downstream
        .iter()
        .filter(|n| {
            !graph.edges.iter().any(|e| e.from_id == *node_id && e.to_id == n.id)
        })
        .collect();

    let test_files: Vec<_> = all_downstream
        .iter()
        .filter(|n| n.file_path.contains("test") || n.file_path.contains("spec"))
        .collect();

    Some(ImpactReport {
        symbol: symbol_name.to_string(),
        symbol_id: node_id.clone(),
        direct_impact: direct.iter().map(|n| n.name.clone()).collect(),
        indirect_impact: indirect.iter().map(|n| n.name.clone()).collect(),
        affected_files: all_downstream
            .iter()
            .map(|n| n.file_path.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect(),
        affected_test_files: test_files.iter().map(|n| n.file_path.clone()).collect(),
        total_impacted_symbols: all_downstream.len(),
    })
}
