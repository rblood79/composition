// 데이터 그리드 비교의 대조군 둘 — `datagrid-table-vs-tanstack-live.mjs` 가 Publish 문서에 붙인다
// (dev 는 Vite 가 이 파일을 그대로, production 은 하니스가 lib build 로 dist 옆에 둔다).
//   rac       순수 RAC Table + Virtualizer (`TableLayout`) — 우리 렌더 경로 없는 RAC 의 바닥
//   tanstack  TanStack Table 8 (정렬 row model) + TanStack Virtual — 공식 virtualized-rows 예제 구조
// 세 팔이 같은 조건: 같은 행 · 열 · 상자 · 행 높이, 행 크기는 추정 (40) 뒤 실측, 글자 정렬은
// `Intl.Collator` (우리 보기 계산기와 같은 비교).
import { createElement as h, useMemo, useRef, useState } from "react";
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
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });
const compare = (a, b) =>
  typeof a === "number" && typeof b === "number"
    ? a - b
    : collator.compare(String(a), String(b));

function RacGrid({ rows, columns, box }) {
  const [sort, setSort] = useState(null);
  const items = useMemo(() => {
    if (!sort) return rows;
    const sign = sort.direction === "descending" ? -1 : 1;
    return [...rows].sort(
      (a, b) => sign * compare(a[sort.column], b[sort.column]),
    );
  }, [rows, sort]);
  return h(
    Virtualizer,
    {
      layout: TableLayout,
      layoutOptions: {
        // (추정 = 우리 Table 의 실제 행 높이 — 세 팔의 DOM 행 수가 같게. RAC 가 다시 잰다.)
        estimatedRowHeight: box.rowHeight,
        estimatedHeadingHeight: box.headHeight,
      },
    },
    h(
      Table,
      {
        "aria-label": "RAC baseline",
        id: "dg-rac",
        sortDescriptor: sort ?? undefined,
        onSortChange: setSort,
        style: {
          display: "block",
          width: box.width,
          height: box.height,
          overflow: "auto",
          boxSizing: "border-box",
          font: box.font,
        },
      },
      h(TableHeader, { columns }, (column) =>
        h(
          Column,
          {
            id: column.key,
            isRowHeader: column.key === columns[0].key,
            allowsSorting: true,
            style: { ...box.cell, height: box.headHeight, textAlign: "start" },
          },
          column.label,
        ),
      ),
      h(TableBody, { items }, (item) =>
        h(Row, { columns, style: { height: box.rowHeight } }, (column) =>
          h(
            Cell,
            {
              style: {
                ...box.cell,
                display: "flex",
                alignItems: "center",
                minHeight: box.rowHeight,
              },
            },
            h("span", null, String(item[column.key])),
          ),
        ),
      ),
    ),
  );
}

function TanstackGrid({ rows, columns, box }) {
  const [sorting, setSorting] = useState([]);
  const width = Math.floor(box.width / columns.length);
  const defs = useMemo(
    () =>
      columns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        size: width,
        sortingFn: (a, b, id) => compare(a.getValue(id), b.getValue(id)),
        cell: (info) => h("span", null, String(info.getValue())),
      })),
    [columns, width],
  );
  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });
  const model = table.getRowModel().rows;
  const scroller = useRef(null);
  const virtual = useVirtualizer({
    count: model.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => box.rowHeight,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 5,
  });
  return h(
    "div",
    {
      ref: scroller,
      id: "dg-tanstack",
      style: {
        width: box.width,
        height: box.height,
        overflow: "auto",
        position: "relative",
        boxSizing: "border-box",
        font: box.font,
      },
    },
    h(
      "table",
      { style: { display: "grid" } },
      h(
        "thead",
        {
          style: {
            display: "grid",
            position: "sticky",
            top: 0,
            zIndex: 1,
            background: "#fff",
          },
        },
        table.getHeaderGroups().map((group) =>
          h(
            "tr",
            { key: group.id, style: { display: "flex", width: "100%" } },
            group.headers.map((header) =>
              h(
                "th",
                {
                  key: header.id,
                  "aria-sort":
                    { asc: "ascending", desc: "descending" }[
                      header.column.getIsSorted()
                    ] ?? "none",
                  onClick: header.column.getToggleSortingHandler(),
                  style: {
                    ...box.cell,
                    display: "flex",
                    alignItems: "center",
                    width: header.getSize(),
                    height: box.headHeight,
                    cursor: "pointer",
                  },
                },
                flexRender(header.column.columnDef.header, header.getContext()),
              ),
            ),
          ),
        ),
      ),
      h(
        "tbody",
        {
          style: {
            display: "grid",
            height: `${virtual.getTotalSize()}px`,
            position: "relative",
          },
        },
        virtual.getVirtualItems().map((item) => {
          const row = model[item.index];
          return h(
            "tr",
            {
              key: row.id,
              "data-index": item.index,
              ref: (node) => virtual.measureElement(node),
              style: {
                display: "flex",
                position: "absolute",
                transform: `translateY(${item.start}px)`,
                width: "100%",
                height: box.rowHeight,
              },
            },
            row.getVisibleCells().map((cell) =>
              h(
                "td",
                {
                  key: cell.id,
                  style: {
                    ...box.cell,
                    display: "flex",
                    alignItems: "center",
                    width: cell.column.getSize(),
                  },
                },
                flexRender(cell.column.columnDef.cell, cell.getContext()),
              ),
            ),
          );
        }),
      ),
    ),
  );
}

/** Mounts one arm; resolves with the ms from `render` to its first data row in the DOM + a frame. */
export function mount(kind, rows, columns, box) {
  const host = document.createElement("div");
  host.id = `dg-host-${kind}`;
  host.style.cssText =
    "position:fixed;left:16px;top:16px;z-index:10;background:#fff";
  document.body.appendChild(host);
  const start = performance.now();
  createRoot(host).render(
    h(kind === "rac" ? RacGrid : TanstackGrid, { rows, columns, box }),
  );
  const first =
    kind === "rac"
      ? "#dg-rac [role=rowgroup] [role=row]"
      : "#dg-tanstack tbody tr";
  return new Promise((resolve) => {
    const tick = () => {
      if (host.querySelector(first))
        requestAnimationFrame(() => resolve(performance.now() - start));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
