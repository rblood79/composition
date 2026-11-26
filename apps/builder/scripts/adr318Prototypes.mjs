// ADR-318 Phase 0 시제품 — breakdown §5.2 · §5.3 의 식 그대로 만든 작은 Resizable (제품 코드가 아니다).
// 판정은 `adr318-phase0-prototypes.mjs` 가 실제 브라우저 (Chrome · WebKit) 의 rAF 간격 · 속성 · 좌표로 한다.
//   p2   끌기 중 두 Panel 의 `style.flexGrow` 직접 쓰기로 프레임이 서는가 (Panel 안 RAC Table 1,000 행
//        — 제품처럼 Virtualizer · 중첩 2 단 · 실행 상태를 읽는 글자 3 개). arm 「frame」 = 실행 상태를
//        rAF 마다 · arm 「end」 = 끌기 끝에만 (대조군)
//   p3   중첩 Group 에서 안쪽 손잡이의 끌기 · 키가 바깥으로 번지는가 · 축과 다른 화살표의 기본 동작 ·
//        Panel 안 iframe 위에서 놓은 끌기가 끝나는가 (가림막 유 · 무)
//   p4   separator 의 이름 · 값을 접근성 트리가 내는가 (VoiceOver 청취는 사용자)
import {
  createElement as h,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { mergeProps, useKeyboard, useMove } from "react-aria";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableLayout,
  Virtualizer,
} from "react-aria-components";

const STEP = 5;
const THICK = 1;

/**
 * §5.3 계산 — 손잡이 `index` 양옆 두 Panel 만 (사용자 결정 4 권고안). 크기는 손잡이를 뺀 자리의 %.
 * 한쪽이 한계에 닿으면 거기서 멈춘다.
 */
export function movePanels(sizes, index, delta, mins, maxs) {
  const a = index;
  const b = index + 1;
  const total = sizes[a] + sizes[b];
  const lo = Math.max(mins[a], total - maxs[b]);
  const hi = Math.min(maxs[a], total - mins[b]);
  const next = Math.min(hi, Math.max(lo, sizes[a] + delta));
  const out = sizes.slice();
  out[a] = next;
  out[b] = total - next;
  return out;
}

/** 시제품의 「실행 상태」 — 미러 변수 구독자 셋이 읽는다 (rAF 또는 끌기 끝에 쓴다). */
function createRuntime() {
  let value = {};
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      value = { ...value, ...next };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function useRuntimeValue(runtime, key) {
  const [, force] = useState(0);
  useEffect(() => runtime.subscribe(() => force((n) => n + 1)), [runtime]);
  return runtime.get()[key];
}

function Handle({ group, index, orientation, options }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [resizing, setResizing] = useState(false);
  const axisX = orientation === "horizontal";
  const apply = (sizes) => {
    group.sizes = sizes;
    group.panels.forEach((el, i) => {
      if (el) el.style.flexGrow = String(sizes[i]);
    });
    const el = ref.current;
    if (el) el.setAttribute("aria-valuenow", String(Math.round(sizes[index])));
    window.__writes = (window.__writes ?? 0) + 1;
    if (options.arm === "frame") {
      if (!group.frame)
        group.frame = requestAnimationFrame(() => {
          group.frame = 0;
          options.runtime.set({ [group.id]: group.sizes.slice() });
        });
    }
  };
  const end = () => {
    if (group.frame) cancelAnimationFrame(group.frame);
    group.frame = 0;
    options.runtime.set({ [group.id]: group.sizes.slice() });
  };
  const { moveProps } = useMove({
    onMoveStart() {
      const box = group.element.getBoundingClientRect();
      const main = (axisX ? box.width : box.height) - group.handles * THICK;
      drag.current = { start: group.sizes.slice(), moved: 0, main };
      setResizing(true);
    },
    onMove(event) {
      const d = drag.current;
      if (!d || event.pointerType === "keyboard") return;
      d.moved += axisX ? event.deltaX : event.deltaY;
      apply(
        movePanels(
          d.start,
          index,
          (d.moved / d.main) * 100,
          group.mins,
          group.maxs,
        ),
      );
    },
    onMoveEnd() {
      drag.current = null;
      setResizing(false);
      end();
    },
  });
  // §4 — 포인터 handler 만 (useMove 의 onKeyDown 은 화살표 넷을 모두 삼킨다).
  const { onKeyDown: _dropped, ...pointerProps } = moveProps;
  // P3 — 끌기 시작 (pointerdown) 에 켠다: useMove 의 onMoveStart 는 첫 이동에야 와서, 첫 이동이 iframe
  // 위면 영영 오지 않는다. 「panels」 = Group 안 Panel 의 pointer-events 를 끈다 · 「capture」 = 손잡이가
  // pointer capture 를 잡는다. 끝 (pointerup · cancel — window) 에 푼다.
  const onPointerDownShield = (event) => {
    if (event.button !== 0) return;
    if (options.shield === "panels") group.element.dataset.resizing = "true";
    if (options.shield === "capture")
      event.currentTarget.setPointerCapture?.(event.pointerId);
    const release = () => {
      delete group.element.dataset.resizing;
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
  };
  const { keyboardProps } = useKeyboard({
    onKeyDown(event) {
      const back = axisX ? "ArrowLeft" : "ArrowUp";
      const forward = axisX ? "ArrowRight" : "ArrowDown";
      let delta;
      if (event.key === back) delta = -STEP;
      else if (event.key === forward) delta = STEP;
      else if (event.key === "Home") delta = -100;
      else if (event.key === "End") delta = 100;
      else {
        event.continuePropagation();
        return;
      }
      event.preventDefault();
      apply(movePanels(group.sizes, index, delta, group.mins, group.maxs));
      end();
    },
  });
  const sizes = group.sizes;
  const total = sizes[index] + sizes[index + 1];
  return h("div", {
    ...mergeProps(pointerProps, keyboardProps, {
      onPointerDown: onPointerDownShield,
    }),
    ref,
    role: "separator",
    tabIndex: 0,
    "aria-orientation": axisX ? "vertical" : "horizontal",
    "aria-valuenow": Math.round(sizes[index]),
    "aria-valuemin": Math.round(
      Math.max(group.mins[index], total - group.maxs[index + 1]),
    ),
    "aria-valuemax": Math.round(
      Math.min(group.maxs[index], total - group.mins[index + 1]),
    ),
    "aria-controls": `${group.id}-p${index}`,
    "aria-label": options.label ?? "Resize panels",
    "data-group": group.id,
    "data-index": index,
    "data-resizing": resizing ? "true" : undefined,
    style: {
      flex: "0 0 auto",
      [axisX ? "width" : "height"]: `${THICK}px`,
      background: "#c8c8c8",
      position: "relative",
      cursor: axisX ? "col-resize" : "row-resize",
      touchAction: "none",
      outlineOffset: 2,
    },
  });
}

/** Group — 자식 = Panel (Handle Panel)* . `defaults` 가 몫 (합 100). */
function Group({
  id,
  orientation,
  defaults,
  mins,
  maxs,
  children,
  style,
  options,
}) {
  const group = useMemo(
    () => ({
      id,
      sizes: defaults.slice(),
      mins: mins ?? defaults.map(() => 0),
      maxs: maxs ?? defaults.map(() => 100),
      panels: [],
      handles: defaults.length - 1,
      element: null,
      frame: 0,
    }),
    [],
  );
  const parts = [];
  children.forEach((child, i) => {
    if (i > 0)
      parts.push(
        h(Handle, {
          key: `h${i}`,
          group,
          index: i - 1,
          orientation,
          options,
        }),
      );
    parts.push(
      h(
        "div",
        {
          key: `p${i}`,
          id: `${id}-p${i}`,
          ref: (el) => {
            group.panels[i] = el;
          },
          "data-panel": `${id}-p${i}`,
          style: {
            flexGrow: group.sizes[i],
            flexShrink: 1,
            flexBasis: "0px",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          },
        },
        child,
      ),
    );
  });
  return h(
    "div",
    {
      ref: (el) => {
        group.element = el;
      },
      "data-group-root": id,
      className: "rs-group",
      style: {
        display: "flex",
        flexDirection: orientation === "horizontal" ? "row" : "column",
        overflow: "hidden",
        ...style,
      },
    },
    parts,
  );
}

function BigTable() {
  const rows = useMemo(
    () =>
      Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        cells: Array.from(
          { length: 6 },
          (_, c) => `r${i} c${c} ${"x".repeat((i * 7 + c) % 13)}`,
        ),
      })),
    [],
  );
  const layout = useMemo(
    () => new TableLayout({ rowHeight: 32, headingHeight: 32 }),
    [],
  );
  return h(
    Virtualizer,
    { layout },
    h(
      Table,
      {
        "aria-label": "Rows",
        style: {
          height: "100%",
          width: "100%",
          overflow: "auto",
          font: "13px system-ui",
        },
      },
      h(
        TableHeader,
        null,
        Array.from({ length: 6 }, (_, c) =>
          h(Column, { key: c, id: `c${c}`, isRowHeader: c === 0 }, `Col ${c}`),
        ),
      ),
      h(TableBody, { items: rows }, (row) =>
        h(
          Row,
          { id: row.id },
          row.cells.map((text, c) =>
            h(
              Cell,
              {
                key: c,
                style: {
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  padding: "0 6px",
                },
              },
              text,
            ),
          ),
        ),
      ),
    ),
  );
}

/** 불리한 경우 — 가상 스크롤 없는 1,000 행 (모든 행이 DOM 에 있어 폭이 바뀌면 전부 다시 배치). */
function PlainTable() {
  const rows = useMemo(() => Array.from({ length: 1000 }, (_, i) => i), []);
  return h(
    "div",
    { style: { overflow: "auto", height: "100%" } },
    h(
      "table",
      {
        style: {
          width: "100%",
          borderCollapse: "collapse",
          font: "13px system-ui",
        },
      },
      h(
        "tbody",
        null,
        rows.map((i) =>
          h(
            "tr",
            { key: i },
            Array.from({ length: 6 }, (_, c) =>
              h(
                "td",
                {
                  key: c,
                  style: { padding: "4px 6px", borderBottom: "1px solid #eee" },
                },
                `r${i} c${c} ${"word ".repeat((i * 7 + c) % 5)}`,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function Readout({ runtime, id, index }) {
  const sizes = useRuntimeValue(runtime, id);
  return h(
    "span",
    { "data-readout": `${id}-${index}`, style: { padding: 4 } },
    sizes ? `${Math.round(sizes[index])}%` : "—",
  );
}

function Label({ text }) {
  return h("div", { style: { padding: 8, font: "13px system-ui" } }, text);
}

function App({ options }) {
  const runtime = options.runtime;
  useLayoutEffect(() => {
    window.__ready = true;
  }, []);
  const iframe = h("iframe", {
    title: "frame",
    "data-iframe": "1",
    srcdoc: "<body style='margin:0;background:#fde'>iframe</body>",
    style: { border: 0, width: "100%", height: "100%" },
  });
  return h(
    "div",
    { style: { padding: 16 } },
    h(
      "div",
      { style: { display: "flex", gap: 8, font: "13px system-ui" } },
      h(Readout, { runtime, id: "outer", index: 0 }),
      h(Readout, { runtime, id: "mid", index: 0 }),
      h(Readout, { runtime, id: "inner", index: 0 }),
    ),
    h(
      Group,
      {
        id: "outer",
        orientation: "horizontal",
        defaults: [50, 50],
        mins: [15, 20],
        maxs: [85, 100],
        style: { width: 1100, height: 640, border: "1px solid #ccc" },
        options: { ...options, label: "Resize table panel" },
      },
      [
        options.table === "plain"
          ? h(PlainTable, { key: "t" })
          : options.table
            ? h(BigTable, { key: "t" })
            : h(Label, { key: "t", text: "Table" }),
        h(
          Group,
          {
            key: "mid",
            id: "mid",
            orientation: "vertical",
            defaults: [30, 70],
            mins: [10, 10],
            style: { width: "100%", height: "100%" },
            options: { ...options, label: "Resize toolbar" },
          },
          [
            h(Label, { key: "a", text: "Toolbar" }),
            h(
              Group,
              {
                key: "inner",
                id: "inner",
                orientation: "horizontal",
                defaults: [40, 60],
                mins: [10, 10],
                maxs: [70, 100],
                style: { width: "100%", height: "100%" },
                options: { ...options, label: "Resize preview" },
              },
              [
                h(Label, { key: "e", text: "Editor" }),
                h("div", { key: "f", style: { flex: 1 } }, iframe),
              ],
            ),
          ],
        ),
      ],
    ),
    h("div", { style: { height: 2000 } }, "page tail"),
  );
}

export function mount(input = {}) {
  const options = {
    arm: input.arm ?? "frame",
    shield: input.shield ?? "none",
    table: input.table ?? true,
    runtime: createRuntime(),
  };
  // §5.2 — 잡는 영역은 선보다 넓다 (배치에 들어가지 않는 가상 요소 · 양옆 4px).
  const hit = document.createElement("style");
  hit.textContent =
    '[role=separator]::after{content:"";position:absolute;z-index:1}' +
    "[role=separator][aria-orientation=vertical]::after{inset:0 -4px}" +
    "[role=separator][aria-orientation=horizontal]::after{inset:-4px 0}";
  document.head.append(hit);
  if (options.shield === "panels") {
    const style = document.createElement("style");
    // 가림막 — 끌기 중 Group 안 Panel 이 포인터를 받지 않는다 (iframe 포함).
    style.textContent =
      ".rs-group[data-resizing] [data-panel]{pointer-events:none}";
    document.head.append(style);
  }
  const root = document.createElement("div");
  document.body.append(root);
  createRoot(root).render(h(App, { options }));
  window.__runtime = options.runtime;
}
