import { useParams } from "react-router";
import { CatalogBuilderCore } from "./main/CatalogBuilderCore";

/**
 * ADR-248 Phase 4e: the Builder opens catalog projects only (the old `BuilderCore` retires in
 * 4e-7). One mount per project: another project starts from a fresh open state.
 */
function Builder() {
  const { projectId } = useParams<{ projectId: string }>();
  return <CatalogBuilderCore key={projectId} />;
}

export default Builder;
