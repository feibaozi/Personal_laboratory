pub mod parser;
pub mod graph;
pub mod lineage;
pub mod metrics;
pub mod duplication;
pub mod refactor;

pub use parser::types::*;
pub use graph::types::*;
pub use metrics::types::*;
pub use lineage::types::*;
pub use duplication::types::*;
pub use refactor::types::*;

mod napi_bindings {
    use napi_derive::napi;
    use napi::bindgen_prelude::*;
    use std::path::Path;
    use crate::graph::builder::GraphBuilder;
    use crate::graph::types::DependencyGraph;
    use crate::graph::query;
    use crate::metrics::scorer;
    use crate::metrics::types::*;
    use crate::refactor::types::*;

    #[napi(object)]
    pub struct AnalyzeOptions {
        pub project_path: String,
        pub languages: Option<Vec<String>>,
        pub incremental: Option<bool>,
    }

    #[napi(object)]
    pub struct AnalyzeOutput {
        pub project_id: String,
        pub graph_json: String,
        pub duplications_json: Option<String>,
        pub node_count: u32,
        pub edge_count: u32,
    }

    #[napi]
    pub fn analyze_project(options: AnalyzeOptions) -> Result<AnalyzeOutput> {
        let mut builder = GraphBuilder::new();
        let graph = builder.build_from_directory(Path::new(&options.project_path));
        let graph_json = serde_json::to_string(graph).map_err(|e| {
            napi::Error::from_reason(format!("Serialization error: {}", e))
        })?;

        let duplications_json = graph.duplications.as_ref().map(|d| {
            serde_json::to_string(d).unwrap_or_default()
        });

        let node_count = graph.node_count() as u32;
        let edge_count = graph.edge_count() as u32;
        let project_id = uuid::Uuid::new_v4().to_string();

        Ok(AnalyzeOutput {
            project_id,
            graph_json,
            duplications_json,
            node_count,
            edge_count,
        })
    }

    #[napi(object)]
    pub struct LineageInput {
        pub graph_json: String,
        pub symbol_name: String,
        pub max_depth: Option<u32>,
    }

    #[napi]
    pub fn trace_lineage(input: LineageInput) -> Result<String> {
        let graph: DependencyGraph = serde_json::from_str(&input.graph_json)
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))?;

        let result = crate::lineage::types::trace_full_lineage(
            &graph,
            &input.symbol_name,
            input.max_depth.unwrap_or(5) as usize,
        );

        serde_json::to_string(&result)
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))
    }

    #[napi]
    pub fn detect_cycles(graph_json: String) -> Result<String> {
        let graph: DependencyGraph = serde_json::from_str(&graph_json)
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))?;
        let cycles = query::detect_cycles(&graph);
        serde_json::to_string(&cycles)
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))
    }

    #[napi]
    pub fn compute_debt_metrics(
        graph_json: String,
        test_coverage: Option<f64>,
        duplication_rate: Option<f64>,
    ) -> Result<String> {
        let graph: DependencyGraph = serde_json::from_str(&graph_json)
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))?;

        let mut all_scores = Vec::new();
        let weights = ScoreWeights::default();
        let thresholds = ComplexityThresholds::default();

        for node in &graph.nodes {
            let score = scorer::compute_debt_score(
                &node.metrics,
                test_coverage,
                duplication_rate,
                &weights,
                &thresholds,
            );
            all_scores.push(score);
        }

        serde_json::to_string(&all_scores)
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))
    }

    #[napi]
    pub fn detect_smells(graph_json: String) -> Result<String> {
        let graph: DependencyGraph = serde_json::from_str(&graph_json)
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))?;

        let smells = SmellDetector::detect_smells(&graph.nodes, &graph);
        let tasks = RefactorPlanner::plan_refactors(&smells);

        serde_json::to_string(&(smells, tasks))
            .map_err(|e| napi::Error::from_reason(format!("{}", e)))
    }
}

pub use napi_bindings::*;