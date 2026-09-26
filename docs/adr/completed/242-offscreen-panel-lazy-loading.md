# ADR-242: 초기 화면 밖 패널 lazy 분리 — history · settings · interactions · themes · datatable 목록 · 폰트 관리

## Status

Implemented — 2026-09-26 (Phase 0~~4 · G0~~G4 통과 · [Live Exercise](#live-exercise)) · Accepted — 2026-09-26 (사용자 "결정해야할 부분은 설계 본래 목적에 가장 맞는 패턴으로 결정해서 진행해" — 대안 A 채택 · 착수) · Proposed — 2026-09-26 (사용자 `/create-adr 패널 lazy 분리` — 출처: ADR-201 재승인 절 2026-09-25 사용자 판정 "재승인 + 패널 lazy 감량", "패널 lazy 분리는 새 ADR 로")

## Context

### 문제

Builder initial 번들이 승인 상한에 닿았다. ADR-201 재승인 상한 Builder ≤ **1,421,000** · Preview ≤ **623,000** B gzip (만료 2026-10-25) 에 대해 main `b18bba835` 실측이 Builder **1,420,999** (여유 1 B) · Preview 622,556 이다 (`adr209-bundle-closure.mjs`). 상한은 09-17 이후 세 번 올랐고 (1,328,315 → 1,415,000 → 1,421,000), 다음 사용자-가시 기능은 어떤 것이든 다시 재승인을 요구한다 — ADR-235 후속은 1 B 를 맞추려고 안내 토스트와 문구를 뺐다.

새 사용자의 기본 레이아웃은 모든 패널이 닫힌 상태다 (`layout/panelWorkspaceLayoutV4.ts:832-883` `initialVisibility = {}`). 패널 컴포넌트는 처음 열릴 때 mount 되지만 (`PanelWorkspace.tsx:497-520` `hasBeenPlaced`), JS 모듈은 12 패널 중 9 개가 initial 에 실린다:

- `panels/core/panelConfigs.ts:24-37` 가 패널 컴포넌트를 정적 import 한다. lazy 는 AI (`ai/lazyAIPanel.tsx`) 와 datatable 편집기 · 필드 (`panelConfigs.ts:44-49`, ADR-212 HC5) 셋뿐이다.
- `panels/index.ts:18-32` barrel 이 같은 컴포넌트를 정적 re-export 하고, `BuilderCore.tsx:55` 가 `import "../panels"` 로 값 import 한다.
- 폰트 관리 대화상자는 등록 패널이 아니라 Styles 패널의 `FontFamilyPicker.tsx:45` 가 정적 import 한다.

초기 화면 밖 패널의 initial 몫 (sourcemap 귀속 raw, gzip 아님): datatable 25,803 · themes 13,982 · history 11,643 · interactions 9,300 · fonts 7,711 · settings 3,730 — 합 72,169 raw B. 이 가운데 패널 밖 코드가 값으로 쓰는 모듈 (Canvas · BuilderCore · 바인딩 UI · AI 가 쓰는 store · hook · utils) 은 initial 에 남아야 한다 (breakdown §2).

선례: ADR-212 가 datatable 편집기를 `lazyPanel` 경계로 옮겨 initial gzip −15,859 B 를 얻었다. 반례: lazy chunk 가 initial 과 공용 모듈 (RAC · i18n · lucide 아이콘) 을 값 import 하면 번들러가 initial 공용 chunk 를 쪼개 오히려 늘었다 — ADR-217 Phase 6 +760 B, ADR-235 에서 세 번 (+108 · +278 · +411 B).

### SSOT 3-Domain 판정

D1 · D2 · D3 어느 것도 아니다. 빌더 chrome 의 번들 경계만 바꾼다 — 패널 DOM · ARIA (RAC 소관) · 컴포넌트 props · 캔버스/Preview 시각 결과 변경 0.

### Hard constraints

- **HC1 번들** — 대상 패널 구현 (breakdown §2 "lazy 로 보낼 것") 의 initial 귀속 바이트 0. Builder initial gzip Δ ≤ **−8,000 B**, Preview initial Δ ≤ 0 (같은 커밋 기준 별도 worktree clean 빌드 before/after).
- **HC2 동작 보존** — 패널을 여는 모든 경로 (레일 · 단축키 Alt+3/4/7/8 · Cmd+, · 커맨드 팔레트 · agent 명령 · 다른 패널이 여는 `setPanelWorkspacePanelVisibility` · Typography 의 폰트 관리 버튼) 가 그대로 동작하고, 닫은 패널의 상태 (`<Activity mode="hidden">`) 가 유지된다. 패널 id · persist 키 무변경.
- **HC3 첫 열림 지연** — production 빌드, 캐시 비운 cold 열기에서 레일 클릭 → 패널 내용 표시 p95 ≤ **300 ms** (CPU 4x throttle), 그동안 패널 골격 안 fallback 으로 자리 · 폭 · 포커스 불변.
- **HC4 로드 실패 격리** — chunk 로드 실패 (배포 교체 · 오프라인) 가 빌더 전체를 멈추지 않는다: 그 패널 안에 오류 + 다시 시도, 다른 패널 · Canvas 는 동작.

### Soft constraints

- 기존 경계 (`lazyPanel`) 와 가드 (`lazyPanelBoundary.static.test.ts`) 를 확장하고 새 메커니즘을 만들지 않는다.
- 패널 밖이 값으로 쓰는 모듈은 옮기지 않는다 (경계는 패널 UI 컴포넌트에서 끊는다) — 위치 이동은 이 ADR 의 목적이 아니다.

## Alternatives Considered

### 대안 A: 초기 화면 밖 패널만 `lazyPanel` 로 (핵심 저작 패널은 정적 유지)

- 설명: history · settings · interactions · themes · datatable 목록 패널을 `panelConfigs` 에서 `lazyPanel(() => import(...))` 로, barrel 정적 re-export 제거, `FontManagerDialog` 는 `FontFamilyPicker` 안에서 열 때 로드. navigator · properties · styles · components 는 정적 유지. `lazyPanel` 에 로드 실패 경계 추가. 외부 사례: VS Code 는 view · 확장 코드를 activation event (처음 보일 때) 에 로드하고, Chrome DevTools 는 패널마다 모듈을 첫 열림에 로드한다 — 자주 쓰는 핵심 표면만 즉시 싣는 같은 구분.
- 위험: 기술(L) / 성능(M) / 유지보수(L) / 마이그레이션(L)
  - 성능 M: 첫 열림 지연 (chunk 1 회 요청) · 공용 chunk 분리로 initial 이 오히려 늘 가능성 (선례 5 회) — 패널마다 Δ 측정 · 되돌리기로 관리

### 대안 B: 모든 패널 lazy + 부팅 뒤 idle prefetch

- 설명: navigator · properties · styles · components 까지 lazy (합 327,498 raw B 추가), 부팅 뒤 idle 에 전부 prefetch 해 첫 열림 지연을 가린다.
- 위험: 기술(M) / 성능(H) / 유지보수(M) / 마이그레이션(L)
  - 성능 H: 편집 세션 대부분이 곧바로 여는 패널이 매번 lazy 경로 — prefetch 전 선택 · 편집 시작이 spinner. properties · styles 는 Canvas · store 와 공용 모듈이 많아 공용 chunk 분리 폭이 가장 크다. idle prefetch 는 네트워크 · 파싱 비용을 부팅 직후로 옮길 뿐 줄이지 않는다
  - 유지보수 M: 선택 → 패널 표시 경로 (핵심 동선) 에 Suspense 경계가 들어가 포커스 · 레이아웃 흔들림 검증 범위가 커진다

### 대안 C: 상한 재승인 반복 (코드 변경 없음)

- 설명: 기능마다 Δ 를 기록하고 상한을 다시 올린다 (09-17 · 09-25 · 09-26 과 같은 방식).
- 위험: 기술(L) / 성능(H) / 유지보수(H) / 마이그레이션(L)
  - 성능 H: 초기 로드 목표 (< 3 초 · 초기 번들 < 500 KB — CLAUDE.md 성능 기준) 와 멀어지는 방향이 고정된다
  - 유지보수 H: 모든 사용자-가시 변경이 번들 판정 대기 — ADR-235 후속이 1 B 를 맞추려 UX (안내 토스트) 를 뺀 것이 비용의 실례

### 대안 D: 번들러 chunk 그룹 조정 (`codeSplitting.groups` · manualChunks)

- 설명: 패널 모듈을 별도 chunk 그룹으로 묶는다.
- 위험: 기술(M) / 성능(M) / 유지보수(M) / 마이그레이션(L)
  - 정적으로 도달 가능한 모듈은 chunk 를 나눠도 initial closure (script · modulepreload) 에 남는다 — initial 바이트는 거의 줄지 않고 요청 수만 는다

### Risk Threshold Check

| 대안 | HIGH+                  | 판정                                           |
| ---- | ---------------------- | ---------------------------------------------- |
| A    | 없음 (성능 M)          | 통과                                           |
| B    | 성능 H                 | A 가 HIGH 없이 목표 (HC1) 를 달성하므로 불필요 |
| C    | 성능 H · 유지보수 H    | 기각                                           |
| D    | 없음, 다만 HC1 효과 ~0 | 목표 미달로 기각                               |

HIGH 없는 대안 A 가 있어 루프 불필요.

## Decision

**대안 A 를 채택한다.** history · settings · interactions (`events`) · themes · datatable 목록 패널을 `lazyPanel` 로, 폰트 관리 대화상자를 첫 열림 로드로 옮긴다. 경계는 패널 UI 컴포넌트에서 끊고, 패널 밖이 값으로 쓰는 store · hook · utils (`themeActions.applyActiveThemeToRuntime` · datatable `dataTableEditorStore` · `useExecutionPolicyScheduler` · interactions `labels` · `FontFamilyPicker` 등) 는 initial 에 남긴다. `lazyPanel` 에 로드 실패 경계 (HC4) 를 더한다. **Phase 4 실측 뒤 보강**: Suspense fallback 이 한 번 그려지면 React 가 내용 공개를 ~300 ms 늦추므로 (G4 실측), 부팅 뒤 idle 에 대상 패널 chunk 를 미리 받고 (initial closure 밖) 받은 패널은 Suspense 없이 바로 그린다 — G4 실패 대안 (레일 hover/focus 선호출) 보다 단축키 · 팔레트 경로까지 덮는 쪽을 택했다. AI (100 KB) · datatable 편집기/필드는 첫 열림에 받는다.

**위험 수용 근거**: 남는 위험은 성능 M 둘이다. 첫 열림 지연은 대상이 초기 화면 밖 (새 사용자 기본 닫힘) 이고 chunk 가 작아 (패널당 raw 3~15 KB) HC3 으로 측정해 관리한다. 공용 chunk 분리는 패널마다 Δ 를 따로 재고, Δ ≥ 0 인 패널은 되돌리는 절차 (G1) 로 initial 증가를 원천 차단한다 — 최악의 결과는 "그 패널은 정적 유지" 다.

**기각 사유**:

- B: 핵심 저작 패널 (선택 즉시 여는 properties · styles) 이 lazy 경로가 되어 편집 시작 동선이 늦어지고, 공용 모듈이 가장 많은 패널이라 chunk 분리 위험이 가장 크다. HC1 은 A 로 충족된다.
- C: 번들 판정이 모든 기능의 병목이 된 현재 상태 자체가 문제다 — 재승인은 이 ADR 이 끝날 때까지의 임시 조치로만 남긴다.
- D: 정적 도달 모듈은 chunk 를 옮겨도 initial closure 에 남아 HC1 을 만족하지 못한다.

**범위 밖**: 상한 값 조정 (종결 뒤 ADR-201 재승인 절에서 사용자 판정) · 패널 밖 공용 모듈의 위치 이동 · navigator · properties · styles · components.

> 구현 상세: [242-offscreen-panel-lazy-loading-breakdown.md](../design/242-offscreen-panel-lazy-loading-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                    | 심각도 | 대응                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | lazy chunk 가 initial 과 공용 모듈 (RAC · i18n · lucide) 을 값 import 해 번들러가 initial 공용 chunk 를 쪼개 initial 이 늘어난다 — 선례 5 회 (ADR-217 +760, ADR-235 +108 · +278 · +411) |  HIGH  | G1 — 패널마다 before/after 측정 · initial 파일 목록 diff, Δ ≥ 0 이면 그 패널 되돌림 + 원인 기록 (`codeSplitting.groups` 조정은 기록 뒤 선택) |
| R2  | 숨은 정적 경로 (barrel named export 소비처 · 패널 밖 값 import · 새로 생기는 import) 가 구현을 initial 로 다시 끌어온다                                                                 |  MED   | G0 전수 · `lazyPanelBoundary.static.test.ts` 확장 (대상 구현을 panelConfigs · barrel · 패널 밖에서 값 import 하면 실패)                      |
| R3  | chunk 로드 실패 시 경계가 없어 (현재 ErrorBoundary 사용처 0) 빌더 전체가 멈춘다 — lazy 패널이 3 → 8 로 늘며 노출 확대                                                                   |  HIGH  | Phase 1 `lazyPanel` 로드 실패 경계 · G3                                                                                                      |
| R4  | 첫 열림 지연 · fallback 중 포커스/레이아웃 흔들림 (단축키로 열 때 포커스 대상이 아직 없음)                                                                                              |  MED   | G4 지연 측정 · 단축키 경로 live · 초과 시 레일 hover/focus 에서 loader 선호출                                                                |
| R5  | 패널 설정 소스를 텍스트로 읽는 정적 테스트 (`panelCloseActions.static.test.ts` · `shortcutDisplay.static.test.ts` · `panelConfigs.icon.static.test.ts`) 가 형태 변경에 깨진다           |  LOW   | 상수 이름 (`component: ThemesPanel`) 유지, 필요한 테스트만 형태 갱신                                                                         |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                     | 실패 시 대안                                                                                           |
| ---- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| G0   | Phase 0 종료        | 대상 6 의 패널 밖 값 import 전수 · `panels` barrel 소비처 전수 · 기준 측정 (Builder/Preview initial gzip, 대상별 raw 귀속, 첫 열림 기준) 기록                                                                                 | 누락 발견 시 목록 보강 후 재측정                                                                       |
| G1   | Phase 2 · 3 각 패널 | 그 패널 구현 initial 귀속 0 · 패널별 Builder Δ < 0 · Preview Δ ≤ 0 · initial 파일 목록에 새 공용 chunk 0. 종결 시 누계 Builder Δ ≤ −8,000 B                                                                                   | 그 패널 되돌림 (정적 유지) + 원인 기록. 누계 미달이면 남은 몫과 원인을 기록하고 상한 판정을 사용자에게 |
| G2   | Phase 4             | live: 대상 패널을 레일 · 단축키 · 커맨드 팔레트로 열기 · 닫았다 다시 열어 상태 유지 · 패널 간 여는 경로 (VariableList → properties · DataTableCreator → AI · 편집기 저장소 → 편집기/필드) · 폰트 관리 대화상자 · page error 0 | 경로별 수리                                                                                            |
| G3   | Phase 1             | chunk 로드 실패 주입 → 그 패널 안 오류 + 다시 시도 → 성공 시 내용 표시 · 그동안 Canvas 선택 · 다른 패널 동작                                                                                                                  | 경계 수리                                                                                              |
| G4   | Phase 4             | production 빌드 cold 첫 열림 p95 ≤ 300 ms (CPU 4x) · fallback 중 패널 자리 · 폭 불변 · 단축키로 연 뒤 포커스 정상                                                                                                             | 레일 hover/focus loader 선호출 추가 후 재측정                                                          |

### Live Exercise

production 빌드 (`vite build` → `vite preview --base /composition/` :4173 — preview 는 `command === "serve"` 라 config `base` 가 `/` 로 떨어져 `--base` 가 필요하다) 를 Playwright Chrome 153 · 새 프로젝트 · Compare Mode · Preview iframe 미개방으로 확인했다 (2026-09-26, `apps/builder/scripts/adr242-live.mjs`, 기록 `/private/tmp/adr242-live/`). Chrome MCP · 사용자 confirm 은 쓰지 않았다.

- **동작 7/7 (G2 · G3)**: L1 레일 클릭 → history · events · theme · datatable 실제 내용 (fallback 아님) · L2 Alt+8/7/4/3 토글 (열림 → 닫힘) + Cmd+, 설정 · L3 커맨드 팔레트 (Cmd+/ "history" Enter) → 패널 · L4 datatable 탭 전환 → 닫기 → 다시 열기 → 같은 탭 (`Activity` 유지) · L5 Text 요소 선택 → Styles 「텍스트」 탭 → Font Family → 「폰트 관리」 → 모달 (첫 클릭에 chunk) · L6 `HistoryPanel-*.js` 요청 차단 → 그 패널 안 `role=alert` + 다시 시도, Canvas · Properties (Alt+5) 정상 → 차단 해제 → 다시 시도 → 재요청 1 → 내용 · L7 page error 0.
- **첫 열림 지연 (G4, `--latency`, cold = HTTP 캐시 비움 + 새로고침 5 · warm 5, 레일 클릭 → 내용 가시)**: 선로드 전 실측은 cold · warm · CPU 1x · 4x 모두 **320~350 ms** (정적 대조군 properties 30~46) — 네트워크가 아니라 React Suspense 가 fallback 을 한 번 그린 뒤 내용 공개를 ~300 ms 늦추는 throttle 이었다. 부팅 뒤 idle 선로드 + 받은 패널은 Suspense 없이 렌더로 바꾼 뒤: 1x history 15 · events 17 · theme 37 · datatable 23 (properties 26) / **4x history 30 · events 28 · theme 88 · datatable 40 (properties 59)** ms p95 — 전 패널 ≤ 300 통과, 정적 대조군과 같은 급.
- **번들 (G1, in-tree clean 빌드 기준 `548845e93` = 1,420,999 / 622,556)**: Builder **1,403,816 (Δ −17,183)** · Preview **622,496 (Δ −60)**. 패널별 Δ — history −2,637 · settings −828 · interactions −1,771 · themes −2,678 · datatable −3,868 · fonts −423 (선로드 배선 뒤 chunk 재그룹으로 −4,978 추가). sourcemap 귀속 (대상 디렉토리 initial 잔여) — history 0 · settings 0 · interactions `labels` 817 · themes `themeActions` 1,908 · datatable store/hooks/utils 9,289 · fonts `FontFamilyPicker`/`useFontRegistry` 4,351 raw — 전부 패널 밖이 값으로 쓰는 모듈, 패널 구현 0.
- **live 에서 잡은 것 (수리)**: Suspense fallback throttle (위) · Chrome 이 실패한 module fetch 를 module map 에 기억해 다시 시도가 재요청 없이 즉시 실패 (재요청 0) → 다시 시도는 loader 재호출이 즉시 실패하면 새로고침으로 복구 · 커맨드 팔레트가 Enter 실행 뒤 열린 채 남아 레일 클릭을 가로막음 (하니스: 입력 포커스 Escape 로 닫음 — 제품 동작 여부는 사용자 확인 대상).
- **사용자 확인 대상**: 실제 프로필 (저장된 레이아웃에 lazy 패널이 열린 채 부팅 → 부팅 직후 chunk 로드) · Firefox · Safari 의 다시 시도 (실패 캐시 여부가 달라 새로고침 없이 복구될 수 있음) · production 에서 `/composition/assets/woff/*.woff` 폰트 디코드 경고 (preview 서버에서 관측 — 이 ADR 범위 밖, 기존 경로 문제 가능).
- **후속 (2026-09-26, 사용자 판정 "의도하지 않았다")**: 커맨드 팔레트가 남던 원인은 검색 입력과 목록이 이어져 있지 않은 것이다 — 입력에 포커스가 있는 동안 ↑↓ · Enter 가 목록에 닿지 않아 아무것도 실행되지 않았고 클릭만 동작했다 (dev 재현: Enter · ↓+Enter 모두 팔레트 유지 · 패널 안 열림). RAC `Autocomplete` 로 입력과 목록을 이어 수리 (타이핑하면 첫 결과에 가상 포커스 · ↑↓ 이동 · Enter 실행 뒤 닫힘 · 입력 있는 Escape 는 먼저 지우고 두 번째에 닫힘). unit 원복 RED 2 → GREEN, live dev 3 경로 (Enter · ↓+Enter · 클릭) 모두 실행 뒤 닫힘. Builder initial +9 B.
- **후속 — WebKit (Safari 엔진) 의 다시 시도 → 수리 (2026-09-26, 사용자 지시 "다음 사항 진행해")**: 수리 전에는 복구되지 않았다 — WebKit 은 실패한 `modulepreload` 를 메모리 캐시에 남겨 **새로고침 뒤에도** 같은 URL 의 `import()` 가 요청 없이 실패한다 (진단 `--probe`: 같은 URL `fetch` 200 · `import` 실패 · `?r=1` 을 붙인 `import` 성공, WebKit 의 알려진 결함). Vite 는 lazy chunk 를 불러올 때 chunk 자신과 하위 JS 를 `<link rel=modulepreload>` 로 함께 받는다 (빌드 산출물의 preload 목록에 `HistoryPanel-*.js` 자신이 있음). 수리: `vite.config.ts` `build.modulePreload.resolveDependencies` 가 동적 import 의 선요청을 CSS 만 남긴다. 실패 방식 3가지 (네트워크 실패 `--webkit` · 404 `--fail-404` · 서버 파일 제거 `--fail-disk`) × WebKit · Chrome 모두 다시 시도 → 새로고침 → 재요청 1 → 패널 내용. 같은 live 에서 나온 두 번째 결함: 패널 레이아웃 저장이 300 ms 디바운스라 그 안에 새로고침하면 방금 연 패널이 닫혀 있다 (WebKit L6 에서 재현) → `panelLayout.ts` 가 `pagehide` 에서 대기 중 저장을 즉시 쓴다 (즉시 저장 뒤 옛 대기값이 되돌려 쓰지 않게 함께). unit 원복 RED 2 → GREEN. 영향: Builder initial 1,403,825 → **1,401,576** (선요청 목록이 짧아짐) · Preview 622,496 → 622,126 · 첫 열림 지연 CPU 4x 최대 98 ms (기존 94 급) · 동작 7/7. Firefox 는 이 환경에서 실행 불가.
- **후속 — production Pretendard 폰트 → 수리 (ADR-235 · 이 ADR 과 무관한 기존 결함)**: `apps/builder/src/index.css` 의 `@import "pretendard/.../pretendard.css"` 가 builder `main-*.css` 에 URL 재작성 없이 인라인돼 `./woff2/` · `./woff/` 상대 경로가 404 (HTML 응답 → 디코드 경고) 였다. production 에서 정적 Pretendard 가 전부 오류라 builder UI 와 Canvas 2D 텍스트 측정이 **시스템 폴백 폰트**로 돌았다 (측정 `400 14px Pretendard` 폭: dev 223.446 · 수리 전 production 227.042, 400 과 500 이 같은 폭). dev 는 같은 CSS 를 정상으로 풀어 영향이 없었다. 수리: `main.tsx` 에서 JS import 로 싣는다 (Preview 와 같은 경로) → production 이 dev 와 같은 폭 · 폰트 응답 오류 0 · 경고 0.

## Consequences

### Positive

- Builder initial 에서 초기 화면 밖 패널 구현이 빠져 상한 여유가 생긴다 (목표 ≥ 8 KB gzip) — 다음 기능이 재승인 없이 들어올 공간.
- lazy 패널 로드 실패가 빌더 전체 중단이 아니라 패널 단위 오류가 된다 (기존 datatable 편집기 · AI 패널 포함).
- 패널 lazy 경계가 정적 가드로 고정돼, 이후 새 패널도 같은 경계를 기본으로 따른다.

### Negative

- 대상 패널의 첫 열림에 chunk 요청 1 회 (fallback spinner) — 오프라인 · 느린 망에서 체감.
- 패널 밖이 쓰는 모듈 (datatable store · themeActions · interactions labels) 은 initial 에 남아, 디렉토리 단위로 보면 경계가 "패널 UI" 와 "공용 로직" 사이로 갈린다 — 새 코드가 패널 UI 모듈을 패널 밖에서 값 import 하면 가드가 막는다.
- 요청 수 증가 (패널당 chunk 1+, CSS 포함).
