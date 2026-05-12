# ADR-130 Design Breakdown — Layer 3 Canonical Vocabulary 정렬

> **본 문서는 ADR-130 의 구현 상세 (Phase / 파일 변경표 / 체크리스트)** 입니다. 결정 / 위험 / Gate 는 [130-layer3-canonical-vocabulary-alignment.md](../130-layer3-canonical-vocabulary-alignment.md) 본문 참조.
>
> **Source plan**: `/root/.claude/plans/vectorized-frolicking-mochi.md` (2026-05-09 explore+brainstorm 종합).

---

## §1. ADR Fork Framing Checkpoint (CRITICAL — adr-writing.md 강화)

본 ADR 은 ADR-116 / ADR-122 / ADR-126 의 **응용 ADR** 로 분류된다. 4 질문 lock-in:

1. **base / 응용 분류**: 본 ADR = **응용** (canonical vocabulary literal 값 의 builder factory 진입점 정렬). **base 3개**:
   - ADR-116 (`CompositionDocument` canonical SSOT) — schema 정의
   - ADR-122 (canonical-only runtime) — runtime mutable mirror 제거
   - ADR-126 (Element 타입 deprecate / boundary 격리) — Element TypeScript 인터페이스 boundary 정합
   - **직교성 확증**: ADR-126 = D2 (Element 인터페이스 자체 boundary 격리, TypeScript type shape) / 본 ADR = D3 (`type` 필드의 **literal 값** vocabulary 정렬, Spec SSOT). 둘은 직교 — ADR-126 이 Element 타입을 격리해도 element.type 의 vocabulary 값 정렬은 별도 작업이며 base 의 schema 위에서 literal 만 정렬.
2. **schema 직교성**: 본 ADR 의 canonical schema 변경 = **0**. `FrameNode` / `GroupNode` interface 변경 없음. `composition-vocabulary.ts:22-145` mix 정책 보존. **변경 surface = factory creator + grouping action + renderer dispatch + history undo/redo + auto-migration step + TAG_SPEC_MAP frame entry 등록 + 신규 Frame.spec.ts** 6개 구역.
3. **baseline framing reverse 검증**: ADR-116 의 의존 방향 = `canonical schema → consumer (builder/preview/publish)`. ADR-126 의 의존 방향 = `Element TypeScript type → boundary allowlist`. 본 ADR = consumer-side literal 값 정합 (canonical schema + Element 타입 둘 다 위에서 동작). 의존 방향 유지 — reverse 의심 없음.
4. **codex 3차 review 까지 미루지 말 것**: 본 ADR 발의 시점에 `ssot-hierarchy.md` 3-domain framing (D1 RAC / D2 RSP / D3 Spec) 정합 확증. RAC `Group` (D1/ARIA) 보존 + canonical `frame` (Layer 3 SSOT/D3) 진입 경로 단일화 + Element 타입 (D2) 무관 = framing 일관.

**ADR-126 boundary 와의 정합 검증 항목** (Phase 7 hydration migration 시 추가 점검):

- `legacyElementSanitizer.ts` 등 ADR-126 boundary 격리 대상 파일이 hydration 시점에 element.type 을 읽는다면 frame literal 도 인식해야 함
- ADR-126 의 `canonicalDocumentToElements()` 파생 view 가 element.type 을 그대로 통과시키므로 vocabulary 정렬 후 정합 자동 (별도 작업 불필요)

**sub-phase 분해 진입 게이트 통과**: 본 §1 lock-in 후 §3 Phase 분해 진입 허용.

---

## §2. 13 Row Vocabulary 매핑 표 (Layer 3 SSOT)

본 ADR 의 vocabulary 정합 SSOT. 변경 시 `pencil-adapter.types.ts` + `pencilSchemaMap.ts` 와 동기화.

| #   | pencil type | composition canonical | pencil 의미 보존                          | 결정 사유 (file:line)                                              |
| --- | ----------- | --------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| 1   | `frame`     | `frame`               | identity + clip/placeholder               | `pencilSchemaMap.ts:35`, `composition-document.types.ts:287-312`   |
| 2   | `group`     | `frame`               | type 흡수 + `metadata.pencilType="group"` | `pencilSchemaMap.ts:36`, `pencil-adapter.types.ts:213-214,231-239` |
| 3   | `rectangle` | `frame`               | metadata.pencilType + props (fill 등)     | `pencilSchemaMap.ts:24`, `pencilImport.test.ts:6-39`               |
| 4   | `ellipse`   | `frame`               | 동일                                      | `pencilSchemaMap.ts:25`                                            |
| 5   | `line`      | `frame`               | 동일                                      | `pencilSchemaMap.ts:26`                                            |
| 6   | `polygon`   | `frame`               | 동일                                      | `pencilSchemaMap.ts:27`                                            |
| 7   | `path`      | `frame`               | 동일                                      | `pencilSchemaMap.ts:28`                                            |
| 8   | `text`      | `Text`                | promote (PascalCase) + props.text         | `pencilSchemaMap.ts:29`, `pencil-adapter.types.ts:220-221`         |
| 9   | `note`      | `Text`                | metadata.pencilType="note"                | `pencilSchemaMap.ts:30`                                            |
| 10  | `prompt`    | `Text`                | metadata.pencilType="prompt"              | `composition-mapping.md:89`                                        |
| 11  | `context`   | `Text`                | metadata.pencilType="context"             | `pencilSchemaMap.ts:32`                                            |
| 12  | `icon_font` | `Icon`                | promote + props (icon 키)                 | `pencilSchemaMap.ts:33`, `pencil-adapter.types.ts:222-223`         |
| 13  | `ref`       | `ref`                 | identity + descendants                    | `composition-document.types.ts:317-340`                            |

**Round-trip 손실 0 보장 (파일 format 한정)**: vector primitive 5종 (3-7) import 시 `frame` 흡수가 lossy 한 듯 보이나 export adapter 가 `node.metadata.pencilType` 우선 인용 (`pencil-adapter.types.ts:232-233`) 하여 원본 type 복원. `pencilRoundtrip.test.ts:28-39` 5 fixture fixture-equality 검증.

**Group ↔ group namespace 분리**:

- `"Group"` (PascalCase, RAC ARIA semantic) — `composition-vocabulary.ts:71`
- `"group"` (lowercase, pencil structural) — `composition-vocabulary.ts:145`
- pencil export 시 RAC `Group` 은 default `"frame"` + `metadata.compositionType="Group"` 로 복원 (`pencil-adapter.types.ts:244-245,286-295`)

---

## §3. Phase 구성

### Phase 0 — Inventory (사전 점검)

목적: 구현 시작 전 잔존 `type: "Group"` element / customId prefix 분포 측정.

작업:

1. `apps/builder/src/**` grep `type: "Group"` raw count baseline
2. dev project IndexedDB seed 에서 customId prefix `group_` 분포 측정
3. `pencilRoundtrip.test.ts` 5 fixture 의 `Group` 사용 여부 (현재 0건 추정)

Gate G0: baseline 측정 완료 + Phase 1 진입 허용 표시 (issue 또는 design 파일 §6 기록).

### Phase 1 — 신규 `Frame.spec.ts` 생성 + TAG_SPEC_MAP `"frame"` 등록 (CRITICAL — 사용자 confirm 2026-05-09)

목적: spec lookup 실패 차단 (renderer NaN 방지) + RAC `Group` (D1/ARIA semantic) ↔ canonical `frame` (Layer 3/layout) 분리 의도 lock-in.

**사용자 결정 (lock-in)**: 신규 Frame.spec.ts — alias 가 ARIA `role:"group"` 을 frame 에도 emit 하여 분리 의도 훼손하는 점 회피. 비용 ~50줄은 1회. alias 후 분리 시 snapshot/CSS 재생성 비용이 더 큼 (ADR-908 Phase 4 의 82 spec migration 패턴 회피).

작업:

- `packages/specs/src/components/Frame.spec.ts` (신규)
  - `name: "frame"` (lowercase pencil structural)
  - `skipCSSGeneration: true` (layout container dedicated)
  - ARIA role 없음 (Group spec 의 `role: "group"` 비대응)
  - `render.shapes()`: 빈 배열 또는 background 색상만 (FrameNode `clip`/`placeholder` props 반영)
  - `composition.staticSelectors`: 없음
  - sizes/variants: 최소 (md 만)
- `packages/specs/src/components/index.ts` export 추가: `export { FrameSpec } from "./Frame.spec";`
- `packages/specs/src/index.ts` re-export 추가
- `packages/specs/src/runtime/tagToElement.ts:128-273` `BASE_TAG_SPEC_MAP["frame"] = FrameSpec`
- `packages/specs/src/runtime/tagToElement.ts` HTML mapping: `getElementForTag("frame")` → `"div"`
- `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts:31` builder merge layer 자동 파급 검증
- 신규 unit test: `packages/specs/src/__tests__/Frame.spec.test.ts`
  - `getSpecForTag("frame") !== undefined`
  - `getElementForTag("frame") === "div"`
  - `FrameSpec.skipCSSGeneration === true`
  - `FrameSpec.name === "frame"`

Group.spec 은 ARIA `role: "group"` 보존 (`packages/specs/src/components/Group.spec.ts:122` 그대로 — 변경 0).

대안 alias 방식 (기각): `BASE_TAG_SPEC_MAP["frame"] = GroupSpec` 한 줄 추가. Pros = 비용 ~5줄 / Cons = ARIA role 이 frame 에도 emit, FrameNode interface (clip/placeholder) 와 GroupSpec 비대응, 회귀 격리 실패. **사용자 결정 시점에 기각**.

Gate G1 (CRITICAL): `pnpm build:specs` 통과 + 신규 test PASS + storybook 회귀 0 (Group spec 변경 0 → snapshot 영향 0).

### Phase 2 — Factory 진입점 정렬

목적: builder UI palette / multi-select grouping 의 진입점을 `type: "frame"` 으로 단일화.

작업:

- `apps/builder/src/builder/factories/definitions/GroupComponents.ts:9-30`
  - `createGroupDefinition` body 재정렬: `type: "Group"` → `type: "frame"` (line 16, 18 두 곳)
  - props 표준: `{ slot: false, clip: false, placeholder: false, style: { display: "flex", flexDirection: "column", gap: ... } }`
  - rename: `createFrameLayoutDefinition` (semantic-implementation 정합)
- `apps/builder/src/builder/factories/ComponentFactory.ts:112`
  - 옵션 A1 (권장): creator map key/method `Frame: createFrame`
  - 옵션 A2 (보수): key `Group` 유지 + method 가 `type: "frame"` 생성 (단기 호환, 장기 부채)
- `apps/builder/src/builder/panels/components/ComponentList.tsx:88`
  - palette entry: `{ type: "Group", label: "group" }` → `{ type: "frame", label: "frame" }`
  - 사용자 결정: Frame 만 palette 노출. RAC ARIA Group entry 는 후속 슬라이스

Gate G2: factory unit test PASS + palette 클릭 → frame 생성 통합 검증.

### Phase 3 — Grouping 동작 (CRITICAL — ID collision 방어)

목적: multi-select grouping / ungrouping 액션이 frame type 으로 동작 + transitional period 보호.

작업:

- `apps/builder/src/builder/stores/utils/elementGrouping.ts`
  - **line 99 filter (CRITICAL)**: `(el) => el.type === "Group" && el.customId?.startsWith("group_")` → `(el) => (el.type === "frame" || el.type === "Group") && el.customId?.startsWith("group_")`
    - **Why**: migration 후 잔존 legacy `Group` + 신규 `frame` 공존 transitional period 동안 next-id 계산이 양쪽 count 해야 `group_N` 중복 발급 방지. migration 완료 후 `Group` 분기 제거 (Phase 5 cleanup)
  - line 116: `type: "Group"` → `type: "frame"` (신규 group 생성 시 type)
  - **line 184 (NEW)**: `groupElement.type !== "Group"` ungroup validation guard → `groupElement.type !== "frame" && groupElement.type !== "Group"`
- `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx:1183`
  - ungroup 버튼 UI guard: `selectedElement.type !== "Group"` → `selectedElement.type !== "frame" && selectedElement.type !== "Group"`
  - **Why**: legacy `Group` element 도 ungroup 동작 보장 (migration 보완)

Gate G3: `elementGrouping.test.ts` (없으면 신규) — group/ungroup 액션이 frame type 결과 검증 + customId `group_N` non-duplicate 검증.

### Phase 4 — Renderer / Layout engine frame case 추가

목적: 모든 type-별 분기에 frame fall-through 보장.

작업:

- `apps/builder/src/preview/App.tsx:614-615`
  - preview switch: `case "Group": return "div";` → `case "Group": case "frame": return "div";`
  - **Why**: preview 가 type → HTML tag 결정 분기에서 frame 누락 시 frame 미렌더
- `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:1745`
  - `new Set(["Group"])` → `new Set(["Group", "frame"])` (정확한 set 명/사용처는 implementation 시 line 인접 코드 정독)
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:2732` (HIGH 점검)
  - `if (type === "group")` (lowercase) bounding box 높이 계산 분기 의도 확인
  - (a) PascalCase "Group" 의도였다면 → `(type === "Group" || type === "frame")` 정정
  - (b) lowercase pencil "group" 의도였다면 → lowercase "frame" 도 추가

Gate G4: preview render 통합 검증 + Skia layout 통합 검증 (frame container 의 자식 measurement OK).

### Phase 5 — History undo/redo 정합

목적: frame 생성/삭제 후 undo/redo 가 frame type 추적.

작업:

- `apps/builder/src/builder/stores/history/historyActions.ts` 12 case 분기 전수 grep
- 각 case 에 frame fall-through 추가 또는 `(type === "Group" || type === "frame")` 으로 일반화
- `historyActions.diff.test.ts:277-278` test fixture 에 frame 케이스 추가

Gate G5: history undo/redo 통합 테스트 (frame 생성 → undo → element 사라짐 → redo → 복원) PASS.

### Phase 6 — Pencil round-trip adapter 명시화

목적: `toPencilType()` switch 의 metadata 우선순위 lock-in.

작업:

- `packages/shared/src/types/pencil-adapter.types.ts:237-238`
  - `toPencilType()` switch 에 `case "Group": return "frame";` 추가 (현재 default fall-through 동작이지만 의도 명시)
  - **Why**: default 분기가 `metadata.pencilType` 무시할 가능성 차단. legacy `type: "Group"` element export 시 metadata round-trip 우선순위 보존
  - line 209-219 `toCanonicalType()` (pencil "group" → canonical "frame") 변경 없음

Gate G6: `pencilRoundtrip.test.ts` 5 fixture + 신규 `legacy-group.pen` (legacy Group + customId group_N) fixture 통과.

### Phase 7 — Auto-migration step (hydration 1회)

목적: 기존 사용자 프로젝트의 `type: "Group" + customId="group_N"` element 1회 정렬.

작업:

- 위치 후보:
  1. 1차: `apps/builder/src/adapters/canonical/tagRename.ts:21` `tagToType()` 에 group\_ prefix 분기 추가
  2. 2차: `apps/builder/src/adapters/canonical/index.ts:145` `buildNode()` post-processing 단계
- 조건: `node.type === "Group" && node.customId?.startsWith("group_")`
- 변환: `node.type = "frame"` (mutation 또는 새 객체)
- **제외**: customId 없음 또는 다른 prefix → ARIA semantic 보존

Gate G7: dev/staging 프로젝트 통합 테스트 — Group + group_N customId element 가 loader 통과 후 frame 으로 변환됨 확증. ARIA Group element (customId 없음) 보존 검증.

### Phase 8 — Test 회귀

작업:

- `pencilRoundtrip.test.ts` 신규 fixture: `legacy-group.pen` (legacy Group + customId group_N → migration 후 frame)
- `elementGrouping.test.ts` 신규 (없으면): group/ungroup 액션 결과 type/customId 검증
- 기존 17개 fixture (`type: "Group"` 사용) 자동 파급 검증
- `historyActions.diff.test.ts` frame fixture 추가

Gate G8: targeted vitest run + `pnpm tsc --noEmit` (또는 `pnpm run codex:typecheck`) PASS.

### Phase 9 — 통합 검증 + closure

작업:

- ARIA 보존 cross-check: GroupSpec (`role: "group"`) 사용처 회귀 없음 — storybook + a11y test
- `pnpm run codex:preflight` (ADR-116/122 closure 표준 gate) 통과
- README 갱신: ADR-130 Status `Proposed → Accepted → Implemented` 진행
- CHANGELOG 갱신: `### Architecture` 섹션 추가

Gate G9: codex:preflight PASS + README 정합 + CHANGELOG 정합.

---

## §4. RAC Group SSOT 보존 (변경 없음)

다음 파일은 **변경 없음** — RAC ARIA semantic 보존 책임:

- `packages/shared/src/types/composition-vocabulary.ts:71` `"Group"` literal 유지
- `packages/shared/src/components/metadata.ts:689` RAC `Group` 메타 유지
- `packages/specs/src/components/Group.spec.ts:28` `name: "Group"` 유지
- `apps/builder/src/adapters/pencil/pencilSchemaMap.ts` 유지
- `packages/shared/src/types/composition-document.types.ts` `FrameNode` interface 유지

---

## §5. 본 ADR 범위 외 (별도 슬라이스)

- **Vector primitive Skia rendering** (canvas-skia 가 `metadata.pencilType` + `props` 읽어 vector 시각 재현). 후속 ADR 발의 — pencil consumer 발생 시점에 우선순위 결정.
  - 현재 grep 결과 `nodeRendererShapes.ts` / `nodeRendererTree.ts` 에 `metadata.pencilType` 읽는 코드 0건 → import 한 vector 가 빈 frame 으로 표시 (시각 손실)
- **lowercase "group" literal 제거** (vocabulary cleanup):
  - Phase 1 (본 ADR): 현 상태 유지
  - Phase 2 (후속): `toPencilType()` 가 `metadata.pencilType` 우선 정합 → effective dead 화 검증
  - Phase 3 (후속): `composition-vocabulary.ts:145` `"group"` literal + `PencilStructureType` 축소
- **UI 라벨 변경** (UX 일관성 결정):
  - `apps/builder/src/builder/config/keyboardShortcuts.ts:363` `description: "Group"`
  - `apps/builder/src/i18n/translations.ts:219` `group: "Group"`
  - "Frame" 변경 여부는 후속 UX 결정
- **ESLint custom rule / type brand**:
  - `el.type === "group"` 사용처 → `apps/builder/src/adapters/pencil/**` 한정 warning
  - `el.type === "Group"` 사용처 → ARIA 관련 (`role: "group"`, `aria-label`) 동반 검사
  - `isPencilStructureType()` / `isRACComponentTag()` helper

---

## §6. Phase 0 Inventory 결과 기록 슬롯

> implementation 시 baseline 수치 기록.

```
Phase 0 baseline (date: TBD):
- `type: "Group"` raw count (apps/builder/src): TBD
- customId `group_` prefix 분포: TBD
- pencilRoundtrip.test.ts fixture 의 Group 사용: TBD
```

---

## §7. Critical Files

수정:

- `apps/builder/src/builder/factories/definitions/GroupComponents.ts`
- `apps/builder/src/builder/factories/ComponentFactory.ts`
- `apps/builder/src/builder/panels/components/ComponentList.tsx`
- `apps/builder/src/builder/stores/utils/elementGrouping.ts`
- `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`
- `apps/builder/src/preview/App.tsx`
- `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
- `apps/builder/src/builder/stores/history/historyActions.ts`
- `packages/shared/src/types/pencil-adapter.types.ts`
- `packages/specs/src/runtime/tagToElement.ts` (또는 신규 `Frame.spec.ts`)
- `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`
- canonical-document loader (hydration 진입점 — `tagRename.ts` 또는 `index.ts:145`)

테스트 (확장):

- `apps/builder/src/adapters/pencil/__tests__/pencilRoundtrip.test.ts`
- `apps/builder/src/builder/stores/utils/__tests__/elementGrouping.test.ts` (신규)
- `apps/builder/src/builder/stores/history/__tests__/historyActions.diff.test.ts`

문서:

- `docs/adr/130-layer3-canonical-vocabulary-alignment.md` (본 ADR)
- `docs/pencil-copy/composition-mapping.md` (13 row 표 SSOT 명문화 — 옵션)
- `docs/CHANGELOG.md` (Implemented 승격 시)
- `docs/adr/README.md` (Status 진행)

참조 (변경 없음 — SSOT 그대로 보존):

- `packages/shared/src/types/composition-vocabulary.ts`
- `packages/shared/src/types/composition-document.types.ts`
- `packages/shared/src/components/metadata.ts`
- `packages/specs/src/components/Group.spec.ts`
- `apps/builder/src/adapters/pencil/pencilSchemaMap.ts`
