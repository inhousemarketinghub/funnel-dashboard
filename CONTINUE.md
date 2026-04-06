# Funnel Dashboard — Continuation Guide

> 新 session 读这个文件即可接续工作。

## 项目位置
`/Users/khoweijie/Documents/funnel-dashboard`

## 已完成 ✅
- Next.js 16 + Tailwind v4 + shadcn/ui (base-nova) + Geist 字体
- Minimalist Stone + Amber 设计系统 (见 `DESIGN.md`)
- TypeScript 类型 (`lib/types.ts`) + 工具函数 (`lib/utils.ts`) + 17 tests pass
- Metrics 计算引擎 (`lib/metrics.ts`) — 从 Python 迁移
- Google Sheets CSV 解析器 (`lib/sheets.ts`)
- 日期工具模块 (`lib/dates.ts`) — 解析/格式化/预设/前置时段计算
- Supabase Auth (email+password) + DB schema (4 tables + RLS)
- 客户管理页面 (`/clients`, `/clients/new`)
- **Dashboard 首页** (`/[clientId]`) — 支持任意日期范围选择:
  - DateRangePicker (预设按钮 + 双月日历)
  - URL searchParams 驱动 (`?from=YYYY-MM-DD&to=YYYY-MM-DD`)
  - 自动 previous period 对比
  - HeroCards + Funnel + Period Comparison Table + KPI Chart
- Report API (`/api/report/generate`) — 接受 from/to 参数，正确的日期计算
- Settings 页面 (`/[clientId]/settings`) — KPI 配置编辑 + 月份选择器
- Dark mode toggle (header ThemeToggle 组件)
- UI Polish: Apple-like CSS 动画 (fadeInUp, hover-lift, staggered children)

## 已移除 🗑️
- Weekly/Monthly Report 页面 — 功能已合并到 Dashboard 日期范围选择

## Supabase 配置
- URL: `https://sqhcagwakxhcwbsytmab.supabase.co`
- Anon Key: 在 `.env.local` 里
- 用户已创建: `wjazzz125@gmail.com` / `funnel123`
- Email confirmation 已关闭

## 可选后续工作 (nice-to-have)
- 打印/导出按钮 (PDF export via puppeteer or browser print)
- Client logo upload (Supabase storage)
- Multi-user access control (invite team members)
- Real-time data refresh (polling or websocket)
- Mobile responsive fine-tuning

## 参考文件
- 设计规范: `DESIGN.md`
- 完整 spec: `docs/specs/2026-04-02-funnel-dashboard-design.md`
- 实施计划: `docs/plans/2026-04-02-funnel-dashboard-mvp.md`
- 测试: `npx vitest run` (17 tests)
- 构建: `npm run build` (需要 .env.local)
