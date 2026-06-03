use petgraph::algo::tarjan_scc;
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::{HashMap, HashSet, VecDeque};

use super::types::*;

pub fn find_upstream_dependencies(
    graph: &DependencyGraph,
    node_id: &str,
    max_depth: usize,
) -> Vec<GraphNode> {
    let adj = build_adjacency(graph);
    let mut visited = HashSet::new();
    let mut result = Vec::new();
    let mut queue = VecDeque::new();

    visited.insert(node_id.to_string());
    queue.push_back((node_id.to_string(), 0));

    while let Some((current, depth)) = queue.pop_front() {
        if depth >= max_depth {
            continue;
        }

        if let Some(neighbors) = adj.get(&current) {
            for neighbor in neighbors {
                if !visited.contains(neighbor) {
                    visited.insert(neighbor.clone());
                    if let Some(node) = graph.find_node(neighbor) {
                        result.push(node.clone());
                    }
                    queue.push_back((neighbor.clone(), depth + 1));
                }
            }
        }
    }

    result
}

pub fn find_downstream_dependencies(
    graph: &DependencyGraph,
    node_id: &str,
    max_depth: usize,
) -> Vec<GraphNode> {
    let rev_adj = build_reverse_adjacency(graph);
    let mut visited = HashSet::new();
    let mut result = Vec::new();
    let mut queue = VecDeque::new();

    visited.insert(node_id.to_string());
    queue.push_back((node_id.to_string(), 0));

    while let Some((current, depth)) = queue.pop_front() {
        if depth >= max_depth {
            continue;
        }

        if let Some(neighbors) = rev_adj.get(&current) {
            for neighbor in neighbors {
                if !visited.contains(neighbor) {
                    visited.insert(neighbor.clone());
                    if let Some(node) = graph.find_node(neighbor) {
                        result.push(node.clone());
                    }
                    queue.push_back((neighbor.clone(), depth + 1));
                }
            }
        }
    }

    result
}

pub fn detect_cycles(graph: &DependencyGraph) -> Vec<CycleInfo> {
    let mut petgraph = DiGraph::new();
    let mut node_map: HashMap<String, NodeIndex> = HashMap::new();

    for node in &graph.nodes {
        let idx = petgraph.add_node(node.clone());
        node_map.insert(node.id.clone(), idx);
    }

    for edge in &graph.edges {
        if let (Some(from), Some(to)) = (
            node_map.get(&edge.from_id),
            node_map.get(&edge.to_id),
        ) {
            petgraph.add_edge(*from, *to, edge.kind);
        }
    }

    let sccs = tarjan_scc(&petgraph);

    sccs
        .into_iter()
        .filter(|scc| scc.len() > 1)
        .map(|scc| {
            let node_ids: Vec<String> = scc
                .iter()
                .map(|idx| petgraph[*idx].id.clone())
                .collect();
            let node_names: Vec<String> = scc
                .iter()
                .map(|idx| petgraph[*idx].name.clone())
                .collect();
            let files: Vec<String> = scc
                .iter()
                .map(|idx| petgraph[*idx].file_path.clone())
                .collect::<HashSet<_>>()
                .into_iter()
                .collect();

            CycleInfo {
                nodes: node_ids,
                node_names,
                files,
            }
        })
        .collect()
}

pub fn find_orphans(graph: &DependencyGraph) -> Vec<GraphNode> {
    let mut has_upstream: HashSet<&str> = HashSet::new();
    let mut has_downstream: HashSet<&str> = HashSet::new();

    for edge in &graph.edges {
        has_upstream.insert(&edge.to_id);
        has_downstream.insert(&edge.from_id);
    }

    graph
        .nodes
        .iter()
        .filter(|n| {
            n.kind != NodeKind::Module
                && (!has_upstream.contains(n.id.as_str()) || !has_downstream.contains(n.id.as_str()))
        })
        .cloned()
        .collect()
}

pub fn shortest_path(
    graph: &DependencyGraph,
    from_id: &str,
    to_id: &str,
) -> Option<Vec<GraphNode>> {
    let adj = build_adjacency(graph);
    let mut visited = HashSet::new();
    let mut queue = VecDeque::new();
    let mut parent: HashMap<String, String> = HashMap::new();

    visited.insert(from_id.to_string());
    queue.push_back(from_id.to_string());

    while let Some(current) = queue.pop_front() {
        if current == to_id {
            let mut path = Vec::new();
            let mut node = to_id.to_string();
            while let Some(p) = parent.get(&node) {
                if let Some(n) = graph.find_node(&node) {
                    path.push(n.clone());
                }
                node = p.clone();
            }
            if let Some(n) = graph.find_node(from_id) {
                path.push(n.clone());
            }
            path.reverse();
            return Some(path);
        }

        if let Some(neighbors) = adj.get(&current) {
            for neighbor in neighbors {
                if !visited.contains(neighbor) {
                    visited.insert(neighbor.clone());
                    parent.insert(neighbor.clone(), current.clone());
                    queue.push_back(neighbor.clone());
                }
            }
        }
    }

    None
}

fn build_adjacency(graph: &DependencyGraph) -> HashMap<String, Vec<String>> {
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &graph.edges {
        adj.entry(edge.from_id.clone())
            .or_default()
            .push(edge.to_id.clone());
    }
    adj
}

fn build_reverse_adjacency(graph: &DependencyGraph) -> HashMap<String, Vec<String>> {
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &graph.edges {
        adj.entry(edge.to_id.clone())
            .or_default()
            .push(edge.from_id.clone());
    }
    adj
}