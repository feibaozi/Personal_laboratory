"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportFrameworkMermaid = exportFrameworkMermaid;
exports.exportFrameworkMarkdown = exportFrameworkMarkdown;
const nodes_1 = require("./nodes");
function exportFrameworkMermaid(frameworkId) {
    const fwId = frameworkId || (0, nodes_1.getCurrentFrameworkId)();
    const tree = (0, nodes_1.getFrameworkTree)(fwId);
    let lines = ["mindmap"];
    function addNode(node, indent) {
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
function exportFrameworkMarkdown(frameworkId) {
    const fwId = frameworkId || (0, nodes_1.getCurrentFrameworkId)();
    const tree = (0, nodes_1.getFrameworkTree)(fwId);
    let lines = [];
    function addNode(node, level) {
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
            lines.push(`标签: ${node.tags.map((t) => `#${t.name}`).join(" ")}`);
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
