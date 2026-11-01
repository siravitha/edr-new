import { buildSystemLogs, createSystemLog, legacySystemLogs, type LogContext, type Activity, type SystemLog } from "./system-log";
import { createSeed, type DemoState } from "./seed";
const DATABASE = "uth-smart-assets-demo-v1";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state")) request.result.createObjectStore("state");
      if (!request.result.objectStoreNames.contains("planningFiles")) request.result.createObjectStore("planningFiles");
      if (!request.result.objectStoreNames.contains("systemLogs")) request.result.createObjectStore("systemLogs", {keyPath:"sequence",autoIncrement:true});
      if (!request.result.objectStoreNames.contains("systemLogMeta")) request.result.createObjectStore("systemLogMeta");
    };
    request.onblocked = () => { blocked = true; reject(new Error("กรุณาปิดแท็บระบบอื่นก่อนอัปเกรดที่เก็บเอกสาร")); };
    request.onsuccess = () => { if(blocked){request.result.close();return;} request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
  });
}
export async function loadState(): Promise<DemoState> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readonly");
    const request = tx.objectStore("state").get("current");
    let value: DemoState;
    request.onsuccess = () => { value = request.result ?? createSeed(); };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("STORAGE_ABORTED")); };
  });
}
export type PlanningFileWrite = { id: string; blob: Blob };
export async function saveState(state: DemoState, file?: PlanningFileWrite, context:LogContext={actorId:"demo-system",role:"system",sessionId:"unknown",deviceId:"browser",page:"system"}, operation?:Activity) {
  const db = await openDatabase();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(file?["state","planningFiles","systemLogs"]:["state","systemLogs"],"readwrite");
    const previous=tx.objectStore("state").get("current");
    previous.onsuccess=()=>{
      try {
        const logs=buildSystemLogs(previous.result??createSeed(),state,context);
        if(operation)logs.push(createSystemLog(context,operation));
        for(const log of logs)tx.objectStore("systemLogs").add(log);
        tx.objectStore("state").put(state,"current");
        if(file)tx.objectStore("planningFiles").add(file.blob,file.id);
      } catch {tx.abort();}
    };
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{db.close();reject(tx.error);};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("บันทึกข้อมูลพร้อม Log ไม่สำเร็จ"));};
  });
}
export async function loadPlanningFile(id: string): Promise<Blob> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("planningFiles", "readonly");
    const request = tx.objectStore("planningFiles").get(id);
    tx.oncomplete = () => { db.close(); request.result instanceof Blob ? resolve(request.result) : reject(new Error("ไม่พบไฟล์ PDF ในเบราว์เซอร์นี้ กรุณาแนบไฟล์ใหม่ก่อนนำส่ง")); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("อ่านไฟล์ไม่สำเร็จ")); };
  });
}

export async function appendSystemActivity(context:LogContext,activity:Activity):Promise<void>{
 const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction("systemLogs","readwrite");tx.objectStore("systemLogs").add(createSystemLog(context,activity));tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error??new Error("บันทึก Log ไม่สำเร็จ"));};});
}
export async function loadSystemLogs():Promise<SystemLog[]>{
 const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction("systemLogs","readonly");const req=tx.objectStore("systemLogs").getAll();tx.oncomplete=()=>{db.close();resolve(req.result.reverse());};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};});
}
export async function initializeSystemLog(state:DemoState,context:LogContext):Promise<void>{
 const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(["systemLogs","systemLogMeta"],"readwrite");const req=tx.objectStore("systemLogMeta").get("legacy-import-v1");req.onsuccess=()=>{if(!req.result){for(const log of legacySystemLogs(state,context))tx.objectStore("systemLogs").add(log);tx.objectStore("systemLogMeta").put(true,"legacy-import-v1");}};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};});
}
