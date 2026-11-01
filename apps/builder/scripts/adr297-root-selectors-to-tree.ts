/**
 * ADR-297 Phase 3c codemod — rule 의 `composition.rootSelectors` 중 **`&` 자신의 상태** 를 고르는 키 (방식 ④) 를
 * `structure.stateStyles` 의 조건 트리로. 대상은 13 rule 42 키 (Phase 0 인벤토리 — `&` 대상, 선언이 있는 것).
 * 자손 · 형제 · pseudo 를 고르는 키 (`nested` · `&[data-disabled] .react-aria-X` …) 는 그대로 둔다 (`domOnly` 성격).
 *
 * 트리는 옛 선택자의 cascade 결과를 키 순서로 다시 적은 것이다 (`:not(…)` 의 배제 → 나중 키가 이기는 순서). 옛
 * specificity 차이가 만들던 승자 (Input: hover 0-4-0 > invalid 0-2-0 · focus+invalid 는 invalid) 를 그대로 둔다 —
 * 값을 바꾸는 것은 3h (사용자 결정 2 의 확정 8 건) 이다. 검증 = DOM 하니스 (`adr297DomPaintParity` 3c 기록) Δ.
 *
 *   pnpm -F @composition/builder exec tsx scripts/adr297-root-selectors-to-tree.ts [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const dry = process.argv.includes("--dry");
const file = path.resolve(
  import.meta.dirname,
  "../../../packages/shared/src/catalog/generated/componentRulesTable.ts",
);
let text = readFileSync(file, "utf8");

/** A field box's border · outline · quiet underline (Input — `isFocused`; DateInput — `isFocusWithin`). */
function fieldBoxTree(focus: "isFocused" | "isFocusWithin"): string {
  return `
        // ADR-297 Phase 3c — the box's own states (was \`rootSelectors\` \`&[data-*]\`). Order = priority: invalid,
        //   then hover (it beat invalid by specificity), then focus (invalid wins inside it), quiet last.
        background: { isQuiet: "transparent" },
        borderColor: {
          isInvalid: "var(--negative)",
          isHovered: "var(--border-hover)",
          ${focus}: { default: "var(--accent-content)", isInvalid: "var(--negative)" },
          isQuiet: "transparent",
        },
        boxShadow: { isQuiet: "none" },
        borderRadius: { isQuiet: "0" },
        borderBottom: { isQuiet: "1px solid var(--border)" },
        borderBottomColor: {
          isQuiet: {
            isInvalid: "var(--negative)",
            isHovered: "var(--border-hover)",
            ${focus}: { default: "var(--accent-content)", isInvalid: "var(--negative)" },
          },
        },
        outline: {
          ${focus}: {
            default: "2px solid var(--accent-content)",
            isInvalid: "2px solid var(--negative)",
          },
          isQuiet: { ${focus}: "none" },
        },
        outlineOffset: { ${focus}: "-1px" },`;
}

interface Move {
  /** `&` keys whose `styles` move into the tree (an entry with `nested` keeps them). */
  readonly keys: readonly string[];
  /** The tree entries appended to the rule's `stateStyles` (TS source). */
  readonly tree: string;
}
const MOVES: Readonly<Record<string, Move>> = {
  Input: {
    keys: [
      "&:is(:-webkit-autofill, :-webkit-autofill:hover, :-webkit-autofill:focus)",
      "&[data-hovered]:not([data-focused], [data-focus-within]):not([data-disabled])",
      "&:is([data-focused], [data-focus-within])",
      "&[data-invalid]",
      "&[data-invalid]:is([data-focused], [data-focus-within])",
      "&[data-quiet]",
      "&[data-quiet][data-hovered]:not([data-focused], [data-focus-within]):not([data-disabled])",
      "&[data-quiet]:is([data-focused], [data-focus-within])",
      "&[data-quiet][data-invalid]",
    ],
    tree: `${fieldBoxTree("isFocused")}
        // (the browser's autofill paint — kept to the field colors)
        WebkitTextFillColor: { isAutofilled: "var(--fg) !important" },
        WebkitBoxShadow: {
          isAutofilled: "0 0 0 1000px var(--bg-inset) inset !important",
        },
        caretColor: { isAutofilled: "var(--fg)" },`,
  },
  DateInput: {
    keys: [
      "&[data-hovered]:not([data-focus-within]):not([data-disabled])",
      "&[data-focus-within]",
      "&[data-invalid]",
      "&[data-invalid][data-focus-within]",
      "&[data-quiet]",
      "&[data-quiet][data-hovered]:not([data-focus-within]):not([data-disabled])",
      "&[data-quiet][data-focus-within]",
      "&[data-quiet][data-invalid]",
    ],
    tree: fieldBoxTree("isFocusWithin"),
  },
  ColorArea: {
    keys: ["&[data-disabled]"],
    tree: `
        // ADR-297 Phase 3c (was \`rootSelectors["&[data-disabled]"]\` — the Canvas reads it too, \`colorControlParts\`)
        background: { isDisabled: "gray !important" },`,
  },
  ColorThumb: {
    keys: ["&[data-focus-visible]"],
    tree: `
        // ADR-297 Phase 3c — the keyboard-focused thumb grows (was \`rootSelectors["&[data-focus-visible]"]\`)
        width: { isFocusVisible: "{length.size.unit*32/1}" },
        height: { isFocusVisible: "{length.size.unit*32/1}" },`,
  },
  Disclosure: {
    keys: ['&[data-quiet="true"]', "&[data-in-group]:not(:last-child)"],
    tree: `
        // ADR-297 Phase 3c — quiet: no top · bottom border; in a group only the last keeps its bottom border
        //   (S2 \`isInGroup\` · \`:last-child\`). The Canvas reads the same tree (\`catalogDisclosureBorders\`).
        borderTopWidth: { isQuiet: "0" },
        borderBottomWidth: { isQuiet: "0", inGroup: "0" },`,
  },
  DropZone: {
    keys: ["&[data-drop-target]"],
    tree: `
        // ADR-297 Phase 3c — a drag over it (was \`rootSelectors["&[data-drop-target]"]\`)
        background: { isDropTarget: "var(--bg-inset)" },
        color: { isDropTarget: "var(--accent-content)" },`,
  },
  Link: {
    keys: ["&[data-hovered]", '&[data-quiet="true"]:not([data-hovered])'],
    tree: `
        // ADR-297 Phase 3c — quiet: no underline until hovered; hover thins it (was \`rootSelectors\`)
        textDecoration: { isQuiet: { default: "none", isHovered: "underline" } },
        textDecorationThickness: { isHovered: "1.5px" },`,
  },
  ListBox: {
    keys: [
      "&[data-catalog-id]:is(.react-aria-Popover *)",
      '&[data-catalog-id][data-size="XS"]:is(.react-aria-Popover *)',
      '&[data-catalog-id][data-size="S"]:is(.react-aria-Popover *)',
      '&[data-catalog-id][data-size="L"]:is(.react-aria-Popover *)',
      '&[data-catalog-id][data-size="XL"]:is(.react-aria-Popover *)',
      "&:is(.react-aria-Popover *)[data-empty]",
      "&:is(.react-aria-Popover *)",
    ],
    tree: `
        // ADR-297 Phase 3c — a picker's list in its Popover (the RAC reference \`.dropdown-listbox\` — was
        //   \`rootSelectors["&:is(.react-aria-Popover *)"]\`): no box of its own; an empty one keeps a row.
        display: { inPopover: "block" },
        border: { inPopover: "none" },
        padding: {
          inPopover: { default: "var(--spacing-xs)", isEmpty: "var(--spacing-sm)" },
        },
        background: { inPopover: "transparent" },
        borderRadius: { inPopover: "inherit" },
        minHeight: { inPopover: { isEmpty: "var(--spacing-2xl)" } },
        // (a document node's option row height — the Builder's own pickers keep theirs, \`ListBox.css\`)
        "--lb-control-h": {
          inPopover: {
            isCatalogNode: {
              default: "var(--catalog-token-size-height-M)",
              size: {
                XS: "var(--catalog-token-size-height-XS)",
                S: "var(--catalog-token-size-height-S)",
                L: "var(--catalog-token-size-height-L)",
                XL: "var(--catalog-token-size-height-XL)",
              },
            },
          },
        },`,
  },
  MenuItem: {
    keys: ["&[href]"],
    tree: `
        // ADR-297 Phase 3c — a link item (RAC's \`<a>\`) keeps the item's text look (was \`rootSelectors["&[href]"]\`)
        textDecoration: { isLink: "none" },
        color: { isLink: "inherit" },`,
  },
  Tab: {
    keys: ["&[href]"],
    tree: `
        // ADR-259 Phase 1 (R4) · ADR-297 Phase 3c: a link Tab is RAC's \`<a>\` — no browser link underline
        textDecoration: { isLink: "none" },`,
  },
  Modal: {
    keys: ["&[data-dialog-trigger]"],
    tree: `
        // ADR-297 Phase 3c — a DialogTrigger's Modal (was \`rootSelectors["&[data-dialog-trigger]"]\`)
        position: { isDialogTrigger: "relative" },
        maxHeight: { isDialogTrigger: "90vh" },`,
  },
  Toast: {
    keys: ["&[data-variant]", '&[data-variant="neutral"]'],
    tree: "", // (built from the rule's variant names below)
  },
};

const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const nameOf = (prop: ts.ObjectLiteralElementLike) =>
  prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
    ? prop.name.text
    : undefined;
const propOf = (obj: ts.ObjectLiteralExpression, name: string) =>
  obj.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && nameOf(p) === name,
  );

let tableObject: ts.ObjectLiteralExpression | undefined;
source.forEachChild(function find(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "COMPONENT_RULES_TABLE" &&
    node.initializer &&
    ts.isObjectLiteralExpression(node.initializer)
  )
    tableObject = node.initializer;
  else node.forEachChild(find);
});
if (!tableObject) throw new Error("COMPONENT_RULES_TABLE literal not found");

const edits: { start: number; end: number; text: string }[] = [];
const report: string[] = [];
/** Remove a property (with its leading comments and trailing comma). */
function removeProperty(prop: ts.ObjectLiteralElementLike) {
  const after = text.slice(prop.getEnd()).match(/^\s*,/)?.[0] ?? "";
  edits.push({
    start: prop.getFullStart(),
    end: prop.getEnd() + after.length,
    text: "",
  });
}

for (const ruleProp of tableObject.properties) {
  const type = nameOf(ruleProp);
  const move = type ? MOVES[type] : undefined;
  if (!type || !move || !ts.isPropertyAssignment(ruleProp)) continue;
  const rule = ruleProp.initializer as ts.ObjectLiteralExpression;
  const structure = propOf(rule, "structure")!
    .initializer as ts.ObjectLiteralExpression;
  const composition = propOf(structure, "composition")!
    .initializer as ts.ObjectLiteralExpression;
  const selectorsProp = propOf(composition, "rootSelectors")!;
  let tree = move.tree;
  if (type === "Toast") {
    const variants = propOf(rule, "variants")!
      .initializer as ts.ObjectLiteralExpression;
    const names = variants.properties.map(nameOf).filter(Boolean) as string[];
    const selectors = selectorsProp.initializer as ts.ObjectLiteralExpression;
    const styles = (key: string) => {
      const entry = propOf(selectors, key)!
        .initializer as ts.ObjectLiteralExpression;
      return (
        propOf(entry, "styles")!.initializer as ts.ObjectLiteralExpression
      ).properties[0] as ts.PropertyAssignment;
    };
    const padding = styles("&[data-variant]").initializer.getText();
    const neutralLeft = styles(
      '&[data-variant="neutral"]',
    ).initializer.getText();
    tree = `
        // ADR-297 Phase 3c — every variant's padding (was \`rootSelectors["&[data-variant]"]\` — a Toast always
        //   carries one), the neutral one with no icon starts closer (was \`&[data-variant="neutral"]\`).
        padding: {
          variant: {
${names.map((name) => `            ${/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)}: ${padding},`).join("\n")}
          },
        },
        paddingLeft: { variant: { neutral: ${neutralLeft} } },`;
  }
  if (ts.isIdentifier(selectorsProp.initializer)) {
    // (Button — the whole map is the field-button corners)
    removeProperty(selectorsProp);
    report.push(
      `${type}: rootSelectors ${selectorsProp.initializer.text} removed`,
    );
  } else {
    const selectors = selectorsProp.initializer as ts.ObjectLiteralExpression;
    for (const key of move.keys) {
      const entryProp = propOf(selectors, key);
      if (!entryProp) throw new Error(`${type}: no rootSelectors key ${key}`);
      const entry = entryProp.initializer as ts.ObjectLiteralExpression;
      const nested = propOf(entry, "nested");
      if (nested) removeProperty(propOf(entry, "styles")!);
      else removeProperty(entryProp);
    }
    report.push(`${type}: ${move.keys.length} keys`);
  }
  const stateProp = propOf(structure, "stateStyles");
  if (stateProp) {
    const obj = stateProp.initializer as ts.ObjectLiteralExpression;
    edits.push({
      start: obj.getEnd() - 1,
      end: obj.getEnd() - 1,
      text: `${tree.replace(/^\n/, "")}\n      `,
    });
  } else {
    const last = structure.properties[structure.properties.length - 1]!;
    const at =
      last.getEnd() +
      (text.slice(last.getEnd()).match(/^\s*,/)?.[0].length ?? 0);
    edits.push({
      start: at,
      end: at,
      text: `\n      stateStyles: {${tree}\n      },`,
    });
  }
}

// Button: the field-button corners join its state tree (`FIELD_BUTTON_CORNER_STATE`) — its
//   `rootSelectors: FIELD_BUTTON_CORNER_SELECTORS` line was removed by hand (2026-11-01, the one Button run).
const buttonState = /(\n  Button: \{[\s\S]*?\n      stateStyles: \{\n)/;
for (const edit of edits.sort((a, b) => b.start - a.start))
  text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
text = text.replace(
  /const FIELD_BUTTON_CORNER_SELECTORS = Object\.fromEntries\([\s\S]*?\n\);\n/,
  `/** ADR-297 Phase 3c — the field-button corners as the Button's state tree (value condition \`fieldButton\` —
 *  the DOM's \`data-field-button\`; the Canvas reads \`containerVariants["field-button"]\` of the same table). */
const FIELD_BUTTON_CORNER_STATE = {
  borderRadius: { fieldButton: { ...FIELD_BUTTON_CORNERS } },
  borderWidth: {
    fieldButton: Object.fromEntries(
      Object.keys(FIELD_BUTTON_CORNERS).map((size) => [size, "0"]),
    ),
  },
} as const;
`,
);
if (!buttonState.test(text)) throw new Error("Button stateStyles not found");
text = text.replace(buttonState, "$1        ...FIELD_BUTTON_CORNER_STATE,\n");
if (!dry) writeFileSync(file, text);
console.log(JSON.stringify({ report, dry }, null, 2));
// (2026-11-01 이 스크립트 실행 뒤 표에서 손으로: outline 의 invalid 를 outlineColor 로 · borderColor 순서 hover → invalid (3h #6).)
