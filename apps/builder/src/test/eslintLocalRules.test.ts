// @vitest-environment node
import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import rules from "../../eslint-local-rules/index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

/**
 * The two Zustand rules must reach the stores the builder actually has. They matched only the old
 * single store `useStore`, which ADR-248 deleted, so they checked nothing — a store hook is any
 * `use*` bound to `create(...)`, not a name pattern (`useDesignPanelView`, `useSectionCollapse`).
 */
describe("no-zustand-grouped-selectors", () => {
  tester.run(
    "no-zustand-grouped-selectors",
    rules["no-zustand-grouped-selectors"],
    {
      valid: [
        "const view = useDesignPanelView((s) => s.view);",
        "const items = useSomeHook(() => ({ a: 1 }));",
        "const value = useBuilderUiStore((s) => s.panelWorkspaceLayout);",
      ],
      invalid: [
        {
          // A real store whose name does not end in `Store`.
          code: "const v = useDesignPanelView((s) => ({ view: s.view, setView: s.setView }));",
          errors: [{ messageId: "groupedSelector" }],
        },
        {
          code: "const v = useBuilderUiStore((s) => [s.a, s.b]);",
          errors: [{ messageId: "groupedSelector" }],
        },
        {
          // A store declared in the linted file itself.
          code: 'import { create } from "zustand";\nconst useLocalThing = create(() => ({ a: 1 }));\nconst v = useLocalThing((s) => ({ a: s.a }));',
          errors: [{ messageId: "groupedSelector" }],
        },
        {
          code: "const v = useStore(store, (s) => ({ a: s.a }));",
          errors: [{ messageId: "groupedSelector" }],
        },
      ],
    },
  );
});

describe("no-zustand-use-shallow", () => {
  tester.run("no-zustand-use-shallow", rules["no-zustand-use-shallow"], {
    valid: ["const v = useDataStore((s) => s.collections);"],
    invalid: [
      {
        code: "const v = useDataStore(useShallow((s) => ({ a: s.a })));",
        errors: [{ messageId: "useShallowDetected" }],
      },
      {
        code: "const v = useSectionCollapse(useShallow((s) => [s.x, s.y]));",
        errors: [{ messageId: "useShallowDetected" }],
      },
    ],
  });
});
