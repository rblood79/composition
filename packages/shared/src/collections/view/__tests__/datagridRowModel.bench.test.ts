import { writeFileSync } from "node:fs";
import {
  createTable,
  getCoreRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  type ColumnDef,
  type TableOptionsResolved,
  type TableState,
} from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { runViewQueries } from "../evaluate";
import type { ViewQuery } from "../../../catalog/document/types";

/**
 * Data grid row model — node bench (run with `DATAGRID_BENCH=1`; `DATAGRID_BENCH_OUT=<file>`
 * writes the table). The same rows and the same operations through the two row engines:
 *   ours      `runViewQueries` (ADR-284 — conditions → group · aggregate → sort)
 *   tanstack  `@tanstack/react-table` 8 row models (filtered → grouped → sorted)
 * Two states per operation: `new data` (a fresh row array — TanStack builds its core row model,
 * a Row object per row) and `state change` (same rows, the sort direction · filter value flips —
 * TanStack's core rows are memoized, ours runs again). Median · p95 of RUNS after 3 warm-ups.
 *
 * Q1: the rows are synthetic (seeded, shuffled) — scale only. Q2: the unfavorable input is the
 * shuffled order (no pre-sorted column) and the string sort. Q3: each arm is the other's control.
 * String comparison differs by design — ours is `Intl.Collator` (locale order), TanStack's default
 * is its `alphanumeric` function; `tanstack+collator` gives TanStack the same collator. The run
 * without the flag only checks both engines return the same row counts.
 */
const RUN = !!process.env.DATAGRID_BENCH;
const SIZES = (process.env.DATAGRID_BENCH_ROWS ?? "1000,10000,100000")
  .split(",")
  .map(Number);
const RUNS = Number(process.env.DATAGRID_BENCH_RUNS ?? 20);

interface Row {
  id: string;
  name: string;
  dept: string;
  city: string;
  amount: number;
  qty: number;
  date: string;
  active: boolean;
}
const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-dept", key: "dept", type: "string" },
  { id: "f-city", key: "city", type: "string" },
  { id: "f-amount", key: "amount", type: "number" },
  { id: "f-qty", key: "qty", type: "number" },
  { id: "f-date", key: "date", type: "date" },
  { id: "f-active", key: "active", type: "boolean" },
];
const f = (id: string) => [`data:field:${id}` as const];

/** mulberry32 — the same rows every run. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRows(count: number): Row[] {
  const next = seeded(count);
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `Person ${Math.floor(next() * count * 4)}`,
    dept: `Dept ${Math.floor(next() * 12)}`,
    city: `City ${Math.floor(next() * 50)}`,
    amount: Math.floor(next() * 1_000_000) / 100,
    qty: Math.floor(next() * 500),
    date: `2026-${String(Math.floor(next() * 12) + 1).padStart(2, "0")}-${String(Math.floor(next() * 28) + 1).padStart(2, "0")}`,
    active: next() > 0.5,
  }));
}

// ── ours ──
const NO_WHERE = { id: "where", op: "and", items: [] } as const;
const where = (text: string, min: number): ViewQuery["where"] => ({
  id: "where",
  op: "and",
  items: [
    { id: "c1", fields: [f("f-name")], op: "contains", value: text },
    { id: "c2", fields: [f("f-amount")], op: "gt", value: min },
  ],
});
const ours = (rows: readonly Row[], view: ViewQuery) =>
  runViewQueries(rows, {
    queries: [view],
    schema: SCHEMA,
    today: "2026-06-15",
    resolve: (value) => ({ value }),
  }).rows;

// ── tanstack ──
const collator = new Intl.Collator(undefined, { sensitivity: "base" });
const columns = (collate: boolean): ColumnDef<Row>[] => [
  { accessorKey: "id" },
  {
    accessorKey: "name",
    filterFn: "includesString",
    ...(collate
      ? {
          sortingFn: (a, b, id) =>
            collator.compare(a.getValue(id), b.getValue(id)),
        }
      : {}),
  },
  { accessorKey: "dept" },
  { accessorKey: "city" },
  {
    accessorKey: "amount",
    filterFn: "inNumberRange",
    aggregationFn: "sum",
  },
  { accessorKey: "qty" },
  { accessorKey: "date" },
  { accessorKey: "active" },
];
function tanstack(rows: Row[], collate = false) {
  const options = (state: Partial<TableState>): TableOptionsResolved<Row> => ({
    data: rows,
    columns: columns(collate),
    state,
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const table = createTable<Row>(options({}));
  const initial = table.initialState;
  return (state: Partial<TableState>) => {
    table.setOptions(() => options({ ...initial, ...state }));
    return table.getRowModel().rows;
  };
}
const filterState = (text: string, min: number): Partial<TableState> => ({
  columnFilters: [
    { id: "name", value: text },
    { id: "amount", value: [min, Number.POSITIVE_INFINITY] },
  ],
});

interface Operation {
  label: string;
  /** The two states the run flips between (index 0 · 1). */
  ours: readonly [ViewQuery, ViewQuery];
  tanstack: readonly [Partial<TableState>, Partial<TableState>];
  /** Reads the result as a consumer would (a grouped row's aggregates are lazy in TanStack). */
  read?: (rows: readonly unknown[]) => void;
}
const OPERATIONS: Operation[] = [
  {
    label: "sort — number",
    ours: [
      {
        where: NO_WHERE,
        sort: { field: f("f-amount"), direction: "descending" },
      },
      {
        where: NO_WHERE,
        sort: { field: f("f-amount"), direction: "ascending" },
      },
    ],
    tanstack: [
      { sorting: [{ id: "amount", desc: true }] },
      { sorting: [{ id: "amount", desc: false }] },
    ],
  },
  {
    label: "sort — text",
    ours: [
      { where: NO_WHERE, sort: { field: f("f-name"), direction: "ascending" } },
      {
        where: NO_WHERE,
        sort: { field: f("f-name"), direction: "descending" },
      },
    ],
    tanstack: [
      { sorting: [{ id: "name", desc: false }] },
      { sorting: [{ id: "name", desc: true }] },
    ],
  },
  {
    label: "filter — text contains + number >",
    ours: [{ where: where("12", 2000) }, { where: where("34", 3000) }],
    tanstack: [filterState("12", 2000), filterState("34", 3000)],
  },
  {
    label: "filter + sort — number",
    ours: [
      {
        where: where("1", 2000),
        sort: { field: f("f-amount"), direction: "descending" },
      },
      {
        where: where("2", 3000),
        sort: { field: f("f-amount"), direction: "ascending" },
      },
    ],
    tanstack: [
      { ...filterState("1", 2000), sorting: [{ id: "amount", desc: true }] },
      { ...filterState("2", 3000), sorting: [{ id: "amount", desc: false }] },
    ],
  },
  {
    label: "group — dept · count + sum",
    ours: [0, 1].map((i): ViewQuery => ({
      where: i ? where("", 1000) : NO_WHERE,
      groupBy: [f("f-dept")],
      aggregates: [
        { fn: "count", as: "count" },
        { fn: "sum", field: f("f-amount"), as: "total" },
      ],
    })) as unknown as readonly [ViewQuery, ViewQuery],
    tanstack: [
      { grouping: ["dept"] },
      {
        grouping: ["dept"],
        columnFilters: [
          { id: "amount", value: [1000, Number.POSITIVE_INFINITY] },
        ],
      },
    ],
    read: (rows) => {
      for (const row of rows) {
        const group = row as { getValue?: (id: string) => unknown };
        group.getValue?.("amount");
      }
    },
  },
];

type Timing = { median: number; p95: number };
const quantile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
/** The loop yields between runs: TanStack queues its auto-reset work as microtasks, and a
 *  synchronous loop would keep every table it made alive until the bench ends. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
async function time<T>(
  prepare: (i: number) => T,
  run: (input: T, i: number) => void,
) {
  for (let i = 0; i < 3; i += 1) {
    run(prepare(i), i);
    await settle();
  }
  const times: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    // (The input — a fresh row array for `new data` — is made before the clock.)
    const input = prepare(i);
    const s = performance.now();
    run(input, i);
    times.push(performance.now() - s);
    await settle();
  }
  return { median: quantile(times, 0.5), p95: quantile(times, 0.95) };
}

describe("data grid row model — runViewQueries vs TanStack Table", () => {
  it("both engines return the same row counts", () => {
    const rows = makeRows(1000);
    const table = tanstack(rows);
    for (const op of OPERATIONS)
      for (const i of [0, 1] as const)
        expect([op.label, i, ours(rows, op.ours[i]).length]).toEqual([
          op.label,
          i,
          table(op.tanstack[i]).length,
        ]);
  });

  it.runIf(RUN)(
    "bench",
    async () => {
      const lines: string[] = [];
      for (const size of SIZES) {
        const rows = makeRows(size);
        const fresh = () => rows.map((row) => ({ ...row }));
        const same = () => rows;
        for (const op of OPERATIONS) {
          const arms: Record<string, { fresh: Timing; change: Timing }> = {};
          arms.ours = {
            fresh: await time(fresh, (input) => {
              const out = ours(input, op.ours[0]);
              op.read?.(out);
            }),
            change: await time(same, (input, i) => {
              const out = ours(input, op.ours[i % 2]!);
              op.read?.(out);
            }),
          };
          for (const collate of op.label.startsWith("sort — text")
            ? [false, true]
            : [false]) {
            const warm = tanstack(rows, collate);
            warm(op.tanstack[1]);
            arms[collate ? "tanstack+collator" : "tanstack"] = {
              fresh: await time(fresh, (input) => {
                const out = tanstack(input, collate)(op.tanstack[0]);
                op.read?.(out);
              }),
              change: await time(same, (_input, i) => {
                const out = warm(op.tanstack[i % 2]!);
                op.read?.(out);
              }),
            };
          }
          process.stderr.write(
            `[bench] ${size} ${op.label} heap ${Math.round(process.memoryUsage().heapUsed / 1e6)} MB\n`,
          );
          for (const [arm, t] of Object.entries(arms))
            lines.push(
              `| ${size} | ${op.label} | ${arm} | ${t.fresh.median.toFixed(2)} | ${t.fresh.p95.toFixed(2)} | ${t.change.median.toFixed(2)} | ${t.change.p95.toFixed(2)} |`,
            );
        }
      }
      const table = [
        `| rows | operation | engine | new data median (ms) | p95 | state change median (ms) | p95 |`,
        "| --- | --- | --- | --- | --- | --- | --- |",
        ...lines,
      ].join("\n");
      console.log(
        `\ndata grid row model (node ${process.version}, ${RUNS} runs)\n${table}\n`,
      );
      if (process.env.DATAGRID_BENCH_OUT)
        writeFileSync(process.env.DATAGRID_BENCH_OUT, `${table}\n`);
    },
    600_000,
  );
});
