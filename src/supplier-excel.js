import {headers,supplierRow} from './data.js';

export const supplierExcelType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export async function supplierExcel(items) {
 if(!items.length)throw Error('There are no saved equipment records to export.');
 const {default:ExcelJS}=await import('exceljs');
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Sheet1');
 sheet.addRow(headers);for(const item of items)sheet.addRow(supplierRow(item));
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164E3D'}};
 sheet.getRow(1).height=30;sheet.columns.forEach((column,index)=>column.width=index===1?28:22);
 sheet.getColumn(1).numFmt='dd/mm/yyyy';sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter='A1:K1';
 return workbook.xlsx.writeBuffer();
}
