#!/usr/bin/env node
// ADR-248 G0: freeze old descendant write sites and direct callers, including
// indirect helpers that the earlier `descendants[path]` inventory cannot see.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Descendant caller audit uses another HEAD");

const paths = execFileSync(
  "rg",
  [
    "--files",
    "apps/builder/src",
    "packages/shared/src",
    "-g",
    "*.ts",
    "-g",
    "*.tsx",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(
    (path) =>
      !path.includes("/__tests__/") &&
      !/\.(?:test|spec)\.tsx?$/.test(path) &&
      !path.includes("/generated/"),
  );
const callsOfInterest = new Set([
  "updateDescendant",
  "appendDescendantChild",
  "moveDescendantChild",
  "withCanonicalRefDescendantFills",
  "withCanonicalRefDescendantStylePatch",
  "applyEditToSlotFill",
  "buildInstanceDescendantPatches",
  "resolveCanonicalDescendantOverride",
  "resetInstanceOverrideField",
  "insertIntoDescendantChildren",
  "removeFromDescendantChildren",
  "moveWithinDescendantChildren",
  "insertCanonicalChild",
  "removeCanonicalChild",
  "moveCanonicalChild",
  "moveCanonicalChildToDescendants",
  "appendDescendantChildToDocument",
  "moveDescendantChildInDocument",
  "withCanonicalRefOverrides",
  "planGroupItemInsert",
  "applyCanonicalHistoryEventsToDocument",
  "applyCanonicalHistoryEventsToActiveDocument",
]);
const classify = (path) => {
  if (path.includes("/stores/history/")) return "history-inverse";
  if (path.includes("/resolvers/canonical/")) return "old-resolver";
  if (path.includes("/adapters/canonical/canonicalMutations"))
    return "old-mutation";
  if (path.includes("/stores/canonical/")) return "old-public-action";
  if (path.includes("/presentation/")) return "live-presentation";
  if (path.includes("/stores/inspectorActions")) return "live-inspector";
  if (path.includes("/stores/utils/")) return "builder-store-edit";
  if (path.includes("/components/") || path.includes("/panels/"))
    return "builder-component-or-projection";
  if (path.includes("/adapters/canonical/")) return "old-adapter";
  if (path.includes("/workspace/canvas/")) return "canvas-projection";
  if (path.includes("packages/shared/src/utils/compositionDocumentOrder"))
    return "shared-order-mutation";
  if (path.includes("packages/shared/src/types/pencil-adapter"))
    return "external-pen-adapter";
  if (path.includes("packages/shared/src/utils/export")) return "old-export";
  if (path.includes("packages/shared/src/")) return "shared-other";
  return "UNCLASSIFIED";
};
const writes = [];
const calls = [];
for (const path of paths) {
  const source = readFileSync(resolve(root, path), "utf8");
  if (!/descendant/i.test(source)) continue;
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const at = (node) =>
    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  const row = (node, kind) => ({
    path,
    line: at(node),
    kind,
    family: classify(path),
    source: node.getText(file).split("\n")[0].slice(0, 180),
  });
  const isDescendantTarget = (node) => {
    if (ts.isPropertyAccessExpression(node))
      return node.name.text === "descendants";
    if (ts.isElementAccessExpression(node))
      return /descendant/i.test(node.expression.getText(file));
    return false;
  };
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      isDescendantTarget(node.left)
    )
      writes.push(row(node, "assignment"));
    if (
      ts.isPropertyAssignment(node) &&
      (node.name.getText(file) === "descendants" ||
        node.name.getText(file) === '"descendants"')
    )
      writes.push(row(node, "object-property"));
    if (
      ts.isShorthandPropertyAssignment(node) &&
      node.name.text === "descendants"
    )
      writes.push(row(node, "object-shorthand"));
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : null;
      if (name && callsOfInterest.has(name))
        calls.push({ ...row(node, "call"), callee: name });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}
const report = {
  head,
  status:
    "AST_DESCENDANT_WRITES_AND_DIRECT_CALLS; runtime precedence UNVERIFIED",
  summary: {
    scannedFiles: paths.length,
    writeSites: writes.length,
    writeFiles: new Set(writes.map((item) => item.path)).size,
    directCalls: calls.length,
    callFiles: new Set(calls.map((item) => item.path)).size,
    unclassified: [...writes, ...calls].filter(
      (item) => item.family === "UNCLASSIFIED",
    ).length,
  },
  writes,
  calls,
};
if (report.summary.unclassified)
  throw new Error(
    `${report.summary.unclassified} descendant sites unclassified: ${[
      ...writes,
      ...calls,
    ]
      .filter((item) => item.family === "UNCLASSIFIED")
      .map((item) => `${item.path}:${item.line}`)
      .join(", ")}`,
  );
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
