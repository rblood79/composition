// ADR-320 Phase 0 시제품 — breakdown §4 조립 표 그대로 설치된 RAC 부품만으로 만든 작은 필터 바 (제품 코드가 아니다).
// 판정은 `adr320-phase0-prototypes.mjs` 가 실제 브라우저 (Chrome · WebKit) 의 focus · DOM · 접근성 트리로 한다.
//   p1   칩 줄 — `Toolbar` > `Group` > 버튼 넷 (비교 `MenuTrigger` · 값 `DialogTrigger` · 조건 메뉴 · 삭제)
//   p2   조건 빌더 — `Tree` 행 안의 버튼 셋 + 메뉴, 묶음 행, `useDragAndDrop` (포인터 · 키보드)
//   p3   「또는」 묶음의 행 필터 — 조건마다 통과 행 집합 (`viewRowsPassing`) 을 묶음의 op 로 합친 시간과
//        지금 경로 (평평한 「그리고」 한 번) 의 시간. 정답은 여기 따로 적은 술어 (비교 구현을 부르지 않는다)
//   p4   `announce` — private 경로 import 가 production 빌드에서 live region 에 문구를 싣는가
// D1 예외 0 의 조건을 시제품도 지킨다: `role=` · `aria-*` 리터럴 요소 · `onKeyDown` 없음 (RAC prop 의
// `aria-label` 만).
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { announce } from "react-aria/private/live-announcer/LiveAnnouncer";
import {
  Button,
  Collection,
  Dialog,
  DialogTrigger,
  Group,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  TextField,
  Toolbar,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
} from "react-aria-components";
import { viewRowsPassing } from "../../../packages/shared/src/collections/view/rowFilter.ts";

const OPS = { equals: "같음", contains: "포함", notEquals: "같지 않음" };

// ── p1 ────────────────────────────────────────────────────────────────────────────────────────
function ChipBar() {
  const [conditions, setConditions] = useState([
    { id: "c1", field: "부서", op: "equals", value: "영업", enabled: true },
    { id: "c2", field: "지역", op: "contains", value: "서울", enabled: true },
  ]);
  const patch = (id, next) =>
    setConditions((list) =>
      list.map((item) => (item.id === id ? { ...item, ...next } : item)),
    );
  window.__state = () => conditions;
  return h(
    "div",
    null,
    h(Button, { "data-part": "before" }, "앞"),
    h(
      Toolbar,
      { "aria-label": "필터", "data-part": "toolbar" },
      conditions.map((item) =>
        h(
          Group,
          {
            key: item.id,
            "data-chip": item.id,
            "aria-label": `${item.field} ${OPS[item.op]} ${item.value}${item.enabled ? "" : " 꺼짐"}`,
          },
          h("span", null, item.field),
          h(
            MenuTrigger,
            null,
            h(Button, { "data-part": `${item.id}-op` }, OPS[item.op]),
            h(
              Popover,
              null,
              h(
                Menu,
                {
                  "aria-label": "비교",
                  selectionMode: "single",
                  selectedKeys: [item.op],
                  onSelectionChange: (keys) => {
                    const [op] = [...keys];
                    if (op) patch(item.id, { op });
                  },
                },
                Object.entries(OPS).map(([op, label]) =>
                  h(MenuItem, { key: op, id: op }, label),
                ),
              ),
            ),
          ),
          h(
            DialogTrigger,
            null,
            h(
              Button,
              { "data-part": `${item.id}-value` },
              item.value || "값 없음",
            ),
            h(
              Popover,
              null,
              h(
                Dialog,
                { "aria-label": "값" },
                h(
                  TextField,
                  {
                    "aria-label": "값",
                    autoFocus: true,
                    value: item.value,
                    onChange: (value) => patch(item.id, { value }),
                  },
                  h(Input, { "data-part": `${item.id}-input` }),
                ),
              ),
            ),
          ),
          h(
            MenuTrigger,
            null,
            h(
              Button,
              { "data-part": `${item.id}-menu`, "aria-label": "조건 메뉴" },
              "⋯",
            ),
            h(
              Popover,
              null,
              h(
                Menu,
                {
                  "aria-label": "조건 메뉴",
                  onAction: (key) => {
                    if (key === "toggle")
                      patch(item.id, { enabled: !item.enabled });
                    if (key === "remove")
                      setConditions((list) =>
                        list.filter((other) => other.id !== item.id),
                      );
                    if (key === "copy")
                      setConditions((list) => [
                        ...list,
                        { ...item, id: `${item.id}x` },
                      ]);
                  },
                },
                h(MenuItem, { id: "copy" }, "복제"),
                h(MenuItem, { id: "toggle" }, item.enabled ? "끄기" : "켜기"),
                h(MenuItem, { id: "remove" }, "삭제"),
              ),
            ),
          ),
          h(
            Button,
            {
              "data-part": `${item.id}-remove`,
              "aria-label": "삭제",
              onPress: () =>
                setConditions((list) =>
                  list.filter((other) => other.id !== item.id),
                ),
            },
            "×",
          ),
        ),
      ),
      h(Button, { "data-part": "add" }, "필터 추가"),
      h(Button, { "data-part": "clear" }, "지우기"),
    ),
    h(Button, { "data-part": "after" }, "뒤"),
  );
}

// ── p2 ────────────────────────────────────────────────────────────────────────────────────────
const START_TREE = [
  { id: "c1", field: "부서", op: "equals", value: "영업" },
  {
    id: "g1",
    op: "or",
    items: [
      { id: "c2", field: "지역", op: "equals", value: "서울" },
      { id: "c3", field: "지역", op: "equals", value: "부산" },
      {
        id: "g2",
        op: "and",
        items: [{ id: "c4", field: "상태", op: "notEquals", value: "closed" }],
      },
    ],
  },
  { id: "c5", field: "점수", op: "equals", value: "20" },
];
const shapeOf = (items) =>
  items
    .map((item) =>
      item.items ? `${item.id}[${shapeOf(item.items)}]` : item.id,
    )
    .join(",");
/** `id` 를 뺀 목록과 뺀 노드. */
function without(items, ids) {
  const taken = [];
  const walk = (list) =>
    list.flatMap((item) => {
      if (ids.has(item.id)) {
        taken.push(item);
        return [];
      }
      return [item.items ? { ...item, items: walk(item.items) } : item];
    });
  return [walk(items), taken];
}
/** `target` 의 앞 · 뒤 · 안에 `nodes` 를 넣은 목록. */
function placed(items, target, position, nodes) {
  return items.flatMap((item) => {
    const own = item.items
      ? {
          ...item,
          items:
            item.id === target && position === "on"
              ? [...item.items, ...nodes]
              : placed(item.items, target, position, nodes),
        }
      : item;
    if (item.id !== target || position === "on") return [own];
    return position === "before" ? [...nodes, own] : [own, ...nodes];
  });
}
const findNode = (items, id) => {
  for (const item of items) {
    if (item.id === id) return item;
    const inner = item.items && findNode(item.items, id);
    if (inner) return inner;
  }
  return undefined;
};

function Builder() {
  const [items, setItems] = useState(START_TREE);
  window.__state = () => shapeOf(items);
  window.__ops = () => {
    const out = {};
    const walk = (list) =>
      list.forEach((item) => {
        if (item.items) {
          out[item.id] = item.op;
          walk(item.items);
        }
      });
    walk(items);
    return out;
  };
  const toggle = (id) => {
    const walk = (list) =>
      list.map((item) =>
        item.items
          ? {
              ...item,
              op: item.id === id ? (item.op === "and" ? "or" : "and") : item.op,
              items: walk(item.items),
            }
          : item,
      );
    setItems(walk);
  };
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    // (묶음 행만 「안에 놓기」 를 받는다 — 조건 행 위에는 놓을 수 없다.)
    shouldAcceptItemDrop: (target) => !!findNode(items, target.key)?.items,
    onMove(event) {
      const { key, dropPosition } = event.target;
      (window.__moves ??= []).push(
        `${[...event.keys].join("+")}→${dropPosition}:${key}`,
      );
      if (event.keys.has(key)) return;
      setItems((list) => {
        const [rest, taken] = without(list, event.keys);
        // (자기 자손 안으로는 옮기지 않는다 — 뺀 뒤 대상이 없으면 그대로.)
        if (!findNode(rest, key)) return list;
        return placed(rest, key, dropPosition, taken);
      });
    },
  });
  const rowMenu = (item) =>
    h(
      MenuTrigger,
      null,
      h(
        Button,
        { "data-part": `${item.id}-menu`, "aria-label": "행 메뉴" },
        "⋯",
      ),
      h(
        Popover,
        null,
        h(
          Menu,
          { "aria-label": "행 메뉴" },
          h(MenuItem, { id: "copy" }, "복제"),
          h(MenuItem, { id: "remove" }, "삭제"),
        ),
      ),
    );
  const renderItem = (item) =>
    h(
      TreeItem,
      {
        id: item.id,
        "data-row": item.id,
        textValue: item.items
          ? `묶음 ${item.op === "or" ? "또는" : "그리고"}`
          : `${item.field} ${OPS[item.op]} ${item.value}`,
      },
      h(
        TreeItemContent,
        null,
        h(Button, { slot: "drag", "data-part": `${item.id}-drag` }, "≡"),
        ...(item.items
          ? [
              h(
                Button,
                { slot: "chevron", "data-part": `${item.id}-chevron` },
                "›",
              ),
              h(
                Button,
                {
                  "data-part": `${item.id}-toggle`,
                  onPress: () => toggle(item.id),
                },
                item.op === "or" ? "또는" : "그리고",
              ),
            ]
          : [
              h(Button, { "data-part": `${item.id}-field` }, item.field),
              h(Button, { "data-part": `${item.id}-op` }, OPS[item.op]),
              h(Button, { "data-part": `${item.id}-value` }, item.value),
            ]),
        rowMenu(item),
      ),
      item.items ? h(Collection, { items: item.items }, renderItem) : null,
    );
  return h(
    "div",
    null,
    h(Button, { "data-part": "before" }, "앞"),
    h(
      Tree,
      {
        "aria-label": "조건",
        "data-part": "tree",
        items,
        defaultExpandedKeys: ["g1", "g2"],
        dragAndDropHooks,
      },
      renderItem,
    ),
    h(Button, { "data-part": "after" }, "뒤"),
  );
}

// ── p3 ────────────────────────────────────────────────────────────────────────────────────────
const DEPTS = ["sales", "dev", "ops", "hr", "fin", "legal", "mkt", "cs"];
const REGIONS = Array.from({ length: 20 }, (_, index) => `r${index}`);
const STATUSES = ["open", "closed", "hold"];
const NAMES = ["kim", "lee", "park", "choi", "jung", "kang", "cho", "yoon"];
/** 결정적 행 (규모 전용 — 분포는 인용하지 않는다). */
function makeRows(count) {
  let seed = 12345;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    dept: DEPTS[next() % DEPTS.length],
    region: REGIONS[next() % REGIONS.length],
    score: next() % 101,
    status: STATUSES[next() % STATUSES.length],
    name: `${NAMES[next() % NAMES.length]} ${index}`,
  }));
}
const testOf = (rows, key, type, op, value) => ({
  fields: [{ valueAt: (index) => rows[index][key], type, name: key }],
  op,
  value,
});
/** 조건 6 — c1 부서 = sales · c2 지역 ∈ {r1, r2} · c3 점수 ≥ 50 · c4 상태 ≠ closed · c5 이름 ∋ kim · c6 점수 < 90. */
const conditionsOf = (rows) => ({
  c1: testOf(rows, "dept", "text", "equals", "sales"),
  c2: testOf(rows, "region", "text", "oneOf", ["r1", "r2"]),
  c3: testOf(rows, "score", "number", "gte", 50),
  c4: testOf(rows, "status", "text", "notEquals", "closed"),
  c5: testOf(rows, "name", "text", "contains", "kim"),
  c6: testOf(rows, "score", "number", "lt", 90),
});
/** 묶음 test — 조건마다 통과 행 집합, 묶음은 건너뛰지 않은 피연산자만 op 로 합친다 (breakdown §5.2). */
function groupPass(count, node, tests) {
  if (typeof node === "string") {
    const { pass } = viewRowsPassing(count, [tests[node]]);
    return pass; // undefined = 건너뜀
  }
  let out;
  for (const item of node.items) {
    const pass = groupPass(count, item, tests);
    if (!pass) continue;
    if (!out) {
      out = pass.slice();
      continue;
    }
    if (node.op === "and")
      for (let index = 0; index < count; index += 1) out[index] &= pass[index];
    else
      for (let index = 0; index < count; index += 1) out[index] |= pass[index];
  }
  return out;
}
// 2 단 중첩 · 「또는」 포함 · 조건 6: c3 그리고 (c1 또는 c2 또는 (c4 그리고 c5)) 그리고 c6
const TREE = {
  op: "and",
  items: [
    "c3",
    { op: "or", items: ["c1", "c2", { op: "and", items: ["c4", "c5"] }] },
    "c6",
  ],
};
// 따로 적은 정답 술어 (비교 구현을 부르지 않는다).
const oracleFlat = (row) =>
  row.dept === "sales" &&
  (row.region === "r1" || row.region === "r2") &&
  row.score >= 50 &&
  row.status !== "closed" &&
  row.name.includes("kim") &&
  row.score < 90;
const oracleTree = (row) =>
  row.score >= 50 &&
  (row.dept === "sales" ||
    row.region === "r1" ||
    row.region === "r2" ||
    (row.status !== "closed" && row.name.includes("kim"))) &&
  row.score < 90;
const countOf = (pass) => {
  let total = 0;
  for (let index = 0; index < pass.length; index += 1) total += pass[index];
  return total;
};
const median = (values) =>
  values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
function runP3(count, runs = 15) {
  const rows = makeRows(count);
  const tests = conditionsOf(rows);
  const flatTests = ["c1", "c2", "c3", "c4", "c5", "c6"].map((id) => tests[id]);
  const flat = () => viewRowsPassing(count, flatTests).pass;
  const tree = () => groupPass(count, TREE, tests);
  // 워밍업
  for (let index = 0; index < 3; index += 1) {
    flat();
    tree();
  }
  const flatMs = [];
  const treeMs = [];
  let flatPass;
  let treePass;
  for (let index = 0; index < runs; index += 1) {
    // 교대 (A/B)
    const order = index % 2 ? [tree, flat] : [flat, tree];
    for (const arm of order) {
      const start = performance.now();
      const pass = arm();
      const took = performance.now() - start;
      if (arm === flat) {
        flatMs.push(took);
        flatPass = pass;
      } else {
        treeMs.push(took);
        treePass = pass;
      }
    }
  }
  let flatWrong = 0;
  let treeWrong = 0;
  for (let index = 0; index < count; index += 1) {
    if (!!flatPass[index] !== oracleFlat(rows[index])) flatWrong += 1;
    if (!!treePass[index] !== oracleTree(rows[index])) treeWrong += 1;
  }
  return {
    count,
    flatMs: median(flatMs),
    treeMs: median(treeMs),
    flatKept: countOf(flatPass),
    treeKept: countOf(treePass),
    flatWrong,
    treeWrong,
  };
}

// ── p4 ────────────────────────────────────────────────────────────────────────────────────────
function Announcer() {
  return h(
    Button,
    { "data-part": "announce", onPress: () => announce("조건 2 개 적용") },
    "알림",
  );
}

export function mount(options) {
  const host = document.createElement("div");
  document.body.replaceChildren(host);
  const kind = options.kind ?? "p1";
  if (kind === "p3") {
    window.__p3 = runP3;
    window.__ready = true;
    return;
  }
  createRoot(host).render(
    h(kind === "p1" ? ChipBar : kind === "p2" ? Builder : Announcer),
  );
  requestAnimationFrame(() => {
    window.__ready = true;
  });
}
