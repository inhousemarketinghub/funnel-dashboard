# Global EN/ZH Toggle + Nav Cleanup

**Date:** 2026-06-25
**Status:** Approved (design), pending implementation
**Branch:** `feat/i18n-and-nav`

## 一句话总结(给非技术读者)

把语言开关从 Settings 搬到顶部导航(深色模式开关旁),做成「EN | 中」切换,**整个 dashboard 全站中英互换**;偏好存在浏览器(每个观看者各自记忆,不改客户设置)。同时清理导航:删掉「SUMMARY」,把「TRENDS」移到首页「Monthly Performance Overview」按钮前面。

---

## 需求 2:导航调整(轻改动)

**现状**:`app/[clientId]/layout.tsx` 顶栏有 `Summary`(→`/${clientId}`)和 `Trends`(→`/${clientId}/trends`)两个链接。`Monthly Performance Overview` 按钮(`MonthPickerDialog`)在首页 `page.tsx` 的 header 右侧。

**改动**:
1. 顶栏删除 `Summary` 链接(它只是回首页,冗余)。
2. 顶栏删除 `Trends` 链接;改为在首页 header(`page.tsx` 桌面 + `mobile-dashboard.tsx`)把一个 `Trends` 按钮放在 `MonthPickerDialog` **之前**。样式与现有 header 按钮一致。
3. 顶栏客户名 crumb(`{client.name}`)从纯文本改为 `Link href={`/${clientId}`}`,作为「返回总览」入口(因为 Summary 被删,Trends 页需要返回路径)。
4. 手机导航 `mobile-nav.tsx`:删 `Summary`;`Trends` 入口保留(放在菜单里即可,移动端空间不同,不强求与桌面完全一致)。

---

## 需求 1:全局 EN/ZH 国际化(主改动)

### 存储与渲染模型

- **per-viewer**:语言存 cookie `dashboard_lang`(值 `en` | `zh`),非数据库。
- **SSR-safe**:服务端组件用 `cookies()` 读取 `dashboard_lang` → 决定渲染语言。服务端先知道语言,避免「先英后中」的水合闪烁(localStorage 方案会有)。
- **默认**:无 cookie = `en`。
- `client.language`(DB 列)不再用于显示(变为 vestigial,保留不删,避免迁移)。

### 组件单元

1. **`lib/i18n.ts`(新)** —— 集中词表
   - `export type Lang = "en" | "zh";`
   - `const dict: Record<Lang, Record<string, string>> = { en: {...}, zh: {...} }`
   - `export function t(lang: Lang, key: string): string`(缺失 key 回退英文 + 原 key,避免崩)
   - 收录全站 ~75+ 标签:卡片标题(Total Ad Spend / CPL / Visit Rate / Total Sales / Orders / Conversion Rate / AOV / CPA% …)、状态词(Poor/Warning/Excellent)、分组标题(Frontend—Ad Performance / Midend—Lead Pipeline / Backend—Revenue)、Person Performance、Brand Performance、按钮(Trends / Monthly Performance Overview / 刷新 / Settings …)、页面标题(Performance Overview / Historical Trends …)。

2. **`components/dashboard/language-toggle.tsx`(新)** —— client component
   - 段控「EN | 中」,样式镜像现有 pill。
   - 点击 → 写 cookie(`document.cookie = "dashboard_lang=zh; path=/; max-age=31536000"`)+ `router.refresh()`。
   - 当前值从 props(服务端读 cookie 传入)取,保证 SSR 与客户端一致。
   - 放置:`layout.tsx` 顶栏,`ThemeToggle` 旁边(全局位置,各页都在)。

3. **lang 的传递**
   - `layout.tsx`(server)读 cookie → 渲染 `LanguageToggle`(传当前 lang)+ 顶栏自身文案用 `t(lang, …)`。
   - `page.tsx`(server)读 cookie → `lang`,用于:① 自身渲染的文案;② 透传给所有子组件(hero-cards / funnel-flow / kpi-chart / person-performance / mom-table / summary-cards / brand-performance / mobile-dashboard)新增 `lang` prop;③ insights 改用 `lang`(替换原 `clientLanguage = client.language`)。
   - `trends/page.tsx` + `trends-client.tsx`、`settings/page.tsx`:同样读 cookie / 收 `lang` prop,替换硬编码文案。
   - 各 client 组件新增 `lang: Lang` prop,内部 `t(lang, key)`。

4. **移除 Settings「Summary Language」**:删 `settings/page.tsx` 的 Summary Language 区块 + 相关 state/handler(`language`/`handleLanguageChange`)。

### 受影响文件清单

新增:`lib/i18n.ts`、`components/dashboard/language-toggle.tsx`
改:`app/[clientId]/layout.tsx`、`app/[clientId]/page.tsx`、`components/dashboard/mobile-dashboard.tsx`、`components/dashboard/mobile-nav.tsx`、`hero-cards.tsx`、`funnel-flow.tsx`、`kpi-chart.tsx`、`person-performance.tsx`、`mom-table.tsx`、`summary-cards.tsx`、`brand-performance.tsx`、`app/[clientId]/trends/page.tsx`、`app/[clientId]/trends/trends-client.tsx`、`app/[clientId]/settings/page.tsx`

### 错误处理 / 边界

- `t()` 缺 key → 回退英文 + 控制台无害;不抛错。
- cookie 非法值 → 当作 `en`。
- 与既有 5 分钟数据缓存无冲突:切语言只重渲染(数据仍走缓存),`router.refresh()` 不会失效 sheet 缓存。

### 测试

- vitest 单测:`t()` 回退逻辑;cookie→lang 解析(纯函数部分)。
- 生产 build 通过。
- 手动:切换 EN/中,整页文案随之变化且不闪烁;刷新后保持。

## 实现顺序(folded plan)

1. 需求 2 导航调整(快,先出效果)。
2. 建 `lib/i18n.ts` 词表骨架 + `LanguageToggle` + cookie 读取接入 `layout.tsx`/`page.tsx`。
3. 翻译首页(page.tsx + hero-cards + funnel-flow + kpi-chart + person-performance + mom-table + summary-cards + brand-performance + mobile-dashboard)。
4. 翻译 Trends 页 + Settings 页;移除 Settings Summary Language。
5. 单测 + build 验证。

## 实现注意(AGENTS.md)

Next.js 16.2.2:写代码前先读 `node_modules/next/dist/docs/` 里 `cookies()`(server)用法,确认是否需 `await cookies()` 及在 layout/page 的读取方式。
