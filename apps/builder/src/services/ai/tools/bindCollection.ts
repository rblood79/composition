/**
 * bind_collection Tool — 요소에 collection 데이터 바인딩을 건다 (ADR-134 Phase 4, D3).
 *
 * `dataBinding` 은 **props 가 아니라 `x-composition` extension** 이다
 * (`canonicalDocumentStore` 의 `PROPS_FORBIDDEN_KEYS` / `EXTENSION_KEYS`) — 그래서 이 도구는
 * `updateNodeExtension` 을 경유한다. props 로 쓰면 저장 시점에 걸러진다.
 *
 * 읽는 쪽은 `useCollectionData({ dataBinding })` 하나뿐이라 (ADR-132), 이 도구가 만드는
 * 형태도 그 계약에 맞춘다: `source` 는 `static | api | supabase` 이고 그 외는 거부한다.
 * collections(dataTable) 자체의 생성·수정은 이 도구 범위 밖이다 — 데이터 소스를 만드는 것은
 * 사용자 승인 영역이고, 여기서는 **이미 있는 데이터에 요소를 잇는 것**만 한다.
 */
// extension 에 저장되는 형태는 `SerializedDataBinding` 이다 — `DataBinding` 과 필드는 같고
// index signature 만 더 있다 (`canonical` 저장 계약).
import type { SerializedDataBinding } from "@composition/shared";
import type {
  ToolExecutor,
  ToolExecutionResult,
} from "../../../types/integrations/ai.types";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { runCanonicalMutation } from "../../../adapters/canonical/canonicalMutationRunner";
import { getAiToolReadModel } from "./canonicalToolReadModel";

const SUPPORTED_SOURCES = ["static", "api", "supabase"] as const;
type SupportedSource = (typeof SUPPORTED_SOURCES)[number];

function isSupportedSource(value: unknown): value is SupportedSource {
  return (
    typeof value === "string" &&
    (SUPPORTED_SOURCES as readonly string[]).includes(value)
  );
}

/** source 별 최소 config — 없으면 렌더 시점에야 실패하므로 여기서 막는다. */
function validateConfig(
  source: SupportedSource,
  config: Record<string, unknown>,
): string | null {
  if (source === "static") {
    return Array.isArray(config.data)
      ? null
      : "static 바인딩은 config.data 배열이 필요합니다.";
  }
  if (source === "api") {
    return config.baseUrl && config.endpoint
      ? null
      : "api 바인딩은 config.baseUrl 과 config.endpoint 가 필요합니다.";
  }
  return config.table ? null : "supabase 바인딩은 config.table 이 필요합니다.";
}

export const bindCollectionTool: ToolExecutor = {
  name: "bind_collection",

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const elementIdArg = args.elementId as string | undefined;
    if (!elementIdArg) {
      return { success: false, error: "elementId는 필수입니다." };
    }

    const source = args.source;
    if (!isSupportedSource(source)) {
      return {
        success: false,
        error: `source 는 ${SUPPORTED_SOURCES.join(" / ")} 중 하나여야 합니다.`,
      };
    }

    const config =
      args.config &&
      typeof args.config === "object" &&
      !Array.isArray(args.config)
        ? (args.config as Record<string, unknown>)
        : {};

    const configError = validateConfig(source, config);
    if (configError) return { success: false, error: configError };

    try {
      const {
        elementsById,
        state: { selectedElementId },
      } = getAiToolReadModel();

      const targetId =
        elementIdArg === "selected" ? selectedElementId : elementIdArg;
      if (!targetId) {
        return { success: false, error: "선택된 요소가 없습니다." };
      }

      const element = elementsById.get(targetId);
      if (!element) {
        return {
          success: false,
          error: `요소를 찾을 수 없습니다: ${targetId}`,
        };
      }

      const dataBinding: SerializedDataBinding = {
        type: "collection",
        source,
        config,
      };

      // ADR-184 — 신규 mutation 은 러너가 유일 경로다 (canonical → store → rebuild →
      // history → persist). 직접 store 를 부르면 persist 와 인덱스 재빌드가 빠져
      // 새로고침에 사라지고 캔버스가 옛 값을 그린다.
      runCanonicalMutation({
        canonical: () => {
          useCanonicalDocumentStore
            .getState()
            .updateNodeExtension(targetId, { dataBinding });
          const store = useCanonicalDocumentStore.getState();
          return {
            changed: true,
            document: store.currentProjectId
              ? (store.documents.get(store.currentProjectId) ?? null)
              : null,
          };
        },
        history: {
          skip:
            "데이터 바인딩은 Data 패널과 같은 canonical-only 경로 — 되돌리기 단위는 " +
            "요소 편집이 아니라 바인딩 설정이라 별도 기록하지 않는다",
        },
      });

      return {
        success: true,
        data: {
          elementId: targetId,
          type: element.type,
          dataBinding,
        },
        affectedElementIds: [targetId],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
