# ADR-147 구현 상세 — ListBoxItem Slot Composition Model

> 본 문서는 [ADR-147](../147-listboxitem-slot-composition.md) 의 구현 상세(Phase, 파일 경계, 작업 순서, 체크리스트)다. 결정/위험/대안은 ADR 본문 참조.

## §1. Fork checkpoint lock-in (4질문)

| 질문                     | 판정                                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| base/응용 분류           | **ADR-146 = base** (ListBox ref-template + Components page + slot allow-list **선언**). **ADR-147 = 응용** (ADR-146 HC9/Decision 12 가 선언한 text/description/icon/indicator slot 을 **실제 조합 자식 + DOM emit + Skia paint 로 실현**). |
| schema 직교성            | ADR-147 은 `ListBoxItem` origin 의 children/slot 조합을 확장 — ADR-146 선언 slot allow-list 의 **specialization**. ADR-146 projection-id boundary(R2/G3) · Components page bootstrap(G1) 와 **직교**(변경 없음).                           |
| baseline framing reverse | ADR-146(Implemented 2026-05-28) 이 ADR-147 의 **prerequisite**. 146→147 자연 방향, reverse 없음. baseline framing 자동 승계 아님 — fork 시점 확인 완료.                                                                                    |
| codex 3차 미루지 말 것   | framing 을 fork 시점(2026-05-29)에 lock-in. codex review 는 본문 정합 layer 로만 사용.                                                                                                                                                     |

사용자 explicit confirm: 2026-05-29 (ADR-147 신규 작성 / icon=columnMapping 우선 / SelectionIndicator=체크마크 shape).

## §2. 현재(stale) → 대상(target)

### 현재 모델

- `listBoxTemplateOrigins.ts:76-117` — `ListBoxItem/Default` origin: `props:{children:"{label}", textValue:"{label}", description:"{description}"}`, `children: undefined`(자식 없음).
- `ListBoxItemEditor.tsx` — `Field` 자식 추가 / "Convert to Dynamic Item"(ADR-132 이전 동적 모델) + flat `label`/`value`/`description`/`textValue` 편집.
- `SelectionRenderers.tsx` Path1 — label/description flat `<span>` emit / Path2 — `description` 미렌더(버그).
- `ListBoxItem.spec.ts render.shapes` — props.children/description 직접 읽어 수직 스택 paint(icon/indicator 없음).

### 대상 모델

```
ListBoxItem/Default origin (reusable, Components page)
  type:"ListBoxItem", reusable:true
  slot: ["label","description","icon","selection-indicator"]   // ADR-146 HC9 allow-list 실현
  children:
    - { type:"Icon",  metadata:{slotRole:"icon"}, props:{icon:"{icon}"} }            // optional
    - { type:"Text",  metadata:{slotRole:"label"}, props:{slot:"label", children:"{label}"} }
    - { type:"Text",  metadata:{slotRole:"description"}, props:{slot:"description", children:"{description}"} } // optional
    - { type:"SelectionIndicator", metadata:{slotRole:"selection-indicator"} }       // optional
```

- DOM(Preview): `<ListBoxItem><Icon slot="icon"/><Text slot="label">…</Text><Text slot="description">…</Text>{isSelected && <Check/>}</ListBoxItem>`
- Skia: render.shapes 가 slotRole 기반으로 icon shape + label/description text + selection 체크마크 paint
- 데이터: row projection 이 columnMapping/dataBinding 으로 label/description/icon content 채움

## §3. Phase 분해 (단일 land 지향, sub-group 분할 회피)

> 메모리 `feedback-tree-equals-reusable-enable-framing`: 트리화=reusable 자동 흡수. canonical descendants/RefNode 메커니즘 component-agnostic — 별도 reusable phase 분리 금지. `feedback-execute-adr-surface-minimization`: sub-step 과잉 분해 금지.

### Phase 1 — Canonical origin 조합 구조화

- 파일: `apps/builder/src/builder/components/listbox/listBoxTemplateOrigins.ts`
  - `createListBoxItemDefaultOrigin`/`createListBoxItemSelectedOrigin` — flat props → 조합 자식(Icon/Text label/Text description/SelectionIndicator) + `slot` allow-list 선언. 템플릿 바인딩 `{label}`/`{description}`/`{icon}` 은 자식 노드 props 로 이동.
  - slotRole 식별: child `metadata.slotRole` ("label"|"description"|"icon"|"selection-indicator"). resolver/renderer/Skia 공유 상수 `LISTBOX_ITEM_SLOT_ROLES` export.
- 파일: `apps/builder/src/dashboard/createInitialProjectDocument.ts` + `ensureListBoxTemplateOrigins` — Components page seed 가 새 조합 origin 생성(idempotent repair 포함).
- Gate G1.

### Phase 2 — Spec / Skia / CSS (D3 대칭)

- `packages/specs/src/components/ListBoxItem.spec.ts` `render.shapes` — slotRole 기반 paint:
  - icon shape(좌측, `{color.neutral}`), label text(slot=label, fontWeight 600), description text(slot=description, 작은 폰트 muted), selection 체크마크(`_isSelected` 시 우측 Check shape).
  - 기존 label/description 수직 스택 유지 + icon 가로 배치(icon | text-stack | indicator) 레이아웃.
- `packages/shared/src/components/styles/ListBox.css` — `[slot=label]`/`[slot=description]` 존재 확인 + `[slot=icon]`(좌측 가로) / selection 체크마크 layout 추가. generated/ListBox.css 정합.
- `packages/specs/src/components/Text.spec.ts` — `slot` prop 인지(DOM pass-through + Skia/factory 인지).
- Gate G2 (parity).

### Phase 3 — Preview Renderer (D1)

- `packages/shared/src/renderers/SelectionRenderers.tsx`:
  - Path1(template+dataBinding, ~239-245): flat `<span>` → `<Text slot="label">`/`<Text slot="description">`/`<Icon slot="icon">` emit. DropZone.tsx:70-71 패턴 재사용.
  - Path2(items[], ~310): `StoredListBoxItem.description` → `<Text slot="description">` emit (미렌더 버그 수정).
  - Path3(legacy children): 조합 자식 재귀 렌더가 slot 보존 확인.
- Gate G2.

### Phase 4 — Row projection ↔ slot content

- `apps/builder/src/builder/components/listbox/listBoxRowProjectionModel.ts`:
  - `getItemIcon(item)` 추가 — columnMapping 우선, fallback `["icon","avatar","image"]`. `ListBoxProjectionRow` 에 `icon: string | null` 필드.
  - Skia row projection(`canvasSceneNode.ts`/`listBoxRowProjection.ts`) 이 label/description/icon 을 조합 자식 paint props 로 전달 — 대칭 확인.
- Gate G2.

### Phase 5 — Properties 패널 (D2)

- `apps/builder/src/builder/panels/properties/editors/ListBoxItemEditor.tsx` — Field-children/"Convert to Dynamic Item" 제거. slot 기반 편집: label / description / icon(아이콘 선택) / SelectionIndicator on-off / textValue / isDisabled / href. origin vs ref anchor 선택 표시 분기.
- `apps/builder/src/utils/ui/labels.ts` `PROPERTY_LABELS` — icon/slot 라벨 추가.
- Gate G4.

### Phase 6 — 레거시 Field 제거 + 마이그레이션

- `apps/builder/src/adapters/canonical/legacyListBoxTemplateMigration.ts`:
  - 기존 ListBoxItem `Field` 자식 → dataBinding columnMapping 또는 정적 items 변환. flat `value`/`textValue` 보존.
  - 기존 flat-props ListBoxItem origin → 조합 자식 구조 1회 idempotent migration. `type` 미지정 BC 해석 유지.
- Gate G3.

### Phase 7 — 검증

- 테스트 갱신/추가: `ListBoxItem.render.test.ts`, `listBoxCanonicalContract.test.ts`, `listBoxAdr146Template.test.tsx`, `legacyListBoxTemplateMigration.*.test.ts`, `slotHostPolicy.test.ts`, `ListBoxItemEditor` 관련. 마이그레이션 round-trip(Field→dataBinding, flat→조합) 추가.
- `pnpm build:specs` + `pnpm type-check`(baseline 무증가) + per-package vitest + `/cross-check`(ListBoxItem 3축 대칭).
- README/CHANGELOG/ADR status sync.
- Gate G5.

## §4. Gate ↔ Risk 매핑

- G2 (D3 parity) ↔ R1(HIGH symmetric drift) 1:1.
- G3 (migration) ↔ R2(MED migration churn).
- G1/G4/G5 = 기능/UX/closure gate.

## §5. ADR-142 관계 메모

ADR-147 의 canonical origin 조합(composed children) 은 ADR-142(Proposed) "조합 컴포넌트=reusable frame" 방향과 정합 → forward-compatible. `render.shapes`/CSS slot paint 는 현 ComponentSpec 시스템 구현 — ADR-142 generic 렌더러 land 시 그 부분만 subsume 됨(canonical 구조는 보존). ADR-147 은 현 시스템에 구현하고 ADR-142 와 충돌하지 않음.

## §6. 검증 체크리스트

- [ ] Phase 1 origin 조합 + slot allow-list round-trip
- [ ] Phase 2 Skia 4-slot paint + CSS [slot] 정합
- [ ] Phase 3 DOM `<Text slot>` emit (Path1/2/3) + Path2 description 수정
- [ ] Phase 4 columnMapping icon 매핑
- [ ] Phase 5 Properties slot 편집 + Field 경로 부재
- [ ] Phase 6 Field→dataBinding + flat→조합 마이그레이션 round-trip
- [ ] Phase 7 type-check baseline 무증가 + cross-check 3축 PASS
