# ADR-138 구현 상세 — 컴포넌트 패널 복합 컴포넌트 reusable origin-instance 부착

> 본 문서는 [ADR-138](../138-component-palette-reusable.md) 의 구현 상세 (Phase / 파일 변경 / 시나리오 / 체크리스트). ADR 본문은 결정·위험·게이트만 담는다.

## 1. Framing checkpoint

### base / 응용 분류

- **base ADR**: ADR-116 (canonical reusable schema — `reusable: true` + `type: "ref"` + `descendants[path]` 3-mode override) + ADR-130 (frame canonical vocabulary).
- **응용 ADR (본 ADR)**: base schema 를 **검증·일반화** + 사용자 진입점/fork UX 보강. canonical schema 변경 0.
- 본 ADR 은 base schema 의 specialization 이 아니라 **검증 응용** — base schema 가 Frame 외 복합 컴포넌트 (Tabs / Card) 에서 작동하는지 end-to-end 확증한다.

### fork 여부

본 ADR 은 기존 ADR 의 잔여 영역 분리(fork)가 아니다 — brainstorming (2026-05-14~15, Google Stitch / Pencil app 벤치마크) 에서 도출된 신규 기능 ADR. `adr-writing.md` 의 fork checkpoint 4 질문은 비대상. 단 base (ADR-116/130) 의존 방향은 명시: base → 본 ADR (본 ADR 이 base schema 의 후속 검증).

### scope 추정 vs 실측

- design 추정: 신규 4 파일 + 수정 3-4 파일 = 7-8 파일. 신규 LOC ~500-700 (test 포함), 수정 ~100-150.
- **Phase 0 실측 (freeze, 2026-05-18)**: 신규 2 (test) + 수정 4 = **6 파일**. 추정 범위 하단 미만 — `adr-writing.md` M4 (1.5x 초과) 미해당, 사용자 surface 불요. 축소 원인: Phase 2/3 의 "신규 컴포넌트" 가정이 기존 인프라(LayerTree context menu / ComponentSemanticsSection override 목록) 재사용으로 대체됨 (아래 Phase 0 결과 참조).

## 2. Phase 분해

### Phase 0 — inventory freeze (완료 2026-05-18)

확정 사실:

- **canonical resolver SSOT**: `apps/builder/src/adapters/canonical/instanceResolver.ts` 가 실파일 (`resolveCanonicalRefProps`:71 / `mergePropsWithStyleDeep`:38). `utils/component/instanceResolver.ts` 는 1줄 re-export shim — §5 helper 배치처 유효.
- **canonical 타입**: `RefNode`(`composition-document.types.ts:324`, `ref`/`descendants?`) / `CanonicalNode`(:206, `props?`/`reusable?`) / `DescendantOverride`(:186, 3-mode). §5 인용 정확.
- **Tabs/Card factory**: `LayoutComponents.ts` `createTabsDefinition`(items:17-20, TabPanel `itemId` 페어링:47-59) / `createCardDefinition`(:73-189, CardPreview/CardHeader/CardContent/CardFooter 자식, 명시 id 없음 — 생성 시 customId). Tabs/Card spec `slot` 필드 미설정 — §4 Card 시나리오의 `descendants[자식 customId]` path 전제 유효.
- **Phase 2 진입점**: layer tree 에 context menu 가 이미 존재 — `LayerTreeItemContent.tsx:220-240`(현재 "Detach instance" 1개, `handleContextMenu` 가 `!isDetachableInstance` 시 early-return). palette `ComponentList.tsx` 는 _신규 타입 추가_ 용이라 "기존 element → origin 승격" 진입점에 부적합. → Phase 2 = 기존 메뉴 guard 완화 + 항목 추가. 신규 `AddAsComponentMenu.tsx` 불요.
- **Phase 3 fork UX**: `ComponentSemanticsSection.tsx:196-222` 가 이미 instance override 목록 + per-field [Reset] 렌더 (`getEditingSemanticsOverrideItems` → `resetInstanceOverrideField(id, fieldKey, descendantPath)`). `getEditingSemanticsOverrideFields` 는 ref 의 `Object.keys(props)` 반환 → `items` override 시 자동 노출. `resetInstanceOverrideField`(`instanceActions.ts:846`)는 `ref` + fieldKey 제거를 이미 지원. → Phase 3 = 기존 override row 에 fork 의미 affordance 추가. 신규 `InstanceForkBadge.tsx` / `instanceActions.ts` items-reset wrapper 불요.

### Phase 1 — A-1 검증 (Tabs primary + Card baseline)

- `reusableTabs.scenarios.test.ts` 신규 — 8 dynamic 시나리오 (§4).
- `reusableCard.scenarios.test.ts` 신규 — region(`descendants[childId]`) baseline 3 검증 (§4).
- `hasItemsOverride(refNode, master)` helper 를 canonical adapter `instanceResolver.ts` 에 추가 (fork 감지 SSOT — §5).
- Chrome MCP runtime 5 시나리오 통과.
- 위험: LOW (schema 변경 없음, test + helper 추가).

### Phase 2 — A-2 진입점 UX

- `LayerTreeItemContent.tsx` 의 기존 context menu (`NormalItemContent`) 수정 — `handleContextMenu` guard 를 완화하여 standard element 에도 메뉴 노출 (현재 detachable instance 한정). role 별 항목 분기: standard → "Add as component" / instance → "Detach instance"(기존).
- "Add as component" 항목 → 기존 `toggleComponentOrigin(elementId)` 호출. `body` 제외.
- 신규 컴포넌트·schema 변경 없음.
- 위험: LOW.

### Phase 3 — A-3 fork UX

- `ComponentSemanticsSection.tsx` 의 기존 instance override 목록(`overrideItems`)에서 `items` fieldKey 를 fork 로 구분 표시 — generic "items / Reset" 행 대신 "items forked — origin 변경 미반영" 의미 전달 (badge/copy). [Reset] 은 기존 `resetInstanceOverrideField(id, "items")` 그대로 (origin 재연결).
- `editingSemantics.ts` — (선택) `items` override 를 fork 로 표식하는 분류, 또는 `hasItemsOverride` 를 표시 조건 SSOT 로 소비.
- 신규 `InstanceForkBadge.tsx` 컴포넌트·`instanceActions.ts` 신규 action 불요 — 기존 override row + `resetInstanceOverrideField` 재사용.
- 위험: LOW (기존 UI 표면 확장).

### Phase 4 (후속 ADR — 본 ADR scope 외) — A-4 잔여 type sweep

- Tabs / Card 통과 후 잔여 ComponentTag 전수 검증 (`parallel-verify` skill). collection items 가진 5-7 type (Select / ComboBox / Toolbar / Menu / GridList / ListBox / Tree) 이 주위험.
- 본 ADR 은 A-1~A-3 만 land. A-4 는 검증 통과 후 별도 발의.

## 3. 파일 변경

### 신규 파일 (Phase 0 freeze — 2건)

| 경로                                                                           | 역할                                  | Phase |
| ------------------------------------------------------------------------------ | ------------------------------------- | ----- |
| `apps/builder/src/adapters/canonical/__tests__/reusableTabs.scenarios.test.ts` | A-1 Tabs 8 dynamic 시나리오 vitest    | 1     |
| `apps/builder/src/adapters/canonical/__tests__/reusableCard.scenarios.test.ts` | A-1 Card region(descendants) baseline | 1     |

> Phase 0 freeze: 당초 `AddAsComponentMenu.tsx` / `InstanceForkBadge.tsx` 2 신규 컴포넌트 계획은 기존 인프라(LayerTree context menu / ComponentSemanticsSection override 목록) 재사용으로 대체 — UX 신규 파일 0건.

### 수정 파일 (Phase 0 freeze — 4건)

| 경로                                                                            | 변경                                                                                  | Phase |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----- |
| `apps/builder/src/adapters/canonical/instanceResolver.ts`                       | `hasItemsOverride(refNode, master)` canonical fork-감지 helper (§5)                   | 1     |
| `apps/builder/src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.tsx` | 기존 context menu guard 완화 + "Add as component" 항목 (`toggleComponentOrigin` 호출) | 2     |
| `apps/builder/src/builder/panels/properties/ComponentSemanticsSection.tsx`      | 기존 override 목록의 `items` row 를 fork 의미 표시로 확장                             | 3     |
| `apps/builder/src/adapters/canonical/editingSemantics.ts`                       | (선택) `items` override 를 fork 로 분류 — Phase 3 affordance SSOT                     | 3     |

> Phase 0 freeze 제외: `ComponentList.tsx`(타입 팔레트 — 비대상) / `instanceActions.ts` items-reset wrapper(`resetInstanceOverrideField` 가 `ref`+fieldKey 를 이미 지원 — 불요). `toggleComponentOrigin`/`resetInstanceOverrideField` 는 호출만, 무변경.

### 변경 없음 (기존 모듈 활용)

| 모듈                                                                                                   | 활용 형태                                                            |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `instanceResolver.ts` 의 `mergePropsWithStyleDeep()` / `resolveCanonicalRefProps()`                    | merge 로직 무변경 — 같은 파일에 `hasItemsOverride` 만 신규 추가 (§5) |
| `instanceActions.createInstance / detachInstance / resetInstanceOverrideField / toggleComponentOrigin` | 함수 호출만 — UX layer 만 신규                                       |
| `canonicalMutations.ts`                                                                                | schema 변경 없음 — set/upsert primitive 호출                         |
| 시각 마커 layer (Skia overlay)                                                                         | ADR-112 G4-A 그대로                                                  |
| `Cmd+Opt+K` / `Cmd+Opt+X` 단축키                                                                       | 그대로                                                               |
| `packages/specs` Tabs.spec / Card.spec                                                                 | 변경 없음                                                            |
| `packages/shared` canonical schema (`CompositionDocument` / `RefNode` / `DescendantOverride`)          | 변경 없음                                                            |

## 4. 8 dynamic 시나리오 (`reusableTabs.scenarios.test.ts`)

시나리오 1-5·8 은 **canonical document fixture → mutation → `resolveCanonicalRefProps` 결과 검증** 구조. 시나리오 6 (undo/redo) 은 history store, 시나리오 7 (IndexedDB persist) 은 persistence 레이어를 추가로 경유한다 — pure resolver 호출만으로는 검증 불가.

### items ↔ TabPanel 페어링 (복합 컴포넌트 edge case)

Tabs origin 은 `props.items` 직렬화 배열 (ADR-066) 과 `TabPanels` 하위 `TabPanel` 자식 element (`props.itemId` ↔ `items[].id` 페어링, `LayoutComponents.ts:47-59`) 를 **분리 보관**한다. instance 가 `props.items` 만 shallow override(fork) 하면 `TabPanel` 자식은 origin 것을 그대로 resolve → items 개수와 TabPanel 개수가 어긋나 **미페어링 탭**이 생긴다. 이것이 Decision 의 "컴포넌트 특유 edge case" 이자 사용자 framing("dynamic 까지 체크") 의 핵심 — 아래 시나리오 1·3·4 의 assert 는 resolved items 개수뿐 아니라 **`items[].id` ↔ `TabPanel.props.itemId` 페어링 정합**을 함께 검증한다. 미페어링이 schema gap 으로 판정되면 ADR 본문 G1 failure-mode 대로 ADR 재검토.

| #   | setup                                                   | act                                                                                   | assert                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | origin Tabs (items 3) + instance ref ×2 (override 없음) | origin 에 tab 추가 (builder add-tab action — items entry + paired TabPanel 자식 동시) | 두 instance resolved items 모두 4개 + items[].id ↔ TabPanel.itemId 4쌍 페어링 유지                                                                                                                                       |
| 2   | origin + instance ref ×2                                | instance A `props.items` 1개 label override                                           | A 만 forked, B + origin 무영향. `hasItemsOverride(A, origin)` true                                                                                                                                                       |
| 3   | origin + instance ref                                   | instance `props.items` 에 tab 추가 (배열 전체 override)                               | shallow fork — origin 변경 미반영, `hasItemsOverride` true. **새 item 은 페어링 TabPanel 없음** → resolved items 3 ↔ TabPanel 2, tab3 미페어링. resolver no-throw 확인 + 미페어링 사실 assert (schema gap surface point) |
| 4   | origin (items 4) + fork instance + 미-fork instance     | origin items 에서 tab 1개 삭제                                                        | fork instance items 4 유지 (TabPanel 3 → 1 미페어링) / 미-fork instance items 3 ↔ TabPanel 3 페어링 일치                                                                                                                 |
| 5   | origin + instance ref ×N (일부 fork)                    | origin items 변경                                                                     | impact 계산이 fork / 미-fork 정확 분류                                                                                                                                                                                   |
| 6   | origin + instance ref ×2                                | origin items 변경 → `undo()`                                                          | 모든 instance resolved items 변경 전 복원, `redo()` 시 재반영                                                                                                                                                            |
| 7   | origin + instance 생성                                  | IndexedDB persist → canonical re-hydrate                                              | `reusable: true` / `type: "ref"` / `descendants` 전부 복원                                                                                                                                                               |
| 8   | Card origin 안에 Tabs origin 중첩                       | 바깥 Card instance 생성                                                               | 내부 Tabs origin 관계가 instance 에서도 resolve                                                                                                                                                                          |

### `reusableCard.scenarios.test.ts` — region(`descendants[childId]`) baseline 3

> Card factory (`LayoutComponents.ts:73-189`) 의 하위 영역은 `CardPreview` / `CardHeader` / `CardContent` / `CardFooter` **자식 노드**다. canonical schema 의 `slot` 필드 (`composition-document.types.ts:266-272`) 는 `false | string[]` 로 — `string[]` 은 *해당 slot 에 삽입 가능한 추천 reusable component ID 배열*이며 명명 영역 목록이 아니다. Card factory 는 `slot` 필드를 설정하지 않는다. 따라서 Card 의 영역별 override 는 `slot` 필드가 아니라 **`RefNode.descendants[<자식 stable id>]` 자식 id path**로 작동한다. ADR 본문 §Decision 의 "Card (baseline — slot 검증)" 은 이 named child region 의 `descendants` override 검증을 가리킨다.
>
> **`descendants` key 는 type 이름이 아니라 자식 노드의 stable `id`** — resolver 는 `currentPath = parentPath ? parentPath + "/" + child.id : child.id` 로 path 를 빌드한다 (`resolvers/canonical/index.ts:220`). factory 자식은 정의 시점엔 id 가 없고 생성 시 customId 가 부여된다 — CardHeader 의 경우 `cardheader_1` 형식 (`idGeneration.ts:27-68`). 따라서 본 시나리오의 key 예시 `"cardheader_1"` 은 _해당 CardHeader 자식의 실제 customId_ 를 가리키며, 중첩 시 `"card_1/cardheader_1"` 처럼 slash path 가 된다. test fixture 는 자식 노드에 명시 id 를 부여하고 그 id 로 `descendants` key 를 구성한다.

| 검증                 | 내용                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| region 인식          | Card origin 등록 시 `CardPreview/CardHeader/CardContent/CardFooter` 자식 subtree 보존 + 각 자식의 stable `id` 가 `descendants` path 로 addressable                         |
| region override      | instance 가 `descendants["cardheader_1"]` (= CardHeader 자식 id) 로 한 영역만 patch(mode A) 또는 children 교체(mode C) → `CardContent/CardFooter` 는 origin 그대로 resolve |
| region override 격리 | instance A 의 `descendants["cardheader_1"]` 변경이 instance B 의 동일 영역에 무영향                                                                                        |

## 5. fork 감지 helper (신규)

reusable 모델은 canonical (`RefNode` + `descendants`) 이고 §4 시나리오 test 도 canonical fixture 기반이므로, fork 감지 helper 는 **canonical adapter** (`apps/builder/src/adapters/canonical/instanceResolver.ts`) 에 두어 `resolveCanonicalRefProps` / `mergePropsWithStyleDeep` 와 같은 레이어에 배치한다. 타입은 canonical 정본 `RefNode` (`composition-document.types.ts:324`) / `CanonicalNode` (`:206`) 를 쓴다 — `CanonicalRefNode` 라는 타입은 존재하지 않는다.

```ts
// apps/builder/src/adapters/canonical/instanceResolver.ts 에 추가
import type { RefNode, CanonicalNode } from "@composition/shared";

/** TabItem = { id; title } flat object (Tabs.spec.ts:20). 구조 동치 비교. */
function itemsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((ai, i) => {
    const bi = b[i];
    if (ai === bi) return true;
    if (typeof ai !== "object" || typeof bi !== "object" || !ai || !bi)
      return false;
    const ak = Object.keys(ai as object);
    const bk = Object.keys(bi as object);
    return (
      ak.length === bk.length &&
      ak.every(
        (k) =>
          (ai as Record<string, unknown>)[k] ===
          (bi as Record<string, unknown>)[k],
      )
    );
  });
}

/**
 * instance(RefNode) 가 origin(master CanonicalNode) 대비 `props.items` 를
 * override(fork) 했는지 판정. `InstanceForkBadge` 표시 조건 + §4 시나리오 2/3
 * assert 의 SSOT.
 *
 * - `refNode.props.items === undefined` → override 없음 → not forked.
 * - canonical `RefNode.props` 는 override delta 이므로 items 키 존재 자체가
 *   override 후보. master 와 구조 동치면 fork 아님.
 */
export function hasItemsOverride(
  refNode: RefNode,
  master: CanonicalNode,
): boolean {
  const refItems = refNode.props?.items;
  if (refItems === undefined) return false; // override 없음
  return !itemsEqual(refItems, master.props?.items);
}
```

**consumer**:

- §4 `reusableTabs.scenarios.test.ts` 시나리오 2/3 — canonical fixture 의 `RefNode` / master `CanonicalNode` 를 직접 전달.
- `InstanceForkBadge` (Phase 3) — `ComponentSemanticsSection` 은 store `Element` 도메인이므로, 선택 instance 의 canonical `RefNode` + master `CanonicalNode` 를 `useCanonicalDocumentStore.getState()` 로 조회해 전달한다 (canonical 이 reusable SSOT — ADR-116/122).

별도 `deepEqual` 의존성은 도입하지 않는다 — 공유 export 가 없고 (`elementDiff.ts` / `canvasDeltaMessenger.ts` 의 `deepEqual` 은 비-export local), `TabItem` 이 flat 2-field object 라 위 `itemsEqual` 로 충분하다.

`InstanceForkBadge` 표시 조건의 SSOT. v1 은 `items` 만 (Tabs 핵심) — 다른 prop fork 감지는 후속 ADR (A-4).

## 6. Verification gate (A-1~A-3 land 조건)

| Gate        | 통과 조건                                                         |
| ----------- | ----------------------------------------------------------------- |
| vitest      | `reusableTabs.scenarios` 8 + `reusableCard.scenarios` 3 전부 PASS |
| type-check  | baseline 유지, new violation 0                                    |
| Chrome MCP  | 5 dynamic 시나리오 runtime 통과                                   |
| cross-check | Tabs / Card origin-instance Skia↔CSS 시각 대칭                    |

## 7. 체크리스트

- [x] Phase 0 inventory — 추정 7-8 파일 vs 실측 6 파일 (1.5x 미만, surface 불요)
- [x] Phase 1 — 8+3 시나리오 vitest 작성 + `hasItemsOverride` helper (11/11 PASS)
- [x] Phase 1 — Chrome MCP runtime 5 시나리오 통과
- [x] Phase 2 — `LayerTreeItemContent` context menu 확장 ("Add as component")
- [x] Phase 3 — `ComponentSemanticsSection` items override row fork 표시
- [x] Verification gate 4종 통과 (vitest 11/11 · type-check 0 new · Chrome MCP 5 · cross-check N/A)
- [x] CHANGELOG `### Features` 반영
- [x] README.md ADR-138 Status 갱신
