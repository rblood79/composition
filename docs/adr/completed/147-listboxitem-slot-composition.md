# ADR-147: ListBoxItem Slot Composition Model

> **Superseded by [ADR-148](../148-reusable-slot-system-unification.md)** — 2026-07-08. Phase 1~5 반영분(조합 자식 slotRole + DOM `<Text slot>` emit + Properties slot 편집)은 ADR-148 이 정본으로 승계한다. 본문 전제 3건(Skia `render.shapes` 경로 — ADR-912 가 `listbox_item` escape 로 대체 / SelectionIndicator 조합 자식 — 구현은 render-time concern / `slot` 필드 semantics — pencil 공식 reusable ID 추천 목록, slot 이름은 `metadata.slotRole`)의 정정본은 ADR-148 Context §승계 표 참조.

## Status

**Superseded by ADR-148** — 2026-07-08 (Proposed 2026-05-29)

진행 로그:

- 2026-05-29 — ADR 본문 + design breakdown 작성. 사용자 explicit confirm(ADR-147 신규 작성 / icon=columnMapping 우선 / SelectionIndicator=체크마크 shape).
- 2026-05-29 — Phase 1~5 코드 반영 (`f12808623` + 후속 `a7d2b9299`/`66e979930`/`4e1f43f03`). Phase 6 은 개발 단계 판정으로 축소, Phase 7 cross-check 대기로 Proposed 유지.
- 2026-07-08 — 사용자 통합 결정으로 ADR-148 에 승계 종결. 잔여 검증(cross-check + live)은 ADR-148 Phase 0 이 흡수.

## Context

ADR-146 은 `ListBox` 를 Components page reusable origin + content page `ref` template anchor + row projection 구조로 전환하고, **Hard Constraint 9 / Decision 12 에서 `ListBoxItem` slot 을 text/description/icon/indicator 같은 non-interactive visual/content slot 으로 제한**한다고 선언했다. 그러나 ADR-146 구현은 `ListBoxItem/Default` origin 을 여전히 **flat props**(`children:"{label}"`, `description:"{description}"`, 자식 노드 없음)로 두었고, Properties 패널(`ListBoxItemEditor.tsx`)은 ADR-132 dataBinding 이전의 **`Field` 자식 / "Convert to Dynamic Item" 동적 모델 + flat props 편집**에 머물러 있다. Preview 렌더러도 label/description 을 RAC 표준 `<Text slot="label">`/`<Text slot="description">` 가 아니라 flat `<span>` 으로 emit 하거나(Path1) description 을 아예 미렌더(Path2)한다.

즉 ADR-146 이 **선언만 한 slot 모델**이 실제 데이터 구조 · 렌더 · 편집에 **미실현**이며, 이 stale 한 프로퍼티/콘텐츠 모델이 pencil app 의 ref-slot 조합 format 및 React Aria ListBox 의 slot 모델과 어긋난다. 본 ADR 은 그 gap 을 닫는다.

### 3-domain 분류

- **D1 DOM/접근성 (RAC 절대 권위)**: React Aria `ListBoxItem` 의 `<Text slot="label">`/`<Text slot="description">` text slot + decorative icon + `SelectionIndicator` 가 권위다. screen reader announcement 와 selection semantics 는 RAC 경로를 따른다. (RAC API: `<ListBoxItem><Text slot="label"/><Text slot="description"/><SelectionIndicator/></ListBoxItem>`)
- **D2 Props/API**: `ListBoxItem` authoring props(label/description/icon/textValue/isDisabled/href)와 Properties 패널. row data 는 ADR-146/132 resolved collection items read model 을 따른다(columnMapping/dataBinding 우선, `props.items` fallback).
- **D3 시각/구조 (Spec SSOT)**: Skia `render.shapes` 와 CSS `[slot]` selector 가 label/description/icon/indicator 를 **동일 시각 결과**로 그린다(symmetric consumer).

### Hard Constraints

1. ADR-146 HC9/Decision 12 준수 — slot 은 text/description/icon/indicator non-interactive visual slot 으로 제한. nested interactive child 금지.
2. RAC 레퍼런스 정합 — label/description text slot + decorative icon + SelectionIndicator. 인터랙티브 자식 금지(RAC accessibility warning).
3. D3 symmetric — DOM `<Text slot>` emit · Skia paint · CSS `[slot]` 가 4 slot 전부 동일 시각 결과(60fps 유지, canonical node 폭증 없음 — ADR-146 projection 재사용).
4. BC — 기존 프로젝트의 `Field` 자식 / flat-props `ListBoxItem` 은 새 모델로 무손실 마이그레이션. `type` 미지정 항목 default 해석 보존.
5. 신규 schema field 최소화 — 기존 `reusable`/`ref`/`descendants`/`slot` + child `metadata.slotRole` 로 해결. ADR-146 Soft Constraint 계승.

### Fork checkpoint (base/응용)

- **base = ADR-146** (ref-template + Components page + slot allow-list 선언). **응용 = ADR-147** (선언된 slot 을 조합 자식 + DOM emit + Skia paint + Properties + 마이그레이션으로 실현). schema 직교성: ADR-146 projection-id boundary/Components bootstrap 와 직교. baseline reverse 없음(146 Implemented → 147). 상세: design breakdown §1.

### ADR-142 관계

ADR-142(Proposed) 는 컴포넌트를 canonical 문서 + generic 렌더러로 통합(조합 컴포넌트=reusable frame)하려 한다. ADR-147 의 canonical origin 조합(composed children)은 그 방향과 **정합(forward-compatible)** 이다. `render.shapes`/CSS slot paint 는 현 ComponentSpec 시스템 구현이며 ADR-142 land 시 generic 렌더러가 그 부분만 subsume 한다(canonical 구조 보존). ADR-147 은 현 시스템에 구현하며 ADR-142 와 충돌하지 않는다.

## Alternatives Considered

### 대안 A: 조합 자식 slot 모델 (pencil ref-slot + RAC slot) — 채택

- 설명: `ListBoxItem` origin 을 flat props 대신 **조합 자식 노드**(Icon / Text(slot=label) / Text(slot=description) / SelectionIndicator) + `slot` allow-list 로 구조화. Preview 는 RAC `<Text slot>` emit, Skia 는 slotRole 기반 4-slot paint, Properties 는 slot 편집. row projection 이 columnMapping/dataBinding 으로 content 채움. 레거시 Field/flat 모델 제거 + 마이그레이션. pencil `docs/migrations/shadcn-*.json` 의 reusable/ref/descendants/slot 패턴 재사용.
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(M)

### 대안 B: flat props 유지 + DOM slot emit 만 (기각)

- 설명: origin 은 flat props 유지, Preview 렌더만 `<Text slot>` emit + Path2 description 수정. 최소 변경.
- 기각 사유: 사용자가 선택한 pencil ref-slot 조합 모델 미충족. origin 이 비조합 상태로 남아 ADR-142/146 reusable-frame 방향과 계속 어긋남. Properties 가 여전히 flat/Field 모델 — 본 ADR 의 본질(프로퍼티 모델 현대화) 미해결.
- 위험: 기술(L) / 성능(L) / 유지보수(H) / 마이그레이션(L)

### 대안 C: 완전 자유 조합 slot (descendants 로 임의 컴포넌트 삽입) (기각)

- 설명: `ListBoxItem` 의 label/description/icon slot 에 사용자가 임의 컴포넌트를 drag-in/descendants override 하는 범용 slot 시스템.
- 기각 사유: ADR-146 HC9(nested interactive child 금지) 위반. RAC accessibility(interactive child 금지) 위반. 범용 slot 편집 UI + resolver 확장으로 scope 폭증 — ListBox 단일 proof scope(ADR-146 Soft Constraint) 초과.
- 위험: 기술(H) / 성능(M) / 유지보수(H) / 마이그레이션(M)

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    M     |      M       |     0      |
| B    |  L   |  L   |    H     |      L       |     1      |
| C    |  H   |  M   |    H     |      M       |     2      |

대안 A 는 HIGH+ 0건으로 threshold 통과. 대안 B 는 유지보수 HIGH(본질 미해결로 stale 모델 영구화). 대안 C 는 기술/유지보수 HIGH(HC9 위반 + scope 폭증). 추가 루프 불요.

## Decision

**대안 A: 조합 자식 slot 모델**을 선택한다.

세부 결정:

1. `ListBoxItem/Default`(및 selected variant) origin 을 조합 자식(Icon / Text(slot=label) / Text(slot=description) / SelectionIndicator) + `slot:["label","description","icon","selection-indicator"]` allow-list 로 구조화. 템플릿 바인딩(`{label}`/`{description}`/`{icon}`)은 자식 노드 props 로 이동.
2. slotRole 식별은 child `metadata.slotRole` 로 한다(신규 top-level schema field 없음). resolver/renderer/Skia 가 공유 상수를 소비.
3. Preview(D1)는 RAC `<Text slot="label">`/`<Text slot="description">`/`<Icon slot="icon">`/`SelectionIndicator` 를 emit. Path2(items[])의 description 미렌더 버그를 수정한다.
4. Skia(D3) `render.shapes` 는 slotRole 기반으로 icon shape + label/description text + selection 체크마크를 paint한다. icon=좌측 가로, text=수직 스택, indicator=우측.
5. icon slot 데이터 소스는 **columnMapping 컬럼 우선**, fallback `["icon","avatar","image"]`, 정적 fallback 허용.
6. SelectionIndicator 는 Skia 에서 **체크마크 shape**(RAC DropdownItem 패턴)로 그린다. 기존 row-bg accent-subtle 와 병행.
7. Properties 패널(D2)에서 레거시 `Field` 자식 / "Convert to Dynamic Item" 경로를 제거하고 slot 기반 편집으로 재작성한다.
8. 레거시 `Field` 자식 / flat-props `ListBoxItem` 은 새 조합 모델로 1회 idempotent 마이그레이션한다(Field→dataBinding/items, flat→조합 자식). `value`/`textValue` 와 `type` 미지정 BC 해석 보존.

기각된 대안: 대안 B(flat 유지 — 본질 미해결로 유지보수 HIGH), 대안 C(자유 조합 — HC9/RAC 위반 + scope 폭증).

> 구현 상세: [147-listboxitem-slot-composition-breakdown.md](../design/147-listboxitem-slot-composition-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                    | 심각도 | 대응                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------- |
| R1  | DOM `<Text slot>` emit · Skia 4-slot paint · CSS `[slot]` 가 어긋나면 label/description/icon/indicator 가 Preview ↔ Builder 시각 drift. |  HIGH  | Gate G2 에서 `/cross-check` 3축 대칭(DOM/Skia/Style Panel) + render-shapes ↔ CSS 토큰 정합을 4 slot 전부 검증.                |
| R2  | 기존 `Field` 자식 / flat-props `ListBoxItem` 마이그레이션이 다중 ListBox/page 에서 churn 또는 손실 유발.                                |  MED   | Gate G3 round-trip 마이그레이션 fixture(Field→dataBinding, flat→조합). ADR-146 R6 Components bootstrap 선행 패턴 재사용.      |
| R3  | columnMapping icon 매핑이 label/description 추출 순서와 어긋나 row 별 icon 미표시.                                                      |  MED   | `getItemIcon` 을 label/description 추출과 동일 columnMapping 우선 패턴으로 구현 + projection 테스트.                          |
| R4  | ADR-142 generic 렌더러 land 시 `render.shapes`/CSS slot paint 가 legacy 가 됨.                                                          |  LOW   | canonical origin 조합 구조는 ADR-142 정합이므로 보존. render.shapes 부분만 후속 subsume — ADR-147 Context §ADR-142 관계 명시. |

잔존 HIGH 위험: R1 1건 — Gate G2 와 1:1 대응.

## Gates

| Gate | 시점                 | 통과 조건                                                                                                                                                                    | 실패 시 대안                         |
| ---- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| G1   | Canonical 조합 구조  | `ListBoxItem` origin 이 조합 자식(Icon/Text label/Text description/SelectionIndicator) + slot allow-list. Components page seed/repair idempotent. reusable round-trip PASS.  | flat-props origin fallback 유지      |
| G2   | D3 parity (R1 1:1)   | DOM `<Text slot>` emit ↔ Skia 4-slot paint ↔ CSS `[slot]` 동일 시각. `/cross-check` 3축 PASS. Path2 description 렌더 수정 확인. 60fps/baseline regress 없음.                 | Skia slot paint rollback             |
| G3   | Migration/compat     | `Field` 자식 / flat-props `ListBoxItem` → 새 모델 무손실 round-trip. `value`/`textValue`/`type` BC 보존. hydration refresh PASS.                                             | 마이그레이션 gate 보류               |
| G4   | Properties 패널 (D2) | `ListBoxItemEditor` 가 slot 기반 편집(label/description/icon/SelectionIndicator/textValue/isDisabled/href). Field/"Convert to Dynamic" 경로 부재. origin/ref 분기 표시 PASS. | Field 경로 deprecate 후 재설계       |
| G5   | Verification/closure | targeted Vitest + 마이그레이션 round-trip + `/cross-check` + `pnpm build:specs` + `pnpm type-check`(baseline 무증가) PASS. README/CHANGELOG/ADR status sync.                 | Proposed 유지, Implemented 승격 금지 |

## Consequences

### Positive

- ADR-146 이 선언만 한 slot 모델이 실제 데이터/렌더/편집으로 실현된다.
- ListBoxItem 이 pencil ref-slot 조합 + RAC slot 모델과 정합 → D1 접근성(screen reader label/description) 회복.
- ADR-142 reusable-frame 방향과 forward-compatible.
- 레거시 Field 동적 모델 제거로 dataBinding row projection 단일화.

### Negative

- `render.shapes`/CSS slot paint 가 ADR-142 generic 렌더러 land 시 후속 subsume 대상(R4).
- Properties 패널 UX 변경(Field 경로 제거) — 기존 사용자 mental model 전환 필요.
- ListBox 단일 proof scope — 다른 collection family(GridList/Table)에 자동 적용 안 됨.

## References

- React Aria ListBox: <https://react-aria.adobe.com/ListBox> (Text slots: label/description, SelectionIndicator)
- `docs/migrations/shadcn-design-system.json` (pencil reusable/ref/descendants/slot 패턴)
- [ADR-146](146-listboxitem-ref-template-row-projection.md) — base (ref-template + slot allow-list 선언)
- [ADR-145](145-listbox-template-element-single-component-proof.md)
- [ADR-142](142-starter-spec-component-system-cutover.md) — canonical 컴포넌트 시스템(forward-compatible)
- [ADR-132](132-usecollectiondata-useasynclist-alignment.md) — dataBinding read model
- [ADR-076](076-listbox-items-ssot-hybrid.md)
