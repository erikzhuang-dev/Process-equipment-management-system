# DESIGN.md

## 布局与响应式
### 设备台账页 BU 卡片
- BU 统计卡片网格：一排固定 4 个（`sm:grid-cols-2 md:grid-cols-4`），小屏降级 2 列、移动端单列；卡片间距 gap-4

### 产品图册抽屉（设备管理页右侧）
- 触发：页头"产品图册"描边按钮（ImagePlus 图标），打开右侧 Sheet 抽屉
- 抽屉规格：`side="right"`，`w-full sm:max-w-md`，内容 `overflow-y-auto p-6`
- BU 过滤：顶部胶囊标签行（All + 各 BU code），选中态 `bg-[#4a7c59] text-white`，未选 `border-[#d9e5d6] bg-white`
- 产品卡片：`rounded-2xl border-[#d9e5d6]`，图片区高 `h-40`（无图时浅绿占位"暂无图片"），下方产品名 + `编码 · N 台设备`
- 联动：点击卡片展开该产品设备族（code · name + 状态中文）；点击设备行定位并展开列表对应行
