/**
 * ADR-299 G0 (a) — 한글 IME 조합이 ProseMirror `EditorView` 안에서 끊기지 않는가.
 *
 * 편집 상자의 모양을 그대로 흉내 낸다: absolute · `transform: scale(zoom)` 상자 안에 plain schema
 * (`doc(inline*)` = text + hard_break) 의 `EditorView` 를 두고, `dispatchTransaction` 마다 글자를
 * 꺼내 「preview」 (지금 `previewRecord` 가 하는 일 — 문서 쓰기 0, 상자가 글자를 따라 커진다) 를
 * 부른다. preview 는 상자 style 의 width · height · top 을 바꾼다 (hugging box · middle 정렬이
 * 위아래로 자란다 — `CatalogTextEditor.tsx` `fieldY`).
 *
 * 조합 입력:
 * - chromium: CDP `Input.imeSetComposition` · `Input.insertText` — Blink 의 실제 IME 경로
 *   (렌더러가 composition 이벤트 · DOM 변경을 직접 낸다).
 * - webkit: Playwright 에 IME API 가 없다 — 브라우저가 내는 순서 (compositionstart → DOM 글자 교체
 *   + input(isComposing) → compositionend) 를 합성한다. native macOS 한글 IME 의 증거가 아니다
 *   (측정 조건 — measurement-validity Q5). native 확인은 G6 live 에 남긴다.
 *
 * oracle: 최종 PM 문서 글자 (= 사용자가 입력한 글자) · 조합 중 preview 호출 기록.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cdp as vitestCdp, server } from "vitest/browser";
import { Schema, type Node as PMNode } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";

const schema = new Schema({
  nodes: {
    doc: { content: "inline*" },
    text: { group: "inline" },
    hard_break: {
      group: "inline",
      inline: true,
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
  },
});

const plain = (doc: PMNode) => {
  let text = "";
  doc.forEach((node) => {
    text += node.isText ? node.text : "\n";
  });
  return text;
};

interface Harness {
  view: EditorView;
  box: HTMLDivElement;
  previews: { text: string; composing: boolean }[];
  commits: string[];
  destroy(): void;
}

/**
 * `resync` = 대조 arm: a re-render that replaces the edited text's DOM nodes on every change (what
 * a React-owned `children` round trip does — rebuilding the PM state from the same text does not
 * touch the DOM, so it is not a control). The harness must catch that breaking composition —
 * otherwise its PASS says nothing.
 */
function mount(initial: string, zoom = 2, resync = false): Harness {
  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "absolute",
    left: "40px",
    top: "120px",
    width: "24px",
    height: "20px",
    transform: `scale(${zoom})`,
    transformOrigin: "0 0",
    fontSize: "16px",
    lineHeight: "20px",
    fontFamily: "Pretendard, system-ui, sans-serif",
    whiteSpace: "pre",
  });
  document.body.append(box);
  const previews: Harness["previews"] = [];
  const commits: string[] = [];
  const harness = {} as Harness;
  const commit = () => {
    commits.push(plain(harness.view.state.doc));
  };
  const state = EditorState.create({
    schema,
    doc: schema.node("doc", null, initial ? [schema.text(initial)] : []),
    plugins: [
      keymap({
        Escape: () => (commit(), true),
        "Mod-Enter": () => (commit(), true),
        Enter: (s, dispatch) => {
          dispatch?.(
            s.tr.replaceSelectionWith(schema.nodes.hard_break.create()),
          );
          return true;
        },
      }),
    ],
  });
  const view = new EditorView(box, {
    state,
    dispatchTransaction(tr) {
      const next = view.state.apply(tr);
      view.updateState(next);
      if (!tr.docChanged) return;
      const text = plain(next.doc);
      previews.push({ text, composing: view.composing });
      if (resync) {
        // A re-render that replaces the text's DOM nodes (same characters, new nodes).
        for (const child of [...view.dom.childNodes])
          if (child.nodeType === Node.TEXT_NODE)
            child.replaceWith(document.createTextNode(child.textContent ?? ""));
      }
      // previewRecord: the hugging box follows the typed text (width · height · middle anchor).
      const content = view.dom as HTMLElement;
      const width = Math.max(24, content.scrollWidth);
      const height = Math.max(20, content.scrollHeight);
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      box.style.top = `${120 - (height - 20)}px`;
    },
  });
  // The editor opens with the caret at the end (tests that replace a selection set their own).
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, view.state.doc.content.size),
    ),
  );
  view.focus();
  Object.assign(harness, {
    view,
    box,
    previews,
    commits,
    destroy() {
      view.destroy();
      box.remove();
    },
  });
  return harness;
}

const browser = server.browser;
/** The Playwright provider's CDP session (vitest types `CDPSession` as an empty interface). */
const cdp = () =>
  vitestCdp() as unknown as {
    send(method: string, params?: object): Promise<unknown>;
  };
const nextFrame = () =>
  new Promise<void>((done) => requestAnimationFrame(() => done()));
const settle = async () => {
  await nextFrame();
  await nextFrame();
};

/** One composed syllable sequence: each step replaces the composition, then the last commits. */
async function compose(h: Harness, steps: readonly string[]) {
  if (browser === "chromium") {
    const session = cdp();
    for (const text of steps) {
      await session.send("Input.imeSetComposition", {
        text,
        selectionStart: text.length,
        selectionEnd: text.length,
      });
      await settle();
    }
    await session.send("Input.insertText", { text: steps.at(-1)! });
    await settle();
    return;
  }
  // webkit — the order WebKit emits for a marked-text IME (compositionstart → replace marked text
  // + input isComposing → compositionend), applied to the DOM like the IME would.
  const dom = h.view.dom as HTMLElement;
  const selection = document.getSelection()!;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) range.deleteContents();
  dom.dispatchEvent(
    new CompositionEvent("compositionstart", { bubbles: true, data: "" }),
  );
  let node: Text;
  let offset: number;
  const anchor = selection.getRangeAt(0);
  if (anchor.startContainer.nodeType === Node.TEXT_NODE) {
    node = anchor.startContainer as Text;
    offset = anchor.startOffset;
  } else {
    node = document.createTextNode("");
    const parent = anchor.startContainer;
    parent.insertBefore(node, parent.childNodes[anchor.startOffset] ?? null);
    offset = 0;
  }
  let marked = "";
  for (const text of steps) {
    dom.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: false,
        inputType: "insertCompositionText",
        data: text,
        isComposing: true,
      }),
    );
    node.replaceData(offset, marked.length, text);
    marked = text;
    const caret = document.createRange();
    caret.setStart(node, offset + text.length);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
    dom.dispatchEvent(
      new CompositionEvent("compositionupdate", { bubbles: true, data: text }),
    );
    dom.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertCompositionText",
        data: text,
        isComposing: true,
      }),
    );
    await settle();
  }
  dom.dispatchEvent(
    new CompositionEvent("compositionend", {
      bubbles: true,
      data: steps.at(-1)!,
    }),
  );
  await settle();
}

async function pressEscape(h: Harness) {
  if (browser === "chromium") {
    await cdp().send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await cdp().send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
  } else {
    h.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        isComposing: h.view.composing,
      }),
    );
  }
  await settle();
}

const HAN = ["ㅎ", "하", "한"];
const GEUL = ["ㄱ", "그", "글"];
const DWAET = ["ㄷ", "돠", "돼", "됐"];
const DA = ["ㄷ", "다"];

let current: Harness | undefined;
afterEach(() => {
  current?.destroy();
  current = undefined;
});

describe(`ADR-299 G0 (a) IME 조합 — ${browser}`, () => {
  it("측정 조건", () => {
    // Recorded in the run output (breakdown §6.1).
    console.info(
      `[adr299-g0] ${browser} · ${navigator.userAgent} · visibility=${document.visibilityState} · DPR=${devicePixelRatio}`,
    );
    expect(document.visibilityState).toBe("visible");
  });

  it("「한글」 — 조합 중 상자가 자라도 글자 하나씩 들어온다", async () => {
    const h = (current = mount("Hello "));
    await compose(h, HAN);
    await compose(h, GEUL);
    expect(plain(h.view.state.doc)).toBe("Hello 한글");
    expect(h.view.composing).toBe(false);
    // The box followed the text (the preview ran) and ended on the committed text.
    expect(h.previews.at(-1)?.text).toBe("Hello 한글");
    expect(parseFloat(h.box.style.width)).toBeGreaterThan(24);
    console.info(
      `[adr299-g0] ${browser} 한글 previews=${h.previews.length} composing=${h.previews.filter((p) => p.composing).length}`,
    );
  });

  it("「됐다」 — 받침 · 이중 모음 조합", async () => {
    const h = (current = mount(""));
    await compose(h, DWAET);
    await compose(h, DA);
    expect(plain(h.view.state.doc)).toBe("됐다");
  });

  it("전체 선택 위의 조합은 선택을 바꾼다 (편집 상자는 열 때 전체 선택)", async () => {
    const h = (current = mount("Hello"));
    h.view.dispatch(
      h.view.state.tr.setSelection(
        TextSelection.create(
          h.view.state.doc,
          0,
          h.view.state.doc.content.size,
        ),
      ),
    );
    await settle();
    await compose(h, HAN);
    expect(plain(h.view.state.doc)).toBe("한");
  });

  it("줄바꿈 뒤 조합 (hard_break · 상자 높이가 자람)", async () => {
    const h = (current = mount("가"));
    h.view.dispatch(
      h.view.state.tr.replaceSelectionWith(schema.nodes.hard_break.create()),
    );
    await settle();
    await compose(h, HAN);
    expect(plain(h.view.state.doc)).toBe("가\n한");
    expect(parseFloat(h.box.style.height)).toBeGreaterThan(20);
  });

  it("조합 중 Escape — 조합한 글자를 잃지 않는다", async () => {
    const h = (current = mount("가"));
    if (browser === "chromium") {
      await cdp().send("Input.imeSetComposition", {
        text: "하",
        selectionStart: 1,
        selectionEnd: 1,
      });
      await settle();
      await pressEscape(h);
      // The IME (not the page) decides what Escape does to the marked text; the page must keep
      // what reached the document either way.
      await cdp().send("Input.insertText", { text: "하" });
      await settle();
    } else {
      // Marked text, Escape while composing, then the IME commits it.
      const dom = h.view.dom as HTMLElement;
      dom.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true, data: "" }),
      );
      const text = dom.firstChild as Text;
      text.appendData("하");
      dom.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertCompositionText",
          data: "하",
          isComposing: true,
        }),
      );
      await settle();
      await pressEscape(h);
      dom.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "하" }),
      );
      await settle();
    }
    const final = plain(h.view.state.doc);
    console.info(
      `[adr299-g0] ${browser} escape commits=${JSON.stringify(h.commits)} final=${final}`,
    );
    expect(final).toBe("가하");
    // A commit fired while composing must carry the composed syllable (no 「가」 alone).
    for (const committed of h.commits) expect(committed).toBe("가하");
  });

  it("대조 arm — 매 입력마다 글자 DOM 노드를 바꾸면 조합이 깨진다 (하니스 감도)", async () => {
    const h = (current = mount("Hello ", 2, true));
    await compose(h, HAN);
    await compose(h, GEUL);
    const final = plain(h.view.state.doc);
    console.info(`[adr299-g0] ${browser} resync arm final=${JSON.stringify(final)}`);
    expect(final).not.toBe("Hello 한글");
  });
});
