use serde_json;

use super::types::DependencyGraph;

pub fn serialize_to_json(graph: &DependencyGraph) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(graph)
}

pub fn deserialize_from_json(json: &str) -> Result<DependencyGraph, serde_json::Error> {
    serde_json::from_str(json)
}

pub fn save_to_file(graph: &DependencyGraph, path: &str) -> std::io::Result<()> {
    let json = serialize_to_json(graph).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    std::fs::write(path, json)
}

pub fn load_from_file(path: &str) -> std::io::Result<DependencyGraph> {
    let json = std::fs::read_to_string(path)?;
    deserialize_from_json(&json).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
}

pub fn merge_graphs(graphs: Vec<DependencyGraph>) -> DependencyGraph {
    let mut merged = DependencyGraph::new();
    for graph in graphs {
        for node in graph.nodes {
            merged.add_node(node);
        }
        for edge in graph.edges {
            merged.add_edge(edge.from_id, edge.to_id, edge.kind);
        }
    }
    merged
}