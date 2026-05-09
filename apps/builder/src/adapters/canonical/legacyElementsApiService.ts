import { BaseApiService } from "../../services/api/BaseApiService";
import { Element } from "../../types/core/store.types";

/**
 * `ElementsApiService` — legacy `elements` row CRUD.
 *
 * **ADR-123 Phase 1 boundary-only marker**:
 * - 본 service 는 ADR-123 의 **legacy boundary adapter**. canonical primary
 *   storage 는 `DocumentsApiService` (1 project = 1 `CompositionDocument` row).
 * - **Builder hot path (예: editor / canvas / store hot subscription) 에서 직접
 *   import 금지**. ADR-123 Phase 4 에서 hot path import 0건 grep gate 강제.
 * - 허용 caller (Phase 1 시점):
 *   1. `apps/builder/src/utils/projectSync.ts` (cloud sync boundary)
 *   2. `apps/builder/src/dashboard/index.tsx` (dashboard seed, Phase 3 에서
 *      `documentsApi.upsertDocument` 로 전환 예정)
 *   3. `apps/builder/src/adapters/canonical/canonicalMutations.ts` thin wrapper
 *      (Phase 4 에서 제거 또는 documents row API 위임)
 *   4. `apps/builder/src/builder/factories/utils/dbPersistence.ts` (Phase 4
 *      reassessment)
 * - 신규 caller 추가 금지. 신규 cloud persistence 는 `DocumentsApiService` 경유.
 *
 * @see docs/adr/123-cloud-document-row-schema.md
 * @see apps/builder/src/services/api/DocumentsApiService.ts
 */
export class ElementsApiService extends BaseApiService {
  async fetchElements(pageId: string): Promise<Element[]> {
    this.validateInput(
      pageId,
      (id) => typeof id === "string" && id.length > 0,
      "fetchElements",
    );

    const elements = await this.handleApiCall("fetchElements", async () => {
      return await this.supabase
        .from("elements")
        .select("*")
        .eq("page_id", pageId);
    });

    // Supabase snake_case를 camelCase로 변환
    return elements.map((el: Record<string, unknown>) => ({
      ...el,
      customId: el.custom_id,
      dataBinding: el.data_binding,
      componentRole: el.component_role,
      masterId: el.master_id,
      componentName: el.component_name,
      variableBindings: el.variable_bindings,
    })) as Element[];
  }

  async createElement(element: Partial<Element>): Promise<Element> {
    this.validateInput(
      element,
      (el) => el && typeof el === "object",
      "createElement",
    );

    // camelCase → snake_case 변환
    const elementToSave: Record<string, unknown> = {
      ...element,
      custom_id: (element as { customId?: string }).customId,
      data_binding: (element as { dataBinding?: unknown }).dataBinding,
      component_role: (element as { componentRole?: string }).componentRole,
      master_id: (element as { masterId?: string }).masterId,
      component_name: (element as { componentName?: string }).componentName,
      variable_bindings: (element as { variableBindings?: string[] })
        .variableBindings,
    };

    // camelCase 필드 제거 (snake_case로 변환되었으므로)
    delete elementToSave.customId;
    delete elementToSave.dataBinding;
    delete elementToSave.componentRole;
    delete elementToSave.masterId;
    delete elementToSave.componentName;
    delete elementToSave.variableBindings;

    const result = await this.handleApiCall("createElement", async () => {
      return await this.supabase
        .from("elements")
        .insert([elementToSave])
        .select("*")
        .single();
    });

    // 응답을 camelCase로 변환
    if (!result) {
      throw new Error("createElement returned null");
    }
    const data = result as Record<string, unknown>;
    return {
      ...data,
      customId: data.custom_id,
      dataBinding: data.data_binding,
      componentRole: data.component_role,
      masterId: data.master_id,
      componentName: data.component_name,
      variableBindings: data.variable_bindings,
    } as Element;
  }

  async createMultipleElements(
    elements: Partial<Element>[],
  ): Promise<Element[]> {
    this.validateInput(
      elements,
      (els) => Array.isArray(els) && els.length > 0,
      "createMultipleElements",
    );

    // 각 element에 대해 camelCase → snake_case 변환
    const elementsToSave = elements.map((element) => {
      const converted: Record<string, unknown> = {
        ...element,
        custom_id: (element as { customId?: string }).customId,
        data_binding: (element as { dataBinding?: unknown }).dataBinding,
        component_role: (element as { componentRole?: string }).componentRole,
        master_id: (element as { masterId?: string }).masterId,
        component_name: (element as { componentName?: string }).componentName,
        variable_bindings: (element as { variableBindings?: string[] })
          .variableBindings,
      };
      delete converted.customId;
      delete converted.dataBinding;
      delete converted.componentRole;
      delete converted.masterId;
      delete converted.componentName;
      delete converted.variableBindings;
      return converted;
    });

    const result = await this.handleApiCall(
      "createMultipleElements",
      async () => {
        return await this.supabase
          .from("elements")
          .insert(elementsToSave)
          .select("*");
      },
    );

    // 응답을 camelCase로 변환
    if (Array.isArray(result)) {
      return result.map((el: Record<string, unknown>) => ({
        ...el,
        customId: el.custom_id,
        dataBinding: el.data_binding,
        componentRole: el.component_role,
        masterId: el.master_id,
        componentName: el.component_name,
        variableBindings: el.variable_bindings,
      })) as Element[];
    }
    return [];
  }

  async updateElement(
    elementId: string,
    updates: Partial<Element>,
  ): Promise<Element> {
    this.validateInput(
      elementId,
      (id) => typeof id === "string" && id.length > 0,
      "updateElement",
    );
    this.validateInput(
      updates,
      (u) => u && typeof u === "object",
      "updateElement",
    );

    // camelCase → snake_case 변환
    const updatesToSave: Record<string, unknown> = { ...updates };
    if ((updates as { customId?: string }).customId !== undefined) {
      updatesToSave.custom_id = (updates as { customId?: string }).customId;
      delete updatesToSave.customId;
    }
    if ((updates as { dataBinding?: unknown }).dataBinding !== undefined) {
      updatesToSave.data_binding = (
        updates as { dataBinding?: unknown }
      ).dataBinding;
      delete updatesToSave.dataBinding;
    }
    if ((updates as { componentRole?: string }).componentRole !== undefined) {
      updatesToSave.component_role = (
        updates as { componentRole?: string }
      ).componentRole;
      delete updatesToSave.componentRole;
    }
    if ((updates as { masterId?: string }).masterId !== undefined) {
      updatesToSave.master_id = (updates as { masterId?: string }).masterId;
      delete updatesToSave.masterId;
    }
    if ((updates as { componentName?: string }).componentName !== undefined) {
      updatesToSave.component_name = (
        updates as { componentName?: string }
      ).componentName;
      delete updatesToSave.componentName;
    }
    if (
      (updates as { variableBindings?: string[] }).variableBindings !==
      undefined
    ) {
      updatesToSave.variable_bindings = (
        updates as { variableBindings?: string[] }
      ).variableBindings;
      delete updatesToSave.variableBindings;
    }

    const result = await this.handleApiCall("updateElement", async () => {
      return await this.supabase
        .from("elements")
        .update(updatesToSave)
        .eq("id", elementId)
        .select("*")
        .single();
    });

    // 응답을 camelCase로 변환
    if (!result) {
      throw new Error("updateElement returned null");
    }
    const data = result as Record<string, unknown>;
    return {
      ...data,
      customId: data.custom_id,
      dataBinding: data.data_binding,
      componentRole: data.component_role,
      masterId: data.master_id,
      componentName: data.component_name,
      variableBindings: data.variable_bindings,
    } as Element;
  }

  async updateElementProps(
    elementId: string,
    props: Record<string, unknown>,
  ): Promise<Element> {
    this.validateInput(
      elementId,
      (id) => typeof id === "string" && id.length > 0,
      "updateElementProps",
    );
    this.validateInput(
      props,
      (p) => p && typeof p === "object",
      "updateElementProps",
    );

    return this.handleApiCall("updateElementProps", async () => {
      return await this.supabase
        .from("elements")
        .update({ props })
        .eq("id", elementId)
        .select("*")
        .single();
    });
  }

  async deleteElement(elementId: string): Promise<void> {
    this.validateInput(
      elementId,
      (id) => typeof id === "string" && id.length > 0,
      "deleteElement",
    );

    await this.handleDeleteCall("deleteElement", async () => {
      return await this.supabase.from("elements").delete().eq("id", elementId);
    });
  }

  async deleteMultipleElements(elementIds: string[]): Promise<void> {
    this.validateInput(
      elementIds,
      (ids) => Array.isArray(ids) && ids.length > 0,
      "deleteMultipleElements",
    );

    await this.handleDeleteCall("deleteMultipleElements", async () => {
      return await this.supabase.from("elements").delete().in("id", elementIds);
    });
  }

  // 별칭으로 getElementsByPageId 추가 (코드 중복 방지)
  getElementsByPageId = this.fetchElements;
}

// 싱글톤 인스턴스
export const elementsApi = new ElementsApiService();
