# ADR-168: Frame Preset 반응형 재구성 — 프리셋 카탈로그 · 반응형 계약 · 패널 재설계

## Status

Proposed — 2026-07-26

## Context

### 문제

Frame preset 9개 중 **6개가 mobile(390px)에서 깨진다.** 컨테이너 정의값 기준 실측:

| 프리셋             | 정의              | mobile 390 결과     |
| ------------------ | ----------------- | ------------------- |
| sidebar-left/right | `row` + `250px`   | 콘텐츠 140px        |
| holy-grail         | `200px 1fr 200px` | 고정폭 합 400 > 390 |
| complex-3col       | `1fr 2fr 1fr`     | 좌우 97px           |
| dashboard          | `240px 1fr`       | 콘텐츠 150px        |
| dashboard-widgets  | `200px 1fr 280px` | 고정폭 합 480 > 390 |

정상은 `fullscreen` / `vertical-2` / `vertical-3` 3개뿐이며, 셋 다 flex column 이라 폭에 무관하다. `dashboard-widgets` 는 tablet(768)에서도 콘텐츠가 288px 로 압박된다.

원인은 단일하다 — `LayoutPreset.containerStyle` 이 **단일 값**이라 breakpoint 개념이 없고, `usePresetApply` 는 base `props.style` 만 쓰고 `node.responsive` 를 건드리지 않는다.

### SSOT 3-domain 소속

**해당 없음 — 빌더 시스템 UI(builder-system) layer.** Frame preset 은 사용자 캔버스 컴포넌트가 아니라 오소링 표면이며, catalog/spec/Generator 확장이 없다. ADR-163(빌더 패널 표준 구조)과 같은 위상이다.

단 아래 §"선행 ADR 전제 개정" 이 `packages/shared` 의 반응형 SSOT 를 수정하므로, 그 파급은 D3 소비자(builder Skia · publish CSS)에 걸친다.

### 선행 ADR 전제 개정 (본 ADR 이 base 를 수정함)

ADR-154 개정 1 은 breakpoint override 대상을 `RESPONSIVE_ELIGIBLE_STYLE_PROPS` 로 정의하고, 이를 **"Style 패널 Layout·Transform 섹션이 편집하는 키 전수"** 와 정확히 일치시켰다 (정적 가드 `responsiveEligible.static.test.ts`).

이 전제는 _breakpoint override 의 write 주체가 Style 패널 하나뿐_ 이라는 당시 조건의 부산물이다. 프리셋이 두 번째 write 주체가 되면 **"편집 UI 가 있는가"** 와 **"breakpoint 별로 달라져야 하는가"** 는 분리된다. grid 트랙은 편집 UI 가 없지만 BP 별로 반드시 달라져야 한다.

본 ADR 은 이 전제를 자동 승계하지 않고 명시적으로 개정한다. 따라서 순수 응용이 아니라 **base 개정을 포함하는 혼합형** 이다 (fork checkpoint 4질문 lock-in: design breakdown §1).

### Hard constraints (측정 가능)

| ID  | 제약                                                                           | 측정                   |
| --- | ------------------------------------------------------------------------------ | ---------------------- |
| HC1 | 모든 프리셋 × 3 BP 에서 고정폭 합 ≤ 뷰포트 폭                                  | 30 조합 실측, 초과 0건 |
| HC2 | 모든 프리셋 × 3 BP 에서 콘텐츠 슬롯 폭·높이 > 0                                | 30 조합 실측           |
| HC3 | 프리셋 A→B→A 교체가 멱등 (`style`+`responsive` 가 A 최초 적용 상태와 동일)     | 실측 diff 0            |
| HC4 | 기존 반응형 드리프트 가드의 보호 강도 불변 (명시 선언 없는 키가 eligible 불가) | 정적 테스트            |
| HC5 | publish 산출물이 `@media` 규칙으로 반응형 유지                                 | export CSS grep        |
| HC6 | Canvas 60fps / type-check 회귀 0                                               | 기존 성능 기준         |

### Soft constraints

- 카탈로그에 M3 canonical layout 3종 중 **feed / list-detail 2종이 없다.** 반면 `holy-grail` 과 `complex-3col` 은 컬럼 폭만 다른 사실상 동일 구조다.
- 패널이 함께 재설계 대상이다. 실측 결함 인벤토리(design breakdown §2-2): 썸네일 좌표 이중 진실(P-1) · 원시 토큰 15곳으로 인한 **다크모드 미추종 결함**(P-2/P-3) · 카테고리 하드코딩으로 인한 크래시원(P-4) · 아이콘 중복 정의(P-5) · dead CSS(P-6) · BP 미리보기 UI 부재(P-7).
- 특히 P-1 은 breakpoint 도입 시 **9벌 → 27벌 손좌표**가 되어 관리가 붕괴한다. 반응형 도입의 전제조건이다.

### 레퍼런스 조사 (사용자 요청)

네 출처가 동일 원칙으로 수렴한다 — **좁은 폭에서 사이드바를 줄이지 않고 다른 것으로 바꾼다.**

| 출처              | 내용                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Material Design 3 | canonical 3종(feed/list-detail/supporting pane). 목록 고정폭 + 상세 유동. 좁아지면 pane 세로 스택. 네비게이션은 bottom bar → rail → 상시 drawer 로 **형태 교체** |
| Apple HIG         | split view 는 regular 폭 전용, compact 에서 미성립. "iPad 는 사이드바, iPhone 은 탭 바"                                                                          |
| Wroblewski 5패턴  | column drop(폭 부족 시 컬럼을 세로로) / off-canvas(보조 콘텐츠를 화면 밖으로)                                                                                    |
| Framer / Webflow  | layout template 이 BP 별 독립 커스터마이즈. 데스크톱 네비 → 모바일 햄버거                                                                                        |

## Alternatives Considered

### 대안 A: grid 유지 + 반응형 eligibility 확장 (채택)

컨테이너를 desktop·tablet 에서 grid 로 두고 트랙만 BP 별로 재정의, mobile 에서만 `display: grid → flex column` 으로 전환. grid 8키를 override 대상에 추가한다.

- 위험: 기술(LOW) — `display`/`flexDirection` 은 이미 eligible + 캐시 키 + 엔진 full-rebuild 트리거. grid 키 추가는 집합 확장 1건
- 위험: 성능(LOW) — BP 전환 시에만 full rebuild. desktop 경로 비용 0 (resolve 가 identity 반환)
- 위험: 유지보수(LOW) — 프리셋 정의가 3 BP 계약의 단일 소스. 정적 테스트로 계약 확증 가능
- 위험: 마이그레이션(LOW) — 기존 프레임은 base style 이 그대로 남아 레이아웃 유지. 롤백은 집합에서 8키 제거

### 대안 B: 전 프리셋을 중첩 flex 로 재작성 (기각)

grid 를 버리고 모든 레이아웃을 중첩 flex 로 표현. `flexDirection` 만으로 reflow 하므로 인프라 변경이 전혀 없다.

- 위험: 기술(MEDIUM) — Holy Grail 은 `body(column) > [header, row-wrapper > [sidebar, content, aside], footer]` 가 되어 **슬롯 트리가 평면에서 2단 중첩으로 바뀐다.** 현행 슬롯은 전부 body 직계이며, 중첩 슬롯은 Slot 모델·`collectExistingFrameSlots`·drop 대상 판정 전반에 파급
- 위험: 성능(LOW)
- 위험: 유지보수(HIGH) — wrapper 가 슬롯도 프리셋 슬롯도 아닌 제3의 노드가 되어, 사용자에게 보이는 트리에 의미 없는 컨테이너가 생긴다. 이름 없는 노드를 사용자가 지우면 레이아웃이 붕괴
- 위험: 마이그레이션(MEDIUM) — 기존 프레임의 평면 슬롯 트리를 중첩으로 변환해야 함

### 대안 C: 반응형을 프리셋 밖 별도 시스템으로 (기각)

프리셋은 desktop 형태만 정의하고, BP 별 동작은 별도 "반응형 규칙" UI 로 사용자가 지정.

- 위험: 기술(LOW)
- 위험: 성능(LOW)
- 위험: 유지보수(MEDIUM) — 프리셋과 반응형 규칙이 분리돼 프리셋 교체 시 규칙의 유효성을 별도 관리
- 위험: 마이그레이션(LOW)
- **기각 사유는 위험이 아니라 문제 미해결** — 제기된 문제가 "프리셋이 기본 상태에서 mobile 에 안 맞는다" 인데, 이 대안은 프리셋을 여전히 깨진 상태로 두고 복구 책임을 사용자에게 넘긴다

### 대안 D: 프리셋 정의에서 렌더 시점에 BP 스타일 조회 (기각)

`node.responsive` 에 기록하지 않고, `appliedPreset` 키로 프리셋 정의를 렌더 시점에 조회.

- 위험: 기술(MEDIUM) — layout / Skia / DOM / publish 4경로에 신규 읽기 경로 추가
- 위험: 성능(LOW)
- 위험: 유지보수(HIGH) — 사용자가 BP 별로 손댄 값과 프리셋 정의가 합성되지 않음. `appliedPreset` 이 stale 이면 무반영
- 위험: 마이그레이션(LOW)
- **결정적 기각 사유**: publish 경로가 `responsive` 를 읽어 `@media` 를 생성하므로(`responsiveCss.ts:101-121`), 문서에 기록하지 않으면 **배포 산출물이 반응형이 아니게 된다** (HC5 위반)

### Risk Threshold Check

| 대안     | 기술   | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| -------- | ------ | ---- | -------- | ------------ | ----- |
| A (채택) | LOW    | LOW  | LOW      | LOW          | 0     |
| B        | MEDIUM | LOW  | **HIGH** | MEDIUM       | 1     |
| C        | LOW    | LOW  | MEDIUM   | LOW          | 0     |
| D        | MEDIUM | LOW  | **HIGH** | LOW          | 1     |

**루프 판정: 불필요.** 대안 A 가 4축 전부 LOW 이며 HIGH+ 0건이다. C 도 HIGH+ 0건이나 문제를 해결하지 못해 기각됐다 — 위험이 낮다는 것과 요구를 충족한다는 것은 별개다.

## Decision

**대안 A 채택** — grid 를 유지한 채 반응형 eligibility 를 프리셋 authoring 축까지 확장하고, mobile 에서만 flex column 으로 전환한다. 카탈로그를 레퍼런스 기반으로 재구성하고, 프리셋 패널을 전면 재설계한다.

> 구현 상세: [168-frame-preset-responsive-restructure-breakdown.md](design/168-frame-preset-responsive-restructure-breakdown.md)

### 채택 근거

1. **4축 전부 LOW.** 인프라 3요소(BP 전환 캐시 무효화 / `display` 변경 full rebuild / canonical `responsive` 보존)가 이미 배선돼 있음을 착수 전 실측했다 (design breakdown §2-3).
2. **publish 까지 자동으로 따라온다.** `node.responsive` 기록은 `responsiveCss.ts` 가 `@media` 로 변환하므로 빌더와 배포 산출물이 같은 소스에서 나온다.
3. **사용자 편집과 합성된다.** 프리셋이 쓴 override 는 일반 요소의 override 와 같은 형식이라, 적용 후 사용자가 BP 별로 손댈 수 있다.
4. **슬롯 트리가 평면으로 유지된다.** 슬롯이 grid 배치와 flex 크기를 병기하고 컨테이너 `display` 하나가 어느 쪽이 유효한지 결정하므로, 중첩 wrapper 가 필요 없다. mobile override 가 대부분 컨테이너 한 줄로 끝난다.

### 전제 개정 명시

`RESPONSIVE_ELIGIBLE_STYLE_PROPS` 를 두 집합의 합집합으로 분할한다.

- `SECTION_EDITABLE_RESPONSIVE_PROPS` — Style 패널이 편집하는 32키 (ADR-154 개정 1 의 원래 집합)
- `PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS` — 프리셋만 authoring 하는 grid 8키 (편집 UI 없음)

드리프트 가드는 **약화되지 않는다.** 단일 단언을 2개로 분리하되(섹션 키 ≡ SECTION_EDITABLE, 차집합 ≡ PRESET_AUTHORED), 논리곱은 원래 단언보다 약하지 않다 — 어떤 키도 명시 선언 없이 eligible 이 될 수 없다.

UI 오염이 없음을 확인했다: `ResponsiveSection` 의 "Add override" picker 는 eligible 집합을 순회하지 않고 자체 목록을 쓴다(`ResponsiveSection.tsx:43-46`). grid 8키는 편집 UI 에 노출되지 않는다.

### 기각된 대안의 기각 사유

| 대안 | 기각 사유                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------- |
| B    | 슬롯 트리를 평면에서 중첩으로 바꿔 이름 없는 wrapper 노드가 사용자 트리에 노출된다 (유지보수 HIGH) |
| C    | 프리셋을 깨진 상태로 두고 복구 책임을 사용자에게 넘겨 제기된 문제 자체를 해결하지 못한다           |
| D    | 문서에 기록하지 않으면 publish 산출물이 반응형이 아니게 된다 (HC5 위반)                            |

### 카탈로그 결정

9 → 10 (신규 2 / 삭제 1). 카테고리 `sidebar` → `navigation` 리네임 + `list` / `feed` 신설.

| 카테고리   | 프리셋                                      |
| ---------- | ------------------------------------------- |
| basic      | fullscreen / vertical-2 / vertical-3        |
| navigation | sidebar-left / sidebar-right                |
| list       | **list-detail** (신규 — M3 canonical)       |
| feed       | **feed** (신규 — M3 canonical, Pinterest형) |
| complex    | holy-grail (`complex-3col` **삭제**)        |
| dashboard  | dashboard / dashboard-widgets               |

`complex-3col` 은 `holy-grail` 과 컬럼 폭만 다른 동일 구조라 흡수한다. 기존 프레임은 body `props.style` 에 grid 정의가 이미 저장돼 **레이아웃이 유지되고** "적용됨" 배지만 사라진다 — 파괴적 변경이 아니다.

`repeat()` / `minmax()` 는 사용하지 않고 트랙을 명시 나열한다. 2026-07-25 실측에서 `minmax(60px, auto)` 가 비정상값(슬롯 폭 1920 / header 570)을 냈다.

## Risks

| ID  | 위험                                                                                          | 심각도 | 대응                                                                                                               |
| --- | --------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------ |
| R1  | 프리셋 교체 시 이전 프리셋의 responsive override 잔존 → 비멱등                                |  HIGH  | `stripPresetContainerStyle` 의 responsive 판 신설. **base·responsive 정리 대상을 같은 상수에서 파생** (G2 로 확증) |
| R2  | mobile flex 전환 시 슬롯의 grid 배치 속성 잔존                                                |  MED   | flex 가 무시하므로 무해하나 DOM·Skia 양쪽 실측 (G1)                                                                |
| R3  | 엔진 grid 함수 표현 신뢰도 미확인                                                             |  MED   | `repeat`/`minmax` 미사용, 트랙 명시 나열로 회피 (§Decision)                                                        |
| R4  | 썸네일 파생 함수가 실제 레이아웃과 어긋남 — 이중 진실을 옮기기만 한 결과                      |  MED   | G3 — 썸네일 비율 ↔ 실측 bounds 비율 대조를 Gate 로 강제                                                            |
| R5  | `LAYOUT_STYLE_KEYS` 4키 보강 누락 시 tablet override 가 캐시 히트로 흡수 (ADR-156 R6 과 동형) |  MED   | Phase 1 에 포함 + G1 tablet 조합 실측이 검출                                                                       |
| R6  | `complex-3col` 삭제로 기존 프레임의 "적용됨" 배지 소실                                        |  LOW   | 레이아웃 자체는 유지. dev 단계라 BC migration 미수행                                                               |

잔존 HIGH 위험 1건(R1) — G2 로 관리한다.

## Gates

| Gate | 시점         | 통과 조건                                                                                | 실패 시 대안                                                             |
| ---- | ------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G1   | Phase 5      | 10 프리셋 × 3 BP = **30 조합** 실측: 고정폭 합 > 뷰포트 0건 + 콘텐츠 슬롯 폭·높이 0 없음 | 실패 프리셋의 BP 계약 재산정. 3회 초과 실패 시 해당 프리셋 카탈로그 제외 |
| G2   | Phase 5 (R1) | 프리셋 A→B→A 교체 후 `style`+`responsive` 가 A 최초 적용 상태와 **정확히 동일**          | 정리 대상 상수 단일화 재점검. 미해소 시 교체를 "전체 재적용" 으로 축소   |
| G3   | Phase 5 (R4) | `derivePreviewAreas` 산출 비율 ↔ 실측 bounds 비율 일치                                   | 파생 실패 프리셋은 썸네일에 근사 표기 명시                               |
| G4   | Phase 1      | 드리프트 가드 2단언 통과 + 명시 선언 없는 키가 eligible 될 수 없음 (HC4)                 | 집합 분할 철회, 단일 집합 유지 + 프리셋을 flex 전용으로 축소             |
| G5   | Phase 4      | 프리셋 썸네일이 light/dark 양쪽에서 테마 추종 (P-2 결함 해소)                            | 시맨틱 토큰 매핑 재선정                                                  |
| G6   | Phase 5      | publish 산출 CSS 에 `@media` 규칙 생성 (HC5)                                             | 프리셋 반응형을 빌더 전용으로 격하하고 publish 경로 별도 판정            |
| G7   | 각 Phase     | `pnpm type-check` 0 회귀 + 관련 vitest PASS (HC6)                                        | 해당 Phase 롤백                                                          |

## Consequences

### Positive

- 프리셋 9개 중 6개의 mobile 결함과 1개의 tablet 압박이 해소된다. 사용자가 프리셋을 고른 직후부터 3 BP 전부에서 쓸 수 있다.
- 빌더와 배포 산출물이 같은 소스(`node.responsive`)에서 나온다 — publish 가 자동으로 `@media` 를 얻는다.
- 프리셋이 쓴 override 가 일반 요소 override 와 동형이라, 적용 후 사용자가 BP 별로 이어서 편집할 수 있다.
- 썸네일 이중 진실(9벌 손좌표, BP 도입 시 27벌)이 제거되고 프리셋 정의가 단일 소스가 된다.
- 다크모드에서 프리셋 썸네일만 흰 카드로 튀던 결함이 해소된다.
- 카테고리 하드코딩 제거로 신규 카테고리 추가 시 크래시원(`groups[category].push` undefined 접근)이 사라진다.
- M3 canonical layout 3종 중 누락됐던 feed / list-detail 이 채워진다.

### Negative

- `RESPONSIVE_ELIGIBLE_STYLE_PROPS` 가 "편집 UI 가 있는 키" 와 1:1 이 아니게 된다. 두 집합의 의미 구분을 이후에도 유지해야 하며, 신규 키 추가 시 어느 집합인지 판정하는 부담이 생긴다.
- 프리셋 정의가 커진다 (BP 별 override + 슬롯이 grid·flex 속성 병기). 정의 파일 가독성이 낮아진다.
- `complex-3col` 을 쓰던 기존 프레임은 "적용됨" 배지를 잃는다 (레이아웃은 유지).
- 슬롯이 두 레이아웃 모드의 속성을 동시에 들고 있어, 정의만 읽고 "지금 어느 쪽이 유효한가" 를 알려면 컨테이너 `display` 를 함께 봐야 한다.
- `derivePreviewAreas` 가 레이아웃 계약의 두 번째 소비자가 된다 — 엔진과 별개 구현이라 어긋날 여지가 생기고, G3 로 상시 관리해야 한다.
