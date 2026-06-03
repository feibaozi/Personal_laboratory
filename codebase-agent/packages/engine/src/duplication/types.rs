use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicationGroup {
    pub id: String,
    pub files: Vec<DuplicateFile>,
    pub duplicated_lines: usize,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateFile {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub code_snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstFingerprint {
    pub hash: String,
    pub kind: String,
    pub node_count: usize,
    pub max_depth: usize,
}

pub struct DuplicateDetector {
    pub min_lines: usize,
    pub min_tokens: usize,
    pub similarity_threshold: f64,
}

impl Default for DuplicateDetector {
    fn default() -> Self {
        DuplicateDetector {
            min_lines: 6,
            min_tokens: 50,
            similarity_threshold: 0.9,
        }
    }
}

impl DuplicateDetector {
    pub fn new(min_lines: usize) -> Self {
        DuplicateDetector {
            min_lines,
            ..Default::default()
        }
    }

    pub fn generate_ast_fingerprint(&self, node: &crate::parser::types::UnifiedNode) -> AstFingerprint {
        use sha2::{Sha256, Digest};

        let skeleton = self.extract_structure_skeleton(node);
        let mut hasher = Sha256::new();
        hasher.update(skeleton.as_bytes());
        let hash = format!("{:x}", hasher.finalize());

        let (node_count, max_depth) = self.count_nodes_and_depth(node, 0);

        AstFingerprint {
            hash,
            kind: node.kind.clone(),
            node_count,
            max_depth,
        }
    }

    fn extract_structure_skeleton(&self, node: &crate::parser::types::UnifiedNode) -> String {
        let mut parts: Vec<String> = vec![node.kind.clone()];

        let mut child_kinds: Vec<String> = node
            .children
            .iter()
            .map(|c| self.extract_structure_skeleton(c))
            .collect();

        child_kinds.sort();
        parts.extend(child_kinds);

        format!("({})", parts.join(" "))
    }

    fn count_nodes_and_depth(
        &self,
        node: &crate::parser::types::UnifiedNode,
        current_depth: usize,
    ) -> (usize, usize) {
        let mut count = 1;
        let mut max_depth = current_depth;

        for child in &node.children {
            let (child_count, child_depth) =
                self.count_nodes_and_depth(child, current_depth + 1);
            count += child_count;
            max_depth = max_depth.max(child_depth);
        }

        (count, max_depth)
    }
}

pub struct TokenBasedDetector {
    pub window_size: usize,
    pub min_match_length: usize,
}

impl Default for TokenBasedDetector {
    fn default() -> Self {
        TokenBasedDetector {
            window_size: 6,
            min_match_length: 6,
        }
    }
}

impl TokenBasedDetector {
    pub fn new(window_size: usize) -> Self {
        TokenBasedDetector {
            window_size,
            min_match_length: window_size,
        }
    }

    pub fn find_duplicates(
        &self,
        token_streams: Vec<(&str, Vec<String>)>,
    ) -> Vec<DuplicationGroup> {
        use std::collections::HashMap;

        let mut hash_to_locations: HashMap<String, Vec<(String, usize)>> = HashMap::new();
        let mut groups: Vec<DuplicationGroup> = Vec::new();

        for (file_path, tokens) in &token_streams {
            if tokens.len() < self.window_size {
                continue;
            }

            for i in 0..=tokens.len() - self.window_size {
                let window: String = tokens[i..i + self.window_size].join("|");
                hash_to_locations
                    .entry(window)
                    .or_default()
                    .push((file_path.to_string(), i));
            }
        }

        let mut group_id = 0;
        for (_hash, locations) in hash_to_locations {
            if locations.len() < 2 {
                continue;
            }

            let mut files: Vec<DuplicateFile> = locations
                .iter()
                .map(|(path, pos)| DuplicateFile {
                    file_path: path.clone(),
                    start_line: *pos + 1,
                    end_line: *pos + self.window_size,
                    code_snippet: String::new(),
                })
                .collect();

            files.dedup_by(|a, b| a.file_path == b.file_path && a.start_line == b.start_line);

            if files.len() >= 2 {
                groups.push(DuplicationGroup {
                    id: format!("dup-{}", group_id),
                    files,
                    duplicated_lines: self.window_size,
                    fingerprint: format!("{}", group_id),
                });
                group_id += 1;
            }
        }

        groups
    }
}