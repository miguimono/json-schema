#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const sharedRoot = path.join(rootDir, "projects", "schema-shared", "src", "lib");
const targets = [
  path.join(rootDir, "projects", "schema-ng19", "src", "lib", "shared"),
  path.join(rootDir, "projects", "schema-ng16", "src", "lib", "shared"),
];

function hashFile(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

function rel(base, p) {
  return path.relative(base, p).replace(/\\/g, "/");
}

const sharedFiles = listFiles(sharedRoot).map((p) => rel(sharedRoot, p));
const sharedSet = new Set(sharedFiles);

let ok = true;
for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.error(`Missing target folder: ${t}`);
    ok = false;
    continue;
  }
  const targetFiles = listFiles(t).map((p) => rel(t, p));
  const targetSet = new Set(targetFiles);

  // Missing or extra files
  for (const f of sharedSet) {
    if (!targetSet.has(f)) {
      console.error(`Missing in target: ${t}/${f}`);
      ok = false;
    }
  }
  for (const f of targetSet) {
    if (!sharedSet.has(f)) {
      console.error(`Extra in target: ${t}/${f}`);
      ok = false;
    }
  }

  // Content diff
  for (const f of sharedSet) {
    const sp = path.join(sharedRoot, f);
    const tp = path.join(t, f);
    if (!fs.existsSync(tp)) continue;
    if (hashFile(sp) !== hashFile(tp)) {
      console.error(`Diff content: ${t}/${f}`);
      ok = false;
    }
  }
}

if (!ok) {
  console.error("Shared sync check FAILED. Run `npm run sync:shared`.");
  process.exit(1);
}
console.log("Shared sync check OK.");
