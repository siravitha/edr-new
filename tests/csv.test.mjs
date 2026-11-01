import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssetCsv, toCsv } from '../lib/csv.mjs';

const header = 'assetNo,name,serialNo,wardId,category,cost';
const row = 'UTH-69-00901,Pump,SN901,ICU,Infusion,48000';
const parse = (text, existing = []) => parseAssetCsv(text, existing, ['ICU']);

test('นำเข้า CSV พร้อม BOM ข้อความมี comma และ quote โดยไม่เสียข้อมูล', () => {
  const csv = toCsv([header.split(','), ['UTH-69-00901', 'Pump, "A"', 'SN901', 'ICU', 'Infusion', 48000]]);
  const result = parse(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.valid[0].name, 'Pump, "A"');
  assert.equal(result.valid[0].cost, 48000);
});

test('ป้องกันเลขทะเบียนซ้ำทั้งในไฟล์และทะเบียนเดิม', () => {
  const duplicate = parse(`${header}\n${row}\n${row}`);
  assert.equal(duplicate.valid.length, 1);
  assert.equal(duplicate.errors.length, 1);
  const existing = parse(`${header}\n${row}`, ['UTH-69-00901']);
  assert.equal(existing.valid.length, 0);
  assert.equal(existing.errors.length, 1);
});

test('ปฏิเสธ header ไม่ตรง รูปแบบ quote ไม่ครบ และไฟล์ไม่มีรายการ', () => {
  assert.throws(() => parse(`name,assetNo,serialNo,wardId,category,cost\n${row}`));
  assert.throws(() => parse(`${header}\n"unterminated`));
  assert.throws(() => parse(header));
});

test('ปฏิเสธราคาติดลบ ศูนย์ NaN exponential และวอร์ดนอกขอบเขต', () => {
  for (const cost of ['-100', '0', 'NaN', '1e5', '100.123', '10000000001']) {
    const result = parse(`${header}\nUTH-69-00901,Pump,SN901,ICU,Infusion,${cost}`);
    assert.equal(result.valid.length, 0, cost);
    assert.equal(result.errors.length, 1, cost);
  }
  assert.equal(parse(`${header}\n${row.replace(',ICU,', ',ER,')}`).valid.length, 0);
});

test('จำกัด 500 แถวและขนาดข้อความ', () => {
  assert.throws(() => parse(`${header}\n${Array(501).fill(row).join('\n')}`));
  assert.throws(() => parse('x'.repeat(1_000_001)));
});

test('ส่งออกป้องกันสูตร รวมสูตรหลัง whitespace และ escape quote/newline', () => {
  const out = toCsv([['=1+1', '+SUM(A1)', '-1', '@SUM(A1)', ' \t=HYPERLINK("x")', 'safe,"value"\nnext']]);
  assert.ok(out.startsWith('\uFEFF'));
  for (const prefix of ["'=" , "'+", "'-", "'@", "' \t="]) assert.ok(out.includes(prefix), prefix);
  assert.ok(out.includes('safe,""value""\nnext'));
});
