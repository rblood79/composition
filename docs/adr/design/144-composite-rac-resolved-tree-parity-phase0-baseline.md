# ADR-144 Phase 0 — Baseline and evidence freeze (2026-05-21)

본 문서는 ADR-144 G0 의 현재 gap 을 line evidence 로 고정한다. 기준 상태는
`main`, clean working tree, ADR-144 `In Progress`, `.spec-rebuild-pending` 없음,
`pnpm run codex:typecheck` exit 0 (`TS 변경 없음 - 스킵`)이다.

## 1. Current Tabs catalog and creation route

| Surface                     | File/line                                                                  | Current behavior                                                                                                                    | ADR-144 implication                                                                      |
| --------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Catalog entry               | `packages/shared/src/catalog/componentCatalog.ts:617-628`                  | `Tabs` 는 `kind:"primitive"`, `cutover:"catalog"`, `binding: tabsPrimitiveBinding`, panel placeable 이다.                           | 새 authoring entrypoint 가 아직 reusable/ref template 이 아니다.                         |
| Default props               | `packages/shared/src/catalog/primitives/tabs.ts:110-141`                   | `defaultProps.items[]` 3개와 `skiaPrimitive: { kind: "tabs" }` 를 가진 props-only primitive 이다.                                   | Tab label/panel body 의 authoring SSOT 가 canonical child node 가 아니라 `items[]` 이다. |
| Factory bridge              | `apps/builder/src/builder/hooks/useElementCreator.ts:98-116`               | primitive catalog creation 은 `entry.binding.defaultProps` 를 props 로 복사하고 placement children 이 있을 때만 children 을 만든다. | Tabs 는 placement children 이 없으므로 child tree 없이 root props payload 로 생성된다.   |
| Creation regression fixture | `apps/builder/src/builder/hooks/useElementCreator.catalog.test.ts:732-764` | `resolveCatalogElementCreation("Tabs")` 는 `elementType:"Tabs"`, `props.items[]`, `children === undefined` 를 기대한다.             | Phase 2 G2 는 이 fixture 를 reusable/ref tree creation 으로 바꿔야 한다.                 |

## 2. Current Preview route

| Surface                   | File/line                                                               | Current behavior                                                                                                | ADR-144 implication                                                                     |
| ------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Renderer contract comment | `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx:1-16`    | renderer 는 resolved node 재귀 children 렌더와 `data-canonical-id`/`data-element-id` DOM marker 를 목표로 한다. | 목표 contract 는 이미 문서화되어 있지만 Tabs branch 는 이를 subpart 에 적용하지 않는다. |
| Root marker               | `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx:251-255` | marker 는 root `node.id` 와 `elementId` 로 만들어진다.                                                          | 현 Tabs branch 의 marker owner 는 root 하나다.                                          |
| Tabs branch               | `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx:742-747` | `binding.toRacProps(adaptedEl.props)` 후 `<Tabs {...tabsProps} {...markerProps} />` 를 직접 렌더한다.           | resolved TabList/Tab/TabPanel/body child owner marker 가 생성되지 않는다.               |

## 3. Current Skia route and synthetic owner denylist

| Surface                 | File/line                                                                       | Current behavior                                                                                        | ADR-144 implication                                                                |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Primitive dispatch      | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:996-998`   | `skiaPrimitive.kind === "tabs"` 는 `buildGenericTabsNode(...)` 로 이동한다.                             | Skia 는 resolved children traversal 이 아니라 Tabs 전용 synthetic builder 를 쓴다. |
| Props source            | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:4985-4999` | `toTabsRacProps(node.props)` 와 `props.items ?? []` 에서 tab/panel 데이터를 읽는다.                     | Skia drawing source 도 canonical children 이 아니라 props projection 이다.         |
| Synthetic tab bg        | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:5050-5069` | `${node.id}:tab:${item.id}:bg` box 를 만든다.                                                           | editable owner 로 쓰면 안 되는 internal id 이다.                                   |
| Synthetic tab label     | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:5070-5093` | `${node.id}:tab:${item.id}:label` text 를 만들고 content 는 `item.label` 이다.                          | label selection/edit 은 canonical text node 또는 descendants patch 로 가야 한다.   |
| Synthetic indicator     | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:5094-5111` | `${node.id}:tab:${item.id}:indicator` box 를 만든다.                                                    | indicator selection/style owner 도 canonical owner path 가 필요하다.               |
| Synthetic panel bg      | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:5115-5129` | `${node.id}:panel:bg` box 를 만든다.                                                                    | denylist 대상이다.                                                                 |
| Synthetic panel content | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:5131-5150` | `${node.id}:panel:content` text 를 만들고 content 는 `selectedItem.content ?? selectedItem.label` 이다. | TabPanel/body editability gap 의 핵심 synthetic owner 이다.                        |
| Root node               | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:5154-5163` | root container owner 는 `elementId: node.id` 이고 children 은 synthetic subnodes 다.                    | root owner 는 canonical 이지만 subpart owner 는 canonical 이 아니다.               |

Phase 0 synthetic editable owner denylist:

- `${tabsId}:tab:*:bg`
- `${tabsId}:tab:*:label`
- `${tabsId}:tab:*:indicator`
- `${tabsId}:panel:bg`
- `${tabsId}:panel:content`

G3/G4 에서는 위 id 가 selection/editable owner 로 노출되면 실패로 본다. Draw-command internal id 로만
남는 것은 허용된다.

## 4. Current Inspector/editing route

| Surface             | File/line                                                                            | Current behavior                                                                                  | ADR-144 implication                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Tabs editor premise | `apps/builder/src/builder/panels/properties/editors/TabsEditor.tsx:17-21`            | ADR-066 items SSOT: `Tab element는 존재하지 않으며 Tabs.props.items가 단일 진실` 이라고 명시한다. | ADR-144 의 resolved-tree authoring SSOT 와 충돌하는 legacy path 다.                 |
| Rename write path   | `apps/builder/src/builder/panels/properties/editors/TabsEditor.tsx:53-59`            | rename 은 `items.map(...)` 후 `onUpdate({ items: next })` 로 root props 를 갱신한다.              | Tab label text node/descendants patch write 가 아니다.                              |
| Add tab path        | `apps/builder/src/builder/panels/properties/editors/tabsItemActions.ts:16-65`        | 새 item 을 `items[]` 에 추가하고 별도 `TabPanel` element 를 `TabPanels` 아래 생성한다.            | legacy mixed model 이며 새 Tabs creation 의 resolved-tree slot/ref model 이 아니다. |
| Layout virtual tab  | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:954-965` | `TabList` layout 은 `Tabs.props.items` 로 가상 Tab element 를 생성한다.                           | layout path 도 canonical Tab node 가 아니라 ephemeral tab 을 사용한다.              |

## 5. Fixture inventory

| Fixture                              | Shape                                            | Measured inventory                                                       | Contract evidence                                                                                                                              |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/RAC-showcase.json`         | root `reusableComponents[]` export               | `reusable=67`, `refs=263`, `refs_with_descendants=199`, `slot_hosts=0`   | `Tab`/`TabList`/`Tabs` reusable pattern: `packages/RAC-showcase.json:8136-8245`.                                                               |
| `packages/slot-tabs-selection.json`  | root `nodes[]` + `selectedNodeIds` export        | `reusable=3`, `refs=6`, `refs_with_descendants=5`, `slot_hosts=1`        | selected real nodes/refs, slot allow-list, slot-filled instance children: `packages/slot-tabs-selection.json:1-115`.                           |
| `packages/shadcn-design-system.json` | root `selection` + `reusableComponents[]` export | `reusable=174`, `refs=119`, `refs_with_descendants=100`, `slot_hosts=22` | slot/ref/descendants repeats across Tabs, Dropdown, Table Row/Table: `packages/shadcn-design-system.json:3214-3230`, `3408-3422`, `4830-4925`. |

Measurement command:

```bash
jq -r 'def walknodes: .. | objects; "reusable=" + ([walknodes | select(.reusable==true)] | length | tostring) + " refs=" + ([walknodes | select(.type=="ref")] | length | tostring) + " refs_with_descendants=" + ([walknodes | select(.type=="ref" and (.descendants? != null))] | length | tostring) + " slot_hosts=" + ([walknodes | select(.slot? != null)] | length | tostring)' packages/{RAC-showcase,slot-tabs-selection,shadcn-design-system}.json
```

## G0 result

- [x] Current Tabs catalog/Preview/Skia route frozen with file:line evidence.
- [x] Fixture inventory frozen for `RAC-showcase.json`, `slot-tabs-selection.json`, and `shadcn-design-system.json`.
- [x] Current creation payload shape recorded: root `Tabs` + `props.items[]` + no children.
- [x] Current Preview marker limitation recorded: root marker only for Tabs branch.
- [x] Current Skia synthetic ids recorded.
- [x] TabPanel/body editability gap recorded as synthetic `panel:content` + props-only editor write path.
- [x] Synthetic editable owner denylist defined.

Phase 1 may start with contract fixture tests.
