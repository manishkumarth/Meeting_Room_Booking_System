#!/usr/bin/env node
/**
 * RoomIt — Concurrency Test (Section 3.1 Demo)
 *
 * Fires two near-simultaneous POST /api/bookings requests for the same slot.
 * Exactly ONE must succeed (201) and the other must get 409 Conflict.
 *
 * Usage:
 *   ROOM_ID=<roomId> DATE=2025-08-01 node test-concurrency.js
 *
 * Or just run: node test-concurrency.js (uses defaults)
 */

const API = process.env.API_URL || "http://localhost:5000";
const ROOM_ID = process.env.ROOM_ID || "REPLACE_WITH_ROOM_ID";
const DATE = process.env.DATE || "2025-12-01";
const SLOT_START = process.env.SLOT || "11:00";
const SLOT_END = "11:30";
console.log(API)
async function bookSlot(userNum) {
  const start = Date.now();
  try {
    const res = await fetch(`${API}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: ROOM_ID,
        date: DATE,
        startTime: SLOT_START,
        endTime: SLOT_END,
        bookedBy: { name: `User ${userNum}`, email: `user${userNum}@test.com` },
        title: `Concurrency Test #${userNum}`,
      }),
    });
    const data = await res.json();
    const elapsed = Date.now() - start;
    return { userNum, status: res.status, data, elapsed };
  } catch (err) {
    return { userNum, status: "ERROR", error: err.message };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  RoomIt — Double-Booking Concurrency Test (3.1)");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  API:   ${API}`);
  console.log(`  Room:  ${ROOM_ID}`);
  console.log(`  Date:  ${DATE}`);
  console.log(`  Slot:  ${SLOT_START} – ${SLOT_END}`);
  console.log("───────────────────────────────────────────────────");
  console.log("  Firing 2 simultaneous booking requests...\n");

  // Fire both requests at the same time — no await between them
  const [r1, r2] = await Promise.all([bookSlot(1), bookSlot(2)]);

  console.log(`  User 1 → HTTP ${r1.status} (${r1.elapsed}ms)`);
  console.log(`           ${JSON.stringify(r1.data)}\n`);
  console.log(`  User 2 → HTTP ${r2.status} (${r2.elapsed}ms)`);
  console.log(`           ${JSON.stringify(r2.data)}\n`);

  const successes = [r1, r2].filter((r) => r.status === 201);
  const conflicts = [r1, r2].filter((r) => r.status === 409);

  console.log("───────────────────────────────────────────────────");
  if (successes.length === 1 && conflicts.length === 1) {
    console.log("   PASS — Exactly 1 succeeded, 1 got 409 Conflict");
    console.log(`   Winner: User ${successes[0].userNum}`);
  } else if (successes.length === 2) {
    console.log("   FAIL — Both requests succeeded (double-booking!)");
  } else if (successes.length === 0) {
    console.log("    Both failed — check if the slot is already booked or ROOM_ID is correct");
  } else {
    console.log(`    Unexpected result — ${successes.length} success, ${conflicts.length} conflicts`);
  }
  console.log("═══════════════════════════════════════════════════");

  // Second run: verify the slot is now confirmed-booked
  console.log("\n  Verifying slot is now taken (3rd request should 409)...");
  const r3 = await bookSlot(3);
  console.log(`  User 3 → HTTP ${r3.status}`);
  if (r3.status === 409) {
    console.log("  Slot correctly shown as unavailable for subsequent requests");
  } else {
    console.log("  Unexpected — slot should have been locked");
  }
}

main().catch(console.error);
