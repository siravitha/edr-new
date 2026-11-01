import test from 'node:test';
import assert from 'node:assert/strict';
import {createMasterData,saveMasterRecord,changeMasterStatus} from '../lib/master-data.mjs';
test('แผนกต้องไม่อ้างตัวเอง วนกลับถึงลูก หรือเลือกแม่ที่ยกเลิกแล้ว',()=>{
  let state=createMasterData();
  const a=state.departments[0],b=state.departments[1];
  assert.throws(()=>saveMasterRecord(state,'departments',{id:a.id,name:a.name,fields:{parentId:a.id}},'admin'));
  state=saveMasterRecord(state,'departments',{id:b.id,name:b.name,fields:{parentId:a.id}},'admin');
  assert.throws(()=>saveMasterRecord(state,'departments',{id:a.id,name:a.name,fields:{parentId:b.id}},'admin'));
  state=changeMasterStatus(state,'departments',a.id,'CANCELLED','admin','เลิกหน่วยงานตัวอย่าง');
  assert.throws(()=>saveMasterRecord(state,'departments',{name:'ฝ่ายใหม่',fields:{parentId:a.id}},'admin'));
});
