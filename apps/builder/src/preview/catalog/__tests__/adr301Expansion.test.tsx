import { afterEach, describe, expect, it, vi } from "vitest";
import { PALETTE_REUSABLE_ORIGIN_TYPES } from "../../../../../../packages/shared/src/catalog/componentCatalog";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import {
  parseCodeView,
  type CodeViewElement,
} from "../../../../../../packages/shared/src/codeView/inverse/parse";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import { createComponent } from "../../../../../../packages/shared/src/catalog/commands";
import {
  BODY,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-301 Phase 1 (G1) — a trigger · structure Library instance is written as its template tree,
 * in the shape of the reference's use code (`.claude/skills/react-aria/references/components/
 * Popover.md` · `Modal.md` · `Tooltip.md` · `Menu.md` · `PreviewTrigger.md` · `Tabs.md` · `Table.md`,
 * S2 `react-spectrum/references/components/Card.md`): the trigger and the body in the page, the
 * slot's fill in place (`<div className="frame">` — 사용자 결정 7), `<OverlayArrow />` (결정 2), only
 * the values the instance wrote (결정 5). Every other Library instance keeps its one element.
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "src/pages/Home.tsx";

function session(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s;
}
const code = (s: CatalogCodeViewProjectSession, path = HOME) =>
  s.baselines.get(path)?.result.code ?? "";
const anchors = (s: CatalogCodeViewProjectSession, path = HOME) =>
  s.baselines.get(path)?.result.anchors ?? [];

/** The element tree as `Type(children…)` — the reference's shape (values aside). */
function shape(element: CodeViewElement): string {
  const kids = element.children.map(shape);
  return kids.length ? `${element.type}(${kids.join(" ")})` : element.type;
}
function pageShape(text: string): string {
  const parsed = parseCodeView(text);
  return (parsed.jsx?.roots ?? []).map(shape).join(" ");
}

const EXPANDED: Record<string, string> = {
  // Popover.md — `<DialogTrigger><Button/><Popover>…` (the starter's OverlayArrow · content inside).
  Popover:
    "DialogTrigger(Button Popover(OverlayArrow div(Heading Description)))",
  Tooltip: "TooltipTrigger(Button Tooltip(OverlayArrow div(Description)))",
  PreviewTrigger:
    "PreviewTrigger(Button Popover(OverlayArrow div(Heading Description)))",
  // Modal.md — `<DialogTrigger><Button/><Modal><Dialog><Heading slot="title"/>…<Button slot="close"/>`.
  Dialog:
    "DialogTrigger(Button Modal(Dialog(Heading div(Description) DialogFooter(div Button))))",
  // (No RAC Sheet page — Modal's shape: the trigger, then the overlay holding the dialog.)
  Sheet:
    "SheetTrigger(Button SheetOverlay(SheetBackdrop Sheet(SheetContent(Heading div(Description) Button))))",
  // Menu.md — `<MenuTrigger><Button/><Menu>…` (ADR-256 — the Popover is a node of the tree).
  Menu: "MenuTrigger(ActionButton Popover(Menu(MenuItem MenuItem MenuItem IllustratedMessage)))",
  // Tabs.md — `<Tabs><TabList><Tab/>…</TabList><TabPanels><TabPanel/>…`.
  Tabs: "Tabs(TabList(Tab Tab) TabPanels(TabPanel TabPanel))",
  // Table.md — `<Table><TableHeader><Column/>…</TableHeader><TableBody><Row><Cell/>…`.
  Table:
    "Table(TableHeader(Column Column Column) TableBody(Row(Cell Cell Cell)))",
};

describe("ADR-301 G1 — the expanded instances are the reference's use code", () => {
  it.each(Object.entries(EXPANDED))("%s", async (type, expected) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add(type);
    const s = session(h);
    const page = code(s);
    expect(pageShape(page)).toBe(expected);
    // (No `<Slot>` and no `overrides` on the expanded root — its share is at its positions.)
    expect(page).not.toContain("<Slot");
    // Every template position has one `position` anchor — and only those.
    const positions = anchors(s).filter(
      (anchor) => anchor.target.kind === "position",
    );
    const keys = positions.map(
      (anchor) => (anchor.target as { key: string }).key,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(positions.length).toBeGreaterThan(0);
  });

  it("a Card in a CardView is S2's use code (`<Card><CardPreview>…<Content>…<Footer>`)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("CardView");
    expect(pageShape(code(session(h)))).toMatch(
      /^CardView\(Card\(CardPreview\(Image\) Content\(Text Text\) Footer\(Button\)\)/,
    );
  });

  it('the Popover — the RAC names imported, the frame `<div className="frame">`, `<OverlayArrow />`, the Library defaults not written', async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Popover");
    const page = code(session(h));
    expect(page).toMatch(
      /import \{[^}]*\bDialogTrigger\b[^}]*\} from 'react-aria-components'/,
    );
    expect(page).toContain('<OverlayArrow className="overlay-arrow" />');
    expect(page).toContain('<div className="frame">');
    // (사용자 결정 5 — the trigger's 「Open Popover」 · the overlay's placement are the Library's.)
    expect(page).not.toContain("Open Popover");
    expect(page).not.toContain("placement");
    expect(page).toContain('<Popover className="popover">');
  });

  it("an instance's own values are written at the positions that read them (`size` → the overlay)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const popover = h.add("Popover");
    h.declare(popover, { size: "L" });
    const page = code(session(h));
    expect(page).toContain('<Popover size="L" className="popover">');
    expect(page).toMatch(/<DialogTrigger>/);
  });

  it("the rest of the Library instances keep their one element (field wrappers · TagGroup · ActionBar …)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const type of PALETTE_REUSABLE_ORIGIN_TYPES) {
      if (type in EXPANDED || type === "CardView") continue;
      const h = await openAdr296();
      h.add(type);
      const s = session(h);
      expect(
        anchors(s).filter((anchor) => anchor.target.kind === "position"),
        type,
      ).toEqual([]);
    }
  }, 60_000);
});

describe("ADR-301 G1 — strict round trip (the whole code pasted over itself)", () => {
  it("every palette origin placed — no refusal, no command", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const refused: string[] = [];
    for (const type of PALETTE_REUSABLE_ORIGIN_TYPES) {
      const h = await openAdr296();
      h.add(type);
      // (Two of the same origin: their positions never pair across instances.)
      h.add(type);
      const s = session(h);
      const revision = h.graph().revision;
      const result = catalogCodeViewProjectApply(
        h.workspace,
        s,
        [...s.baselines].map(([path, baseline]) => ({
          path,
          edited: baseline.result.code,
          changes: [
            {
              fromA: 0,
              toA: baseline.result.code.length,
              insert: baseline.result.code,
            },
          ],
        })),
      );
      if (result.rejected.length || h.graph().revision !== revision)
        refused.push(
          `${type}: ${JSON.stringify(result.rejected.slice(0, 2))} rev ${h.graph().revision - revision}`,
        );
    }
    expect(refused).toEqual([]);
  }, 120_000);

  it("an unchanged expanded instance applies nothing; a fill's text edit reaches its node", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Popover");
    const s = session(h);
    const page = code(s);
    const edited = page.replace(">Popover Title</Heading>", ">Hello</Heading>");
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      {
        path: HOME,
        edited,
        changes: [{ fromA: 0, toA: page.length, insert: edited }],
      },
    ]);
    expect(result.rejected).toEqual([]);
    expect(code(session(h))).toContain(">Hello</Heading>");
  });

  it("an element added outside the slot is refused (`readOnlyPosition`) — the document unchanged", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Popover");
    const s = session(h);
    const page = code(s);
    const revision = h.graph().revision;
    const edited = page.replace(
      '<OverlayArrow className="overlay-arrow" />',
      '<OverlayArrow className="overlay-arrow" />\n          <Text>Extra</Text>',
    );
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      {
        path: HOME,
        edited,
        changes: [{ fromA: 0, toA: page.length, insert: edited }],
      },
    ]);
    expect(result.rejected.map((line) => line.reason)).toContain(
      "readOnlyPosition",
    );
    expect(h.graph().revision).toBe(revision);
  });
});

describe("ADR-301 G1 — an instance with its own children (판독 HIGH-1)", () => {
  it("keeps its one element (`<Toolbar>…<Text/></Toolbar>`) — pasted over itself, nothing refused", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    // (A Toolbar's root is its slot, so it holds own children; a Card root holds only its parts
    //  since 2026-11-09 — its own content goes into the Content slot.)
    const toolbar = h.add("Toolbar");
    h.add("Text", { children: "Own" }, toolbar as never);
    expect(h.node(toolbar).children).toHaveLength(1);
    const s = session(h);
    const page = code(s);
    expect(page).toContain("<Text>Own</Text>");
    expect(
      anchors(s).filter((anchor) => anchor.target.kind === "position"),
    ).toEqual([]);
    const revision = h.graph().revision;
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      {
        path: HOME,
        edited: page,
        changes: [{ fromA: 0, toA: page.length, insert: page }],
      },
    ]);
    expect(result.rejected).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });
});

describe("ADR-301 G1 — a component file's expanded instance (a template in a template)", () => {
  it("is written as its tree in the component's file; pasted over itself — nothing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const frame = h.add("frame", {}, BODY, "help-box");
    h.add("Popover", {}, frame);
    h.run(
      createComponent({
        id: frame as never,
        name: "HelpBox",
        newId: h.workspace.newId,
      }),
    );
    const s = session(h);
    const file = "src/components/HelpBox.tsx";
    const text = code(s, file);
    expect(pageShape(text)).toBe(
      "div(DialogTrigger(Button Popover(OverlayArrow div(Heading Description))))",
    );
    const revision = h.graph().revision;
    const result = catalogCodeViewProjectApply(
      h.workspace,
      s,
      [...s.baselines].map(([path, baseline]) => ({
        path,
        edited: baseline.result.code,
        changes: [
          {
            fromA: 0,
            toA: baseline.result.code.length,
            insert: baseline.result.code,
          },
        ],
      })),
    );
    expect(result.rejected).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });
});

describe("ADR-301 G1 — a new expanded instance written with its props (판독 round 3 m1)", () => {
  async function insert(line: string) {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Text", { children: "Before" });
    const s = session(h);
    const page = code(s);
    const edited = page.replace(
      "<Text>Before</Text>",
      `<Text>Before</Text>\n      ${line}`,
    );
    expect(edited).not.toBe(page);
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      {
        path: HOME,
        edited,
        changes: [{ fromA: 0, toA: page.length, insert: edited }],
      },
    ]);
    return { h, result };
  }

  it.each([
    ['<Popover size="L" />', '<Popover size="L" className="popover">'],
    ['<Popover size="L" isOpen={true} />', "<DialogTrigger isOpen={true}>"],
  ])("%s — applied, the prop at the position that reads it", async (line, expected) => {
    const { h, result } = await insert(line);
    expect(result.rejected).toEqual([]);
    const after = code(session(h));
    expect(after).toContain(expected);
    expect(after).toContain('<Popover size="L" className="popover">');
  });

  it("a value the positions do not hold is still refused", async () => {
    const { result } = await insert('<Popover nope="x" />');
    expect(result.rejected.length).toBeGreaterThan(0);
  });
});
