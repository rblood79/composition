# ADR-922 Phase 5: Visibility Lifecycle / Accessibility Evidence

## 범위와 판정

- 실행일: 2026-08-18
- 범위: Phase 5 — visibility lifecycle와 접근성
- Gate: G4 Hidden Work, G5 Accessibility/UI
- 결과: **PASS**
- 제외: v1 compatibility state/action, `panelLayoutRuntime.ts`, unused legacy host/export 제거와
  최종 rollback rehearsal은 Phase 6 범위다.

## G4 — hidden panel work

### callback inventory

| 경로                                             | 수명주기 owner                      | hidden 처리                                        | 판정              |
| ------------------------------------------------ | ----------------------------------- | -------------------------------------------------- | ----------------- |
| Monitor `useFPSMonitor` RAF                      | panel `Activity` 내부 Effect        | cleanup에서 RAF 취소                               | 유지              |
| Monitor `useTimeSeriesData` interval/timeout     | panel `Activity` 내부 Effect        | cleanup에서 interval/timeout 취소                  | 유지              |
| Monitor chart `ResizeObserver`                   | panel `Activity` 내부 layout Effect | cleanup에서 disconnect                             | 유지              |
| Monitor `useWebVitals` message listener          | panel `Activity` 내부 Effect        | cleanup에서 listener 제거                          | 유지              |
| Monitor component analysis timeout               | panel `Activity` 내부 Effect        | cleanup에서 timeout 취소                           | 유지              |
| Monitor memory-history RAF                       | 수동 예약 callback                  | Effect cleanup에서 RAF 취소 추가                   | 수정              |
| Monitor memory collection idle callback          | interval이 예약하는 수동 callback   | pending idle/fallback timeout id 추적·취소 추가    | 수정              |
| Style RAF/idle, fill/color RAF                   | panel `Activity` 내부 Effect        | 기존 cleanup에서 취소                              | 유지              |
| Font/storage, History subscription/timer         | panel `Activity` 내부 Effect        | 기존 unsubscribe/clear cleanup                     | 유지              |
| Canvas selection shortcut, auto recovery monitor | Builder global owner                | panel visibility와 독립적인 shortcut/recovery 계약 | panel gating 제외 |

전체 panel에 visibility context를 추가하지 않았다. continuous work는 이미 `Activity` Effect
cleanup 경계 안에 있으며, 실제 누수는 Effect가 예약한 뒤 자체 cleanup id를 보존하지 않던
두 callback이었다. 이 둘만 취소해 visibility state의 중복 SSOT를 만들지 않았다.

### 대표 component fixture

`MonitorPanel.visibility.test.tsx`는 실제 Monitor를 React `Activity`로 감싸고 Memory →
Realtime 전환 후 visible → hidden → visible을 왕복한다.

- hidden 이후 active `ResizeObserver`: `0`
- hidden 이후 pending idle callback: `0`
- hidden 이후 pending RAF callback: `0`
- hidden 이후 fake timer: `0`
- 다시 visible 이후 Realtime tab `aria-selected`: `true`
- 다시 visible 이후 observer/idle/RAF: 재등록

따라서 callback 중단과 local UI state 보존을 같은 fixture에서 검증했다.

## G5 — shared splitter와 기존 panel DOM

### shared `PanelSplitter`

- React Aria `useMove`: pointer, touch, Arrow key delta
- React Aria `useKeyboard`: Home/End min/max 이동
- WAI-ARIA range: separator role, accessible name, orientation, value/min/max
- controlled pane: `aria-controls="panel-{panelId}-content"`와 동일 frame content id
- edge semantics: left/top은 target delta를 반전하고 right/bottom은 정방향으로 적용
- RTL fixture: ArrowLeft는 physical `-1px` delta를 유지하고 left-edge runtime이 pane width
  의미로 변환
- focus: 기존 `:focus-visible` token outline 유지

Component fixture는 vertical/horizontal, pointer delta, Arrow, Home/End, focus, RTL과 모든
ARIA 필드를 검증한다. `PanelWorkspace` fixture는 splitter의 controlled id가 기존
`.workspace-panel-content`를 직접 가리키고 shell이 header/action/content를 복제하지 않음을
검증한다.

### populated Builder browser smoke

대상: `http://localhost:5173/builder/8e92598a-99ae-4408-b905-b9531968c696`

- Monitor splitter 3개 모두 name/orientation/value/min/max/controls를 노출하고 controlled
  content가 실제 DOM에 존재했다.
- bottom splitter keyboard resize: `600 → 599 → 600px`; separator focus와
  `:focus-visible`이 유지됐다.
- move handle keyboard 이동: x `1470.7109375 → 1471.7109375 → 1470.7109375px`;
  native `button`과 `모니터 패널 이동` label이 유지됐다.
- Realtime tab은 Monitor hidden 상태(`display:none`, `data-mode=hidden`)에서도
  `aria-selected=true`를 보존하고 다시 표시한 뒤 동일 상태로 복귀했다.
- History 대표 frame은 `.panel-header`, `.panel-title`, `.panel-actions`,
  `.panel-contents`, `.workspace-panel-content`가 각각 정확히 1개였다.
- 검증 후 Monitor/History visibility와 resize/move geometry를 시작 상태로 복원했다.

## Cross-check

| 레이어               | 영향                                                               | 결과 |
| -------------------- | ------------------------------------------------------------------ | ---- |
| Spec / Factory       | component D1/D2 및 factory 변경 없음                               | N/A  |
| shared CSS / Preview | panel content DOM과 token CSS 변경 없음                            | PASS |
| Skia / Canvas        | Canvas geometry·renderer 변경 없음                                 | N/A  |
| Builder DOM          | splitter primitive와 content id만 변경, header/action wrapper 불변 | PASS |
| Input                | React Aria pointer/keyboard와 runtime delta/commit 경계 유지       | PASS |

Spec source를 수정하지 않았고 `.spec-rebuild-pending`도 생성되지 않았다.

## 검증

- targeted ESLint: PASS, 신규 violation `0`
- Builder layout + Monitor Vitest: `20 files / 107 tests` PASS
- `pnpm type-check`: PASS, Builder baseline 43건 대비 신규 violation `0`
- `pnpm run codex:guard`: PASS
- `pnpm run codex:preflight`: PASS; format/type-check와 registration contract
  `1 file / 14 tests` 통과
- `git diff --check`: PASS
- populated Builder browser G4/G5 smoke: PASS

Phase 6은 이 evidence를 전제로 legacy state/host/runtime 제거와 G6 rollback/refresh/final
preflight를 수행한다.
