use super::registry::{create_parser, LanguageAdapter};
use super::types::*;

pub struct GoAdapter;

impl GoAdapter {
    pub fn new() -> Self {
        GoAdapter
    }

    fn node_to_unified(&self, node: tree_sitter::Node, source: &str) -> UnifiedNode {
        let range = SourceRange {
            start_line: node.start_position().row + 1,
            start_column: node.start_position().column,
            end_line: node.end_position().row + 1,
            end_column: node.end_position().column,
        };

        let kind = node.kind().to_string();
        let name = if kind == "string" || kind == "interpreted_string_literal" || kind == "raw_string_literal" || kind == "string_fragment" {
            node.utf8_text(source.as_bytes()).unwrap_or("").to_string()
        } else if node.child_count() > 0 {
            let mut cursor = node.walk();
            let found = node.named_children(&mut cursor)
                .find(|c| c.kind() == "identifier" || c.kind() == "field_identifier");
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
            language: Language::Go,
        }
    }
}

impl LanguageAdapter for GoAdapter {
    fn parse(&self, source: &str, file_path: &str) -> ParseResult {
        let mut parser = create_parser(Language::Go);
        let tree = parser.parse(source, None).expect("Failed to parse Go source");

        let root = tree.root_node();
        let mut cursor = root.walk();
        let children: Vec<UnifiedNode> = root
            .named_children(&mut cursor)
            .map(|child| self.node_to_unified(child, source))
            .collect();

        let unified_ast = UnifiedNode {
            kind: "source_file".to_string(),
            name: String::new(),
            range: SourceRange {
                start_line: 1,
                start_column: 0,
                end_line: root.end_position().row + 1,
                end_column: root.end_position().column,
            },
            children,
            language: Language::Go,
        };

        let symbol_table = self.extract_symbol_table(&unified_ast, file_path);

        ParseResult {
            file_path: file_path.to_string(),
            language: Language::Go,
            symbol_table,
            unified_ast,
            raw_source: source.to_string(),
        }
    }

    fn language(&self) -> Language {
        Language::Go
    }
}

impl GoAdapter {
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
            "import_declaration" => {
                for child in &node.children {
                    if child.kind == "import_spec" && !child.name.is_empty() {
                        imports.push(Import {
                            module_path: child.name.clone(),
                            imported_symbols: vec![],
                            range: child.range.clone(),
                            import_type: ImportType::Module,
                        });
                    }
                }
            }
            "function_declaration" => {
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
            "method_declaration" => {
                let receiver_name = self.find_receiver_name(node);
                if !node.name.is_empty() {
                    definitions.push(Definition {
                        name: node.name.clone(),
                        kind: DefinitionKind::Method { class_name: receiver_name },
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: None,
                    });
                }
            }
            "type_declaration" => {
                let type_kind = self.find_type_kind(node);
                if !node.name.is_empty() {
                    definitions.push(Definition {
                        name: node.name.clone(),
                        kind: type_kind,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: None,
                    });
                }
            }
            "var_declaration" | "const_declaration" => {
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
            "call_expression" => {
                if !node.name.is_empty() {
                    references.push(Reference {
                        name: node.name.clone(),
                        range: node.range.clone(),
                        ref_kind: ReferenceKind::Call,
                        resolved_def: None,
                    });
                }
            }
            "go_statement" | "defer_statement" => {
                for child in &node.children {
                    if child.kind == "call_expression" && !child.name.is_empty() {
                        references.push(Reference {
                            name: child.name.clone(),
                            range: child.range.clone(),
                            ref_kind: ReferenceKind::Call,
                            resolved_def: None,
                        });
                    }
                }
            }
            "select_statement" => {
                for child in &node.children {
                    if child.kind == "communication_case" {
                        for cc in &child.children {
                            if cc.kind == "send_statement" || cc.kind == "receive_statement" {
                                for ccc in &cc.children {
                                    if (ccc.kind == "identifier" || ccc.kind == "call_expression") && !ccc.name.is_empty() {
                                        references.push(Reference {
                                            name: ccc.name.clone(),
                                            range: ccc.range.clone(),
                                            ref_kind: ReferenceKind::Call,
                                            resolved_def: None,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            "chan_type" => {
                definitions.push(Definition {
                    name: format!("chan_{}", node.range.start_line),
                    kind: DefinitionKind::Variable,
                    range: node.range.clone(),
                    file_path: file_path.to_string(),
                    parent_scope: None,
                });
            }
            _ => {}
        }

        for child in &node.children {
            self.extract_from_node(child, file_path, definitions, references, imports);
        }
    }

    fn find_receiver_name(&self, node: &UnifiedNode) -> String {
        for child in &node.children {
            if child.kind == "parameter_list" {
                for param in &child.children {
                    if param.kind == "parameter_declaration" {
                        for p in &param.children {
                            if p.kind == "type_identifier" || p.kind == "identifier" {
                                return p.name.clone();
                            }
                        }
                    }
                }
            }
        }
        String::new()
    }

    fn find_type_kind(&self, node: &UnifiedNode) -> DefinitionKind {
        for child in &node.children {
            if child.kind == "struct_type" {
                return DefinitionKind::Class;
            }
            if child.kind == "interface_type" {
                return DefinitionKind::Interface;
            }
            if child.kind == "type_spec" {
                for spec_child in &child.children {
                    if spec_child.kind == "struct_type" {
                        return DefinitionKind::Class;
                    }
                    if spec_child.kind == "interface_type" {
                        return DefinitionKind::Interface;
                    }
                }
            }
        }
        DefinitionKind::TypeAlias
    }
}