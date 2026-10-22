import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { componentCatalog } from "../../../../../../packages/shared/src/catalog/componentCatalog";
import {
  CATALOG_D2_COMMON_PROVENANCE,
  CATALOG_D2_COMPOSITION_TYPES,
  CATALOG_D2_PROVENANCE,
} from "../../../../../../packages/shared/src/catalog/document/d2Provenance";
import type { PropContract } from "../../../../../../packages/shared/src/catalog/types";

/**
 * D2 gate (2026-10-14): a binding's visible `accepts` keys and option values are the installed S2's
 * (`@react-spectrum/s2` — the D2 order's first step, 2026-10-09), or are declared in
 * `d2Provenance.ts` with where they come from (v3 · RAC · composition).
 *
 * The oracle is the package's TypeScript types: each exported component's props type, the RAC
 * props it inherits included (`Omit<AriaCheckboxProps, …>` resolves through the installed RAC).
 * A type S2 does not export falls back to the RAC component of the same name.
 */

const require = createRequire(import.meta.url);

/** composition type → S2 export of a different name. */
const S2_ALIAS: Readonly<Record<string, string>> = {
  // (ADR-281 — a page root passes S2 Provider's locale · colorScheme down.)
  body: "Provider",
  Select: "Picker",
  GridList: "ListView",
  GridListItem: "ListViewItem",
  Tree: "TreeView",
  TreeItem: "TreeViewItem",
  TreeItemContent: "TreeViewItemContent",
  ListBoxItem: "PickerItem",
  ListBoxSection: "PickerSection",
  Separator: "Divider",
  DisclosureGroup: "Accordion",
  // (The RAC Table takes S2 TableView's axes — isQuiet · density · selectionStyle · overflowMode.)
  Table: "TableView",
};

type PropsOracle = {
  readonly keys: ReadonlySet<string>;
  readonly literals: ReadonlyMap<string, ReadonlySet<string>>;
};

function packageTypes(name: string): string {
  const pkgPath = fs.realpathSync(require.resolve(`${name}/package.json`));
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
    types?: string;
    exports?: Record<string, { types?: string } | string>;
  };
  const root = path.dirname(pkgPath);
  const fromExports = pkg.exports?.["."];
  const rel =
    pkg.types ??
    (typeof fromExports === "object" ? fromExports.types : undefined) ??
    "dist/types.d.ts";
  return path.join(root, rel);
}

function buildOracles(): {
  s2: Map<string, PropsOracle>;
  rac: Map<string, PropsOracle>;
} {
  const s2Index = packageTypes("@react-spectrum/s2");
  const racIndex = packageTypes("react-aria-components");
  const typesDir = path.dirname(
    path.dirname(fs.realpathSync(require.resolve("@types/react/package.json"))),
  );
  const program = ts.createProgram([s2Index, racIndex], {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    strict: true,
    // (The S2 package's own node_modules has no @types — React's DOM attribute types must resolve,
    //  or `Omit<…, keyof GlobalDOMAttributes>` omits everything.)
    baseUrl: typesDir,
    paths: {
      react: [path.join(typesDir, "react/index.d.ts")],
      "react/*": [path.join(typesDir, "react/*")],
      "react-dom": [path.join(typesDir, "react-dom/index.d.ts")],
      "react-dom/*": [path.join(typesDir, "react-dom/*")],
    },
    typeRoots: [typesDir],
    types: ["react", "react-dom"],
  });
  const checker = program.getTypeChecker();

  const collect = (
    type: ts.Type,
    keys: Set<string>,
    literals: Map<string, Set<string>>,
  ): void => {
    if (type.isUnion()) {
      for (const member of type.types) collect(member, keys, literals);
      return;
    }
    for (const prop of checker.getPropertiesOfType(type)) {
      keys.add(prop.getName());
      const found = new Set<string>();
      const walk = (t: ts.Type): void => {
        if (t.isUnion()) t.types.forEach(walk);
        else if (t.isStringLiteral()) found.add(t.value);
      };
      walk(checker.getTypeOfSymbol(prop));
      if (found.size) {
        const prev = literals.get(prop.getName()) ?? new Set<string>();
        for (const value of found) prev.add(value);
        literals.set(prop.getName(), prev);
      }
    }
  };

  const oraclesOf = (indexFile: string): Map<string, PropsOracle> => {
    const out = new Map<string, PropsOracle>();
    const sf = program.getSourceFile(indexFile);
    const mod = sf && checker.getSymbolAtLocation(sf);
    if (!mod) return out;
    for (const exported of checker.getExportsOfModule(mod)) {
      const name = exported.getName();
      if (!/^[A-Z]/.test(name)) continue;
      const symbol =
        exported.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exported)
          : exported;
      if (!(symbol.flags & ts.SymbolFlags.Value)) continue;
      const signatures = checker.getSignaturesOfType(
        checker.getTypeOfSymbol(symbol),
        ts.SignatureKind.Call,
      );
      if (!signatures.length) continue;
      const keys = new Set<string>();
      const literals = new Map<string, Set<string>>();
      for (const signature of signatures) {
        const first = signature.getParameters()[0];
        if (!first) continue;
        collect(
          checker.getTypeOfSymbolAtLocation(
            first,
            first.valueDeclaration ?? sf,
          ),
          keys,
          literals,
        );
      }
      if (keys.size) out.set(name, { keys, literals });
    }
    return out;
  };

  return { s2: oraclesOf(s2Index), rac: oraclesOf(racIndex) };
}

const { s2, rac } = buildOracles();

type Row = {
  type: string;
  s2Name: string | undefined;
  oracle: PropsOracle | undefined;
  accepts: Array<[string, PropContract]>;
};

function rows(): Row[] {
  const out: Row[] = [];
  for (const entry of componentCatalog) {
    if (entry.kind !== "primitive") continue;
    const accepts = Object.entries(entry.binding.props.accepts ?? {}).filter(
      ([, contract]) => !contract.editorHidden,
    );
    if (!accepts.length) continue;
    const s2Name = S2_ALIAS[entry.type] ?? entry.type;
    const fromS2 = s2.get(s2Name);
    out.push({
      type: entry.type,
      s2Name: fromS2 ? s2Name : undefined,
      oracle: fromS2 ?? rac.get(entry.type),
      accepts,
    });
  }
  return out;
}

const ROWS = rows();

describe("D2 — binding accepts vs the installed S2 types", () => {
  it("the oracle resolved S2's inherited RAC props (Checkbox has isDisabled)", () => {
    expect(s2.get("Checkbox")?.keys.has("isDisabled")).toBe(true);
    expect(s2.get("Checkbox")?.keys.has("isEmphasized")).toBe(true);
    expect(s2.size).toBeGreaterThan(150);
  });

  it("every visible prop key is S2's, or declared in d2Provenance with its source", () => {
    const drift: string[] = [];
    for (const row of ROWS) {
      if (CATALOG_D2_COMPOSITION_TYPES.has(row.type)) continue;
      for (const [key] of row.accepts) {
        if (row.oracle?.keys.has(key)) continue;
        if (CATALOG_D2_COMMON_PROVENANCE[key]) continue;
        if (CATALOG_D2_PROVENANCE[row.type]?.[key]) continue;
        drift.push(`${row.type}.${key} (oracle: ${row.s2Name ?? "RAC"})`);
      }
    }
    expect(drift).toEqual([]);
  });

  it("no option value a prop's S2 type does not allow", () => {
    const drift: string[] = [];
    for (const row of ROWS) {
      if (!row.s2Name || !row.oracle) continue;
      for (const [key, contract] of row.accepts) {
        const allowed = row.oracle.literals.get(key);
        if (!allowed || !contract.options) continue;
        for (const option of contract.options) {
          const value = typeof option === "string" ? option : option.value;
          // (An empty option is "unset" — the locale's · RAC's default, not a value.)
          if (typeof value === "string" && value !== "" && !allowed.has(value))
            drift.push(`${row.type}.${key} = "${value}"`);
        }
      }
    }
    expect(drift).toEqual([]);
  });

  it("d2Provenance names no key S2 declares (stale) and no key the binding lacks (dead)", () => {
    const stale: string[] = [];
    for (const [type, keys] of Object.entries(CATALOG_D2_PROVENANCE)) {
      const row = ROWS.find((candidate) => candidate.type === type);
      for (const key of Object.keys(keys)) {
        if (!row) stale.push(`${type}.${key}: no such binding`);
        else if (row.oracle?.keys.has(key))
          stale.push(`${type}.${key}: S2 declares it`);
        else if (!row.accepts.some(([accepted]) => accepted === key))
          stale.push(`${type}.${key}: the binding has no such visible key`);
      }
    }
    for (const type of CATALOG_D2_COMPOSITION_TYPES)
      if (s2.has(S2_ALIAS[type] ?? type))
        stale.push(`${type}: S2 exports it — not a composition-only type`);
    expect(stale).toEqual([]);
  });
});
