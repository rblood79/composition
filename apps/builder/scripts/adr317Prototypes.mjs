// ADR-317 Phase 0 시제품 — 설치된 RAC (react-aria-components 1.22.1) Table 위에 제품의 칸 범위 선택
// (`attachCatalogCellSelection` — 그대로 import) 을 붙이고, 그 위에 이 ADR 이 더할 것이 되는지 본다.
// 제품 코드가 아니다 — 판정은 `adr317-phase0-prototypes.mjs` 가 실제 브라우저 (Chrome · WebKit) 의
// 이벤트 · 좌표 · 속성으로 한다.
//   p1   gridcell 에 focus 가 있을 때 Ctrl / Cmd + V 의 `paste` 가 표에 오는가 (`beforepaste` 유 · 무)
//   p2   가상 표에서 채우기 손잡이 끌기 — 창 밖으로 자동 스크롤 · 손잡이 요소가 재사용 · 해제돼도
//        끌기가 이어지는가 · 칸에서 시작한 범위 끌기와 갈리는가
//   p4   줄무늬 — 데이터 층의 보이는 순서로 정한 짝 · 홀이 가상 표 스크롤 · 정렬 뒤에도 화면 순서와 같은가
import {
  createElement as h,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
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
import { attachCatalogCellSelection } from "../../../packages/shared/src/catalog/runtime/tableCellSelection.ts";

const ROW = 40;
const HEAD = 40;
const BOX = { width: 760, height: 400 };
const cellStyle = {
  boxSizing: "border-box",
  padding: "0 8px",
  borderBottom: "1px solid #ddd",
  overflow: "hidden",
  whiteSpace: "nowrap",
  height: ROW,
  lineHeight: `${ROW}px`,
  font: "14px/40px system-ui",
  position: "relative",
};
const tableStyle = {
  display: "block",
  width: BOX.width,
  height: BOX.height,
  overflow: "auto",
  boxSizing: "border-box",
  position: "relative",
  userSelect: "none",
};
const COLUMNS = Array.from({ length: 6 }, (_, i) => ({
  key: `c${i}`,
  label: `Col ${i}`,
}));

/** 탭 · 줄 구분 글자 → 칸 (따옴표 칸 안의 탭 · 줄바꿈 · `""` 보존 — breakdown §5.2). */
export function splitClipboardText(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function EditGrid({ api, count = 2000, virtual = true, beforePaste = false }) {
  const [rows, setRows] = useState(() =>
    Array.from({ length: count }, (_, r) => {
      const row = { id: `r${r}`, n: r };
      for (const [c, column] of COLUMNS.entries())
        row[column.key] = `${r}:${c}`;
      return row;
    }),
  );
  const [descending, setDescending] = useState(false);
  const shown = useMemo(
    () => (descending ? [...rows].reverse() : rows),
    [rows, descending],
  );
  // 줄무늬 — 보이는 순서의 번호 (데이터 층). DOM 순서 · `:nth-child` 가 아니다.
  const stripe = useMemo(
    () => new Map(shown.map((row, index) => [row.id, index % 2])),
    [shown],
  );
  const order = useRef();
  order.current = {
    rows: shown.map((row) => row.id),
    columns: COLUMNS.map((column) => column.key),
  };
  const byId = useRef();
  byId.current = new Map(rows.map((row) => [row.id, row]));
  const source = useRef();
  source.current = {
    order: () => order.current,
    text: (keys, columns) =>
      keys
        .map((key) =>
          columns.map((column) => byId.current.get(key)?.[column]).join("\t"),
        )
        .join("\n"),
  };
  const table = useRef(null);
  const selection = useRef(null);
  const [rangeTick, setRangeTick] = useState(0);
  const pastes = useRef([]);
  const startFillRef = useRef(null);
  const scroller = () => table.current;

  useEffect(() => {
    const element = table.current;
    if (!element) return;
    const sel = attachCatalogCellSelection(element, source);
    selection.current = sel;
    // 범위가 바뀌면 손잡이 자리를 다시 그린다 (시제품 — 제품은 `mark` 경로).
    const tick = () => setRangeTick((n) => n + 1);
    element.addEventListener("pointerup", tick);
    element.addEventListener("keyup", tick);
    document.addEventListener("pointerup", tick);
    // P1 — 붙여넣기: 브라우저 `paste` 의 text/plain 만 읽는다 (HC8 — 권한 창 없음).
    const onPaste = (event) => {
      const text = event.clipboardData?.getData("text/plain") ?? null;
      pastes.current.push({
        text,
        types: [...(event.clipboardData?.types ?? [])],
        active:
          document.activeElement?.getAttribute("role") ??
          document.activeElement?.tagName,
        target: event.target?.getAttribute?.("role") ?? event.target?.tagName,
      });
      const range = sel.ranges().at(-1);
      if (!range || text === null) return;
      event.preventDefault();
      const grid = splitClipboardText(text);
      const { rows: keys, columns } = order.current;
      const r0 = Math.min(
        keys.indexOf(range.anchor.row),
        keys.indexOf(range.focus.row),
      );
      const c0 = Math.min(
        columns.indexOf(range.anchor.column),
        columns.indexOf(range.focus.column),
      );
      setRows((before) => {
        const next = new Map(before.map((row) => [row.id, row]));
        grid.forEach((line, dr) =>
          line.forEach((value, dc) => {
            const key = keys[r0 + dr];
            const column = columns[c0 + dc];
            if (!key || !column) return;
            next.set(key, { ...next.get(key), [column]: value });
          }),
        );
        return before.map((row) => next.get(row.id));
      });
    };
    const onBeforePaste = (event) => {
      if (element.contains(document.activeElement)) event.preventDefault();
    };
    element.addEventListener("paste", onPaste);
    // 손잡이의 pointerdown 은 범위 끌기 (표의 capture listener) 보다 먼저 잡아야 한다 — document capture.
    const onHandleDown = (event) => {
      if (!event.target?.closest?.("[data-fill-handle]")) return;
      event.stopPropagation();
      startFillRef.current?.(event);
    };
    document.addEventListener("pointerdown", onHandleDown, true);
    if (beforePaste) document.addEventListener("beforepaste", onBeforePaste);
    return () => {
      sel.detach();
      element.removeEventListener("pointerup", tick);
      element.removeEventListener("keyup", tick);
      document.removeEventListener("pointerup", tick);
      element.removeEventListener("paste", onPaste);
      document.removeEventListener("pointerdown", onHandleDown, true);
      document.removeEventListener("beforepaste", onBeforePaste);
    };
  }, [beforePaste]);

  // P2 — 채우기 손잡이: 마지막 범위의 오른쪽 아래 칸 안의 우리 요소 (`aria-hidden`).
  // 끌기는 손잡이의 pointerdown 에서 시작하고 이후는 document listener (손잡이 요소가 창 밖으로
  // 나가 해제돼도 이어진다). 표 가장자리 24px 안이면 rAF 로 자동 스크롤.
  const fill = useRef(null);
  const [fillTo, setFillTo] = useState(null);
  const range = selection.current?.ranges().at(-1);
  const corner = (() => {
    if (!range) return null;
    const { rows: keys, columns } = order.current;
    const r = Math.max(
      keys.indexOf(range.anchor.row),
      keys.indexOf(range.focus.row),
    );
    const c = Math.max(
      columns.indexOf(range.anchor.column),
      columns.indexOf(range.focus.column),
    );
    return { row: keys[r], column: columns[c], r, c };
  })();
  void rangeTick;
  const startFill = (event) => {
    if (event.button !== 0 || !range) return;
    event.preventDefault();
    const { rows: keys, columns } = order.current;
    const r0 = Math.min(
      keys.indexOf(range.anchor.row),
      keys.indexOf(range.focus.row),
    );
    const r1 = Math.max(
      keys.indexOf(range.anchor.row),
      keys.indexOf(range.focus.row),
    );
    const c0 = Math.min(
      columns.indexOf(range.anchor.column),
      columns.indexOf(range.focus.column),
    );
    const c1 = Math.max(
      columns.indexOf(range.anchor.column),
      columns.indexOf(range.focus.column),
    );
    const state = {
      r0,
      r1,
      c0,
      c1,
      x: event.clientX,
      y: event.clientY,
      to: r1,
      frame: 0,
      moves: 0,
      lostHandle: false,
      handle: event.target.closest("[data-fill-handle]"),
    };
    fill.current = state;
    // (RAC `ScrollView` 는 스크롤 중 · 끝난 뒤 300 ms 까지 내용에 `pointer-events: none` 을 건다 —
    //  `elementFromPoint` 는 그동안 행을 못 찾는다. 그려진 행의 상자로 판정한다.)
    const hitRow = (x, y) => {
      const box = scroller().getBoundingClientRect();
      const cy = Math.min(Math.max(y, box.top + HEAD + 2), box.bottom - 2);
      for (const row of scroller().querySelectorAll('[role="row"][data-key]')) {
        const frame = (
          row.parentElement?.getAttribute("role") === "presentation"
            ? row.parentElement
            : row
        ).getBoundingClientRect();
        if (cy >= frame.top && cy < frame.bottom)
          return order.current.rows.indexOf(row.getAttribute("data-key"));
      }
      return -1;
    };
    const step = () => {
      const s = fill.current;
      if (!s) return;
      const box = scroller().getBoundingClientRect();
      const edge = 24;
      let dy = 0;
      if (s.y > box.bottom - edge)
        dy = Math.min(40, (s.y - (box.bottom - edge)) / 2 + 4);
      else if (s.y < box.top + HEAD + edge)
        dy = -Math.min(40, (box.top + HEAD + edge - s.y) / 2 + 4);
      if (dy) scroller().scrollTop += dy;
      const index = hitRow(s.x, s.y);
      (s.trace ??= []).push(`${Math.round(scroller().scrollTop)}:${index}`);
      if (index >= 0 && index !== s.to) {
        s.to = index;
        setFillTo(index);
      }
      if (!s.handle.isConnected) s.lostHandle = true;
      s.frame = requestAnimationFrame(step);
    };
    const move = (e) => {
      fill.current.x = e.clientX;
      fill.current.y = e.clientY;
      fill.current.moves++;
    };
    const up = () => {
      const s = fill.current;
      cancelAnimationFrame(s.frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      fill.current = null;
      setFillTo(null);
      api.lastFill = {
        from: [s.r0, s.r1],
        to: s.to,
        moves: s.moves,
        lostHandle: s.lostHandle,
        trace: s.trace?.filter(
          (_, i, all) => i % Math.ceil(all.length / 20) === 0,
        ),
      };
      if (s.to <= s.r1) return;
      // 값 복사 — 원래 범위의 값을 아래로 되풀이 (결정 5 권고).
      const { rows: keys, columns } = order.current;
      setRows((before) => {
        const next = new Map(before.map((row) => [row.id, row]));
        const height = s.r1 - s.r0 + 1;
        for (let r = s.r1 + 1; r <= s.to; r++) {
          const from = next.get(keys[s.r0 + ((r - s.r1 - 1) % height)]);
          const target = { ...next.get(keys[r]) };
          for (let c = s.c0; c <= s.c1; c++)
            target[columns[c]] = from[columns[c]];
          next.set(keys[r], target);
        }
        return before.map((row) => next.get(row.id));
      });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    state.frame = requestAnimationFrame(step);
  };

  startFillRef.current = startFill;
  api.pastes = () => pastes.current;
  api.ranges = () => selection.current?.ranges() ?? [];
  api.rows = () => shown;
  api.value = (key, column) => byId.current.get(key)?.[column];
  api.sort = (down) => setDescending(down);
  api.fillTo = () => fillTo;

  const grid = h(
    Table,
    {
      "aria-label": "p",
      id: "p",
      ref: table,
      style: tableStyle,
    },
    h(TableHeader, { columns: COLUMNS }, (column) =>
      h(
        Column,
        {
          id: column.key,
          isRowHeader: column.key === "c0",
          style: { ...cellStyle, fontWeight: 600, background: "#fff" },
        },
        column.label,
      ),
    ),
    h(
      TableBody,
      { items: shown, dependencies: [corner?.row, corner?.column, stripe] },
      (item) =>
        h(
          Row,
          {
            id: item.id,
            columns: COLUMNS,
            "data-stripe": stripe.get(item.id) ? "odd" : "even",
            dependencies: [corner?.row, corner?.column, stripe, item],
          },
          (column) =>
            h(
              Cell,
              {
                style: cellStyle,
                "data-column-key": column.key,
                ref: (element) => {
                  if (!element || !selection.current) return;
                  return selection.current.mark(element, column.key);
                },
              },
              item[column.key],
              corner && corner.row === item.id && corner.column === column.key
                ? h("span", {
                    "aria-hidden": true,
                    "data-fill-handle": "",
                    style: {
                      position: "absolute",
                      right: -1,
                      bottom: -1,
                      width: 8,
                      height: 8,
                      background: "#2680eb",
                      border: "1px solid #fff",
                      cursor: "crosshair",
                      zIndex: 2,
                    },
                  })
                : null,
            ),
        ),
    ),
  );
  return h(
    "div",
    { id: "p-host" },
    h(
      "style",
      null,
      `#p [role=row][data-stripe=odd] :is([role=gridcell],[role=rowheader]) { background: #f3f3f3; }
       #p [role=row][data-stripe=even] :is([role=gridcell],[role=rowheader]) { background: #fff; }
       #p [data-selected] { background: #cde !important; }`,
    ),
    virtual
      ? h(
          Virtualizer,
          {
            layout: TableLayout,
            layoutOptions: { rowHeight: ROW, headingHeight: HEAD },
          },
          grid,
        )
      : grid,
  );
}

/** Mounts the grid; resolves once its first body row is drawn. `window.__api.p` is its handle. */
export function mount(props = {}) {
  document.querySelector("#host-p")?.__unmount?.();
  const host = document.createElement("div");
  host.id = "host-p";
  host.style.cssText = "position:absolute;left:16px;top:16px;background:#fff";
  document.body.appendChild(host);
  const api = {};
  (window.__api ??= {}).p = api;
  const root = createRoot(host);
  host.__unmount = () => {
    root.unmount();
    host.remove();
  };
  root.render(h(EditGrid, { api, ...props }));
  return new Promise((resolve) => {
    const tick = () =>
      host.querySelector("[role=row][data-key]")
        ? requestAnimationFrame(() => resolve(true))
        : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  });
}
