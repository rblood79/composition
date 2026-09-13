import { describe, expect, it, vi } from "vitest";
import { importCollectionEnvelope } from "./importCollectionEnvelope";
import type { ProjectExportData } from "@composition/shared";

describe("ADR-209 공통 JSON 데이터 소스 복원", () => {
  it("이름 바인딩과 ref 설정을 보존하고 ID 바인딩만 대상 프로젝트에 연결한다", async () => {
    const createDataTable = vi.fn(async (config) => ({...config,id:"new-table"}));
    const setRuntimeData = vi.fn();
    const createApiEndpoint = vi.fn(async (config) => ({...config,id:"new-api"}));
    const store = {collections:new Map(),apiEndpoints:new Map(),variables:new Map(),createDataTable,setRuntimeData,createApiEndpoint,updateCollection:vi.fn(),updateApiEndpoint:vi.fn(),applyDataChange:vi.fn()};
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
  it("ADR-214 — envelope 의 variables 를 define_variable 한 DataChange 로 복원: 같은 이름은 그 id 로 갱신, 없으면 envelope id 로 생성", async () => {
    const applyDataChange = vi.fn(async (_change: unknown, _options?: unknown) => ({}));
    const store = {collections:new Map(),apiEndpoints:new Map(),variables:new Map([["userName",{id:"local-user",name:"userName"}]]),createDataTable:vi.fn(),setRuntimeData:vi.fn(),createApiEndpoint:vi.fn(),updateCollection:vi.fn(),updateApiEndpoint:vi.fn(),applyDataChange};
    const document={version:"composition-1.0",children:[]} as unknown as ProjectExportData["document"];
    const data={document,variables:[
      {id:"exp-user",name:"userName",type:"string",defaultValue:"Ana",persist:true},
      {id:"exp-count",name:"count",type:"number"},
    ]} as unknown as ProjectExportData;
    await importCollectionEnvelope("target",data,store as unknown as Parameters<typeof importCollectionEnvelope>[2]);
    expect(applyDataChange).toHaveBeenCalledTimes(1);
    expect(applyDataChange.mock.calls[0][0]).toMatchObject({ops:[
      {op:"define_variable",variableId:"local-user",definition:{name:"userName",type:"string",defaultValue:"Ana",persist:true}},
      {op:"define_variable",variableId:"exp-count",definition:{name:"count",type:"number",persist:false}},
    ]});
    expect(applyDataChange.mock.calls[0][1]).toEqual({projectId:"target"});
  });
});
