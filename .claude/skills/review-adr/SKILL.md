---
name: review-adr
description: 작성된 ADR의 핵심 주장·대안·위험·gate를 현재 코드와 대조해 리뷰할 때 사용. ADR phase 구현 판독도 여기서 기록.
user-invocable: true
---

# ADR 검토

대상 ADR과 결정에 관련된 breakdown·코드·근거를 읽고 설계의 타당성을 판단합니다.
[작성 규칙](../../rules/adr-writing.md)으로 구조와 상태 계약을 대조합니다.
성능 수치나 gate의 유효성이 결정 근거라면
[측정 규칙](../../rules/measurement-validity.md)을 추가로 확인합니다.

- 결정이 의존하는 핵심 가정, 실제 소비 경로, 선행 ADR 경계와 기각한 대안을 검토합니다.
- 위험은 현재 코드·재현 조건으로 뒷받침합니다. 여러 관점이 필요하면 실패 형태를
  구분해 조사하되 정해진 수의 반론·렌즈·질문을 채우지 않습니다.
- 구조 존재 여부와 내용의 품질, 기술적 gate와 사용자 정책 승인을 구분합니다.
- Gate 의 집행 수단이 저장소 git 정책과 양립하는지 봅니다 — pre-push 게이트 또는
  `push: main` 워크플로만 실재하며, PR / status check 를 전제한 Gate 는 vacuous 입니다.
- 각 판정은 읽은 문서의 섹션이나 `file:line`에 연결합니다. 확인하지 못한 것은
  UNVERIFIED로 남기며 자료 부족 자체를 구현 결함으로 단정하지 않습니다.
- 인용을 이미 확인했으면 형식적인 재독은 필요 없습니다. 코드나 문서가 바뀌었거나
  근거가 불확실해졌을 때 다시 확인합니다.

## 이슈의 기준

merge 를 막을 문제만 이슈로 올립니다. 각 이슈에 파일·라인, 왜 틀렸는지, 실패를 보이는
방법 (입력·상태 → 잘못된 결과) 을 적습니다. production 재현 시나리오가 없는 커버리지 지적은
LOW deferred 로 분류하고 라운드 재개 사유로 삼지 않습니다. phase · 후속 항목의 닫힘 판정은
실행자가 합니다 ([판독 루프 종결](../../rules/review-loop-closure.md)).

## phase 구현 판독

ADR 의 phase 가 구현된 뒤의 판독도 이 skill 입니다 — 범위는 그 phase 의 커밋 범위이고,
대조 대상은 ADR Decision · Gate · breakdown 의 완료 기준입니다. phase 당 판독 1회 + 수리 검증
1회가 상한이며, 수리 검증에서 HIGH 0 이면 실행자가 닫습니다. 반례는 실행 (transaction ·
SSR · 원복 RED) 으로 보이고, 실행하지 못한 근거는 UNVERIFIED 로 적습니다.

## 결과와 기록

결과에는 중요한 이슈·영향·해결 방향과 검증 범위·한계를 적습니다. 이슈가 없으면
그 사실을 보고합니다. 리뷰만 요청되면 제품 코드 수정이나 ADR 상태 승격은 하지 않습니다.

모든 round 는 [리뷰 기록 형식](references/persistence.md)의 writer 로
`docs/adr/reviews/NNN.md` 에 기록하고 성공 여부를 확인합니다 — 설계 리뷰와 phase 구현 판독,
수리 검증 모두 같은 파일의 다음 round 입니다. 사용자가 붙여 넣은 판독이나 Codex 의 판독은
실행자가 코드로 확인한 뒤 `reviewer: human` / `codex` 로 기록하고, 반영 결과를 ADR 본문
Status 의 인용 블록에 적습니다. 승인 가능한 round 는 pending 0 으로 종결합니다.
persistence.md 는 실제 기록을 작성할 때만 읽습니다.
