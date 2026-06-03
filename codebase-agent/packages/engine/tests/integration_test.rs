#[cfg(test)]
mod tests {
    use codebase_engine::parser::registry::ParserRegistry;
    use codebase_engine::parser::types::Language;

    #[test]
    fn test_parser_registry_creation() {
        let registry = ParserRegistry::new();
        let langs = registry.supported_languages();
        assert_eq!(langs.len(), 3);
    }

    #[test]
    fn test_language_from_extension() {
        assert_eq!(Language::from_extension("py"), Some(Language::Python));
        assert_eq!(Language::from_extension("ts"), Some(Language::TypeScript));
        assert_eq!(Language::from_extension("go"), Some(Language::Go));
        assert_eq!(Language::from_extension("txt"), None);
    }

    #[test]
    fn test_parse_python_simple() {
        let registry = ParserRegistry::new();
        let source = "def hello():\n    print('world')\n";
        let result = registry
            .parse_file(
                std::path::Path::new("test.py"),
                source,
            )
            .expect("Should parse Python file");

        assert_eq!(result.language, Language::Python);
        assert!(!result.symbol_table.definitions.is_empty());
    }

    #[test]
    fn test_parse_typescript_simple() {
        let registry = ParserRegistry::new();
        let source = "function hello() {\n  console.log('world');\n}\n";
        let result = registry
            .parse_file(
                std::path::Path::new("test.ts"),
                source,
            )
            .expect("Should parse TypeScript file");

        assert_eq!(result.language, Language::TypeScript);
    }

    #[test]
    fn test_parse_go_simple() {
        let registry = ParserRegistry::new();
        let source = "package main\n\nfunc hello() {\n\tprintln(\"world\")\n}\n";
        let result = registry
            .parse_file(
                std::path::Path::new("test.go"),
                source,
            )
            .expect("Should parse Go file");

        assert_eq!(result.language, Language::Go);
    }

    #[test]
    fn test_cyclomatic_complexity() {
        use codebase_engine::metrics::calculator::calculate_cyclomatic_complexity;
        use codebase_engine::parser::types::{UnifiedNode, SourceRange, Language};

        let node = UnifiedNode {
            kind: "function_definition".to_string(),
            name: "test_func".to_string(),
            range: SourceRange {
                start_line: 1,
                start_column: 0,
                end_line: 10,
                end_column: 0,
            },
            children: vec![
                UnifiedNode {
                    kind: "if_statement".to_string(),
                    name: String::new(),
                    range: SourceRange {
                        start_line: 2,
                        start_column: 4,
                        end_line: 5,
                        end_column: 4,
                    },
                    children: vec![],
                    language: Language::Python,
                },
                UnifiedNode {
                    kind: "for_statement".to_string(),
                    name: String::new(),
                    range: SourceRange {
                        start_line: 6,
                        start_column: 4,
                        end_line: 8,
                        end_column: 4,
                    },
                    children: vec![],
                    language: Language::Python,
                },
            ],
            language: Language::Python,
        };

        let complexity = calculate_cyclomatic_complexity(&node);
        assert_eq!(complexity, 3.0);
    }
}