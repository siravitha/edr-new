import {assetNumberIdentity} from "./asset-numbering.ts";
export function parseAssetCsv(text, existingNumbers, allowedWards) {
  if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 1 MB');
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('เครื่องหมายคำพูดใน CSV ไม่ครบ');
  row.push(field); if (row.some(Boolean)) rows.push(row);
  const header = rows.shift()?.map(x => x.replace(/^\uFEFF/, '').trim());
  const expected = ['assetNo','name','serialNo','wardId','category','cost'];
  if (JSON.stringify(header) !== JSON.stringify(expected)) throw new Error('หัวตารางไม่ตรงกับแม่แบบ');
  if (!rows.length || rows.length > 500) throw new Error('นำเข้าได้ครั้งละ 1–500 แถว');
  const seen = new Set(existingNumbers.map(assetNumberIdentity)), errors = [], valid = [];
  rows.forEach((values, index) => {
    const [assetNo, name, serialNo, wardId, category, amount] = values.map(v => v.trim());
    const number = index + 2;
    if (values.length !== 6 || !assetNo || !name || !serialNo || !category || !allowedWards.includes(wardId) || values.some(v => v.length > 200)) errors.push(`แถว ${number}: ข้อมูลไม่ครบหรือหน่วยงานไม่ถูกต้อง`);
    else if (seen.has(assetNumberIdentity(assetNo))) errors.push(`แถว ${number}: เลขครุภัณฑ์ซ้ำ ${assetNo}`);
    else if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1e10) errors.push(`แถว ${number}: ราคาทุนไม่ถูกต้อง`);
    else { seen.add(assetNumberIdentity(assetNo)); valid.push({ assetNo, name, serialNo, wardId, category, cost: Number(amount) }); }
  });
  return { valid, errors };
}

export function toCsv(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value ?? '');
    // ป้องกันการตีความค่าเป็นสูตรเมื่อเปิดด้วยโปรแกรมตารางคำนวณ
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
