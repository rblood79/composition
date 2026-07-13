# ADR-059 v2 Breakdown: Composite Field CSS SSOT 확립 — 대칭 파이프라인 복귀

> 상위 ADR: [059-composite-field-skip-css-dismantle.md](../../completed/059-composite-field-skip-css-dismantle.md) (v2, 2026-04-13)
>
> **v1→v2 변경**: 2층 구조(generated + 수동 override) 기각, 수동 CSS 완전 삭제 + spec.states 확장 결정. byte diff Gate 폐기, `/cross-check` 대칭 검증으로 대체

## 전제: 선행 조사 실측 결과

| Field       | skipCSSGeneration | delegation | prefix      | 비고                           |
| ----------- | :---------------: | :--------: | ----------- | ------------------------------ |
| TextField   |       true        |    3개     | `--tf-*`    | Phase 1 시험대 적격            |
| NumberField |       true        |    4개     | `--nf-*`    | ComboBox 복제 (Phase 2로 이동) |
| SearchField |       true        |  ❌ 부재   | `--sf-*`    | delegation 신설 필요           |
| ColorField  |       true        |  ❌ 부재   | `--cf-*`    | delegation 신설 필요           |
| DateField   |       true        |  ❌ 부재   | `--df-*`    | delegation 신설 필요           |
| TimeField   |       true        |  ❌ 부재   | `--tf-*`    | 🚨 TextField와 prefix 충돌     |
| TextArea    |     **false**     |  ❌ 부재   | `--label-*` | 일관성 위반                    |

`@sync` 23건 / 13파일 중 Field 계열 9건(TextField 1 + NumberField 8). 나머지 14건은 Phase 2~4 범위.

## 파일 인벤토리

### CSSGenerator (Pre-Phase 0-D 수정 대상)

| 파일                                                                  | 역할                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/specs/src/renderers/CSSGenerator.ts`                        | `skipCSSGeneration` 분기, `generateCompositionCSS` 확장 지점 |
| `packages/specs/src/types/spec.types.ts`                              | `CompositionSpec.delegation` 타입 확장 (prefix 필드 추가)    |
| `packages/specs/src/renderers/utils/tokenResolver.ts`                 | `spec.sizes.*` → CSS 변수 값 파생 헬퍼                       |
| `packages/specs/src/renderers/utils/stateCSSGenerator.ts` (신설 가능) | `spec.states` → 상태별 CSS 블록 생성                         |

### Phase 1 — TextField 시험대

| 파일                                                  | 작업                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/specs/src/components/TextField.spec.ts`     | `skipCSSGeneration: false`, `delegation.prefix` 선언, `@sync` 주석 제거 |
| `packages/shared/src/components/styles/TextField.css` | **삭제**                                                                |
| `packages/shared/src/components/styles/index.css`     | TextField.css import 제거                                               |

### Phase 1.5 — SearchField/ColorField/DateField/TimeField/TextArea

각 컴포넌트 spec 수정 + 수동 CSS 파일 삭제 + import 제거.  
**TimeField는 Pre-Phase 0-A에서 prefix 리네임 선행** (예: `--tf-*` → `--time-*`).

### Phase 2 — Select/ComboBox/NumberField

Popover 렌더링 경로(ADR-047) 무회귀 필수. NumberField의 ComboBox 의존성 해소 시점.

### Phase 3 — DatePicker/DateRangePicker

Calendar 내부 절대 좌표 (ADR-050 overflow clipping) 무회귀.

### Phase 4 — 잔존 Composite (~48개)

Archetype 단위 그룹 전환 (Menu/Dialog/Modal/Tabs/Form/Toolbar/Tree/Table 등). 5~8개씩 sub-phase.

### Phase 5 — 상수 테이블 폐지 + 재승격

- `apps/builder/src/builder/workspace/canvas/utils/fieldDelegation.ts` — `FIELD_TRIGGER_VARIABLES`, `FIELD_AUTO_HEIGHT_VARIABLES` 폐지
- `docs/adr/README.md` — ADR-036 "Fully Implemented" 재승격 표기

---

## Pre-Phase 0-A — Naming SSOT

### 목적

CSS 변수 prefix를 spec 내부 선언으로 흡수. 비-spec 네이밍(ad-hoc prefix) 제거, prefix 충돌 구조적 불가능화.

### 작업

1. **타입 확장** — `DelegationSpec`에 `prefix: string` 필드 추가:
   ```ts
   export interface DelegationSpec {
     childSelector: string;
     prefix: string; // 신설 — "text-field-input" 등 명시
     variables: Record<SizeName, Record<string, string>>;
   }
   ```
2. **기존 prefix spec 내부 확정** — TextField/NumberField의 현 prefix(`--tf-*`, `--nf-*`)를 `composition.delegation[i].prefix`로 선언
3. **TimeField prefix 충돌 제거** — `--tf-*` → 선택(`--time-field-*` 권장, 축약 금지). 수동 CSS 파일 내 기존 `--tf-*` 참조 0건 검증
4. **lint 규칙 신설** (선택) — 동일 prefix 재사용 빌드 실패

### 통과 조건

- `grep "composition.delegation" packages/specs/src/components/` 결과 중 prefix 미선언 0
- TimeField `--tf-*` 참조 0
- `pnpm type-check` / `pnpm build:specs` 통과

### 롤백

타입 필드 optional 유지하여 기존 delegation 구조 호환. 실패 시 필드 제거만으로 복원.

---

## Pre-Phase 0-B — Delegation 완전성

### 목적

SearchField/ColorField/DateField/TimeField 4개에 `composition.delegation` 신설. TextArea 일관성 회복. CSS consumer 구조 100% spec 선언.

### 작업

1. 각 Field의 수동 CSS 파일 실측 → 필요 selector 추출 (Label/Input/Button/FieldError 등)
2. `composition.delegation` 배열 신설, 각 selector당 prefix + size variants 선언
3. TextArea는 `skipCSSGeneration: true`로 통일 (Phase 1.5에서 해체)

### 통과 조건

- 4개 Field 모두 delegation 배열 존재
- 수동 CSS에서 관찰된 selector와 delegation 선언 selector 집합 일치
- `pnpm type-check` 통과

### 롤백

delegation 제거만으로 복원 (CSSGenerator 미확장 상태이므로 CSS 출력 영향 없음).

---

## Pre-Phase 0-C — 공유 SSOT 승격 + 복제 관계 명시

### 목적

`BUTTON_SIZE_CONFIG` 등 암묵 공유 SSOT를 명시화. NumberField ↔ ComboBox 복제 관계를 Phase 순서에 반영.

### 작업

1. **BUTTON_SIZE_CONFIG 실측** — 7개 `@sync` 참조 점 확인 (TextField/Select/SelectTrigger/Input/Panel/Tag/Tabs)
2. **공유 토큰/spec 참조 결정** — 옵션:
   - (a) `packages/specs/src/shared/buttonSize.ts`로 명시 export, 참조 spec이 `import`
   - (b) Button spec의 `sizes`를 직접 참조 가능한 헬퍼 (`referenceSize(ButtonSpec, sizeName)`) 도입
3. `@sync` 주석 7건 제거, import/참조로 대체
4. **NumberField ↔ ComboBox 복제 관계 명시** — NumberField spec 파일 상단 JSDoc에 "ComboBox delegation 패턴 재사용, Phase 2 선행 필요" 명시. Phase 1 범위에서 제외

### 통과 조건

- `grep "BUTTON_SIZE_CONFIG" packages/specs/src/components/` 참조 명시 import로 전환
- `@sync.*BUTTON_SIZE_CONFIG` 주석 0
- NumberField spec에 Phase 2 선행 의존성 JSDoc 명시

### 롤백

공유 토큰 파일 제거 + 개별 spec 재복제. 위험 작음(정적 상수).

---

## Pre-Phase 0-D — States + Auto-derivation

### 목적

CSSGenerator 확장: `spec.sizes` + `spec.states` + `delegation.prefix` 3개 축에서 CSS 100% 생성. 수동 CSS 표현력 완전 흡수.

### 작업

1. **auto-derivation 규칙** — `delegation.variables.md = "auto"` 선언 시 spec.sizes에서 자동 파생:

   | 변수 (예: prefix="text-field-input") | 파생 규칙                                 |
   | ------------------------------------ | ----------------------------------------- |
   | `--text-field-input-padding`         | `${size.paddingY}px ${size.paddingX}px`   |
   | `--text-field-input-height`          | `${size.height}px`                        |
   | `--text-field-input-font-size`       | `var(${resolveToken(size.fontSize)})`     |
   | `--text-field-input-radius`          | `var(${resolveToken(size.borderRadius)})` |
   | `--text-field-input-gap`             | `${size.gap}px`                           |

2. **States 확장** — `spec.states.hover/focused/disabled/invalid` CSS 블록 자동 생성 (ADR-061 focusRing 패턴 일반화):
   ```css
   .react-aria-TextField[data-hovered] {
     /* states.hover */
   }
   .react-aria-TextField[data-focus-visible] {
     /* states.focused */
   }
   .react-aria-TextField[data-invalid] {
     /* states.invalid */
   }
   ```
3. **기존 simple 컴포넌트 무회귀** — Button/Badge/Link/Tag 등 `skipCSSGeneration: false` 53개 CSS 생성 byte diff 0 확인
4. **단위 테스트** — `compositeCssGenerator.test.ts`: 샘플 spec → 기대 CSS 문자열

### 통과 조건

- 기존 53개 simple 컴포넌트 `generated/*.css` byte diff 0
- 단위 테스트 통과
- `pnpm build:specs` 통과 (DTS 포함)

### 롤백

CSSGenerator 확장 revert. Phase 1 진입 차단.

---

## Phase 1 — TextField 시험대

### 목적

Pre-Phase 0 성과의 실증. 1개 컴포넌트를 **수동 CSS 파일 삭제 + `/cross-check` 대칭 검증**까지 완주.

### 작업

1. `TextField.spec.ts` — `skipCSSGeneration: false`
2. `composition.delegation[i].variables = "auto"` 전환
3. `@sync` 주석 제거 (L309)
4. `pnpm build:specs` → `packages/shared/src/components/styles/generated/TextField.css` 생성
5. **수동 `TextField.css` 삭제**
6. `styles/index.css` import 갱신
7. Preview 렌더링 및 Builder Canvas 시각 확인 (xs/sm/md/lg/xl × default/hover/focus/disabled/invalid)
8. `/cross-check` skill 실행 — Preview ↔ Builder 시각 일치 확인

### 통과 조건

- `packages/shared/src/components/styles/TextField.css` 파일 존재 안 함
- `grep "@sync" packages/specs/src/components/TextField.spec.ts` = 0
- `/cross-check` 통과
- Storybook 전 스토리 렌더링 확인 (수동)
- 60fps / 번들 <500KB / type-check 통과

### 롤백

- spec `skipCSSGeneration: true` 복원
- TextField.css 복원 (git)
- @sync 주석 복원

---

## Phase 1.5 — SearchField/ColorField/DateField/TimeField/TextArea

TextField 패턴 적용. 각 컴포넌트별 sub-step:

1. spec의 `delegation.variables = "auto"` 전환
2. 수동 CSS 삭제
3. `/cross-check`
4. Storybook 수동 확인

**주의**: TimeField는 Pre-Phase 0-A에서 prefix 리네임 선행 완료되어야 함.

### 통과 조건

- 5개 컴포넌트 수동 CSS 파일 0
- Field 계열 `@sync` 주석 0 (NumberField 제외)
- `/cross-check` 통과
- 60fps / 번들 / type-check 통과

---

## Phase 2 — Select/ComboBox/NumberField

### 추가 고려사항

- **Popover 렌더링 경로 (ADR-047)** — Select/ComboBox 드롭다운 표시 무회귀
- **NumberField ↔ ComboBox** — ComboBox 해체 완료 후 NumberField의 복제 delegation 을 ComboBox 참조로 변환 가능성 평가
- Archetype 규칙 확장 — trigger/popover/option 3개 child selector

### 통과 조건

- 3개 컴포넌트 수동 CSS 0, `@sync` 0
- Popover 드롭다운 시각 일치
- `/cross-check` 통과

---

## Phase 3 — DatePicker/DateRangePicker

### 추가 고려사항

- Calendar 내부 절대 좌표 (ADR-050 overflow clipping)
- Popover 자식 레이아웃 제외 규칙 (canvas-rendering.md §6)
- DATE_PICKER_STATES 공유 상수 `as const` narrowing (ADR-061 학습)

---

## Phase 4 재설계 (v2.1 amendment — 2026-04-14)

> **변경 이유**: 원 v2 Phase 4는 "skipCSS 해체만" 스코프. 실측 결과 잔존 38 컴포넌트 중 다수가 D2 부채(RSP 미규정 wrapper variant prop) 동반 → D3 해체 단독으로는 ADR-036 재승격 조건 불충족. Phase 4를 **D2+D3 통합 해체**로 재정의. 자세한 결정 근거는 [ADR-059 "Phase 4 재설계 (v2.1 amendment)"](../../completed/059-composite-field-skip-css-dismantle.md#phase-4-재설계-v21-amendment--2026-04-14) 참조.
>
> **하단 "Phase 4 — 잔존 Composite ~48개" 섹션은 본 재설계에 의해 superseded**. 이력 추적 목적으로 원문 보존.

### 원칙 (SSOT 정본 교차 참조)

`.claude/rules/ssot-hierarchy.md` §1 D2/D3 정의 + §6 금지 패턴 준수:

- **Spec.variants 필드**는 D3(시각 스타일) 내부 토큰 스위치 → 허용 가능
- **Wrapper의 variant prop**은 D2(사용자 API) → RSP 미규정이면 §6 위반 (ADR-062 선례)
- 두 축을 분리 평가하여 각 컴포넌트를 4-cell 분류

### 4-Cell 판정 매트릭스 (ADR 본문 인용)

|                         | Spec.variants 존재                                                    | Spec.variants 없음                  |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| **Wrapper prop 노출**   | **(i)** RSP 대조 후 (i-a)제거 / (i-b)rename / (i-c)composition 정당화 | **(ii)** Desync → wrapper prop 제거 |
| **Wrapper prop 미노출** | **(iii)** 현상 유지 (내부 스위치), D3 해체만                          | **(iv)** 정상, D3 해체만            |

### Per-Component Target 표 (audit 완료 — 2026-04-14)

> **Status**: 축 1(Spec.variants) + 축 2(Wrapper variant prop) 조사 완료. 축 3(RSP 공식 대조)는 (i) cell 컴포넌트 한정 batch 진입 전 재조사. 일부 compound child(SliderTrack/Output/Thumb, DateSegment, CalendarGrid/Header)는 독립 renderer 없고 부모 컴포넌트로부터 variant 상속 — cell 표시에 `(iii-inherit)` 표기.
>
> **Cell 약어**: (i-dead) = wrapper prop 있으나 Spec.variants가 사실상 dead (1 key 또는 unused), (iii-inherit) = compound child가 부모에서 상속, (iii-dead) / (iv-dead) = variants/prop 한쪽만 있고 실사용 dead.
>
> **verify 해제 (2026-04-14)**: B0.1 `274154b8` + B1 배치에서 Modal/TabPanels/ToggleButtonGroup/Slot cell 확정 완료. 잔여 `(verify)` 표시 없음.

| #   | Component         | Spec.variants                    | Wrapper prop       |     Cell      | Target Spec.variants                                            | Target Wrapper                                                                                                                                                                          |  Batch   |
| --- | ----------------- | -------------------------------- | ------------------ | :-----------: | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: |
| 1   | SearchField       | 없음                             | no                 |     (iv)      | — (이미 Phase 1.5 완료)                                         | —                                                                                                                                                                                       |   N/A    |
| 2   | DateInput         | default/accent/negative          | inherit(DateField) | (iii-inherit) | 유지 (부모 DateField propagation)                               | —                                                                                                                                                                                       |  defer   |
| 3   | Tree              | default/accent                   | no                 |     (iii)     | 유지 (내부 스위치)                                              | —                                                                                                                                                                                       |    B4    |
| 4   | ToggleButtonGroup | default                          | no                 |  (iii-dead)   | dead → 삭제 (B0.1 verify 확정)                                  | —                                                                                                                                                                                       |    B1    |
| 5   | TagGroup          | default/accent/neutral/negative  | no                 |     (iii)     | 유지 (내부 스위치)                                              | —                                                                                                                                                                                       |    B4    |
| 6   | Tag               | default/selected                 | no                 |     (iii)     | selected = 상태(data-selected)로 유지                           | —                                                                                                                                                                                       |    B4    |
| 7   | Table             | default/striped/bordered         | no                 |     (iii)     | 유지 (RSP density prop 대응 여부 검토)                          | —                                                                                                                                                                                       |    B4    |
| 8   | TabList           | default                          | yes                |   (i-dead)    | dead → 삭제                                                     | variant prop 제거                                                                                                                                                                       |    B1    |
| 9   | Tab               | default                          | no                 |  (iii-dead)   | dead → 삭제                                                     | —                                                                                                                                                                                       |    B1    |
| 10  | Slot              | default                          | yes                |   (i-dead)    | dead → 삭제                                                     | variant prop 제거                                                                                                                                                                       |    B1    |
| 11  | SliderTrack       | default/accent/neutral           | inherit(Slider)    | (iii-inherit) | 부모 Slider 결정 따름                                           | —                                                                                                                                                                                       | B3(부모) |
| 12  | SliderOutput      | default/accent/neutral           | inherit(Slider)    | (iii-inherit) | 부모 따름                                                       | —                                                                                                                                                                                       | B3(부모) |
| 13  | Slider            | default/accent/neutral           | yes                |      (i)      | (i-a) 제거 권장 — RSP Slider variant 없음                       | variant prop 제거 · RSP: variant=no, 대체=`isFilled`/`fillOffset`/`trackGradient`/`orientation` → (i-a)                                                                                 |    B3    |
| 14  | Menu              | primary/secondary/accent         | yes                |      (i)      | (i-a) 제거 — RSP Menu variant 없음                              | variant prop 제거 · RSP: variant=no, 대체=`selectionMode`/`items`/`autoFocus` → (i-a)                                                                                                   |    B2    |
| 15  | ListBox           | default/accent                   | no                 |     (iii)     | 유지 (내부 스위치)                                              | —                                                                                                                                                                                       |    B4    |
| 16  | Label             | default/accent/neutral           | yes                |      (i)      | (i-a) 제거 — RSP Label variant 없음                             | variant prop 제거 · RSP/RAC: variant=no (native `<label>` 래퍼), 대체 없음 → (i-a)                                                                                                      |    B3    |
| 17  | Group             | default/accent                   | no                 |     (iii)     | 유지                                                            | —                                                                                                                                                                                       |    B4    |
| 18  | GridList          | default/accent                   | no                 |     (iii)     | 유지                                                            | —                                                                                                                                                                                       |    B4    |
| 19  | DropZone          | default/accent                   | yes                |      (i)      | (i-a) accent=`data-drop-target` state로 이동                    | variant prop 제거 · RAC: variant=no, 대체=render state `data-drop-target`/`data-focus-visible` → (i-a)                                                                                  |    B2    |
| 20  | Disclosure        | default/accent/surface           | yes                |      (i)      | (i-a) 제거 — RSP Disclosure variant 없음                        | variant prop 제거 · RAC: variant=no, 대체=`isExpanded`/`defaultExpanded`/`isDisabled` → (i-a)                                                                                           |    B2    |
| 21  | Dialog            | accent/negative                  | yes                |      (i)      | (i-a) 제거 — RSP size 기반 재정렬                               | variant prop 제거 · RSP: variant=no, 대체=`size`(S/M/L)/`isDismissable`/`role`(dialog\|alertdialog) → (i-a)                                                                             |    B2    |
| 22  | DateSegment       | default/accent/negative          | inherit(DateField) | (iii-inherit) | 부모 따름                                                       | —                                                                                                                                                                                       |  defer   |
| 23  | ColorWheel        | default/accent                   | yes                |      (i)      | (i-a) 제거 권장                                                 | variant prop 제거 · RSP: variant=no, 대체=`size`(DimensionValue)/`isDisabled` → (i-a)                                                                                                   |    B4    |
| 24  | ColorSwatchPicker | default/accent                   | no                 |     (iii)     | 유지                                                            | —                                                                                                                                                                                       |    B4    |
| 25  | ColorSlider       | default/accent                   | yes                |      (i)      | (i-a) 제거 권장                                                 | variant prop 제거 · RSP: variant=no, 대체=`channel`/`colorSpace`/`orientation`/`contextualHelp` → (i-a)                                                                                 |    B4    |
| 26  | ColorPicker       | default/compact/expanded         | unknown (compound) |     (i-c)     | 구조 모드(compact/expanded) — composition 정당화                | RSP: variant=no, `size`(XS/S/M/L)+`rounding`(default/none/full). compact/expanded는 RSP 미규정 compound children 조합 — composition 구조 prop으로 정당화 → (i-c)                        |    B4    |
| 27  | ColorArea         | default/accent                   | no                 |     (iii)     | 유지                                                            | —                                                                                                                                                                                       |    B4    |
| 28  | Card              | primary/secondary/tertiary/quiet | yes                |    (i-a+b)    | primary/secondary/tertiary 제거, quiet는 `isQuiet` 추출         | variant 제거 + isQuiet 추가 · RSP S2: variant=no(제거됨), `isQuiet`/`size`(S/M/L)/`orientation`. primary/secondary/tertiary → (i-a) 제거, quiet → (i-b) `isQuiet` rename (ADR-062 선례) |    B2    |
| 29  | CalendarHeader    | default/accent                   | inherit(Calendar)  | (iii-inherit) | 부모 따름                                                       | —                                                                                                                                                                                       |  defer   |
| 30  | CalendarGrid      | default/accent                   | inherit(Calendar)  | (iii-inherit) | 부모 따름                                                       | —                                                                                                                                                                                       |  defer   |
| 31  | Breadcrumb        | default                          | no                 | (iii-dead→iv) | dead → 삭제                                                     | —                                                                                                                                                                                       |    B1    |
| 32  | SliderThumb       | default/accent/neutral           | inherit(Slider)    | (iii-inherit) | 부모 따름                                                       | —                                                                                                                                                                                       | B3(부모) |
| 33  | Tabs              | default                          | no                 |  (iii-dead)   | dead → 삭제                                                     | —                                                                                                                                                                                       |    B1    |
| 34  | TabPanels         | 없음                             | no                 |     (iv)      | — (B0.1 verify: agent 오보 정정, renderer=null return)          | —                                                                                                                                                                                       |    B1    |
| 35  | Field             | default                          | no                 | (iv-virtual)  | 데이터 매핑 virtual spec 유지                                   | —                                                                                                                                                                                       |  defer   |
| 36  | Modal             | 없음                             | no                 |     (iv)      | — (B0.1 verify: ModalProps variant 없음, renderModal 전달 없음) | —                                                                                                                                                                                       |    B1    |
| 37  | DisclosureHeader  | 없음                             | no                 |     (iv)      | — (native h3)                                                   | —                                                                                                                                                                                       |    B1    |
| 38  | TailSwatch        | 없음                             | no                 |     (iv)      | —                                                               | —                                                                                                                                                                                       |    B1    |
| +   | Accordion         | 없음                             | no                 |     (iv)      | —                                                               | —                                                                                                                                                                                       |    B1    |

**Cell 집계**:

- **(i) / (i-a): 10개** — Card, ColorWheel, ColorSlider, Dialog, Disclosure, DropZone, Label, Menu, Slider, (+ ColorPicker compound 후보)
- **(i-dead): 2개** — Slot, TabList
- **(ii) verify: 0개** — TabPanels는 B0.1에서 (iv)로 정정 (renderer=null return)
- **(iii): 9개** — Tree, TagGroup, Tag, Table, ListBox, Group, GridList, ColorSwatchPicker, ColorArea
- **(iii-inherit): 7개** — SliderTrack/Output/Thumb (Slider 부모), DateInput/DateSegment (DateField 부모), CalendarGrid/Header (Calendar 부모)
- **(iii-dead / iv-dead): 3개** — ToggleButtonGroup, Tab, Tabs, Breadcrumb(dead default), 삭제 후보
- **(iv): 5개** — Accordion, DisclosureHeader, TailSwatch, Modal, TabPanels (B0.1 확정)
- **defer/virtual: 2개** — Field(데이터 매핑), SearchField(이미 완료)

축 3(RSP 공식 대조): B0.2 (2026-04-14)에서 (i) cell 10개 대조 완료. TabPanels verify는 B0.1에서 (iv)로 정정 후 별도 RSP 대조 불필요.

### Batch 계획 (audit 결과 반영)

- **B0 (Audit 완료)** — 본 표 채움 + 축 3 (i) cell 컴포넌트 RSP 대조. ADR Gates "D2 매트릭스 분류 확정" 통과.
- **B1 (Dead/Desync 선행, 저위험)** — `≈12개`: Slot, TabList, Tab, Tabs, Breadcrumb, ToggleButtonGroup, Accordion, DisclosureHeader, TailSwatch, Modal(verify), TabPanels(verify), (+ 잔존 dead variant 삭제). wrapper variant prop 제거 + dead variants Spec 필드 삭제. RSP 대조 최소(대부분 dead). 기대 -200L 수준.
- **B2 (ADR-062 선례 확장, wrapper breaking)** — `≈5개`: Dialog, Modal(if wrapper confirmed), Menu, Disclosure, DropZone, Card. RSP 공식 대조 후 wrapper variant prop 제거 또는 RSP prop(isQuiet/size 등)로 rename. Card의 quiet → `isQuiet`는 ADR-062 Field 선례 직접 복제.
- **B3 (Slider family + Label)** — `≈5개 (1 parent + 3 compound + Label)`: Slider/SliderTrack/SliderOutput/SliderThumb 일괄 + Label. wrapper prop 제거 + Spec.variants dead 여부 재검 (semantic color만이면 삭제).
- **B4 (Container/Display composite)** — `≈15개`: Table, Tag, TagGroup, Tree, GridList, ListBox, Group, ColorArea, ColorSwatchPicker, ColorSlider, ColorWheel, ColorPicker(composition 정당화 가능). (iii)는 D3 해체만, (i) Color siblings는 wrapper prop 제거 동반.
- **B-defer** — Field(virtual), DateInput/DateSegment(DateField 내부, Phase 1.5 이미 해체), CalendarGrid/Header(Calendar spec 별도 정의 여부 확인 후).
- **B-final (Phase 5)** — skipCSSGeneration:true 0건, wrapper variant prop 0건, fieldDelegation.ts 폐지, ADR-036 "Fully Implemented" 재승격.

각 batch는 별도 worktree + PR. PR 내부에서:

1. Spec.variants 필드 target 반영
2. Wrapper variant prop target 반영 (breaking 시 호출지 일괄 수정)
3. skipCSSGeneration:true → false 전환
4. 수동 CSS 삭제 + import 정리
5. `/cross-check` 실행, Storybook/E2E 시각 확인
6. 60fps / 번들 / type-check Gate

### D2 판정 체크리스트 (각 컴포넌트당 batch 진입 전)

- [ ] Spec.variants 각 key 가 D3 시각 토큰 스위치인가, 아니면 죽은 선언인가
- [ ] Wrapper 가 variant prop 을 사용자에게 노출하는가 (Canvas wrapper, Preview, Inspector 3곳)
- [ ] Wrapper variant prop 값 집합이 RSP 공식과 일치/불일치 판정
- [ ] 불일치 시 (i-a)/(i-b)/(i-c) 분기 선택 근거
- [ ] (i-c) 선택 시 composition 고유 필수 근거 2줄 이상 ADR 또는 PR description 에 기록

### Audit 진행 상태 (live)

- 축 1 (Spec.variants): 완료 — 위 표 column 3
- 축 2 (Wrapper variant prop): 진행 중 — 2026-04-14 배경 agent 실행 중
- 축 3 (RSP 공식): **완료 — B0.2 (2026-04-14)** — (i) cell 10 컴포넌트 RSP 공식 대조 완료 (Card/Dialog/Disclosure/DropZone/Label/Menu/Slider/ColorWheel/ColorSlider/ColorPicker). 분기 집계: (i-a) 제거 8개 · (i-a+b) Card(quiet→isQuiet 1개) · (i-c) ColorPicker compound 정당화 1개. B2 진입 Gate "D2 매트릭스 분류 확정" 충족.

---

## B1 실행 결과 (2026-04-14, feature/adr-059-b1-low-risk)

B0.1 + B1.1~B1.11 완료. 11 컴포넌트 D3 해체 + D2 부채 2건 해제.

### Commits

| Commit     | 내용                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `274154b8` | B0.1 verify — Modal/TabPanels/ToggleButtonGroup/Slot cell 확정           |
| `3fd3327a` | B1.1 Breadcrumb skipCSSGeneration:false                                  |
| `d40c70c6` | B1.2-5 Accordion/DisclosureHeader/TailSwatch/Tab skipCSSGeneration:false |
| `1f82832b` | B1.11 TabPanels skipCSSGeneration:false                                  |
| `e27665c7` | B1.7+9+10 Tabs/Modal/ToggleButtonGroup — 수동 CSS 삭제 (−608L)           |
| `942968ea` | B1.6+8 TabList/Slot — dead variant 선언 제거                             |
| `3cf1117a` | Slot.tsx import path 후속 수정                                           |

### 지표

- skipCSSGeneration:true: 11개 감소
- 수동 CSS 4개 삭제(-608L): Slot, Tabs, Modal, ToggleButtonGroup
- Generated CSS 11개 신규
- D2 부채 해제 2건: Slot, TabList dead variant 선언 제거

### Known concerns

- Modal `.react-aria-TextField` nested 마진 삭제 — visual regression 가능성 (reviewer 시각 확인)

---

## B3 실행 결과 (2026-04-14, feature/adr-059-b3-slider-label)

B0.2 RSP 대조 기반 Slider family(4) + Label(1) = 5 컴포넌트 wrapper variant prop 해체. Slider family는 수동 CSS 삭제 완료, Label은 canvas-rendering §4 규칙 준수로 수동 CSS 유지.

### Commits

| Commit     | 내용                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `c88ff8ad` | B3.1 Slider family (Slider + SliderTrack + SliderOutput + SliderThumb) 일괄 해체 |
| `b457e3c3` | B3.2 Label — wrapper prop 제거 (수동 CSS 유지, i-dead 패턴)                      |

### 지표

- skipCSSGeneration:true: 4개 감소 (Slider family) + Label은 유지
- 수동 CSS 1개 삭제 (Slider.css) + Label.css 유지
- Generated CSS 4개 신규 (Slider/SliderTrack/SliderOutput/SliderThumb)
- Wrapper variant prop 제거: 5 컴포넌트 (Slider + Label renderer 2곳)

### 시각 변경

- Slider/SliderTrack/SliderOutput/SliderThumb: default/accent/neutral 색상 제거 → default (accent color) 단일
- Label: 5개 text color variant(default/accent/neutral/purple/negative) 제거 → neutral 단일. purple/negative 필요 시 `style={{color: ...}}` 또는 parent field `--field-accent` 변수 사용

### Breaking API

- `<Slider variant=...>` 호출지 제거
- SliderElementProps.variant(default/filled union) 제거
- `<Label variant=...>` 호출지 제거

### Label 규칙 준수 (canvas-rendering §4)

- rules/canvas-rendering.md: "Label generated CSS 부활 금지 — 부모 CSS 변수 상속 깨짐"
- B3.2는 D2(Wrapper prop) 제거만 수행. D3 CSS 해체(skipCSSGeneration:true 유지)는 별도 ADR 또는 §4 규칙 완화 후 진행.

---

## B2 실행 결과 (2026-04-14, feature/adr-059-b2-variant-removal)

B0.2 RSP 대조(commit b1badff3) 기반 5 컴포넌트 wrapper variant prop + 수동 CSS 일괄 해체. ADR-062 Field isQuiet 선례를 Card에 복제.

### Commits

| Commit     | 내용                                                         |
| ---------- | ------------------------------------------------------------ |
| `90d765e5` | B2.1 DropZone — variant 제거 (default/accent)                |
| `219ce6de` | B2.2 Disclosure — variant 제거 (default/accent/surface)      |
| `6a169c68` | B2.3 Menu — variant 제거 (primary/secondary/accent/negative) |
| `8f9cb3d6` | B2.4 Dialog — variant 제거 (accent/negative)                 |
| `0e13ddee` | B2.5 Card — variant 제거 + isQuiet 통합                      |

### 지표 (B2)

- skipCSSGeneration:true: 5개 감소
- 수동 CSS 5개 삭제, generated CSS 5개 생성
- JSX wrapper variant prop 제거 5 컴포넌트

### 시각 변경 (Known visual regressions)

- Disclosure.surface 배경 차이 제거 → default 통합
- Menu 4 variant 시각 차이 제거 → default 단일
- Dialog.negative text color 제거 → role='alertdialog' + 내부 Button variant 권장
- Card.tertiary shadow 제거 → style.boxShadow 직접 설정
- Card.secondary 2px border 제거 → 1px 기본 + style.borderColor 활성화
- Card.quiet → isQuiet prop 통합

### Breaking API

- `<DropZone|Disclosure|Menu|Dialog variant=...>` 전부 제거
- `<Card variant='primary|secondary|tertiary'>` 제거
- `<Card variant='quiet'>` → `<Card isQuiet>` 마이그레이션
- Card Properties 패널에서 variant 편집 필드 사라짐

### B0.2 Cell 집계

- (i-a) 순수 제거: DropZone/Disclosure/Menu/Dialog (4)
- (i-a+b) 제거+isQuiet 통합: Card (1)
- (i-c) composition 정당화: ColorPicker (B4 대상)

---

## B4 실행 결과 (2026-04-14, feature/adr-059-b4-final-cleanup)

B4 실지 조사 결과, 잔여 12개 중 **9개는 수동 CSS가 CSSGenerator로 재현
불가능한 Tier 3 구조** (재귀 nesting / 가상 스크롤 / builder-mode indicator
/ `::after` selected 표시 / `data-layout=stack` 속성 선택자 등)로 확인.
Label §4 예외와 동일한 패턴을 확장 적용하여 D3 해체 대상에서 제외.

### 처리 내역

**(i-a-dead) 2개 — variant prop 제거, skipCSSGeneration:true 유지**:

- ColorWheel, ColorSlider — render.shapes가 variants 미참조 (dead D3).
  wrapper prop과 `variants.accent` 제거. 수동 CSS 구조는 Tier 3 예외.

**Tier 3 예외 (D3 해체 불가, skipCSSGeneration:true 고정)**:

| Component         | 예외 사유                                                                                                                                                                                                                                                                                                                                                                     | 근거 ADR    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Tree              | 재귀 nesting + `:has()` 선택자 (CSSGenerator 미지원)                                                                                                                                                                                                                                                                                                                          | —           |
| Table             | 가상 스크롤 + column resizer (구조 CSS)                                                                                                                                                                                                                                                                                                                                       | —           |
| Group             | builder-mode `data-element-id` outline + `::before` 라벨 pseudo-element                                                                                                                                                                                                                                                                                                       | —           |
| TagGroup          | 복합 CSS — `.react-aria-Tag`/`.react-aria-TagList` RAC 내부 구조체 + 2단계 parent-child selector 포함. 전체 307줄이 spec token 파생 (독자 수치 없음). ADR-105 F4/F2 @sync 4건 설명 주석 교체 완료.                                                                                                                                                                            | ADR-106-b   |
| ListBox           | 401L — selection/state nested selectors                                                                                                                                                                                                                                                                                                                                       | —           |
| GridList          | 176L — selection/state nested selectors                                                                                                                                                                                                                                                                                                                                       | —           |
| ColorArea         | `.react-aria-ColorThumb` nested + `[data-disabled]` descendant override                                                                                                                                                                                                                                                                                                       | —           |
| ColorSwatchPicker | `[data-selected]::after` 선택 표시 + `[data-layout=stack]` 속성 선택자. RAC ColorSwatchPickerItem pseudo-element CSSGenerator 미지원. focus/radius spec token 파생.                                                                                                                                                                                                           | ADR-106-a   |
| Tag               | TagGroup.css 내부에 `.react-aria-Tag` 스타일 포함 (consumer coupling). @sync 2건 ADR-106-b 에서 설명 주석 교체 완료 (G2 확정). Tag.spec.ts `@sync` 0건 확증.                                                                                                                                                                                                                  | ADR-106-b/d |
| Field             | FieldSpec.render.shapes = `() => []` — 시각 shapes 없음. Field.css 는 `.react-aria-FieldGroup`/`.react-aria-DataField` 구조 유틸리티 CSS (FieldSpec emit 대상 `.react-aria-Field` 와 다른 scope). `index.css:57` 주석 `/* 구조 유틸리티 — Spec 없음 */` 명시. CSS 변수 5건 spec token 파생. residual debt: `40px × 40px` DataField image 고정 수치 (spec.sizes 미선언).       | ADR-106-d   |
| ColorPicker       | RAC Color family 내부 구조 (Dialog/button container) 수동 재정의. 주요 색상은 spec token 파생. `--cp-*` 로컬 변수 중 `--cp-dialog-min-width` 는 독자 수치 (레이아웃 상수).                                                                                                                                                                                                    | ADR-106-a   |
| ColorSlider       | RAC SliderTrack/ColorThumb selector 수동 재정의. 주요 색상/radius spec token 파생. vertical 고정 수치는 RAC 내부 구조.                                                                                                                                                                                                                                                        | ADR-106-a   |
| ColorWheel        | RAC ColorWheelTrack/ColorThumb selector 수동 재정의. thumb border spec token 파생.                                                                                                                                                                                                                                                                                            | ADR-106-a   |
| Label             | base.css `--label-font-size` CSS 변수 상속 메커니즘 보존. generated CSS의 `font-size` 직접 선언이 CSS specificity로 base.css `var(--label-font-size)` 상속 패턴을 파괴 → CSSGenerator 구조적 미지원. 22개 부모 컴포넌트 의존. 대부분 CSS는 spec token 파생 (containerStyles/sizes/states). G3 residual: variant 4종 색상 + necessity-indicator + font-weight (별도 ADR 대상). | ADR-106-c   |

**(i-c) composition 정당화**:

- ColorPicker — compact/expanded는 compound children 조합 모드. RSP 미규정
  이지만 composition 구조 prop으로 유지 (ADR-063 D2 정당화 경로).

### Commits

| Commit | 내용                                                  |
| ------ | ----------------------------------------------------- |
| (this) | ColorWheel/ColorSlider — variant prop 제거 (i-a-dead) |

### 결과

- skipCSSGeneration:true: **19 → 19** (Tier 3 예외로 확정, 추가 해체 없음)
- variant prop 제거: **2개** (ColorWheel, ColorSlider)
- 수동 CSS: 변경 없음
- 공식화: Tier 3 예외 9개 breakdown에 명시 → Phase 4 D3 해체 **범위 확정 종료**

### Phase 4 종합 (B1~B4 합산)

- skipCSSGeneration:true: **38 → 19** (50% 감축)
- 수동 CSS 삭제: **10개**
- variant prop 제거: **17개 컴포넌트**
- isQuiet 보강: Card (ADR-062 선례 확장)
- §4/Tier 3 예외 공식화: Label + 9개 컴포넌트

B-final (Phase 5) 진입 — ADR-036 재승격 + `utils/fieldDelegation.ts` 폐지.

---

## B5 실행 결과 (2026-04-15, refactor/adr-059-b5-togglebutton-indicator-ssot)

### 변경 파일 목록

| commit     | 파일 / 변경 내용                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a796d1a5` | `packages/specs/src/types.ts` — `VariantSpec.selected*` / `emphasizedSelected*` 색상 필드 신설                                                               |
| `7ba4c3ad` | `packages/specs/src/types.ts` — `ComponentSpec.indicatorMode` 서브-스키마 신설                                                                               |
| `c13470c9` | `packages/specs/src/renderers/CSSGenerator.ts` — `[data-selected]` + `[data-emphasized][data-selected]` 룰 자동 emit                                         |
| `fdfcbce9` | `packages/specs/src/renderers/CSSGenerator.ts` — `indicatorMode` → `[data-indicator="true"]` + `.react-aria-SelectionIndicator` CSS 블록 자동 생성           |
| `0a55673a` | `packages/specs/src/components/ToggleButton.spec.ts` — `variants.default.selected*` / `emphasizedSelected*` 값 이관 (기존 `TOGGLE_SELECTED_COLORS` 상수에서) |
| `cd7f002e` | `packages/specs/src/components/ToggleButtonGroup.spec.ts` — `indicatorMode` 필드 설정                                                                        |
| `a1256596` | `packages/shared/src/components/styles/ToggleButton.css` 삭제 (141L) + `packages/shared/src/components/ToggleButton.tsx` import를 generated 경로로 전환      |

### Generator 변경 요약

- **VariantSpec 확장**: `selected`, `selectedHover`, `selectedPressed`, `emphasizedSelected`, `emphasizedSelectedHover`, `emphasizedSelectedPressed` 색상 필드 추가 → CSSGenerator가 `[data-selected]` / `[data-emphasized][data-selected]` 상태 CSS 자동 emit
- **indicatorMode 스키마**: `mode: "underline" | "border" | "pill"` + `color`, `size` 서브필드 → `[data-indicator="true"]` 선택자 + `.react-aria-SelectionIndicator` 가상 요소 CSS 블록 자동 생성
- ~~기존 `TOGGLE_SELECTED_COLORS` 런타임 상수~~ → `render.shapes`가 `spec.variants.default.selected*` 직접 참조로 전환 완료. 상수 + export 삭제 (2026-04-16)

### 잔존 후속 과제

- ~~`TOGGLE_SELECTED_COLORS` Skia 측 참조~~ → **완료** (2026-04-16). `render.shapes`가 `variant.selectedBackground` / `variant.emphasizedSelectedBackground` 등 직접 참조
- ~~`utils/fieldDelegation.ts` 폐지~~ → **완료** (이전 세션에서 삭제됨)

### B5 수치

- 수동 CSS 삭제: **1개** (ToggleButton.css 141L)
- `@sync` consumer-to-consumer 참조 해소: **완료**
- CSSGenerator 신규 emit 패턴: `[data-selected]` 룰 + `indicatorMode` 블록

---

## B5 후속 수정 상세 (2026-04-16)

### 근본 원인 체인

초기 B5 implementation 후 시각 검증에서 `.button-base` utility(`@layer utilities`)와 generated CSS(`@layer components`)의 layer 순서 충돌 발견. Generated CSS가 `background/color/border-color` direct emit으로 utilities layer의 `.button-base`에 패배. 추가로 DOM 쪽 propagation 미구현으로 Group-scoped prop들이 자식에 반영되지 않음.

### 수정 내역 (시간 순)

| Commit     | 수정 파일                                                                                                                                                                         | 핵심 변경                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `c113607a` | `packages/specs/src/renderers/CSSGenerator.ts`, `packages/specs/src/types.ts`                                                                                                     | `cssEmitMode` 필드 + `emitColorLine` helper               |
| `6e22a412` | `packages/specs/src/components/Button.spec.ts`, `packages/specs/src/components/ToggleButton.spec.ts`, `packages/shared/src/components/styles/ToggleButton.tsx`, generated CSS 3종 | spec opt-in + SelectionIndicator className + 회귀 수정    |
| `23a62514` | `packages/shared/src/components/ToggleButton.tsx`                                                                                                                                 | `data-variant="default"` 속성 추가                        |
| `af48c90f` | `packages/shared/src/components/ToggleButtonGroup.tsx`, `packages/shared/src/components/ToggleButton.tsx`                                                                         | `ToggleButtonGroupEmphasizedContext` 신설 + 자식에서 참조 |
| `fb20ae7a` | `packages/specs/src/components/ToggleButtonGroup.spec.ts`                                                                                                                         | `propagation.rules` 선언                                  |
| `de8d7d08` | `apps/builder/src/builder/utils/propagationRegistry.ts`                                                                                                                           | `ToggleButtonGroupSpec` 등록                              |

### cssEmitMode 설계 상세

- `"direct"` (기본): 기존 방식 — `background`/`color`/`border-color` 속성 직접 emit
- `"button-base"`: `--button-color`/`--button-text`/`--button-border` custom property emit → `.button-base` utility가 `@layer utilities`에서 소비 + color-mix hover/pressed 자동 파생
- layer 충돌 해소: components → utilities 방향으로 custom property 위임하므로 specificity 충돌 없음
- `emitColorLine()` helper: variant/selected/emphasizedSelected/indicatorMode 모든 emit 경로를 단일 함수로 통일 → emit mode 분기 일관성 보장

### ToggleButtonGroup propagation 설계

DOM/CSS 경로와 Skia 경로의 이중 전파 구조:

**DOM/CSS 측** (`ToggleButtonGroup.tsx`):

```tsx
const ToggleButtonGroupEmphasizedContext = createContext<boolean>(false);
// Group 내부: <ToggleButtonGroupEmphasizedContext.Provider value={isEmphasized}>
// ToggleButton 내부: const isEmphasized = useContext(ToggleButtonGroupEmphasizedContext);
//                    <button ... data-emphasized={isEmphasized || undefined} />
```

**Skia 측** (`ToggleButtonGroup.spec.ts` + `propagationRegistry.ts`):

```ts
propagation: {
  rules: [
    { parentProp: "isEmphasized", childPath: "ToggleButton" },
    { parentProp: "size", childPath: "ToggleButton" },
  ];
}
// propagationRegistry에 ToggleButtonGroupSpec 등록 → ADR-048 파이프라인으로 자식 element props에 자동 전파
```

### 검증 결과

- type-check: 3/3 통과
- specs test: 116/116 통과
- 시각 대칭: ToggleButton 단독 / ToggleButtonGroup 자식 모두 isEmphasized + selected에서 accent 색 CSS/Skia 양쪽 적용 확인

### 남은 후속 과제 (B5 범위 외)

- ~~`TOGGLE_SELECTED_COLORS` 상수~~ → **완료** (2026-04-16). `render.shapes`가 `variant.selected*` / `variant.emphasizedSelected*` 직접 참조. 상수 + export 삭제됨.
- 일부 builder 영역(StylesPanel.css 12줄 글로벌 오버라이드)은 generated CSS를 가로챌 수 있으나 실제 사용 경로에서는 현재 충돌 미확인. 발생 시 별도 처리.

---

## Phase 4 — 잔존 Composite ~48개 (superseded by v2.1 amendment)

> **Superseded**: 위 "Phase 4 재설계 (v2.1 amendment)" 로 대체. 아래 원문은 이력 추적 목적 보존.

Archetype 그룹화 (5~8개씩 sub-phase):

- Menu/MenuItem/MenuTrigger
- Dialog/Modal/Popover
- Tabs/Tab/TabList/TabPanel
- Form/Fieldset
- Toolbar/ToolbarItem
- Breadcrumb/BreadcrumbItem
- Tree/TreeItem
- Table/TableHeader/TableBody/TableRow/Cell
- Disclosure/Accordion

각 그룹별 완료 시 `/cross-check` + 60fps + 번들 Gate.

---

## Phase 5 — 최종 검증 + 재승격

### 작업

1. `grep -rn "skipCSSGeneration.*true" packages/specs/src/components/` = 0
2. `grep -rn "@sync" packages/specs/src/components/` = 0
3. `utils/fieldDelegation.ts` — `FIELD_TRIGGER_VARIABLES`/`FIELD_AUTO_HEIGHT_VARIABLES` 사용처 grep, 미사용 확인 후 파일 삭제
4. `docs/adr/README.md` — ADR-036 "Implemented" → "Fully Implemented" 재승격. ADR-059 Implemented 표기
5. ADR-059 Status → Implemented

### 통과 조건

- 위 grep 3건 모두 0
- `utils/fieldDelegation.ts` 파일 존재 안 함
- Canvas 60fps / 번들 <500KB 최종
- `/cross-check` 전 Composite 통과

---

## 회귀 진단 절차 (v2)

### 검증 원칙

v1의 "기존 수동 CSS ↔ generated CSS byte diff 0" Gate는 **폐기**. 기존 수동 CSS는 오염된 consumer 상태이며 reference 자격 없음.

### 단위 1: CSS 생성 무회귀 (Pre-Phase 0-D만)

기존 `skipCSSGeneration: false` simple 컴포넌트 53개의 generated CSS가 확장 전/후 동일. byte diff 도구는 이 단일 목적에만 사용.

### 단위 2: 대칭 파이프라인 검증 (`/cross-check`)

- Preview (DOM+CSS) 렌더링 캡처
- Builder Canvas (Skia) 렌더링 캡처
- 두 결과가 시각 일치 (≤1px 허용)
- 동일 spec 소스에서 두 consumer가 동일 결과 산출

### 단위 3: SSOT 순도 정량 Gate

- `grep "skipCSSGeneration.*true"` 카운트
- `grep "@sync"` 카운트
- 수동 CSS 파일 잔존 카운트

---

## 체크리스트 (최종 완료 시)

### Pre-Phase 0

- [ ] 0-A: delegation.prefix 타입 확장, 기존 Field prefix 선언, TimeField 충돌 제거
- [ ] 0-B: 4개 Field delegation 신설 + TextArea 일관성 회복
- [ ] 0-C: BUTTON_SIZE_CONFIG 명시화, NumberField Phase 2 의존성 기술
- [ ] 0-D: CSSGenerator 확장 (states + auto), simple 컴포넌트 53개 byte diff 0

### Phase 1~5

- [ ] Phase 1: TextField 수동 CSS 삭제, `/cross-check` 통과
- [ ] Phase 1.5: 5개 Field 해체 완료
- [ ] Phase 2: Select/ComboBox/NumberField 해체, Popover 무회귀
- [ ] Phase 3: DatePicker/DateRangePicker 해체, Calendar 무회귀
- [ ] Phase 4: 잔존 48개 Archetype 그룹 전환
- [ ] Phase 5: `@sync` 0건, skipCSSGeneration 0건, fieldDelegation.ts 폐지, ADR-036 재승격

### 원칙 준수 검증

- [ ] 수동 CSS 파일 0 (대상 Composite 범위)
- [ ] `/cross-check` 대칭 검증 통과
- [ ] v1 "byte diff Gate" 미사용 (대칭 원리 위반 방지)

---

## Pre-Phase 0-E 사전 진단 결과 (2026-04-13)

5개 Composite Field 수동 CSS 에서 `var(--{prefix}-*)` 참조를 정적 grep 하여 0-B 선언과의 정합성 매트릭스를 산출. (grep: `var\(--(tf|sf|cf|df|time-field)-[a-z-]+\)` @ `packages/shared/src/components/styles/{TextField,SearchField,ColorField,DateField,TimeField}.css`)

| Field         | 0-B 선언                                                         | 실제 CSS 소비                                          | Dead (선언/미소비)                      | Undeclared (소비/미선언)                 |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------- | ---------------------------------------- |
| TextField     | tf-label-size, tf-input-{padding,size,line-height}, tf-hint-size | 동일 + tf-label-margin                                 | 0                                       | `tf-label-margin`                        |
| SearchField   | sf-label-size, sf-input-{size,line-height}, sf-hint-size         | sf-label-size, sf-icon-size, sf-btn-size, sf-hint-size | **sf-input-size, sf-input-line-height** | `sf-icon-size`, `sf-btn-size`            |
| ColorField    | cf-label-size, cf-input-{size,line-height}, cf-hint-size         | 동일 + cf-input-padding, cf-input-max-width            | 0                                       | `cf-input-padding`, `cf-input-max-width` |
| DateField     | df-label-size, df-input-{size,line-height}, df-hint-size         | 동일 + df-input-padding, df-segment-size               | 0                                       | `df-input-padding`, `df-segment-size`    |
| **TimeField** | **time-field-\* (label/input/hint)**                             | **tf-\* (!!) — TextField prefix 재사용 중**            | **time-field-\* 3개 전부 dead**         | `tf-segment-size` (TextField 에도 없음)  |

### 블로커 (Phase 1 진입 전 해제 필수)

1. **TimeField.css `tf-*` prefix 충돌** (CRITICAL)
   - 증상: TimeField 전용 CSS 가 TextField 네임스페이스를 공유 — TextField 의 size variant override 가 TimeField 로 의도치 않게 누출
   - 영향: 0-B 의 `time-field-*` 선언은 현재 전부 dead code
   - 조치: TimeField.css 의 모든 `--tf-*` → `--time-field-*` 로 리네이밍 후 hand-written CSS 단독 회귀 확인 (CSS-only diff, Skia 영향 없음)
   - 주의: 공통 `tf-segment-size` 는 어디에도 선언 없는 dangling — 제거 또는 selector 기반 대체

2. **SearchField 0-B 선언 오류** (HIGH)
   - 증상: 선언된 `sf-input-size`, `sf-input-line-height` 는 CSS 어디에도 참조 없음. 실제 CSS 는 `sf-icon-size`, `sf-btn-size` 참조
   - 조치: 0-B SearchField composition.delegation 수정 — input-size/line-height 제거, icon/btn delegation 신설 (또는 size-level 변수로 재정렬)

3. **auto 5변수 외 추가 변수 다수** (MEDIUM)
   - 소비 중인 수동 변수: `-label-margin` (TF), `-icon-size` (SF), `-btn-size` (SF), `-max-width` (CF), `-segment-size` (DF)
   - auto 파생 표준 5변수만으로는 현재 hand-written CSS 대체 불가 → Phase 1 는 **hybrid** 방식 필수
     - `variables: "auto"` : 표준 5변수
     - `variables: { md: { "--{prefix}-icon-size": ... } }` 형태로 추가 선언 병기 (type-system 변경 없음, 기존 union 그대로 수용)
   - 또는 auto 확장 v2: `variables: { mode: "auto", extra: { ... } }` — 타입 변경 필요. 현 단계는 hybrid 선호

### 블로커 해제 작업 순서 (0-F 제안)

| #     | 작업                                                                  | 리스크                                             |
| ----- | --------------------------------------------------------------------- | -------------------------------------------------- |
| 0-F.1 | TimeField.css `tf-*` → `time-field-*` 리네이밍                        | LOW (CSS-only, Preview 회귀 테스트 가능)           |
| 0-F.2 | SearchField 0-B 선언 수정 (icon/btn 포함)                             | LOW (선언만, skipCSSGeneration:true 유지 → 출력 0) |
| 0-F.3 | breakdown 문서의 Phase 1 체크리스트에 "auto + hybrid extra" 설계 반영 | LOW (문서만)                                       |

### 검증 방법

- 블로커 3개 해제 후 동일 grep 재실행 → dead/undeclared 항목 0 목표
- `build:specs` → validator R1/R2/R3 통과 (현재도 통과 — validator 는 CSS 미스캔)
- 제안: validator 에 R4 추가 고려 — "prefix 선언됐으나 `packages/shared/src/components/styles/` 에서 미참조 시 경고"

## Phase 1 Step 1 시험대 결과 (2026-04-13)

TextField.spec.ts `skipCSSGeneration: true → false` 1회 실행 후 `generated/TextField.css` 출력 비교. Step 1 진입 **불가** 판정. 아래 구조적 블로커 3종 선행 필요.

### Gap 매트릭스 (generated vs manual TextField.css)

| 항목                                                  | Generated (Spec 기반)                                             | Manual TextField.css                          | 판정                         |
| ----------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- | ---------------------------- |
| base layout                                           | `align-items: flex-start` + `box-sizing`                          | `width: fit-content` + 없음                   | Spec에 fit-content 누락      |
| `data-label-position="side"`                          | 없음                                                              | grid override 블록                            | Spec 미표현                  |
| variants                                              | Spec variant(accent/neutral/purple/negative/positive) 색상 미생성 | `secondary/tertiary/error/filled` (다른 이름) | 양쪽 엉킴 — dead code        |
| size xs                                               | Spec sizes 미선언                                                 | CSS에 존재                                    | Spec 누락                    |
| size xl delegation                                    | Spec delegation 미선언                                            | CSS에 존재                                    | Spec delegation 누락         |
| `--tf-label-margin` base default                      | delegation에만                                                    | base level md 기본                            | generated 미생성             |
| `--tf-input-padding` base default                     | delegation에만                                                    | base level md 기본                            | generated 미생성             |
| Input state 셀렉터                                    | 없음                                                              | hover/focus/invalid/disabled border           | Spec StateEffect 계약 부재   |
| `[data-variant="filled"] .react-aria-Input`           | 없음                                                              | 복합 블록                                     | filled가 Spec variant에 부재 |
| `[slot="description"]` hint                           | 없음                                                              | `--tf-hint-size` consumer                     | Spec description 계약 부재   |
| bridge 변수 (`--label-font-size` ← `--tf-label-size`) | 없음                                                              | Label/Input/Description 다리                  | CSSGenerator 미지원          |
| focus-visible outline                                 | `--focus-ring-width` (ADR-061 토큰)                               | Input 직접 `outline: 2px solid var(--accent)` | 정책 불일치                  |

### 3대 구조적 블로커

1. **Variant 네이밍 완전 불일치 (CRITICAL, 독립 프로덕션 버그)**
   - Spec: `accent/neutral/purple/negative/positive` (5)
   - CSS: `primary/secondary/tertiary/error/filled` (5)
   - Spec이 emit하는 `data-variant` 값과 CSS selector 값이 완전 불일치 → CSS variant 블록 전체가 dead code
   - ADR-059와 독립. **Pre-Phase 0-G 대상**.

2. **Size 도메인 3중 불일치 (HIGH)**
   - Spec sizes: `sm/md/lg/xl` (4)
   - Spec delegation variables: `xs/sm/md/lg` (4, xs 있고 xl 없음)
   - CSS: `xs/sm/md/lg/xl` (5)
   - **Pre-Phase 0-H 대상**.

3. **State/Composition 계약 부재 (MEDIUM)**
   - DelegationSpec이 변수 발행만 지원 — state selector, base default, bridge 변수, filled variant 특별처리 미지원
   - CSSGenerator 확장 필요 — **Phase 1 Step 2 설계 대상**

### 블로커 해제 순서 (Pre-Phase 0-G/0-H)

| Step | 작업                                                                                                      | 리스크 | 비고                              |
| ---- | --------------------------------------------------------------------------------------------------------- | ------ | --------------------------------- |
| 0-G  | Variant 네이밍 정렬 — CSS dead block 제거 + Spec(accent/neutral/purple/negative/positive) 기준 CSS 재작성 | MEDIUM | filled는 Spec variant로 승격 후보 |
| 0-H  | Size 도메인 정렬 — Spec sizes에 xs 추가, delegation variables에 xl 추가                                   | LOW    | 3중 도메인 일치                   |
| 0-I  | Step 1 재실행 — 의미 있는 generated vs manual 비교                                                        | —      | 0-G/0-H 이후                      |

### 판정

Phase 1 Step 1은 "시험대 = 데이터 수집" 단계로 종료. `skipCSSGeneration: true` revert 후 증거는 본 섹션에 보존. 0-G부터 순차 착수.

## 0-G/0-H/0-I 실행 결과 (2026-04-14)

### 0-G — Variant 네이밍 정렬 (ADR-062 이후 축소됨)

- **판정**: ADR-062 Phase 1(merged e4bc102c)에서 Field variant 제거 완료 → CSS `primary/secondary/tertiary/error` 블록은 이미 삭제 상태
- **잔존 작업**: TextField.css `[data-variant="filled"]` 블록만 dead (wrapper 미전달) — 제거 완료
- **부수 정리**: 미사용 `--field-accent/-container/-on-accent` locals 제거
- **효과**: -30 lines

### 0-H — Size 도메인 3중 정렬

- **전**: Spec.sizes=sm/md/lg/xl / delegation variables=xs/sm/md/lg / CSS=xs/sm/md/lg/xl (3중 불일치)
- **후**: 전 도메인 xs/sm/md/lg/xl 5사이즈 일치
- **변경**: Props 타입 확장, `xs` sizes 추가 (height:18/paddingX:4/text-2xs/gap:2), 3개 delegation에 `xl` 추가
- **부수 수정**: hint-size md/lg 값을 수동 CSS 기준(text-sm/text-base)으로 정렬

### 0-I — Phase 1 Step 1 재측정

- **Generated**: 153 lines. 5사이즈 base + delegation(tf-label/input/hint) × 5 + focus-visible/disabled states + forced-colors
- **Manual**: 151 lines
- **남은 gap**:

| #   | 항목                                                    | 현재 지원 | 필요 기능                              |
| --- | ------------------------------------------------------- | --------- | -------------------------------------- |
| 1   | `width: fit-content` base                               | ❌        | CompositionSpec 확장 또는 새 필드      |
| 2   | `[data-label-position="side"]` grid override            | ❌        | containerVariants 신규                 |
| 3   | `[data-quiet="true"]` block (4 selector)                | ❌        | containerVariants 신규                 |
| 4   | `.react-aria-Input` hover/focus/invalid/disabled        | ❌        | DelegationSpec.states 신규             |
| 5   | Bridge 변수 (`--label-font-size ← --tf-label-size` × 6) | ❌        | DelegationSpec.bridges 신규            |
| 6   | `[slot="description"]` + `--error-font-size`            | ❌        | 추가 delegation childSelector + bridge |

### 판정

- 구조적 블로커 3개 → **1개**(State/Composition 계약 부재, MEDIUM) 로 축소
- Size/Variant 도메인 완전 정렬 달성 (이전 2대 블로커 해제)
- **Phase 1 진입 불가** — 0-D (CSSGenerator 확장) 선행 필수

## 0-D 확장 로드맵 (Phase 1 진입 조건)

6개 gap을 리스크 오름차순으로 4 step 분할:

| Step  | 작업                                                                                              | 리스크 | 영향 파일                                          |
| ----- | ------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| 0-D.1 | DelegationSpec.bridges — size별 변수 → 다른 변수명으로 재노출                                     | LOW    | spec.types, CSSGenerator                           |
| 0-D.2 | CompositionSpec 추가 delegation 허용 (`[slot=...]` 지원)                                          | LOW    | 현재도 childSelector 자유형, 확인만 필요할 수 있음 |
| 0-D.3 | CompositionSpec.containerVariants — `data-quiet`, `data-label-position` 등 컨테이너 selector 분기 | MEDIUM | spec.types, CSSGenerator, 6개 Field spec           |
| 0-D.4 | DelegationSpec.states — 자식 요소 상태 selector (`[data-focused]` 등)                             | MEDIUM | spec.types, CSSGenerator, deriveAuto 확장 가능성   |

`width: fit-content`는 CompositionSpec.layout에 inline-flex-column 추가 또는 별도 필드로 처리 (0-D.1과 병합 가능).

## 롤백 전략

### Phase 단위 rollback

- 대상: 1개 Phase 분 spec 변경 + 삭제된 수동 CSS 파일 복원
- 방법: git revert (Phase 커밋 단위 분리 필수)

### Pre-Phase 0 실패

- 0-A~0-C 실패: 각 단계 revert 가능. 타입 확장 optional이므로 breaking 없음
- 0-D 실패 (CSSGenerator 확장 회귀): 확장 revert. Phase 1 진입 차단

### 최종 재승격 실패

- Phase 5 grep 0건 불충족 시: 개별 잔존 컴포넌트 해체로 분할
