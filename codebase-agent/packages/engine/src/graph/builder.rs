use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use walkdir::WalkDir;

use super::types::*;
use crate::parser::registry::ParserRegistry;
use crate::parser::types::{ParseResult, SourceRange, UnifiedNode};
use crate::metrics::calculator;
use crate::duplication::types::{DuplicateDetector, DuplicationGroup, TokenBasedDetector};

pub struct GraphBuilder {
    registry: ParserRegistry,
    graph: DependencyGraph,
    file_to_nodes: HashMap<String, Vec<String>>,
    symbol_index: HashMap<String, String>,
    imported_symbols: HashMap<String, HashMap<String, String>>,
    ref_counts: HashMap<String, (usize, usize)>,
}

impl GraphBuilder {
    pub fn new() -> Self {
        GraphBuilder {
            registry: ParserRegistry::new(),
            graph: DependencyGraph::new(),
            file_to_nodes: HashMap::new(),
            symbol_index: HashMap::new(),
            imported_symbols: HashMap::new(),
            ref_counts: HashMap::new(),
        }
    }

    pub fn with_registry(registry: ParserRegistry) -> Self {
        GraphBuilder {
            registry,
            graph: DependencyGraph::new(),
            file_to_nodes: HashMap::new(),
            symbol_index: HashMap::new(),
            imported_symbols: HashMap::new(),
            ref_counts: HashMap::new(),
        }
    }

    pub fn build_from_directory(&mut self, root_path: &Path) -> &DependencyGraph {
        let parse_results = self.parse_directory(root_path);

        for result in &parse_results {
            self.add_file_to_graph(result);
        }

        self.resolve_references();
        self.count_references(&parse_results);
        self.compute_metrics(&parse_results);
        self.detect_duplications(&parse_results);
        &self.graph
    }

    fn parse_directory(&self, root_path: &Path) -> Vec<ParseResult> {
        let supported_exts: HashSet<String> = self
            .registry
            .supported_languages()
            .into_iter()
            .flat_map(|l| {
                let exts: Vec<String> = l.extensions().iter().map(|e| e.to_string()).collect();
                exts
            })
            .collect();

        let files: Vec<PathBuf> = WalkDir::new(root_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                if let Some(ext) = e.path().extension() {
                    supported_exts.contains(ext.to_str().unwrap_or(""))
                } else {
                    false
                }
            })
            .map(|e| e.path().to_path_buf())
            .collect();

        files
            .iter()
            .filter_map(|path| {
                std::fs::read_to_string(path)
                    .ok()
                    .and_then(|source| self.registry.parse_file(path, &source))
            })
            .collect()
    }

    fn add_file_to_graph(&mut self, result: &ParseResult) {
        let mut node_ids: Vec<String> = Vec::new();
        let normalized_path = result.file_path.replace('\\', "/");

        let file_node_id = format!("module:{}", &normalized_path);
        self.graph.add_node(GraphNode {
            id: file_node_id.clone(),
            name: result.file_path.clone(),
            kind: NodeKind::Module,
            file_path: result.file_path.clone(),
            start_line: 1,
            end_line: result.raw_source.lines().count(),
            language: format!("{:?}", result.language),
            metrics: Default::default(),
        });
        node_ids.push(file_node_id.clone());

        for def in &result.symbol_table.definitions {
            let node_id = format!("{}:{}", normalized_path, &def.name);
            let kind = match def.kind {
                crate::parser::types::DefinitionKind::Function => NodeKind::Function,
                crate::parser::types::DefinitionKind::Class => NodeKind::Class,
                crate::parser::types::DefinitionKind::Variable => NodeKind::Variable,
                crate::parser::types::DefinitionKind::Interface => NodeKind::Interface,
                crate::parser::types::DefinitionKind::TypeAlias => NodeKind::TypeAlias,
                crate::parser::types::DefinitionKind::Module => NodeKind::Module,
                crate::parser::types::DefinitionKind::Method { .. } => NodeKind::Function,
            };

            self.graph.add_node(GraphNode {
                id: node_id.clone(),
                name: def.name.clone(),
                kind,
                file_path: result.file_path.clone(),
                start_line: def.range.start_line,
                end_line: def.range.end_line,
                language: format!("{:?}", result.language),
                metrics: Default::default(),
            });

            self.graph.add_edge(
                file_node_id.clone(),
                node_id.clone(),
                EdgeKind::References,
            );

            self.symbol_index
                .insert(def.name.clone(), node_id.clone());
            self.ref_counts.insert(node_id.clone(), (0, 0));
            node_ids.push(node_id);
        }

        for import in &result.symbol_table.imports {
            let import_path = self.resolve_import_path(&import.module_path, &result.file_path);
            if let Some(resolved) = import_path {
                for sym in &import.imported_symbols {
                    self.imported_symbols
                        .entry(result.file_path.clone())
                        .or_default()
                        .insert(sym.clone(), resolved.clone());
                }
                let resolved_id = format!("module:{}", resolved);
                self.graph.add_edge(
                    file_node_id.clone(),
                    resolved_id,
                    EdgeKind::Import,
                );
            }
        }

        self.file_to_nodes
            .insert(result.file_path.clone(), node_ids);
    }

    fn resolve_import_path(&self, module_path: &str, current_file: &str) -> Option<String> {
        let current = Path::new(current_file);
        let parent = current.parent()?;

        let cleaned = module_path
            .trim_start_matches("./")
            .trim_start_matches(".\\");

        let candidates = vec![
            parent.join(format!("{}.py", cleaned.replace('.', "/"))),
            parent.join(format!("{}/__init__.py", cleaned.replace('.', "/"))),
            parent.join(format!("{}.ts", cleaned)),
            parent.join(format!("{}/index.ts", cleaned)),
            parent.join(format!("{}.go", cleaned.replace('/', std::path::MAIN_SEPARATOR.to_string().as_str()))),
        ];

        for candidate in candidates {
            if candidate.exists() {
                return Some(candidate.to_string_lossy().to_string().replace('\\', "/"));
            }
        }

        None
    }

    fn resolve_references(&mut self) {
        let edge_list: Vec<(String, String, EdgeKind)> = self
            .graph
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKind::References || e.kind == EdgeKind::Import)
            .map(|e| (e.from_id.clone(), e.to_id.clone(), e.kind))
            .collect();

        for (from_id, to_id, _) in edge_list {
            if self.graph.find_node(&to_id).is_none() {
                let sym_name = to_id.split(':').last().unwrap_or("");
                if let Some(resolved) = self.symbol_index.get(sym_name) {
                    if *resolved != to_id {
                        self.graph.add_edge(from_id.clone(), resolved.clone(), EdgeKind::Call);
                    }
                }
            }
        }

        let mut cross_file_edges: Vec<(String, String, EdgeKind)> = Vec::new();
        for node in &self.graph.nodes {
            if node.kind == NodeKind::Module {
                continue;
            }
            let file_path = &node.file_path;
            if let Some(node_imports) = self.imported_symbols.get(file_path) {
                for (sym_name, target_file) in node_imports {
                    let target_node_id = format!("{}:{}", target_file, sym_name);
                    if self.graph.find_node(&target_node_id).is_some() {
                        cross_file_edges.push((
                            node.id.clone(),
                            target_node_id,
                            EdgeKind::Call,
                        ));
                    }
                }
            }
        }

        for (from_id, to_id, kind) in cross_file_edges {
            if !self.graph.edges.iter().any(|e| e.from_id == from_id && e.to_id == to_id) {
                self.graph.add_edge(from_id, to_id, kind);
            }
        }
    }

    fn count_references(&mut self, parse_results: &[ParseResult]) {
        for result in parse_results {
            let normalized_path = result.file_path.replace('\\', "/");
            for def in &result.symbol_table.definitions {
                let node_id = format!("{}:{}", normalized_path, &def.name);
                if let Some(counts) = self.ref_counts.get_mut(&node_id) {
                    counts.1 = result.symbol_table.references.len();
                }
            }
        }
    }

    fn compute_metrics(&mut self, parse_results: &[ParseResult]) {
        for result in parse_results {
            let normalized_path = result.file_path.replace('\\', "/");
            for def in &result.symbol_table.definitions {
                let node_id = format!("{}:{}", normalized_path, &def.name);

                let (afferent, efferent) = self.ref_counts.get(&node_id)
                    .copied()
                    .unwrap_or((0, 0));

                let metrics = if let Some(ast_node) = find_node_by_range(&result.unified_ast, &def.range) {
                    calculator::compute_all_metrics(ast_node, &result.raw_source, afferent, efferent)
                } else {
                    calculator::compute_all_metrics_from_source(
                        &result.raw_source,
                        def.range.start_line,
                        def.range.end_line,
                        afferent,
                        efferent,
                    )
                };

                if let Some(graph_node) = self.graph.nodes.iter_mut().find(|n| n.id == node_id) {
                    graph_node.metrics = metrics;
                }
            }
        }
    }

    fn detect_duplications(&mut self, parse_results: &[ParseResult]) {
        let token_detector = TokenBasedDetector::new(6);
        let token_streams: Vec<(&str, Vec<String>)> = parse_results
            .iter()
            .map(|r| {
                let tokens: Vec<String> = r.raw_source
                    .split_whitespace()
                    .map(|s| s.to_string())
                    .collect();
                (r.file_path.as_str(), tokens)
            })
            .collect();

        let mut dups = token_detector.find_duplicates(token_streams);

        let ast_detector = DuplicateDetector::new(6);
        let mut ast_dups: Vec<DuplicationGroup> = Vec::new();
        let mut id_offset = dups.len() as u32;

        fn collect_large_nodes(node: &UnifiedNode, min_lines: usize) -> Vec<&UnifiedNode> {
            let mut result = Vec::new();
            if node.range.end_line - node.range.start_line >= min_lines {
                result.push(node);
            }
            for child in &node.children {
                result.extend(collect_large_nodes(child, min_lines));
            }
            result
        }

        let min_lines = ast_detector.min_lines;
        for i in 0..parse_results.len() {
            for j in i+1..parse_results.len() {
                let a = &parse_results[i];
                let b = &parse_results[j];

                let nodes_a = collect_large_nodes(&a.unified_ast, min_lines);
                let nodes_b = collect_large_nodes(&b.unified_ast, min_lines);

                for na in &nodes_a {
                    let fp_a = ast_detector.generate_ast_fingerprint(na);
                    for nb in &nodes_b {
                        let fp_b = ast_detector.generate_ast_fingerprint(nb);
                        if fp_a.hash == fp_b.hash && fp_a.node_count >= ast_detector.min_tokens {
                            let lines_a = na.range.end_line - na.range.start_line + 1;
                            ast_dups.push(DuplicationGroup {
                                id: format!("ast-dup-{}", id_offset),
                                files: vec![
                                    crate::duplication::types::DuplicateFile {
                                        file_path: a.file_path.clone(),
                                        start_line: na.range.start_line,
                                        end_line: na.range.end_line,
                                        code_snippet: a.raw_source.clone(),
                                    },
                                    crate::duplication::types::DuplicateFile {
                                        file_path: b.file_path.clone(),
                                        start_line: nb.range.start_line,
                                        end_line: nb.range.end_line,
                                        code_snippet: b.raw_source.clone(),
                                    },
                                ],
                                duplicated_lines: lines_a,
                                fingerprint: fp_a.hash.clone(),
                            });
                            id_offset += 1;
                        }
                    }
                }
            }
        }

        dups.extend(ast_dups);
        if !dups.is_empty() {
            self.graph.duplications = Some(dups);
        }
    }

    pub fn get_graph(&self) -> &DependencyGraph {
        &self.graph
    }

    pub fn into_graph(self) -> DependencyGraph {
        self.graph
    }
}

fn find_node_by_range<'a>(ast: &'a UnifiedNode, target: &SourceRange) -> Option<&'a UnifiedNode> {
    if ast.range.start_line == target.start_line
        && ast.range.end_line == target.end_line
        && ast.range.start_column == target.start_column
    {
        return Some(ast);
    }
    for child in &ast.children {
        if let Some(found) = find_node_by_range(child, target) {
            return Some(found);
        }
    }
    None
}

impl Default for GraphBuilder {
    fn default() -> Self {
        Self::new()
    }
}