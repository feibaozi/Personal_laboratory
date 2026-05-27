import { getFrameworkTree, getCurrentFrameworkId } from "./nodes";

export function exportFrameworkMermaid(frameworkId?: number): string {
  const fwId = frameworkId || getCurrentFrameworkId();
  const tree = getFrameworkTree(fwId);

  let lines: string[] = ["mindmap"];

  function addNode(node: any, indent: number) {
    const prefix = "  ".repeat(indent);
    const icon = node.icon ? `${node.icon} ` : "";
    lines.push(`${prefix}${icon}${node.title}`);
    if (node.children) {
      for (const child of node.children) {
        addNode(child, indent + 1);
      }
    }
  }

  addNode(tree, 1);
  return lines.join("\n");
}

export function exportFrameworkMarkdown(frameworkId?: number): string {
  const fwId = frameworkId || getCurrentFrameworkId();
  const tree = getFrameworkTree(fwId);

  let lines: string[] = [];

  function addNode(node: any, level: number) {
    const prefix = "#".repeat(Math.min(level, 6));
    const typeLabel = node.node_type ? ` [${node.node_type}]` : "";
    const sourceLabel = node.source_type === "user" ? " 👤" : "";
    lines.push(`${prefix} ${node.title}${typeLabel}${sourceLabel}`);
    lines.push("");

    if (node.summary) {
      lines.push(`> ${node.summary}`);
      lines.push("");
    }

    if (node.content) {
      lines.push(node.content);
      lines.push("");
    }

    if (node.tags && node.tags.length > 0) {
      lines.push(`标签: ${node.tags.map((t: any) => `#${t.name}`).join(" ")}`);
      lines.push("");
    }

    if (node.children) {
      for (const child of node.children) {
        addNode(child, level + 1);
      }
    }
  }

  addNode(tree, 1);
  return lines.join("\n");
}
