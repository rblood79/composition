import type { CanonicalNode } from "@composition/shared";
import { getCanonicalRefPathSegment } from "./canonicalRefResolution";
import { readLegacyMetadataCustomId } from "./legacyMetadata";

/**
 * canonical 문서 노드의 scene path 구간 이름 — scene 노드 합성 id (`<row>/<path>` · `<ref>/<path>`) 를
 * 만드는 `getCanonicalRefPathSegment` (customId ‖ componentName ‖ name ‖ id) 와 같은 규칙이다. 문서 노드는
 * customId 를 legacy metadata 안에 두므로 그것을 먼저 읽는다 (element 모양은 최상위 `customId`).
 *
 * scene id 를 되읽는 쪽 (ADR-150 A3' origin 해석) 전용이다. descendants 쓰기 키 · Preview resolver 는
 * name ‖ id 규칙이라 (`collectionItemInsert` · `tableColumnInsert` · `resolvers/canonical`) 이 함수로
 * 바꾸면 Canvas 에만 쓰기가 반영된다 — 규칙 통합은 별도 작업.
 */
export function getCanonicalNodePathSegment(node: CanonicalNode): string {
  const record = node as CanonicalNode & {
    customId?: string | null;
    componentName?: string | null;
  };
  return getCanonicalRefPathSegment({
    id: node.id,
    customId: record.customId || readLegacyMetadataCustomId(node.metadata),
    componentName: record.componentName,
    name: node.name,
  });
}
