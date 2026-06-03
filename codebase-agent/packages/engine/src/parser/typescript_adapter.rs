use super::registry::{create_parser, LanguageAdapter};
use super::types::*;

pub struct TypeScriptAdapter;

impl TypeScriptAdapter {
    pub fn new() -> Self {
        TypeScriptAdapter
    }

    fn node_to_unified(&self, node: tree_sitter::Node, source: &str) -> UnifiedNode {
        let range = SourceRange {
            start_line: node.start_position().row + 1,
            start_column: node.start_position().column,
            end_line: node.end_position().row + 1,
            end_column: node.end_position().column,
        };

        let kind = node.kind().to_string();
        let name = if kind == "string" || kind == "string_fragment" || kind == "template_string" {
            node.utf8_text(source.as_bytes()).unwrap_or("").to_string()
        } else if node.child_count() > 0 {
            let mut cursor = node.walk();
            let found = node.named_children(&mut cursor)
                .find(|c| c.kind() == "identifier" || c.kind() == "property_identifier");
            found.map(|c| c.utf8_text(source.as_bytes()).unwrap_or("").to_string()).unwrap_or_default()
        } else {
            String::new()
        };

        let mut cursor = node.walk();
        let children: Vec<UnifiedNode> = node
            .named_children(&mut cursor)
            .map(|child| self.node_to_unified(child, source))
            .collect();

        UnifiedNode {
            kind,
            name,
            range,
            children,
            language: Language::TypeScript,
        }
    }
}

impl LanguageAdapter for TypeScriptAdapter {
    fn parse(&self, source: &str, file_path: &str) -> ParseResult {
        let mut parser = create_parser(Language::TypeScript);
        let tree = parser.parse(source, None).expect("Failed to parse TypeScript source");

        let root = tree.root_node();
        let mut cursor = root.walk();
        let children: Vec<UnifiedNode> = root
            .named_children(&mut cursor)
            .map(|child| self.node_to_unified(child, source))
            .collect();

        let unified_ast = UnifiedNode {
            kind: "program".to_string(),
            name: String::new(),
            range: SourceRange {
                start_line: 1,
                start_column: 0,
                end_line: root.end_position().row + 1,
                end_column: root.end_position().column,
            },
            children,
            language: Language::TypeScript,
        };

        let symbol_table = self.extract_symbol_table(&unified_ast, file_path);

        ParseResult {
            file_path: file_path.to_string(),
            language: Language::TypeScript,
            symbol_table,
            unified_ast,
            raw_source: source.to_string(),
        }
    }

    fn language(&self) -> Language {
        Language::TypeScript
    }
}

impl TypeScriptAdapter {
    fn extract_symbol_table(&self, ast: &UnifiedNode, file_path: &str) -> SymbolTable {
        let mut definitions = Vec::new();
        let mut references = Vec::new();
        let mut imports = Vec::new();

        self.extract_from_node(ast, file_path, &mut definitions, &mut references, &mut imports);

        SymbolTable {
            file_path: file_path.to_string(),
            definitions,
            references,
            imports,
        }
    }

    fn extract_from_node(
        &self,
        node: &UnifiedNode,
        file_path: &str,
        definitions: &mut Vec<Definition>,
        references: &mut Vec<Reference>,
        imports: &mut Vec<Import>,
    ) {
        match node.kind.as_str() {
            "import_statement" => {
                let module_path = self.extract_import_module(node);
                let imported_names = self.extract_imported_names(node);
                if !module_path.is_empty() {
                    imports.push(Import {
                        module_path,
                        imported_symbols: imported_names,
                        range: node.range.clone(),
                        import_type: ImportType::Module,
                    });
                }
            }
            "export_statement" => {}
            "class_declaration" => {
                if !node.name.is_empty() {
                    definitions.push(Definition {
                        name: node.name.clone(),
                        kind: DefinitionKind::Class,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: None,
                    });
                }
            }
            "function_declaration" | "method_definition" | "arrow_function" => {
                if !node.name.is_empty() {
                    definitions.push(Definition {
                        name: node.name.clone(),
                        kind: DefinitionKind::Function,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: None,
                    });
                }
            }
            "lexical_declaration" | "variable_declaration" => {
                if !node.name.is_empty() {
                    definitions.push(Definition {
                        name: node.name.clone(),
                        kind: DefinitionKind::Variable,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: None,
                    });
                }
            }
            "interface_declaration" | "type_alias_declaration" => {
                if !node.name.is_empty() {
                    definitions.push(Definition {
                        name: node.name.clone(),
                        kind: DefinitionKind::Interface,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: None,
                    });
                }
            }
            "enum_declaration" => {
                if !node.name.is_empty() {
                    definitions.push(Definition {
                        name: node.name.clone(),
                        kind: DefinitionKind::Class,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: None,
                    });
                }
            }
            "call_expression" | "new_expression" => {
                if !node.name.is_empty() {
                    references.push(Reference {
                        name: node.name.clone(),
                        range: node.range.clone(),
                        ref_kind: ReferenceKind::Call,
                        resolved_def: None,
                    });
                }
            }
            "generic_type" | "type_arguments" => {
                for child in &node.children {
                    if child.kind == "type_identifier" || child.kind == "identifier" {
                        references.push(Reference {
                            name: child.name.clone(),
                            range: child.range.clone(),
                            ref_kind: ReferenceKind::Call,
                            resolved_def: None,
                        });
                    } else if child.kind == "generic_type" {
                        for gc in &child.children {
                            if gc.kind == "type_identifier" || gc.kind == "identifier" {
                                references.push(Reference {
                                    name: gc.name.clone(),
                                    range: gc.range.clone(),
                                    ref_kind: ReferenceKind::Call,
                                    resolved_def: None,
                                });
                            }
                        }
                    }
                }
            }
            _ => {}
        }

        for child in &node.children {
            self.extract_from_node(child, file_path, definitions, references, imports);
        }
    }

    fn extract_import_module(&self, node: &UnifiedNode) -> String {
        for child in &node.children {
            if child.kind == "from_clause" {
                for gc in &child.children {
                    if gc.kind == "string" {
                        let s = gc.name.trim_matches('"').trim_matches('\'');
                        return s.to_string();
                    }
                }
            }
            if child.kind == "string" {
                let s = child.name.trim_matches('"').trim_matches('\'');
                return s.to_string();
            }
        }
        String::new()
    }

    fn extract_imported_names(&self, node: &UnifiedNode) -> Vec<String> {
        let mut names = Vec::new();
        for child in &node.children {
            if child.kind == "import_clause" || child.kind == "named_imports" {
                self.collect_import_specifiers(child, &mut names);
            }
        }
        names
    }

    fn collect_import_specifiers(&self, node: &UnifiedNode, names: &mut Vec<String>) {
        if node.kind == "import_specifier" {
            for child in &node.children {
                if child.kind == "identifier" && !child.name.is_empty() {
                    names.push(child.name.clone());
                }
            }
        }
        for child in &node.children {
            self.collect_import_specifiers(child, names);
        }
    }
}