use crate::parser::types::UnifiedNode;

use super::types::CodeMetrics;

pub fn calculate_cyclomatic_complexity(node: &UnifiedNode) -> f64 {
    let mut complexity: f64 = 1.0;
    count_branches(node, &mut complexity);
    complexity
}

fn count_branches(node: &UnifiedNode, count: &mut f64) {
    match node.kind.as_str() {
        "if_statement" | "elif_clause" | "else_clause"
        | "for_statement" | "while_statement"
        | "case_clause" | "default_clause"
        | "try_statement" | "except_clause"
        | "switch_statement"
        | "for_in_statement" | "do_statement"
        | "catch_clause" | "finally_clause"
        | "conditional_expression" | "ternary_expression"
        | "match_arm" | "type_switch_statement"
        | "select_statement" | "comm_clause" => {
            *count += 1.0;
        }
        "binary_operator" | "logical_operator" => {
            if node.name.contains("and") || node.name.contains("or") {
                *count += 1.0;
            }
        }
        _ => {}
    }

    for child in &node.children {
        count_branches(child, count);
    }
}

pub fn calculate_lines_of_code(source: &str) -> usize {
    source
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && !trimmed.starts_with("//") && !trimmed.starts_with('#')
        })
        .count()
}

pub fn calculate_comment_density(source: &str) -> f64 {
    let total_lines = source.lines().count();
    if total_lines == 0 {
        return 0.0;
    }

    let comment_lines: usize = source
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            trimmed.starts_with("//")
                || trimmed.starts_with('#')
                || trimmed.starts_with("/*")
                || trimmed.starts_with('*')
                || trimmed.starts_with("*/")
                || trimmed.starts_with("\"\"\"")
                || trimmed.starts_with("'''")
        })
        .count();

    comment_lines as f64 / total_lines as f64
}

pub fn calculate_coupling(
    afferent: usize,
    efferent: usize,
) -> (f64, f64) {
    let total = afferent + efferent;
    if total == 0 {
        return (0.0, 0.0);
    }

    let instability = efferent as f64 / total as f64;
    let distance = (0.0 + instability - 1.0).abs();

    (instability, distance)
}

pub fn calculate_abstractness(node: &UnifiedNode) -> f64 {
    match node.kind.as_str() {
        "interface_declaration" | "type_alias_declaration" => 1.0,
        "class_definition" | "class_declaration" => {
            let total_methods = node.children.iter()
                .filter(|c| c.kind == "function_definition" || c.kind == "method_definition")
                .count();
            if total_methods == 0 {
                return 0.0;
            }
            let abstract_methods = node.children.iter()
                .filter(|c| {
                    c.kind == "function_definition" || c.kind == "method_definition"
                })
                .filter(|m| {
                    m.children.iter().any(|mc| mc.kind == "abstract")
                    || m.children.iter().any(|mc| mc.kind == "decorator" && mc.name.contains("abstract"))
                })
                .count();
            abstract_methods as f64 / total_methods as f64
        }
        _ => 0.0,
    }
}

pub fn compute_all_metrics(node: &UnifiedNode, source: &str, afferent: usize, efferent: usize) -> CodeMetrics {
    let complexity = calculate_cyclomatic_complexity(node);
    let loc = calculate_lines_of_code(source);
    let comment_density = calculate_comment_density(source);
    let (instability, distance) = calculate_coupling(afferent, efferent);
    let abstractness = calculate_abstractness(node);

    CodeMetrics {
        cyclomatic_complexity: complexity,
        lines_of_code: loc,
        comment_density,
        afferent_coupling: afferent,
        efferent_coupling: efferent,
        instability,
        abstractness,
        distance_from_main_sequence: distance,
    }
}

pub fn compute_all_metrics_from_source(
    source: &str,
    start_line: usize,
    end_line: usize,
    afferent: usize,
    efferent: usize,
) -> CodeMetrics {
    let lines: Vec<&str> = source.lines().collect();
    let slice_start = start_line.saturating_sub(1);
    let slice_end = end_line.min(lines.len());
    let slice = if slice_start < slice_end {
        lines[slice_start..slice_end].join("\n")
    } else {
        String::new()
    };

    let complexity = count_branches_in_text(&slice);
    let loc = calculate_lines_of_code(&slice);
    let comment_density = calculate_comment_density(&slice);
    let (instability, distance) = calculate_coupling(afferent, efferent);

    CodeMetrics {
        cyclomatic_complexity: complexity,
        lines_of_code: loc,
        comment_density,
        afferent_coupling: afferent,
        efferent_coupling: efferent,
        instability,
        abstractness: 0.0,
        distance_from_main_sequence: distance,
    }
}

fn count_branches_in_text(source: &str) -> f64 {
    let mut count: f64 = 1.0;
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("if ")
            || trimmed.starts_with("elif ")
            || trimmed.starts_with("else:")
            || trimmed.starts_with("for ")
            || trimmed.starts_with("while ")
            || trimmed.starts_with("case ")
            || trimmed.starts_with("default:")
            || trimmed.starts_with("try:")
            || trimmed.starts_with("except ")
            || trimmed.starts_with("switch ")
            || trimmed.starts_with("catch ")
            || trimmed.contains("&&")
            || trimmed.contains("||")
        {
            count += 1.0;
        }
    }
    count
}