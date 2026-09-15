# 设备申请管理 — 实施方案 v1.0
（对应 PRD：`assets/LE-PRD-设备申请管理-v1.0.md`）

| 字段 | 内容 |
|------|------|
| 状态 | 待确认（对应 PRD 第 12 节待确认项，本文第 10 节给出默认拍板建议） |
| 基线 | 现有 Next.js 16 系统：设备台账 / BU 分组 / 4 态状态 / Excel 导入导出 / 产品图册 / 操作日志 |
| 范围 | 设备修改申请 + 设备购买申请 + 分级审批流 + 执行验收 + 台账自动回写 + 站内通知 |

---

## 1. 本期范围（V1.0 核心闭环）

**做**：两类申请单（修改 CHG / 购买 PUR）全生命周期——提交 → 分级审批 → 执行 → 验收 → 关闭并自动回写台账；分级审批引擎（金额/类型分流）；站内通知；审批全留痕。

**不做**（沿 PRD 第 8 节）：财务付款、PM 自动排程、ERP 对接、独立 App、报废法规独立流程（用备注字段承载）、企微/钉钉 Webhook（预留接口）。

---

## 2. 现状适配结论（方案的前提决定）

| 现状 | 影响 | 方案决策 |
|------|------|---------|
| 无真实登录会话：tRPC context 兜底"公共管理员工作站"（openId=public-admin-workstation, role=admin，见 `server/_core/context.ts`） | 审批流需要"谁是申请人、谁是审批人" | **轻量身份体系**：seed 预置 6 类角色用户，前端顶栏"当前身份"切换器，身份经 `X-Acting-User-Id` 请求头传给后端（第 3 节） |
| 设备状态 4 态 enum（running/stopped/maintenance/scrapped） | PRD 要求 6 态 | equipment.status 扩为 6 态（ALTER enum 兼容存量值），状态标签组件同步改彩色 6 态（第 5.4 节） |
| 上传已有 `POST /api/uploads`（≤5MB 白名单） | 申请照片/附件、校准证书 | 直接复用，附件存 URL 数组 JSON |
| 路由：wouter Switch 平铺 + Home 多视图（`src/App.tsx`） | 新增 7 个页面 | 新建独立 view 文件，App.tsx 注册 Route；均套 DashboardLayout |
| 双语：`src/contexts/languageCopy.ts` 单文件字典 | 新页面文案 | 全部文案入 languageCopy，中英同源 |
| 操作日志 `operation_logs` 已有 | 审批留痕 | 审批动作走新表 `approval_record`（含意见/节点），operation_logs 记技术动作 |

---

## 3. 角色与轻量身份体系

### 3.1 预置角色用户（seed）

| 角色 key | seed 用户示例 | 职责 |
|---------|--------------|------|
| `applicant` | 李四（Diagnostics 车间）、王五（Forming 车间） | 发起申请、配合验收 |
| `equipment_admin` | 赵管理员 | 初审（必要性/紧急度/完整性） |
| `engineer` | 钱工程师 | 评审：方案/费用工时/停机影响/选型 |
| `bu_owner` | 孙总监（BU 负责人） | BU 预算归属审批、修改类终审之一 |
| `manager` | 周经理（设备经理） | 中大额终审、验收双签之一 |
| `gm` | 吴总（总经理） | 报废 / ≥10 万修改 / ≥20 万采购终审 |
| `purchaser` | 郑采购 | 比价录入、供应商资质核验 |
| `admin`（系统管理员） | 系统管理员 | 阈值配置、流程定义、用户管理 |

实现：`users` 表新增 `roleKey` 列（varchar，默认 `applicant`），seed 脚本插入上述用户；`users` 页面（现有 /users 视图）升级为角色管理。

### 3.2 身份传递与安全边界

- 前端所有 tRPC 请求自动带 `X-Acting-User-Id`（身份切换器写入 localStorage）。
- `server/_core/context.ts`：优先取该头对应的 users 记录 → 无则回退现有公共管理员兜底。**接入平台 OAuth 后**：OAuth 会话优先，切换器自动隐藏——无缝升级，无需改业务代码。
- 这是 demo 级可信传递（内网工具场景），方案中明确标注；如需防伪造，后续在 Route Handler 层加签名 cookie（第 9 节风险表）。

### 3.3 权限矩阵（服务端 `server/applyAuthorization.ts` 断言）

| 操作 | applicant | equipment_admin | engineer | bu_owner | manager | gm | purchaser | admin |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 发起 CHG/PUR | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| 初审（CHG 第 1 节点） | — | ✅ | — | — | — | — | — | — |
| 评审（方案/选型/费用） | — | — | ✅ | — | — | — | — | — |
| 节点审批（按流程序） | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(采购主管节点) | — |
| 撤回（仅本人单据，状态=已提交/审批中） | 本人 | — | — | — | — | — | — | ✅ |
| 执行进度更新 | — | ✅ | ✅ | — | — | — | ✅(采购段) | ✅ |
| 验收提交 | 申请人本人 | ✅ | ✅（双签） | — | ✅（双签） | — | — | — |
| 阈值/流程配置 | — | — | — | — | — | — | — | ✅ |
| 查看任意单据 | 本人单据 | ✅ | ✅ | 本 BU | ✅ | ✅ | 采购段单据 | ✅ |

---

## 4. 流程设计

### 4.1 设备修改申请（CHG）

```
申请人提交 ─→ ①设备管理员初审 ─→ ②工程师评审 ─→ ③分级审批(按4.3链) ─→ ④执行 ─→ ⑤验收 ─→ ⑥关闭回写
   │             │驳回              │驳回           │驳回                      │不合格
   └─撤回 ←──────┴─────────────────┴──────────────┴─────────────────────────┘ 退回执行
```

- 单号 `CHG-YYYYMMDD-XXX`（当日序号，事务内取 max+1）。
- 五类变更类型字段驱动差异化表单与回写：

| 类型 | 附加必填 | 验收方式 | 关闭时回写台账 |
|------|---------|---------|--------------|
| 故障维修 repair | 照片≥1 | 试运行确认（双签） | 状态恢复 running，费用入 maintenance_record |
| 保养/校准 calib | 照片≥1；校准类验收传证书 | 保养记录/证书上传 | 保养履历；校准类写 calibDueDate（+周期） |
| 改造升级 retrofit | 照片≥1 | 试运行+参数确认 | notes/参数字段更新 |
| 移装/调拨 transfer | 目标 BU + 目标位置 | 上电试运行 | businessUnitId/factoryId/location 更新，BU 卡片统计自动联动 |
| 报废 scrap | 报废原因（备注含法规处置提醒文案） | 资产处置确认 | status=scrapped，移出运行统计 |

- 提交即**状态预锁定**：repair→maintenance、calib→maintenance、retrofit/transfer/scrap→stopped（若当前已是 scrapped 则拒绝提交）。锁定动作写 equipment_status_changes，备注"CHG 单预锁定"。

### 4.2 设备购买申请（PUR）

```
申请人提交 ─→ ①BU负责人审批 ─→ ②工程师选型评审 ─→ ③分级审批(按4.3链) ─→ ④采购比价 ─→ ⑤到货安装验收 ─→ ⑥入台账关闭
```

- 单号 `PUR-YYYYMMDD-XXX`。
- 类型：全新购置 new / 更新替换 replace（**必选被替换设备**，单据上强关联展示旧设备信息）。
- 比价节点（purchaser）：报价行（供应商+价格+货期+资质附件）≥3 条才允许提交到下一节点（引擎硬拦截，US-04）；选中价 ≠ 最低价且差 >10% 时必填说明。
- 验收：开箱 → 安装调试 → 试运行时长（小时数必填）→ 双签。通过后**自动创建设备台账**：编码自动生成（`PEM-{BU code}-{当日序}`，可改）、名称/型号/BU/位置/供应商来自单据，status=running。计入该 BU 设备总数卡片。

### 4.3 分级审批规则（阈值存配置表，管理员可改）

| 单据 | 条件（按序命中） | 审批链 |
|------|-----------------|--------|
| CHG | 预估费用 < 5,000 | 初审 → 设备主管(manager 简化档：`manager_lite`) |
| CHG | 5,000 ≤ 费用 < 30,000 | 初审 → 工程师评审 → 设备经理 |
| CHG | ≥30,000 或 类型∈{改造/移装/报废} | 初审 → 评审 → 设备经理 → BU 负责人；**报废或 ≥100,000 再加签总经理** |
| PUR | 预算 < 50,000 | BU 负责人 → 选型评审 → 采购主管(purchaser) |
| PUR | 50,000 ≤ 预算 < 200,000 | 上链 → 设备经理/副总(manager) |
| PUR | ≥200,000 | 上链 → 总经理(gm) |
| 任意 | 停产紧急 | 节点 SLA 2h，超时 2h 一催（站内强提醒+红标） |

阈值默认值：`CHG_L1=5000, CHG_L2=30000, CHG_GM=100000, PUR_L1=50000, PUR_L2=200000`。存 `apply_settings`（key-value），管理员页可调。

### 4.4 状态机（单据主状态 status + 游标 currentNode）

```
draft → submitted → approving → approved → executing → pending_acceptance → closed
                        ↓                        ↑
                    withdrawn                 rejected_from_acceptance（退回 executing）
```

- `currentNode`：approving 期间的节点 key（如 `admin_review / engineer_review / manager / bu_owner / gm / purchaser`）。
- **驳回**：审批人选回退目标节点（默认回申请人= submitted），填意见必填；单据回 `submitted` 或指定节点重走。
- **转办/加签**：V1.0 实现转办（改派当前节点处理人）；加签列 V1.5。
- **不可变留痕**：`approval_record` 只插不改；前端"流程记录"标签按时间线渲染。

---

## 5. 数据模型（Drizzle，新增 9 表 + equipment 扩展）

### 5.1 equipment 扩展（兼容存量）

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | enum 扩展 | +`calibrating`(保养中)、`pending_acceptance`(待验收) |
| `ownerBuNote` | varchar(120) | 权属备注（V1 沿用 businessUnitId 为主，此列承载 PRD owner_bu 语义的补充文本） |
| `calibDueDate` | date | 下次校准到期日（校准类验收回写） |

### 5.2 新表

```ts
// 1. 修改申请单
changeApplies: id, applyNo(unique), equipmentId(notNull), changeType(enum: repair|calib|retrofit|transfer|scrap),
  urgency(enum: normal|production|shutdown), description(text), photos(json: string[]), attachments(json),
  targetBuId(int, transfer), targetLocation(varchar, transfer), scrapReason(text),
  estimatedFee(decimal 12,2), expectedFinishAt(date), status, currentNode(varchar), submitterId, createdAt/updatedAt

// 2. 购买申请单
purchaseApplies: id, applyNo(unique), buyType(enum: new|replace), replacedEquipmentId(int, replace 必填),
  targetBuId(notNull), targetLocation, purpose(text), budget(decimal 14,2), expectedArrivalAt(date),
  attachments(json), specSummary(text), status, currentNode, submitterId, supplierId(最终中标, 可空), createdAt/updatedAt

// 3. 审批流定义（V1.0 由代码默认规则写入此表，管理员可改 nodes JSON）
approvalFlowDefs: id, applyType(enum: change|purchase), conditionName, conditionExpr(json: {minFee,maxFee,types:[],urgency}), nodes(json: [{key,roleKey,name}]), version, isActive, updatedAt

// 4. 审批留痕（只插不改）
approvalRecords: id, applyType, applyId, nodeKey, action(enum: submit|approve|reject|transfer|withdraw|urge),
  actorId, comment(text), extra(json: 转办目标/回退目标节点), createdAt

// 5. 维修/保养履历（CHG 验收通过时写入）
maintenanceRecords: id, equipmentId, changeApplyId, planText, laborHours(decimal 5,1), fee(decimal 12,2),
  beforePhotos(json), afterPhotos(json), result(text), completedAt

// 6. 询比价
quotations: id, purchaseApplyId, supplierId, price(decimal 14,2), leadTimeDays(int), qualificationFiles(json),
  isSelected(bool), remark, createdBy, createdAt

// 7. 验收记录
acceptanceRecords: id, applyType, applyId, result(enum: pass|fail), runHours(decimal 6,1, PUR 必填),
  certFiles(json), photos(json), signerIds(json: 双签), comment, createdAt

// 8. 站内通知
notifications: id, userId, title, body, link, applyType, applyId, level(enum: info|warn|urgent),
  isRead(bool default false), createdAt

// 9. 系统设置（阈值等）
applySettings: key(pk varchar), value(text), updatedAt, updatedBy
```

`suppliers` 表已有（code/name/contact），加 2 列：`licenseNo`、`qualifications`(json)。

### 5.3 单号与并发

- 单号生成放事务内：`SELECT max(id) ... FOR UPDATE` 语义用"插入失败重试 + 唯一索引"实现，避免锁表。
- 预锁定设备状态与创建单据同一事务。

---

## 6. 后端 API（tRPC 新增 `apply` 域，`server/routers.ts` 注册）

```
apply.change:      create / list({scope: mine|all, status?, type?}) / detail{id} / withdraw{id}
                   submitReview{id, estimatedFee, plan, laborHours}(engineer 评审)
apply.purchase:    create / list / detail / withdraw / quotations{applyId} / addQuotation / removeQuotation / selectQuotation
apply.approval:    myPending / actedHistory / act{applyType, applyId, action, comment, rejectToNode?, transferTo?}
                   urge{id}(催办) / timeouts(超时清单, 定时扫描兜底)
apply.execution:   updateProgress{applyId, content, photos} / listExecuting
apply.acceptance:  submit{applyId, result, runHours?, certs?, photos?, comment}（双签：两次提交, 第二次=关闭）
apply.settings:    list / update（admin）/ flowDefs / updateFlowDef（admin）
apply.notify:      myNotifications / markRead / unreadCount
```

规则：

- 每个节点 action 前置校验：当前用户 roleKey == 该节点 roleKey 且 currentNode 匹配（`server/applyAuthorization.ts`）。
- PUR 比价拦截在 `apply.approval.act` 进入 purchaser 下一节点前：quotations <3 → 抛业务错误"比价不完整"。
- 状态回写事务（`server/applyEngine.ts` 纯函数状态机 + `server/persistenceApply.ts` 写入集）：验收 pass → 依 changeType 回写（第 4.1 表）+ maintenanceRecords + notifications；PUR pass → createEquipment + notifications。
- 全部 mutation 写 operation_logs（module=apply）。

## 6.5 通知触发点

| 事件 | 通知谁 |
|------|--------|
| 提交/驳回/回退 | 申请人 |
| 到达审批节点 | 该节点角色全部用户 |
| 停产紧急 SLA 超 2h / 普通 24h 未处理 | 节点角色（warn）；48h → 升级上级角色（urgent） |
| 验收通过/关闭 | 申请人 + 相关审批人 |
| 比价不完整拦截 | purchaser 本人 |

前端：DashboardLayout 顶栏加铃铛图标 + 未读红点 + 下拉最近 10 条（轮询 unreadCount，60s）。

---

## 7. 前端页面（7 新 + 3 改造，全部中英双语）

### 7.1 路由注册（`src/App.tsx` Switch 追加）

```
/apply/change/new   修改申请-发起（P1）
/apply/purchase/new 购买申请-发起（P2）
/apply/mine         我的申请（P3）
/approvals          审批中心（P4）
/apply/execution    执行跟踪（P5）
/apply/acceptance/:id 验收页（P6）
/apply/settings     审批配置（P7, admin）
```

### 7.2 新页面要点

| 页面 | 结构与交互 |
|------|-----------|
| **P1 修改申请** | 三步向导（Stepper）：①选设备（复用台账行数据源，搜索下拉带出 名称/BU/位置/状态）→ ②填信息（变更类型 RadioCard 五选一、紧急度 RadioCard、问题描述、**照片必传≥1**（复用 /api/uploads，未传禁用提交按钮并提示）、移装显示目标 BU/位置 Select、报废显示原因 Textarea）→ ③确认页（摘要卡 + 触发的审批链预览："预估费用 ¥12,000 → 命中：设备经理审批"） |
| **P2 购买申请** | 单页表单：buyType RadioCard（replace 时设备选择器必选）、BU/位置、用途、预算、期望到货、附件上传；底部实时显示命中的审批链 |
| **P3 我的申请** | 列表（单号/类型/设备/金额/状态彩签/当前节点），行展开进度条（7 态 Stepper）+ 最近审批意见；状态 Tabs 筛选 |
| **P4 审批中心** | 三区 Tab：待我审批（默认）/ 已审批 / 超时催办。卡片式：单号+标题+申请人+金额大字+缩略图首屏可见；详情抽屉（Tabs：申请信息/评审与费用/流程记录/附件）；操作区：意见 Textarea + [驳回][转办][同意并流转]；<5,000 的单支持列表勾选批量通过（意见统一填一次） |
| **P5 执行跟踪** | 上：CHG 执行看板（列=executing 单据卡片：设备/类型/进度留言时间线/前后对比照片上传）；下：PUR 采购跟踪（比价表：3 行报价对比高亮最低价、差>10% 标黄+说明、选中单选） |
| **P6 验收页** | 路由 `:id` 按 applyType 渲染：试运行结论 Radio、试运行小时数（PUR 必填）、证书/照片上传、双签说明（"需申请人+设备工程师（或设备经理）两签，当前 1/2"）；[不合格退回执行] / [通过并关闭] |
| **P7 审批配置** | 阈值数字表单（5 个阈值，保存即生效）；流程定义表（类型×条件 → 节点序列 chips，V1.0 只读+JSON 编辑入口）；用户角色管理（users 表 roleKey 下拉）；供应商资质字段 |

### 7.3 改造现有页面

| 页面 | 改动 |
|------|------|
| 首页 Home | 顶部"申请中心"区块：两张大按钮卡（修改申请/购买申请）+ 我的待办数（待我审批 n 条）；BU 卡片统计逻辑自动吸收 transfer/scrap/新购回写（数据同源，无需改统计 SQL，仅确保 status 枚举扩展后"运行中"计数口径正确） |
| 设备台账列表 | 行操作加"发起申请"下拉（修改/购买）；状态标签组件扩展 6 态彩签（calibrating=青、pending_acceptance=橙）；台账若已有进行中 CHG 单，行上显示小徽标 |
| 设备详情页 | 新增"变更履历"Tab：该设备全部 CHG/PUR 单时间线（单号/类型/结论/费用/照片），点击跳 P3 详情 |

### 7.4 视觉

延续现有 shadcn/ui 风格与 DashboardLayout；状态彩签复用现有 Badge 色板；车间场景原则：能选不打字（RadioCard/Select 优先）、照片直传、金额/停机影响首屏可见。

---

## 8. 分阶段实施（里程碑制）

**M1 核心审批闭环**（数据层 + 引擎 + 两类申请提交与审批）
1. schema 扩展 + `pnpm run db:push`；seed 角色/用户/流程定义/阈值
2. `server/applyEngine.ts` 状态机纯函数（单测覆盖：金额分链、驳回回退、比价拦截、报废加签）+ `applyAuthorization.ts`
3. tRPC apply 域全量 procedure；context 支持 X-Acting-User-Id
4. P1/P2 发起页 + P3 我的申请 + P4 审批中心（执行/验收用简化表单串通全流程）

**M2 执行与验收闭环**
5. P5 执行跟踪 + P6 验收页 + 台账回写事务 + BU 卡片联动验证
6. 站内通知（notifications + 顶栏铃铛）

**M3 配置化与打磨**
7. P7 审批配置页（阈值可调、用户角色管理）
8. 详情页"变更履历"Tab、首页申请中心入口、双语全量补齐、超时扫描（手动触发 + dev 定时兜底）

**验收标准**（对应 PRD 用户故事）：US-01 无照片无法提交并生成 CHG 单号；US-02 12,000 元单只出现在设备经理待办；US-03 移装验收关闭后 BU 卡片实时变化；US-04 报价 <3 条到达下一节点被拦截。

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| 身份切换为明文可信传递，可被伪造 | 内网工具可接受；文档标注；升级路径：Route Handler 层签名 HttpOnly cookie + OAuth 接入后自动失效切换器 |
| equipment.status enum 扩展的存量兼容 | MySQL ALTER enum 追加值不丢数据；db:push 前先 mysqldump 备份；状态统计 SQL 回归测试 |
| Home.tsx 体量大（千行级），改造触碰面广 | 只在顶部插入"申请中心"区块与行操作下拉，不动 BU 统计与既有逻辑；改动前后跑 vitest 全量 |
| 沙箱存储回滚曾致数据丢失 | M1 交付后立即提示用户导出 Excel 备份；单据数据支持 export（复用 Excel 思路，V1.1） |
| Radix 组件在测试环境交互不可靠 | 沿用既定策略：单测聚焦 applyEngine 纯函数与回显渲染，不测 Radix 交互 |

---

## 10. 待确认项默认拍板建议（PRD 第 12 节）

| # | 待确认 | 默认建议 |
|---|--------|---------|
| 1 | 审批金额阈值 | 采用 4.3 表默认值，P7 页可随时改 |
| 2 | 修改申请是否覆盖五类 | **覆盖五类**（表单按类型差异化字段，成本可控；报废/移装是台账治理刚需） |
| 3 | 通知渠道 | V1.0 站内信；Webhook 留 `notifyExternal()` 空实现接口 |
| 4 | 供应商资质最低要求 | 比价行资质附件必传（营业执照），许可证按需 |
| 5 | 验收双签规则 | 申请人 + 设备工程师为默认双签；CHG ≥30,000 或 PUR ≥50,000 时第二签升级为设备经理（写死规则，V1.5 可配置） |
