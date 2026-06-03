use tree_sitter::Tree;

use super::registry::{create_parser, LanguageAdapter};
use super::types::*;

pub struct PythonAdapter;

impl PythonAdapter {
    pub fn new() -> Self {
        PythonAdapter
    }

    fn walk_tree(&self, tree: &Tree, source: &str) -> UnifiedNode {
        let root = tree.root_node();
        self.node_to_unified(root, source, Language::Python)
    }

    fn node_to_unified(
        &self,
        node: tree_sitter::Node,
        source: &str,
        language: Language,
    ) -> UnifiedNode {
        let range = SourceRange {
            start_line: node.start_position().row + 1,
            start_column: node.start_position().column,
            end_line: node.end_position().row + 1,
            end_column: node.end_position().column,
        };

        let kind = node.kind().to_string();
        let name = if kind == "string" || kind == "string_fragment" {
            node.utf8_text(source.as_bytes()).unwrap_or("").to_string()
        } else if kind == "identifier" {
            node.utf8_text(source.as_bytes()).unwrap_or("").to_string()
        } else if node.child_count() > 0 {
            let mut cursor = node.walk();
            let found = node.named_children(&mut cursor)
                .find(|c| c.kind() == "identifier");
            found.map(|c| c.utf8_text(source.as_bytes()).unwrap_or("").to_string()).unwrap_or_default()
        } else {
            String::new()
        };

        let mut cursor = node.walk();
        let children: Vec<UnifiedNode> = node
            .named_children(&mut cursor)
            .map(|child| self.node_to_unified(child, source, language.clone()))
            .collect();

        UnifiedNode {
            kind,
            name,
            range,
            children,
            language,
        }
    }
}

impl LanguageAdapter for PythonAdapter {
    fn parse(&self, source: &str, file_path: &str) -> ParseResult {
        let mut parser = create_parser(Language::Python);
        let tree = parser.parse(source, None).expect("Failed to parse Python source");
        let unified_ast = self.walk_tree(&tree, source);

        let symbol_table = self.extract_symbol_table(&unified_ast, source, file_path);

        ParseResult {
            file_path: file_path.to_string(),
            language: Language::Python,
            symbol_table,
            unified_ast,
            raw_source: source.to_string(),
        }
    }

    fn language(&self) -> Language {
        Language::Python
    }
}

impl PythonAdapter {
    fn extract_symbol_table(&self, ast: &UnifiedNode, source: &str, file_path: &str) -> SymbolTable {
        let mut definitions = Vec::new();
        let mut references = Vec::new();
        let mut imports = Vec::new();

        self.extract_from_node(ast, source, file_path, None, &mut definitions, &mut references, &mut imports);

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
        source: &str,
        file_path: &str,
        parent_scope: Option<String>,
        definitions: &mut Vec<Definition>,
        references: &mut Vec<Reference>,
        imports: &mut Vec<Import>,
    ) {
        match node.kind.as_str() {
            "import_statement" | "import_from_statement" => {
                if let Some(import) = self.extract_import(node) {
                    imports.push(import);
                }
            }
            "class_definition" => {
                let name = self.find_identifier_name(node);
                if !name.is_empty() {
                    definitions.push(Definition {
                        name: name.clone(),
                        kind: DefinitionKind::Class,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: parent_scope.clone(),
                    });
                    for child in &node.children {
                        self.extract_from_node(child, source, file_path, Some(name.clone()), definitions, references, imports);
                    }
                    return;
                }
            }
            "function_definition" => {
                let name = self.find_identifier_name(node);
                if !name.is_empty() {
                    let scope = parent_scope.clone();
                    let kind = if scope.is_some() {
                        DefinitionKind::Method {
                            class_name: scope.clone().unwrap(),
                        }
                    } else {
                        DefinitionKind::Function
                    };
                    definitions.push(Definition {
                        name: name.clone(),
                        kind,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: parent_scope.clone(),
                    });
                }
            }
            "decorated_definition" => {
                for child in &node.children {
                    if child.kind == "class_definition" || child.kind == "function_definition" {
                        self.extract_from_node(child, source, file_path, parent_scope.clone(), definitions, references, imports);
                    }
                }
                return;
            }
            "lambda" => {
                let name = format!("lambda_{}", node.range.start_line);
                definitions.push(Definition {
                    name,
                    kind: DefinitionKind::Function,
                    range: node.range.clone(),
                    file_path: file_path.to_string(),
                    parent_scope: parent_scope.clone(),
                });
            }
            "assignment" => {
                let name = self.find_identifier_name(node);
                if !name.is_empty() {
                    definitions.push(Definition {
                        name,
                        kind: DefinitionKind::Variable,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: parent_scope.clone(),
                    });
                }
            }
            "call" => {
                if let Some(func_name) = self.find_call_target(node) {
                    references.push(Reference {
                        name: func_name,
                        range: node.range.clone(),
                        ref_kind: ReferenceKind::Call,
                        resolved_def: None,
                    });
                }
            }
            "list_comprehension" | "dictionary_comprehension" | "set_comprehension" | "generator_expression" => {
                let kind_name = match node.kind.as_str() {
                    "list_comprehension" => "comprehension",
                    "dictionary_comprehension" => "dict_comprehension",
                    "set_comprehension" => "set_comprehension",
                    _ => "generator",
                };
                let name = format!("{}_{}", kind_name, node.range.start_line);
                definitions.push(Definition {
                    name,
                    kind: DefinitionKind::Function,
                    range: node.range.clone(),
                    file_path: file_path.to_string(),
                    parent_scope: parent_scope.clone(),
                });
            }
            "async_function_definition" => {
                let name = self.find_identifier_name(node);
                if !name.is_empty() {
                    definitions.push(Definition {
                        name: name.clone(),
                        kind: DefinitionKind::Function,
                        range: node.range.clone(),
                        file_path: file_path.to_string(),
                        parent_scope: parent_scope.clone(),
                    });
                }
            }
            "await" => {
                if let Some(awaited) = self.find_call_target(node) {
                    references.push(Reference {
                        name: awaited,
                        range: node.range.clone(),
                        ref_kind: ReferenceKind::Call,
                        resolved_def: None,
                    });
                }
            }
            _ => {}
        }

        for child in &node.children {
            self.extract_from_node(child, source, file_path, None, definitions, references, imports);
        }
    }

    fn find_identifier_name(&self, node: &UnifiedNode) -> String {
        for child in &node.children {
            if child.kind == "identifier" {
                return child.name.clone();
            }
        }
        String::new()
    }

    fn find_call_target(&self, node: &UnifiedNode) -> Option<String> {
        for child in &node.children {
            if child.kind == "identifier" || child.kind == "attribute" {
                return Some(child.name.clone());
            }
        }
        None
    }

    fn extract_import(&self, node: &UnifiedNode) -> Option<Import> {
        if node.kind == "import_from_statement" {
            self.extract_from_import(node)
        } else {
            self.extract_simple_import(node)
        }
    }

    fn extract_simple_import(&self, node: &UnifiedNode) -> Option<Import> {
        let mut module_path = String::new();

        for child in &node.children {
            match child.kind.as_str() {
                "dotted_name" | "aliased_import" => {
                    module_path = child.name.clone();
                }
                _ => {}
            }
        }

        if module_path.is_empty() {
            return None;
        }

        Some(Import {
            module_path,
            imported_symbols: Vec::new(),
            range: node.range.clone(),
            import_type: ImportType::Module,
        })
    }

    fn extract_from_import(&self, node: &UnifiedNode) -> Option<Import> {
        let mut module_path = String::new();
        let mut imported_symbols = Vec::new();

        for child in &node.children {
            match child.kind.as_str() {
                "dotted_name" => {
                    if module_path.is_empty() {
                        module_path = child.name.clone();
                    } else {
                        imported_symbols.push(child.name.clone());
                    }
                }
                "aliased_import" => {
                    if let Some(name_child) = child.children.first() {
                        imported_symbols.push(name_child.name.clone());
                    }
                }
                _ => {}
            }
        }

        if module_path.is_empty() {
            return None;
        }

        Some(Import {
            module_path,
            imported_symbols,
            range: node.range.clone(),
            import_type: ImportType::Module,
        })
    }
}