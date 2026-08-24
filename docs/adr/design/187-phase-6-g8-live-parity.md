# ADR-187 Phase 6 G8 exact-URL live parity

- Date: 2026-08-24
- Builder: `http://localhost:5173/builder/36fb9ef0-94be-4389-a8ad-b7609985d188`
- URL query: 없음 (`adr187Metrics` 미부착)
- Surface: Builder 상단 `Compare Mode (Preview + Skia)`, Home page, Button 첫 color fill
- Input: native pointer ColorArea drag, 1,080 raw input/run, 5회, 각 5초 이상

## 계측 노출 계약

production build는 기존처럼 `?adr187Metrics=1`에서만 계측을 활성화한다. development
Builder는 정확한 URL을 바꾸지 않고도 opt-in할 수 있도록 비활성 controller를 노출하며,
명시적 enable 후에만 counter와 duration sample을 수집한다. 평상시 exact URL에서는
`enabled=false`라 continuous editing 비용을 추가하지 않는다.

G8 exact-URL 측정은 Phase 0 production baseline을 대체하지 않는다. production 수치
승인 근거와 N=50/500/5,000 counter invariant는 기존 Phase 0/3 evidence를 유지하고,
이 문서는 실제 populated Builder의 최종 wiring·화면·console gate를 닫는다.

## Native pointer trace

| run | elapsed | effective raw rate | raw input | frame apply | apply p95 | apply p99 |   max | target patch |
| --: | ------: | -----------------: | --------: | ----------: | --------: | --------: | ----: | -----------: |
|   1 |  5.538s |            195.0Hz |     1,080 |         573 |     0.2ms |     0.2ms | 0.3ms |          573 |
|   2 |  5.750s |            187.8Hz |     1,080 |         588 |     0.2ms |     0.2ms | 0.4ms |          588 |
|   3 |  6.233s |            173.3Hz |     1,080 |         634 |     0.2ms |     0.3ms | 1.5ms |          634 |
|   4 |  6.903s |            156.5Hz |     1,080 |         693 |     0.2ms |     0.3ms | 1.6ms |          693 |
|   5 |  7.906s |            136.6Hz |     1,080 |         766 |     0.2ms |     0.3ms | 1.6ms |          766 |

- elapsed median: `6.233s`
- frame apply count median: `634`
- apply p95 median: `0.2ms`
- apply p99 median: `0.3ms`
- worst max: `1.6ms`
- ADR-187 handler/apply 8.33ms 초과 sample: `0`

모든 run의 `beforeLastTerminal` snapshot에서 다음 counter가 0이었다.

- `actionRafCallbackCount`, `controlRafCallbackCount`
- `canonicalWriteCount`, `legacyWriteCount`, `layoutPublishCount`
- `projectionSignatureCount`, `bridgeFullRebuildCount`
- `previewFullDocumentMessageCount`, `previewFullDocumentBytes`
- `staleCallbackAfterTerminalCount`

각 run의 terminal snapshot은 `terminalEventCount=1`, `canonicalWriteCount=1`,
`previewFullDocumentMessageCount=1`이었다. 즉 drag 중에는 semantic delta와 target-local
Skia patch만 적용되고, pointer terminal에서 canonical document handoff가 한 번 발생했다.

## Preview↔Skia와 console

- Compare Mode에서 Home page를 명시적으로 focus한 뒤 CSS Preview와 Skia Canvas의
  red body, Badge, Button, Icon 출력과 배치를 같은 split 화면에서 확인했다.
- DEV one-shot read-only parity probe로 Button canonical target
  `aaa6de46-d281-46a6-bfc9-a1ed5a0987a8`을 같은 revision이 안정된 native drag
  plateau에서 직접 읽었다. presentation 색 `#C94F4FFF`에 대해 Preview computed
  `rgb(201, 79, 79)` = `[0.788235294, 0.309803922, 0.309803922, 1]`, Skia mutable
  fill target = `[0.788235307, 0.309803933, 0.309803933, 1]`이었고 정규화 후
  `preview↔expected`, `Skia↔expected`, `Preview↔Skia` max channel delta는 모두 `0`이었다.
- pointer terminal의 canonical handoff 뒤 같은 `#C94F4FFF`를 다시 읽었을 때도 세 delta가
  모두 `0`이었다. 원래 Button fill `#704848FF` 복원 뒤 Preview
  `rgb(112, 72, 72)`과 Skia `[0.439215690, 0.282352954, 0.282352954, 1]`의 세 delta도
  모두 `0`이었다. 따라서 HC9의 drag 중 `≤1/255`, retirement 후 `0`을 직접 충족했다.
- probe는 exact URL의 DEV opt-in command로 한 번만 동작하며 product frame scheduler를
  소유하지 않는다. revision이 다른 첫 소비 시점을 교차 비교하지 않고, 동일 입력을
  양 renderer가 소비한 plateau와 terminal canonical 상태를 각각 비교했다.
- 측정 변경으로 바뀐 Button fill은 `#704848FF`, body fill은 `#E81C1CFF`로 복원했다.
- final clean full reload(`2026-08-24T03:59:15Z`) 이후 application console error/warning:
  `0/0`.
- `[Violation] 'requestAnimationFrame' handler took ...`, long-task 문자열: `0`.
- full reload 전에 발견한 context provider identity 오류는 provider/consumer direct import
  통일 후 재현되지 않았으며, 최종 계측은 수정 후 clean load에서만 집계했다.

## 판정

- focused Vitest: 15 files / 127 tests PASS
- `pnpm run codex:typecheck`: PASS, baseline 43건 외 신규 오류 0
- `pnpm run codex:preflight`: guard/format/typecheck/registration PASS
- registration contract: 1 file / 14 tests PASS
- `git diff --check`: PASS

G8 PASS. Phase 6을 종료하고 ADR-187을 `Implemented`로 승격한다.
