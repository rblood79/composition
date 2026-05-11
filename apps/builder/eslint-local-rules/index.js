const ADR126_ELEMENT_IMPORT_ALLOWED_FILES = new Set([
  "src/adapters/canonical/canonicalMutations.ts",
  "src/adapters/canonical/componentSemanticsMirror.ts",
  "src/adapters/canonical/diffLegacyRoundtrip.ts",
  "src/adapters/canonical/exportLegacyDocument.ts",
  "src/adapters/canonical/frameLayoutCascade.ts",
  "src/adapters/canonical/idPath.ts",
  "src/adapters/canonical/index.ts",
  "src/adapters/canonical/instanceResolver.ts",
  "src/adapters/canonical/legacyElementFields.ts",
  "src/adapters/canonical/legacyElementSanitizer.ts",
  "src/adapters/canonical/legacyElementsApiService.ts",
  "src/adapters/canonical/legacyMetadata.ts",
  "src/adapters/canonical/pageFrameBinding.ts",
  "src/adapters/canonical/shadowWriteDiff.ts",
  "src/adapters/canonical/slotAndLayoutAdapter.ts",
  "src/adapters/canonical/slotDeclaration.ts",
  "src/adapters/canonical/types.ts",
  "src/builder/components/selection/BatchPropertyEditor.tsx",
  "src/builder/components/selection/SelectionFilter.tsx",
  "src/builder/components/selection/SmartSelection.tsx",
  "src/builder/dev/editingSemanticsFixture.ts",
  "src/builder/factories/ComponentFactory.ts",
  "src/builder/factories/definitions/TableComponents.ts",
  "src/builder/factories/types/index.ts",
  "src/builder/factories/utils/dbPersistence.ts",
  "src/builder/factories/utils/elementCreation.ts",
  "src/builder/hooks/useDeltaMessenger.ts",
  "src/builder/hooks/useErrorHandler.ts",
  "src/builder/hooks/useElementCreator.ts",
  "src/builder/hooks/useIframeMessenger.ts",
  "src/builder/hooks/usePageManager.ts",
  "src/builder/hooks/useTreeExpandState.ts",
  "src/builder/inspector/utils/elementMapper.ts",
  "src/builder/main/BuilderCore.tsx",
  "src/builder/panels/ai/AIPanel.tsx",
  "src/builder/panels/components/ComponentsPanel.tsx",
  "src/builder/panels/monitor/hooks/useComponentMemory.ts",
  "src/builder/panels/nodes/PagesSection.tsx",
  "src/builder/panels/properties/PropertiesPanel.tsx",
  "src/builder/panels/properties/utils/batchPropertyUtils.ts",
  "src/builder/panels/styles/utils/fillExternalIngress.ts",
  "src/builder/stores/canonical/canonicalElementsView.ts",
  "src/builder/stores/canonical/canonicalSceneModelLegacy.ts",
  "src/builder/stores/canvasStore.ts",
  "src/builder/stores/commandDataStore.ts",
  "src/builder/stores/elementLoader.ts",
  "src/builder/stores/elements.ts",
  "src/builder/stores/history.ts",
  "src/builder/stores/history/canonicalHistoryEvents.ts",
  "src/builder/stores/history/historyActions.ts",
  "src/builder/stores/index.ts",
  "src/builder/stores/inspectorActions.ts",
  "src/builder/stores/utils/elementCreation.ts",
  "src/builder/stores/utils/elementDiff.ts",
  "src/builder/stores/utils/elementGrouping.ts",
  "src/builder/stores/utils/elementHelpers.ts",
  "src/builder/stores/utils/elementIndexer.ts",
  "src/builder/stores/utils/elementRemoval.ts",
  "src/builder/stores/utils/elementTagNormalizer.ts",
  "src/builder/stores/utils/elementUpdate.ts",
  "src/builder/stores/utils/frameActions.ts",
  "src/builder/stores/utils/historyHelpers.ts",
  "src/builder/stores/utils/instanceActions.ts",
  "src/builder/utils/canonicalRefDependencies.ts",
  "src/builder/utils/canvasDeltaMessenger.ts",
  "src/builder/utils/idGeneration.ts",
  "src/builder/utils/multiElementCopy.ts",
  "src/builder/utils/selectionMemory.ts",
  "src/builder/utils/smartSelection.ts",
  "src/builder/utils/treeUtils.ts",
  "src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.ts",
  "src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.ts",
  "src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts",
  "src/builder/workspace/canvas/hooks/useViewportCulling.ts",
  "src/builder/workspace/overlay/useTextEdit.ts",
  "src/services/ai/tools/canonicalToolReadModel.ts",
  "src/services/ai/tools/createElement.ts",
  "src/types/builder/component.types.ts",
  "src/types/builder/layout.types.ts",
  "src/types/builder/unified.types.ts",
  "src/types/core/store.types.ts",
  "src/utils/dom/iframeMessenger.ts",
  "src/utils/element/elementUtils.ts",
  "src/utils/events/eventHandlers.ts",
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
          "Disallow Zustand grouped selectors with object returns (causes infinite loops)",
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
      return {
        CallExpression(node) {
          // Detect: useStore((state) => ({ field1: state.field1, ... }))
          if (
            node.callee.name === "useStore" &&
            node.arguments.length === 1 &&
            node.arguments[0].type === "ArrowFunctionExpression"
          ) {
            const selectorFn = node.arguments[0];
            const body = selectorFn.body;

            // Check if returning an object expression directly
            if (body.type === "ObjectExpression") {
              context.report({
                node,
                messageId: "groupedSelector",
              });
            }
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
      return {
        CallExpression(node) {
          // Detect: useStore(useShallow(...))
          if (
            node.callee.name === "useStore" &&
            node.arguments.length === 1 &&
            node.arguments[0].type === "CallExpression" &&
            node.arguments[0].callee.name === "useShallow"
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
          "ADR-126: Element is deprecated for new production code. Use CompositionDocument/CanonicalNode or a structural contract instead.",
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
