# C 档：数据地基（项目档案 + 数据中间层 + 审计留痕）PRD

**BE:** 🤖 Claude &nbsp;&nbsp; **FE:** 🤖 Claude &nbsp;&nbsp; **Design:** 🤖 Claude（沿用现有设计系统） &nbsp;&nbsp; **PM:** 👤 Wei Jie &nbsp;&nbsp; **QA:** 🤖 Claude 自动化 + 👤 Wei Jie 验收

**Related links**
[AGENTS.md（数据契约）](../../AGENTS.md) · [B 档 PR #19](https://github.com/inhousemarketinghub/funnel-dashboard/pull/19) · [PR #20](https://github.com/inhousemarketinghub/funnel-dashboard/pull/20)

## 👥 分工总表（谁做什么）

| 阶段 | 🤖 Claude | 👤 Wei Jie |
|---|---|---|
| Phase 1 数据库与同步 | 建表、写同步管道、写档案编辑界面 | 无 |
| Phase 2 双轨对账 | dashboard 读库路径、对账工具 | 无 |
| Phase 3 灰度切换 | 切 Rygis、逐客户切换、审计上线 | 每切一家后花 2 分钟对一眼数字；确认后批准切下一家 |
| 验收 | 提供对账报告 | 按 QA 清单最后一节人工点验 |

---

## ✨ Context

- Dashboard 目前每次打开都**实时拉 Google 表格现场解析**：表格 = 数据库 + 录入界面 + 计算引擎三合一。
- 2026-08 的 A/B 档已解决：解析可诊断（诊断页）、歧义可见、未追踪≠0、读表走 service account。但架构性问题仍在：历史可被无声改动、打开速度受 Google 限制、每个客户的特殊规则写死在代码里。
- 实战证据（全部真实发生）：Est.Show Up 吃掉 Showed Up 数月未被发现（#14）；Carress@BD 重排表列后 orders 静默变垃圾数（#21）；Rygis「Paid Ads 口径」规则只存在业主脑中导致误判「漏记」。

## ✨ Problem

1. **特殊需求 = 改代码**：客户的 tab 名、列别名、source 过滤、漏斗类型全部硬编码/推断，新特殊需求都要开发介入。
2. **历史不可追溯**：表格任何人可改任何月份，改了无痕迹；已发客户的月报与 dashboard 可能悄悄不一致，无法回答「谁、何时、原值多少」。
3. **性能与可用性**：页面打开要等多次 Google API 往返；Google 挂/配额尽 = dashboard 空白。
4. **多真相源**：funnel type 有三个来源（表头推断 / DB 字段 / 接入扫描器），互相可能矛盾（诊断页现在只是把矛盾显示出来）。
5. **时区错位**：「本月/今天」按服务器 UTC 计算，马来西亚早上 8 点前日期边界差一天。

## ✨ User Profile

- **业主（Wei Jie）**：非技术。要的是数字可信、可对账、出问题 30 秒自查、新客户接入不求人。
- **客户（agency 的客户）**：viewer 角色看 dashboard，要求打开快、数字与自己认知一致。
- **Data entry 团队**：只操作 Google 表格，**工作流程不能变**。

## ✨ Solution Options

- **Option A 轻版**：只做项目档案（配置化），读表方式不变。→ 解决问题 1、4，不解决 2、3。
- **Option B 全套**：表格照用，数据定时同步进 Supabase（同步时校验），dashboard 读库。→ 解决 1-5 全部。
- **Option C 换录入**：数据录入搬进 app，表格弃用。→ 动团队习惯，风险最大。

**→ Selected approach: Option B（业主 2026-08-23 拍板），上线采用逐客户灰度（Rygis 先行）。**

## ✨ Northstar / Objective

> 任何客户的 dashboard 秒开；每个数字能回答「从哪来、何时变过、原值多少」；新客户的特殊规则 95% 通过档案配置解决，不改代码。

## ✨ V1 Solution

### 1. 项目档案（Project Profile）
每个客户一份结构化档案（Supabase `clients.profile` JSONB），Settings 页可编辑（owner/manager）：
- 漏斗类型（显式声明，**取代**三处推断 —— 单一真相源）
- Performance tab 匹配规则覆盖 / 列别名（如 BD 的 "Signed Up"→orders）
- Paid Ads source 清单（如 Rygis: FB/IG/WhatsApp）+ 各功能默认口径
- 数据源开关：`sheets`（现状）/ `db`（新管道）——灰度用

### 2. 同步管道（Sheets → Supabase）
- 新表：`daily_metrics`（client, brand, date 唯一键）+ `lead_rows`（lead 级）+ `sync_runs`（每次同步记录）
- 触发：**沿用现有节奏** —— 15 分钟定时（Vercel Cron）+「立即刷新数据」按钮手动触发（按钮语义不变）
- 同步时执行校验（复用 diagnosePerfColumns + sanity checks）：解析异常的行进隔离区（quarantine），不污染正式数据；诊断页显示隔离内容
- Google 挂了 → dashboard 照常读库（显示「数据截至 HH:MM」）

### 3. 审计留痕（改要留痕，不是禁改）
- 同步发现数值变化 → `data_changes` 记录（客户、日期、指标、旧值→新值、发现时间）
- 月报生成时快照当月合计；之后该月数据变动 → dashboard 该月显示「⚠ 本月数据在报告生成后有更新」角标，点开见变更清单
- 会计类比：划线更正 + 签名，不用涂改液

### 4. 统一与修正
- 全部日期边界按 **Asia/Kuala_Lumpur**
- 日期解析歧义（05/08 类）在同步校验层拦截告警
- Trends / Overview / 月报 / 人员业绩全部改读库（消灭多套口径实现）

### 5. 诊断页扩展
- 新增「同步状态」卡：上次同步时间/结果、隔离区行数、近期 data_changes 摘要

## ✨ Engineering Requirements (V1)

- Supabase migrations：`daily_metrics`、`lead_rows`、`sync_runs`、`data_changes`、`report_snapshots`；`clients.profile` JSONB；全部 RLS
- 同步器为幂等 upsert，以 (client_id, brand, date) 为键；lead 行以内容指纹去重
- 解析层唯一入口仍是 `lib/sheets.ts` 规则（档案作为规则覆盖注入 `PERF_COL_RULES`/tab 规则），禁止第二套解析实现
- `data_source` 开关在读取层分流：`db` 读 Supabase，`sheets` 走现有路径 —— 两路径共用同一 UI 组件与指标计算
- 对账工具：给定客户+日期范围，DB 路径与 live-sheet 路径逐指标比对，输出差异表（灰度验收的硬门槛：**零差异**）
- Vercel Cron 每 15 分钟；手动刷新按钮改为触发同步 + revalidate
- 时区：统一 `Asia/Kuala_Lumpur` 日期工具，替换 `lib/dates.ts` 内所有 `new Date()` 边界计算
- 密钥零入库入日志；审计表不存任何客户 PII 之外新增字段

## ✨ V2 Solution（本期不做，V1 不得阻断）

- 变更人识别（Google Drive Activity API 查「谁改的」）
- 预算推演 / 其他 Lead 表消费方接入 source 过滤与档案口径
- 告警（诊断页外的主动通知 —— 业主此前明确不要 Telegram，V2 再议形态）
- App 内数据录入表单（Option C 的将来式）
- 客户自助接入向导升级（档案化 onboarding）

## ✨ QA Checklist

- [ ] 对账零差异：Rygis + 一个 walk-in 客户 + 一个多品牌客户，近 3 个月逐指标 DB vs live-sheet 一致
- [ ] 刷新按钮：表格改数 → 点击 → 60 秒内 dashboard 反映
- [ ] Google API 不可用时 dashboard 正常展示库内数据 + 时间戳
- [ ] 手滑场景：改动上月某格 → data_changes 出现记录 → 报告角标出现
- [ ] 灰度回滚：`data_source` 切回 `sheets` 立即生效、无残留
- [ ] 时区：MYT 00:00-08:00 之间「本月/今天」边界正确（模拟时钟测试）
- [ ] 权限：档案编辑仅 owner/manager；viewer 无入口且直连 URL 被拒
- [ ] 现有 174+ 测试全绿；新增同步器/对账/档案覆盖测试
- [ ] 👤 业主人工验收：Rygis 切库后自查一轮数字 + 诊断页同步卡

## ✨ Analytics Requirements

- `sync_runs` 即内建监控：成功率、时长、隔离行数（诊断页可视）
- 页面打开耗时前后对比（切库前后各记录一次 Vercel Analytics 数据作证据）

## ✨ Timeline & Release Notes

| 阶段 | 内容 | 预计 | 出口条件 |
|---|---|---|---|
| Phase 1 | 建表 + 项目档案 + 同步管道 + 档案编辑 UI | ~1 周 | 全客户数据入库、sync_runs 连续 3 天无失败 |
| Phase 2 | 读库路径 + 对账工具 + 时区统一 | ~1 周 | 对账零差异（3 客户 × 3 月） |
| Phase 3 | 审计 + 诊断页扩展 + Rygis 灰度 → 全量 | ~1 周 | Rygis 跑 1 周无异常 → 业主批准逐个切换 |

每阶段一组 PR，CI 全绿才合并；灰度期任何异常一键回滚 `sheets`。

---
*2026-08-23 由 Wei Jie 拍板 Option B + 灰度策略。范围模式：Expansion（为扩客户数投资，非修 bug）。*
