"""S2 prop 정렬 조사 — type 별 분류 (s2props · racprops · ours · rules → dataset.json).

실행: python3 dataset.py <이 폴더> [v3 survey 폴더]
v3 survey (`@adobe/react-spectrum` 3.47.6 `dist/types/src/**/*.d.ts` 를 모은 폴더) 가 없으면
2026-10-09 조사의 v3 판정 (`v3-2026-10-09.json`) 을 이어 쓴다.
"""
import glob
import json
import re
import sys

D = sys.argv[1]
SURVEY = sys.argv[2] if len(sys.argv) > 2 else None
s2 = json.load(open(f"{D}/s2props.json"))
rac = json.load(open(f"{D}/racprops.json"))
ours = json.load(open(f"{D}/ours.json"))
rules = json.load(open(f"{D}/rules.json"))
V3_OLD = {tuple(p) for p in json.load(open(f"{D}/v3-2026-10-09.json"))}
v3 = []
for f in glob.glob(f"{SURVEY}/*.d.ts") if SURVEY else []:
    src = open(f).read()
    for m in re.finditer(r"interface\s+(\w+)\b[^{]*\{", src):
        i = m.end(); depth = 1; j = i
        while depth and j < len(src):
            depth += {"{": 1, "}": -1}.get(src[j], 0); j += 1
        v3.append((m.group(1), set(re.findall(r"\n\s+'?([A-Za-z][\w-]*)'?\??\s*:", src[i:j - 1]))))


def v3has(comp, k):
    return any(k in props for n, props in v3 if comp.lower() in n.lower())


MAP = {"Select": "Picker", "Separator": "Divider", "Tree": "TreeView", "TreeItem": "TreeViewItem", "GridList": "ListView", "GridListItem": "ListViewItem", "Table": "TableView", "Toast": "ToastContainer", "Nav": "SideNav", "Kbd": "Keyboard", "ListBoxItem": "PickerItem"}
EDITOR = {"children", "slot", "dataBinding", "aria-label"}
LINK = {"href", "target", "rel", "hrefLang", "download", "ping", "referrerPolicy", "routerOptions"}
STATE = {"selectedKeys", "defaultSelectedKeys", "disabledKeys", "expandedKeys", "defaultExpandedKeys", "selectedKey", "defaultSelectedKey", "isOpen", "defaultOpen", "defaultSelected", "inputValue", "defaultInputValue", "focusedValue", "defaultFocusedValue", "sortDescriptor", "selectedRoute", "defaultItems", "triggerRef", "isEntering", "value", "defaultValue"}
BEHAV = {"disallowEmptySelection", "shouldSelectOnPressUp", "keyboardNavigationBehavior", "disallowTypeAhead", "shouldCloseOnSelect", "shouldFlip", "autoFocus", "preventFocusOnPress", "keyboardActivation", "isDateUnavailable", "createCalendar", "commitBehavior", "focusMode", "allowsArrowNavigation", "getDropOperation", "getTargetRect", "UNSTABLE_focusOnEntry", "isVirtualized", "validationBehavior", "shouldCloseOnPress", "isKeyboardDismissDisabled", "isNonModal", "selectionBehavior", "filter", "textValue", "formValue", "name", "role", "labelElementType", "itemProp", "itemScope", "itemType", "itemID", "itemRef", "isHidden", "renderActionBar", "labelBehavior", "formAction", "formEncType", "formMethod", "formNoValidate", "formTarget", "autoCapitalize", "validationErrors", "render", "inputRef", "validate", "form", "excludeFromTabOrder", "dependencies", "items", "renderValue", "renderEmptyState", "loadingState", "dragAndDropHooks", "disabledBehavior", "shouldFocusWrap", "escapeKeyBehavior", "autoComplete", "autoCorrect", "spellCheck", "enterKeyHint", "inputMode", "columns", "decrementAriaLabel", "incrementAriaLabel", "groupActionLabel", "hasChildItems", "menuItems", "treeColumn"}

# S2 prop that a node or another place carries (no prop of the type) — 「노드 · 다른 자리」.
HELP_FIELDS = {"TextField", "TextArea", "NumberField", "ComboBox", "Select", "ColorField", "ColorSlider", "DateField", "DatePicker", "DateRangePicker", "TimeField", "SearchField", "CheckboxGroup", "RadioGroup", "Slider", "TagGroup"}
PREFIX_FIELDS = {"TextField", "TextArea", "NumberField", "ComboBox", "ColorField"}
ELSEWHERE = {
    ("TooltipTrigger", "placement"): "Tooltip 노드", ("TooltipTrigger", "crossOffset"): "Tooltip 노드", ("TooltipTrigger", "containerPadding"): "Tooltip 노드",
    ("Popover", "hideArrow"): "OverlayArrow 노드", ("Popover", "padding"): "Styles padding", ("Dialog", "isDismissible"): "Modal isDismissable",
    ("Calendar", "selectionMode"): "RangeCalendar", ("Disclosure", "defaultExpanded"): "isExpanded",
    ("Tag", "label"): "Text 노드", ("ColorSlider", "label"): "Label 노드", ("DisclosurePanel", "label"): "Heading 노드", ("AvatarGroup", "label"): "원본 accept + Text 노드",
}
lib = open(f"{D}/../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts").read()
ORIGIN = {m.group(1): set(re.findall(r'"(\w+)":', m.group(2))) for m in re.finditer(
    r'"id": "lib:definition:origin-component-[\w-]+",\s*"name": "(\w+)",\s*"mode": "\w+",\s*"accepts": \{([^}]*)\}', lib)}


def elsewhere(typ, k):
    if k == "contextualHelp" and typ in HELP_FIELDS: return "ContextualHelp 노드 (ADR-259)"
    if k == "prefix" and typ in PREFIX_FIELDS: return "앞 글자 Text · Icon 노드 (ADR-259)"
    if k in ORIGIN.get(typ, ()): return "원본 prop"
    return ELSEWHERE.get((typ, k))


def lits(t): return sorted(set(re.findall(r'"([^"]+)"', t)))


out = []
for typ in sorted(ours):
    s2n = MAP.get(typ, typ); s2p = s2.get(s2n); racp = rac.get(typ, {})
    e = {"type": typ, "s2": s2n if s2p else None, "same": [], "diff": [], "rac": [], "v3": [], "own": [], "carry": [], "editor": [], "node": [], "nodeWhy": {}, "s2vis": [], "s2link": [], "s2state": [], "s2behav": []}
    for k, v in ours[typ].items():
        if k.startswith("_"): continue
        if k in EDITOR: e["editor"].append(k); continue
        if s2p and k in s2p:
            sl = lits(s2p[k]["type"]); ol = v.get("options")
            if not ol and v.get("kind") in ("variant", "size"):
                ol = (rules.get(typ) or {}).get("variants" if v["kind"] == "variant" else "sizes") or None
            if ol and sl and sorted(ol) != sl: e["diff"].append({"prop": k, "ours": ol, "s2": sl})
            else: e["same"].append(k)
        # A resolver carrier (no Design panel field) is not compared — 「내부 운반 값」.
        elif v.get("hidden"): e["carry"].append(k)
        elif k in racp or k == "autoFocus": e["rac"].append(k)
        elif (typ, k) in V3_OLD or v3has(s2n, k) or v3has(typ, k) or (k == "isQuiet" and typ in ("DatePicker", "SearchField")): e["v3"].append(k)
        else: e["own"].append(k)
    if s2p:
        for k in s2p:
            if k in ours[typ]: continue
            why = elsewhere(typ, k)
            if why: e["node"].append(k); e["nodeWhy"][k] = why; continue
            bucket = "s2link" if k in LINK else "s2state" if k in STATE else "s2behav" if k in BEHAV else "s2vis"
            e[bucket].append(k)
    out.append(e)
json.dump(out, open(f"{D}/dataset.json", "w"), ensure_ascii=False, indent=1)
tot = {k: sum(len(x[k]) for x in out) for k in ("same", "diff", "rac", "v3", "own", "carry", "editor", "node", "s2vis", "s2link", "s2state", "s2behav")}
print(tot, len(out), sum(1 for x in out if not x["s2"]))
