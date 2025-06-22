export class BasePrompts {
  // 系统提醒消息
  systemReminder = "";
  
  // 工具执行结果消息
  toolSuccess = "✅ 工具执行成功";
  toolError = "❌ 工具执行失败: {error}";
  
  // 文件操作消息
  filesContentPrefix = `📁 我已将这些文件添加到对话中，您可以直接编辑它们：

*请以此消息为准，这是文件的真实内容！*
对话中的其他消息可能包含过期的文件版本。
`;

  filesContentAssistantReply = "好的，我会基于这些文件的当前内容进行操作。";
  
  filesNoFullFiles = "目前还没有添加完整的文件内容。";
    // 仓库内容前缀
  repoContentPrefix = `📂 以下是 git 仓库中的文件摘要：
请不要修改这些*只读*文件，除非先询问我将它们添加到对话中。
`;

  // 只读文件前缀
  readOnlyFilesPrefix = `📖 以下是一些只读文件，仅供参考：
请勿编辑这些文件！
`;

  // 工具描述模板
  toolDescriptions: Record<string, string> = {
    fileManager: `文件管理工具 - 用于读取、写入、创建、删除文件
使用格式: {"action": "read|write|create|delete", "path": "文件路径", "content": "内容(写入时)"}`,
      commandExec: `命令执行工具 - 支持前台和后台命令执行
使用格式: {"action": "foreground|background|list|kill", "command": "命令", "processId": "进程ID(终止时)"}`,
    
    codeExecutor: `代码执行工具 - 在安全环境中执行代码
使用格式: {"language": "python|javascript|typescript", "code": "代码内容"}`,
    
    webSearch: `网络搜索工具 - 搜索最新信息
使用格式: 直接输入搜索关键词`,
  };

  // 平台相关信息
  platformInfo = "当前运行环境: {platform}";
  
  // 最终提醒
  finalReminders = "";
  
  // 主系统提示词 - 子类需要重写
  mainSystem = "";
}
