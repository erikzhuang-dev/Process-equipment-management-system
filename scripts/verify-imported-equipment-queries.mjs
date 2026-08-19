import { strict as assert } from "node:assert";
import { getDashboardMetrics, getEquipmentById, listAllEquipment, listBusinessUnits, listEquipment } from "../server/db.ts";

const [allEquipment, businessUnits, metrics] = await Promise.all([listAllEquipment(), listBusinessUnits(), getDashboardMetrics()]);
const validationRows = allEquipment.filter(item => item.code.startsWith("PEM-VAL-"));
assert.equal(validationRows.length, 10, "应存在十台 PEM-VAL 验证设备");
const byBusinessUnit = {};
for (const unit of businessUnits) {
  const expected = validationRows.filter(item => item.businessUnitId === unit.id).length;
  const result = await listEquipment({ businessUnitId: unit.id, page: 1, pageSize: 100 });
  const actual = result.items.filter(item => item.code.startsWith("PEM-VAL-")).length;
  assert.equal(actual, expected, `${unit.code} 筛选返回的验证设备数量不一致`);
  byBusinessUnit[unit.code] = { expectedValidationCount: expected, listTotal: result.total };
}
const sample = validationRows.find(item => item.code === "PEM-VAL-001");
assert(sample, "缺少详情验证设备 PEM-VAL-001");
const detail = await getEquipmentById(sample.id);
assert.equal(detail?.assetCategory, "注塑成型设备");
assert.equal(detail?.criticality, "A");
assert.equal(detail?.responsibleOwner, "王工");
assert(detail?.commissionedAt, "详情缺少启用日期");
assert(detail?.warrantyExpiresAt, "详情缺少保修到期日");
assert.equal(Number(metrics.totalEquipment), allEquipment.length, "仪表盘总设备数与台账总数不一致");
console.log(JSON.stringify({ equipmentTotal: allEquipment.length, dashboardTotal: metrics.totalEquipment, byBusinessUnit, detail: { code: detail.code, assetCategory: detail.assetCategory, criticality: detail.criticality, responsibleOwner: detail.responsibleOwner, commissionedAt: detail.commissionedAt, warrantyExpiresAt: detail.warrantyExpiresAt } }, null, 2));
process.exit(0);
