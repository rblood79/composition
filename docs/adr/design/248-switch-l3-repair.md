# ADR-248 Switch 6건 L3 원인 수리 — 2026-10-05

시작 HEAD `8064dfb3f9a88b65849c53510a02f2fd95430479`.
**Switch 6건 및 state 75/75 PASS.** 제품 renderer 결함이 아니라, indicator 노드 전환 후 구 paint의 대응 관계를 잃은 G3 하니스 문제였다. 제품의 올바른 y=4를 구 y=0으로 되돌리지 않았다.

## 원인

- 동결 HEAD `2a5c97099`의 `packages/specs/src/renderers/skiaPrimitives.ts` `switchToggle`은 track을 부모 원점 `(0,0)`에 그렸다. md track은 36×20이다.
- 2026-10-04 indicator 노드 전환 후에는 부모의 paddingY=4와 flex 중앙 정렬에 따라 별도 `SwitchIndicator`가 `(0,4,36,20)`에 위치한다. 현 catalog `rulePartRules.ts` 및 `toggleIndicatorNode.test.ts`에 명시된 계약이며 실제 DOM도 같은 위치다.
- 이전 G3는 이 노드를 한쪽에만 존재하는 `toggle-indicator-node`로 승인했지만, 구 track과 새 indicator를 paint pair로 연결하지 않았다. 따라서 4px 이동을 색상/형태 차이로 셌다.
- 한쪽에 노드가 없는 경우에도 `old: ""`를 사용해, 부재를 뜻하는 값과 실제 old root path가 충돌했다. 이 때문에 실제로 존재하지 않는 root/child 비교 영역도 만들어졌다.

## 수정과 거짓 성공 방지

- 부재는 `undefined`, 실제 구 root는 `""`로 구분한다.
- 동결 state scene hash, 6개 상태, 구/신 root 크기와 위치, 36×20 indicator의 y=4, 현재 DOM 상자 일치 조건을 모두 만족할 때만 구 track paint rect를 연결한다. 조건에 맞지 않는 SwitchIndicator는 일반 unpaired 승인으로 되돌아가지 않고 geometry gate를 실패시킨다.
- 구/신 track이 이동하며 차지한 영역을 분류한 뒤 **이동량을 보정한 L3 pixel 비교를 계속 수행**한다. `wholeBoxes` paint 면제에는 넣지 않는다. geometry 1px 및 기존 L3 threshold/ratio/maxByte 예산은 그대로다.
- 다른 hash/state/root/part 좌표·크기/DOM 부재를 거부하는 회귀 테스트를 추가했다.
- Vite pre-load로 Switch track fill만 magenta로 바꾼 별도 fault probe를 실행했다. 제품 파일은 수정하지 않았다. **6/6 FAIL, exit 1**이며 moved paint의 different는 selected 6,531, 나머지 5,230이었다. 따라서 이동 분류가 실제 paint 결함을 면제하지 않는다.

## 결과

| 검사                         | 결과                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| 수정 전 Switch 6건           | 6 FAIL, exit 1                                                                           |
| 수정 후 Switch 6건           | 6 PASS. 각 상태 translated L3 **10,846 pixels, different 0, maxByte 0**, 귀속 밖 ratio 0 |
| state 전체                   | **75/75 PASS**                                                                           |
| base                         | 63 PASS / 원본 Icon 1 UNVERIFIED / FAIL 0                                                |
| axis                         | 374 PASS / 원본 Icon 6 UNVERIFIED / 계약 밖 6 NOT_RUN / FAIL 0                           |
| child 보충                   | **33/33 PASS**                                                                           |
| 공통 browser 검사            | prop-axis 51 + section guard 1 + Switch guard 1 PASS                                     |
| toggle indicator 인접 테스트 | 19/19 PASS                                                                               |

원본 Icon 7건·원본 child 33건의 UNVERIFIED 이력, 고정 Icon 보충 7/7, 계약 밖 입력의 원자 거부 처분은 [이전 대응표](248-g3-section-closure.md#기존-미검증과-보충-검증의-관계)를 유지한다. 과거 raw FAIL도 덮어쓰지 않았다.

현재 raw 결과는 `apps/builder/test-results/adr248-switch-{red,state-final,base-final,axis-final,child-final,paint-fault}.json`. fault probe 설정은 같은 디렉터리의 `adr248-switch-paint-fault.config.mts`이며 실제 primitive의 `fill: trackColor`만 바꾼다. 원본 PNG·replay·예산은 변경하지 않았다.

## Live Exercise와 한계

Headed Chrome / Playwright CLI에서 실제 Builder에 `ADR248 Switch L3 repair` 프로젝트를 만들고 공개 `insertNodes`로 selected/unselected/disabled/hover/pressed/focus-visible origin 6개를 추가했다. Desktop Compare Mode에서 각 DOM indicator의 부모 상대 상자와 실제 Canvas layout을 비교해 **6/6 delta 0**을 확인했다. selected는 오른쪽 thumb, 나머지는 왼쪽 thumb이며 disabled도 표시된다. 사용자 직접 confirm이 아닌 자동 브라우저 관찰이다.

프로젝트 경로: `/builder/32e4d8d7-139a-48b7-9615-38ca632db9b4`. 캡처와 측정 로그는 로컬 `apps/builder/test-results/adr248-switch-live/`에 보존했다.

**검증 범위:** G3 L3는 구/신 Canvas 비교이고, 현재 Canvas↔DOM leg는 geometry다. 실제 Compare 캡처에서는 비활성 텍스트/테두리 및 unselected track 색조 차이가 관찰된다. Preview의 수동 Switch CSS는 `fg-disabled`/`border-disabled` 및 CSS accent-subtle을 사용한다. 이번 track 이동의 old/new Canvas paint 일치로 현재 DOM paint 전수 일치까지 주장하지 않는다. 이 색조 차이는 이번 하니스 변경으로 생긴 회귀가 아니며 별도 D3 paint 대조 대상으로 남긴다.

제품 runtime·catalog·CSS 변경이 없으므로 이전 G5 p95/heap/bundle과 G6는 다시 실행하지 않았다. 이번 변경의 typecheck/preflight와 diff-check 결과를 아래에 기록한다. ADR 상태는 Accepted를 유지한다.

## 최종 검사

- `pnpm run codex:preflight` PASS: typecheck 6 tasks, Builder baseline 0, guard/registration/agent-catalog PASS.
- `git diff --check` PASS. 로컬 공용 task-state 및 raw evidence는 커밋 대상에서 제외한다.
- Scope: G3 대응 관계 및 guard 3개 TS 파일과 문서만 변경. runtime/catalog/CSS/생성물 변경 0.
