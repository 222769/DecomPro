export const fields = [ ['serial','Serial number'], ['model','Model number'], ['barcode','Barcode'], ['etch','Security etch'], ['asset','Asset number'] ];
export const normalizeAssetNumber = value => String(value ?? '').trim().toUpperCase();
export const validAssetNumber = value => /^(A[0-9]{4}|N\/A)$/.test(normalizeAssetNumber(value));
export const headers = ['Date of disposal','Description','Model','Manufacturer','Taken From','Serial Number','Barcode','Security Etch','Asset Number','Reason For Disposal','Who disposed of it?'];
export function supplierRow(item) {
  return [new Date(item.date+'T12:00:00'),item.description,item.model,item.manufacturer,item.source,item.serial,item.barcode,item.etch,item.asset,item.reason,item.technician];
}
export function duplicateSerial(items, serial) {
  return serial.trim().toUpperCase() !== 'N/A' && items.some(i => i.serial.toLowerCase() === serial.toLowerCase());
}
