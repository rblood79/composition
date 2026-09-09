import { describe, expect, it, vi } from "vitest";
import { importCollectionEnvelope } from "./importCollectionEnvelope";
import type { ProjectExportData } from "@composition/shared";

describe("ADR-209 공통 JSON 데이터 소스 복원", () => {
  it("이름 바인딩과 ref 설정을 보존하고 ID 바인딩만 대상 프로젝트에 연결한다", async () => {
    const createDataTable = vi.fn(async (config) => ({...config,id:"new-table"}));
    const setRuntimeData = vi.fn();
    const createApiEndpoint = vi.fn(async (config) => ({...config,id:"new-api"}));
    const store = {collections:new Map(),apiEndpoints:new Map(),createDataTable,setRuntimeData,createApiEndpoint,updateCollection:vi.fn(),updateApiEndpoint:vi.fn()};
    const document = {version:"composition-1.0",children:[
      {id:"legacy",type:"Chart",props:{dataBinding:{source:"dataTable",name:"sales"},curve:"step"}},
      {id:"reference",type:"ref",ref:"legacy",props:{dataBinding:{source:"dataTable",name:"old-table"},animationDuration:200}},
    ]} as unknown as ProjectExportData["document"];
    const data = {document,collections:[{id:"old-table",name:"sales",useMockData:false,mockData:[{id:"mock"}],runtimeData:[]}],
      apiEndpoints:[{id:"old-api",name:"sales-api",baseUrl:"https://example.invalid",path:"/rows",responseMapping:{dataPath:"rows"}}]} as unknown as ProjectExportData;
    const restored = await importCollectionEnvelope("target", data, store);
    expect(createDataTable).toHaveBeenCalledWith(expect.objectContaining({project_id:"target",name:"sales",useMockData:false}));
    expect(setRuntimeData).toHaveBeenCalledWith("sales", []);
    expect(createApiEndpoint).toHaveBeenCalledWith(expect.objectContaining({responseMapping:{dataPath:"rows"}}));
    expect(restored.children[0]).toEqual(document.children[0]);
    expect(restored.children[1]).toMatchObject({type:"ref",ref:"legacy",props:{dataBinding:{name:"new-table"},animationDuration:200}});
    expect(document.children[1].props?.dataBinding).toEqual({source:"dataTable",name:"old-table"});
  });
  it("envelope 없는 기존 파일은 canonical document를 그대로 반환한다",async()=>{
    const document={version:"composition-1.0",children:[]} as unknown as ProjectExportData["document"];
    const result=await importCollectionEnvelope("target",{document} as ProjectExportData,{} as Parameters<typeof importCollectionEnvelope>[2]);
    expect(result).toBe(document);
  });
});
