# ADR-274: 페이지 grid auto 열 수 = 모니터 폭 · 기준 배율 — 줌이 페이지 배치를 바꾸지 않는다

## Status

Implemented — 2026-10-18 (Proposed · Accepted 같은 날)

- 승격 근거: 사용자 `/execute-adr 274` (2026-10-18) + 아래 「사용자가 이미 답한 것」 3 건. 리뷰 기록 (`reviews/274.md`) 은 없다 — 사용자가 리뷰 없이 실행을 골랐다.
- 사용자 결정 (AskUserQuestion 2026-10-18):
  1. **기준 배율 = breakpoint 공통** (tier override 없음).
  2. **범위 10 ~ 100 %**.
  3. **ratchet A 키 상향**: 「25 개 --raise + 나머지 하향」, 이어서 다른 줌 run 의 「24 개도 --raise + 하향」.

> **Phase 0 ~ 3 (G0 ~ G5) 종결 2026-10-18** — 줌이 페이지 배치에서 빠졌다. 줌 중 page root 옮기기 `translateCalls` 977 ~ 5,170 → 0 (ratchet 8 run). production 짝 (교대 2 쌍): 페이지 100 개 문서 줌 taskMs 2,497 / 2,456 → 870 / 872 · p99 49.9 → 17.6 ms · long task 4 / 3 → 0, 22 페이지 문서 줌 1,009 → 541. breakpoint 전환 · gap 편집 · 페이지 전환 · 편집은 노이즈 폭 안. live (사용자 프로젝트 「123」, 모니터 1800) 에서 Fit · 100 · 200 % · 휠 줌 전후 배치 동일, 열 수가 손계산과 같음. live 중 단위 입력의 빈 단위 대체 결함을 찾아 고쳤다. 상세는 breakdown §4.

- 사용자 요청: `/create-adr` (2026-10-18). 직전 측정 (auto ↔ 6 열 고정 A/B) 에서 사용자 가설 「줌 p99 = auto 열 수 재배치」 가 확인된 뒤 나온 요청이다.
- 방향을 정한 사용자 원문:
  - 「zoom 40%일때 위치한 곳에서 더자세히 보기위해 확대를 했는데 auto로 인해 배치가 달라져 버린다. 원래 의도한 grid배치의 column 자동은 아니었다」
  - 「모니터 화면 크기와 breakpoint 크기로 coulmn의 count값을 구하면 zoom할때마다 page를 재계산하는 일은 없지 않을까? breakpoint 변경 할때만 발생하게되고 그부분도 최적화를 한다면?」
- 사용자가 이미 답한 것 (재질문 금지):
  1. **gap 은 장면 좌표 고정 (대안 A)**: 「A로 하겠다」. 화면 px 고정 gap (대안 D) 은 이 ADR 에서 다루지 않는다.
  2. **설정 패널은 Auto = % 입력, Fixed = 개수 (tier override 유지)**: 「제안하는 설정 패널대로 착수」. 질문은 「column 수동 값도 갯수가아니라 %로 변경해야하는것 아닌가? breakpoint따라 coulmn수가달라지니」 였다.
  3. **Auto 기본 40 %**: 「Auto 의 기본 40%」.
- 리뷰는 사용자가 요청할 때 `/review-adr 274` 로 하고 `reviews/274.md` 에 기록한다.

## Context

**Domain**: D1 · D2 · D3 무관. `pageLayout` 은 빌더 전용 project 필드이고 Preview/Publish 산출물과 관계가 없다 (`catalog-style.types.ts:695` 주석). 바뀌는 것은 Builder Canvas 의 페이지 배치 파생과 Settings 패널 입력뿐이다.

**관계**: [ADR-232](232-page-placement-as-layout-derivation.md) 는 「뷰포트에서 컨테이너 폭을 파생」 하는 안 (대안 D) 을 기각했다. 이유는 「zoom · 창 크기마다 칸이 바뀌면 위치가 문서 상태가 아니라 뷰 상태가 된다」 였다. 그 뒤 2026-09-23 사용자 요청으로 `columns: "auto"` 가 명시 모드로 추가됐다. 이 ADR 은 그 auto 의 입력에서 **줌과 창 크기를 빼고 모니터 폭만 남긴다**. 그래서 ADR-232 의 원칙에 더 가까워진다. ADR-232 본체 (배치 = 레이아웃 파생) 는 그대로 둔다.

### 코드 사실 (HEAD `674304ad0`)

| #   | 사실                                                                                                                                                                                                                                                                                        | 경로                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| F1  | auto 열 수 = `floor((보이는 폭 / zoom + gap) / (페이지 폭 + gap))`, 1 ~ 24 로 제한. 입력에 zoom 이 있다                                                                                                                                                                                     | `packages/shared/src/catalog/runtime/pagePlacement.ts:114 ~ 131` · `MAX_PAGE_LAYOUT_COLUMNS = 24` (`:53`)                          |
| F2  | Canvas 가 **매 프레임** 「Canvas 폭 − 패널 rail」 과 현재 zoom 으로 열 수를 계산해 `workspace.setAutoColumns` 에 넘긴다. 바뀌면 `scene.pageGridChanged()` (모든 page root 서브트리 옮기기 + 공간 인덱스 갱신) 와 `renderer.invalidateContent()` (전체 재기록)                               | `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx:815 ~ 841` · `catalogRuntime/pageLayoutSettings.ts:101 ~ 109` |
| F3  | `setAutoColumns` 는 root style 을 바꾸고 `computeLayout` 을 다시 돈 뒤, page frame 이 하나라도 움직였는지 돌려준다                                                                                                                                                                          | `packages/shared/src/catalog/runtime/compositionRoot.ts:3279 ~ 3291` · `workspace.ts:391 ~ 394`                                    |
| F4  | 트랙 폭 = 그 breakpoint 의 페이지 폭 (`CANVAS_VIEWPORT`): Desktop 1920 · Tablet 768 · Mobile 390. gap 기본 80 (`DEFAULT_PAGE_LAYOUT_GAP`), gap 과 columns 는 tier override 대상                                                                                                             | `canvasBreakpoints.ts:21 ~ 23` · `pagePlacement.ts:50 · 160 ~ 212`                                                                 |
| F5  | breakpoint 전환은 root 를 새로 만든다. 이때 **직전 tier 에서 계산한** `autoColumns` 를 넘긴다. 그 뒤 첫 프레임의 `syncAutoColumns` 가 새 트랙 폭으로 다시 계산하므로, 열 수가 다르면 레이아웃을 한 번 더 돌고 페이지를 옮기고 전체를 재기록한다. 코드상 tier 전환 한 번에 레이아웃이 2 회다 | `workspace.ts:188 ~ 207` (`:201`) · `:375 ~ 378` · `CatalogCanvas.tsx:840`                                                         |
| F6  | gap · columns 편집도 같다. 명령 step 의 레이아웃은 옛 열 수로 돌고, 다음 프레임의 `syncAutoColumns` 가 gap 이 바뀐 열 수로 다시 돈다                                                                                                                                                        | `CatalogCanvas.tsx:804 ~ 809` · `:826`                                                                                             |
| F7  | 편집 경로 (페이지 드래그의 점 → 칸) 는 뷰포트를 읽지 않고 직전 파생이 쓴 열 수 (`lastAutoColumns`) 를 물려받는다                                                                                                                                                                            | `pagePlacement.ts:137 · 191 ~ 195` · `compositionRoot.ts:3215 ~ 3222`                                                              |
| F8  | 문서 형태: `columns?: number \| "auto"` (부재 = auto) · `responsive.columns` tier override. 기준 배율 필드는 없다                                                                                                                                                                           | `packages/shared/src/types/catalog-style.types.ts:697 ~ 724`                                                                       |
| F9  | Settings 패널: 열 수 칸은 단위 목록 `["", "auto"]` 의 `PropertyUnitInput` (1 ~ 24) 이고, Tablet · Mobile 에서 tier override 스위치를 보인다                                                                                                                                                 | `apps/builder/src/builder/panels/settings/SettingsPanel.tsx:137 ~ 146 · 203 ~ 225` · `pageLayoutSettings.ts:41 · 54 ~ 93`          |
| F10 | 빌더 최소 줌 0.1 (`minZoom={0.1}`)                                                                                                                                                                                                                                                          | `nodePictureWarmup.ts:43`                                                                                                          |

### 실측 (2026-10-18, dev headless · DPR 1 · 1440 × 900 · `--fixed-inputs` · 시작 zoom 0.1 · auto ↔ 6 열 고정 교대)

auto 열 수는 zoom 1 · 0.5 · 0.25 · 0.15 · 0.12 · 0.1 에서 1 · 1 · 2 · 4 · 5 · 6 열이다.

| 지표 (`zoom` 부류)                               | auto                                    | 6 열 고정      |
| ------------------------------------------------ | --------------------------------------- | -------------- |
| many-pages 100: 서브트리 옮기기 `translateCalls` | 5,170 (노드 1,159,327 · upsert 449,617) | 0              |
| many-pages 100: taskMs                           | ~2,700                                  | ~1,415 (−48 %) |
| many-pages 100: 표시 간격 p99 · long task        | 53 ms · 8 개                            | 31 ms · 0 개   |
| `app-pages` 22: taskMs · 최대 간격               | 1,063 ms · 30 ms                        | 706 ms · 19 ms |

고정 열은 비용이 사라지지만 화면이 다르다 (zoom 1 에서도 6 열). 그래서 「고정으로 바꾸기」 는 답이 아니고, auto 의 입력을 바꿔야 한다.

### 제약

- **hard**:
  - 줌 중 페이지 배치 변경 0 (사용자 지적의 본체).
  - 줌 중 `translateCalls` · `pageGridMovedRoots` 0 (결정적 카운트, ratchet).
  - breakpoint 전환 한 번에 레이아웃 1 회.
  - Canvas cadence 기준 (CLAUDE.md §성능 기준) 회귀 0.
- **soft**:
  - 저장된 문서의 `columns` 값 형태 유지 (`number | "auto"`).
  - 문서 이관 코드 넣지 않음 (메모리 `feedback-no-document-migration-code-dev-stage`). 필드 부재 = 기본값.

## Alternatives Considered

### 대안 A: 모니터 폭 + 기준 배율 (%) 로 auto 열 수 — 줌 독립

- **설명**: auto 열 수 = `floor((모니터 폭 / 기준 배율 + gap) / (페이지 폭 + gap))`, 1 ~ 24.
  - 모니터 폭은 `screen.width` (CSS px) 다.
  - 기준 배율은 문서의 새 필드이고 기본 40 % 다.
  - 열 수는 root 의 `pageLayout()` 파생 안에서 계산한다. 그래서 breakpoint 전환 · gap · 기준 배율 편집이 **같은 레이아웃 한 번**에 반영된다 (F5 · F6 의 두 번째 패스 제거).
  - Canvas 는 모니터 폭만 넘긴다.
  - Fixed (개수 + tier override) 는 그대로다.
- **업계**: Figma 는 frame 을 world 좌표에 두고 줌으로 다시 흘리지 않는다. 배치는 줌과 무관한 문서 상태다.
- **위험**: 기술 L / 성능 L (줌 경로에서 재배치 trigger 가 사라진다) / 유지보수 L / 마이그레이션 M (기존 auto 문서는 처음 열 때 배치가 바뀐다. 의도된 변경이다)

### 대안 B: 지금 식 유지 + 줌이 끝났을 때만 열 수 갱신 (settle)

- **설명**: 줌 제스처 중에는 열 수를 붙들고 제스처가 끝나면 한 번 다시 흘린다.
- **위험**: 기술 L / 성능 M (제스처 끝마다 전체 옮기기 + 재기록이 1 회 남는다) / 유지보수 M (제스처 끝 판정이 휠 · 핀치 · 버튼마다 다르다) / 마이그레이션 L
- **사용자 문제를 못 푼다**: 40 % 에서 확대하고 손을 떼면 배치가 바뀐다.

### 대안 C: 지금 식 유지 + 히스테리시스

- **설명**: 경계 근처 왕복에서 열 수 변경을 늦춘다.
- **위험**: 기술 L / 성능 M (한 방향 큰 줌에서는 효과가 작다) / 유지보수 M / 마이그레이션 L
- **사용자 문제를 못 푼다**: 배치는 여전히 줌에 따라 바뀐다.

### 대안 D: 화면 px 고정 gap + 페이지 로컬 좌표 (offset 만 이동)

- **설명**: gap 을 화면 80 px 로 고정한다. 그러면 장면 gap 은 `80 / zoom` 이라 매 줌 프레임마다 페이지 자리가 바뀐다. 이를 싸게 하려면 그리기 · hit · 공간 인덱스를 페이지 기준 좌표로 바꿔야 한다 (ADR-272 결론의 C 등급 후보).
- **위험**: 기술 H (그리기 · hit · 공간 인덱스 · 줌 기준점 전부) / 성능 M (지금 방식이면 매 프레임 전체 옮기기라 현재보다 나쁘다) / 유지보수 H / 마이그레이션 M
- 사용자가 대안 A 를 골랐다.

### 대안 E: 대안 A 의 「모니터 폭」 대신 Canvas 영역 폭

- **설명**: 식은 A 와 같고 입력만 Canvas 영역 폭 (패널 rail 제외) 이다.
- **위험**: 기술 L / 성능 M (패널 열기 · 닫기 · 창 크기 변경마다 재배치) / 유지보수 L / 마이그레이션 M
- 패널 토글이 배치를 바꾸므로 사용자 문제와 같은 종류의 흔들림이 남는다.

### Risk Threshold Check

| 대안 | HIGH+               | 판정                                            |
| ---- | ------------------- | ----------------------------------------------- |
| A    | 없음                | 통과                                            |
| B    | 없음                | 사용자 문제 미해결                              |
| C    | 없음                | 사용자 문제 미해결                              |
| D    | 기술 H · 유지보수 H | A 가 HIGH 를 피하는 대안으로 있음 (루프 불필요) |
| E    | 없음                | 패널 토글 재배치                                |

## Decision

**대안 A 를 채택한다.** 기준 배율 기본값은 40 %, gap 은 장면 좌표다.

2560 · gap 80 · 40 % 이면 Desktop 3 · Tablet 7 · Mobile 13 열이고, 1920 이면 2 · 5 · 10 열이다.

위험 수용 근거:

- 줌은 열 수 입력에서 빠지므로, 줌 중 재배치는 측정이 아니라 **코드 구조로** 0 이다 (등급 A).
- 남는 재배치는 다음 경우뿐이다. 모두 사용자가 일으키는 드문 사건이고, 같은 step 의 레이아웃 한 번에 들어간다.
  - breakpoint 전환
  - gap · 기준 배율 · 열 모드 편집
  - 모니터 변경
- 모니터마다 배치가 다를 수 있는 것은 auto 의 정의다. 어디서나 같은 배치가 필요하면 Fixed 를 쓴다.

기각 사유:

- **B · C**: 배치가 여전히 줌에 따라 바뀐다. 사용자가 지적한 불편이 남는다.
- **D**: 사용자가 A 를 골랐다. 구조 변경 (로컬 좌표) 이 필요해 C 등급이다. 필요하면 별도 ADR 로 다룬다.
- **E**: 패널 토글 · 창 크기 변경이 배치를 바꾼다.

> 구현 상세: [274-page-grid-auto-columns-from-screen-width-breakdown.md](../design/274-page-grid-auto-columns-from-screen-width-breakdown.md)

### 사용자 결정 3 건 (execute-adr 가 해당 Phase 에서 묻는다)

1. **기준 배율의 tier override**: 기본안은 breakpoint 공통 (값 하나로 tier 마다 열 수가 갈리는 것이 % 의 목적). override 를 허용할지. — Phase 1
2. **기준 배율 범위**: 기본안은 10 ~ 100 % (빌더 최소 줌 0.1 과 같은 하한). — Phase 2
3. **ratchet A 키 상향**: 하니스의 `@zoom0.1` run 은 시작 배치가 6 열 → 1 열 (1440 headless · 40 %) 로 바뀐다. 줌과 무관한 카운트가 오르면 `--raise` 승인이 필요하다. — Phase 3

## Risks

| ID  | 위험                                                                               | 심각도 | 대응                                                                                                  |
| --- | ---------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------- |
| R1  | 같은 문서라도 모니터 폭이 다르면 auto 배치가 다르다 (노트북 ↔ 외장 모니터)         |  MED   | 정의로 수용. Settings 안내 문구에 적는다. 같은 배치가 필요하면 Fixed 를 쓴다                          |
| R2  | 하니스 run 의 시작 배치가 바뀌어 줌과 무관한 A 키가 오를 수 있다                   |  MED   | 사용자 결정 3. 바뀐 키를 run 별로 표에 적는다 (G2)                                                    |
| R3  | breakpoint 전환에서 열 수를 새 tier 로 계산하지 않으면 F5 의 두 번째 패스가 남는다 |  MED   | 열 수를 root 파생 (`pageLayout()`) 안으로 옮긴다. 전환 1 회 = 레이아웃 1 회 unit + 원복 RED (G1)      |
| R4  | `screen.width` 변경 (창을 다른 모니터로 이동) 을 놓친다                            |  LOW   | 프레임 루프에서 정수 하나를 비교한다 (zoom 무관 · 변경 시에만 반영). idle 이면 다음 프레임에 반영된다 |
| R5  | 기존 auto 문서는 처음 열 때 배치가 바뀐다 (zoom 파생 → 모니터 파생)                |  LOW   | 의도된 변경. 이관 코드 없음 · 필드 부재 = 40 %                                                        |
| R6  | 편집 경로의 `lastAutoColumns` 가 파생과 갈린다                                     |  LOW   | 파생이 쓰는 한 곳 (F7) 을 유지한다. 페이지 드래그 칸 unit                                             |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험은 없지만, 동작 변경이므로 아래를 통과해야 Implemented 로 올린다. 집행 수단은 vitest · pre-push `gate:perf-ratchet` · Chrome MCP live 다.

| Gate | 시점        | 통과 조건                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                |
| ---- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| G0   | Phase 0     | F1 ~ F10 재grep 일치. 기준 카운트 기록: 줌 `translateCalls` · `pageGridMovedRoots`, breakpoint 전환 · gap 편집 한 번당 `computeLayout` 수 (F5 · F6 이 2 회인지 실측)                                                                                                                                                                     | 표 정정 (inventory 보강 — 전제 재검토 아님) |
| G1   | Phase 1 · 2 | unit: 손계산 표 (1440 · 1920 · 2560 × 3 tier × 40 % · gap 0 / 80 / 320) 일치 · zoom 이 입력에 없음 · breakpoint 전환 / gap / 기준 배율 편집 1 회 = 레이아웃 1 회 · 페이지 드래그 칸 = 화면 열 수 · 패널 (auto 입력 → 40 % · % 편집 · Fixed 개수 · tier override 무변경). 원복 RED: zoom 을 다시 넣으면 RED · 두 번째 패스를 되살리면 RED | 원인 수리 후 재실행                         |
| G2   | Phase 3     | 하니스 `--fixed-inputs` 의 `zoom` · `zoom-ladder` (many-pages 100 `@zoom0.1` · `app-pages`) 에서 `translateCalls` · `translateNodes` · `pageGridMovedRoots` = 0 (기준 5,170 · 1,036). ratchet `--update` 하향을 같은 커밋에. 오른 키는 사용자 결정 3                                                                                     | 원인 분해 (줌 외 trigger 탐색)              |
| G3   | Phase 3     | wall-clock 방향 (Q3 대조군 — 기준 ↔ 변경 교대 2 쌍): 줌 taskMs · long task 감소. 불리한 경우 (Q2): breakpoint 전환 · gap 편집 · 모니터 폭 변경 (Playwright `screen` 옵션) total 회귀 0. 측정 조건 (dev/prod · DPR · 화면 크기 · visibilityState) 기록                                                                                    | 「카운트 감소, 체감 미확인」 으로 기록      |
| G4   | Phase 3     | production 짝 (`--serve-dist`, 교대 2 쌍): 줌 · breakpoint 전환 · 페이지 전환 · 편집 표시 간격 p99 · long task 회귀 0                                                                                                                                                                                                                    | 회귀 원인 분해                              |
| G5   | Phase 3     | Chrome MCP live (사용자 프로젝트): 40 % 에서 한 페이지로 확대 → 배치 무변경 · Desktop / Tablet / Mobile 열 수 = 사용자 모니터 폭 손계산 · 기준 배율 · gap 편집 즉시 반영 · Fixed + tier override 무변경 · 새로고침 뒤 유지 · 콘솔 오류 0                                                                                                 | 결함 수리 후 재실행                         |

**측정 5-질문** ([measurement-validity.md](../../../.claude/rules/measurement-validity.md)):

- Q1: fixture 는 규모 전용이고, 분포 판단은 사용자 프로젝트 live (G5) 로 한다.
- Q2: 불리한 경우로 breakpoint 전환 · gap 편집 · 모니터 변경을 잰다 (G3).
- Q3: 기준 ↔ 변경 교대로 잰다 (G3 · G4).
- Q4: 소비 경로 = 패널 → 명령 → 문서 → `resolvePageLayout` → Canvas, live 로 확인한다 (G5).
- Q5: oracle 은 손계산 표다 (G1).

### Live Exercise

2026-10-18 · Chrome MCP (사용자 Chrome, CPU throttle 4x 설정 그대로) · dev 서버 · 사용자 프로젝트 「123」 (25 페이지, 시작 상태 Fixed 5 열 · gap 200) · 모니터 `screen.width` 1800 · DPR 2 · visible 탭.

| # | 시나리오 | 결과 |
| --- | --- | --- |
| 1 | Settings 열 수 칸에 `auto` 입력 | PASS — 문서 `{columns: "auto", autoFitZoom: 40, gap: 200}` · 칸 `40` + suffix `%` · Desktop 2 열 (손계산 (4500 + 200) / 2120 = 2) |
| 2 | 줌 메뉴 Fit (15 %) → 100 % → 200 % · ctrl+휠 80 번 | PASS — page frame 사각형 25 개 전부 그대로 · root 교체 0 |
| 3 | `20%` 입력 → gap `1000` 입력 | PASS — 각 편집이 히스토리 한 칸 · Desktop 3 · Tablet 5 · Mobile 7 (손계산과 같음) · 전환 뒤 `setScreenWidth` 두 번째 패스 0 |
| 4 | 헤더 Tablet → 「This breakpoint only」 켬 → 단위 메뉴 `—` (Fixed) → `2` | PASS (수리 뒤) — tablet 만 Fixed 2 · Desktop 은 auto 10 % → 6 열 (손계산 (18000 + 1000) / 2920 = 6) |
| 5 | 새로고침 | PASS — 문서 · Desktop 6 · Tablet 2 · Mobile 2 (desktop-first cascade) 유지 |
| 6 | 원래 값 `{columns: 5, gap: 200}` 복원 → 새로고침 | PASS — Fixed 5 · 콘솔 오류 0 (추적은 마지막 로드부터) |

- **live 에서 찾은 결함 (수리함)**: 단위 목록 `["", "%"]` 에서 단위 없는 값 `10` 이 첫 비키워드 단위 `%` 로 해석됐다 (`PropertyUnitInput.components.tsx` resolvedUnit 폴백). 그래서 Fixed 칸이 `10 %` 로 보였고, 다음 `2` 입력이 `2%` 배율로 commit 됐다. 목록에 `""` 가 있으면 빈 단위도 명시 단위로 본다 — RED unit `PropertyUnitInput.test.tsx` 「an explicit empty unit」. `""` 를 목록에 둔 호출부는 이 칸 하나다.
- 시나리오 4 의 첫 시도에서 스위치를 빗나가게 눌렀고 (결함 아님), Auto 상태에서 친 `2` 는 단위 입력 규칙대로 `2%` → 10 % 로 맞춰졌다. 모드 전환은 단위 메뉴로 한다.

## Consequences

### Positive

- 줌이 페이지 배치를 바꾸지 않는다. 사용자가 지적한 「확대하면 배치가 달라짐」 이 사라진다.
- 실측 기준으로 줌 비용의 절반 (many-pages 100 taskMs ~48 %, long task 8 → 0) 을 만든 재배치 trigger 가 없어진다. ADR-272 결론의 「줌 p99 본체 = JS 재배치」 를 로컬 좌표 없이 해소한다.
- breakpoint 전환 · gap 편집의 두 번째 레이아웃 패스가 없어진다 (F5 · F6).
- Canvas 프레임 루프에서 auto 열 수 계산이 정수 비교 하나로 줄어든다.

### Negative

- auto 배치가 모니터에 따라 다르다 (R1).
- 기존 auto 문서는 처음 열 때 배치가 바뀐다 (R5).
- 하니스 `@zoom0.1` run 의 시작 배치가 바뀌어 기준선 비교가 끊긴다 (R2). 바뀐 키를 기록한다.
- 바뀌는 파일:
  - `pagePlacement.ts` · `compositionRoot.ts` · `workspace.ts` · `pageLayoutSettings.ts` · `CatalogCanvas.tsx`
  - `catalog-style.types.ts` · document `types.ts` · `validation.ts` · `SettingsPanel.tsx` · `useCatalogPageLayout.ts` · `PropertyUnitInput.components.tsx` (빈 단위)
  - 하니스 (`perf-baseline.mjs` · `perfAppFixture.mjs`) · `perf/ratchet.json`
