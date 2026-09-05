# ADR-203 Phase 1 — LayerTree 가상화 스파이크

- 날짜: 2026-09-05
- 기준 HEAD: `4f0d7a36e`, main clean에서 시작. 아래 after는 로컬 구현이다.
- 판정: **구현·부분 검증 완료, G1 미통과. Phase 1 열림, Phase 2/3 미착수.**
- 이유: 600 요소 성능 조건은 통과했지만 60 요소 select drop 0% 조건은 미달이다. 임계값을 완화하거나 Implemented로 승격하지 않는다.
- 후속 분석: [Navigator 잔여 선택 비용](203-selection-residual-analysis.md). 아래 기존 drop/p50/p95는 RAF callback의 실행 간격 지표이며 실제 presentation 누락률이나 선택 처리 시간과 동일하지 않다. 기존 수치와 G1 열림 판정은 보존한다.

## 구현 범위

LayerTree의 RAC 경로에만 `Virtualizer` + `ListLayout`을 연결했다. `rowSize`는 `LAYER_TREE_ROW_SIZE_PX`이며 실제 Builder token/CSS 행 높이를 browser 테스트에서 비교한다. Layers section 외부 overflow를 끄고 Tree를 단일 scroll owner로 지정했다. layoutOptions/getKey/getTextValue 및 selectedKeys 참조를 안정화했다. selectedKeys memo는 잔여 비용 조사 중 Phase 2의 해당 소항목만 앞당긴 것이다.

공용 TreeBase, PageTree, FrameList, FrameElementTree, canonical/store/Canvas/Preview 경로는 수정하지 않았다. Phase 1 계획대로 LayerTree의 기존 tanstack 분기는 아직 보존한다.

설계 당시 RAC 1.20과 달리 현재 설치 버전은 **RAC 1.21.0 / react-stately 3.50.0**이다. 현재 `Virtualizer.CollectionRoot`는 `useScrollView`의 `contentProps`만 사용하므로 반환된 `scrollViewProps.style`이 Tree에 자동 적용된다고 가정할 수 없다. browser에서 overflow가 visible임을 재현한 뒤 LayerTree scoped CSS에 auto/hidden을 명시했다.

## 성능 실측

Chrome 152.0.7977.82, headless, viewport 1440×900, 개발 서버 localhost:5173, 격리 프로젝트, 60Hz nominal, select store driver 100ms 간격/3초. 패널 기본값은 Navigator+Properties다. production 절대 성능이나 실제 포인터 지연 수치로 해석하지 않는다. 성능 run끼리는 직렬 실행했고 live 검증 탭은 측정 중 about:blank로 이동했다.

| 조건                             | select p50 / p95 / max (ms) | drop % | longtask | 할당 MB/s | 원본                                        |
| -------------------------------- | --------------------------- | -----: | -------: | --------: | ------------------------------------------- |
| 변경 전 600, 두 패널             | 226.3 / 294.4 / 619.3       |    100 |       12 |     125.8 | [before](203-phase1/before-600.json)        |
| 최종 코드 600, 두 패널           | 16.6 / 23.3 / 39.3          |    3.8 |        0 |      56.4 | [after](203-phase1/after-600.json)          |
| 최종 코드 60, 두 패널            | 16.6 / 22.3 / 34.4          |    3.8 |        0 |      48.5 | [after](203-phase1/after-60.json)           |
| 60, Navigator만 (참조 안정화 전) | 16.6 / 23.8 / 31.8          |    3.3 |        0 |      30.8 | [Navigator](203-phase1/navigator-60.json)   |
| 60, Properties만                 | 16.6 / 20.8 / 24.3          |      0 |        0 |      32.0 | [Properties](203-phase1/properties-60.json) |

600의 선택 p50은 약 92.7% 감소했다. 두 규모 모두 idle drop 0%, select longtask 0이다. 그러나 60의 drop 0%는 **FAIL**이다. 초기 가상화 60 run도 drop 4.9%였고 참조 안정화 후에도 3.8%여서 단순 참조 안정화만으로 종결하지 못했다.

[60 profile](203-phase1/profile-60.json)은 278 samples, idle 63.7%, 상위 self-time이 React element 생성 3.2%, dev logComponentRender 1.8%, querySelector 1.4%다. 앱 단일 심볼은 각 0.4% 이하다. 이 작은 표본으로 특정 앱 함수를 새 병목으로 단정하지 않는다. 잔여 drop은 Navigator 단독으로도 재현되므로 Properties Phase 4 착수 근거로 사용하지 않는다.

## 브라우저 회귀 테스트

`pnpm --filter @composition/builder exec vitest run --config vitest.navigator.config.ts`

- **3 PASS**: 실제 LayerTree 600/5,000 각각 320px viewport에서 행 수 ≤18, 규모 차이 ≤1, 선택 10회 renderContent 증가 ≤180.
- 실제 `shared-tokens.css` + `builder-system.css`를 읽어 TreeItem/elementItem 높이와 rowSize 상수를 대조. 테스트가 --control-size를 숫자로 덮어쓰지 않는다.
- Tree clientHeight 320, Tree overflow auto/외부 hidden, End/Home/typeahead의 화면 밖 focus/scroll 확인.
- opt-in하지 않은 공용 TreeBase는 40행 전체 렌더. 별도 정적 gate 4건은 비대상 호출부의 Virtualizer 부재와 FrameElementTree의 현행 `>=12` tanstack 분기 보존을 확인한다.
- 변경 전 RED: 실제 LayerTree에 `.layer-tree--rac-virtualized`가 없어 실패. 설치된 RAC의 test 전용 전체 행 렌더를 우회하려고 `process.env.VIRT_ON=true`를 browser config에 명시했다. 제품 코드는 이 값을 사용하지 않는다.
- React/RAC 테스트의 dependency 최적화 설정과 cacheDir은 `vitest.navigator.config.ts`에 격리했다. 기존 Skia parity config는 변경하지 않는다.
- 인접 unit/static: **5 files / 36 tests PASS**.

## Live Exercise — Playwright headed, 별도 테스트 프로젝트

`ADR203-live`, body + 80개 테스트 요소. native 포인터/키보드로 수행했다. DevTools CPU throttle은 설정하지 않았다. 별도 기존 사용자 Chrome의 throttle 값을 이 세션 값으로 가져오지 않는다.

- 방향키 이동, End로 `adr203-79` focus + scrollTop 2150, Home 복귀, body를 명시적으로 펼친 후 `t` typeahead로 Text 이동 확인.
- 패널 높이를 실제 resize handle로 늘렸을 때 Tree clientHeight 445, 관측 행 17. 행 높이 28px.
- 컨테이너 on-drop: Text `adr203-3` → frame `adr203-1`, 저장 store parent_id 변경 확인. Undo 복원 확인.
- 형제 after-drop: `adr203-4` 다음에 `adr203-3`, 실제 순서 변경과 이동 행 focus/selection 확인. drop indicator top 437px 관측, Undo 복원 확인.
- 무효 drop: frame `adr203-0` → 자기 자식 `adr203-2`, 모든 id/parent_id 불변 확인.
- 패널 숨김/복원: 첫 가시 key `adr203-0`, offset -3px, scrollTop 31 → 동일. 깊은 스크롤 위치에서의 복원은 추가 검증 필요하다.
- **미종결 항목**: 컨테이너 on-drop 직후 focus가 이동 자식 대신 부모에 남았다. 기존 비가상화 경로와 같은지 아직 대조하지 않았으므로 신규 회귀로 단정하지 않는다. G2의 이동 행 focus 보장 판정은 보류한다. ARIA 전/후 전수 diff, shift/meta 전/후 대조, 깊은 scroll 복원, 5k persistent/headed 성능은 아직 완료하지 않았다.

## 게이트와 다음 작업

- `codex:preflight`: PASS (guard/format/typecheck/registration/catalog/engine/text-axis).
- `gate:visual-parity`: 최종 복원 코드 **PASS (101 gate tests, Vitest 98/98)**. 초기 두 run은 Vite 재최적화 중 CanvasKit 동적 import/Preview React hook 오류로 실패했다. 제품 두 파일을 HEAD로 대조한 run과 구현 복원 run은 각각 98/98 PASS였다. 초기 실패를 지속적인 제품 회귀 또는 원래부터 있는 실패로 단정하지 않는다.
- 문서 컴포넌트의 catalog/spec/factory/Skia/Preview는 변경 없음. D1은 RAC가 유지하며 신규 DOM/ARIA/키보드 구현은 없다.
- G1: **열림** — 60 drop 0% 미달. tanstack fallback은 아직 적용하지 않았다. RAC 결선 실패와 잔여 선택 비용을 구분한 위 실측을 기반으로 다음 수리/대안 판단을 진행해야 한다.
- 다음: 60 Navigator 선택의 React commit/collection 비용을 더 촘촘히 귀속하고 G1 미달을 해소한다. 공용 TreeBase 무변경 경계를 넘어야 하면 설계 경계를 먼저 명시적으로 조정한다. 이후 G2/G3 parity, Phase 2 분기 제거, Phase 3 persistent 5k 측정 순서로 진행한다.
- commit/push와 ADR Implemented 승격은 하지 않았다.
