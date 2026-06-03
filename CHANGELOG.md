# 更新日志

## 1.3.0 (2026-06-03)

### 重大变更
- **流程重构为三引擎架构**：发散引擎(头脑风暴)→推演引擎(子agent)→仲裁引擎(汇总决策)
- 每个引擎有独立可验证产出，不可跳过
- 头脑风暴改为可多轮循环：发散→发现缺信息→问用户→获得新信息→再发散
- 推演引擎中子 agent 问用户不阻塞其他子 agent 运行
- 各平台部署文件全部同步更新（cursor/opencode/trae/codex）

---

## 1.2.0 (2026-06-03)
- **项目结构重构**：从"Claude Code 专属"改为"通用规则 + 多平台部署"
- 核心规则抽离到 `rules/RULES.md`，不绑定任何平台
- 各平台部署文件放在 `deploy/` 目录下（Claude Code / Cursor / OpenCode / Trae / CodeX）

### 新增
- `rules/RULES.md`：通用决策规则总纲（纯文本，不绑定平台）
- `deploy/cursor/`：Cursor 部署配置
- `deploy/opencode/`：OpenCode 部署说明
- `deploy/trae/`：Trae 部署说明
- `deploy/codex/`：CodeX 部署说明

### 变更
- 旧 `plugins/` 目录迁移到 `deploy/claude-code/`
- `agents/` 目录迁移到 `deploy/claude-code/agents/`
- 根目录 `README.md` 增加多平台安装说明

---

## 1.1.1 (2026-06-03)
- **推演结果自检**（第3.5步）：执行前自我质疑，找漏洞、反向思考、风险评估，防止推演错了还按错的执行
- **跳过机制**：用户在任何阶段说"直接做""别推了"，立即中止推演进入执行
- **熔断机制**：记录推演准确率，低于70%自动降级，低于50%暂停推演

### 优化
- 触发检测逻辑：从"指定类型才触发"改为"任何任务都检测是否有多种做法"，触发率大幅提高
- 删除重复的触发规则章节，精简 SKILL.md

### 变更
- 知识召回算法重写：从"多路并行召回+算分排序"改为"联想回忆+碎片补全+外部求证"
- 记忆存储分层：active（当前意识）+ archive（长期记忆），模拟人脑遗忘与回忆

---

## 1.1.0 (2026-06-03)

### 新增
- agents/openai.yaml 接口定义
- agents/mcts-decider.md agent 定义
- 插件市场支持（.claude-plugin/plugin.json + marketplace.json）
- 项目结构调整为插件格式（plugins/mcts-td-planner/）

### 优化
- README 重写为通用语言，去技术化
- 移除第三方项目引用

---

## 1.0.0 (2026-06-03)

### 初始版本
- MCTS-TD Planner Skill 核心框架
- 多方案独立推演决策引擎
- 知识图谱价值函数管理
- 跨会话持续学习