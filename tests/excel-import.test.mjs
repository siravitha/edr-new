import test from 'node:test';
import assert from 'node:assert/strict';
import Excel from 'exceljs';
import {readImportWorkbook,guessMapping,validateMappedImport,inspectXlsxZip} from '../lib/excel-import.ts';
const headers=['assetNo','name','serialNo','wardId','category','cost'];
async function fixture(formula=false){const w=new Excel.Workbook();const s=w.addWorksheet('Assets');s.addRow(headers);s.addRow(['7110-010-00125/69','Desk','SN125','WH','Furniture',1000]);if(formula)s.getCell('F2').value={formula:'1+1',result:2};w.addWorksheet('Other').addRow(['notes']);return new Uint8Array(await w.xlsx.writeBuffer());}
test('XLSX multiple sheets preserves official numbers and source rows',async()=>{const w=await readImportWorkbook('assets.xlsx',await fixture());assert.equal(w.sheets.length,2);assert.equal(w.sha256.length,64);const r=validateMappedImport(w.sheets[0],1,guessMapping(headers),[],['WH']);assert.equal(r.errors.length,0);assert.equal(r.valid[0].assetNo,'7110-010-00125/69');assert.equal(r.valid[0].sourceRow,2);});
test('XLSX formula is blocked even with cached numeric result',async()=>{const w=await readImportWorkbook('assets.xlsx',await fixture(true));const r=validateMappedImport(w.sheets[0],1,guessMapping(headers),[],['WH']);assert.equal(r.valid.length,0);assert.equal(r.errors.length,1);});
test('Canonical old/new number duplicate across years is blocked',async()=>{const w=await readImportWorkbook('assets.xlsx',await fixture());const r=validateMappedImport(w.sheets[0],1,guessMapping(headers),['7110-010-0125/70'],['WH']);assert.equal(r.valid.length,0);assert.equal(r.errors.length,1);});
test('Wrong format and oversized compressed inputs are blocked',()=>{assert.throws(()=>inspectXlsxZip(new Uint8Array(20)));assert.throws(()=>inspectXlsxZip(new Uint8Array(4*1024*1024)));});
