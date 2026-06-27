## 1. 配置与类型

- [x] 1.1 在配置结构中新增 `featuredPosting` 配置段（enabled、minContentChars、minImages、maxGenerateRetries、maxImageUploadRetries 等），并更新配置加载与默认值
- [x] 1.2 为精华 readiness 评估结果增加类型定义（eligible、reasons、mode、metrics），并补齐到发帖结果/日志需要的结构

## 2. 精华规则与 readiness 评估

- [x] 2.1 新增 Featured Posting Policy 模块，实现 readiness 评估（字数门槛、上传成功图片数门槛、原因列表）
- [x] 2.2 为 readiness 评估添加单元测试（字数不足、图片不足、全部达标、配置覆盖默认值）

## 3. 精华候选生成（文本）

- [x] 3.1 扩展帖子生成能力以支持 `featured` 模式（更严格 Prompt：结构化排版、原创真实、≥250字）
- [x] 3.2 调整/补充长度约束逻辑，使精华候选能稳定生成 250-500 字区间的正文
- [x] 3.3 为精华模式的 Prompt/解析增加测试（标题解析、正文长度门槛、格式要求）

## 4. 精华候选生成（图片）与上传补齐

- [x] 4.1 优化图片选择逻辑：精华候选至少选择 `minImages` 张候选图片（优先主题素材，不足则从素材库补齐）
- [x] 4.2 实现图片上传补齐重试：上传成功不足时追加新图片继续上传，直到达标或达到重试上限
- [x] 4.3 为“补齐重试与降级”补充测试（Mock 上传部分失败、补齐后达标、重试耗尽后降级）

## 5. AutoPostService 集成与降级策略

- [x] 5.1 在主题发帖与自由发帖路径中集成精华策略：先尝试精华候选→readiness 判定→必要时降级普通
- [x] 5.2 将 readiness 结果与降级原因写入日志，并在发帖结果（PostResult/历史记录）中可选输出
- [x] 5.3 增加集成测试覆盖“精华达标发布”和“精华不达标降级发布”两条主路径
- [x] 5.4 补充 change 级别集成测试用例（curl 命令）
