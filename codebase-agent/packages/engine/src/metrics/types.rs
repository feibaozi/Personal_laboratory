use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodeMetrics {
    pub cyclomatic_complexity: f64,
    pub lines_of_code: usize,
    pub comment_density: f64,
    pub afferent_coupling: usize,
    pub efferent_coupling: usize,
    pub instability: f64,
    pub abstractness: f64,
    pub distance_from_main_sequence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebtScore {
    pub overall: f64,
    pub grade: HealthGrade,
    pub dimensions: DimensionScores,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DimensionScores {
    pub complexity: DimensionScore,
    pub coupling: DimensionScore,
    pub comment_density: DimensionScore,
    pub test_coverage: DimensionScore,
    pub duplication: DimensionScore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DimensionScore {
    pub score: f64,
    pub weight: f64,
    pub raw_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthGrade {
    A,
    B,
    C,
    D,
    F,
}

impl HealthGrade {
    pub fn from_score(score: f64) -> Self {
        match score {
            s if s >= 8.0 => HealthGrade::A,
            s if s >= 6.0 => HealthGrade::B,
            s if s >= 4.0 => HealthGrade::C,
            s if s >= 2.0 => HealthGrade::D,
            _ => HealthGrade::F,
        }
    }

    pub fn to_str(&self) -> &str {
        match self {
            HealthGrade::A => "A",
            HealthGrade::B => "B",
            HealthGrade::C => "C",
            HealthGrade::D => "D",
            HealthGrade::F => "F",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplexityThresholds {
    pub excellent: f64,
    pub good: f64,
    pub warning: f64,
    pub danger: f64,
}

impl Default for ComplexityThresholds {
    fn default() -> Self {
        ComplexityThresholds {
            excellent: 5.0,
            good: 10.0,
            warning: 20.0,
            danger: 50.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreWeights {
    pub complexity: f64,
    pub coupling: f64,
    pub comment_density: f64,
    pub test_coverage: f64,
    pub duplication: f64,
}

impl Default for ScoreWeights {
    fn default() -> Self {
        ScoreWeights {
            complexity: 0.25,
            coupling: 0.25,
            comment_density: 0.15,
            test_coverage: 0.20,
            duplication: 0.15,
        }
    }
}