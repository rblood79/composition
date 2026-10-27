/**
 * ADR-285 G4 — the Data panel's actions the code view's snippets run, handed over by the module that
 * owns them (`viewAuthoring.ts` registers itself when it loads — it is in the Builder's main chunk).
 * The 「코드」 panel is a lazy chunk: importing `viewAuthoring` from it (statically or by
 * `import()`) split that module out of the main chunk into a shared one (+2.5 KB initial gzip,
 * 2026-10-27 measurement). Reading the actions here keeps the main chunk as it is.
 */
import type * as ViewAuthoring from "./viewAuthoring";

export type CodeViewActions = Pick<
  typeof ViewAuthoring,
  | "catalogFieldValues"
  | "catalogFilterCommand"
  | "catalogResultCountCommand"
  | "catalogSortFollowCommand"
>;

let registered: CodeViewActions | undefined;

export function registerCodeViewActions(actions: CodeViewActions): void {
  registered = actions;
}

/** The actions (undefined until their module has loaded — no snippet then). */
export function codeViewActions(): CodeViewActions | undefined {
  return registered;
}
