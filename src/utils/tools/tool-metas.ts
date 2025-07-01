import { ToolMeta } from '../../types/tool';

// 所有工具的元信息注册表
export const TOOL_METAS: ToolMeta[] = [
  {
    name: 'file_manager_v2',
    description: '文件管理工具V2，支持递归读取、批量创建、精确修改、删除等操作。',
    promptKey: 'file_manager',
  },
  {
    name: 'command_exec',
    description: '命令执行工具，支持前台/后台命令、进程管理等。',
    promptKey: 'command_exec',
  },
  {
    name: 'code_executor',
    description: '代码执行工具，支持多语言代码安全执行。',
    promptKey: 'code_executor',
  },
  {
    name: 'grep_search',
    description: '代码库搜索工具，支持正则/文本搜索、上下文显示等。',
    promptKey: 'grep_search',
  },
];

export function getAllToolMetas(): ToolMeta[] {
  return TOOL_METAS;
}
