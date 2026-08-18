# ADR-922 Post-Implementation Intent Correction Evidence

## 판정

**초기 의도 재검증 HIGH 3 / MEDIUM 1 전건 수정 — 2026-08-18**

ADR-922 `Implemented` 이후 초기 Decision/Hard Constraints를 현재 code/runtime과 다시
대조했다. 문서 완료 표시가 아니라 rail/placement/splitter/presentation RAF의 실제 owner를
검사했고, 발견된 네 항목을 같은 correction에서 해소했다.

## 1. rendered rail과 occupied inset

### 발견

empty bottom rail DOM은 Phase 6에서 제거됐지만 runtime은 left/right/bottom에 고정 48px을
전달하고 solver가 이를 무조건 더했다. populated layout에서 bottom rail 0인데 bottom inset
48px, host `1800×940` 대비 main `1704×892`가 재현됐다.

### 수정/검증

solver가 normalized `railOrder`에 panel ID가 있는 side만 configured rail size를 사용한다.

- default fixture의 bottom Monitor rail: inset 48px 유지
- Monitor가 right rail로 이동한 fixture: bottom inset 0
- populated browser: rendered rail left/right, bottom rail 0, bottom inset `0px`
- 1800×988: host `1800×940`, main/Canvas `1704×940`
- 800×600: host `800×552`, main/Canvas `704×552`, 음수 rect 0
- shell/main/Canvas layout version과 published local rect 일치

## 2. rail/placement 독립과 shared splitter

### 발견

Settings(left rail)를 Properties(right anchor)에 snap하면 persisted 결과는 `rail=left`,
`anchor=right`로 정상 분리됐지만 frame resize edge는 rail side로 계산됐다. coordinator의
row/column `snapshot.splitters`도 production consumer가 0이고 frame별 handle이 내부 경계를
중복 소유했다.

### 수정/검증

- `PanelWorkspaceFrameSnapshot.resizeEdges`를 snapshot anchor와 shared boundary에서 파생
- frame은 snapshot의 outer edge만 렌더
- row/column internal boundary는 `snapshot.splitters`를 실제 shared `PanelSplitter` DOM으로
  한 번만 렌더
- shared splitter는 snapshot geometry/version, React Aria pointer/keyboard, range ARIA,
  controlled pane ID를 사용
- cross-rail component fixture: Settings `data-side=left`, `data-anchor=right`, outer edge
  `left/bottom`, shared column splitter 1개
- floating/right two-column fixture에서 internal edge를 frame outer edge에서 제거

## 3. presentation RAF latency와 mismatch oracle

### 발견

Phase 3의 applied latency는 frame layout effect 뒤 `queueMicrotask`에서 종료돼 첫
presentation RAF를 측정하지 않았다. tracker는 expected version 도착 전 정상적인 이전
version도 mismatch로 누적했다.

### 수정

- affected frame layout effects가 version을 기록한 뒤 별도 `requestAnimationFrame`에서
  `takeReadyPresentation(timestamp)` 실행
- latest applied version이 expected보다 작은 동안은 pending으로 유지
- expected를 건너뛰고 더 새 version만 적용한 경우만 mismatch 판정
- `?panelTrace=1` DEV 경로에 native RAF trace driver 추가
  - production `beginInteraction → resizePanel per RAF → endInteraction 1회` 사용
  - ±1px 왕복 후 geometry 원복
  - 일반 route에서는 driver DOM/구독 0

### 최종 5초 trace

| 지표                          |             결과 |                    Gate |
| ----------------------------- | ---------------: | ----------------------: |
| display period                | 8.1ms / 123.46Hz |         fixed 60Hz 아님 |
| input-to-presentation-RAF p95 |           14.7ms |                 ≤16.2ms |
| applied version mismatch      |                0 |                       0 |
| interaction frame delivery    |           0.9903 | baseline 대비 -5pp 이내 |
| baseline frame delivery       |           0.9958 |               비교 기준 |
| delivery delta                |          -0.0056 |              -0.05 이상 |
| 50ms+ long task               |                0 |                       0 |
| pointer DOM geometry query    |                0 |                       0 |
| solve / RAF samples           |        603 / 603 |          native cadence |
| `passesG2b`                   |           `true` |                    PASS |

trace 전후 Settings geometry는 `x 61.875 / y 57.921875 / 337×395.7109375`로 동일했다.

## Cross-check

| 레이어               | 영향                                              | 결과 |
| -------------------- | ------------------------------------------------- | ---- |
| Spec / Factory       | 변경 없음                                         | N/A  |
| shared CSS / Preview | 변경 없음                                         | N/A  |
| Builder DOM/CSS      | actual rail inset, shared splitter DOM/edge owner | PASS |
| Skia / Canvas        | actual main rect publication 재검증               | PASS |
| Input/performance    | React Aria interaction + presentation RAF trace   | PASS |

`.spec-rebuild-pending`는 생성되지 않았다. 초기 review에서 확인된 HIGH 3 / MEDIUM 1은 모두
코드·fixture·populated browser evidence로 닫혔다.

## 검증

- targeted ESLint: PASS, 신규 violation `0`
- layout/store/hook/component Vitest: `21 files / 130 tests` PASS
- `pnpm type-check`: PASS, Builder baseline 43건 대비 신규 violation `0`
- populated Builder actual rail/Canvas-local rect/800×600 smoke: PASS
- native RAF 5초 runtime trace: `passesG2b=true`
- `pnpm run codex:guard`: PASS
- `pnpm run codex:preflight`: PASS; format/type-check와 registration contract
  `1 file / 14 tests` 통과
- `git diff --check`: PASS
