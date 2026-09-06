import type { CompositionDocument } from "@composition/shared";
import type { DatabaseAdapter, DocumentPersistOptions } from "../../../lib/db";
import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

interface PersistedCanonicalDocument {
  projectId: string;
  document: CompositionDocument;
}

/**
 * DB 초기화를 기다리기 전에 활성 문서를 캡처한다. 저장 중 프로젝트가 바뀌어도
 * 같은 문서를 저장하고 후속 fan-out에 돌려준다. 오류 처리는 호출자가 소유한다.
 */
export async function persistActiveCanonicalDocument(
  database: DatabaseAdapter | (() => Promise<DatabaseAdapter>),
  options?: DocumentPersistOptions,
): Promise<PersistedCanonicalDocument | null> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;
  const document = canonical.documents.get(projectId);
  if (!document) return null;
  const db = typeof database === "function" ? await database() : database;
  if (options === undefined) await db.documents.put(projectId, document);
  else await db.documents.put(projectId, document, options);
  return { projectId, document };
}
