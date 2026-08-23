# ADR-187 Phase 4 / G6 — targeted layout live parity

검증일: 2026-08-23  
결과: **GREEN — Phase 4 scoped allowlist 완료**

## 범위

ADR-188이 제공한 targeted layout publication과 Skia subtree patch를 ADR-187의
`layout` presentation lane에서 실제 소비하는 경로를 검증했다. 현재 continuous
presentation 승격 범위는 `position: absolute` 대상의 유한한 숫자형
`style.patch { left, top }` 및 `geometry.patch { x, y }`다. reflow, size/intrinsic,
fixed/sticky, ref descendant는 commit-only로 fail-closed한다.

Preview는 별도 서버가 아니라 Builder 상단 `Compare Mode (Preview + Skia)` split에서
같은 session/revision을 소비했다.

## 재현

```bash
node apps/builder/scripts/adr187-presentation-baseline.mjs \
  --base-url http://127.0.0.1:5174 \
  --duration-ms 1000 \
  --repeats 1 \
  --tiers 50,500,5000 \
  --fixture-profile document-scale \
  --lane layout \
  --out /private/tmp/adr187-phase4-mobile-tiers.json \
  --trace-dir /private/tmp/adr187-phase4-mobile-tier-traces
```

하니스는 사용자 로컬 설정에 의존하지 않도록 `builder-breakpoint=mobile`을 명시한다.
Mobile canvas는 390×844이며, document-scale fixture는 전체 문서 N만 늘리고 가시
draw workload는 target 하나로 고정한다.

## 결과

|     N | runtime apply p95 / p99 | Skia frame p95 / p99 | Preview handle p95 / p99 | long task |
| ----: | ----------------------: | -------------------: | -----------------------: | --------: |
|    50 |         0.268 / 0.367ms |      1.158 / 1.268ms |          0.109 / 0.159ms |         0 |
|   500 |         0.242 / 0.277ms |      1.177 / 1.262ms |          0.205 / 0.281ms |         0 |
| 5,000 |         0.617 / 0.674ms |      3.913 / 4.064ms |          1.339 / 2.897ms |         0 |

세 tier 모두 다음 parity gate를 통과했다.

- Skia snapshot 가용, during canvas pixel 변화, terminal 복원
- Preview clipped width = Skia hit bounds width
- center hit에 target 포함, draw/hit bounds 원자성
- command count/span 안정성
- `canonicalWriteCount`, `legacyWriteCount`, `layoutPublishCount`,
  `projectionSignatureCount`, `bridgeFullRebuildCount`,
  `previewFullDocumentMessageCount`, `staleCallbackAfterTerminalCount` 모두 0
- during `targetIncrementalPatchCount`는 presentation frame apply와 1:1

기존 ADR-188 Phase 5의 15회 production trace도 동일한 계약과 120Hz p95 `<4ms`,
p99 `<8.33ms`를 통과했으며, 본 검증은 현재 Builder에서 그 결과를 재현하는 live
smoke 및 breakpoint fixture 고정이다. 상세 5회×3 tier 증적은
[ADR-188 Phase 5/G6 evidence](188-phase-5-g6-live-parity.md)를 참조한다.

## 판정

G6은 **targeted layout allowlist 범위에서 GREEN**이다. 일반적인 page-root 전체
layout entrypoint와 structure continuous publish를 이 Phase의 성공으로 주장하지
않는다. 해당 항목은 ADR-188의 fail-closed/commit-only 계약과 이후 migration gate의
대상으로 남긴다.
