// ADR-322 Phase 0 시제품 — breakdown §3 조립 표 그대로 설치된 RAC 부품만으로 만든 작은 Cascader (제품 코드가 아니다).
// 판정은 `adr322-phase0-prototypes.mjs` 가 실제 브라우저 (Chrome · WebKit) 의 focus · DOM · 접근성 트리 · 시간으로 한다.
//   p1   columns — `MenuTrigger` > `Menu` · `SubmenuTrigger` (재귀) · 끝 항목 단일 선택
//   p2   drill — `DialogTrigger` > `Popover` > `Dialog` > `Breadcrumbs` + 「뒤로」 `Button` + `GridList` (행 동작 = 들어가기)
//   p3   검색 — `Autocomplete` > `SearchField` + `Menu` (평평한 결과 · 경로) / 기록용: `Autocomplete` > `Tree`
//   p4   5,000 항목 · 4 단 — `tree` 방식 열기 (Virtualizer 유무) · `columns` 의 300 항목 단계 열기 · 대조군 `Select` 5,000
//   p5   필수 검증 — RAC `Form` 안의 여는 `Button` + §3.1 의 숨은 값 input + `useFormValidation`
// D1 조건: 조립 쪽은 `role=` · `aria-*` 리터럴 · `onKeyDown` 없음 (RAC prop 의 `aria-label` · `aria-labelledby` ·
// `aria-describedby` 만). 직접 그리는 요소는 p5 의 숨은 값 input 뿐 (§3.1 — 속성은 설치본 `HiddenSelect` 의 길).
import { createElement as h, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  Autocomplete,
  Breadcrumb,
  Breadcrumbs,
  Button,
  Dialog,
  DialogTrigger,
  FieldError,
  FieldErrorContext,
  Form,
  GridList,
  GridListItem,
  Input,
  Label,
  LabelContext,
  Link,
  ListBox,
  ListBoxItem,
  ListLayout,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Provider,
  SearchField,
  Select,
  SelectValue,
  SubmenuTrigger,
  Tree,
  TreeItem,
  TreeItemContent,
  Virtualizer,
  useFilter,
} from "react-aria-components";
import { useField } from "react-aria";
import { useFormValidation } from "react-aria/private/form/useFormValidation";
import { useFormValidationState } from "react-stately/private/form/useFormValidationState";

// ── 자료 ──────────────────────────────────────────────────────────────────────────────────────
/** 작은 계층 (p1 ~ p3 · p5) — 같은 이름의 끝 항목 「중구」 가 두 부모에 있다. */
export const SMALL = [
  {
    key: "11",
    name: "서울",
    children: [
      {
        key: "11-680",
        name: "강남구",
        children: [
          { key: "11-680-1", name: "역삼동" },
          { key: "11-680-2", name: "삼성동" },
        ],
      },
      {
        key: "11-140",
        name: "중구",
        children: [{ key: "11-140-1", name: "명동" }],
      },
    ],
  },
  {
    key: "26",
    name: "부산",
    children: [
      {
        key: "26-110",
        name: "중구",
        children: [{ key: "26-110-1", name: "남포동" }],
      },
    ],
  },
  { key: "36", name: "세종" },
];

/** 부하용 생성 계층 (규모 전용) — 4 단 · 합 5,000 · 한 부모 아래 최대 300. */
export function bigTree() {
  const roots = [];
  let level4Left = 5000 - 4 - 40 - 400;
  let parents3 = 400;
  for (let a = 0; a < 4; a += 1) {
    const l1 = { key: `${a}`, name: `대분류 ${a}`, children: [] };
    for (let b = 0; b < 10; b += 1) {
      const l2 = { key: `${a}-${b}`, name: `중분류 ${a}-${b}`, children: [] };
      for (let c = 0; c < 10; c += 1) {
        const l3 = {
          key: `${a}-${b}-${c}`,
          name: `소분류 ${a}-${b}-${c}`,
          children: [],
        };
        const count =
          a === 0 && b === 0 && c === 0
            ? 300
            : Math.ceil(level4Left / parents3);
        for (let d = 0; d < count; d += 1)
          l3.children.push({
            key: `${a}-${b}-${c}-${d}`,
            name: `세분류 ${a}-${b}-${c}-${d}`,
          });
        level4Left -= count;
        parents3 -= 1;
        l2.children.push(l3);
      }
      l1.children.push(l2);
    }
    roots.push(l1);
  }
  return roots;
}

/** 항목 표 — 경로 식별자 (조상 key 사슬, `/`) · key · 이름 · 조상 이름. */
export function table(nodes, parent = null, out = new Map()) {
  for (const node of nodes) {
    const id = parent ? `${parent.id}/${node.key}` : node.key;
    const entry = {
      id,
      key: node.key,
      name: node.name,
      names: parent ? [...parent.names, node.name] : [node.name],
      parentId: parent?.id ?? null,
      node,
    };
    out.set(id, entry);
    if (node.children) table(node.children, entry, out);
  }
  return out;
}
const pathText = (entry) => entry?.names.join(" / ") ?? "";

// ── p1 columns ────────────────────────────────────────────────────────────────────────────────
function menuItems(nodes, parentId, onPick) {
  return nodes.map((node) => {
    const id = parentId ? `${parentId}/${node.key}` : node.key;
    if (!node.children)
      return h(
        MenuItem,
        { key: id, id, textValue: node.name, "data-part": `item:${id}` },
        node.name,
      );
    return h(
      SubmenuTrigger,
      { key: id },
      h(
        MenuItem,
        { id, textValue: node.name, "data-part": `item:${id}` },
        `${node.name} ›`,
      ),
      h(
        Popover,
        { "data-part": `pop:${id}` },
        h(LevelMenu, { nodes: node.children, parentId: id, onPick }),
      ),
    );
  });
}
function LevelMenu({ nodes, parentId, onPick }) {
  const picked = window.__value;
  return h(
    Menu,
    {
      "aria-label": parentId ? `${parentId} 하위` : "지역",
      selectionMode: "single",
      selectedKeys: picked ? [picked] : [],
      onSelectionChange: (keys) => {
        const [first] = [...keys];
        if (first !== undefined) onPick(String(first));
      },
      "data-part": `menu:${parentId ?? "root"}`,
    },
    menuItems(nodes, parentId, onPick),
  );
}
function Columns() {
  const rows = table(SMALL);
  const [value, setValue] = useState(null);
  window.__value = value;
  window.__state = () => ({ value, text: pathText(rows.get(value)) });
  return h(
    "div",
    null,
    h(Button, { "data-part": "before" }, "앞"),
    h(
      MenuTrigger,
      null,
      h(
        Button,
        { "data-part": "open", "aria-label": "지역" },
        value ? pathText(rows.get(value)) : "고르기",
      ),
      h(
        Popover,
        null,
        h(LevelMenu, { nodes: SMALL, parentId: null, onPick: setValue }),
      ),
    ),
  );
}

// ── p2 drill ──────────────────────────────────────────────────────────────────────────────────
function Drill() {
  const rows = table(SMALL);
  const [value, setValue] = useState(null);
  const [level, setLevel] = useState(null); // 지금 단계의 부모 경로 식별자
  const [open, setOpen] = useState(false);
  window.__state = () => ({ value, level, text: pathText(rows.get(value)) });
  const parent = level ? rows.get(level) : null;
  const nodes = parent ? parent.node.children : SMALL;
  const trail = [];
  for (let at = parent; at; at = at.parentId ? rows.get(at.parentId) : null)
    trail.unshift(at);
  const enter = (id) => {
    const entry = rows.get(id);
    if (entry.node.children) setLevel(id);
    else {
      setValue(id);
      setOpen(false);
    }
  };
  return h(
    "div",
    null,
    h(Button, { "data-part": "before" }, "앞"),
    h(
      DialogTrigger,
      {
        isOpen: open,
        onOpenChange: (next) => {
          setOpen(next);
          if (next) setLevel(value ? rows.get(value).parentId : null);
        },
      },
      h(
        Button,
        { "data-part": "open", "aria-label": "지역" },
        value ? pathText(rows.get(value)) : "고르기",
      ),
      h(
        Popover,
        null,
        h(
          Dialog,
          { "aria-label": "지역 고르기", "data-part": "dialog" },
          h(
            Breadcrumbs,
            { "data-part": "crumbs" },
            h(
              Breadcrumb,
              { id: "root" },
              h(
                Link,
                { onPress: () => setLevel(null), "data-part": "crumb:root" },
                "전체",
              ),
            ),
            trail.map((entry) =>
              h(
                Breadcrumb,
                { key: entry.id, id: entry.id },
                h(
                  Link,
                  {
                    onPress: () => setLevel(entry.id),
                    "data-part": `crumb:${entry.id}`,
                  },
                  entry.name,
                ),
              ),
            ),
          ),
          h(
            Button,
            {
              "data-part": "back",
              isDisabled: !parent,
              onPress: () => setLevel(parent?.parentId ?? null),
            },
            "뒤로",
          ),
          h(
            GridList,
            {
              key: level ?? "root",
              "aria-label": parent ? parent.name : "전체",
              autoFocus: "first",
              // Phase 0 발견: 기본값 (`clearSelection`) 이면 선택이 있는 목록에서 Esc 가 닫기 대신 선택 지우기에 먹힌다.
              escapeKeyBehavior: "none",
              selectionMode: "single",
              selectedKeys: value ? [value] : [],
              onSelectionChange: (keys) => {
                const [first] = [...keys];
                if (first !== undefined) setValue(String(first));
              },
              onAction: (key) => enter(String(key)),
              "data-part": "grid",
            },
            nodes.map((node) => {
              const id = level ? `${level}/${node.key}` : node.key;
              return h(
                GridListItem,
                { key: id, id, textValue: node.name, "data-part": `row:${id}` },
                node.children ? `${node.name} ›` : node.name,
              );
            }),
          ),
        ),
      ),
    ),
  );
}

// ── p3 검색 ───────────────────────────────────────────────────────────────────────────────────
function Search({ withTree }) {
  const rows = [...table(SMALL).values()];
  const { contains } = useFilter({ sensitivity: "base" });
  const [value, setValue] = useState(null);
  window.__state = () => ({ value });
  if (withTree)
    return h(
      Autocomplete,
      { filter: contains },
      h(
        SearchField,
        { "aria-label": "찾기" },
        h(Input, { "data-part": "search" }),
      ),
      h(
        Tree,
        {
          "aria-label": "지역",
          "data-part": "tree",
          defaultExpandedKeys: rows.map((row) => row.id),
        },
        treeItems(SMALL, null),
      ),
    );
  const leaves = rows.filter((row) => !row.node.children);
  return h(
    "div",
    null,
    h(
      Autocomplete,
      { filter: contains },
      h(
        SearchField,
        { "aria-label": "찾기" },
        h(Input, { "data-part": "search" }),
      ),
      h(
        Menu,
        {
          "aria-label": "찾은 항목",
          selectionMode: "single",
          selectedKeys: value ? [value] : [],
          onSelectionChange: (keys) => {
            const [first] = [...keys];
            if (first !== undefined) setValue(String(first));
          },
          "data-part": "results",
        },
        leaves.map((row) =>
          h(
            MenuItem,
            {
              key: row.id,
              id: row.id,
              textValue: row.name,
              "data-part": `hit:${row.id}`,
            },
            `${row.name} — ${pathText(row)}`,
          ),
        ),
      ),
    ),
  );
}

// ── tree (p3 기록 · p4) ───────────────────────────────────────────────────────────────────────
function treeItems(nodes, parentId) {
  return nodes.map((node) => {
    const id = parentId ? `${parentId}/${node.key}` : node.key;
    return h(
      TreeItem,
      { key: id, id, textValue: node.name },
      h(
        TreeItemContent,
        null,
        node.children ? h(Button, { slot: "chevron" }, "›") : null,
        node.name,
      ),
      node.children ? treeItems(node.children, id) : null,
    );
  });
}

// ── p4 속도 ───────────────────────────────────────────────────────────────────────────────────
let BIG = null;
let BIG_ROWS = null;
function bigData() {
  if (!BIG) {
    BIG = bigTree();
    BIG_ROWS = table(BIG);
  }
  return { nodes: BIG, rows: BIG_ROWS };
}
function TreePicker({ virtual }) {
  const { nodes, rows } = bigData();
  const expanded = [...rows.values()]
    .filter((row) => row.node.children)
    .map((row) => row.id);
  const tree = h(
    Tree,
    {
      "aria-label": "분류",
      selectionMode: "single",
      escapeKeyBehavior: "none",
      defaultExpandedKeys: expanded,
      "data-part": "tree",
      style: virtual
        ? { height: 360, overflow: "auto", display: "block" }
        : undefined,
    },
    treeItems(nodes, null),
  );
  return h(
    DialogTrigger,
    null,
    h(Button, { "data-part": "open" }, "분류"),
    h(
      Popover,
      { style: { maxHeight: 420, overflow: "auto" } },
      h(
        Dialog,
        { "aria-label": "분류 고르기" },
        virtual
          ? h(
              Virtualizer,
              { layout: ListLayout, layoutOptions: { rowHeight: 28 } },
              tree,
            )
          : tree,
      ),
    ),
  );
}
function BigColumns() {
  const { nodes } = bigData();
  return h(
    MenuTrigger,
    null,
    h(Button, { "data-part": "open" }, "분류"),
    h(Popover, null, h(LevelMenu, { nodes, parentId: null, onPick: () => {} })),
  );
}
function BigSelect() {
  const { rows } = bigData();
  const leaves = [...rows.values()].slice(0, 5000);
  return h(
    Select,
    { "aria-label": "분류" },
    h(Button, { "data-part": "open" }, h(SelectValue)),
    h(
      Popover,
      { style: { maxHeight: 420, overflow: "auto" } },
      h(
        ListBox,
        { "data-part": "listbox" },
        leaves.map((row) =>
          h(
            ListBoxItem,
            { key: row.id, id: row.id, textValue: row.name },
            row.name,
          ),
        ),
      ),
    ),
  );
}

// ── p5 필수 검증 ──────────────────────────────────────────────────────────────────────────────
/**
 * §3.1 의 필드 — 여는 Button + 숨은 값 input. `cfg`: `{ behavior, name, required, disabled, multiple, initial }`.
 * 값을 고르는 일은 `window.__set(keys)` 가 대신한다 (조립 셋의 고르기는 p1 · p2 가 본다).
 */
function RequiredField({ cfg }) {
  const [value, setValue] = useState(cfg.initial ?? []);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const state = useFormValidationState({
    value: value.join(","),
    isRequired: cfg.required,
    validationBehavior: cfg.behavior,
  });
  useFormValidation(
    {
      validationBehavior: cfg.behavior,
      focus: () => buttonRef.current?.focus(),
    },
    state,
    inputRef,
  );
  window.__set = (keys) => {
    flushSync(() => setValue(keys));
    state.commitValidation();
  };
  const invalid = state.displayValidation.isInvalid;
  const { labelProps, fieldProps, errorMessageProps } = useField({
    label: "지역",
    errorMessage: invalid ? "오류" : undefined,
    isInvalid: invalid,
    validationBehavior: cfg.behavior,
  });
  const native = cfg.behavior === "native";
  const draws = Boolean(cfg.name) || (native && cfg.required);
  const values = !draws
    ? []
    : value.length === 0
      ? [""]
      : cfg.name
        ? value
        : [value[0]];
  return h(
    Provider,
    {
      values: [
        [LabelContext, labelProps],
        [FieldErrorContext, state.displayValidation],
      ],
    },
    h(Label, null, "지역"),
    h(
      Button,
      {
        ref: buttonRef,
        id: fieldProps.id,
        "aria-labelledby": fieldProps["aria-labelledby"],
        "aria-describedby": fieldProps["aria-describedby"],
        isDisabled: cfg.disabled,
        "data-part": "open",
      },
      value.length ? value.join(", ") : "고르기",
    ),
    values.map((item, index) =>
      h("input", {
        key: index,
        ref: index === 0 ? inputRef : undefined,
        name: cfg.name || undefined,
        value: item,
        disabled: cfg.disabled,
        type: native ? "text" : "hidden",
        style: native ? { display: "none" } : undefined,
        required: native && cfg.required && index === 0,
        onChange: () => {},
      }),
    ),
    h(FieldError, { ...errorMessageProps, "data-part": "error" }),
  );
}
function FormCase({ cfg }) {
  const [log, setLog] = useState({ submits: 0, entries: [] });
  window.__state = () => log;
  return h(
    Form,
    {
      validationBehavior: cfg.behavior,
      "data-part": "form",
      onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setLog((prev) => ({
          submits: prev.submits + 1,
          entries: [...data.entries()],
        }));
      },
    },
    h("input", { "data-part": "text", "aria-label": "메모" }),
    h(RequiredField, { cfg }),
    h(Button, { type: "submit", "data-part": "submit" }, "보내기"),
  );
}

// ── 마운트 ────────────────────────────────────────────────────────────────────────────────────
const VIEWS = {
  p1: () => h(Columns),
  p2: () => h(Drill),
  p3: () => h(Search, { withTree: false }),
  p3tree: () => h(Search, { withTree: true }),
  p4tree: () => h(TreePicker, { virtual: false }),
  p4virtual: () => h(TreePicker, { virtual: true }),
  p4columns: () => h(BigColumns),
  p4select: () => h(BigSelect),
};
let root = null;
export function mount(options) {
  const host = document.createElement("div");
  document.body.replaceChildren(host);
  root?.unmount();
  root = createRoot(host);
  const kind = options.kind ?? "p1";
  window.__ready = false;
  function Ready({ children }) {
    useEffect(() => {
      requestAnimationFrame(() => {
        window.__ready = true;
      });
    }, []);
    return children;
  }
  const view =
    kind === "p5" ? h(FormCase, { cfg: options.cfg }) : VIEWS[kind]();
  root.render(h(Ready, null, view));
}
/** 데이터 생성은 측정 밖에서 — p4 를 마운트하기 전에 부른다. */
export function warm() {
  bigData();
}
