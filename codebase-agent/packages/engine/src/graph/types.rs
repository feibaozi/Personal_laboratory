use petgraph::graph::DiGraph;
use serde::{Deserialize, Serialize};

use crate::duplication::types::DuplicationGroup;
use crate::metrics::types::CodeMetrics;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub kind: NodeKind,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub language: String,
    pub metrics: CodeMetrics,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeKind {
    Module,
    Class,
    Function,
    Variable,
    Interface,
    TypeAlias,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from_id: String,
    pub to_id: String,
    pub kind: EdgeKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeKind {
    Import,
    Call,
    Extends,
    Implements,
    References,
}

pub type CodeGraph = DiGraph<GraphNode, EdgeKind>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplications: Option<Vec<DuplicationGroup>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQueryResult {
    pub node: GraphNode,
    pub upstream: Vec<GraphNode>,
    pub downstream: Vec<GraphNode>,
    pub cycles: Vec<Vec<GraphNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleInfo {
    pub nodes: Vec<String>,
    pub node_names: Vec<String>,
    pub files: Vec<String>,
}

impl DependencyGraph {
    pub fn new() -> Self {
        DependencyGraph {
            nodes: Vec::new(),
            edges: Vec::new(),
            duplications: None,
        }
    }

    pub fn add_node(&mut self, node: GraphNode) {
        if !self.nodes.iter().any(|n| n.id == node.id) {
            self.nodes.push(node);
        }
    }

    pub fn add_edge(&mut self, from_id: String, to_id: String, kind: EdgeKind) {
        if !self.edges.iter().any(|e| e.from_id == from_id && e.to_id == to_id) {
            self.edges.push(GraphEdge { from_id, to_id, kind });
        }
    }

    pub fn find_node(&self, id: &str) -> Option<&GraphNode> {
        self.nodes.iter().find(|n| n.id == id)
    }

    pub fn find_by_name(&self, name: &str) -> Vec<&GraphNode> {
        self.nodes.iter().filter(|n| n.name == name).collect()
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }
}

impl Default for DependencyGraph {
    fn default() -> Self {
        Self::new()
    }
}