import * as XLSX from "xlsx";

const rows = [{
  "编号": "QA-PEM-DELETE-001",
  "名称": "待删除核验设备",
  "型号": "QA-DELETE-MODEL",
  "规格": "QA-DELETE-SPEC",
  "所属工序": "核验工序",
  "位置": "QA 区",
  "状态": "停机",
}];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "设备台账");
XLSX.writeFile(workbook, "/home/ubuntu/Downloads/设备台账_导入核验.xlsx");
