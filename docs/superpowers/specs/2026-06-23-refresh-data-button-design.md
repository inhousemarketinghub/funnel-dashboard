# Refresh Data Button + Last-Updated Timestamp

**Date:** 2026-06-23
**Status:** Approved (design), pending implementation
**Branch:** `feat/refresh-data-button`

## 一句话总结(给非技术读者)

Dashboard 为了打开快,会把 Google Sheet 的数据缓存 5 分钟。改了表后,数字最多慢 5 分钟才更新。本功能在右上角加一个「立即刷新」按钮,点一下就强制重新去 Google 拿最新数据,旁边显示「数据更新于 HH:MM」——这个时间是数据**真正从 Google 拉下来的时刻**,不是网页打开时间。桌面和手机都加。

## 背景 / 根因

- 触发场景:Carress Shop dashboard 显示 Dexon 32 visits,Google Sheet 实际 29。经核对:计数逻辑正确(用现表数据复算 = 29),32 来自 5 分钟缓存里的旧数据(那 3 行 Dexon 记录后来被改/删)。
- 缓存来源:`lib/sheets.ts` 里所有 `fetch()` 都带 `next: { revalidate: 300 }`(Next.js Data Cache,5 分钟)。
- 关键约束:普通的 `router.refresh()` **不会**让 `revalidate` 时间窗内的 fetch 重新请求 Google。必须主动让该缓存失效。

## 目标 / 非目标

**目标**
1. 用户可手动强制刷新当前客户的 Google Sheet 数据。
2. 显示数据真实拉取时间(last-updated)。
3. 桌面 + 手机端均可用。
4. 只影响当前客户的表,不影响其他客户。

**非目标(YAGNI)**
- 不做自动定时刷新。
- 不做「刷新全部客户」。
- 不改动 5 分钟缓存的默认时长(对打开速度有益,保留)。
- 不做乐观更新动画,简单转圈即可。

## 方案设计

### 数据流

```
[用户点击 🔄]
   → 调用 Server Action refreshSheet(sheetId)
       → revalidateTag(`sheet:${sheetId}`)   // 让该表所有缓存 fetch 失效
   → router.refresh()                          // 重新渲染服务端组件 → fetch 重新打 Google
   → 新数据 + 新的 fetchedAt 时间戳返回前端
```

### 组件 / 改动单元

1. **`lib/sheets.ts` — 给 fetch 打 tag**
   - `fetchSheetData(sheetId, tab)` 与 `listSheetTabs(sheetId)`:`next` 选项加 `tags: ['sheet', \`sheet:${sheetId}\`]`(保留 `revalidate: 300`)。
   - 新增 `getDataFetchedAt(sheetId): Promise<string | null>`:做一次**已被缓存**的轻量请求(复用 spreadsheet metadata fetch),读取 HTTP 响应头 `Date`,返回该时间。因为该 fetch 也被缓存并打了同一 tag,所以这个时间会随缓存一起冻结、随刷新一起更新 → 即「数据真正拉取的时刻」。
     - 实现注意:需保留 Response 才能读 header;现有 `fetchSheetData` 只返回 `.values`,故单独写一个小函数读 metadata 端点的 `Date` 头,避免改动现有签名。

2. **`app/[clientId]/actions.ts`(新增,server action)**
   ```ts
   "use server";
   import { revalidateTag } from "next/cache";
   export async function refreshSheet(sheetId: string) {
     revalidateTag(`sheet:${sheetId}`);
   }
   ```

3. **`components/dashboard/refresh-button.tsx`(新增,client component)**
   - Props: `{ sheetId: string; fetchedAt: string | null }`
   - 用 `useTransition` + `useRouter`;点击 → `startTransition(async () => { await refreshSheet(sheetId); router.refresh(); })`。
   - pending 时图标(lucide `RefreshCw`)旋转、按钮 `opacity-60`、禁用重复点击。
   - 旁边小字渲染 `数据更新于 {HH:MM}`(用 `fetchedAt` 格式化为本地时间;为空时不显示)。
   - 样式镜像 `date-range-picker.tsx`:`bg-[var(--bg2)] border border-[var(--border)] rounded-[10px]` 等 CSS 变量,保持一致。

4. **`app/[clientId]/page.tsx` — 接线(桌面)**
   - 服务端取 `const fetchedAt = await getDataFetchedAt(client.sheet_id);`
   - 在 header 操作区(`MonthPickerDialog` / `DateRangePicker` 同一 flex 行)放入 `<RefreshButton sheetId={client.sheet_id} fetchedAt={fetchedAt} />`。

5. **手机端 — `components/dashboard/mobile-dashboard.tsx`**
   - 透传 `sheetId` + `fetchedAt`,在移动 header 同样渲染 `<RefreshButton />`(`page.tsx` 把这两个值传进 `<MobileDashboard />`)。

### 错误处理

- Server action 仅调 `revalidateTag`,几乎不会失败;若 `router.refresh()` 后 fetch 报错,沿用现有 `fetchError` 横幅机制,无需新增。
- `getDataFetchedAt` 失败返回 `null` → 前端不显示时间,不阻塞页面。

### 测试

- 该项目用 vitest(见 `vitest.config.ts`)。`getDataFetchedAt` 的纯逻辑(解析 `Date` 头 → 格式化)可加一个小单元测试。
- 手动验证:改 Carress 表里一行 → 点刷新 → 数字与「更新于」时间即时变化。

## 实现注意(AGENTS.md)

项目 `AGENTS.md` 警告本仓库用的是 Next.js 16.2.2,API 可能与训练数据不同。动手前先读 `node_modules/next/dist/docs/` 中关于 `revalidateTag` / server actions / `fetch` 缓存 tag 的对应文档,确认签名后再写。

## 受影响文件清单

- `lib/sheets.ts`(改:加 tags + 新增 `getDataFetchedAt`)
- `app/[clientId]/actions.ts`(新增)
- `components/dashboard/refresh-button.tsx`(新增)
- `app/[clientId]/page.tsx`(改:取 fetchedAt + 桌面/移动接线)
- `components/dashboard/mobile-dashboard.tsx`(改:渲染按钮)
