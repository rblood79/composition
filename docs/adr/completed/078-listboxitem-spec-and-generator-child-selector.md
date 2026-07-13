# ADR-078: ListBoxItem.spec 신설 + Generator 자식 selector emit 확장

## Status

Implemented — 2026-04-19

## Implementation

**커밋 체인 (3건, 2026-04-19)**:

| Commit     | 시각  | 내용                                                                                                                                                                                                                                           |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `04d659fc` | 02:49 | Phase 1-3 — `ListBoxItem.spec.ts` 신설 + `CSSGenerator` 자식 selector emit 확장 + `ListBox.render.shapes` / `calculateContentHeight` 가 `resolveListBoxItemMetric(fontSize)` 공유 소비 → `ITEM_PADDING_X/Y` / `LINE_HEIGHT` 하드코딩 상수 해체 |
| `dfe54137` | 14:53 | Phase 4 — 수동 `ListBox.css` 내 Generator 커버 속성 (padding / border-radius / min-height / font-size / line-height / font-weight / gap + hover/disabled) 삭제. dead vars (`--lb-item-min-height/size/line-height`) 제거                       |
| `d6345f49` | 22:40 | Phase 5 — `ListBox.props.style` override 경로 복구 + Skia ↔ CSS 시각 정합 최종 검증                                                                                                                                                            |

**후속 workaround 해체**: 본 ADR 구현 중 도입된 post-fix workaround 4종(수동 `align-items: flex-start` / factory 중복 주입 / Style Panel Spec 무시 / `rearrangeShapesForColumn` 블랙리스트) 은 [ADR-079](079-spec-defaults-read-through-layout-primitive-ssot.md) 에서 구조적 해체 완료 (2026-04-19, main +6 commits).

**Gates 충족 증거**:

- G1 (Spec) — `ListBoxItem.spec.ts` 신설 + type-check 3/3 PASS
- G2 (Generator) — `CSSGenerator` 자식 selector emit 확장. `generated/ListBox.css` 에 `.react-aria-ListBoxItem` 블록 emit 확인
- G3 (통합) — `ListBox.render.shapes` 내부 상수 제거, `resolveListBoxItemMetric` 공통 헬퍼 소비
- G4 (CSS 해체) — 수동 `ListBox.css` 에서 Generator 커버 속성 삭제. 잔존 수동 CSS 는 Generator 미커버 영역(display column, slot selector, variant 5종 cascade, Popover context override) 에 한정
- G5 (종결) — Skia ↔ CSS 시각 정합 복구 (`d6345f49`). ADR-079 P2 에서 Style Panel 3번째 consumer 까지 대칭화

**수동 `ListBox.css` 유지 비율**: 이전 ~80% → **~30%** (목표 달성). 추가 축소는 ADR-079 Negative 에서 언급한 "D2 variant 정렬" / "Popover context" 별도 ADR 대기.

## Context

ADR-076 "ListBox items SSOT + containerStyles Hybrid" 종결 직후 진행한 cross-check 에서 **ListBox 의 CSS(Preview)와 Skia(Builder) 시각 결과 불일치** 가 확인되었다. 구체 증상:

- Builder Canvas 에서 아이템 박스 height = 36px
- Preview DOM 에서 item border-box = 28px (padding 4+4 + line-height 20)
- 컨테이너 전체 height: Builder 130px vs Preview 98px (**32px 차이**)
- 텍스트 x 좌표: Builder 12 vs Preview 16 (4px 차이, `02bf697f` 에서 임시 해결)

근본 원인 분석:

**D1/D2/D3 3-domain(ssot-hierarchy.md) 관점**:

- D3(시각 스타일) SSOT 는 Spec. 그러나 현재 ListBox.spec 만 있고 **ListBoxItem.spec 부재** → item 단위 metric (padding, line-height, border-radius, sizes)을 담을 곳이 없음
- CSS 경로는 `packages/shared/src/components/styles/ListBox.css` 의 `--lb-item-*` 변수 + `.react-aria-ListBoxItem` 수동 블록(60-124 라인) 에 item metric 보관
- Skia 경로는 `ListBox.spec.render.shapes` 내부 하드코딩 상수(`ITEM_PADDING_X=12`, `ITEM_PADDING_Y=4`, `LINE_HEIGHT=20`)
- **같은 item metric 이 CSS 수동 변수 + Skia 하드코딩으로 2곳에 산재** → Spec 단일 소스 원칙 위반, `@sync` 주석으로만 연결된 불안정 상태

**Menu 선례(ADR-068/071)와 비대칭**:

- Menu 는 Menu.spec(trigger/popover container) + MenuItem.spec(item) 로 분리
- Menu.spec.containerStyles 가 popover container CSS emit
- MenuItem.spec.sizes 가 item padding/line-height/radius 소유
- → Menu 계통은 D3 단일 소스 원칙 준수
- ListBox 는 이 구조를 따르지 않음 (ADR-076 에서 의도적으로 scope 제한)

**Generator 능력 한계**:

- 현재 `CSSGenerator` 는 **단일 selector 기반** emit (`.react-aria-{Name}[data-variant][data-size]` + `&[data-state]`)
- 자식 selector (`.react-aria-ListBoxItem`), pseudo-element (`::before`), media query (`@media (forced-colors: active)`), 복합 attribute selector (`[data-orientation][data-layout]`) 모두 미지원
- ListBoxItem.spec 을 신설해도 Generator 가 item base CSS 를 emit 하지 못하면 CSS 수동 유지 해체 불가능

**Hard Constraints**:

1. **ListBox 의 시각 결과(Skia=CSS 일치)** 가 달성되어야 D3 대칭 만족 — 현재 `02bf697f` 임시 workaround 로 수치는 맞췄으나 2개 소스에 하드코딩됨
2. **ADR-076 에서 해체하지 못한 80% 수동 CSS** (`ListBox.css` 60-124 item base, 127-227 orientation/layout, 246-293 Popover context, 296-355 variant 5종, 230-400 DnD/virtualized/forced-colors) 를 SSOT 로 복귀 가능한 경로 확보
3. **ADR-073 tag-agnostic items SSOT** 호환 유지 — items SSOT 체인 (ADR-066/068/073/076) 의 확장이지 후퇴 아님
4. **ADR-071 containerStyles schema** 호환 — 기존 schema 가 이미 Generator 에 인프라 land 됨. 확장하되 replace 하지 않음
5. `pnpm type-check` 3/3 PASS, `pnpm build:specs` 0-byte-unexpected-diff, `/cross-check` ListBox+ListBoxItem 5-layer 통과
6. ListBoxItem 이 독립 Element 로는 존재하지 않음 (ADR-076 items SSOT). 본 ADR 에서 element 로 복원 금지 — Spec 만 추가, 소비는 부모 ListBox.render.shapes 가 MenuItem 패턴과 유사하게 ListBoxItem.sizes 를 참조

**Soft Constraints**:

- Menu/MenuItem 분리 구조(ADR-068) 와 parallel 한 ListBox/ListBoxItem 모델링 비용 낮음
- Generator 자식 selector emit 확장은 ListBox 외 Select/ComboBox/GridList/Tabs 등 다른 컬렉션에도 재사용 가능 — 투자 가치 높음
- `ListBox.css` 에 남은 variant 5종 dead selector 는 별도 ADR (D2 variant 정렬)
- Popover context override(246-293 라인) 는 ADR-076 이 지적한 "별도 ADR" 대기 — 본 ADR scope 밖

## Alternatives Considered

### 대안 A: `ListBoxItem.spec` 신설 + Generator 자식 selector emit 확장 (선정)

- 설명: Menu/MenuItem 분리 구조를 재현. `packages/specs/src/components/ListBoxItem.spec.ts` 신설 + `sizes.md = { paddingX: 12, paddingY: 4, lineHeight: "{typography.text-sm--line-height}", borderRadius: "{radius.xs}", minHeight: 20 }` 등 item metric 소유. CSSGenerator 를 "부모 Spec 이 자식 Spec 을 참조하여 `.react-aria-ListBoxItem` selector 를 같은 @layer 블록에 emit" 할 수 있도록 확장. `ListBox.render.shapes` 내부 하드코딩 상수 제거 → `ListBoxItemSpec.sizes` 직접 참조
- 근거: ADR-068/071 선례 1:1 재사용. Generator 확장은 다른 컬렉션에도 payoff
- 위험:
  - 기술: **MEDIUM** — Generator 확장 (복합 selector 지원) 은 CSSGenerator 아키텍처 변경 필요. `containerStyles` 재진입 + 자식 Spec reference 해결
  - 성능: LOW — build-time emit 만 영향
  - 유지보수: LOW — 오히려 현재 @sync 하드코딩 해체 → 유지보수 개선
  - 마이그레이션: LOW — ListBoxItem 은 Spec 만 신설, element 는 ADR-076 체계 그대로 (items SSOT 유지)

### 대안 B: Item metric 을 `ListBox.spec.sizes.md.item*` nested 필드로 추가

- 설명: `sizes.md.item = { paddingX, paddingY, lineHeight, borderRadius, minHeight }` 같은 sub-field 도입. render.shapes 가 `size.item.*` 참조. CSS 는 Generator 가 nested field 를 자식 selector 로 변환
- 근거: 신규 Spec 파일 불필요, 단일 ListBox.spec 내에 모든 metric 집중
- 위험:
  - 기술: **MEDIUM** — `SizeSpec` 타입 재설계, 기존 sizes 소비처 영향
  - 성능: LOW
  - 유지보수: **HIGH** — Menu/MenuItem 분리 관례와 비대칭. 다른 Spec 에 item nested 가 없어 일관성 파괴. GridList/Select 확장 시 동일 nested 필요 → schema 폭증
  - 마이그레이션: LOW
- 채택 시 프로젝트 전체 Spec 관례 분열

### 대안 C: 현재 `@sync` 하드코딩 영구 유지

- 설명: `02bf697f` 의 임시 workaround 를 공식 패턴으로 승인. ListBoxItem.spec 도입 없이 `@sync` 주석으로 CSS ↔ Skia 수동 동기화 관리
- 근거: 제로 투자
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **CRITICAL** — item metric 변경 시 CSS + Skia 양쪽 수정 누락 위험. 미래 ListBoxItem 시각 변경 요구 시마다 D3 대칭 파괴 재발. SSOT 원칙 공식 포기
  - 마이그레이션: LOW
- ADR-036/059/063 역행 debt 영구 방치

### 대안 D: Skia 경로만 CSS 에 정합 (`ListBox.spec.render.shapes` 내부 상수만 정본)

- 설명: CSS 수동 `--lb-item-padding` 등을 제거하고 Skia 공식을 CSS 로 자동 생성. CSSGenerator 는 Skia 의 item metric 을 inline CSS 로 emit
- 근거: Spec 하나로 통합
- 위험:
  - 기술: **HIGH** — CSS 를 "Skia 공식에서 역생성" 하는 방향은 기존 Spec-First 원칙과 역방향. `ssot-hierarchy.md` 의 "symmetric consumer" 위반
  - 성능: LOW
  - 유지보수: **HIGH** — render.shapes 는 JS 함수이므로 CSS 로 역변환 시 제약 큼
  - 마이그레이션: MEDIUM
- D3 대칭 모델에서 Builder(Skia) 를 "기준" 으로 삼는 언어 — 명시적으로 금지(ssot-hierarchy.md)

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 |   HIGH+ 개수   |
| ---- | :---: | :--: | :------: | :----------: | :------------: |
| A    |   M   |  L   |    L     |      L       |       0        |
| B    |   M   |  L   |  **H**   |      L       |       1        |
| C    |   L   |  L   |  **C**   |      L       | 1 (CRITICAL 1) |
| D    | **H** |  L   |  **H**   |      M       |       2        |

**루프 판정**:

- 대안 A: HIGH 0개 — 바로 채택 가능
- 대안 B: HIGH 1개 (유지보수) — 전체 Spec 관례 분열 문제. 기각
- 대안 C: CRITICAL 1개 — SSOT 원칙 공식 포기. 기각
- 대안 D: HIGH 2개 — D3 symmetric 모델 위반. 기각
- **대안 A 채택** — 추가 루프 불필요

## Decision

**대안 A: `ListBoxItem.spec` 신설 + Generator 자식 selector emit 확장** 을 선택한다.

선택 근거:

1. **Menu/MenuItem 선례 1:1 재사용** — ADR-068 에서 이미 입증된 구조. ListBox 에 동일 패턴 적용은 관례 정합 + 인프라 재사용
2. **Generator 확장의 재사용성** — 자식 selector emit 은 GridList/Select/ComboBox/Tabs 등 모든 컬렉션 컴포넌트에 공통 필요. ListBox 에서 투자하면 후속 ADR 비용 절감
3. **SSOT 원칙 회복** — item metric 을 단일 Spec 이 소유 → `@sync` 하드코딩 제거 → D3 대칭 영속 보장
4. **ADR-076 후속 대기 해체** — 대기 9건 중 1번 (ListBox 80% 수동 CSS 해체) 완결. 2번(Popover variant) 이후 ADR 대기 정리
5. **scope 확장 가능** — GridList.spec + GridListItem.spec 분리, Tabs items 의 Tab metric 분리 등 후속 ADR 의 기반

기각 사유:

- **대안 B 기각**: `sizes.item.*` nested schema 는 Menu/MenuItem 관례와 충돌. 프로젝트 전체 Spec 구조 분열
- **대안 C 기각**: `@sync` 영구화는 SSOT 공식 포기. ADR-036/059/063 역행 debt 의 신규 발생
- **대안 D 기각**: Skia-first 역생성은 `ssot-hierarchy.md` D3 symmetric consumer 모델 위반

> 구현 상세: 078-listboxitem-spec-and-generator-child-selector-breakdown.md

## Gates

| Gate | 시점           | 통과 조건                                                                                                    | 실패 시 대안                           |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| G0   | 착수 전        | Generator 현재 능력 감사 (`CSSGenerator.ts` 단일 selector 제약 범위 측정)                                    | 감사 재실행                            |
| G1   | Phase 1 (Spec) | `ListBoxItem.spec.ts` 신설 + type-check PASS + specRegistry 등록                                             | schema 축소                            |
| G2   | Phase 2 (Gen)  | Generator 자식 selector emit 확장 + `.react-aria-ListBoxItem` 블록이 `generated/ListBox.css` 에 emit         | 복잡 selector 를 수동 유지로 fall-back |
| G3   | Phase 3 (통합) | `ListBox.spec.render.shapes` 내부 상수 제거 + `ListBoxItemSpec.sizes` 참조 + `calculateContentHeight` 동기화 | 상수 유지 (debt 명시)                  |
| G4   | Phase 4        | 수동 `ListBox.css` 60-124 라인 삭제 + 시각 회귀 0 (Chrome MCP)                                               | 부분 삭제                              |
| G5   | 종결           | `/cross-check` ListBox+ListBoxItem 5-layer PASS + parallel-verify family                                     | 개별 path 수정                         |

**잔존 HIGH 위험**: 없음.

## Consequences

### Positive

- ListBox+ListBoxItem 이 D3 SSOT 완전 복귀 — Skia=CSS 시각 대칭 영속화
- Generator 자식 selector emit 능력 확보 → GridList/Select/ComboBox/Tabs 후속 ADR 비용 대폭 감소
- `ListBox.spec.render.shapes` 내부 하드코딩 상수 (`ITEM_PADDING_X/Y`, `LINE_HEIGHT`) 블록 해체
- 수동 `ListBox.css` 수정 유지 비율 80% → **~30%** (orientation/layout, Popover context, variant 5종, DnD/virtualized 등 Generator 여전히 커버 불가 영역만 잔존)
- ADR-076 후속 대기 1번 해제 → 대기 목록 9→8

### Negative

- `CSSGenerator` 아키텍처 변경 (자식 selector emit 경로) — 신규 코드 경로 테스트 필요
- `ListBoxItem.spec` 파일 1개 추가 (+ 타입 re-export)
- Phase 간 이행 중에는 `ListBox.render.shapes` 에 임시 workaround 상수와 신규 Spec 참조 공존 가능성 → 브리지 phase 에 `@see ADR-078` 주석 필수
- 본 ADR 자체 구현 비용 (Phase 1~4) — 약 1~2 세션 추정

## References

- ADR-036 Spec-First Single Source — 본 ADR 의 상위 원칙
- ADR-059 `skipCSSGeneration` 해체 — Generator SSOT 복귀 체인
- ADR-063 SSOT Chain Charter — D1/D2/D3 3-domain 정본
- ADR-068 Menu items SSOT + MenuItem.spec — 본 ADR 의 직접 선례
- ADR-071 Generator `containerStyles` — 재사용 인프라
- ADR-076 ListBox items SSOT Hybrid — 본 ADR 의 후속 대기 1번 해제
- `ssot-hierarchy.md` — D3 symmetric consumer 원칙
- commit `02bf697f` — 본 ADR 가 해체할 임시 workaround
