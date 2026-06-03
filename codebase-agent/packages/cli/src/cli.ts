#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeProject,
  getGraph,
  getLineage,
  getDebt,
  getRefactorSuggestions,
  getDuplications,
  getStatus,
  generateDocs,
} from './client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('codebase-agent')
  .description(
    'Local Codebase Agent - analyze code repositories with AST parsing and dependency graphs'
  )
  .version(pkg.version);

program
  .command('analyze')
  .description('Analyze a project directory')
  .argument('<project-path>', 'Path to the project directory')
  .option('-l, --languages <languages>', 'Languages to analyze (comma-separated)')
  .option('-i, --incremental', 'Perform incremental analysis')
  .action(
    async (
      projectPath: string,
      options: { languages?: string; incremental?: boolean }
    ) => {
      try {
        const absPath = join(process.cwd(), projectPath);
        console.log(`Analyzing: ${absPath}`);

        const { projectId } = await analyzeProject(absPath);
        console.log(`Project ID: ${projectId}`);

        let status: any;
        do {
          await new Promise((r) => setTimeout(r, 500));
          status = await getStatus(projectId);
        } while (status.status === 'running');

        if (status.status === 'error') {
          console.error(`Analysis failed: ${status.error}`);
          process.exit(1);
        }

        const graph = await getGraph(projectId);
        console.log(
          `Parsed ${status.nodeCount} symbols with ${status.edgeCount} dependencies`
        );

        const modules = graph.nodes?.filter((n: any) => n.kind === 'Module') || [];
        console.log(`Modules: ${modules.length}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    }
  );

program
  .command('debt-report')
  .description('Generate a technical debt report')
  .argument('<project-path>', 'Path to the project directory')
  .option(
    '-f, --format <format>',
    'Output format: json, html, markdown',
    'markdown'
  )
  .action(async (projectPath: string, options: { format: string }) => {
    try {
      const absPath = join(process.cwd(), projectPath);
      const { projectId } = await analyzeProject(absPath);

      let status: any;
      do {
        await new Promise((r) => setTimeout(r, 500));
        status = await getStatus(projectId);
      } while (status.status === 'running');

      const debt = await getDebt(projectId);

      if (options.format === 'json') {
        console.log(JSON.stringify(debt, null, 2));
      } else {
        const overall = debt?.overall || debt?.[0]?.overall || 0;
        const grade = debt?.grade || debt?.[0]?.grade || '?';
        console.log(`\nTechnical Debt Report`);
        console.log(`====================\n`);
        console.log(`Health Grade: ${grade}`);
        console.log(`Overall Score: ${Number(overall).toFixed(1)} / 10`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('lineage')
  .description('Trace the lineage of a symbol')
  .argument('<project-path>', 'Path to the project directory')
  .requiredOption('-s, --symbol <symbol>', 'Symbol name to trace')
  .option('-d, --depth <depth>', 'Maximum trace depth', '5')
  .action(
    async (
      projectPath: string,
      options: { symbol: string; depth: string }
    ) => {
      try {
        const absPath = join(process.cwd(), projectPath);
        const { projectId } = await analyzeProject(absPath);

        let status: any;
        do {
          await new Promise((r) => setTimeout(r, 500));
          status = await getStatus(projectId);
        } while (status.status === 'running');

        const lineage = await getLineage(
          projectId,
          options.symbol,
          parseInt(options.depth)
        );

        if (!lineage || (!lineage.downstream?.length && !lineage.upstream?.length)) {
          console.log(`No lineage found for "${options.symbol}"`);
          return;
        }

        console.log(JSON.stringify(lineage, null, 2));
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    }
  );

program
  .command('duplicates')
  .description('Detect duplicate code')
  .argument('<project-path>', 'Path to the project directory')
  .option('-m, --min-lines <lines>', 'Minimum duplicate lines', '6')
  .action(async (projectPath: string, options: { minLines: string }) => {
    try {
      const absPath = join(process.cwd(), projectPath);
      const { projectId } = await analyzeProject(absPath);

      let status: any;
      do {
        await new Promise((r) => setTimeout(r, 500));
        status = await getStatus(projectId);
      } while (status.status === 'running');

      const dups = await getDuplications(projectId);
      console.log(
        `Found ${dups.groups?.length || 0} duplicate groups (min ${options.minLines} lines)`
      );
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('doc-generate')
  .description('Generate architecture documentation')
  .argument('<project-path>', 'Path to the project directory')
  .option('-o, --output <output>', 'Output file path', './docs/architecture.md')
  .action(async (projectPath: string, options: { output: string }) => {
    try {
      const absPath = join(process.cwd(), projectPath);
      console.log(`Analyzing: ${absPath}`);

      const { projectId } = await analyzeProject(absPath);

      let status: any;
      do {
        await new Promise((r) => setTimeout(r, 500));
        status = await getStatus(projectId);
      } while (status.status === 'running');

      if (status.status === 'error') {
        console.error(`Analysis failed: ${status.error}`);
        process.exit(1);
      }

      console.log(`Generating architecture documentation...`);

      const docsRes = await generateDocs(projectId);

      const { writeFileSync, mkdirSync } = await import('fs');
      const { dirname } = await import('path');
      const outputPath = join(process.cwd(), options.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, docsRes.content, 'utf-8');

      console.log(`Documentation saved to: ${outputPath}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      console.error('Make sure an LLM provider is running (default: ollama on localhost:11434)');
      process.exit(1);
    }
  });

program
  .command('refactor-suggest')
  .description('Get refactoring suggestions')
  .argument('<project-path>', 'Path to the project directory')
  .option(
    '-s, --severity <severity>',
    'Minimum severity: info, warning, error',
    'warning'
  )
  .action(async (projectPath: string, options: { severity: string }) => {
    try {
      const absPath = join(process.cwd(), projectPath);
      const { projectId } = await analyzeProject(absPath);

      let status: any;
      do {
        await new Promise((r) => setTimeout(r, 500));
        status = await getStatus(projectId);
      } while (status.status === 'running');

      const suggestions = await getRefactorSuggestions(projectId);
      const { smells = [], tasks = [] } = suggestions;

      console.log(`\nCode Smells: ${smells.length}`);
      smells.forEach((s: any) => {
        console.log(
          `  [${s.severity}] ${s.smellType || s.type}: ${s.description}`
        );
      });

      console.log(`\nRefactor Tasks: ${tasks.length}`);
      tasks.forEach((t: any) => {
        console.log(
          `  [P${t.priority}] ${t.title} (effort: ${t.estimatedEffort || t.estimated_effort})`
        );
      });
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();