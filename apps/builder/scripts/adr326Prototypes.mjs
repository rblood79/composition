// ADR-326 Phase 0 시제품 P1 · P2 · P3 · P6 (breakdown §6) — 제품 코드가 아니다.
// 판정은 `adr326-phase0-prototypes.mjs` 가 실제 브라우저 (Chrome · WebKit) 의 focus · DOM · 접근성 트리로 한다.
//   arm a = 지금의 조립 (ADR-322 — 열렸을 때만 lazy chunk 가 context + RAC `Popover` 를 그린다,
//           `trigger: "MenuTrigger"` · `"DialogTrigger"`, tree 의 목록은 `Autocomplete` 밖)
//   arm b = 이 ADR 의 조립 (§4.3 — 필드가 context 를 늘 준다 · `trigger: "Cascader"` · 제품의 `CatalogPopover`
//           (공용 `Popover` — `data-size` · FocusScope) · 그 children 을 감싸는 `Autocomplete` (+ tree 는 RAC
//           `Dialog` `display: contents`) · SearchField 노드와 lazy 목록 자리가 형제)
//   crumbs = P6 — 경로 `root > A > … ` 를 「crumb 을 전부 그린 Breadcrumbs」 (ref) 와 자리 넷 (slot) 으로 그려
//           폭 판정 · 보이는 crumb · 폴더 메뉴의 항목 · 메뉴 `onAction` 을 잰다.
// 두 arm 은 같은 자료 · 같은 목록 함수를 쓴다 — 다른 것은 조립 (§4.3) 뿐이다.
import {
  createElement as h,
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { useMenuTrigger } from "react-aria/useMenu";
import { useOverlayTrigger } from "react-aria/useOverlayTrigger";
import { useMenuTriggerState } from "react-stately/useMenuTriggerState";
import {
  Autocomplete,
  Breadcrumb,
  Breadcrumbs,
  Button,
  ButtonContext,
  Dialog,
  DialogContext,
  Input,
  Label,
  Link,
  ListBox,
  ListBoxItem,
  Menu,
  MenuContext,
  MenuItem,
  MenuTrigger,
  OverlayTriggerStateContext,
  Popover,
  PopoverContext,
  RootMenuTriggerStateContext,
  SearchField,
  Select,
  SelectValue,
  SubmenuTrigger,
  Tree,
  TreeItem,
  TreeItemContent,
} from "react-aria-components";
import { CatalogPopover } from "../../../packages/shared/src/catalog/runtime/CatalogPopover";
import {
  catalogBreadcrumbsCollapse,
  catalogBreadcrumbsVisibleCount,
} from "../../../packages/shared/src/catalog/runtime/breadcrumbsCollapse";
import { SMALL, table } from "./adr322Prototypes.mjs";

const ROWS = table(SMALL);
const pathText = (id) => ROWS.get(id)?.names.join(" / ") ?? "";
const childrenOf = (parentId) =>
  [...ROWS.values()].filter((entry) => entry.parentId === parentId);

// ── 목록 (두 arm 공용) ─────────────────────────────────────────────────────────────────────────
function LevelMenu({ parentId, onPick, part }) {
  return h(
    Menu,
    {
      "aria-label": parentId ? `${ROWS.get(parentId).name} 하위` : undefined,
      selectionMode: "single",
      // (Like the product's level Menu — `cascaderMenu.components.tsx` `selectedKeys`: only this level's
      // own leaf. A key from another level would make RAC's default `escapeKeyBehavior: "clearSelection"`
      // spend Esc on a selection the level does not show, and the root menu would not close.)
      selectedKeys:
        window.__value && ROWS.get(window.__value)?.parentId === parentId
          ? [window.__value]
          : [],
      onAction: (key) => {
        if (!ROWS.get(String(key)).node.children) onPick(String(key));
      },
      "data-part": part ?? `menu:${parentId}`,
    },
    childrenOf(parentId).map((entry) =>
      entry.node.children
        ? h(
            SubmenuTrigger,
            { key: entry.id },
            h(
              MenuItem,
              {
                id: entry.id,
                textValue: entry.name,
                "data-part": `item:${entry.id}`,
              },
              `${entry.name} ›`,
            ),
            // (§4.3 — the lazy chunk's sub-level Popover gets `data-size` for the Menu sheet.)
            h(
              Popover,
              { "data-part": `pop:${entry.id}`, "data-size": "M" },
              h(LevelMenu, { parentId: entry.id, onPick }),
            ),
          )
        : h(
            MenuItem,
            {
              key: entry.id,
              id: entry.id,
              textValue: entry.name,
              "data-part": `item:${entry.id}`,
            },
            entry.name,
          ),
    ),
  );
}
function Results({ query, onPick }) {
  const found = [...ROWS.values()].filter(
    (entry) => !entry.node.children && entry.name.includes(query),
  );
  return h(
    Menu,
    {
      "aria-label": "Search",
      selectionMode: "single",
      onAction: (key) => onPick(String(key)),
      "data-part": "results",
    },
    found.map((entry) =>
      h(
        MenuItem,
        {
          key: entry.id,
          id: entry.id,
          textValue: entry.name,
          "data-part": `found:${entry.id}`,
        },
        entry.name,
      ),
    ),
  );
}
function LevelTree({ onPick, label }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const items = (parentId) =>
    childrenOf(parentId).map((entry) =>
      h(
        TreeItem,
        {
          key: entry.id,
          id: entry.id,
          textValue: entry.name,
          hasChildItems: !!entry.node.children,
          "data-part": `row:${entry.id}`,
        },
        h(TreeItemContent, null, entry.name),
        entry.node.children ? items(entry.id) : null,
      ),
    );
  return h(
    Tree,
    {
      "aria-label": label,
      selectionMode: "single",
      selectedKeys: window.__value ? [window.__value] : [],
      // (The product's tree — `cascaderPanel.components.tsx` `escapeKeyBehavior="none"`.)
      escapeKeyBehavior: "none",
      expandedKeys: expanded,
      onExpandedChange: (keys) => setExpanded(new Set([...keys].map(String))),
      onSelectionChange: (keys) => {
        const [first] = [...keys];
        if (first !== undefined && !ROWS.get(String(first)).node.children)
          onPick(String(first));
      },
      "data-part": "list",
    },
    items(null),
  );
}

// ── 필드 ─────────────────────────────────────────────────────────────────────────────────────
function Contexts({
  arm,
  mode,
  state,
  triggerRef,
  menuProps,
  overlayProps,
  dialogTriggerId,
  children,
}) {
  const scrollRef = useRef(null);
  const menuMode = mode === "columns";
  const trigger =
    arm === "b" ? "Cascader" : menuMode ? "MenuTrigger" : "DialogTrigger";
  return h(
    MenuContext.Provider,
    { value: menuMode ? { ...menuProps, ref: scrollRef } : null },
    h(
      DialogContext.Provider,
      {
        value: menuMode
          ? null
          : { ...overlayProps, "aria-labelledby": dialogTriggerId },
      },
      h(
        OverlayTriggerStateContext.Provider,
        { value: state },
        h(
          RootMenuTriggerStateContext.Provider,
          { value: state },
          h(
            PopoverContext.Provider,
            {
              value: menuMode
                ? {
                    trigger,
                    triggerRef,
                    scrollRef,
                    placement: "bottom start",
                    "aria-labelledby": menuProps["aria-labelledby"],
                  }
                : {
                    trigger,
                    triggerRef,
                    id: overlayProps.id,
                    placement: "bottom start",
                    "aria-labelledby": dialogTriggerId,
                  },
            },
            children,
          ),
        ),
      ),
    ),
  );
}

/** arm a — 지금의 `cascaderMenu` · `cascaderPanel` 몸통 (Popover 껍질 포함, 열렸을 때만). */
function ContentA({ mode, onPick, label }) {
  const [query, setQuery] = useState("");
  const search = h(
    SearchField,
    { "aria-label": "Search", autoFocus: true, "data-part": "search" },
    h(Input, { placeholder: "Search" }),
  );
  if (mode === "columns")
    return h(
      Popover,
      { "data-part": "popover" },
      h(
        Autocomplete,
        { inputValue: query, onInputChange: setQuery },
        search,
        query
          ? h(Results, { query, onPick })
          : h(LevelMenu, { parentId: null, onPick, part: "list" }),
      ),
    );
  return h(
    Popover,
    { "data-part": "popover", className: "react-aria-Popover cascader-panel" },
    h(
      Dialog,
      { "data-part": "dialog" },
      h(
        Autocomplete,
        { inputValue: query, onInputChange: setQuery },
        search,
        query ? h(Results, { query, onPick }) : null,
      ),
      query ? null : h(LevelTree, { onPick, label }),
    ),
  );
}

/** arm b — `CascaderList` 자리: lazy 본문 (§4.3 `cascaderlist` renderer). */
const ListSlot = lazy(async () => ({
  default: function CascaderListBody({ mode, query, onPick, label }) {
    if (query) return h(Results, { query, onPick });
    return mode === "columns"
      ? h(LevelMenu, { parentId: null, onPick, part: "list" })
      : h(LevelTree, { onPick, label });
  },
}));
/**
 * arm b — Popover 노드의 children 을 감싸는 Provider 자리. 검색어는 이 자리 (Popover 가 열렸을 때만 그리는
 * children) 가 갖는다 — 필드 쪽 (늘 그려진다) 에 두면 닫았다 다시 열 때 지난 검색어 · 결과가 남는다 (arm a 는
 * 열 때마다 lazy 몸통이 새로 그려 빈 검색창).
 */
function SearchScope({ mode, onPick, label }) {
  const [query, setQuery] = useState("");
  // (The SearchField node — the catalog SearchField origin: Input + clear Button; label "" → i18n name.)
  const searchNode = h(
    SearchField,
    {
      key: "search",
      "aria-label": "Search",
      autoFocus: true,
      "data-part": "search",
    },
    h(Input, { placeholder: "Search" }),
    h(Button, { "data-part": "clear" }, "×"),
  );
  const listNode = h(
    Suspense,
    { key: "list", fallback: null },
    h(ListSlot, { mode, query, onPick, label }),
  );
  return h(
    Autocomplete,
    { inputValue: query, onInputChange: setQuery },
    searchNode,
    listNode,
  );
}
/** arm b — 필드가 그리는 Popover 노드 (catalog renderer) · 그 children 이 `SearchScope`. */
function ContentB({ mode, onPick, label, popoverProps }) {
  const children = h(SearchScope, { mode, onPick, label });
  return h(
    CatalogPopover,
    { "data-part": "popover", ...popoverProps },
    mode === "columns"
      ? children
      : h(
          Dialog,
          { "data-part": "dialog", style: { display: "contents" } },
          children,
        ),
  );
}

function Field({ arm, mode, popoverProps }) {
  const state = useMenuTriggerState({});
  const triggerRef = useRef(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger(
    { type: "menu" },
    state,
    triggerRef,
  );
  const dialogTriggerId = useId();
  const { triggerProps: dialogTriggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    state,
    triggerRef,
  );
  const menuMode = mode === "columns";
  const triggerProps = menuMode
    ? menuTriggerProps
    : { ...dialogTriggerProps, id: dialogTriggerId };
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(null);
  window.__value = value;
  window.__state = () => ({ value, text: pathText(value), open: state.isOpen });
  const onPick = (key) => {
    setValue(key);
    if (!menuMode) state.close();
  };
  const content = h(arm === "b" ? ContentB : ContentA, {
    mode,
    onPick,
    label: "지역",
    popoverProps,
  });
  const wired = {
    arm,
    mode,
    state,
    triggerRef,
    menuProps,
    overlayProps,
    dialogTriggerId,
  };
  return h(
    "div",
    null,
    h(Button, { "data-part": "before" }, "앞"),
    h(Label, { id: labelId }, "지역"),
    h(
      ButtonContext.Provider,
      {
        value: {
          ...triggerProps,
          ref: triggerRef,
          isPressed: state.isOpen,
          "aria-labelledby": `${valueId} ${labelId}`,
        },
      },
      h(
        Button,
        { "data-part": "trigger" },
        h("span", { id: valueId }, value ? pathText(value) : "고르기"),
      ),
    ),
    arm === "b"
      ? h(Contexts, wired, content)
      : state.isOpen
        ? h(Suspense, { fallback: null }, h(Contexts, wired, content))
        : null,
    h(Button, { "data-part": "after" }, "뒤"),
  );
}

/** 대조군 — Select 의 열린 목록 노드 (catalog `CatalogPopover` > ListBox, `trigger: "Select"`) 의 focus 복원. */
function SelectControl({ popoverProps }) {
  const [value, setValue] = useState(null);
  window.__state = () => ({ value, text: value ?? "", open: null });
  return h(
    "div",
    null,
    h(Button, { "data-part": "before" }, "앞"),
    h(
      Select,
      {
        "aria-label": "지역",
        selectedKey: value,
        onSelectionChange: (key) => setValue(String(key)),
      },
      h(Button, { "data-part": "trigger" }, h(SelectValue)),
      h(
        CatalogPopover,
        { "data-part": "popover", ...popoverProps },
        h(
          ListBox,
          { "data-part": "list" },
          childrenOf(null).map((entry) =>
            h(
              ListBoxItem,
              { key: entry.id, id: entry.id, "data-part": `item:${entry.id}` },
              entry.name,
            ),
          ),
        ),
      ),
    ),
    h(Button, { "data-part": "after" }, "뒤"),
  );
}

// ── P6 경로 줄 ───────────────────────────────────────────────────────────────────────────────
/** breakdown §4.4 `cascaderTrail` 의 자리 — 넷 이하면 전부, 넘으면 첫 · 끝에서 둘째 · 끝. */
const slotsOf = (length) =>
  length <= 4
    ? Array.from({ length }, (_, i) => i)
    : [0, length - 2, length - 1];
/** 자리 폭 + 실제 crumb 수 (Phase 3 가 `catalogBreadcrumbsVisibleCount` 에 더할 입력 — 시제품은 판정 층 시험과 같은 길). */
function slotVisibleCount(widths, size, listWidth, gap, folder) {
  if (size <= widths.length)
    return catalogBreadcrumbsVisibleCount(widths, listWidth, gap, folder);
  const [first, secondLast, last] = widths;
  return catalogBreadcrumbsVisibleCount(
    [first, 0, 0, secondLast, last],
    listWidth,
    gap,
    folder,
  );
}
const FOLDER = 32;
function Trail({ path, width, arm }) {
  const listRef = useRef(null);
  const shown =
    arm === "slot" ? slotsOf(path.length).map((i) => path[i]) : path;
  const [visible, setVisible] = useState(null);
  const [moved, setMoved] = useState([]);
  const [, setEpoch] = useState(0);
  window.__state = () => ({ visible, moved });
  useLayoutEffect(() => {
    if (visible !== null) return;
    const list = listRef.current;
    const items = [...list.querySelectorAll(":scope > .react-aria-Breadcrumb")];
    if (items.length !== shown.length) {
      // (RAC renders a collection's items a commit after it builds it — `BreadcrumbsRun` measures again.)
      requestAnimationFrame(() => setEpoch((value) => value + 1));
      return;
    }
    const widths = items.map((item) => item.getBoundingClientRect().width);
    const listWidth = list.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    setVisible(
      arm === "slot"
        ? slotVisibleCount(widths, path.length, listWidth, gap, FOLDER)
        : catalogBreadcrumbsVisibleCount(widths, listWidth, gap, FOLDER),
    );
  });
  const onAction = (key) => setMoved((prior) => [...prior, String(key)]);
  // (The menu is always the whole path's — breakdown §4.4 「폴더 메뉴의 항목 = 판정 뒤」.)
  const collapse =
    visible === null ? undefined : catalogBreadcrumbsCollapse(path, visible);
  const crumb = (item) =>
    h(
      Breadcrumb,
      { key: item.key, id: item.key, "data-part": `crumb:${item.key}` },
      h(Link, null, item.text),
    );
  const folder = h(
    Breadcrumb,
    {
      key: "__menu",
      id: "__menu",
      className: "react-aria-Breadcrumb breadcrumb-menu",
      "data-part": "folder",
    },
    h(
      MenuTrigger,
      null,
      h(
        Button,
        {
          "aria-label": "More items",
          style: { width: FOLDER, height: FOLDER, padding: 0 },
          "data-part": "folder-button",
        },
        "▤",
      ),
      h(
        Popover,
        { placement: "bottom start" },
        h(
          Menu,
          { "aria-label": "More items", onAction, "data-part": "folder-menu" },
          (collapse?.hidden ?? []).map((item) =>
            h(
              MenuItem,
              {
                key: item.key,
                id: item.key,
                textValue: item.text,
                "data-part": `menu-item:${item.key}`,
              },
              item.text,
            ),
          ),
        ),
      ),
    ),
  );
  const rendered =
    visible === null
      ? shown.map(crumb)
      : collapse
        ? [
            crumb(path[0]),
            folder,
            ...path.slice(path.length - visible).map(crumb),
          ]
        : path.map(crumb);
  return h(
    Breadcrumbs,
    { ref: listRef, onAction, style: { width }, "data-part": "trail" },
    rendered,
  );
}

// ── 마운트 ───────────────────────────────────────────────────────────────────────────────────
let root = null;
export function mount({ kind, cfg = {} }) {
  const host = document.createElement("div");
  document.body.replaceChildren(host);
  root?.unmount();
  root = createRoot(host);
  window.__ready = false;
  document.body.toggleAttribute("data-fixed", !!cfg.fixed);
  function Ready({ children }) {
    useEffect(() => {
      requestAnimationFrame(() => {
        window.__ready = true;
      });
    }, []);
    return children;
  }
  const view =
    kind === "crumbs"
      ? h(Trail, { path: cfg.path, width: cfg.width, arm: cfg.arm })
      : kind === "select"
        ? h(SelectControl, { popoverProps: cfg.popoverProps })
        : h(Field, {
            arm: cfg.arm,
            mode: cfg.mode,
            popoverProps: cfg.popoverProps,
          });
  root.render(h(Ready, null, view));
}
