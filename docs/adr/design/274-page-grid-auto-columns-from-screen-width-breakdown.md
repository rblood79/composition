# ADR-274 breakdown — 페이지 grid auto 열 수 = 모니터 폭 · 기준 배율

> 본문: [ADR-274](../completed/274-page-grid-auto-columns-from-screen-width.md). 이 문서는 Phase · 파일 · 검증의 구현 상세다.

## 1. 전제 lock-in

- **분류**: ADR-232 의 2026-09-23 후속 (`columns: "auto"`) 의 입력 변경이다. fork · 분리가 아니고 의존 방향 변화도 없다. ADR-232 본체 (배치 = 레이아웃 파생) 는 그대로다.
- **schema**: `PageLayoutSettingsDocument` 에 필드 하나를 추가하고, 기존 `columns` 형태는 유지한다. 필드 부재 = 40 %, 이관 코드 없음.
- **사용자 확정**: gap 장면 좌표 (대안 A) · 패널 = Auto % + Fixed 개수 (tier override 유지) · 기본 40 % (Status 원문 인용).

## 2. 손계산 표 (G1 oracle)

계산식은 `floor((모니터 폭 / 기준 배율 + gap) / (페이지 폭 + gap))` 이고, 결과는 1 ~ 24 로 제한한다. 페이지 폭은 Desktop 1920 · Tablet 768 · Mobile 390 이다.

| 모니터 · 배율 · gap | Desktop | Tablet              | Mobile              |
| ------------------- | ------- | ------------------- | ------------------- |
| 1440 · 40 % · 80    | 1       | 4                   | 7                   |
| 1920 · 40 % · 80    | 2       | 5                   | 10                  |
| 2560 · 40 % · 80    | 3       | 7                   | 13                  |
| 2560 · 50 % · 80    | 2       | 6                   | 11                  |
| 2560 · 50 % · 0     | 2       | 6                   | 13                  |
| 2560 · 50 % · 320   | 2       | 5                   | 7                   |
| 2560 · 10 % · 80    | 12      | 24 (계산 30 · 상한) | 24 (계산 54 · 상한) |

## 3. Phase

### Phase 0 — inventory freeze · 기준 카운트 (G0)

- 본문 F1 ~ F10 의 경로 · 줄을 다시 grep 한다.
- 다음 기준 카운트를 기록한다:
  - breakpoint 전환 한 번 · gap 편집 한 번당 `computeLayout` 횟수 (F5 · F6 의 2 회 실측). dev 카운터가 없으면 Phase 0 에서 `docCounters` 에 추가한다.
  - 줌 `translateCalls` · `pageGridMovedRoots` (위 A/B 의 auto 값).
- 하니스 `--page-columns N` (1 ~ 24, app-pages · many-pages 전용) 은 작성일에 준비했다 (미커밋). ratchet run 키 `@cols{N}` · `harnessArgsFrom` 재현 인자 · parseArgs 검증 테스트를 포함하며, Phase 0 커밋에 넣는다. 남은 LOW 2 건 (seed 가 기존 `pageLayout` 을 합치지 않음 · 이미 seed 된 문서에서는 열 수를 쓰지 않음) 은 하니스가 늘 새 격리 project 에 seed 하므로 보류한다.
- 하니스에 `--screen WxH` 를 추가한다 (Playwright context `screen`). 모니터 폭을 독립 입력으로 두기 위해서다.

### Phase 1 — 파생 (shared · runtime · Canvas)

| 파일                                                                  | 변경                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types/catalog-style.types.ts`                    | `PageLayoutSettingsDocument.autoFitZoom?: number` 추가 (%, 부재 = 40). `columns` 주석을 「모니터 폭 · 기준 배율 파생」 으로 다시 쓴다                                                                                                                                                    |
| `packages/shared/src/catalog/runtime/pagePlacement.ts`                | `resolveAutoColumns(screenWidth, fitZoom, trackWidth, gap)` 로 바꾼다 (zoom 인자 삭제). `resolvePageLayout(pageLayout, breakpoint, screenWidth)` 가 tier 의 gap · 트랙 폭으로 직접 계산하고, `lastAutoColumns` 는 같은 자리에서 쓴다. `DEFAULT_PAGE_LAYOUT_AUTO_FIT_ZOOM = 40` 상수 추가 |
| `packages/shared/src/catalog/runtime/compositionRoot.ts`              | 옵션 `autoColumns` → `screenWidth`. `setAutoColumns` → `setScreenWidth(width)` (같은 값이면 false, 바뀌면 레이아웃 + frame 이동 여부). `pageLayout()` 이 `screenWidth` 를 넘긴다                                                                                                         |
| `apps/builder/src/builder/catalogRuntime/workspace.ts`                | `autoColumns` 필드 → `screenWidth`. `createRoot` 가 새 tier 에서 같은 모니터 폭으로 바로 파생 (F5 두 번째 패스 제거)                                                                                                                                                                     |
| `apps/builder/src/builder/catalogRuntime/pageLayoutSettings.ts`       | `catalogAutoColumns` 삭제 (파생이 root 안으로). view 에 `autoFitZoom` 추가 · change `{ kind: "autoFitZoom"; percent }`                                                                                                                                                                   |
| `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx` | `syncAutoColumns` → `syncScreenWidth`: `window.screen.width` 정수 비교만. `readCanvasRailInset` · zoom 의존 제거                                                                                                                                                                         |
| `apps/builder/src/builder/workspace/canvas/scene/pagePlacement.ts`    | `input.autoColumns` 소비자를 새 입력으로 맞춘다                                                                                                                                                                                                                                          |

- tier override 는 사용자 결정 1 의 답을 따른다. 기본안이면 `responsive` 에 `autoFitZoom` 을 넣지 않는다.
- unit 은 기존 `phase4ePageLayout` · `phase4PageFrames` · `phase4eCanvasScene` · `scene/pagePlacement.test.ts` 옆에 둔다:
  - 손계산 표 (§2)
  - zoom 변화에 `setScreenWidth` 호출 0
  - breakpoint 전환 · gap · `autoFitZoom` 편집 1 회 = `computeLayout` 1 회
  - 페이지 드래그 칸이 화면 열 수와 같음
- 원복 RED 2 가지: zoom 을 입력에 되살리기, `createRoot` 에 옛 열 수 넘기기.

### Phase 2 — Settings 패널

| 파일                                                         | 변경                                                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/panels/settings/SettingsPanel.tsx` | 열 칸의 단위 목록을 `["", "%"]` 로 바꾼다. `%` = Auto (값 = 기준 배율), 단위 없음 = Fixed 개수. 키워드 `auto` 입력 → `40%`. 범위는 사용자 결정 2. tier override 스위치는 Fixed 에서 지금과 같다 |
| i18n (`settings.pageColumns` 근처)                           | Auto 안내: 「이 배율로 줌아웃하면 모니터 한 폭에 들어가는 만큼 — 모니터마다 다를 수 있음」 (R1)                                                                                                 |
| `SettingsPanel.pageLayout.test.tsx`                          | `40%` 표시 · % 편집 명령 · `auto` 입력 · Fixed 개수 · tier override 무변경                                                                                                                      |

### Phase 3 — 측정 · ratchet · live (G2 ~ G5)

- **G2**: `--fixed-inputs` 의 `zoom` · `zoom-ladder` 를 잰다 (many-pages 100 `@zoom0.1` · `app-pages`). `translate*` · `pageGridMovedRoots` = 0 을 확인하고 `perf-ratchet-gate.mjs --update` 로 하향한다. 오른 키는 run 별 표로 정리해 사용자 결정 3 에 올린다.
- **G3**: 기준 (`674304ad0` 또는 Phase 0 커밋) ↔ 변경을 교대 2 쌍으로 잰다. 대상은 줌 taskMs · long task, 그리고 불리한 경우인 breakpoint 전환 · gap 편집 · `--screen 1920x1080 ↔ 2560x1440` total 이다.
- **G4**: production 짝 (`pnpm perf:build-dist` · `--serve-dist`).
- **G5**: Chrome MCP 로 사용자 프로젝트를 연다. 본문 G5 시나리오를 실행하고 `### Live Exercise` 에 적는다.
- **문서**: 본문 Status · 이 문서 §4 · README · CHANGELOG (사용자-가시 변경).

## 4. 기록

### 2026-10-18 — Phase 0 ~ 3 종결 (Implemented)

**Phase 0 (G0)**
- F1 ~ F10 은 HEAD `674304ad0` 와 일치했다. inventory 보강 2 건: 문서 타입은 `catalog/document/types.ts:374` `PageLayoutDeclaration` 이고 (`catalog-style.types.ts` 는 runtime 변환 대상), 검증은 `validation.ts:966` `pageLayout` 의 `exact` 키 목록이다. 둘 다 `autoFitZoom` 을 받게 했다.
- 기준 카운트: 줌 `translateCalls` 977 (app-pages) · 1,036 (`@zoom0.1`) · 998 (`@zoom0.25`) · 5,170 (many-pages 100) · 14 (600). `computeLayout` 2 회 (F5 · F6) 는 dev 카운터 대신 unit 으로 고정했다. 엔진 `computeLayout` 호출 수를 세는 wrapper 와, 전환 · 편집 뒤 `setScreenWidth` 가 0 회인지 보는 단언이다.
- 하니스: `--page-columns` (작성일 준비분) + `--screen WxH` (run 키 `@screen{W}x{H}` · 재현 인자) + G3 불리 부류 `breakpoint-switch` · `grid-gap-edit`. 테스트 39/39.

**Phase 1 (파생)**
- `resolvePageLayout(layout, tier, screenWidth)` 가 tier 의 gap · 트랙 폭으로 열 수를 직접 낸다. `resolveAutoColumns` 의 식은 그대로이고, 입력만 (보이는 폭, zoom) → (모니터 폭, 기준 배율) 이다. 모니터 폭이 없으면 `lastAutoColumns` 를 쓴다.
- root `screenWidth` 옵션과 `setScreenWidth` 가 들어왔다. 열 수가 그대로면 레이아웃을 돌지 않는다. workspace 는 새 root 에 현재 모니터 폭을 넘기고, `CatalogBuilderCore` 는 첫 root 에 `window.screen.width` 를 준다. Canvas 의 `syncScreenWidth` 는 `window.screen.width` 정수 비교 하나다.
- 지운 것: `catalogAutoColumns` · `setAutoColumns` · Canvas 의 zoom · rail inset 입력. `readCanvasRailInset` (`viewport/canvasChromeInset.ts`) 은 production 소비자가 0 이 됐다. 파일 삭제는 별도 승인 대상이라 남겨 두었다.
- 사용자 결정 1 (breakpoint 공통): `breakpoints.*` 에 `autoFitZoom` 을 두지 않는다. 검증은 10 ~ 100 밖을 `INVALID_AUTO_FIT_ZOOM` 으로 거부하고, 명령은 경계값으로 맞춰 쓴다.
- unit:
  - 손계산 표 §2 의 7 행 × 3 tier
  - 모니터 변경 · 같은 열 수면 레이아웃 0
  - breakpoint 전환 · gap · 배율 편집 뒤 두 번째 패스 0
  - 검증 거부 3 (5 · 101 · NaN)
  - Canvas 프레임 검사가 zoom · Canvas 폭 · rail 을 읽지 않는다 (정적)
- 원복 RED 2:
  - 프레임 검사에 zoom 을 되살리면 정적 테스트 RED.
  - 새 root 에 현재 모니터 폭을 안 넘기면 breakpoint 테스트 RED. 처음 강도로는 통과로 남았다 — 처음 연 모니터와 같은 폭으로만 전환했기 때문이다. 모니터를 바꾼 뒤 전환하는 경우를 더해 RED 를 확인했다.

**Phase 2 (패널)**
- 열 수 칸의 단위는 `["", "%"]` 다. `%` = Auto (값 = 기준 배율), 단위 없음 = Fixed 개수다. `auto` 를 치면 저장된 배율 (부재 = 40) 의 Auto 가 된다.
- 단위 메뉴는 지금 숫자를 그대로 싣는다. 그래서 같은 숫자 + 다른 단위는 모드 전환으로 읽는다: Fixed → `%` 는 저장된 배율, Auto → 단위 없음은 지금 그려진 열 수 (`catalogPageColumnsChange`).
- 사용자 결정 2 (10 ~ 100 %): 칸의 min · max 는 1 ~ 100 이고, 단위별 범위는 명령이 맞춘다.
- live 에서 결함 1 을 찾았다: 단위 입력이 빈 단위를 첫 비키워드 단위로 대체했다. 목록에 `""` 가 있으면 대체하지 않도록 고쳤다 (RED unit).
- R1 안내 문구는 넣지 않았다 (LOW deferred). 이 칸 (`PropertyUnitInput`) 에는 값 반응 문구 자리 (`afterControl`) 가 없고, 패널 규칙이 정적 설명 문단을 막는다 (panel-structure.md §1 「필드 상태 문구」). 의미는 단위 suffix `%` 와 i18n 라벨 그대로 둔다.

**Phase 3 (G2 ~ G5)**
- G2 (dev, headless 1440): ratchet 8 run 의 줌 부류 `translateCalls` · `translateNodes` · `pageGridMovedRoots` = 0.
  - 사용자 결정 3 으로 A 키 49 개를 올렸다 (25 + 24, 만료 2027-04-18).
    - 줌 갱신 사유 이동: `missReasons.invalidate` 50 → 0 대신 coverage · zoom 사유 · `contentRedrawsOutOfPad` · hits 가 늘었다. surface miss 합계는 66 → 49.
    - 시작 배치 변경 4 개 (many-pages page-jump evictions · edit 미리 기록 3): headless 1440 · 40 % 에서 Desktop 1 열이 됐다. `--page-columns 1` 로 두 arm 을 같은 배치로 맞추면 기준 = 변경이다 (evict 1,233 · warm 331 / 6).
    - 600 줌의 content 전체 렌더 43 → 49: 교대 2 쌍에서 taskMs 426 / 425 → 408 / 409 · p99 18.3 → 18.6 ms.
  - 하향 261 (줌이 없는 run 4 개 포함 — 그쪽 A 초과 0) · 새 B 지표 106. B 경고 5 개는 같은 원인이고 경고 전용이다.
- G3 (dev, 기준 `674304ad0` worktree 5174 ↔ 변경 5173, 교대 2 쌍, DPR 1 · 1440 × 900 · visible):

  | 부류 | 기준 taskMs · long · p99 | 변경 |
  | --- | --- | --- |
  | many-pages 100 줌 | 2,758 / 2,682 · 7 / 8 · 52 ms | 902 / 894 · 0 · 17.6 ms |
  | app-pages 줌 (모니터 1440 · 1920 · 2560) | 1,072 ~ 1,126 · 0 · 22 ~ 25 ms | 530 ~ 696 · 0 · 17.7 ms |
  | breakpoint 전환 (불리) | 3,338 / 3,293 · 9 | 3,305 / 3,239 · 9 |
  | gap 편집 (불리) | 3,757 / 3,631 · 11 | 3,799 / 3,622 · 11 |
  | 편집 (1920 · 2560) | 147 ~ 174 | 117 ~ 129 |

  breakpoint 전환의 long task 9 는 root 재생성 비용이고 이 ADR 범위 밖이다. 두 번째 패스가 없어진 몫 (translate 186 → 0) 은 노이즈 폭 안이다.
- G4 (production `--serve-dist`, 교대 2 쌍): many-pages 줌 2,497 / 2,456 → 870 / 872 · p99 49.9 / 49.2 → 17.6 / 17.7 ms · long task 4 / 3 → 0. app-pages 줌 1,009 → 541. breakpoint 전환 · 페이지 전환 · 편집의 p99 차이는 ±0.6 ms 안이다.
- G5: 본문 `### Live Exercise` (사용자 프로젝트, 6 시나리오 PASS, 결함 1 수리).
