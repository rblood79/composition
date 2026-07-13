# ADR-100 구현 상세 — Select 자식 네이밍 RSP 정합 (ADR-098-a 슬롯)

> ADR-100 본문: [100-select-child-naming-rsp-alignment.md](../completed/100-select-child-naming-rsp-alignment.md)
>
> 본 문서는 ADR-100 Decision (대안 C — SelectItem 내부 개념 정리 + SelectTrigger composition 고유 유지 정당화) 의 Phase 단위 실행 상세. ADR-098 감사 Charter 의 "098-a 슬롯" 구현.

## BC 영향 재평가 (ADR-098 breakdown 정정)

ADR-098 breakdown 의 후보 #1 은 SelectItem/SelectTrigger 를 **일괄 HIGH BC** 로 분류했으나, 2026-04-21 현장 재조사 결과 두 식별자의 BC 영향이 **비대칭** 함을 확인. 본 ADR 은 이 비대칭을 반영한 분할 결정.

### SelectItem BC 재평가 — **실질 0%**

ADR-073 (`docs/adr/completed/073-select-combobox-items-ssot.md`) 에서 Select items 를 `StoredSelectItem[]` SSOT 로 이관 완료. 저장 데이터에 `element.tag === "SelectItem"` 이 **더 이상 존재하지 않음** (items 배열 내부 객체는 `{ id, label, value, ... }` 구조, `tag` 필드 없음).

- `rg "\"SelectItem\"" --type ts` = 26 occurrences / 11 files
- 11 files 내역: docs 2 + migration 테스트 4 + SelectionRenderers 1 + elementRemoval 1 + runtime 3
- **저장 데이터 migration 불필요** — 모든 occurrence 는 runtime 변환 / 테스트 / 문서. SSOT migration 오케스트레이터(`applyCollectionItemsMigration`) 확장 없음
- 리네이밍 시 변경 범위: runtime 식별자 상수 "SelectItem" → "ListBoxItem" (또는 "SelectItem" alias 유지) + SelectionRenderers 내부 분기 명칭 + 문서/주석

### SelectTrigger BC 재평가 — **실질 HIGH**

SelectTrigger 는 ADR-073 이후에도 **Compositional Architecture 유지** — Select 의 자식 Element 로 저장 데이터에 `element.tag === "SelectTrigger"` 직렬화.

- `rg "\"SelectTrigger\"" --type ts` = 23 occurrences / 14 files
- 14 files 내역: spec 2 + factory 1 + runtime 4 (utils/implicitStyles/buildSpecNodeData/HierarchyManager) + SelectionRenderers 1 + docs 3 + 기타
- **저장 데이터 migration 필수** — 모든 Select 사용 프로젝트의 element tree 에 `tag: "SelectTrigger"` 노드 존재. 리네이밍 시 `applyCollectionItemsMigration` 확장 또는 새 migration path 필요
- 재직렬화 영향: Select element 1개 당 자식 SelectTrigger 1개 → **100% 영향** (composition 기반 모든 프로젝트)

### 수식화 결론

| 식별자        | occurrence | files |      저장 데이터 영향       | migration 필요 | BC 등급 |
| ------------- | :--------: | :---: | :-------------------------: | :------------: | :-----: |
| SelectItem    |     26     |  11   |       0% (items SSOT)       |       ❌       |   LOW   |
| SelectTrigger |     23     |  14   | 100% (모든 Select 프로젝트) |       ✅       |  HIGH   |

## 핵심 설계 문제

RAC 공식 Select 구조:

```tsx
<Select>
  <Label />
  <Button>
    {/* ← composition 의 SelectTrigger */}
    <SelectValue />
  </Button>
  <Popover>
    <ListBox>
      <ListBoxItem />
      {/* ← composition 의 SelectItem */}
    </ListBox>
  </Popover>
</Select>
```

### SelectItem 처리 옵션

- **옵션 α**: 내부 식별자를 "ListBoxItem" 으로 통일 (RAC 공식 정합)
- **옵션 β**: "SelectItem" alias 유지 + runtime 에서 ListBoxItem 으로 매핑
- **옵션 γ**: "SelectItem" 명칭 유지 + 098-e 에서 정당화

### SelectTrigger 처리 옵션

- **옵션 α**: "Button" (RAC 공식 Button slot="trigger") 으로 완전 리네이밍 + migration
  - **문제 1**: composition 의 다른 Button element 와 저장 tag 중복 → runtime discrimination 필요 (`slot="trigger"` 속성으로 구분)
  - **문제 2**: 기존 Button factory/spec 과 혼용 → factory 분기 복잡도↑
  - **문제 3**: LayerTree 에서 사용자가 Select 내부 Button 과 일반 Button 을 시각적으로 구분하기 어려움
- **옵션 β**: "SelectTrigger" 유지 + composition 고유 네이밍 정당화 문서 (098-e 연계)
  - **근거**: Compositional Architecture 에서 각 tag 가 고유 editor/factory/layout 분기를 가짐. Button 중복 시 discriminator 분기 비용↑
  - **근거 2**: ADR-063 D2 도메인 원칙 — "RSP 에 없는 커스텀 prop 임의 도입 금지" 에 적용되나, **composition 고유 tag 네이밍은 D2 의 scope 밖** (tag 는 D2 props 가 아닌 element 식별자, D1 DOM 구조 내 분류)
  - **근거 3**: RAC 는 runtime 에서 `slot="trigger"` 를 Button 에 주입하는 방식 → composition 의 element tree 는 디자인 시점 표현이므로 tag 수준의 명시적 구분이 UX 에 더 적합
- **옵션 γ**: 부분 리네이밍 — `SelectTrigger` 를 `Trigger` 로 단축 (Select 전용 수식어 제거)
  - Button 충돌 없음 + 명칭 간결
  - 여전히 HIGH BC migration 필요

## Phase 구조

### Phase 0 — 현장 데이터 재조사 + 설계 확정 (Completed 2026-04-21)

- [x] `rg "SelectItem"` / `rg "SelectTrigger"` occurrence count 수집
- [x] 저장 데이터 `element.tag` 존재 여부 확인 (items SSOT vs compositional)
- [x] BC 영향 비대칭 확증 — SelectItem 0% vs SelectTrigger HIGH
- [x] RAC 공식 Button slot="trigger" 패턴 vs composition Compositional Architecture 비교
- [x] 3 옵션 × 2 식별자 = 6 조합 평가 → Decision 대안 3건 압축

### Phase 1 — SelectItem 내부 식별자 정리 (BC 0%) (Completed 2026-04-21 세션 8)

**재결정 (Phase 1 진입 시)**: runtime 식별자 rename 은 **미수행**. 근거:

1. **Factory 확증** (`SelectionComponents.ts:14`): "SelectItem 자식 element 는 더 이상 생성하지 않는다" — 신규 Select 는 items SSOT (`StoredSelectItem[]` factory 기본값). 저장 데이터에 `tag: "SelectItem"` 없음
2. **기존 프로젝트 migration 경로** (`migrateCollectionItems.ts:74`): load-time 자동 흡수 — 5 runtime 경로가 legacy 호환용으로 여전히 `"SelectItem"` 문자열 참조 유지 필요
3. **rename 시 BC 회귀**: 5 경로 + 4 test fixture 일괄 변경 시 기존 저장 프로젝트 migration 경로 차단 위험. "SelectItem" legacy 식별자 유지가 composition 고유 tag 보존 원칙 (ADR-100 대안 C) 과 정합

**실행 작업 (5 runtime 경로 RAC alias 주석 추가)**:

- [x] `packages/specs/src/types/select-items.ts` L1-9 header 주석 — ADR-100 Phase 1 명시 + RAC `ListBoxItem` alias 근거 3건
- [x] `packages/shared/src/renderers/SelectionRenderers.tsx:669` — `"SelectItem"` filter 위 ADR-100 Phase 1 주석 (migration 전 호환 명시)
- [x] `packages/shared/src/utils/migrateCollectionItems.ts:74` — `tag === "SelectItem"` 분기 위 legacy Element 흡수 주석 (RAC 공식명 + BC HIGH 회피 근거)
- [x] `apps/builder/src/preview/App.tsx:499` — `case "SelectItem"/"ComboBoxItem"` fallback 위 주석 (신규 items SSOT vs 기존 호환 구분)
- [x] `apps/builder/src/builder/stores/utils/elementRemoval.ts:26` — `COLLECTION_ITEM_TAGS` Set 위 주석 (삭제 연쇄 대상 유지 근거)

**영향 0 경로 (변경 없음)**:

- 4 test fixture 파일 (`migrateCollectionItems.test.ts`, `migrateSelectComboBoxItems.test.ts`, `elementRemoval.test.ts` + 1) — legacy 저장 데이터 시뮬레이션 의도적. 주석 불필요
- `SelectionComponents.ts` factory — L14 주석 이미 items SSOT 명시, 추가 작업 불요

### Phase 2 — SelectTrigger composition 고유 유지 정당화 (Completed 2026-04-21 세션 8)

- [x] `SelectTrigger.spec.ts` 상단 주석 강화 — ADR-100 Phase 2 정당화 근거 3건 명시 (저장 식별자 고유성 / runtime DOM RSP 정합 달성 / LayerTree UX 명시성)
- [x] ADR-100 본문 selfcontained 정당화 섹션 추가 — "SelectTrigger 정당화 (ADR-098-e 연계 전 selfcontained)" 섹션 + 근거 표 3건 + runtime 경로 증거 4건 + 대안 α 기각 근거 재확인 3건
- [x] factory SelectTrigger 생성 경로 확증 — `SelectionComponents.ts:74` `tag:"SelectTrigger"` 자식 생성 + 주석 L15 "Label / SelectTrigger sub-element 는 유지"
- [x] runtime DOM RSP 정합 증거 — `packages/shared/src/components/Select.tsx:309` `<Button className="react-aria-Button"><SelectValue /></Button>` 직접 렌더 (D1 도메인 이미 달성)
- [ ] LayerTree 아이콘/라벨 "Select Trigger" 부가 설명 — UI 수정 scope 크므로 **후속 Addendum 으로 이관** (본 ADR Phase 2 scope 밖)

**검증 (code-level)**: type-check 3/3 + 기존 테스트 PASS 유지. Chrome MCP 실측은 Phase 3 (code-level 증거로 대체 허용, ADR-092/093/095 선례).

### Phase 3 — Runtime DOM 정합 검증 (code-level 완결 2026-04-21 세션 8)

- [x] code-level 증거 수집 완료 — `Select.tsx:309` RAC Button slot + `SelectionRenderers.tsx:704` childrenMap SelectTrigger lookup + `HierarchyManager.ts:402-406` Select 자식 필터
- [ ] Chrome MCP 실측 — 연결 가능 시점 확인 (ADR-092/093/095 선례대로 code-level 증거 우선 허용)
- [ ] `/cross-check` skill — Skia Select 렌더와 Preview DOM 렌더 시각 정합 (후속 수행)

### Phase 4 — 문서/ADR 갱신 (Completed 2026-04-21)

- [x] ADR-098 본문에 BC 재평가 Addendum 추가 (breakdown #1 후보 정정 — SelectItem 실질 0% / SelectTrigger HIGH 비대칭)
- [x] ADR-098-e (정당화 문서 ADR) 미발행 상태 → ADR-100 Phase 2 selfcontained 정당화 섹션 본문 수록 완료
- [x] README.md ADR-100 Implemented 전환 + 최상위 요약 갱신

### Phase 5 — Status 전환 (Completed 2026-04-21)

- [x] type-check 3/3 + specs 176/176 + builder 227/227 + shared 52/52 PASS
- [x] ADR-100 Status: Proposed → Implemented 2026-04-21
- [x] ADR-098 Charter Implemented 전환 완료 (본 ADR 이 첫 완결 분할 ADR — Phase 4 Gate 충족)

## 반복 패턴 선차단 체크

- ✅ **#1 코드 경로 인용**:
  - `packages/specs/src/components/SelectTrigger.spec.ts` (L1-60 현재 구조)
  - `packages/specs/src/components/Select.spec.ts` (L64 items SSOT)
  - `packages/specs/src/types/select-items.ts` (StoredSelectItem 정의)
  - `apps/builder/src/builder/factories/definitions/SelectionComponents.ts` (SelectTrigger factory)
  - `packages/shared/src/renderers/SelectionRenderers.tsx` (RAC 매핑)
  - `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` + `implicitStyles.ts` + `skia/buildSpecNodeData.ts` (runtime 분기)
- ✅ **#2 Generator 확장 여부**: Phase 1/2 모두 문서 + 주석 + runtime 내부 정리. `CSSGenerator` 확장 **불필요** (spec 파일 자체 유지).
- ✅ **#3 BC 훼손 수식화**:
  - SelectItem: **0% / 0 파일 재직렬화** (items SSOT 내부 구조, `tag` 필드 없음)
  - SelectTrigger: **100% Select 프로젝트 영향, 평균 N 개 element (N = 프로젝트 내 Select 개수)** — 단 본 ADR 은 SelectTrigger **유지** 결정 → 실제 migration 0건
  - 대안 A (완전 리네이밍) 기각 근거 = BC HIGH 회피
- ✅ **#4 Phase 분리 가능성**: 5 Phase. Phase 1 (SelectItem) + Phase 2 (SelectTrigger 정당화) 는 독립 → 필요 시 별도 ADR 로 재분리 가능하나 본 ADR 에서는 Select 자식 전체를 한 결정으로 묶는 것이 감사 charter 의도에 부합.

## 2026-04-21 기준선 (sanity)

```bash
pnpm -w type-check                                # 3/3 PASS (38ms FULL TURBO cached)
cd packages/specs && pnpm exec vitest run         # 166/166 PASS
cd apps/builder && pnpm test -- --run             # 227/227 PASS
cd packages/shared && pnpm exec vitest run        # 52/52 PASS
```

## 검증 체크리스트 (본 ADR 완료 기준)

- [x] Phase 0 BC 재평가 + 3 대안 평가 완료
- [x] Phase 1 SelectItem 5 runtime 경로 RAC alias 주석 + 문서 용어 일관성
- [x] Phase 2 SelectTrigger 정당화 문서 + factory Button slot 매핑 확증 (code-level)
- [x] Phase 3 runtime DOM 검증 — code-level 증거 3건 수집 완료 (Chrome MCP 실측 후속 허용)
- [x] Phase 4 ADR-098 Addendum 1 + README 갱신
- [x] Phase 5 Status Implemented 2026-04-21

## 잠재 후속 ADR

- **100-a (필요 시)**: SelectTrigger 를 "Trigger" (옵션 γ) 로 단축 리네이밍 — BC HIGH, Select 프로젝트 migration 필요. 본 ADR 에서 기각했으나 향후 컴포넌트 라이브러리 일관성 재검토 시 후보
- **098-e 연계**: SelectIcon + CheckboxItems + RadioItems + SelectTrigger 정당화 문서 ADR (composition 고유 네이밍 유지 근거 통합 문서)
