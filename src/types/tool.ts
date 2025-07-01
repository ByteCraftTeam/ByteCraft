// 工具元信息类型，统一描述所有可用工具
export interface ToolMeta {
  name: string;
  description?: string;
  promptKey?: string; // 对应 tool-prompts 的 key
}
