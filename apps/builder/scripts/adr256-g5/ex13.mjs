// G5 example 13 — (S2) ProductCard (react-spectrum.adobe.com/Card.md L112-131): `ProductCard >
// CardPreview > Image[preview] + Image[thumbnail] + Content > (Text[title] + Text[description]) +
// Footer > Button[primary]`. Builder: Card original → the Content's title · description texts → a
// Button original in the Footer. The oracle (`@react-spectrum/s2` mounted — a test-only
// devDependency per Decision 11) is not installed in this repository: the reference below is the S2
// tree written by hand (each S2 section a `div`, S2 `Text` a `span`, as adr256CardS2.test.tsx encodes
// it) — not an independent oracle. ProductCard's `Image slot="thumbnail"` has no Card slot here.
import { edit, place, reopen } from "./harness.mjs";
import { compareCase, KNOWN, main, tree } from "./helpers-c.mjs";

const HAND_S2 = `<div><div><img alt=""></div><div><span slot="title">Command + R</span><span slot="description">Your all-in-one shortcut for apps, automations, and devices.</span></div><div><button type="button">Buy now</button></div></div>`;

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
  const out = [await compareCase(page, C, "default (hand-written S2 tree)", { html: HAND_S2 }, { full: true, known: [KNOWN.image] })];
  return { edits, reopened, out, atDefault };
}

if (import.meta.url === `file://${process.argv[1]}`) await main("ex13", run);
