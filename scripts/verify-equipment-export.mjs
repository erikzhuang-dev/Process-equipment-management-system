import XLSX from "xlsx";

const file = "/home/ubuntu/exports/process-equipment-management/设备台账-导入后复核导出.xlsx";
const workbook = XLSX.readFile(file, { cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const expectedColumns = ["编号", "名称", "BU编码", "工厂编码", "供应商编码", "OEE"];
const columns = Object.keys(rows[0] ?? {});
const validationRows = rows.filter(row => String(row["编号"]).startsWith("PEM-VAL-"));
const missingColumns = expectedColumns.filter(column => !columns.includes(column));
const missingFields = validationRows.flatMap(row => expectedColumns.filter(column => row[column] === "" || row[column] === null || row[column] === undefined).map(column => `${row["编号"]}:${column}`));
console.log(JSON.stringify({ rowCount: rows.length, columns, validationEquipmentCount: validationRows.length, validationCodes: validationRows.map(row => row["编号"]), missingColumns, missingFields }, null, 2));
process.exit(missingColumns.length || validationRows.length !== 10 || missingFields.length ? 1 : 0);
