// G5 example 13 — (S2) Card (react-spectrum.adobe.com/Card.md — the breakdown §4 row: CardPreview
// Image · Content (title · description) · Footer Button). Builder: Card original → the Content's
// title · description texts → a Button original in the Footer. The oracle is `@react-spectrum/s2`
// 1.8.0 (a test-only devDependency, Decision 11) mounted by `adr256CardS2.test.tsx` — run it with
// `ADR256_G5_S2_OUT=<file>` and pass the file here as `ADR256_G5_S2=<file>` (the dev server does not
// pre-bundle S2, so the Preview frame cannot import it).
// Named difference: the S2 Button wraps its label in a `Text` span; ours is the RAC Button (D1 —
// its label is the button's text).
import { readFileSync } from "node:fs";
import { edit, place, reopen } from "./harness.mjs";
import { compareCase, main, tree } from "./helpers-c.mjs";

export async function run(page, errors = []) {
  const edits = [];
  const C = await place(page, "lib:definition:origin-component-card");
  edits.push(
    await edit(page, (c, ws, h, C) => {
      const card = h.bySource(C);
      const texts = h.within(card.id, "Text");
      const footer = h.within(card.id, "Footer")[0];
      return [
        h.props(texts.find((t) => t.props.slot === "title").id, { children: "Command + R" }),
        h.props(texts.find((t) => t.props.slot === "description").id, { children: "Your all-in-one shortcut for apps, automations, and devices." }),
        h.insert(footer.id, [h.node(h.newId(), "lib:definition:type-Button", { children: "Buy now", variant: "primary" })]),
      ];
    }, C),
  );
  const reopened = await reopen(page);
  const atDefault = await tree(page, C);
  const reference = readFileSync(process.env.ADR256_G5_S2, "utf8");
  const out = [
    await compareCase(page, C, "default (S2 mounted)", { html: reference }, {
      full: true,
      // (The S2 Button's label span — our RAC Button's text is its own.)
      known: [["(<button[^>]*>)([^<]+)(</button>)", "$1<span>$2</span>$3"]],
    }),
  ];
  return { edits, reopened, out, atDefault };
}

if (import.meta.url === `file://${process.argv[1]}`) await main("ex13", run);
