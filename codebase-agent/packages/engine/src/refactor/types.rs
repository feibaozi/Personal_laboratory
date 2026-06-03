use serde::{Deserialize, Serialize};

use crate::graph::types::GraphNode;
use crate::graph::query;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSmell {
    pub id: String,
    pub smell_type: SmellType,
    pub severity: SmellSeverity,
    pub description: String,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub symbol_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SmellType {
    GodClass,
    LongFunction,
    HighCoupling,
    CircularDependency,
    ShotgunSurgery,
    FeatureEnvy,
    Duplication,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SmellSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefactorTask {
    pub id: String,
    pub title: String,
    pub description: String,
    pub strategy: RefactorStrategy,
    pub affected_files: Vec<String>,
    pub estimated_effort: EffortLevel,
    pub priority: usize,
    pub safe_to_automate: bool,
    pub related_smells: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RefactorStrategy {
    ExtractClass,
    ExtractMethod,
    ExtractInterface,
    DependencyInversion,
    RenameSymbol,
    MergeDuplicates,
    ReduceParameters,
    SimplifyConditional,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EffortLevel {
    Low,
    Medium,
    High,
}

pub struct SmellDetector;

impl SmellDetector {
    pub fn detect_smells(nodes: &[GraphNode], graph: &crate::graph::types::DependencyGraph) -> Vec<CodeSmell> {
        let mut smells = Vec::new();
        let mut id_counter = 0;

        let mut file_change_count: std::collections::HashMap<&str, Vec<&str>> = std::collections::HashMap::new();
        for node in nodes {
            file_change_count
                .entry(&node.file_path)
                .or_default()
                .push(&node.name);
        }

        let mut node_outgoing: std::collections::HashMap<&str, Vec<&str>> = std::collections::HashMap::new();
        for edge in &graph.edges {
            node_outgoing
                .entry(&edge.from_id)
                .or_default()
                .push(&edge.to_id);
        }

        for node in nodes {
            if node.metrics.cyclomatic_complexity > 50.0 {
                id_counter += 1;
                smells.push(CodeSmell {
                    id: format!("smell-{}", id_counter),
                    smell_type: SmellType::GodClass,
                    severity: SmellSeverity::Error,
                    description: format!(
                        "{} has cyclomatic complexity {} which exceeds the threshold of 50",
                        node.name, node.metrics.cyclomatic_complexity
                    ),
                    file_path: node.file_path.clone(),
                    start_line: node.start_line,
                    end_line: node.end_line,
                    symbol_name: node.name.clone(),
                });
            }

            if node.metrics.lines_of_code > 100 {
                id_counter += 1;
                smells.push(CodeSmell {
                    id: format!("smell-{}", id_counter),
                    smell_type: SmellType::LongFunction,
                    severity: SmellSeverity::Warning,
                    description: format!(
                        "{} has {} lines which exceeds the 100-line threshold",
                        node.name, node.metrics.lines_of_code
                    ),
                    file_path: node.file_path.clone(),
                    start_line: node.start_line,
                    end_line: node.end_line,
                    symbol_name: node.name.clone(),
                });
            }

            if node.metrics.efferent_coupling > 20 {
                id_counter += 1;
                smells.push(CodeSmell {
                    id: format!("smell-{}", id_counter),
                    smell_type: SmellType::HighCoupling,
                    severity: SmellSeverity::Warning,
                    description: format!(
                        "{} has efferent coupling of {} exceeding the 20 threshold",
                        node.name, node.metrics.efferent_coupling
                    ),
                    file_path: node.file_path.clone(),
                    start_line: node.start_line,
                    end_line: node.end_line,
                    symbol_name: node.name.clone(),
                });
            }

            if let Some(targets) = node_outgoing.get(&node.id.as_str()) {
                let unique_targets: std::collections::HashSet<&str> = targets.iter().copied().collect();
                if unique_targets.len() > 10 && node.kind == crate::graph::types::NodeKind::Function {
                    id_counter += 1;
                    smells.push(CodeSmell {
                        id: format!("smell-{}", id_counter),
                        smell_type: SmellType::ShotgunSurgery,
                        severity: SmellSeverity::Warning,
                        description: format!(
                            "{} calls {} different modules - changes to it will require updates across many files (Shotgun Surgery)",
                            node.name, unique_targets.len()
                        ),
                        file_path: node.file_path.clone(),
                        start_line: node.start_line,
                        end_line: node.end_line,
                        symbol_name: node.name.clone(),
                    });
                }

                let external_count = targets
                    .iter()
                    .filter(|t| {
                        graph.find_node(**t).map_or(false, |n| n.file_path != node.file_path)
                    })
                    .count();
                if external_count > 5 && node.kind == crate::graph::types::NodeKind::Function {
                    id_counter += 1;
                    smells.push(CodeSmell {
                        id: format!("smell-{}", id_counter),
                        smell_type: SmellType::FeatureEnvy,
                        severity: SmellSeverity::Info,
                        description: format!(
                            "{} uses {} external symbols more than its own module data (Feature Envy)",
                            node.name, external_count
                        ),
                        file_path: node.file_path.clone(),
                        start_line: node.start_line,
                        end_line: node.end_line,
                        symbol_name: node.name.clone(),
                    });
                }
            }
        }

        let cycles = query::detect_cycles(graph);
        for cycle in &cycles {
            id_counter += 1;
            smells.push(CodeSmell {
                id: format!("smell-{}", id_counter),
                smell_type: SmellType::CircularDependency,
                severity: SmellSeverity::Error,
                description: format!(
                    "Circular dependency detected: {}",
                    cycle.node_names.join(" -> ")
                ),
                file_path: cycle.files.first().cloned().unwrap_or_default(),
                start_line: 0,
                end_line: 0,
                symbol_name: cycle.node_names.first().cloned().unwrap_or_default(),
            });
        }

        if let Some(dups) = &graph.duplications {
            for dup in dups {
                if dup.files.len() >= 2 {
                    id_counter += 1;
                    smells.push(CodeSmell {
                        id: format!("smell-{}", id_counter),
                        smell_type: SmellType::Duplication,
                        severity: SmellSeverity::Warning,
                        description: format!(
                            "Duplicate code block ({} lines) found in {} files",
                            dup.duplicated_lines,
                            dup.files.len()
                        ),
                        file_path: dup.files.first().map(|f| f.file_path.clone()).unwrap_or_default(),
                        start_line: dup.files.first().map(|f| f.start_line).unwrap_or(0),
                        end_line: dup.files.first().map(|f| f.end_line).unwrap_or(0),
                        symbol_name: format!("dup-{}", dup.id),
                    });
                }
            }
        }

        smells
    }
}

pub struct RefactorPlanner;

impl RefactorPlanner {
    pub fn plan_refactors(smells: &[CodeSmell]) -> Vec<RefactorTask> {
        let mut tasks = Vec::new();
        let mut task_id = 0;

        for smell in smells {
            task_id += 1;
            let (strategy, safe, effort) = match smell.smell_type {
                SmellType::GodClass => (RefactorStrategy::ExtractClass, false, EffortLevel::High),
                SmellType::LongFunction => (RefactorStrategy::ExtractMethod, true, EffortLevel::Low),
                SmellType::HighCoupling => (RefactorStrategy::ExtractInterface, false, EffortLevel::Medium),
                SmellType::CircularDependency => (RefactorStrategy::DependencyInversion, false, EffortLevel::High),
                SmellType::Duplication => (RefactorStrategy::MergeDuplicates, true, EffortLevel::Medium),
                SmellType::ShotgunSurgery => (RefactorStrategy::ExtractClass, false, EffortLevel::High),
                SmellType::FeatureEnvy => (RefactorStrategy::ExtractMethod, true, EffortLevel::Medium),
            };

            let priority = match smell.severity {
                SmellSeverity::Error => 3,
                SmellSeverity::Warning => 2,
                SmellSeverity::Info => 1,
            };

            tasks.push(RefactorTask {
                id: format!("task-{}", task_id),
                title: format!("Refactor {}: {}", smell.symbol_name, smell.description),
                description: smell.description.clone(),
                strategy,
                affected_files: vec![smell.file_path.clone()],
                estimated_effort: effort,
                priority,
                safe_to_automate: safe,
                related_smells: vec![smell.id.clone()],
            });
        }

        tasks.sort_by(|a, b| b.priority.cmp(&a.priority));
        tasks
    }
}