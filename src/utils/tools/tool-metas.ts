import { ToolMeta } from '../../types/tool';

// 所有工具的元信息注册表
export const TOOL_METAS: ToolMeta[] = [
  {
    name: 'file_manager_v2',
    description: '精简版文件管理工具，专注递归读取、批量创建、精确修改、删除等核心操作。',
    promptKey: 'file_manager_v2',
  },
  {
    name: 'file_edit',
    description: '专用文件局部修改工具，支持基于行号、文本、正则的精确修改和批量预览。',
    promptKey: 'file_edit',
  },
  {
    name: 'command_exec',
    description: '命令执行工具，支持跨平台前台/后台命令、进程管理、自动目录重置。',
    promptKey: 'command_exec',
  },
  {
    name: 'code_executor',
    description: '代码执行工具，支持多语言安全执行、超时控制、环境变量注入。',
    promptKey: 'code_executor',
  },
  {
    name: 'grep_search',
    description: '代码库搜索工具，支持正则/文本搜索、递归、上下文显示、排除目录、统计等。',
    promptKey: 'grep_search',
  },
  {
    name: 'project_analyzer',
    description: '项目分析工具，智能分析项目结构、关键文件、技术栈和生成分析报告。',
    promptKey: 'project_analyzer',
  },
];

export function getAllToolMetas(): ToolMeta[] {
  return TOOL_METAS;
}
