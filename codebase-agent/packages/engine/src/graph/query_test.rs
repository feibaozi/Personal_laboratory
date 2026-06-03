#[cfg(test)]
mod graph_tests {
    use crate::graph::types::*;
    use crate::graph::query::*;

    fn build_test_graph() -> DependencyGraph {
        let mut g = DependencyGraph::new();
        g.add_node(GraphNode {
            id: "a".into(),
            name: "A".into(),
            kind: NodeKind::Module,
            file_path: "a.ts".into(),
            start_line: 1,
            end_line: 10,
            language: "typescript".into(),
            metrics: Default::default(),
        });
        g.add_node(GraphNode {
            id: "b".into(),
            name: "B".into(),
            kind: NodeKind::Module,
            file_path: "b.ts".into(),
            start_line: 1,
            end_line: 10,
            language: "typescript".into(),
            metrics: Default::default(),
        });
        g.add_node(GraphNode {
            id: "c".into(),
            name: "C".into(),
            kind: NodeKind::Module,
            file_path: "c.ts".into(),
            start_line: 1,
            end_line: 10,
            language: "typescript".into(),
            metrics: Default::default(),
        });
        g.add_edge("a".into(), "b".into(), EdgeKind::Import);
        g.add_edge("b".into(), "c".into(), EdgeKind::Import);
        g.add_edge("c".into(), "a".into(), EdgeKind::Import);
        g
    }

    #[test]
    fn test_cycle_detection() {
        let graph = build_test_graph();
        let cycles = detect_cycles(&graph);
        assert!(!cycles.is_empty());
        assert_eq!(cycles[0].nodes.len(), 3);
    }

    #[test]
    fn test_shortest_path() {
        let graph = build_test_graph();
        let path = shortest_path(&graph, "a", "c");
        assert!(path.is_some());
        assert_eq!(path.unwrap().len(), 3);
    }

    #[test]
    fn test_upstream_dependencies() {
        let graph = build_test_graph();
        let upstream = find_upstream_dependencies(&graph, "c", 10);
        assert!(upstream.iter().any(|n| n.id == "b"));
    }

    #[test]
    fn test_no_cycles_in_simple_graph() {
        let mut g = DependencyGraph::new();
        g.add_node(GraphNode {
            id: "x".into(),
            name: "X".into(),
            kind: NodeKind::Module,
            file_path: "x.ts".into(),
            start_line: 1,
            end_line: 10,
            language: "typescript".into(),
            metrics: Default::default(),
        });
        g.add_node(GraphNode {
            id: "y".into(),
            name: "Y".into(),
            kind: NodeKind::Module,
            file_path: "y.ts".into(),
            start_line: 1,
            end_line: 10,
            language: "typescript".into(),
            metrics: Default::default(),
        });
        g.add_edge("x".into(), "y".into(), EdgeKind::Import);

        let cycles = detect_cycles(&g);
        assert!(cycles.is_empty());
    }
}