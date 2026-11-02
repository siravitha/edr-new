export const MAX_PLANNING_PDF_BYTES = 10 * 1024 * 1024;
export type BookletFile = { fileId:string; name:string; size:number; sha256:string };
export async function inspectPlanningPdf(name:string, mime:string, bytes:Uint8Array):Promise<BookletFile> {
  if(!/\.pdf$/i.test(name)||name.length>200||/[\x00-\x1f\x7f\\/]/.test(name)) throw new Error("เลือกไฟล์นามสกุล .pdf และชื่อไฟล์ไม่เกิน 200 ตัวอักษร");
  if(mime && mime!=="application/pdf") throw new Error("ชนิดไฟล์ต้องเป็น PDF เท่านั้น");
  if(bytes.byteLength<20 || bytes.byteLength>MAX_PLANNING_PDF_BYTES) throw new Error("ไฟล์ PDF ต้องไม่ว่างและมีขนาดไม่เกิน 10 MB");
  const header=new TextDecoder().decode(bytes.slice(0,8)),tail=new TextDecoder().decode(bytes.slice(-1024));
  if(!/^%PDF-(1\.[0-7]|2\.0)/.test(header)||!tail.includes("%%EOF")) throw new Error("ไฟล์ไม่ผ่านการตรวจรูปแบบ PDF เบื้องต้น กรุณาส่งออกเป็น PDF ใหม่");
  const digest=await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer);
  return {fileId:crypto.randomUUID(),name,size:bytes.byteLength,sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("")};
}
