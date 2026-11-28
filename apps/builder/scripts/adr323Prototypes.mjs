// ADR-323 Phase 0 시제품 — breakdown §7 의 P1 ~ P4 를 설치된 RAC 1.22.1 · react-aria 3.53.1 위에서 본다
// (제품 코드가 아니다). 판정은 `adr323-phase0-prototypes.mjs` 가 실제 브라우저의 접근성 트리 · focus ·
// rAF 간격 · 좌표로 한다.
//   p1  월 칸 안 일정 글자 — `CalendarCell` 자식으로 넣은 글자가 칸의 낭독 이름에 실리는가 · 날짜 키
//       이동이 대조군 (자식 없는 Calendar) 과 같은가
//   p2  주 보기 — 한 주 200 건 (같은 시각 20 건 겹침) 의 겹침 기하 계산 시간 · 일정 Button 200 개의
//       첫 표시 · 주 넘기기 frame
//   p3  Table 시간축 열 — 5,000 행 · 넓은 열 하나 (칸 안 Button 막대) · 앞 열 고정. 세로 · 가로 스크롤
//       frame (대조군 = 시간축 열 없는 같은 Table) · 키로 막대 Button 에 닿는가
//   p4  끌기 — `useMove` 의 포인터 handler 만 붙인 일정 Button 의 옮기기 · 끝 길이 조절 · press 와의
//       구분 · pointer capture (스크롤 영역 밖 · iframe 위에서 놓기) · 끄는 동안만 document keydown 의
//       Escape 취소 (Modal Dialog 안에서 포함)
import {
  createElement as h,
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { mergeProps, useMove } from "react-aria";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  Cell,
  Column,
  Dialog,
  Group,
  Heading,
  Modal,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableLayout,
  Virtualizer,
} from "react-aria-components";
// (apps/builder 는 직접 의존하지 않는다 — shared 의 설치본을 읽는다.)
import { CalendarDate } from "../../../packages/shared/node_modules/@internationalized/date";

// ---------------------------------------------------------------------------------------------
// 공용 — 결정적 난수
// ---------------------------------------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// ---------------------------------------------------------------------------------------------
// P1 — 월 칸 안 일정 글자
// ---------------------------------------------------------------------------------------------
const P1_EVENTS = {
  "2026-11-10": ["Design review", "Standup", "Lunch", "Client call"],
  "2026-11-16": ["Release"],
};
function MonthCalendar({ id, withEvents }) {
  return h(
    Calendar,
    {
      id,
      "aria-label": id,
      defaultFocusedValue: new CalendarDate(2026, 11, 15),
      style: { font: "13px system-ui", width: 560 },
    },
    h(
      "header",
      { style: { display: "flex", gap: 8 } },
      h(Button, { slot: "previous" }, "‹"),
      h(Heading),
      h(Button, { slot: "next" }, "›"),
    ),
    h(CalendarGrid, null, (date) =>
      h(
        CalendarCell,
        { date, style: { height: 64, verticalAlign: "top", padding: 2 } },
        ({ formattedDate }) => {
          const events = withEvents ? P1_EVENTS[date.toString()] : undefined;
          if (!events) return formattedDate;
          const shown = events.slice(0, 2);
          return h(
            Fragment,
            null,
            h("span", { "data-day": "" }, formattedDate),
            ...shown.map((title, i) =>
              h(
                "span",
                {
                  key: i,
                  "data-event": "",
                  style: { display: "block", fontSize: 11 },
                },
                title,
              ),
            ),
            events.length > shown.length
              ? h(
                  "span",
                  { "data-more": "", style: { fontSize: 11 } },
                  `+${events.length - shown.length}`,
                )
              : null,
          );
        },
      ),
    ),
  );
}
function P1() {
  return h(
    "div",
    { style: { display: "flex", gap: 24, padding: 16 } },
    h(MonthCalendar, { id: "control", withEvents: false }),
    h(MonthCalendar, { id: "events", withEvents: true }),
  );
}

// ---------------------------------------------------------------------------------------------
// P2 — 주 보기 겹침 기하 (breakdown §5.2 시간 격자의 시제품)
// ---------------------------------------------------------------------------------------------
const MIN_PX = 1; // 1 분 = 1 px (하루 1,440 px)
/**
 * 하루 안 일정의 겹침 칸 나누기 — 시작 순으로 훑으며 겹치는 덩어리를 만들고, 덩어리 안에서 비는 첫
 * 칸에 놓는다. 덩어리의 칸 수가 폭을 정한다. O(n · 칸 수).
 */
export function layoutDay(events) {
  const sorted = events
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map();
  let cluster = [];
  let columns = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const item of cluster)
      out.set(item.id, { column: item.column, columns: columns.length });
    cluster = [];
    columns = [];
  };
  for (const event of sorted) {
    if (event.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let column = columns.findIndex((end) => end <= event.start);
    if (column < 0) {
      column = columns.length;
      columns.push(event.end);
    } else columns[column] = event.end;
    cluster.push({ id: event.id, column });
    clusterEnd = Math.max(clusterEnd, event.end);
  }
  flush();
  return out;
}
export function layoutWeek(events) {
  const byDay = Array.from({ length: 7 }, () => []);
  for (const event of events) byDay[event.day].push(event);
  return byDay.map((day) => {
    const cells = layoutDay(day);
    return day
      .slice()
      .sort((a, b) => a.start - b.start || a.id - b.id)
      .map((event) => {
        const { column, columns } = cells.get(event.id);
        return {
          id: event.id,
          title: event.title,
          top: event.start * MIN_PX,
          height: Math.max(15, (event.end - event.start) * MIN_PX),
          left: column / columns,
          width: 1 / columns,
        };
      });
  });
}
function weekEvents(week, count) {
  const random = rng(week * 7919 + 17);
  const events = [];
  // 같은 시각 20 건 — 수요일 10:00 ~ 11:00.
  for (let i = 0; i < 20; i++)
    events.push({
      id: events.length,
      day: 3,
      start: 600,
      end: 660,
      title: `W${week} stack ${i}`,
    });
  while (events.length < count) {
    const start = 480 + Math.floor(random() * 48) * 15;
    events.push({
      id: events.length,
      day: Math.floor(random() * 7),
      start,
      end: start + 30 + Math.floor(random() * 7) * 15,
      title: `W${week} event ${events.length}`,
    });
  }
  return events;
}
function WeekView({ count }) {
  const [week, setWeek] = useState(0);
  const events = useMemo(() => weekEvents(week, count), [week, count]);
  const t0 = performance.now();
  const days = useMemo(() => layoutWeek(events), [events]);
  (window.__geomMs ??= []).push(performance.now() - t0);
  window.__setWeek = setWeek;
  return h(
    "div",
    { style: { font: "12px system-ui", padding: 8 } },
    h(
      "div",
      { style: { display: "flex", gap: 8, marginBottom: 8 } },
      h(Button, { id: "prev", onPress: () => setWeek((w) => w - 1) }, "Prev"),
      h(Button, { id: "next", onPress: () => setWeek((w) => w + 1) }, "Next"),
      h("span", { id: "week" }, `Week ${week}`),
    ),
    h(
      "div",
      {
        id: "scroller",
        style: {
          position: "relative",
          height: 680,
          overflow: "auto",
          border: "1px solid #ccc",
        },
      },
      h(
        "div",
        { style: { position: "relative", height: 1440, display: "flex" } },
        // 장식 층 (예외 1 — 숨김 속성): 시간 눈금선.
        h(
          "div",
          {
            "aria-hidden": "true",
            style: { position: "absolute", inset: 0, pointerEvents: "none" },
          },
          Array.from({ length: 24 }, (_, hour) =>
            h("div", {
              key: hour,
              style: {
                position: "absolute",
                top: hour * 60,
                left: 0,
                right: 0,
                borderTop: "1px solid #eee",
              },
            }),
          ),
        ),
        days.map((items, day) =>
          h(
            Group,
            {
              key: day,
              "aria-label": `Day ${day}`,
              style: {
                position: "relative",
                flex: 1,
                borderLeft: "1px solid #ddd",
              },
            },
            items.map((item) =>
              h(
                Button,
                {
                  key: item.id,
                  "data-event-id": item.id,
                  style: {
                    position: "absolute",
                    top: item.top,
                    height: item.height,
                    left: `${item.left * 100}%`,
                    width: `${item.width * 100}%`,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    padding: 1,
                    border: "1px solid #36c",
                    background: "#def",
                    font: "10px system-ui",
                    textAlign: "start",
                  },
                },
                item.title,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// P3 — Table 시간축 열
// ---------------------------------------------------------------------------------------------
const AXIS_WIDTH = 3000; // 100 일 × 30 px
class PinLayout extends TableLayout {
  isStickyColumn(node) {
    const column =
      node.type === "column"
        ? node
        : this.virtualizer.collection.columns[node.colIndex ?? node.index];
    return column?.key === "task";
  }
  buildTableHeader() {
    const header = super.buildTableHeader();
    header.layoutInfo.allowOverflow = true;
    return header;
  }
  buildRowGroup(y, node) {
    const group = super.buildRowGroup(y, node);
    group.layoutInfo.allowOverflow = true;
    return group;
  }
}
function taskRows(count) {
  const random = rng(323);
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor(random() * 90);
    return {
      id: `t${i}`,
      task: `Task ${i}`,
      start,
      end: start + 1 + Math.floor(random() * 10),
      progress: Math.floor(random() * 100),
    };
  });
}
function GanttTable({ axis, rowCount }) {
  const rows = useMemo(() => taskRows(rowCount), [rowCount]);
  const columns = useMemo(
    () => [
      { key: "task", label: "Task", width: 180 },
      { key: "start", label: "Start", width: 90 },
      { key: "end", label: "End", width: 90 },
      { key: "owner", label: "Owner", width: 120 },
      ...(axis ? [{ key: "axis", label: "Timeline", width: AXIS_WIDTH }] : []),
    ],
    [axis],
  );
  const cellStyle = {
    boxSizing: "border-box",
    padding: "0 6px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    height: 32,
    lineHeight: "32px",
    background: "#fff",
  };
  return h(
    Fragment,
    null,
    h(
      "style",
      null,
      `#gantt [role=row]{display:flex}
       #gantt [data-pin]{box-shadow:1px 0 0 #999;z-index:2}
       #gantt [data-bar]{position:absolute;top:6px;height:20px;padding:0;border:1px solid #36c;background:#def;border-radius:3px;font:10px system-ui;overflow:hidden}
       #gantt [data-bar] span{position:absolute;inset:0 auto 0 0;background:#9bd}
       #gantt [data-bar]:focus-visible{outline:2px solid #f60}`,
    ),
    h(
      Virtualizer,
      {
        layout: PinLayout,
        layoutOptions: { rowHeight: 32, headingHeight: 32 },
      },
      h(
        Table,
        {
          "aria-label": "Tasks",
          id: "gantt",
          style: {
            height: 640,
            width: 1200,
            overflow: "auto",
            font: "13px system-ui",
            border: "1px solid #ccc",
          },
        },
        h(TableHeader, { columns }, (column) =>
          h(
            Column,
            {
              id: column.key,
              isRowHeader: column.key === "task",
              width: column.width,
              style: { ...cellStyle, fontWeight: 600 },
              ...(column.key === "task" ? { "data-pin": "start" } : {}),
            },
            column.label,
          ),
        ),
        h(TableBody, { items: rows }, (item) =>
          h(Row, { columns }, (column) =>
            h(
              Cell,
              {
                style: {
                  ...cellStyle,
                  ...(column.key === "axis" ? { position: "relative" } : {}),
                },
                ...(column.key === "task" ? { "data-pin": "start" } : {}),
              },
              column.key === "axis"
                ? h(
                    Button,
                    {
                      "data-bar": item.id,
                      "aria-label": `${item.task}, day ${item.start} to day ${item.end}, ${item.progress}%`,
                      onPress: () => {
                        window.__pressed = item.id;
                      },
                      style: {
                        left: item.start * 30,
                        width: (item.end - item.start) * 30,
                      },
                    },
                    h("span", {
                      "aria-hidden": "true",
                      style: { width: `${item.progress}%` },
                    }),
                  )
                : column.key === "owner"
                  ? `Owner ${item.start % 7}`
                  : String(item[column.key]),
            ),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// P4 — 끌기 (닫힌 예외 2 의 모양 — 포인터 handler + pointer capture, 끄는 동안만 Escape listener)
// ---------------------------------------------------------------------------------------------
const SNAP = 15; // 분
window.__p4 = {
  commits: 0,
  presses: 0,
  escListeners: 0,
  cancels: 0,
  log: [],
};
function DraggableEvent({ initial, capture, stopEscape }) {
  const [range, setRange] = useState(initial);
  const ref = useRef(null);
  const drag = useRef(null);
  const wasDrag = useRef(false);
  const snap = (minutes) => Math.round(minutes / SNAP) * SNAP;
  const styleOf = (r) => ({
    top: `${r.start}px`,
    height: `${r.end - r.start}px`,
  });
  const apply = (r) => Object.assign(ref.current.style, styleOf(r));
  const end = () => {
    const d = drag.current;
    if (!d) return;
    wasDrag.current = d.moved > 3 || d.cancelled;
    ownerDocument().removeEventListener("keydown", d.onKey, true);
    window.__p4.escListeners--;
    drag.current = null;
  };
  const ownerDocument = () => ref.current?.ownerDocument ?? document;
  const { moveProps } = useMove({
    onMoveStart() {
      if (drag.current) drag.current.moved = 0;
    },
    onMove(e) {
      const d = drag.current;
      if (!d || d.cancelled) return;
      d.moved += Math.abs(e.deltaY) + Math.abs(e.deltaX);
      d.dy += e.deltaY;
      const delta = snap(d.dy / MIN_PX);
      const r = d.origin;
      d.next =
        d.mode === "move"
          ? { start: r.start + delta, end: r.end + delta }
          : {
              start: r.start,
              end: Math.max(r.start + SNAP, r.end + delta),
            };
      apply(d.next);
    },
    onMoveEnd() {
      const d = drag.current;
      if (!d) return;
      if (!d.cancelled && d.moved > 3 && d.next) {
        window.__p4.commits++;
        window.__p4.log.push({ kind: "commit", ...d.next });
        setRange(d.next);
      }
      end();
    },
  });
  const onPointerDown = (e) => {
    wasDrag.current = false;
    const mode = e.target.closest("[data-edge]") ? "resize" : "move";
    const onKey = (key) => {
      window.__p4.log.push({ kind: "key", key: key.key });
      if (key.key !== "Escape" || !drag.current) return;
      if (stopEscape) key.stopPropagation();
      const d = drag.current;
      d.cancelled = true;
      apply(d.origin);
      if (ref.current.hasPointerCapture?.(d.pointerId))
        ref.current.releasePointerCapture(d.pointerId);
      window.__p4.cancels++;
    };
    drag.current = {
      mode,
      origin: range,
      dy: 0,
      moved: 0,
      cancelled: false,
      next: null,
      pointerId: e.pointerId,
      onKey,
    };
    ownerDocument().addEventListener("keydown", onKey, true);
    window.__p4.escListeners++;
    // (RAC Button 의 usePress 가 같은 pointerdown 에서 capture 를 푼다 — `usePress.mjs:355-361`. 그 뒤에
    //  잡는다: React 의 root listener 가 끝난 직후의 microtask.)
    const el = ref.current;
    if (capture) queueMicrotask(() => el.setPointerCapture(e.pointerId));
    moveProps.onPointerDown?.(e);
  };
  // 끌기 없이 놓은 누르기도 listener 를 뗀다 — useMove 의 window listener (onMoveEnd) 뒤에 (setTimeout).
  const onPointerUp = () => setTimeout(end, 0);
  // (useMove 는 pointercancel 도 onMoveEnd 로 보낸다 — 취소로 다룬다.)
  const onPointerCancel = () => {
    if (drag.current) drag.current.cancelled = true;
    setTimeout(end, 0);
  };
  return h(
    Button,
    {
      ref,
      id: "ev",
      onPress: () => {
        if (wasDrag.current || drag.current?.moved > 3) return;
        window.__p4.presses++;
      },
      ...mergeProps({ onPointerDown, onPointerUp, onPointerCancel }),
      style: {
        position: "absolute",
        left: 4,
        right: 4,
        ...styleOf(range),
        boxSizing: "border-box",
        border: "1px solid #36c",
        background: "#def",
        font: "11px system-ui",
        touchAction: "none",
      },
      "data-start": range.start,
      "data-end": range.end,
    },
    "Event",
    h("span", {
      "data-edge": "end",
      "aria-hidden": "true",
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 6,
        cursor: "ns-resize",
      },
    }),
  );
}
function DragArea(options) {
  return h(
    "div",
    { style: { display: "flex", gap: 16, padding: 16 } },
    h(
      "div",
      {
        id: "scroll",
        style: {
          position: "relative",
          width: 300,
          height: 400,
          overflow: "auto",
          border: "1px solid #ccc",
        },
      },
      h(
        "div",
        { style: { position: "relative", height: 1440 } },
        h(DraggableEvent, { initial: { start: 120, end: 180 }, ...options }),
      ),
    ),
    h("iframe", {
      id: "frame",
      srcdoc: "<body style='margin:0;background:#fde'>iframe</body>",
      style: { width: 300, height: 400, border: 0 },
    }),
  );
}
function P4(options) {
  const [open, setOpen] = useState(options.inDialog);
  window.__dialogOpen = () => open;
  if (!options.inDialog) return h(DragArea, options);
  return h(
    Modal,
    { isOpen: open, onOpenChange: setOpen, isDismissable: true },
    h(Dialog, { "aria-label": "Edit", id: "dialog" }, h(DragArea, options)),
  );
}

// ---------------------------------------------------------------------------------------------
function App({ options }) {
  useLayoutEffect(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.__ready = true;
      }),
    );
  }, []);
  switch (options.kind) {
    case "p1":
      return h(P1);
    case "p2":
      return h(WeekView, { count: options.count ?? 200 });
    case "p3":
      return h(GanttTable, {
        axis: options.axis ?? true,
        rowCount: options.rowCount ?? 5000,
      });
    default:
      return h(P4, {
        capture: options.capture ?? true,
        stopEscape: options.stopEscape ?? false,
        inDialog: options.inDialog ?? false,
      });
  }
}

export function mount(input = {}) {
  window.__ready = false;
  window.__geomMs = [];
  window.__mountAt = performance.now();
  const root = document.createElement("div");
  document.body.append(root);
  createRoot(root).render(h(App, { options: input }));
}
