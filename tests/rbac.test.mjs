import test from "node:test";
import assert from "node:assert/strict";
import {
  can,
  visibleWards,
  assetScopeWhere,
  actorFromUser,
  assetInScope,
  assetInHospital,
  resolveSessionActor,
} from "../lib/rbac.mjs";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth.mjs";

test("matrix covers all role/action combos", () => {
  assert.equal(can("ADMIN", "assets:create"), true);
  assert.equal(can("AUDITOR", "assets:delete"), false);
  assert.equal(can("WARD", "assets:update"), false);
  assert.equal(can("AUDITOR", "assets:read"), true);
});

test("unknown role / action => always false", () => {
  assert.equal(can("HACKER", "assets:read"), false);
  assert.equal(can("ADMIN", "assets:explode"), false);
  assert.equal(can(null, "assets:read"), false);
});

test("visibleWards: WARD only assigned wards; other roles => null (all)", () => {
  assert.deepEqual(visibleWards("WARD", ["ICU", "W2"]), ["ICU", "W2"]);
  assert.deepEqual(visibleWards("WARD", []), []);
  assert.equal(visibleWards("ADMIN", null), null);
});

test("assetScopeWhere: WARD => {wardId:{in}}, empty WARD => {wardId:{in:[]}}, other => {}", () => {
  assert.deepEqual(assetScopeWhere("WARD", ["ICU"]), { wardId: { in: ["ICU"] } });
  assert.deepEqual(assetScopeWhere("WARD", []), { wardId: { in: [] } });
  assert.deepEqual(assetScopeWhere("ADMIN", null), {});
});

test("actorFromUser: summarizes actor from a user record", () => {
  assert.deepEqual(
    actorFromUser({ id: "u9", role: "ADMIN", hospitalId: "UTH", wards: [] }),
    { id: "u9", role: "ADMIN", hospitalId: "UTH", wards: [] },
  );
});

test("assetInScope: WARD only own wards; other roles see any asset", () => {
  const ward = { role: "WARD", wards: ["ICU", "W2"] };
  assert.equal(assetInScope(ward, { wardId: "ICU" }), true);
  assert.equal(assetInScope(ward, { wardId: "OTHER" }), false);
  assert.equal(assetInScope({ role: "WARD", wards: [] }, { wardId: "ICU" }), false);
  assert.equal(assetInScope({ role: "ADMIN" }, { wardId: "ANYWARD" }), true);
});

test("assetInHospital: no cross-hospital; null hospitalId => allowed", () => {
  assert.equal(assetInHospital({ hospitalId: "UTH" }, { hospitalId: "UTH" }), true);
  assert.equal(assetInHospital({ hospitalId: "UTH" }, { hospitalId: "OTHER" }), false);
  assert.equal(assetInHospital({ hospitalId: null }, { hospitalId: "UTH" }), true);
});

test("resolveSessionActor: builds actor from a valid session cookie", () => {
  const token = createSessionToken(
    { sub: "u1", role: "ADMIN", hospitalId: "UTH", wards: [] },
    "secret-1",
    60,
  );
  const result = resolveSessionActor(`${SESSION_COOKIE}=${token}`, "secret-1");
  assert.equal(result.ok, true);
  assert.equal(result.actor.id, "u1");
  assert.equal(result.actor.role, "ADMIN");
  assert.equal(result.actor.hospitalId, "UTH");
});

test("resolveSessionActor: missing cookie => 401", () => {
  const result = resolveSessionActor("", "secret-1");
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("resolveSessionActor: tampered payload (bad signature) => 401", () => {
  const token = createSessionToken({ sub: "u1", role: "WARD" }, "secret-1", 60);
  const [version, , sig] = token.split(".");
  const forged = `${version}.${Buffer.from(JSON.stringify({ sub: "u1", role: "ADMIN" })).toString("base64url")}.${sig}`;
  const result = resolveSessionActor(`${SESSION_COOKIE}=${forged}`, "secret-1");
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("resolveSessionActor: token signed with a different secret => 401", () => {
  const token = createSessionToken({ sub: "u1", role: "ADMIN" }, "secret-1", 60);
  const result = resolveSessionActor(`${SESSION_COOKIE}=${token}`, "secret-2");
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});
