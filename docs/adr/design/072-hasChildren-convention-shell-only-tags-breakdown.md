# ADR-072 구현 상세 — `_hasChildren` 컨벤션 SSOT + Shell-only 태그 재분류

> ADR 본문: [072-hasChildren-convention-shell-only-tags.md](../completed/072-hasChildren-convention-shell-only-tags.md)

## 1. 컨테이너 3분류 정의

| 분류                | 정의                                                                                             | `_hasChildren` 주입 조건       | `incrementalSync` expansion     | 현 Set                            |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------- | --------------------------------- |
| **Shell-only**      | factory가 자식을 자동 생성하고 자식이 독립 Skia 노드로 렌더링됨. 부모는 shell(bg+border)만 반환. | 자식 수 무관하게 **항상 주입** | 불필요                          | `SHELL_ONLY_CONTAINER_TAGS`       |
| **Synthetic-merge** | 자식 props를 부모 spec shapes에 통합 렌더링(Breadcrumbs `_crumbs`, GridList `items` 등).         | **금지** (주입 시 내용 사라짐) | 필요 (자식 변경 → 부모 rebuild) | `SYNTHETIC_CHILD_PROP_MERGE_TAGS` |
| **Plain**           | 위 두 범주 외 일반 컨테이너. 자식이 있을 때만 shell 동작 원하는 경우.                            | 자식 0+ 일 때 주입             | 불필요                          | (둘 다 미포함)                    |

## 2. 판정 알고리즘 (spec standalone 분기 감사)

각 후보 태그의 `spec.render.shapes(props, size, state)` standalone 분기(= `_hasChildren=false` 경로)가 반환하는 shapes를 검사:

```
if (standalone 분기가 "빈 container placeholder 수준") → Shell-only 이동 후보
if (standalone 분기가 "자식 props 기반 items/crumbs/panels 통합 렌더") → Synthetic-merge 유지
if (standalone 분기가 "실제 시각 UI 전체를 독립 렌더링") → Shell-only 이동 필수 (Calendar 류, 중복 리스크 실제 존재)
```

## 3. 15개 후보 태그 감사 체크리스트

현재 `SYNTHETIC_CHILD_PROP_MERGE_TAGS`에 포함되어 있으나 정체가 **Shell-only일 가능성**이 있는 15개 태그. 각 태그별 감사 항목:

- [ ] `spec.render.shapes` standalone 분기 정독 (**라인 수 ≥ 50 → 내용 정독 필수**, placeholder 가정 금지)
- [ ] standalone 반환 shapes 분류: 빈 container / items 통합 / **props 기반 실렌더(text/arrow/icon)** / 시각 UI 전체
- [ ] **factory definition 확인** (`apps/builder/src/builder/factories/definitions/*.ts`): 자식 Element(Label/Text/Icon 등) 자동 생성 여부
  - 자식 자동 생성 ✓ + standalone 실렌더 ✓ → **Shell-only 이동 필수** (Calendar 류)
  - 자식 자동 생성 ✗ + standalone 실렌더 ✓ → **Shell-only 이동 금지** (Tooltip 류, factory 확장 또는 Plain 유지)
  - 자식 자동 생성 ✓ + standalone 빈 placeholder → **Shell-only 이동 안전**
  - 자식 자동 생성 ✗ + standalone 빈 placeholder → **Plain 유지**
- [ ] 재분류 판정: **Shell** / **Synthetic-merge** (유지) / **Plain** (양쪽 Set 모두 제거)
- [ ] Vitest 대칭 테스트 케이스 필요 여부 (자식 0/1/2개 케이스, factory default 유지 포함)

### 후보 리스트

| #   | 태그              | standalone 라인 | 예상 분류       | 실제 분류 | Vitest | 비고                                                                                                               |
| --- | ----------------- | --------------: | --------------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | ButtonGroup       |              46 | Shell-only      | [TODO]    | -      |                                                                                                                    |
| 2   | Card              |              41 | Shell-only      | [TODO]    | -      | `standalone = type:"container"` 빈 shape 확인됨                                                                    |
| 3   | CheckboxGroup     |              32 | Shell-only      | [TODO]    | -      | `if (hasChildren) return shapes;` 확인                                                                             |
| 4   | ColorPicker       |         **103** | [요감사]        | [TODO]    | -      | 50줄+ 임계 초과 — 내용 정독 + factory 자식 생성 여부 확인 필수                                                     |
| 5   | Dialog            |              70 | Shell-only      | [TODO]    | -      |                                                                                                                    |
| 6   | Disclosure        |         **125** | [요감사]        | [TODO]    | -      | 50줄+ 임계 초과 — header/toggle 실렌더 가능성 정독 필요                                                            |
| 7   | DisclosureGroup   |              66 | Shell-only      | [TODO]    | -      |                                                                                                                    |
| 8   | Form              |              69 | Shell-only      | [TODO]    | -      | `if (hasChildren) return shapes;` 확인                                                                             |
| 9   | Popover           |         **168** | Shell-only 확인 | [TODO]    | -      | 50줄+이나 standalone = `type:"container"` 빈 컨테이너임을 코드 확인                                                |
| 10  | RadioGroup        |              32 | Shell-only      | [TODO]    | -      | `if (hasChildren) return shapes;` 확인                                                                             |
| 11  | Section           |              28 | Shell-only      | [TODO]    | -      | `if (hasChildren) return shapes;` 확인                                                                             |
| 12  | TabPanel          |             N/A | **Plain 후보**  | [TODO]    | -      | `_hasChildren` 분기 **부재** — incrementalSync expansion 필요성 단독 판정                                          |
| 13  | TabPanels         |             N/A | **Plain 후보**  | [TODO]    | -      | `_hasChildren` 분기 **부재** — 동일                                                                                |
| 14  | ToggleButtonGroup |              32 | Shell-only      | [TODO]    | -      | `if (hasChildren) return shapes;` 확인. `_indicatorMode`/`_groupPosition` 상호작용 점검                            |
| 15  | Tooltip           |         **190** | **[요감사]**    | [TODO]    | -      | standalone = text + arrow 실렌더 확인됨. factory가 Text 자식 자동 생성하지 않으면 Shell-only 이동 금지(Plain 유지) |

## 4. Phase 계획

### Phase 1 — Empty-placeholder 확인됨 그룹 이동 (7개)

대상: Card, Dialog, Section, Disclosure, DisclosureGroup, Form, Popover

> **Tooltip 제외**: standalone에서 text + arrow 실렌더. Phase 2에서 factory 자식 감사 후 처리.

절차:

1. 각 spec standalone 분기 정독 — `type:"container"` 빈 shape 또는 `return []` 확인
2. Disclosure(125줄)는 내용 정독 필수 — header/toggle 실렌더 여부 판정. 실렌더 시 Phase 2로 이동
3. 감사 통과 태그를 `SHELL_ONLY_CONTAINER_TAGS`로 이동, `SYNTHETIC_CHILD_PROP_MERGE_TAGS`에서 제거
4. Vitest: 자식 0개에서 factory default 유지되는지 대칭 테스트 추가 (Card/Dialog/Section/Popover 각 2~3 케이스)
5. Gate G1: `pnpm type-check` + 신규 vitest(≥6 케이스) + 기존 105 test 회귀 0

### Phase 2 — Group/Control + 실렌더 감사 필요 그룹 (6개)

대상: ButtonGroup, CheckboxGroup, RadioGroup, ToggleButtonGroup, ColorPicker, **Tooltip**

절차:

1. 감사: 각 spec standalone 분기 확인. Group 계열은 자식 Checkbox/Radio/ToggleButton이 독립 Skia 노드임을 재확인
2. **factory definition 교차 확인** (핵심):
   - Tooltip factory가 Text/Content 자식 Element를 자동 생성하는가? 안 하면 **Plain 유지** (Shell-only 이동 금지 — 기본 tooltip 텍스트 소실 위험)
   - ColorPicker factory가 ColorArea/ColorSlider/Swatch 자식 Element를 자동 생성하는가? 동일 판정
3. `_indicatorMode` / `_groupPosition` 같은 synthetic prop 주입 경로와 `_hasChildren` 분기 상호작용 점검
4. 이동 가능 태그만 Shell-only로 이동, 나머지는 Plain(양 Set 제거) 또는 Synthetic-merge 유지
5. Vitest + factory default 유지 회귀 케이스 추가
6. Gate G2: type-check + vitest + ToggleButtonGroup selection 회귀 0 + factory 자식 감사 결과 문서화

### Phase 3 — `_hasChildren` 분기 부재 그룹 (2개)

대상: TabPanel, TabPanels

> **사전 확인**: 두 spec 모두 `_hasChildren` 분기 **없음**. `_hasChildren` 주입 여부와 무관하게 동작.

절차:

1. `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 포함 의의 재검토: 현재 Set 포함은 `incrementalSync` expansion(자식 변경 → 부모 rebuild)에만 영향
2. TabPanel이 자식 subtree 렌더링 변경 시 부모 spec shape이 영향받는지 점검 (ADR-066 items SSOT 후 items 변경은 Tabs가 담당, TabPanel은 자식 host만)
3. expansion 불필요 확인 시 → 양 Set 모두에서 제거(Plain), 필요 확인 시 → Synthetic-merge 유지
4. Gate G3: 판정 확정 + ADR-066 회귀 0 + 결정 문서화. 불확실 시 본 ADR scope 제외 + 후속 ADR 신설

## 5. 컨벤션 SSOT 문서화

### 5-1. 코드 SSOT

- `buildSpecNodeData.ts` 상단 JSDoc에 3분류 정의 단일 소스화 (이미 초안 존재, 본 ADR에서 확정)
- `SHELL_ONLY_CONTAINER_TAGS` / `SYNTHETIC_CHILD_PROP_MERGE_TAGS` export 유지

### 5-2. 규칙 문서

- `.claude/rules/canvas-rendering.md`에 "`_hasChildren` 컨벤션" 섹션 추가:
  - 3분류 정의 테이블
  - spec 작성 시 판정 가이드
  - 금지 패턴 (예: Calendar처럼 standalone에서 실제 UI를 그리면서 Shell-only Set에 미등록)

### 5-3. memory 갱신

- `child-composition-exclude-tags.md` 메모리 파일을 `hasChildren-container-convention.md`로 rename + 내용 재구성:
  - 3분류 정의
  - Calendar 사례 교훈
  - 후속 재분류 체크리스트 포인터

## 6. Vitest 대칭 전략

`calendar-symmetry.test.ts` 패턴 확장:

```
describe("{Tag} shell-only behavior")
  ✓ 자식 N개 → shell (bg+border) shapes만 반환
  ✓ 자식 0개 → shell 유지 (standalone 회귀 금지)
  ✓ 자식 1개 → 부분 추가 시 shell 유지
  ✓ factory default 재생성 시 기본 자식 유지 (Tooltip/ColorPicker 류 실렌더 태그 대상)
```

각 Phase당 대표 태그 2~3개에 대해 추가. 특히 Phase 2의 Tooltip/ColorPicker는 factory 자식 유지 케이스 필수.

## 7. Chrome MCP 한계 & 대체 검증

- CanvasKit/WebGL context 충돌로 `Page.captureScreenshot` timeout 경험 — 시각 회귀 검증 제한적
- 대체: Vitest 대칭 테스트 + `pagePositions`/element layout 수치 비교 (JS 기반 측정)
- Preview iframe이 활성화된 상태에서는 DOM 비교 병행 가능 (현재 builder에는 iframe 없음)

## 8. 회귀 발생 시 롤백 전략

각 Phase는 Set 멤버 이동만으로 구성되므로 단일 commit으로 rollback 가능. Vitest 실패 시 해당 태그만 Set에서 제외하고 원인 분석 후 재시도.

## 9. 후속 작업 (본 ADR 범위 외)

- `_hasChildren` prop 타입을 `ComponentSpec` 타입에 정식 정의 (현재 inline `_hasChildren?: boolean` 반복)
- Factory 자동 생성 태그(`COMPLEX_COMPONENT_TAGS`)와 `SHELL_ONLY_CONTAINER_TAGS`의 관계 SSOT 문서화
- `CONTAINER_DIMENSION_TAGS`와의 overlap 재검토
