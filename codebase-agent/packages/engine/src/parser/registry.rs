use std::collections::HashMap;
use std::path::Path;
use std::sync::OnceLock;

use tree_sitter::{Parser, Language as TsLanguage};

use super::types::{Language, ParseResult};
use crate::parser::go_adapter::GoAdapter;
use crate::parser::python_adapter::PythonAdapter;
use crate::parser::typescript_adapter::TypeScriptAdapter;

pub trait LanguageAdapter {
    fn parse(&self, source: &str, file_path: &str) -> ParseResult;
    fn language(&self) -> Language;
}

pub struct ParserRegistry {
    parsers: HashMap<Language, Box<dyn LanguageAdapter + Send + Sync>>,
}

impl ParserRegistry {
    pub fn new() -> Self {
        let mut parsers: HashMap<Language, Box<dyn LanguageAdapter + Send + Sync>> = HashMap::new();
        parsers.insert(Language::Python, Box::new(PythonAdapter::new()));
        parsers.insert(Language::TypeScript, Box::new(TypeScriptAdapter::new()));
        parsers.insert(Language::Go, Box::new(GoAdapter::new()));

        ParserRegistry { parsers }
    }

    pub fn get_adapter(&self, language: &Language) -> Option<&(dyn LanguageAdapter + Send + Sync)> {
        self.parsers.get(language).map(|a| a.as_ref())
    }

    pub fn parse_file(&self, file_path: &Path, source: &str) -> Option<ParseResult> {
        let ext = file_path.extension()?.to_str()?;
        let language = Language::from_extension(ext)?;
        let adapter = self.parsers.get(&language)?;
        let file_path_str = file_path.to_string_lossy().to_string();
        Some(adapter.parse(source, &file_path_str))
    }

    pub fn language_for_path(&self, file_path: &Path) -> Option<Language> {
        let ext = file_path.extension()?.to_str()?;
        Language::from_extension(ext)
    }

    pub fn supported_languages(&self) -> Vec<Language> {
        vec![Language::Python, Language::TypeScript, Language::Go]
    }
}

impl Default for ParserRegistry {
    fn default() -> Self {
        Self::new()
    }
}

fn ts_language_python() -> TsLanguage {
    static LANG: OnceLock<TsLanguage> = OnceLock::new();
    LANG.get_or_init(|| tree_sitter_python::LANGUAGE.into()).clone()
}

fn ts_language_typescript() -> TsLanguage {
    static LANG: OnceLock<TsLanguage> = OnceLock::new();
    LANG.get_or_init(|| tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()).clone()
}

fn ts_language_go() -> TsLanguage {
    static LANG: OnceLock<TsLanguage> = OnceLock::new();
    LANG.get_or_init(|| tree_sitter_go::LANGUAGE.into()).clone()
}

pub fn create_parser(language: Language) -> Parser {
    let mut parser = Parser::new();
    let ts_lang = match language {
        Language::Python => ts_language_python(),
        Language::TypeScript => ts_language_typescript(),
        Language::Go => ts_language_go(),
    };
    parser.set_language(&ts_lang).expect("Failed to set tree-sitter language");
    parser
}