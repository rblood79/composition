#!/usr/bin/env node
// ADR-248 G0: type-resolved read-site candidates for the old visual rule fields.
// This records evidence, not a claim that dynamic access or generated writes are closed.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("../node_modules/typescript");
const root = resolve(import.meta.dirname, "../../..");
const inventory = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/inventory.json"),
    "utf8",
  ),
);
const configPath = resolve(root, "apps/builder/tsconfig.app.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error)
  throw new Error(
    ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
  );
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  dirname(configPath),
  { noEmit: true },
  configPath,
);
if (parsed.errors.length)
  throw new Error(
    parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
      .join("\n"),
  );
const program = ts.createProgram(
  [
    ...parsed.fileNames,
    resolve(root, "packages/specs/scripts/generate-css.ts"),
  ],
  parsed.options,
);
const checker = program.getTypeChecker();
const typesPath = resolve(
  root,
  "packages/shared/src/types/composition-document.types.ts",
);
const typesFile = program.getSourceFile(typesPath);
if (!typesFile) throw new Error("Composition types are not in Builder program");
const visualInterfaces = new Set(
  inventory.unmappedInterfaces.filter((name) =>
    name.startsWith("ComponentRule"),
  ),
);
const fields = new Map();
const fieldBySymbol = new Map();
for (const declaration of typesFile.statements) {
  if (
    !ts.isInterfaceDeclaration(declaration) ||
    !visualInterfaces.has(declaration.name.text)
  )
    continue;
  for (const member of declaration.members) {
    const field = member.name?.getText(typesFile) ?? "[index]";
    const key = `${declaration.name.text}.${field}`;
    const symbol = member.name && checker.getSymbolAtLocation(member.name);
    fields.set(key, {
      interface: declaration.name.text,
      field,
      declarationLine:
        typesFile.getLineAndCharacterOfPosition(member.getStart(typesFile))
          .line + 1,
      sites: [],
    });
    if (symbol) fieldBySymbol.set(symbol, key);
  }
}
const expectedKeys = inventory.proposedFieldDestinations
  .filter((entry) => visualInterfaces.has(entry.interface))
  .map((entry) => `${entry.interface}.${entry.field}`);
const declaredKeys = [...fields.keys()];
if (JSON.stringify(declaredKeys.sort()) !== JSON.stringify(expectedKeys.sort()))
  throw new Error("Visual interface field list drifted from inventory");

const allowedRoots = [
  "apps/builder/src/",
  "packages/shared/src/",
  "packages/rendering/src/",
  "packages/specs/scripts/",
];
const pathFor = (fileName) => relative(root, fileName).replaceAll("\\", "/");
const isTest = (path) => /(?:__tests__\/|\.test\.|\.spec\.)/.test(path);
const dynamicSites = [];
for (const file of program.getSourceFiles()) {
  const path = pathFor(file.fileName);
  if (!allowedRoots.some((prefix) => path.startsWith(prefix))) continue;
  if (path === "packages/shared/src/types/composition-document.types.ts")
    continue;
  function record(node, symbol, accessKind) {
    const key = symbol && fieldBySymbol.get(symbol);
    if (!key) return false;
    const position = file.getLineAndCharacterOfPosition(node.getStart(file));
    fields.get(key).sites.push({
      path,
      line: position.line + 1,
      kind: accessKind,
      test: isTest(path),
      source: file.text.split("\n")[position.line].trim().slice(0, 180),
    });
    return true;
  }
  function visit(node) {
    if (ts.isPropertyAccessExpression(node)) {
      record(node, checker.getSymbolAtLocation(node.name), "property-access");
    } else if (ts.isElementAccessExpression(node)) {
      const argument = node.argumentExpression;
      if (argument && ts.isStringLiteralLike(argument)) {
        const ownerType = checker.getTypeAtLocation(node.expression);
        record(
          node,
          checker.getPropertyOfType(ownerType, argument.text),
          "literal-element-access",
        );
      } else {
        const ownerType = checker.getTypeAtLocation(node.expression);
        const affected = checker
          .getPropertiesOfType(ownerType)
          .map((symbol) => fieldBySymbol.get(symbol))
          .filter(Boolean);
        if (affected.length) {
          const position = file.getLineAndCharacterOfPosition(
            node.getStart(file),
          );
          dynamicSites.push({
            path,
            line: position.line + 1,
            affected: [...new Set(affected)].sort(),
            test: isTest(path),
            source: file.text.split("\n")[position.line].trim().slice(0, 180),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}
const rows = [...fields.values()].sort((a, b) =>
  `${a.interface}.${a.field}`.localeCompare(`${b.interface}.${b.field}`),
);
const summary = {
  visualInterfaces: visualInterfaces.size,
  visualFields: rows.length,
  fieldsWithProductionStaticAccess: rows.filter((row) =>
    row.sites.some((site) => !site.test),
  ).length,
  fieldsWithoutProductionStaticAccess: rows
    .filter((row) => !row.sites.some((site) => !site.test))
    .map((row) => `${row.interface}.${row.field}`),
  productionStaticSites: rows.reduce(
    (count, row) => count + row.sites.filter((site) => !site.test).length,
    0,
  ),
  productionDynamicSites: dynamicSites.filter((site) => !site.test).length,
};
const report = {
  baselineHead: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  method:
    "Builder TS program plus generate-css source; TypeScript checker resolves property/element access to interface field symbols. Publish is deferred. Generated object literals, destructuring, generic spread, casts, and dynamic keys need separate review",
  summary,
  rows,
  dynamicSites,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(summary)}\n`);
