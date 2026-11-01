import { createSeed, type DemoState } from "./seed";
const DATABASE = "uth-smart-assets-demo-v1";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state")) request.result.createObjectStore("state");
      if (!request.result.objectStoreNames.contains("planningFiles")) request.result.createObjectStore("planningFiles");
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
export async function saveState(state: DemoState, file?: PlanningFileWrite) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(file ? ["state", "planningFiles"] : ["state"], "readwrite");
    tx.objectStore("state").put(state, "current");
    // ไฟล์และข้อมูลแผนต้องบันทึกสำเร็จพร้อมกัน
    if (file) tx.objectStore("planningFiles").add(file.blob, file.id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("STORAGE_ABORTED")); };
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
