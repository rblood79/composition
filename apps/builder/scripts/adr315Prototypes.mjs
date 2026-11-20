// ADR-315 Phase 0 시제품 — 설치된 RAC (react-aria-components 1.22.1) 의 공개 prop · `protected` 훅 ·
// CSS · 우리가 그리는 자식 요소만으로 (HC1) 아래 여섯이 되는지 본다. 제품 코드가 아니다 — 판정은
// `adr315-phase0-prototypes.mjs` 가 실제 브라우저 (Chrome · WebKit) 의 좌표 · 속성으로 한다.
//   s1v · s1p  고정 열 (가상 — `TableLayout.isStickyColumn` · 비가상 — CSS sticky)
//   s2         행 창 위 펼침 행 (중첩 Row · `treeColumn` · `expandedKeys` + 창 밖 행은 칸 없는 Row)
//   s3v · s3p  고정 행 (가상 — layout 이 고정 행을 늘 만들고 sticky · 비가상 — CSS sticky)
//   s4         여러 열 정렬의 Shift 판정 (`onSortChange` 는 열만 준다)
//   s5         열 메뉴 항목 (숨김 · 이동 · 고정) · 머리글 끌기 (`useDrag` · `useDrop`)
//   s6         칸 범위 선택 (`aria-selected` · Shift + 화살표 · 복사)
import {
  createElement as h,
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Cell,
  Column,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableLayout,
  Virtualizer,
} from "react-aria-components";
import { useDrag, useDrop } from "react-aria";

const ROW = 40;
const HEAD = 40;
const COL = 120;
const BOX = { width: 900, height: 500 };
const cellStyle = {
  boxSizing: "border-box",
  padding: "0 8px",
  borderBottom: "1px solid #ddd",
  background: "#fff",
  overflow: "hidden",
  whiteSpace: "nowrap",
  height: ROW,
  lineHeight: `${ROW}px`,
  textAlign: "start",
  font: "14px/40px system-ui",
};

const makeColumns = (count) =>
  Array.from({ length: count }, (_, i) => ({
    key: `c${i}`,
    label: `Col ${i}`,
  }));
const makeRows = (count, columns) =>
  Array.from({ length: count }, (_, r) => {
    const row = { id: `r${r}` };
    for (const [c, column] of columns.entries()) row[column.key] = `${r}:${c}`;
    return row;
  });

// ---------------------------------------------------------------------------------------------
// layout — 고정 열 (S1) · 고정 행 (S3) · 보이는 행 보고 (S2)
// ---------------------------------------------------------------------------------------------
class ProtoLayout extends TableLayout {
  opts = {};
  shouldInvalidateLayoutOptions(next, previous) {
    return (
      next.pinStart !== previous.pinStart ||
      next.pinEnd !== previous.pinEnd ||
      next.pinTop !== previous.pinTop ||
      next.pinBottom !== previous.pinBottom ||
      super.shouldInvalidateLayoutOptions(next, previous)
    );
  }
  update(context) {
    this.opts = context.layoutOptions ?? {};
    super.update(context);
  }
  isStickyColumn(node) {
    const { pinStart, pinEnd } = this.opts;
    if (!pinStart && !pinEnd) return false;
    const column =
      node.type === "column"
        ? node
        : this.virtualizer.collection.columns[node.colIndex ?? node.index];
    return Boolean(
      column && (pinStart?.has(column.key) || pinEnd?.has(column.key)),
    );
  }
  // (RAC 는 머리글도 `overflow: hidden` 으로 그린다 — 머리글의 고정 열이 머리글 상자에 붙는다.)
  buildTableHeader() {
    const header = super.buildTableHeader();
    const { pinStart, pinEnd } = this.opts;
    if (pinStart?.size || pinEnd?.size) header.layoutInfo.allowOverflow = true;
    return header;
  }
  // (S3) 고정 행은 보이는 영역 밖이어도 만든다: RAC 는 영역 밖 행을 건너뛴다 (`buildRowGroup`).
  buildRowGroup(y, node) {
    const group = super.buildRowGroup(y, node);
    const { pinTop, pinBottom, pinStart, pinEnd } = this.opts;
    // (RAC 는 body 를 `overflow: hidden` 으로 그린다 — 그 안의 sticky 는 body 에 붙는다. 고정이 있는
    //  표는 body 를 자르지 않는다: `allowOverflow`.)
    if (pinTop?.length || pinBottom?.length || pinStart?.size || pinEnd?.size)
      group.layoutInfo.allowOverflow = true;
    if (node.type !== "tablebody" || (!pinTop?.length && !pinBottom?.length))
      return group;
    const built = new Set(group.children.map((child) => child.layoutInfo.key));
    const rowHeight = this.getEstimatedRowHeight();
    const collection = this.virtualizer.collection;
    const add = (key, at) => {
      if (built.has(key)) return;
      const row = collection.getItem(key);
      if (!row) return;
      const layoutNode = this.buildChild(
        row,
        this.padding,
        at,
        group.layoutInfo.key,
      );
      layoutNode.layoutInfo.parentKey = group.layoutInfo.key;
      layoutNode.index = group.children.length;
      group.children.push(layoutNode);
    };
    (pinTop ?? []).forEach((key, i) => add(key, y + i * rowHeight));
    const end = group.layoutInfo.rect.maxY;
    const bottom = pinBottom ?? [];
    bottom.forEach((key, i) => add(key, end - (bottom.length - i) * rowHeight));
    return group;
  }
  buildRow(node, x, y) {
    const { pinTop, pinBottom, pinEnd } = this.opts;
    // (S1) 끝 고정 열의 칸은 가로로 보이는 영역 밖이어도 만든다: RAC 는 영역을 넘는 칸에서 멈춘다
    //  (`buildRow` 의 `x > requestedRect.maxX`). 만드는 것은 세로로 보이는 행뿐이고, 그리는 칸은
    //  여전히 보이는 칸 + 고정 칸이다 (`getVisibleLayoutInfos`).
    let row;
    if (pinEnd?.size) {
      const requested = this.requestedRect;
      this.requestedRect = requested.copy();
      this.requestedRect.width = Number.MAX_SAFE_INTEGER;
      try {
        row = super.buildRow(node, x, y);
      } finally {
        this.requestedRect = requested;
      }
      row.validRect = row.layoutInfo.rect.intersection(requested);
    } else row = super.buildRow(node, x, y);
    // (S2) 창 밖 행은 칸이 없다 — RAC 는 행의 높이를 칸에서 잰다. 제품의 `CatalogTableLayout.buildRow`
    //  와 같이 행 높이를 준다 (없으면 높이 0 인 행이 전부 「보이는 행」 이 된다).
    if (!row.children?.length) {
      row.layoutInfo.rect.height = this.getEstimatedRowHeight();
      row.validRect = row.layoutInfo.rect.intersection(this.requestedRect);
    }
    if (pinTop?.includes(node.key) || pinBottom?.includes(node.key)) {
      row.layoutInfo.isSticky = true;
      row.layoutInfo.zIndex = 3;
    }
    return row;
  }
  getVisibleLayoutInfos(rect) {
    const infos = super.getVisibleLayoutInfos(rect);
    const { pinTop, pinBottom, onRowsInView } = this.opts;
    const pinned = [...(pinTop ?? []), ...(pinBottom ?? [])];
    if (pinned.length) {
      const seen = new Set(infos.map((info) => info.key));
      const collection = this.virtualizer.collection;
      for (const key of pinned) {
        const info = this.getLayoutInfo(key);
        if (!info) continue;
        if (!seen.has(key)) infos.push(info);
        for (const cell of collection.getChildren(key)) {
          const cellInfo = this.getLayoutInfo(cell.key);
          if (cellInfo && !seen.has(cell.key)) infos.push(cellInfo);
        }
      }
    }
    if (onRowsInView && rect.height > 1) {
      const keys = [];
      for (const info of infos)
        if (
          info.type === "row" &&
          info.rect.maxY > rect.y &&
          info.rect.y < rect.maxY
        )
          keys.push(String(info.key));
      onRowsInView(keys);
    }
    return infos;
  }
}

const tableStyle = {
  display: "block",
  width: BOX.width,
  height: BOX.height,
  overflow: "auto",
  boxSizing: "border-box",
  position: "relative",
};

// ---------------------------------------------------------------------------------------------
// S1 — 고정 열
// ---------------------------------------------------------------------------------------------
/** Columns in drawn order: start-pinned, center, end-pinned. */
function ordered(columns, start, end) {
  return [
    ...columns.filter((c) => start.includes(c.key)),
    ...columns.filter((c) => !start.includes(c.key) && !end.includes(c.key)),
    ...columns.filter((c) => end.includes(c.key)),
  ];
}
function PinVirtual({ api }) {
  const all = useMemo(() => makeColumns(30), []);
  const rows = useMemo(() => makeRows(2000, all), [all]);
  const [pin, setPin] = useState({ start: ["c0", "c1"], end: ["c29"] });
  api.setPin = setPin;
  const columns = useMemo(() => ordered(all, pin.start, pin.end), [all, pin]);
  const layoutOptions = useMemo(
    () => ({
      rowHeight: ROW,
      headingHeight: HEAD,
      pinStart: new Set(pin.start),
      pinEnd: new Set(pin.end),
    }),
    [pin],
  );
  // 끝 고정: RAC 는 sticky 칸에 `left` 만 준다 — 끝 고정 칸은 CSS 로 `right` 를 준다. sticky 는
  // 제자리에서만 당겨지므로 제자리가 행의 끝이어야 한다: 행을 flex 로 두고 채움 (`::before`) 을
  // 사이에 넣는다 (margin 으로 밀면 sticky 가 margin 상자만큼만 움직인다 — 실측 2026-11-20).
  const pinProps = (key) => {
    if (pin.start.includes(key)) return { "data-pin": "start" };
    const e = pin.end.indexOf(key);
    return e >= 0 ? { "data-pin": "end", "data-pin-end": e } : {};
  };
  // (RAC 는 칸마다 감싸는 요소 (`role=presentation`) 에 sticky 를 준다 — 규칙은 그 요소에 건다.)
  const wrap = (selector) => `#s1v [role=presentation]:has(> ${selector})`;
  const endRules = pin.end
    .map(
      (_, e) =>
        `${wrap(`[data-pin-end="${e}"]`)} { order: 2; left: auto !important; right: ${(pin.end.length - 1 - e) * COL}px; }`,
    )
    .join("\n");
  return h(
    Fragment,
    null,
    h(
      "style",
      null,
      `#s1v [role=row] { display: flex; align-items: flex-start; }
       #s1v [role=row]::before { content: ""; flex: 1 1 auto; order: 1; }
       ${wrap("[data-pin]")} { flex: none; }
       ${endRules}
       #s1v [data-pin=start] { box-shadow: 1px 0 0 #999; }
       #s1v [data-pin=end] { box-shadow: -1px 0 0 #999; }`,
    ),
    h(
      Virtualizer,
      { layout: ProtoLayout, layoutOptions },
      h(
        Table,
        { "aria-label": "s1v", id: "s1v", style: tableStyle },
        h(TableHeader, { columns, dependencies: [pin] }, (column) =>
          h(
            Column,
            {
              id: column.key,
              isRowHeader: column.key === "c0",
              width: COL,
              style: { ...cellStyle, fontWeight: 600 },
              ...pinProps(column.key),
            },
            column.label,
          ),
        ),
        h(TableBody, { items: rows, dependencies: [pin] }, (item) =>
          h(Row, { columns, dependencies: [pin] }, (column) =>
            h(
              Cell,
              { style: cellStyle, ...pinProps(column.key) },
              item[column.key],
            ),
          ),
        ),
      ),
    ),
  );
}

function PinPlain({ api }) {
  const all = useMemo(() => makeColumns(30), []);
  const rows = useMemo(() => makeRows(200, all), [all]);
  const [pin, setPin] = useState({ start: ["c0", "c1"], end: ["c29"] });
  api.setPin = setPin;
  const columns = useMemo(() => ordered(all, pin.start, pin.end), [all, pin]);
  const sticky = (key) => {
    const s = pin.start.indexOf(key);
    const e = pin.end.indexOf(key);
    if (s >= 0)
      return {
        position: "sticky",
        insetInlineStart: s * COL,
        zIndex: 2,
        boxShadow: "1px 0 0 #999",
      };
    if (e >= 0)
      return {
        position: "sticky",
        insetInlineEnd: (pin.end.length - 1 - e) * COL,
        zIndex: 2,
        boxShadow: "-1px 0 0 #999",
      };
    return {};
  };
  const rowStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns.length}, ${COL}px)`,
    width: "max-content",
  };
  return h(
    Fragment,
    null,
    h(
      "style",
      null,
      `#s1p thead, #s1p tbody { display: block; width: max-content; }
       #s1p thead { position: sticky; top: 0; z-index: 3; }
       #s1p tr { display: grid; grid-template-columns: repeat(${columns.length}, ${COL}px); width: max-content; }`,
    ),
    h(
      Table,
      { "aria-label": "s1p", id: "s1p", style: tableStyle },
      h(
        TableHeader,
        { columns, style: rowStyle, dependencies: [pin] },
        (column) =>
          h(
            Column,
            {
              id: column.key,
              isRowHeader: column.key === "c0",
              "data-pin": pin.start.includes(column.key)
                ? "start"
                : pin.end.includes(column.key)
                  ? "end"
                  : undefined,
              style: { ...cellStyle, fontWeight: 600, ...sticky(column.key) },
            },
            column.label,
          ),
      ),
      h(TableBody, { items: rows, dependencies: [pin] }, (item) =>
        h(Row, { columns, dependencies: [pin] }, (column) =>
          h(
            Cell,
            {
              "data-pin": pin.start.includes(column.key)
                ? "start"
                : pin.end.includes(column.key)
                  ? "end"
                  : undefined,
              style: { ...cellStyle, ...sticky(column.key) },
            },
            item[column.key],
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// S2 — 행 창 위 펼침 행
// ---------------------------------------------------------------------------------------------
const WINDOW_CHUNK = 64;
/**
 * `groups` 묶음 × `children` 자식. 창 밖 행은 칸 없는 Row (제품의 `catalogWindowRowPending` 과 같은
 * 모양) 이고, 행은 64 개 chunk 로 나눈다 — 묶음의 자식도 부모 Row 안에서 chunk 로 나눈다.
 */
function TreeWindow({ api, groups = 1000, children = 10, collapsed = "rows" }) {
  const columns = useMemo(() => makeColumns(6), []);
  const data = useMemo(
    () =>
      Array.from({ length: groups }, (_, g) => ({
        id: `g${g}`,
        label: `Group ${g}`,
        rows: Array.from({ length: children }, (_, r) => ({
          id: `g${g}-r${r}`,
          label: `${g}:${r}`,
        })),
      })),
    [groups, children],
  );
  const [expanded, setExpanded] = useState(() => new Set());
  const [inView, setInView] = useState(() => new Set());
  api.expandAll = () => setExpanded(new Set(data.map((g) => g.id)));
  api.collapseAll = () => setExpanded(new Set());
  api.expanded = () => [...expanded];
  const pending = useRef(null);
  const onRowsInView = useCallback((keys) => {
    // (제품은 layout 이 세션에 알리고 세션이 paint 전에 창을 옮긴다 — 여기서는 microtask.)
    pending.current = keys;
    queueMicrotask(() => {
      const next = pending.current;
      if (!next) return;
      pending.current = null;
      setInView((before) =>
        next.length === before.size && next.every((key) => before.has(key))
          ? before
          : new Set(next),
      );
    });
  }, []);
  const layoutOptions = useMemo(
    () => ({ rowHeight: ROW, headingHeight: HEAD, onRowsInView }),
    [onRowsInView],
  );
  const cells = (label, group) =>
    columns.map((column, i) =>
      h(
        Cell,
        { key: column.key, style: cellStyle },
        i === 0
          ? h(
              "span",
              { style: { paddingInlineStart: group ? 0 : 24 } },
              group
                ? h(
                    Button,
                    { slot: "chevron", style: { marginInlineEnd: 6 } },
                    expanded.has(group) ? "▾" : "▸",
                  )
                : null,
              label,
            )
          : `${label}/${i}`,
      ),
    );
  const chunked = (list, render) => {
    const out = [];
    for (let from = 0; from < list.length; from += WINDOW_CHUNK)
      out.push(
        h(
          Fragment,
          { key: `chunk${from}` },
          list.slice(from, from + WINDOW_CHUNK).map(render),
        ),
      );
    return out;
  };
  const body = chunked(data, (group) =>
    h(
      Row,
      {
        key: group.id,
        id: group.id,
        hasChildItems: true,
        "data-kind": "group",
      },
      inView.has(group.id) ? cells(group.label, group.id) : null,
      // 접힌 묶음의 자식 (`collapsed`): "rows" = 자식 Row 를 늘 둔다 (로컬 실행 — 행이 전부 있다) ·
      // "placeholder" = 칸 없는 자식 Row 하나 (서버 실행 — 펼칠 때 불러온다) · "none" = 두지 않는다.
      // react-aria 는 자식 Row 가 collection 에 있을 때만 그 행을 「펼칠 수 있는 행」 으로 본다
      // (`useTableRow` — `aria-expanded` · ← → 키): RAC Row 의 `hasChildItems` 만으로는 접힌 행에
      // `aria-expanded` 가 붙지 않는다 (실측 2026-11-20).
      expanded.has(group.id) || collapsed === "rows"
        ? chunked(group.rows, (row) =>
            h(
              Row,
              { key: row.id, id: row.id, "data-kind": "leaf" },
              inView.has(row.id) ? cells(row.label, null) : null,
            ),
          )
        : collapsed === "placeholder"
          ? h(Row, { key: `${group.id}-pending`, id: `${group.id}-pending` })
          : null,
    ),
  );
  return h(
    Virtualizer,
    { layout: ProtoLayout, layoutOptions },
    h(
      Table,
      {
        "aria-label": "s2",
        id: "s2",
        style: tableStyle,
        treeColumn: "c0",
        expandedKeys: expanded,
        onExpandedChange: (keys) => setExpanded(new Set(keys)),
      },
      h(
        TableHeader,
        null,
        columns.map((column, i) =>
          h(
            Column,
            {
              key: column.key,
              id: column.key,
              isRowHeader: i === 0,
              style: { ...cellStyle, fontWeight: 600 },
            },
            column.label,
          ),
        ),
      ),
      h(TableBody, null, body),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// S3 — 고정 행
// ---------------------------------------------------------------------------------------------
function RowPinVirtual({ api }) {
  const columns = useMemo(() => makeColumns(6), []);
  const rows = useMemo(() => makeRows(2000, columns), [columns]);
  const [pin, setPin] = useState({ top: ["r700", "r5"], bottom: ["r1500"] });
  api.setPin = setPin;
  // 데이터 층이 [위 고정 · 나머지 · 아래 고정] 으로 가른다 (breakdown §5.4).
  const items = useMemo(() => {
    const by = new Map(rows.map((row) => [row.id, row]));
    const fixed = new Set([...pin.top, ...pin.bottom]);
    return [
      ...pin.top.map((key) => by.get(key)),
      ...rows.filter((row) => !fixed.has(row.id)),
      ...pin.bottom.map((key) => by.get(key)),
    ];
  }, [rows, pin]);
  const layoutOptions = useMemo(
    () => ({
      rowHeight: ROW,
      headingHeight: HEAD,
      pinTop: pin.top,
      pinBottom: pin.bottom,
    }),
    [pin],
  );
  const pinProps = (key) => {
    if (pin.top.includes(key)) return { "data-pin-row": "top" };
    const b = pin.bottom.indexOf(key);
    return b >= 0 ? { "data-pin-row": "bottom", "data-pin-bottom": b } : {};
  };
  const wrap = (selector) => `#s3v [role=presentation]:has(> ${selector})`;
  // 아래 고정: RAC 는 sticky 행에 `top` 만 준다 — `bottom` 은 CSS 로, 제자리가 body 의 끝이 되게
  // body 를 flex column 으로 두고 채움 (`::before`) 을 사이에 넣는다 (S1 과 같은 이유).
  const bottomRules = pin.bottom
    .map(
      (_, b) =>
        `${wrap(`[data-pin-bottom="${b}"]`)} { order: 2; top: auto !important; bottom: ${(pin.bottom.length - 1 - b) * ROW}px; }`,
    )
    .join("\n");
  return h(
    Fragment,
    null,
    h(
      "style",
      null,
      `#s3v [role=rowgroup] { display: flex; flex-direction: column; height: 100%; }
       #s3v [role=rowgroup]::before { content: ""; flex: 1 1 auto; order: 1; }
       ${wrap("[data-pin-row]")} { flex: none; }
       ${bottomRules}
       #s3v [data-pin-row] [role=gridcell], #s3v [data-pin-row] [role=rowheader] { background: #eef !important; }`,
    ),
    h(
      Virtualizer,
      { layout: ProtoLayout, layoutOptions },
      h(
        Table,
        { "aria-label": "s3v", id: "s3v", style: tableStyle },
        h(TableHeader, { columns }, (column) =>
          h(
            Column,
            {
              id: column.key,
              isRowHeader: column.key === "c0",
              style: { ...cellStyle, fontWeight: 600 },
            },
            column.label,
          ),
        ),
        h(TableBody, { items, dependencies: [pin] }, (item) =>
          h(Row, { columns, ...pinProps(item.id) }, (column) =>
            h(Cell, { style: cellStyle }, item[column.key]),
          ),
        ),
      ),
    ),
  );
}

function RowPinPlain({ api }) {
  const columns = useMemo(() => makeColumns(6), []);
  const rows = useMemo(() => makeRows(300, columns), [columns]);
  const [pin, setPin] = useState({ top: ["r200", "r5"], bottom: ["r150"] });
  api.setPin = setPin;
  const items = useMemo(() => {
    const by = new Map(rows.map((row) => [row.id, row]));
    const fixed = new Set([...pin.top, ...pin.bottom]);
    return [
      ...pin.top.map((key) => by.get(key)),
      ...rows.filter((row) => !fixed.has(row.id)),
      ...pin.bottom.map((key) => by.get(key)),
    ];
  }, [rows, pin]);
  const sticky = (key) => {
    const t = pin.top.indexOf(key);
    const b = pin.bottom.indexOf(key);
    if (t >= 0) return { position: "sticky", top: HEAD + t * ROW, zIndex: 2 };
    if (b >= 0)
      return {
        position: "sticky",
        bottom: (pin.bottom.length - 1 - b) * ROW,
        zIndex: 2,
      };
    return {};
  };
  return h(
    Fragment,
    null,
    h(
      "style",
      null,
      `#s3p thead, #s3p tbody { display: block; }
       #s3p thead { position: sticky; top: 0; z-index: 3; }
       #s3p tr { display: grid; grid-template-columns: repeat(${columns.length}, 1fr); }`,
    ),
    h(
      Table,
      { "aria-label": "s3p", id: "s3p", style: tableStyle },
      h(TableHeader, { columns }, (column) =>
        h(
          Column,
          {
            id: column.key,
            isRowHeader: column.key === "c0",
            style: { ...cellStyle, fontWeight: 600 },
          },
          column.label,
        ),
      ),
      h(TableBody, { items }, (item) =>
        h(
          Row,
          {
            columns,
            "data-pin-row": pin.top.includes(item.id)
              ? "top"
              : pin.bottom.includes(item.id)
                ? "bottom"
                : undefined,
            style: sticky(item.id),
          },
          (column) => h(Cell, { style: cellStyle }, item[column.key]),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// S4 — Shift 판정
// ---------------------------------------------------------------------------------------------
function ShiftSort({ api }) {
  const columns = useMemo(() => makeColumns(6), []);
  const rows = useMemo(() => makeRows(50, columns), [columns]);
  const [sorts, setSorts] = useState([]);
  api.sorts = () => sorts;
  const shift = useRef(false);
  // 수정 키는 표 컨테이너의 capture 에서 기억한다 — RAC 의 DOM · 처리기를 바꾸지 않는다.
  const remember = (event) => {
    shift.current = event.shiftKey;
  };
  const onSortChange = (descriptor) => {
    const add = shift.current;
    setSorts((before) => {
      if (!add) return [descriptor];
      const at = before.findIndex((s) => s.column === descriptor.column);
      // (RAC 는 첫 정렬 열만 안다 — 그 밖의 열은 클릭마다 `ascending` 을 준다. 방향은 우리가 뒤집는다.)
      if (at < 0)
        return [
          ...before,
          { column: descriptor.column, direction: "ascending" },
        ];
      const next = [...before];
      next[at] = {
        column: descriptor.column,
        direction:
          before[at].direction === "ascending" ? "descending" : "ascending",
      };
      return next;
    });
  };
  return h(
    "div",
    {
      id: "s4-host",
      onPointerDownCapture: remember,
      onKeyDownCapture: remember,
      onClickCapture: remember,
    },
    h(
      Table,
      {
        "aria-label": "s4",
        id: "s4",
        style: tableStyle,
        sortDescriptor: sorts[0],
        onSortChange,
      },
      h(TableHeader, { columns, dependencies: [sorts] }, (column) => {
        const at = sorts.findIndex((s) => s.column === column.key);
        return h(
          Column,
          {
            id: column.key,
            isRowHeader: column.key === "c0",
            allowsSorting: true,
            style: { ...cellStyle, fontWeight: 600 },
          },
          column.label,
          at >= 0
            ? h(
                "span",
                { "data-sort-order": at + 1, "aria-hidden": true },
                ` ${at + 1}${sorts[at].direction === "ascending" ? "▲" : "▼"}`,
              )
            : null,
        );
      }),
      h(TableBody, { items: rows }, (item) =>
        h(Row, { columns }, (column) =>
          h(Cell, { style: cellStyle }, item[column.key]),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// S5 — 열 메뉴 항목 · 머리글 끌기
// ---------------------------------------------------------------------------------------------
function DragHandle({ column }) {
  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ "application/x-column": column }],
  });
  return h(
    "span",
    {
      ...dragProps,
      role: "button",
      tabIndex: 0,
      "aria-label": `Move ${column}`,
      "data-drag-handle": column,
      "data-dragging": isDragging || undefined,
      style: { cursor: "grab", paddingInline: 4 },
      // 머리글의 정렬 press 와 섞이지 않게 손잡이의 pointer · mouse · click 은 Column 으로 올리지
      // 않는다 (RAC Column 의 press 는 mousedown 의 기본 동작을 막아 native drag 가 시작되지 않는다).
      onPointerDown: (event) => {
        event.stopPropagation();
        dragProps.onPointerDown?.(event);
      },
      onMouseDown: (event) => event.stopPropagation(),
      onClick: (event) => {
        event.stopPropagation();
        dragProps.onClick?.(event);
      },
    },
    "⠿",
  );
}
function HeaderDrop({ column, onDrop, children }) {
  const ref = useRef(null);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (types) =>
      types.has("application/x-column") ? "move" : "cancel",
    onDrop: async (event) => {
      const item = event.items.find(
        (it) => it.kind === "text" && it.types.has("application/x-column"),
      );
      if (item) onDrop(await item.getText("application/x-column"), column);
    },
  });
  return h(
    "span",
    {
      ...dropProps,
      ref,
      role: "button",
      tabIndex: 0,
      "aria-label": `Drop on ${column}`,
      "data-drop-target": column,
      "data-drop-active": isDropTarget || undefined,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        outline: isDropTarget ? "2px solid #06f" : undefined,
      },
    },
    children,
  );
}
function ColumnMenu({ api, virtual = true }) {
  const all = useMemo(() => makeColumns(8), []);
  const rows = useMemo(
    () => makeRows(virtual ? 2000 : 100, all),
    [all, virtual],
  );
  const [order, setOrder] = useState(() => all.map((c) => c.key));
  const [hidden, setHidden] = useState(() => new Set());
  const [sorted, setSorted] = useState(null);
  const [log, setLog] = useState([]);
  api.order = () => order.filter((key) => !hidden.has(key));
  api.log = () => log;
  api.sorted = () => sorted;
  const columns = useMemo(
    () =>
      order
        .filter((key) => !hidden.has(key))
        .map((key) => all.find((c) => c.key === key)),
    [order, hidden, all],
  );
  const move = (key, delta) =>
    setOrder((before) => {
      const visible = before.filter((k) => !hidden.has(k));
      const at = visible.indexOf(key);
      const to = at + delta;
      if (to < 0 || to >= visible.length) return before;
      const next = [...before];
      const a = next.indexOf(key);
      const b = next.indexOf(visible[to]);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  const dropOn = (from, to) =>
    setOrder((before) => {
      if (from === to) return before;
      const next = before.filter((k) => k !== from);
      next.splice(next.indexOf(to), 0, from);
      return next;
    });
  const act = (key, action) => {
    setLog((before) => [...before, `${action}:${key}`]);
    if (action === "hide" && key !== "c0")
      setHidden((before) => new Set(before).add(key));
    if (action === "left") move(key, -1);
    if (action === "right") move(key, 1);
  };
  const table = h(
    Table,
    {
      "aria-label": "s5",
      id: "s5",
      style: tableStyle,
      sortDescriptor: sorted ?? undefined,
      onSortChange: setSorted,
    },
    h(TableHeader, { columns, dependencies: [columns] }, (column) =>
      h(
        Column,
        {
          id: column.key,
          isRowHeader: column.key === "c0",
          allowsSorting: true,
          style: { ...cellStyle, fontWeight: 600 },
        },
        h(
          HeaderDrop,
          { column: column.key, onDrop: dropOn },
          h(DragHandle, { column: column.key }),
          column.label,
          h(
            MenuTrigger,
            null,
            h(
              Button,
              { "aria-label": `Menu ${column.key}`, "data-menu": column.key },
              "⋮",
            ),
            h(
              Popover,
              null,
              h(
                Menu,
                { onAction: (action) => act(column.key, String(action)) },
                h(MenuItem, { id: "hide" }, "Hide column"),
                h(MenuItem, { id: "left" }, "Move left"),
                h(MenuItem, { id: "right" }, "Move right"),
                h(MenuItem, { id: "pin" }, "Pin to start"),
              ),
            ),
          ),
        ),
      ),
    ),
    // (열 목록이 바뀌면 머리글과 모든 행이 같은 commit 에서 바뀌어야 한다 — RAC 는 행의 칸 수와 열 수가
    //  다르면 throw 한다: `dependencies`.)
    h(TableBody, { items: rows, dependencies: [columns] }, (item) =>
      h(Row, { columns, dependencies: [columns] }, (column) =>
        h(Cell, { style: cellStyle }, item[column.key]),
      ),
    ),
  );
  return virtual
    ? h(
        Virtualizer,
        {
          layout: ProtoLayout,
          layoutOptions: { rowHeight: ROW, headingHeight: HEAD },
        },
        table,
      )
    : table;
}

// ---------------------------------------------------------------------------------------------
// S6 — 칸 범위 선택 (D1 예외의 범위 — breakdown §5.6)
// ---------------------------------------------------------------------------------------------
function CellRanges({ api }) {
  const columns = useMemo(() => makeColumns(6), []);
  const rows = useMemo(() => makeRows(2000, columns), [columns]);
  const rowIndex = useMemo(
    () => new Map(rows.map((row, i) => [row.id, i])),
    [rows],
  );
  const colIndex = useMemo(
    () => new Map(columns.map((column, i) => [column.key, i])),
    [columns],
  );
  /** ranges: [{ anchor: {row, column}, focus: {row, column} }] — keys, not indexes. */
  const [ranges, setRanges] = useState([]);
  const [copied, setCopied] = useState(null);
  api.ranges = () => ranges;
  api.copied = () => copied;
  const host = useRef(null);
  const drag = useRef(false);
  const selected = useCallback(
    (row, column) => {
      const r = rowIndex.get(row);
      const c = colIndex.get(column);
      return ranges.some(({ anchor, focus }) => {
        const r0 = rowIndex.get(anchor.row);
        const r1 = rowIndex.get(focus.row);
        const c0 = colIndex.get(anchor.column);
        const c1 = colIndex.get(focus.column);
        return (
          r >= Math.min(r0, r1) &&
          r <= Math.max(r0, r1) &&
          c >= Math.min(c0, c1) &&
          c <= Math.max(c0, c1)
        );
      });
    },
    [ranges, rowIndex, colIndex],
  );
  const at = (target) => {
    const cell = target?.closest?.("[data-cell]");
    if (!cell || !host.current?.contains(cell)) return null;
    const [row, column] = cell.dataset.cell.split("|");
    return { row, column, cell };
  };
  const extend = (to) =>
    setRanges((before) =>
      before.length
        ? [...before.slice(0, -1), { anchor: before.at(-1).anchor, focus: to }]
        : [{ anchor: to, focus: to }],
    );
  const onPointerDown = (event) => {
    const hit = at(event.target);
    if (!hit || event.button !== 0) return;
    const point = { row: hit.row, column: hit.column };
    if (event.shiftKey) extend(point);
    else if (event.metaKey || event.ctrlKey)
      setRanges((before) => [...before, { anchor: point, focus: point }]);
    else setRanges([{ anchor: point, focus: point }]);
    drag.current = true;
    hit.cell.focus();
  };
  const onPointerMove = (event) => {
    if (!drag.current) return;
    const hit = at(document.elementFromPoint(event.clientX, event.clientY));
    if (hit) extend({ row: hit.row, column: hit.column });
  };
  const onPointerUp = () => {
    drag.current = false;
  };
  // 키보드: 칸 focus 이동은 RAC 가 한다 (그대로 둔다). Shift 를 누른 채 focus 가 칸으로 옮겨 가면
  // 범위의 focus 끝을 그 칸으로, Shift 없이 옮겨 가면 그 칸 하나로.
  const keys = useRef({ shift: false, arrow: false });
  const onKeyDownCapture = (event) => {
    keys.current = {
      shift: event.shiftKey,
      arrow: event.key.startsWith("Arrow"),
    };
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") setRanges([]);
    if (mod && event.key.toLowerCase() === "a") {
      event.preventDefault();
      event.stopPropagation();
      setRanges([
        {
          anchor: { row: rows[0].id, column: columns[0].key },
          focus: { row: rows.at(-1).id, column: columns.at(-1).key },
        },
      ]);
    }
    if (mod && event.key.toLowerCase() === "c" && ranges.length) {
      // 복사는 데이터 층에서 범위의 값을 읽는다 — 창 밖 칸도 (breakdown §5.6).
      const { anchor, focus } = ranges.at(-1);
      const r0 = Math.min(rowIndex.get(anchor.row), rowIndex.get(focus.row));
      const r1 = Math.max(rowIndex.get(anchor.row), rowIndex.get(focus.row));
      const c0 = Math.min(
        colIndex.get(anchor.column),
        colIndex.get(focus.column),
      );
      const c1 = Math.max(
        colIndex.get(anchor.column),
        colIndex.get(focus.column),
      );
      const text = rows
        .slice(r0, r1 + 1)
        .map((row) =>
          columns
            .slice(c0, c1 + 1)
            .map((column) => row[column.key])
            .join("\t"),
        )
        .join("\n");
      setCopied(text);
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };
  const onFocusCapture = (event) => {
    const hit = at(event.target);
    if (!hit || hit.cell !== event.target || !keys.current.arrow) return;
    const point = { row: hit.row, column: hit.column };
    if (keys.current.shift) extend(point);
    else setRanges([{ anchor: point, focus: point }]);
    keys.current.arrow = false;
  };
  return h(
    "div",
    {
      id: "s6-host",
      ref: host,
      onPointerDownCapture: onPointerDown,
      onPointerMove,
      onPointerUp,
      onKeyDownCapture,
      onFocusCapture,
      style: { userSelect: "none" },
    },
    h(
      "style",
      null,
      `#s6 [aria-selected=true][data-cell] { background: #cde !important; }`,
    ),
    h(
      Virtualizer,
      {
        layout: ProtoLayout,
        layoutOptions: { rowHeight: ROW, headingHeight: HEAD },
      },
      h(
        Table,
        {
          "aria-label": "s6",
          id: "s6",
          style: tableStyle,
          // `render`: grid 요소에 `aria-multiselectable` (RAC 의 공개 render prop — DOM 은 RAC 것 그대로).
          render: (props) =>
            h("div", { ...props, "aria-multiselectable": true }),
        },
        h(TableHeader, { columns }, (column) =>
          h(
            Column,
            {
              id: column.key,
              isRowHeader: column.key === "c0",
              style: { ...cellStyle, fontWeight: 600 },
            },
            column.label,
          ),
        ),
        h(TableBody, { items: rows, dependencies: [ranges] }, (item) =>
          h(Row, { columns, dependencies: [ranges] }, (column) =>
            h(
              Cell,
              {
                style: cellStyle,
                "data-cell": `${item.id}|${column.key}`,
                render: (props) =>
                  h("div", {
                    ...props,
                    "aria-selected": selected(item.id, column.key),
                  }),
              },
              item[column.key],
            ),
          ),
        ),
      ),
    ),
  );
}

const PROTOTYPES = {
  s1v: PinVirtual,
  s1p: PinPlain,
  s2: TreeWindow,
  s3v: RowPinVirtual,
  s3p: RowPinPlain,
  s4: ShiftSort,
  s5: ColumnMenu,
  s6: CellRanges,
};

/** Mounts one prototype; resolves once its first body row is drawn. `window.__api[name]` is its handle. */
export function mount(name, props = {}) {
  const host = document.createElement("div");
  host.id = `host-${name}`;
  host.style.cssText = "position:absolute;left:16px;top:16px;background:#fff";
  document.body.appendChild(host);
  const api = {};
  (window.__api ??= {})[name] = api;
  const root = createRoot(host);
  api.unmount = () => {
    root.unmount();
    host.remove();
  };
  root.render(h(PROTOTYPES[name], { api, ...props }));
  return new Promise((resolve) => {
    const tick = () =>
      host.querySelector("[role=rowgroup] [role=row], tbody tr")
        ? requestAnimationFrame(() => resolve(true))
        : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  });
}
