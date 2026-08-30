# ADR-200: 명령·메뉴 라벨 locale 해소

## Status

Implemented — 2026-08-30 (Phase 0~5 당일 완결)

| Phase | 상태              | commit      | 내용                                                                               |
| ----: | ----------------- | ----------- | ---------------------------------------------------------------------------------- |
|     0 | Implemented 08-30 | `a9f4903a4` | 인벤토리 freeze + Gate RED 기준선 + 표시 계층 테스트 provider 래핑 (7파일 47 렌더) |
|     1 | Implemented 08-30 | `e2b40e650` | `contextMenu.*` 25 카탈로그 + G1 게이트                                            |
|     2 | Implemented 08-30 | `c72794853` | `label` → `labelKey`, 표시 계층 3곳 `t()` 해소, G2 게이트 (**Phase 4 흡수**)       |
|     3 | Implemented 08-30 | `068402d5f` | `command.*` 72 + `commandPalette.*` 16, `i18n` 필드 제거, 소비 3곳, G3 게이트      |
|     4 | Phase 2 에 흡수   | `c72794853` | 레지스트리 `label(): {en,ko}` → `labelKey(): {key, params?}`                       |
|     5 | Implemented 08-30 | (본 커밋)   | 게이트 전수 GREEN + Live Exercise + closure                                        |

리뷰 round 1: MEDIUM 4 · LOW 1 전부 fixed → round 2 이슈 0건 승인. 기록: [reviews/200.md](../reviews/200.md)

## Context

빌더의 언어 설정이 `en-US` 인 세션에서 캔버스 우클릭 메뉴가 `복사 / Copy`, `여기에 붙여넣기 / Paste here`, `삭제 / Delete` 로 그려진다. 같은 화면의 다른 chrome 은 설정을 따른다 (`More actions` / `Action bar options` / `Menu`). 액션 바는 메뉴 항목에서 파생되므로 `aria-label` 까지 병기를 물려받고, 명령 팔레트와 툴팁은 `def.i18n?.ko || def.description` 이라 locale 과 무관하게 **한국어를 우선**한다.

원인은 라벨이 번역되지 않아서가 아니라, **라벨의 언어를 고르는 지점이 표시 계층 밖에 4곳으로 흩어져 있고 그중 어느 것도 locale 을 읽지 않는** 데 있다. 컨텍스트 메뉴 provider 는 `.ts` 순수 모듈이라 `useI18n` 훅을 쓸 수 없어 (`components/overlay/contextMenu/types.ts:6-7` 이 JSX 불가를 명시) ADR-182 가 병기 리터럴로 우회했고, 그 우회가 ADR-192 액션 바와 ADR-199 레지스트리로 그대로 번졌다.

**Hard Constraints**:

1. `DEFAULT_LOCALE = "en-US"` (`i18n/locales.ts:34`) 인데 라벨 채널 4개 중 locale 을 읽는 것은 **0개** — 병기 16 (`canvasContextMenuProviders.ts:141~483`), 한국어 단독 8 (`elementAlignment.ts:245-256`, `elementDistribution.ts:284-291`), ko 우선 72 (`keyboardShortcuts.ts` `i18n.ko` × 소비 3곳), 표면별 고정 4 (`componentSemanticsActions.ts:123~192`).
2. 번역 SSOT 는 `localizedStrings` 단일 카탈로그 (`translations.ts:1331`, ko 문자열 leaf 402, 소비 파일 56) 이고, 접근자는 `@react-aria/i18n` 의 `useLocalizedStringFormatter` 를 감싼 **훅 전용** `t` 뿐이다 (`I18nProvider.tsx:90-100`). 비-훅 접근자는 없다.
3. `translations.ts` / `i18n/types.ts` 에 `contextMenu` 문자열은 **0회** — 메뉴용 키 자체가 없다.
4. `i18n/i18nWiring.static.test.ts:20-26` 이 손수 만든 `getTranslation(locale, key)` + `replacePlaceholders` 경로의 **부활을 금지**한다. 과거 그 경로를 걷어내고 RAC formatter 로 단일화한 결정의 게이트다.
5. 라벨은 영속 데이터가 아니다 — canonical document 에 저장되지 않으므로 사용자 프로젝트 재직렬화 **0건**. 하위 호환 비용은 `label` 을 읽는 테스트 **10파일** (Phase 2 5 · Phase 3 2 · Phase 4 3 — 목록은 breakdown §5) 과 스크린리더 텍스트 변경에 한정된다.

**Soft Constraints**:

- ADR-182 (메뉴) / 192 (액션 바) / 195 (팔레트) / 196 (명령 metadata) / 199 (시맨틱 액션 레지스트리) 가 이미 반영돼 있어, 라벨 축만 갈아끼우고 **노출 축 (항목·순서·가용성) 은 건드리지 않아야** 한다.
- ko 카탈로그에 없는 신규 키 118개의 번역은 기존 병기 리터럴의 한국어 절반을 그대로 옮기면 대부분 채워진다.

**SSOT 3-domain 귀속**: 본 ADR 의 대상은 **빌더 chrome 의 문자열**이라 D1 (DOM/접근성 — RAC) · D2 (Props/API — RSP) · D3 (시각 스타일 — catalog) 어디에도 속하지 않으며 경계를 교차하지 않는다. 캔버스 컴포넌트의 렌더 결과는 변하지 않는다. Spec/Generator 확장 ADR 이 아니므로 "Generator 가 자식 selector/variant emit 을 지원하는가" 항목은 해당 없음.

## Alternatives Considered

### 대안 A: 렌더 시점 번역 (`labelKey` + 표시 계층 해소)

- 설명: `ContextMenuItem.label: string` 을 `labelKey: string` (+ `labelParams?`) 로 바꾼다. provider·레지스트리는 **문자열을 갖지 않고 키만** 싣고, `ContextMenuOverlay` / `ContextualActionBar` / 속성 패널 / 팔레트가 `useI18n().t` 로 해소한다. `SHORTCUT_DEFINITIONS.i18n.ko` 는 `command.*` 키로 이관하고 필드를 제거한다.
- 근거: Figma·VS Code 의 메뉴 계층이 명령 정의에는 id 만 두고 표시 계층에서 nls 로 해소하는 구조와 같다. 프로젝트 내부에도 선례가 있다 — `PanelToggleGroup` 은 `getPanelLabel`, `DataTablePanel` 은 `datatable.${key}` 로 이미 키 → 표시 계층 해소 형태다 (`i18nWiring.static.test.ts:67,79`).
- 위험:
  - 기술: MEDIUM — 표시 계층 4곳 + provider/레지스트리 스키마 변경. 새 메커니즘은 없고 기존 훅 경계 안이다.
  - 성능: LOW — 메뉴가 열릴 때 항목 수(≤20)만큼의 카탈로그 조회. 카탈로그는 재사용, 번들 증가는 키 118개 문자열.
  - 유지보수: LOW — 정의 지점 4 → 1. 새 항목은 키만 추가하면 4표면이 같이 따라온다.
  - 마이그레이션: MEDIUM — `label` 제거는 `ContextMenuItem` 의 공개 형태 변경이라 소비 2곳과 테스트 10파일이 함께 바뀐다.

### 대안 B: 모듈 레벨 접근자 (`translate(locale, key)`)

- 설명: i18n 에 훅이 아닌 `translate(locale, key)` 를 두고 provider 가 직접 호출해 완성된 문자열을 싣는다. 항목 형태 (`label: string`) 는 그대로.
- 근거: `localizedStrings` 가 평범한 모듈 export 라 기술적으로 즉시 가능하다.
- 위험:
  - 기술: **HIGH** — 카탈로그에는 인자를 받는 함수형 메시지가 섞여 있어 (`translations.ts:1268-1330`) RAC formatter 의 계약을 두 번째 구현으로 복제해야 한다. 그리고 이것은 `i18nWiring.static.test.ts:20-26` 이 명시적으로 금지한 `getTranslation(locale, key)` 경로의 부활이다 — 게이트를 되돌려야 통과한다.
  - 성능: LOW — 조회 비용 동일.
  - 유지보수: **HIGH** — 훅 경로와 비훅 경로가 영구 공존해 "이 화면은 어느 쪽이 정본인가" 를 매번 판단해야 한다. locale 상태를 provider 호출부가 따로 들고 다녀야 하므로 stale locale 경로가 새로 생긴다.
  - 마이그레이션: LOW — provider 만 고치면 되고 항목 형태·테스트가 유지된다.

### 대안 C: 조립 시점 주입 (`ContextMenuDeps.t`)

- 설명: `buildContextMenuItems(request, deps)` 의 `deps` 에 `t` 를 실어 provider 가 조립하며 번역한다. 호출부 2곳 (`useContextMenu.tsx:108`, `buildActionBarItems.ts:32`) 이 React 안이라 주입이 가능하다.
- 근거: 기존 `deps.modeOverride` 와 같은 주입 통로가 이미 있다.
- 위험:
  - 기술: MEDIUM — 주입 통로가 이미 있어 구조 변경은 작다.
  - 성능: LOW — 동일.
  - 유지보수: MEDIUM — `deps` 는 선택 인자라 (`deps: ContextMenuDeps = {}`) **주입을 빠뜨려도 타입이 통과**한다. 누락은 화면에 키 문자열이 노출되는 런타임 결함으로만 드러나고, 새 소비 표면이 생길 때마다 같은 함정이 반복된다.
  - 마이그레이션: LOW — 항목 형태 유지, 테스트는 `t` 스텁만 추가.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | MED  | LOW  | LOW      | MED          |     0      |
| B    | HIGH | LOW  | HIGH     | LOW          |     2      |
| C    | MED  | LOW  | MED      | LOW          |     0      |

루프 판정: HIGH 0 인 대안이 2개 (A·C) 존재하므로 추가 대안 탐색 불필요. CRITICAL 없음.

## Decision

**대안 A (렌더 시점 번역)** 를 선택한다.

선택 근거:

1. **번역해야 할 지점이 타입으로 드러난다** — `label` 필드를 없애면 문자열을 그리던 모든 자리가 컴파일 오류가 되어 표시 계층 전수가 한 번에 열거된다. 다만 `labelKey` 도 `string` 이라 **키를 번역하지 않고 그대로 그리는 것까지 타입이 막지는 않는다** — 그 잔여는 G2 의 정적 조항 (표시 계층이 `labelKey` 를 `t()` 없이 렌더하지 않는다) 과 G5 가 맡는다. C 는 이 열거 자체가 없고, `deps` 가 선택 인자라 주입 누락이 새 소비 표면마다 조용히 재발한다 (`buildActionBarItems.ts:29` 의 `deps: ContextMenuDeps = {}` 가 지금도 그 형태다).
2. **잔존 MEDIUM 위험이 유한하고 1회성이다** — 마이그레이션 MEDIUM 은 `ContextMenuItem` 소비 2곳과 `label` 을 읽는 테스트 10파일에 한정되며, 사용자 프로젝트 재직렬화는 0건이다 (Context HC5).
3. **정의 지점이 4 → 1 로 줄고 새 채널이 생기지 않는다** — provider·레지스트리·정렬 유틸·`ShortcutDefinition.i18n` 이 전부 키만 들게 되어 "표면마다 다른 문자열" 의 재발 자리가 사라진다. 라벨 축을 표시 계층으로 옮겨도 ADR-199 가 세운 **노출 축** (`surfaces` / `isAvailable` / 순서) 은 그대로다.

기각 사유:

- **대안 B 기각**: `i18nWiring.static.test.ts:20-26` 이 금지한 `getTranslation(locale, key)` 경로의 부활이다. 그 게이트는 손수 만든 번역 경로를 걷어내고 RAC formatter 로 단일화한 결정의 집행 장치이므로, 이를 되돌리는 것은 본 ADR 이 없애려는 "채널이 하나 더 생기는" 문제 그 자체다.
- **대안 C 기각**: 문자열이 다시 provider 를 통과하므로 병기/단일 선택이 provider 로 되돌아온다 — 지금 결함의 형태를 그대로 유지한 채 언어만 맞추는 셈이다. 주입 누락이 타입으로 막히지 않는 점도 A 보다 약하다.

> 구현 상세: [200-command-label-locale-resolution-breakdown.md](../design/200-command-label-locale-resolution-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                               | 심각도 | 대응                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 카탈로그에 없는 키를 쓰면 `t()` 가 키 문자열을 그대로 돌려줘 (`I18nProvider.tsx:98` catch) 화면에 `contextMenu.copy` 가 노출 — 메뉴 (`ContextMenuOverlay.tsx:121,164`) · 액션 바 aria-label (`ContextualActionBar.tsx:83,145`) · 팔레트 (`CommandPalette.tsx:260`) 3경로 모두 조용히 깨진다                                                                        |  HIGH  | G1 — 코드가 참조하는 라벨 키 전수가 ko/en 양쪽 카탈로그에 있는지 정적 게이트                                                                     |
| R2  | 병기 리터럴이 다른 provider·표면에서 되살아남 (ADR-182 → 192 → 199 로 번진 전례)                                                                                                                                                                                                                                                                                   |  MED   | G2 — provider 에 `한글 / English` 패턴 0 정적 게이트                                                                                             |
| R3  | `ShortcutDefinition.i18n` 제거 시 팔레트·툴팁 2종 (`CommandPalette.tsx:260`, `ShortcutTooltip.tsx:79`, `ActionTooltip.tsx:64`) 라벨 소실                                                                                                                                                                                                                           |  MED   | G3 — `i18n?.ko \|\| description` 패턴 0 + 필드 부재 정적 게이트, Phase 3 에서 3곳 동시 전환                                                      |
| R4  | 액션 바 `aria-label` 이 병기에서 단일 언어로 바뀌어 스크린리더 읽는 텍스트가 달라짐                                                                                                                                                                                                                                                                                |  LOW   | 의도된 변경. Live Exercise 에서 두 locale 모두 확인                                                                                              |
| R5  | ADR-199 레지스트리 `label` 스키마 변경으로 199 가 세운 테스트 30건 (12+7+11) 이 흔들림                                                                                                                                                                                                                                                                             |  MED   | Phase 4 에서 199 게이트를 같은 커밋에 재정렬. 노출 축 필드는 불변이므로 정적 게이트 자체는 유지                                                  |
| R6  | 신규 키 118개 중 ko 번역 품질 편차                                                                                                                                                                                                                                                                                                                                 |  LOW   | 기존 병기 리터럴의 한국어 절반을 그대로 이관 — 새로 번역하는 것은 `command.*` 중 `i18n.ko` 없는 항목뿐                                           |
| R7  | 표시 계층 4곳 중 `ContextualActionBar` 만 이미 `useI18n` 을 쓰고 나머지 3곳은 훅이 없다. 그 테스트가 `I18nProvider` 없이 렌더 중이라 훅을 넣는 순간 throw 한다 (`useI18n.ts:38-40`). **Phase 2 실측 — 대상 7파일 47 렌더**: Phase 0 이 `label` 참조를 기준으로 3파일 34 렌더만 잡았고, 실제 기준은 표시 계층 **마운트** 라 4파일 13 렌더가 더 있었다 (evidence §4) |  MED   | Phase 0 에서 세 테스트를 provider 래핑으로 선행 전환 (또는 `useOptionalI18n` — `useI18n.ts:46-50` 이 격리 렌더 용도로 존재). G4 통과 조건에 편입 |

HIGH 위험은 R1 1건이며 G1 과 1:1 대응한다. 본 ADR 은 phase 6개 / 위험 7개로 별도 ADR 분리가 필요한 규모가 아니다 — 라벨 축 하나를 4채널에서 걷어내는 단일 작업이고, 채널별로 쪼개면 중간 상태에서 표면마다 다른 언어가 되는 구간이 생긴다.

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                | 실패 시 대안                                                          |
| ---- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| G1   | Phase 1·2·4 각 종료 | 정적 테스트 — 코드가 참조하는 라벨 키 전수가 `localizedStrings["ko-KR"]` · `["en-US"]` 양쪽에 존재 (누락 0)                                                                                              | 키 추가 후 재실행. 미해소 시 해당 표면 전환 보류                      |
| G2   | Phase 2·3·4 각 종료 | 정적 테스트 2조항 — (a) `canvasContextMenuProviders.ts` 에 `한글 / English` 병기 리터럴 0, (b) 표시 계층 4파일이 `labelKey` 를 `t()` 없이 렌더하는 JSX 0 (미번역 키 노출 차단 — Decision 근거 1 의 잔여) | 잔존 리터럴을 키로 전환 / 미번역 렌더 지점을 `t()` 경유로 수정        |
| G3   | Phase 3 종료        | 정적 테스트 — `i18n?.ko \|\| description` 패턴 0, `ShortcutDefinition` 에 `i18n` 필드 부재                                                                                                               | 소비 3곳 전환 완료까지 Phase 3 미종료                                 |
| G4   | 매 phase 종료       | `pnpm type-check` 0 + `label` 을 읽는 테스트 10파일 PASS (Phase 0 의 provider 래핑 전환 7파일 47 렌더 포함)                                                                                              | 실패 원인 수리 후 재실행 (pre-push 훅과 Stop hook type-check 가 집행) |
| G5   | Phase 5             | Live Exercise — `en-US` 에서 메뉴·액션 바·팔레트 전 항목 영어, `ko-KR` 전환 후 한국어. Chrome MCP 로 실행하고 본문에 기재                                                                                | 실패 시 Implemented 승격 보류 (`adr-status-sync-check.sh` 가 block)   |

### Live Exercise

2026-08-30, Chrome MCP · `localhost:5173` 실행 빌더. 같은 프로젝트를 `en-US` 와
`ko-KR` 로 각각 열어 4표면을 모두 exercise 했다 (G5).

| 표면                         |                                                                                                                       `en-US` |                                                                                          `ko-KR` |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------: | -----------------------------------------------------------------------------------------------: |
| 캔버스 우클릭 메뉴           | Copy · Paste here · Duplicate · Bring to Front · Bring Forward · Send Backward · Send to Back · Create component · Delete (9) | 복사 · 여기에 붙여넣기 · 복제 · 맨 앞으로 · 앞으로 · 뒤로 · 맨 뒤로 · 컴포넌트 만들기 · 삭제 (9) |
| 메뉴 `aria-label`            |                                                                                                                "Context menu" |                                                                                  "컨텍스트 메뉴" |
| 액션 바 `aria-label`         |                                                              Duplicate · Create component · More actions · Action bar options |                                                  복제 · 컴포넌트 만들기 · 더 보기 · 액션 바 옵션 |
| 명령 팔레트 (63항목)         |                                                                                     Undo / System / "Available on the canvas" |                                             실행 취소 / 시스템 / "캔버스에서 실행할 수 있습니다" |
| ActionTooltip (History undo) |                                                                                                                     "Undo ⌘Z" |                                                                                   "실행 취소 ⌘Z" |
| 속성 패널 보간               |                                                                                                        "Select instances (1)" |                                                                              "인스턴스 선택 (1)" |

팔레트는 라벨(`command.*`) · 카테고리(`commandPalette.category*`) · scope 힌트
(`commandPalette.scope*`) 세 축이 모두 따라왔다. 툴팁 항목은 호출부가 `tooltip`
을 주지 않아 `command.<id>` 로 파생되는 경로다 — Phase 3 이 바꾼 그 경로다.

정적 게이트: G1 3 tests · G2 3 tests · G3 3 tests 전부 GREEN. G4 — `pnpm type-check`
0 error + 전체 617 파일 4,959 tests PASS (실패 0).

## Consequences

### Positive

- `en-US` 세션에서 우클릭 메뉴 · 액션 바 · 명령 팔레트 · 툴팁이 설정된 언어로 그려진다 — 지금은 4표면 모두 설정을 무시한다.
- 라벨의 정의 지점이 4채널에서 `localizedStrings` 1곳으로 모인다. 새 메뉴 항목은 키 1개 추가로 4표면이 동시에 따라온다.
- `ShortcutDefinition.i18n` (72항목, 소비처가 locale 을 안 읽던 필드) 이 사라져 명령 metadata 가 노출·실행 축 (ADR-195/196) 만 남긴다.
- 언어 추가 (`ja` 등) 가 카탈로그 파일 하나의 작업이 된다 — 지금은 provider·유틸·레지스트리를 함께 고쳐야 한다.

### Negative

- `ContextMenuItem` 의 공개 형태가 바뀌어 (`label` → `labelKey`) 항목을 만드는 모든 코드와 `label` 을 읽는 테스트 10파일이 함께 바뀐다.
- 라벨이 표시 시점에 해소되므로 provider 단위 테스트만으로는 사용자가 보는 문자열을 확인할 수 없다 — 표시 계층 테스트와 G1 정적 게이트가 그 역할을 나눠 갖는다.
- 스크린리더가 읽는 액션 바 텍스트가 병기에서 단일 언어로 바뀐다.
- 정적 게이트 3종이 늘어 CI 실행 시간이 소폭 증가한다.
