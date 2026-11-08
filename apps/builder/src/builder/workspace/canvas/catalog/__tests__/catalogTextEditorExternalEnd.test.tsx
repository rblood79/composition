import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeId,
  RichText,
} from "../../../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../../../packages/shared/src/catalog/commands";
import { CatalogTextEditor } from "../CatalogTextEditor";
// ADR-299 — these cases read the field before the ProseMirror chunk (the lazy editor) arrives: the
// textarea the edit opens with. The chunk is held pending (its own tests: tests/text-edit).
vi.mock(
  "../textEditor/EditorField",
  () => new Promise(() => undefined),
);
import { newCatalogProjectDocument } from "../../../../catalogRuntime/project";
import { CatalogStorage } from "../../../../catalogRuntime/storage";
import { CatalogWorkspace } from "../../../../catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../../catalogRuntime/__tests__/support/nodeLayoutEngine";
import { requestCanvasFrame } from "../../skia/frameScheduler";

const subscriptions = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../skia/frameScheduler", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../skia/frameScheduler")>();
  return {
    ...actual,
    subscribeCanvasFrames: (listener: () => void) => {
      subscriptions.count += 1;
      return actual.subscribeCanvasFrames(listener);
    },
  };
});

/**
 * 2026-10-05 감사 LOW — 편집이 밖에서 끝나도 (선택 전환 · reconcile) 입력한 글은 저장되고, 카메라
 * 추적 구독은 프레임마다 다시 붙지 않는다.
 */
const PROJECT = "project:project:text" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const HEADING = "project:node:title" as NodeId;
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:t${++next}` as EntryId<K>;
};

async function open(value: string | RichText = "Hello") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Text" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: HEADING,
          definitionId: "lib:definition:heading",
          children: [],
          props: { children: { kind: "set", value } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [HEADING],
      newId: allocator(),
    }),
  );
  const record = workspace.root.recordsOfSource(HEADING)[0];
  const box = { x: 10, y: 20, width: 200, height: 40 };
  const view = render(
    <CatalogTextEditor workspace={workspace} boundsOf={() => box} />,
  );
  const field = () =>
    view.queryByTestId("catalog-text-editor") as HTMLTextAreaElement | null;
  const text = () => {
    const entry = workspace.runtime.graph.getEntry(HEADING);
    return entry?.kind === "node" ? entry.props.children : undefined;
  };
  return { workspace, record, field, text };
}

describe("CatalogTextEditor — 외부 종료 · 프레임 구독", () => {
  it("첫 chunk 대기 중에도 줄별 서식을 표시하고 종료 시 원본을 보존한다", async () => {
    const value: RichText = {
      kind: "text",
      runs: [
        { text: "first\n" },
        { text: "BIG", marks: { fontSize: 64, fontWeight: 700 } },
        { text: "\nsmall", marks: { fontSize: 24, fontStyle: "italic" } },
      ],
    };
    const { workspace, record, field, text } = await open(value);
    const revision = workspace.runtime.graph.revision;
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    const pending = field()!;
    expect(pending.tagName).toBe("DIV");
    expect(pending.getAttribute("aria-busy")).toBe("true");
    expect(pending.getAttribute("aria-readonly")).toBe("true");
    expect(pending.textContent).toBe("first\nBIG\nsmall");
    expect(pending.querySelector<HTMLElement>('[data-text-run="1"]')?.style.fontSize).toBe("64px");
    expect(pending.querySelector<HTMLElement>('[data-text-run="2"]')?.style.fontSize).toBe("24px");
    const globalKey = vi.fn();
    document.addEventListener("keydown", globalKey);
    fireEvent.keyDown(pending, { key: "Backspace" });
    document.removeEventListener("keydown", globalKey);
    expect(globalKey).not.toHaveBeenCalled();
    fireEvent.keyDown(pending, { key: "Escape" });
    expect(field()).toBeNull();
    expect(text()).toEqual({ kind: "set", value });
    expect(workspace.runtime.graph.revision).toBe(revision);
  });

  it("편집이 밖에서 끝나면 입력한 글을 한 단계로 저장한다", async () => {
    const { workspace, record, field, text } = await open();
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    fireEvent.change(field()!, { target: { value: "Changed" } });
    act(() => workspace.session.endTextEdit());
    expect(field()).toBeNull();
    expect(text()).toEqual({ kind: "set", value: "Changed" });
  });

  it("카메라 프레임마다 구독을 다시 붙이지 않는다", async () => {
    const { workspace, record } = await open();
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    const before = subscriptions.count;
    act(() => {
      for (let i = 0; i < 5; i++) requestCanvasFrame();
    });
    expect(subscriptions.count - before).toBe(0);
  });
});

/**
 * 2026-10-20 사용자 보고 — "button 컴포넌트 더블클릭으로 편집 시 텍스트 위치에서 편집되지 않고 버튼
 * 영역 전체에서 된다". 편집 상자는 요소 상자가 아니라 Skia 가 글자를 그린 content 상자 (padding
 * 안 · 글자 줄 높이 · 정렬 · 글꼴) 에 놓인다.
 */
describe("CatalogTextEditor — 글자 상자 배치", () => {
  it("Skia 글자 노드의 padding · 정렬 · 글꼴을 따라 편집 상자를 놓는다", async () => {
    const { workspace, record, field } = await open();
    const item = workspace.itemOfRecord(record)!;
    const { registerSkiaNode, unregisterSkiaNode } =
      await import("../../skia/useSkiaNode");
    registerSkiaNode(item.identity, {
      type: "box",
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      visible: true,
      children: [
        {
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          visible: true,
          text: {
            content: "Hello",
            fontFamilies: ["Pretendard"],
            fontSize: 14,
            fontWeight: 700,
            color: new Float32Array([0, 0, 0, 1]),
            align: "center",
            lineHeight: 18,
            paddingLeft: 16,
            paddingTop: 11,
            paddingBottom: 11,
            maxWidth: 168,
          },
        },
      ],
    });
    try {
      act(() => workspace.session.startTextEdit(item));
      const style = field()!.style;
      expect([style.left, style.top, style.width, style.height]).toEqual([
        "26px",
        "31px",
        "168px",
        "18px",
      ]);
      expect(style.textAlign).toBe("center");
      expect(style.fontSize).toBe("14px");
      expect(style.fontWeight).toBe("700");
      expect(Number(style.lineHeight)).toBeCloseTo(18 / 14);
    } finally {
      unregisterSkiaNode(item.identity);
    }
  });

  it("verticalAlign middle (Button) 은 글자 줄을 상자 세로 중앙에 둔다", async () => {
    const { workspace, record, field } = await open();
    const item = workspace.itemOfRecord(record)!;
    const { registerSkiaNode, unregisterSkiaNode } =
      await import("../../skia/useSkiaNode");
    // `canvasBinding.ts` `bindings.button`: paddingTop = box inset, no paddingBottom, middle.
    registerSkiaNode(item.identity, {
      type: "box",
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      visible: true,
      children: [
        {
          type: "text",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          visible: true,
          text: {
            content: "Button",
            fontFamilies: ["Pretendard"],
            fontSize: 14,
            color: new Float32Array([1, 1, 1, 1]),
            align: "center",
            lineHeight: 20,
            paddingLeft: 12,
            paddingTop: 5,
            maxWidth: 176,
            verticalAlign: "middle",
            whiteSpace: "nowrap",
          },
        },
      ],
    });
    try {
      act(() => workspace.session.startTextEdit(item));
      const style = field()!.style;
      expect([style.left, style.top, style.width, style.height]).toEqual([
        "22px",
        "30px",
        "176px",
        "20px",
      ]);
      // Laid out on one line like Skia's nowrap — a typed line break stays visible.
      expect(style.whiteSpace).toBe("pre");
      // The drawn label's color (white on the primary button), not the record's box color.
      expect(style.color).toBe("rgb(255, 255, 255)");
      // One screen pixel like the selection box — the field is scaled by the zoom (zoom 1 here).
      // A shadow spread, not an outline: Chrome snaps outline-width before the transform.
      expect(style.outline).toBe("none");
      expect(style.boxShadow).toContain("0 0 0 1px");
      // The glyph variants Skia draws with (`DEFAULT_FONT_FEATURES` — Pretendard cv11 is the
      // single-storey a) and the Preview's body sets: without them the edit showed another "a".
      expect(field()!.getAttribute("style")).toContain(
        'font-feature-settings: "cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1',
      );
    } finally {
      unregisterSkiaNode(item.identity);
    }
  });

  it("Skia 가 그리는 글자 설정을 편집 상자도 전부 쓴다 (기울임 · 간격 · 장식 · 줄바꿈 · 들여쓰기 · variant · stretch · 그림자)", async () => {
    const { workspace, record, field } = await open();
    const item = workspace.itemOfRecord(record)!;
    const { registerSkiaNode, unregisterSkiaNode } =
      await import("../../skia/useSkiaNode");
    registerSkiaNode(item.identity, {
      type: "text",
      x: 0,
      y: 0,
      width: 200,
      height: 20,
      visible: true,
      text: {
        content: "Styled",
        fontFamilies: ["Pretendard"],
        fontSize: 16,
        fontWeight: 600,
        fontStyle: 1,
        color: new Float32Array([0, 0, 0, 1]),
        letterSpacing: 2,
        wordSpacing: 4,
        lineHeight: 20,
        decoration: 1 | 4,
        decorationStyle: "dashed",
        decorationColor: new Float32Array([1, 0, 0, 1]),
        paddingLeft: 0,
        paddingTop: 0,
        maxWidth: 200,
        whiteSpace: "pre-wrap",
        wordBreak: "keep-all",
        overflowWrap: "anywhere",
        textIndent: 8,
        fontVariant: "small-caps",
        textShadows: [
          {
            offsetX: 1,
            offsetY: 2,
            sigma: 1,
            color: new Float32Array([0, 0, 1, 0.5]),
          },
        ],
      },
    });
    try {
      act(() => workspace.session.startTextEdit(item));
      const style = field()!.style;
      expect(style.fontStyle).toBe("italic");
      expect(style.letterSpacing).toBe("2px");
      expect(style.wordSpacing).toBe("4px");
      expect(style.textDecorationLine).toBe("underline line-through");
      expect(style.textDecorationStyle).toBe("dashed");
      expect(style.textDecorationColor).toBe("rgb(255, 0, 0)");
      expect(style.wordBreak).toBe("keep-all");
      expect(style.overflowWrap).toBe("anywhere");
      expect(style.textIndent).toBe("8px");
      expect(style.fontVariant).toBe("small-caps");
      expect(field()!.getAttribute("style")).toContain(
        "text-shadow: 1px 2px 2.355px rgba(0, 0, 255, 0.5)",
      );
    } finally {
      unregisterSkiaNode(item.identity);
    }
  });

  it("루트 글자 노드의 x · y (부모 기준 layout rect) 는 더하지 않는다 — 옮긴 Button", async () => {
    const { workspace, record, field } = await open();
    const item = workspace.itemOfRecord(record)!;
    const { registerSkiaNode, unregisterSkiaNode } =
      await import("../../skia/useSkiaNode");
    // `canvasBinding.ts` `bindings.text` = `box(node, rect)` + text: the root node itself holds
    // the text, and its x · y are the layout rect (absolute x 100 / y 50 — the user's report).
    registerSkiaNode(item.identity, {
      type: "text",
      x: 100,
      y: 50,
      width: 200,
      height: 40,
      visible: true,
      text: {
        content: "Button",
        fontFamilies: ["Pretendard"],
        fontSize: 14,
        color: new Float32Array([0, 0, 0, 1]),
        align: "center",
        lineHeight: 20,
        paddingLeft: 12,
        paddingTop: 5,
        maxWidth: 176,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      },
    });
    try {
      act(() => workspace.session.startTextEdit(item));
      const style = field()!.style;
      // box (10, 20) + paddingLeft 12 · (40 − 20) / 2 — not + (100, 50).
      expect([style.left, style.top]).toEqual(["22px", "30px"]);
    } finally {
      unregisterSkiaNode(item.identity);
    }
  });

  it("Skia 글자 노드가 없으면 요소 상자 그대로다", async () => {
    const { workspace, record, field } = await open();
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    const style = field()!.style;
    expect([style.left, style.top, style.width, style.height]).toEqual([
      "10px",
      "20px",
      "200px",
      "40px",
    ]);
  });
});

/**
 * 2026-10-20 사용자 보고 — "버튼의 경우 엔터키로 줄바꿈시 버튼의 height 가 반영되지 않는다". 미리보기도
 * 확정 (`committedWhiteSpace`) 과 같이 줄바꿈이 접히는 white-space 를 올린다 — nowrap · normal 레이아웃은
 * `\n` 을 공백으로 접어 상자가 자라지 않았다.
 */
describe("CatalogTextEditor — 줄바꿈 미리보기", () => {
  it("입력한 줄바꿈이 접히는 white-space 면 미리보기에 올린 값을 같이 보낸다", async () => {
    const { workspace, record, field } = await open();
    const spy = vi.spyOn(workspace.root, "previewRecord");
    const item = workspace.itemOfRecord(record)!;
    act(() => workspace.session.startTextEdit(item));
    fireEvent.change(field()!, { target: { value: "Hel\nlo" } });
    expect(spy).toHaveBeenLastCalledWith(item.identity, {
      props: { children: "Hel\nlo" },
      visual: { whiteSpace: "pre-wrap" },
    });
    fireEvent.change(field()!, { target: { value: "Hello!" } });
    expect(spy).toHaveBeenLastCalledWith(item.identity, {
      props: { children: "Hello!" },
    });
    spy.mockRestore();
  });
});
