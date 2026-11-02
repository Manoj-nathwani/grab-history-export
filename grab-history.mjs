#!/usr/bin/env node
/**
 * Download your full Grab booking history (rides, GrabFood, GrabMart,
 * GrabExpress...) as CSV and JSON.
 *
 * Uses the same endpoint as Grab's own help centre (help.grab.com), with your
 * own logged-in session token. Nothing is sent anywhere else.
 *
 *   GRAB_TOKEN=<token> node grab-history.mjs [--months 36] [--out grab-history] [--no-locations]
 *
 * No dependencies. Node 18 or newer.
 */
import { writeFile } from "node:fs/promises";

const URL = "https://api.grab.com/helpcenter/v1/passengers/bookinghistory";

function parseArgs(argv) {
  const args = { months: 36, out: "grab-history", locations: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--months") args.months = Number(argv[++i]);
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--no-locations") args.locations = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "GRAB_TOKEN=<token> node grab-history.mjs [--months 36] [--out grab-history] [--no-locations]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(args.months) || args.months < 1) {
    throw new Error("--months must be a whole number of months, 1 or more");
  }
  return args;
}

async function fetchWindow(token, start, end) {
  const response = await fetch(URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "https://help.grab.com",
      referer: "https://help.grab.com/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      creationTimeStart: start.toISOString(),
      creationTimeEnd: end.toISOString(),
    }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Grab refused the token. It lasts about two hours: copy a fresh one (see README).",
    );
  }
  if (!response.ok) return { ok: false, status: response.status, items: [] };
  const body = await response.json();
  return { ok: true, items: body.receiptItems ?? [] };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.GRAB_TOKEN?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Set GRAB_TOKEN to your help.grab.com bearer token (see README).");
  }

  const now = new Date();
  const byId = new Map();
  // One month per request, newest first, so a long history never hits a cap.
  for (let back = 0; back < args.months; back += 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back + 1, 1) - 1);
    const month = start.toISOString().slice(0, 7);
    const { ok, status, items } = await fetchWindow(token, start, end);
    if (!ok) console.log(`${month}: no answer (HTTP ${status})`);
    else if (items.length) console.log(`${month}: ${items.length} bookings`);
    for (const item of items) byId.set(item.id, item);
    await sleep(300);
  }

  const rows = [...byId.values()].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  const columns = [
    "id",
    "dateTime",
    "type",
    "taxiType",
    "receiptType",
    "currency",
    "amount",
    ...(args.locations ? ["pickUpLocation", "dropOffLocation"] : []),
  ];
  const kept = rows.map((row) => Object.fromEntries(columns.map((key) => [key, row[key] ?? null])));

  await writeFile(`${args.out}.json`, `${JSON.stringify(kept, null, 2)}\n`);
  await writeFile(
    `${args.out}.csv`,
    `${[columns.join(","), ...kept.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\n")}\n`,
  );

  const totals = new Map();
  for (const row of kept) {
    const key = `${row.dateTime.slice(0, 4)}  ${row.type.padEnd(10)} ${row.currency}`;
    const total = totals.get(key) ?? { count: 0, amount: 0 };
    total.count += 1;
    total.amount += Number(row.amount) || 0;
    totals.set(key, total);
  }
  console.log(`\n${kept.length} bookings → ${args.out}.csv and ${args.out}.json`);
  if (kept.length) {
    console.log(`From ${kept[0].dateTime.slice(0, 10)} to ${kept.at(-1).dateTime.slice(0, 10)}\n`);
    console.log("Year  Type       Currency  Bookings  Total");
    for (const [key, total] of [...totals].sort()) {
      console.log(`${key}  ${String(total.count).padStart(8)}  ${total.amount.toFixed(2)}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
