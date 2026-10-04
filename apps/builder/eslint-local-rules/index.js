import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ADR126_ELEMENT_IMPORT_ALLOWED_FILES = new Set([
  "src/builder/panels/ai/AIPanel.tsx",
  // ADR-155 Phase 2: PropertiesPanel 에서 이전된 legacy elementsMap 변환 (동일 계약)
  "src/services/ai/tools/createElement.ts",
  "src/types/builder/unified.types.ts",
  "src/types/core/store.types.ts",
  "src/utils/messaging.ts",
]);

function normalizeSourceFilename(filename) {
  const normalized = filename.replaceAll("\\", "/");
  const marker = "/apps/builder/";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex >= 0) {
    return normalized.slice(markerIndex + marker.length);
  }
  return normalized.replace(/^.*\/src\//, "src/");
}

function isTestFilename(filename) {
  return (
    filename.includes("/__tests__/") ||
    filename.includes(".test.") ||
    filename.includes(".static.test.") ||
    filename.includes(".spec.")
  );
}

function isElementTypeModule(source) {
  return (
    typeof source === "string" &&
    (source.endsWith("types/core/store.types") ||
      source.endsWith("types/builder/unified.types") ||
      source.endsWith("./unified.types") ||
      source === "@/types/core/store.types" ||
      source === "@/types/builder/unified.types")
  );
}

function importedElementName(specifier) {
  const imported = specifier.imported;
  if (!imported) return null;
  return imported.name ?? imported.value ?? null;
}

function importTypeQualifierName(node) {
  const qualifier = node.qualifier;
  if (!qualifier) return null;
  if (qualifier.type === "Identifier") return qualifier.name;
  if (qualifier.type === "TSQualifiedName") {
    return qualifier.right?.name ?? null;
  }
  return null;
}

/**
 * Zustand store hook names: `use*` bound to `create(...)` / `create<T>()(...)` anywhere in `src`
 * (scanned once per lint process) or in the linted file itself. The store hooks are not all named
 * `use*Store` (`useDesignPanelView`, `useSectionCollapse`), so the rules match by
 * the binding, not by a name pattern. `useStore` stays for zustand's own two-argument form.
 */
const STORE_DECLARATION =
  /(?:^|\n)\s*(?:export\s+)?const\s+(use[A-Za-z0-9_]*)\s*(?::[^=\n]+)?=\s*create\s*(?:<[^>]*>)?\s*(?:\(\s*\)\s*)?\(/g;

function storeNamesIn(text) {
  const names = new Set();
  for (const match of text.matchAll(STORE_DECLARATION)) names.add(match[1]);
  return names;
}

/** `apps/builder/src` — from the linted file's path, else this module's location, else the cwd. */
function builderSourceRoot(filename) {
  const normalized = (filename ?? "").replaceAll("\\", "/");
  const markerIndex = normalized.indexOf("/apps/builder/");
  if (markerIndex >= 0)
    return `${normalized.slice(0, markerIndex)}/apps/builder/src`;
  try {
    return fileURLToPath(new URL("../src", import.meta.url));
  } catch {
    return join(process.cwd(), "src");
  }
}

let projectStoreNames;
function projectZustandStoreNames(filename) {
  if (projectStoreNames) return projectStoreNames;
  projectStoreNames = new Set();
  const root = builderSourceRoot(filename);
  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "__tests__")
          visit(full);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
        const text = readFileSync(full, "utf8");
        if (!text.includes("create")) continue;
        for (const name of storeNamesIn(text)) projectStoreNames.add(name);
      }
    }
  };
  visit(root);
  return projectStoreNames;
}

/** The selector argument of a Zustand store hook call, or undefined. */
function zustandSelectorOf(node, fileStoreNames, filename) {
  if (node.callee.type !== "Identifier") return undefined;
  const name = node.callee.name;
  // zustand's `useStore(store, selector)`; the old single-store `useStore(selector)`.
  if (name === "useStore") return node.arguments[node.arguments.length - 1];
  if (fileStoreNames.has(name) || projectZustandStoreNames(filename).has(name))
    return node.arguments[0];
  return undefined;
}

function fileZustandStoreNames(context) {
  const sourceCode = context.sourceCode ?? context.getSourceCode();
  return storeNamesIn(sourceCode.text);
}

/**
 * Local ESLint Rules for composition
 *
 * Custom rules to prevent anti-patterns discovered during refactoring.
 *
 * @see CHANGELOG.md - Anti-Patterns Discovered & Documented
 */

export default {
  "no-zustand-grouped-selectors": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow Zustand grouped selectors with object / array returns (causes infinite loops)",
        category: "Best Practices",
        recommended: true,
      },
      messages: {
        groupedSelector:
          "Avoid Zustand grouped selectors with object returns. Use individual selectors instead to prevent infinite loops. See CHANGELOG.md for details.",
      },
      schema: [],
    },
    create(context) {
      const fileStoreNames = fileZustandStoreNames(context);
      return {
        CallExpression(node) {
          // Detect: useAnyStore((state) => ({ field1: state.field1, ... })) — a new object (or
          // array) per call never equals the last snapshot (Zustand v5 ignores equalityFn).
          const selector = zustandSelectorOf(
            node,
            fileStoreNames,
            context.filename,
          );
          if (
            selector &&
            (selector.type === "ArrowFunctionExpression" ||
              selector.type === "FunctionExpression") &&
            (selector.body.type === "ObjectExpression" ||
              selector.body.type === "ArrayExpression")
          ) {
            context.report({
              node,
              messageId: "groupedSelector",
            });
          }
        },
      };
    },
  },

  "no-zustand-use-shallow": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow useShallow wrapper with Zustand (causes infinite loops)",
        category: "Best Practices",
        recommended: true,
      },
      messages: {
        useShallowDetected:
          "Avoid useShallow wrapper with Zustand. Use individual selectors instead. See CHANGELOG.md for details.",
      },
      schema: [],
    },
    create(context) {
      const fileStoreNames = fileZustandStoreNames(context);
      return {
        CallExpression(node) {
          // Detect: useAnyStore(useShallow(...))
          const selector = zustandSelectorOf(
            node,
            fileStoreNames,
            context.filename,
          );
          if (
            selector &&
            selector.type === "CallExpression" &&
            selector.callee.type === "Identifier" &&
            selector.callee.name === "useShallow"
          ) {
            context.report({
              node,
              messageId: "useShallowDetected",
            });
          }
        },
      };
    },
  },

  "prefer-keyboard-shortcuts-registry": {
    meta: {
      type: "suggestion",
      docs: {
        description:
          "Suggest using useKeyboardShortcutsRegistry instead of manual event listeners",
        category: "Best Practices",
        recommended: false,
      },
      messages: {
        manualListener:
          "Consider using useKeyboardShortcutsRegistry hook instead of manual keyboard event listeners. See src/builder/hooks/useKeyboardShortcutsRegistry.ts",
      },
      schema: [],
    },
    create(context) {
      return {
        CallExpression(node) {
          // Detect: window.addEventListener('keydown', ...)
          if (
            node.callee.type === "MemberExpression" &&
            node.callee.object.name === "window" &&
            node.callee.property.name === "addEventListener" &&
            node.arguments.length >= 2 &&
            node.arguments[0].type === "Literal" &&
            node.arguments[0].value === "keydown"
          ) {
            context.report({
              node,
              messageId: "manualListener",
            });
          }
        },
      };
    },
  },

  "prefer-copy-paste-hook": {
    meta: {
      type: "suggestion",
      docs: {
        description: "Suggest using useCopyPaste hook for clipboard operations",
        category: "Best Practices",
        recommended: false,
      },
      messages: {
        manualClipboard:
          "Consider using useCopyPaste hook instead of manual clipboard operations. See src/builder/hooks/useCopyPaste.ts",
      },
      schema: [],
    },
    create(context) {
      return {
        MemberExpression(node) {
          // Detect: navigator.clipboard.writeText(...) or navigator.clipboard.readText(...)
          if (
            node.object.type === "MemberExpression" &&
            node.object.object.name === "navigator" &&
            node.object.property.name === "clipboard" &&
            (node.property.name === "writeText" ||
              node.property.name === "readText")
          ) {
            context.report({
              node,
              messageId: "manualClipboard",
            });
          }
        },
      };
    },
  },

  "no-eventtype-legacy-import": {
    meta: {
      type: "problem",
      docs: {
        description: "Disallow importing EventType from legacy paths",
        category: "Best Practices",
        recommended: true,
      },
      messages: {
        legacyImport:
          'Import EventType from "@/types/events/events.types" instead of legacy paths. See CHANGELOG.md for details.',
      },
      schema: [],
    },
    create(context) {
      return {
        ImportDeclaration(node) {
          // Detect imports from legacy event type paths
          const source = node.source.value;
          if (
            typeof source === "string" &&
            (source.includes("/events/types/eventTypes") ||
              source.includes("/inspector/events/types/eventTypes"))
          ) {
            // Check if importing EventType specifically
            const hasEventTypeImport = node.specifiers.some(
              (spec) =>
                spec.type === "ImportSpecifier" &&
                spec.imported.name === "EventType",
            );

            if (hasEventTypeImport) {
              context.report({
                node,
                messageId: "legacyImport",
              });
            }
          }
        },
      };
    },
  },

  "no-deprecated-element-import": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow new production imports of deprecated ADR-126 Element type outside the compatibility allowlist",
        category: "Best Practices",
        recommended: true,
      },
      messages: {
        deprecatedElement:
          "ADR-126: Element is deprecated for new production code. Use the catalog document model (`@composition/shared` catalog) or a structural contract instead.",
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeSourceFilename(context.filename ?? "");
      const allowElementImport =
        isTestFilename(filename) ||
        ADR126_ELEMENT_IMPORT_ALLOWED_FILES.has(filename);

      function reportIfDisallowed(node) {
        if (!allowElementImport) {
          context.report({ node, messageId: "deprecatedElement" });
        }
      }

      return {
        ImportDeclaration(node) {
          if (!isElementTypeModule(node.source.value)) return;
          for (const specifier of node.specifiers) {
            if (
              specifier.type === "ImportSpecifier" &&
              importedElementName(specifier) === "Element"
            ) {
              reportIfDisallowed(specifier);
            }
          }
        },
        TSImportType(node) {
          const source = node.argument?.value;
          if (
            isElementTypeModule(source) &&
            importTypeQualifierName(node) === "Element"
          ) {
            reportIfDisallowed(node);
          }
        },
      };
    },
  },
};
