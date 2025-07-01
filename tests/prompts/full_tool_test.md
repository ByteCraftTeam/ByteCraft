### 1. 文件管理（file_manager_v2）

- 递归读取 src 目录下所有内容，忽略 node_modules 和 .git。
- 读取 README.md 文件内容。
- 批量创建 ww1、ww2 两个文件夹。
- 批量创建3个文件：ww1/test1.js、ww1/test2.js, ww2/test1.js，内容分别为 `console.log('A');`, `console.log('B');`和 `console.log('C');`。
- 删除 `ww2/test1.js` 文件。
- 批量删除 `ww1/test2.js` 和 `ww2` 文件夹。

---

### 2. 文件局部编辑（file_edit）

- 替换 `ww1/test1.js` 第1行内容为 `console.log('Replaced');`。
- 将 `console.log('Replaced');` 替换为 `console.log('C');`。
- 用正则将 `console.log('C');` 替换为 `console.log('D');`。
- 预览修改 `ww1/test1.js`，将第1行内容替换为 `console.log('Preview');`。

---

### 3. 命令执行（command_exec）

- 前台执行 `echo HelloAgent`。
- 后台启动 `node ww1/test1.js` 服务。
- 安装依赖包 `lodash`。
- 切换到 ww1 目录并执行 `ls` 或 `dir`。

---

### 4. 代码执行（code_executor）

- 执行 JavaScript 代码：`console.log('Hello from code_executor');`
- 执行 Python 代码：`print('Hello from code_executor')`
- 执行带环境变量的 Python 代码：`import os; print(os.environ.get('MY_VAR'))`，环境变量 `MY_VAR=test_value`

---

### 5. 代码库搜索（grep_search）

- 搜索所有包含 `function ` 的代码片段，最多返回5条。
- 用正则搜索所有 `console.log(...)` 语句，最多返回5条。

---

### 6. 项目分析（project_analyzer）

- 分析项目结构，最大深度2。
- 完整分析项目，输出技术栈和关键文件摘要。
