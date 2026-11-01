import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('API ตรวจตัวตน สิทธิ์ และขนาดข้อมูลก่อนเข้าฐานข้อมูล', { timeout: 18000 }, async t => {
  // สร้างกุญแจชั่วคราวในหน่วยความจำ ไม่บันทึก secret ลงไฟล์
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const issuer = 'https://issuer.uth.test';
  const audience = 'uth-assets-test';
  const timestamp = Math.floor(Date.now() / 1000);
  function token(changes = {}) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: issuer, aud: audience, sub: 'test-staff', iat: timestamp, exp: timestamp + 120,
      hospitalId: '11111111-1111-4111-8111-111111111111',
      deviceId: '22222222-2222-4222-8222-222222222222',
      roles: ['WAREHOUSE'], wards: ['33333333-3333-4333-8333-333333333333'],
      token_use: 'access', ...changes
    })).toString('base64url');
    const input = `${header}.${payload}`;
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  }
  const backendDirectory = fileURLToPath(new URL('../backend/', import.meta.url));
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: backendDirectory,
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', JWT_ISSUER: issuer,
      JWT_AUDIENCE: audience, JWT_PUBLIC_KEY_PEM: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      DATABASE_URL: 'mysql://test:test@127.0.0.1:1/uth_auth_test?connect_timeout=1' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let startupTimer;
  let logs = '';
  child.stderr.on('data', () => {});
  try {
    const base = await new Promise((resolve, reject) => {
      startupTimer = setTimeout(() => reject(new Error('Backend did not start within 7 seconds; build backend first')), 7000);
      child.once('error', reject);
      child.once('exit', code => reject(new Error(`Backend exited before startup (${code}); build backend first`)));
      child.stdout.on('data', chunk => {
        logs += chunk.toString();
        const lines = logs.split('\n'); logs = lines.pop() ?? '';
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const match = typeof entry.msg === 'string' && entry.msg.match(/^Server listening at (http:\/\/127\.0\.0\.1:\d+)$/);
            if (match) { clearTimeout(startupTimer); resolve(match[1]); }
          } catch { /* ข้ามบรรทัดที่ไม่ใช่ structured log */ }
        }
      });
    });
    async function post(body, bearer, expected) {
      const response = await fetch(`${base}/api/sync`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
        body, signal: AbortSignal.timeout(2000)
      });
      const result = await response.json();
      assert.equal(response.status, expected, JSON.stringify(result));
      assert.equal(typeof result.error, 'string');
    }
    await t.test('health เปิดได้โดยไม่เชื่อมฐานข้อมูล', async () => {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'ok');
    });
    await t.test('ไม่มี bearer ต้องปฏิเสธ 401', () => post('{}', null, 401));
    await t.test('bearer ผิดรูปแบบต้องปฏิเสธ 401', () => post('{}', 'not-a-jwt', 401));
    await t.test('JWT ถูกลงนามแต่ audience ผิดต้องปฏิเสธ 401', () => post('{}', token({ aud: 'another-app' }), 401));
    await t.test('AUDITOR อ่านอย่างเดียวส่ง sync ไม่ได้ 403', () => post('{}', token({ roles: ['AUDITOR'] }), 403));
    await t.test('WAREHOUSE ผ่าน auth แต่คำสั่งไม่ครบต้องปฏิเสธ 400', () => post('{}', token(), 400));
    await t.test('JSON เสียต้องปฏิเสธ 400', () => post('{', token(), 400));
    await t.test('body ใหญ่เกินขีดจำกัดต้องปฏิเสธ 413', () => post(JSON.stringify({ data: 'x'.repeat(5000) }), token(), 413));
  } finally {
    clearTimeout(startupTimer);
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 1500))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }
});
