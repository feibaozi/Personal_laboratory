use super::types::*;

pub fn compute_debt_score(
    metrics: &CodeMetrics,
    test_coverage: Option<f64>,
    duplication_rate: Option<f64>,
    weights: &ScoreWeights,
    thresholds: &ComplexityThresholds,
) -> DebtScore {
    let complexity_score = score_complexity(metrics.cyclomatic_complexity, thresholds);
    let coupling_score = score_coupling(metrics.distance_from_main_sequence);
    let comment_score = metrics.comment_density * 10.0;
    let test_score = test_coverage.unwrap_or(0.0) * 10.0;
    let dup_score = (1.0 - duplication_rate.unwrap_or(0.0)) * 10.0;

    let overall = complexity_score * weights.complexity
        + coupling_score * weights.coupling
        + comment_score * weights.comment_density
        + test_score * weights.test_coverage
        + dup_score * weights.duplication;

    let overall_normalized = overall.clamp(0.0, 10.0);

    DebtScore {
        overall: overall_normalized,
        grade: HealthGrade::from_score(overall_normalized),
        dimensions: DimensionScores {
            complexity: DimensionScore {
                score: complexity_score,
                weight: weights.complexity,
                raw_value: metrics.cyclomatic_complexity,
            },
            coupling: DimensionScore {
                score: coupling_score,
                weight: weights.coupling,
                raw_value: metrics.distance_from_main_sequence,
            },
            comment_density: DimensionScore {
                score: comment_score,
                weight: weights.comment_density,
                raw_value: metrics.comment_density,
            },
            test_coverage: DimensionScore {
                score: test_score,
                weight: weights.test_coverage,
                raw_value: test_coverage.unwrap_or(0.0),
            },
            duplication: DimensionScore {
                score: dup_score,
                weight: weights.duplication,
                raw_value: duplication_rate.unwrap_or(0.0),
            },
        },
    }
}

fn score_complexity(value: f64, thresholds: &ComplexityThresholds) -> f64 {
    if value <= thresholds.excellent {
        10.0
    } else if value <= thresholds.good {
        8.0
    } else if value <= thresholds.warning {
        5.0
    } else if value <= thresholds.danger {
        3.0
    } else {
        1.0
    }
}

fn score_coupling(distance: f64) -> f64 {
    let normalized = (1.0 - distance).clamp(0.0, 1.0);
    normalized * 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debt_score_perfect() {
        let metrics = CodeMetrics {
            cyclomatic_complexity: 3.0,
            lines_of_code: 100,
            comment_density: 1.0,
            afferent_coupling: 5,
            efferent_coupling: 5,
            instability: 0.5,
            abstractness: 0.5,
            distance_from_main_sequence: 0.0,
        };

        let score = compute_debt_score(
            &metrics,
            Some(1.0),
            Some(0.0),
            &ScoreWeights::default(),
            &ComplexityThresholds::default(),
        );

        assert!(score.overall > 7.0);
        assert_eq!(score.grade.to_str(), "A");
    }

    #[test]
    fn test_debt_score_poor() {
        let metrics = CodeMetrics {
            cyclomatic_complexity: 60.0,
            lines_of_code: 500,
            comment_density: 0.0,
            afferent_coupling: 0,
            efferent_coupling: 30,
            instability: 1.0,
            abstractness: 0.0,
            distance_from_main_sequence: 1.0,
        };

        let score = compute_debt_score(
            &metrics,
            Some(0.0),
            Some(0.5),
            &ScoreWeights::default(),
            &ComplexityThresholds::default(),
        );

        assert!(score.overall < 4.0);
        assert_eq!(score.grade.to_str(), "F");
    }
}