use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceRange {
    pub start_line: usize,
    pub start_column: usize,
    pub end_line: usize,
    pub end_column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedNode {
    pub kind: String,
    pub name: String,
    pub range: SourceRange,
    pub children: Vec<UnifiedNode>,
    pub language: Language,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum Language {
    Python,
    TypeScript,
    Go,
}

impl Language {
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext {
            "py" => Some(Language::Python),
            "ts" | "tsx" | "js" | "jsx" => Some(Language::TypeScript),
            "go" => Some(Language::Go),
            _ => None,
        }
    }

    pub fn extensions(&self) -> &[&str] {
        match self {
            Language::Python => &["py"],
            Language::TypeScript => &["ts", "tsx", "js", "jsx"],
            Language::Go => &["go"],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Import {
    pub module_path: String,
    pub imported_symbols: Vec<String>,
    pub range: SourceRange,
    pub import_type: ImportType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImportType {
    Module,
    Named,
    Wildcard,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Definition {
    pub name: String,
    pub kind: DefinitionKind,
    pub range: SourceRange,
    pub file_path: String,
    pub parent_scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DefinitionKind {
    Function,
    Class,
    Variable,
    Interface,
    TypeAlias,
    Module,
    Method { class_name: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub name: String,
    pub range: SourceRange,
    pub ref_kind: ReferenceKind,
    pub resolved_def: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReferenceKind {
    Call,
    AttributeAccess,
    TypeAnnotation,
    Inheritance,
    Import,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolTable {
    pub file_path: String,
    pub definitions: Vec<Definition>,
    pub references: Vec<Reference>,
    pub imports: Vec<Import>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub file_path: String,
    pub language: Language,
    pub symbol_table: SymbolTable,
    pub unified_ast: UnifiedNode,
    pub raw_source: String,
}