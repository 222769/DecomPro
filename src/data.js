export const fields = [ ['model','Model number'], ['serial','Serial number'], ['barcode','Barcode'], ['etch','Security etch'], ['asset','Asset number'] ];
export const headers = ['Date of disposal','Description','Model','Manufacturer','Taken From','Serial Number','Barcode','Security Etch','Asset Number','Reason For Disposal','Who disposed of it?','Asset Number','Amt To Dispose','Original Cost','Depreciation to date','Book Value','Asset Group'];
export function supplierRow(item) {
  return [new Date(item.date+'T12:00:00'),item.description,item.model,item.manufacturer,item.source,item.serial,item.barcode,item.etch,item.asset,item.reason,item.technician,null,null,null,null,null,null];
}
export function duplicateSerial(items, serial) {
  return serial.trim().toUpperCase() !== 'N/A' && items.some(i => i.serial.toLowerCase() === serial.toLowerCase());
}
