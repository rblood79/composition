#!/usr/bin/env node
// ADR-248 G0: conservative AST sweep for descendant writes/constructors.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("../node_modules/typescript");
const root = resolve(import.meta.dirname, "../../..");
const paths = execFileSync(
  "rg",
  ["--files", "apps/builder/src", "packages/shared/src", "-g", "*.ts", "-g", "*.tsx"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter((path) => !/\.test\.|\.spec\.|\/__tests__\//.test(path));
const sites = [];
for (const path of paths) {
  const text = readFileSync(resolve(root, path), "utf8");
  if (!text.includes("descendants") && !text.includes("updateDescendant"))
    continue;
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const add = (node, kind) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    sites.push({
      path,
      line,
      kind,
      snippet: node.getText(file).replace(/\s+/g, " ").slice(0, 240),
    });
  };
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      /\bdescendants\b/.test(node.left.getText(file))
    )
      add(node, "ASSIGNMENT");
    if (
      ts.isDeleteExpression(node) &&
      /\bdescendants\b/.test(node.expression.getText(file))
    )
      add(node, "DELETE");
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(file).replace(/^["']|["']$/g, "") === "descendants"
    )
      add(node, "OBJECT_FIELD");
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(file);
      if (
        /(?:updateDescendant|withCanonicalRefDescendant|applyEditToSlotFill)/.test(name)
      )
        add(node, "WRITE_HELPER_CALL");
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}
sites.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
const report = {
  scope: "Builder/shared TS and TSX product source, excluding tests",
  status: "CONSERVATIVE_AST_CANDIDATES; manual writer/reader classification required",
  summary: {
    filesScanned: paths.length,
    candidateSites: sites.length,
    candidateFiles: new Set(sites.map((site) => site.path)).size,
    byKind: Object.fromEntries(
      [...new Set(sites.map((site) => site.kind))].map((kind) => [
        kind,
        sites.filter((site) => site.kind === kind).length,
      ]),
    ),
  },
  sites,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(resolve(process.argv[outIndex + 1]), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
