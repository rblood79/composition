# ADR-324: Collection에서 편집한 필드의 수동 서버 저장

## Status

Proposed — 2026-11-26

사용자 요청: /create-adr (2026-11-26)

> 기존 생각은 앞서말한대로 편집데이터만 사용자가 전송 요청시 보내는 방법이 가장 효과 적이라 생각했다
>
> 동적인 압축이라는거네, 암호화설계 지침은 탈취당하거나 변조후 재송신에 취약하지않나
>
> create adr로 설계진행해

사용자가 지정한 방향은 **사용자 요청 시 변경분만 전송**하는 것이다. 원격 저장은 설계 단계이며 서버 소유 주체, 인증 방식, 재시도 보장 기간은 열려 있다.

## Context

Builder의 Data 패널은 `table.mockData`를 행 위치로 편집한다. 문서 명령이 Collection 정의를 `CatalogGraph`에 반영하고 로컬에 저장한다. Builder가 API에서 조회한 행은 별도 캐시를 쓰며, 그 `sourceRev`는 조회 설정의 지문이다. Publish의 원격 행 버전은 데이터 원본이 발급해야 한다. [DataGrid](../../apps/builder/src/builder/panels/datatable/grid/DataGrid.components.tsx#L579) · [문서 명령 실행](../../apps/builder/src/builder/catalogRuntime/catalogDataStore.ts#L327) · [조회 캐시](../../apps/builder/src/builder/stores/utils/dataActions.ts#L781)

컴포넌트의 Table은 편집 시 이미 행별 `patch`와 편집 순번을 만든다. 현재 `loadMore`가 화면에 덧씌운 값을 읽은 뒤 `showLoaded`에서 편집 기록을 지우고, 일반 `callEndpoint`는 성공 응답을 `ok`로 줄인다. 사용자가 나중에 저장하면 화면 밖 행, 요청 중 다시 편집한 값, 서버가 실제 수락한 행을 구별할 계약이 필요하다. Preview와 Publish는 같은 세션을 사용한다. [편집 적용](../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1534) · [조회 결과 교체](../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2114) · [다음 페이지](../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2187) · [응답 처리](../../packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts#L696) · [Publish](../../apps/publish/src/catalogSession.ts#L17)

**측정 가능한 조건**은 편집·조회 시 원격 쓰기 0회, 변경 0건에서 저장 0회, 한도 내 저장 한 번에 논리적 배치 1건이다. 저장할 때 방문하는 행·필드 수는 변경량에 비례해야 한다. 1,000행 × 1,000열 합성 데이터에서 두 행의 세 셀을 바꿨을 때 JSON 본문은 전체 13,784,992 B, 수정 행 전체 26,781 B, 변경 필드와 식별 정보 173 B였다. 네트워크 왕복과 서버 처리 시간은 실제 연결에서 측정한다. [측정 방법과 결과](design/324-collection-manual-batch-save-breakdown.md#본문-크기-기준선)

주된 변경 도메인은 **D2**의 Collection 설정·동작·서버 계약이다. **D1**은 기존 React Aria Button과 편집 폼으로 저장·취소·결과를 조작하고 알리는 경계이며, **D3**는 기존 catalog 및 theme의 상태 표현을 사용한다. 작성자가 연결을 설정하는 시점과 앱 사용자가 자기 권한으로 저장하는 시점이 다르다. 현재 공용 실행기에서 서버 모드는 미연결이며, 첫 원본의 인증·트랜잭션·지원 한도는 아직 검증할 수 없다. [계약 정본](completed/063-ssot-chain-charter.md) · [공용 실행기](../../packages/shared/src/collections/executeCollectionEndpoint.ts#L114) · [외부 조사](../explanation/research/COLLECTION_REMOTE_SAVE_2026-11.md)

## Alternatives Considered

| 대안                                                 | 동작과 선택 비용                                                                                                                                                         |  기술  |  성능  | 유지보수 | 마이그레이션 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | :----: | :------: | :----------: |
| A · 현재의 셀별 제출 규칙                            | 편집 이벤트에 일반 endpoint를 연결한다. 개별 즉시 저장에는 맞지만 여러 편집을 사용자 의사로 한 번에 확정할 수 없다.                                                      |  LOW   | MEDIUM |   LOW    |     LOW      |
| B · 저장할 때 전체 스냅샷 비교 또는 전송             | 클라이언트 비교는 최초 원본 전체를 보관·순회하고, 서버 비교는 전체 전송량을 부담한다. 부분 조회된 데이터에는 화면 밖 행의 기준값이 없다.                                 | MEDIUM |  HIGH  |  MEDIUM  |     LOW      |
| C · 범용 배치 중계                                   | REST 단건 호출, GraphQL mutation, gRPC 메서드를 중계에서 묶는다. 원본별 버전·부분 성공·재시도 계약이 다르고, 독립 서버 여러 곳의 쓰기를 중계 DB에서 함께 롤백할 수 없다. |  HIGH  | MEDIUM |   HIGH   |    MEDIUM    |
| D · 변경 필드를 기록하고 원본의 배치 API로 수동 저장 | 저장 시 변경된 행·필드만 직렬화한다. 첫 연결은 행 버전과 원자적 배치·결과 조회를 제공하는 원본 하나를 대상으로 한다.                                                     | MEDIUM |  LOW   |  MEDIUM  |    MEDIUM    |

Retool Table은 기본키와 수정한 열을 모아 수동 저장하는 사례다. Google AIP-234의 동기 배치는 원자성을 요구하지만 Microsoft Graph 배치는 바깥 응답이 200이어도 내부 요청이 실패할 수 있다. 어느 때 저장 완료로 표시할지는 실제 원본 계약으로 판정해야 한다. [Retool Table](https://docs.retool.com/classic-apps/guides/data/table/columns) · [Google AIP-234](https://google.aip.dev/234) · [Microsoft Graph 배치 응답](https://learn.microsoft.com/en-us/graph/json-batching#processing-the-json-batch-response)

### Risk Threshold Check

| 판정         | 해당 대안               | 결과                                                                                                          |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| HIGH 축 있음 | B 성능, C 기술·유지보수 | D에서 전체 비교와 원본 간 배치를 제거했다.                                                                    |
| HIGH 축 없음 | A, D                    | A는 수동 확정 조건을 충족하지 않는다. D는 검증된 연결로 활성화 범위를 제한할 때 성립한다. CRITICAL 축은 없다. |

## Decision

**D를 제안한다. REST를 유지하고, 기존 원격 행에 대해 사용자가 저장을 누른 시점의 변경 필드를 한 배치로 보낸다.** GraphQL의 필드 선택이나 gRPC의 바이너리 인코딩을 도입해도 클라이언트의 편집 의도, 원본의 권한·트랜잭션·중복 처리는 별도로 정의해야 한다. A는 수동 확정 조건, B는 저장 비용, C는 원자성과 재시도 보장 때문에 첫 구현에서 제외한다.

1. **읽기와 쓰기.** 큰 조회는 원본이 지원하는 페이지·필드 선택을 쓰고, 편집할 행에는 영구 ID와 서버 버전을 포함한다. 쓰기 연결은 작성자가 Collection에 따로 지정한다. 같은 원본의 Table·Form은 실행 세션에서 변경을 공유한다. Builder의 로컬 표 편집과 기존 프로젝트의 `Cells change → callEndpoint`는 각자의 기존 계약으로 동작한다. [서버 쿼리](completed/315-table-data-grid-state-model.md) · [기존 편집 규칙](completed/317-table-editing-grid-paste-fill-status.md)
2. **저장 단위.** 변경된 행마다 `id`·`baseVersion`·`set`을 보낸다. 서버는 현재 주체의 행·필드 쓰기 권한을 확인하고 각 행을 기대 버전으로 조건부 갱신한다. 한 행이라도 실패하면 전부 롤백한다. `null`은 허용된 필드에 값을 대입하고, 생략한 필드는 그대로 둔다. 한도를 넘으면 명시적으로 거절해 사용자가 저장 범위를 조정하게 한다. [조건부 쓰기](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) · [JSON Merge Patch의 null 의미](https://www.rfc-editor.org/rfc/rfc7396.html#section-2)
3. **재시도와 확인.** 클릭 때 요청 ID·본문·편집 순번을 고정한다. 원본은 현재 권한을 재검사한 뒤 같은 ID의 기존 결과를 먼저 찾고 신규 요청에만 버전 검사를 한다. 데이터 변경과 처리 결과를 같은 트랜잭션으로 기록한다. 클라이언트는 확인된 행의 새 버전·보정값만 반영하고 이후 편집은 남긴다. 응답 유실은 ‘결과 확인 중’으로 표시한다. [AWS의 멱등 요청 설계](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
4. **인증과 재전송.** 운영 전송은 HTTPS와 대상에 제한된 인증을 사용한다. 쓰기는 TLS 1.3 초기 데이터에서 실행하지 않는다. 쿠키 연결에는 CSRF 방어를 적용하고 영수증 조회도 현재 권한을 검사한다. 요청 ID와 본문 지문은 업무 중복을 판별한다. 탈취한 유효 자격증명으로 새 ID를 만들어 보내는 위험은 인증 정책에서 다룬다. 발신자 키에 묶인 OAuth 토큰, 서버 간 본문 서명, 최종 수신자 암호화는 실제 신뢰 경계에 따라 선택한다. [RFC 8470](https://www.rfc-editor.org/rfc/rfc8470.html#section-5.2) · [DPoP의 보호 범위](https://www.rfc-editor.org/rfc/rfc9449.html#section-11) · [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
5. **조건부 압축.** 수신자가 gzip **요청**을 지원하고 배포의 기밀성 정책이 허용하며, 임계값 이상에서 실제 바이트가 줄 때 적용한다. 4 KiB는 측정 후보값이다. 서버는 압축 상태와 해제 중 크기를 각각 제한한다. 편집값과 비밀이 같은 압축 단위에 섞이고 길이를 관찰할 수 있는 연결에서는 압축을 끈다. [요청 인코딩 협상](https://www.rfc-editor.org/rfc/rfc7694.html#section-3) · [압축과 길이 노출](https://www.rfc-editor.org/rfc/rfc8725.html#section-3.6)

잔존 위험은 **수동 저장을 선택한 Collection, 기존 행 수정, 원자적 endpoint 한 종류**로 범위를 좁혀 관리한다. 원본에서 같은 보장을 입증할 수 없는 연결은 이 저장 모드를 활성화할 수 없다. 행 추가·삭제, 부분 성공형 배치, 재시작 뒤 미전송 초안 복구는 후속 결정 대상이다. [상세 설계와 구현 순서](design/324-collection-manual-batch-save-breakdown.md)

### 사용자 결정 3건

| 항목                               | 결정이 필요한 시점                 | 제안과 결정할 내용                                                                                                                                      |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1 · 첫 데이터 원본과 운영 책임    | 실제 서버 통합 전                  | 기존 고객 API 또는 직접 운영할 원본 중 한 곳과 담당자를 정한다. 해당 원본에서 원자적 버전 갱신·중복 방지·영수증 조회를 보장할 수 있어야 한다.           |
| U2 · 인증과 평문을 볼 수 있는 주체 | 실제 연결에 자격증명을 부여하기 전 | Preview 테스트·Publish 운영 연결을 구분한다. 배포의 로그인 방식, TLS 종료 지점과 중계의 평문 접근 허용 여부에 따라 추가 키·서명·암호화 필요성을 정한다. |
| U3 · 결과 보관과 재시도 시간       | 연결의 복구 정책 확정 전           | 원본이 보장할 영수증 보존 기간과 그 안에서 허용할 재시도 시간을 정한다. 재접속 확인에 필요한 최소 ID의 로컬 보존 기간과 폐기 정책도 함께 정한다.        |

## Risks

| ID  | 위험                                                                                          | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `fieldMap.value`나 `row-N`가 서버 행과 어긋나거나, 로드·늦은 응답이 새 편집을 지운다.         |  HIGH  | G1·G2에서 원본 키와 버전, 페이지 전환과 저장 중 재편집을 대조한다. [행 키](../../packages/shared/src/collections/resolveCollectionItems.ts#L340) · [편집 순번](../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1344) · [페이지 합치기](../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2196)  |
| R2  | 원본 커밋 뒤 응답이 끊기거나 일반 제출의 성공 판정이 배치 일부 실패를 숨긴다.                 |  HIGH  | G3에서 원본의 변경 행·버전과 영수증을 독립 조회한다. [HTTP 응답 해석](../../packages/shared/src/collections/executeCollectionEndpoint.ts#L222) · [일반 제출](../../packages/shared/src/catalog/runtime/catalogPreviewInteractions.ts#L696) · [기존 확인 처리](../../packages/shared/src/interactions/bindings.ts#L119)                |
| R3  | 자격증명·대상 혼동, 행·필드 권한 누락, 권한 철회 뒤 결과 재노출, 무제한 압축 해제가 발생한다. |  HIGH  | G4에서 실제 수신 측의 권한 격리·재전송·해제 상한을 검사한다. [endpoint 정의](../../packages/shared/src/catalog/document/types.ts#L1725) · [서버 실행 경계](../../packages/shared/src/collections/executeCollectionEndpoint.ts#L114) · [배포 세션](../../apps/publish/src/catalogSession.ts#L17)                                       |
| R4  | 한 원본에 작성한 즉시 제출과 수동 저장이 겹치거나 일반 프로젝트의 로드·표시가 회귀한다.       |  HIGH  | G1·G5에서 같은 원본으로의 이중 연결을 진단하고 기존 프로젝트 동작을 검증한다. [Table 편집 진입](../../packages/shared/src/catalog/runtime/catalogTableController.ts#L835) · [이벤트 규칙](../../packages/shared/src/interactions/bindings.ts#L119) · [읽기 연결 변경](../../apps/builder/src/builder/stores/utils/dataChange.ts#L845) |
| R5  | 작은 본문이 압축으로 커지거나 저장 시 비용이 전체 표 크기에 비례한다.                         | MEDIUM | G4·G5에서 gzip 전후 바이트·처리 시간과 저장 시 방문한 행·필드 수를 측정한다.                                                                                                                                                                                                                                                          |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                      | 실패 시 대안                                                                                         |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| G0   | 구현 착수           | 현재 경로에서 기존 편집 추적 손실 조건을 재현하고 합성 크기 기준선을 재현한다. 첫 연결의 기능·책임·미확인 사항을 기록한다.                                                                     | 실제 원본이 미정이면 참조 서버로 검증을 진행하고 배포 판정은 보류한다.                               |
| G1   | 작성 계약 연결 후   | 저장 설정·액션이 문서 편집, undo/redo, 저장·로드, Preview·Publish로 왕복한다. 누락·충돌 키나 같은 대상 이중 쓰기는 연결 단계에서 진단한다.                                                     | 불완전한 연결의 수동 저장을 비활성화한다.                                                            |
| G2   | 세션 편집 구현 후   | 두 컴포넌트·페이지·조회가 초안을 공유한다. `3 → 8 전송 → 3 재편집`에서 성공·확정 거절·응답 유실의 상태가 각각 정답표와 일치한다.                                                               | 요청 당시 상태와 현재 편집을 분리하고 응답 순서별 회귀를 고정한다.                                   |
| G3   | 원본 계약 통합 후   | 동시 중복 및 응답 유실 뒤 실제 변경 1회, 한 행 충돌 시 반영 0건, 같은 ID·다른 본문 거절, 비정상 성공 응답에서 완료 표시 0건이다.                                                               | 해당 연결은 저장 완료를 표시할 수 없으며 원본의 트랜잭션과 응답 계약을 보완한다.                     |
| G4   | 인증·압축 통합 후   | 부적절한 행·필드·영수증 접근과 초기 데이터 쓰기 반영 0건, 요청 크기 제한과 조건부 gzip 검사가 통과한다. Preview에 운영 비밀 노출 0건이다.                                                      | 자격증명 경계가 확인될 때까지 연결을 끄고, 압축 검증만 실패하면 비압축으로 제한한다.                 |
| G5   | 실제 사용 경로 검증 | Builder Preview 테스트 연결과 배포 앱의 승인된 시험 환경에서 저장 버튼, 화면 밖 행, 충돌, 응답 유실, 조회·계산값 갱신을 검증한다. 무변경 0회·세 셀 한 배치·기존 즉시 저장 회귀 0건을 확인한다. | 참조 서버 통과와 실제 통합 결과를 따로 기록하고 실제 연결 검증 전에는 Implemented로 승격하지 않는다. |

## Consequences

### Positive

- 셀 편집은 화면에 즉시 반영되고 네트워크 쓰기는 사용자가 확정할 때 발생한다. 표가 커져도 저장 본문에는 수정 행의 ID·버전과 바뀐 필드만 포함된다.
- 원본의 행 버전과 저장 영수증을 통해 다른 사용자의 편집, 중복 클릭, 응답 유실을 구분한다. 같은 구현으로 Preview와 Publish에서 결과를 설명할 수 있다.

### Negative

- 작성자는 원본 키·버전·쓰기 연결을 설정해야 한다. 원자적 배치와 영수증을 갖추지 못한 외부 API는 첫 연결 대상이 될 수 없다.
- 탭을 닫기 전 전송하지 않은 초안은 세션 종료 시 사라진다. 행 단위 버전을 사용하므로 서로 다른 열을 수정한 사용자끼리도 충돌할 수 있고, 충돌한 한 행이 배치 전체의 재확정을 요구한다.
- 문서 계약 번호가 바뀌면 새 버전의 설정 생략과 예전 버전의 파일 로드를 구분해야 한다. 새 계약에서 수동 저장 설정을 생략한 프로젝트는 기존 방식으로 열린다. 로더가 지원하는 번호와 다른 저장 파일은 기존 `UNSUPPORTED_PROJECT_FORMAT` 정책에 따라 거절된다. [문서 검사](../../packages/shared/src/catalog/document/validation.ts#L2679) · [저장소 로더](../../packages/shared/src/catalog/runtime/storage.ts#L396)
