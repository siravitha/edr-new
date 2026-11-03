// flow-store.test.mjs — DB persistence + optimistic CAS + audit log (REAL, on SQLite).
// Runs against a temp copy of the real prisma/dev.db so the live DB is never mutated.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { transitionFlow, emptyFlow, flowTotals } from "../lib/procurement-flow.ts";
import { commitFlowState, getFlowState, listFlowEvents, FlowConflictError } from "../lib/flow-store.ts";

const HOSP = "UTH";
const REPO = new URL("../", import.meta.url).pathname;
const DB = path.join(REPO, "prisma", "dev.db");

// A fresh 15-step planning-stage case inside an empty FlowState.
function planningFlow() {
  const base = emptyFlow();
  base.cases.push({
    caseId: "c1", kind: "PROC", status: "PLANNING_DRAFT",
    steps: [{ key: "planning_d", status: "READY", at: "2026-01-01T00:00:00.000Z" }],
    plan: { id: "p1", status: "PLANNING", wardId: "W1", items: [{ id: "i1", qty: 5 }], demandRef: "d1" },
    demand: { id: "d1", status: "PLANNING", lines: [{ id: "l1", qty: 10 }] },
    vendor: null, quote: null, contract: null, po: null, receipts: [], claims: [], evidence: [], conflicts: [],
    createdAt: "2026-01-01T00:00:00.000Z", createdBy: "U1", history: [], legal: null,
  });
  return base;
}
const ev = (action, caseId, payload) => ({ action, actorId: "U1", actorRole: "ADMIN", caseId, payload });

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flowstore-"));
const tmp = path.join(tmpDir, "flow.db");
fs.copyFileSync(DB, tmp);
const db = new PrismaClient({ datasources: { db: { url: "file:" + tmp } } });

test("flow-store: CAS commit, conflict detection, and audit log", async (t) => {
  t.test("empty read before first commit", async () => {
    assert.equal(await getFlowState(db, HOSP), null);
  });

  t.test("first commit (rev 0 -> 1) persists + logs event", async () => {
    const next = transitionFlow(planningFlow(), { type: "CREATE_PR", data: { caseId: "c1", title: "PR-1", demand: { id: "d1" }, vendor: { id: "v1", name: "V" } } }, "U1", 0);
    assert.equal(next.revision, 1);
    const rec = await commitFlowState(db, HOSP, next, 0, ev("CREATE_PR", "c1", { title: "PR-1" }));
    assert.equal(rec.version, 1);
    const reread = await getFlowState(db, HOSP);
    assert.equal(reread.state.revision, 1);
    assert.equal(reread.state.cases.length, 1);
    assert.equal(reread.state.cases[0].status, "PLANNING_DRAFT");
  });

  t.test("stale expectedVersion -> FlowConflictError, state unchanged", async () => {
    const base = (await getFlowState(db, HOSP)).state; // rev 1
    const next = transitionFlow(base, { type: "RECEIVE", caseId: "c1", data: { lineId: "l1", qty: 4, method: "MANUAL" } }, "U9", 1);
    assert.equal(next.revision, 2);
    await assert.rejects(
      async () => commitFlowState(db, HOSP, next, 0, ev("RECEIVE", "c1")), // wrong expectedVersion (0, but store is at 1)
      (e) => e instanceof FlowConflictError,
    );
    const reread = await getFlowState(db, HOSP);
    assert.equal(reread.state.revision, 1, "a failed commit must not change the state");
  });

  t.test("concurrent double-spend -> exactly one commit wins (CAS), the other 409s", async () => {
    const current = (await getFlowState(db, HOSP)).state; // rev 1
    const clientA = transitionFlow(current, { type: "RECEIVE", caseId: "c1", data: { lineId: "l1", qty: 4, method: "MANUAL" } }, "WA", 1);
    const clientB = transitionFlow(current, { type: "RECEIVE", caseId: "c1", data: { lineId: "l1", qty: 9, method: "MANUAL" } }, "WB", 1);
    assert.equal(clientA.revision, 2);
    assert.equal(clientB.revision, 2);

    const results = await Promise.allSettled([
      commitFlowState(db, HOSP, clientA, 1, ev("RECEIVE", "c1", { who: "A" })),
      commitFlowState(db, HOSP, clientB, 1, ev("RECEIVE", "c1", { who: "B" })),
    ]);

    const wins = results.filter((r) => r.status === "fulfilled");
    const losses = results.filter((r) => r.status === "rejected");
    assert.equal(wins.length, 1, "exactly one commit must succeed");
    assert.equal(losses.length, 1, "the other commit must be rejected");
    assert.ok(losses[0].reason instanceof FlowConflictError, "the loser must be a FlowConflictError (409)");
    const reread = await getFlowState(db, HOSP);
    assert.equal(reread.state.revision, 2, "version advanced exactly once (no lost update)");
  });

  t.test("event log: one row per successful commit, newest first, case-scoped", async () => {
    const events = await listFlowEvents(db, HOSP);
    assert.ok(events.length >= 2, "at least CREATE_PR + one RECEIVE are logged");
    assert.ok(events.some((e) => e.action === "CREATE_PR"));
    assert.ok(events.some((e) => e.action === "RECEIVE"));
    const revs = events.map((e) => e.revision);
    assert.deepEqual(revs, [...revs].sort((a, b) => b - a), "events must be newest-first");
    const scoped = await listFlowEvents(db, HOSP, "c1");
    assert.ok(scoped.every((e) => e.caseId === "c1"), "caseId filter works");
  });
});

after(async () => {
  await db.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});