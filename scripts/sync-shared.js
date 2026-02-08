#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sharedRoot = path.join(rootDir, "projects", "schema-shared", "src", "lib");
const targets = [
  path.join(rootDir, "projects", "schema-ng19", "src", "lib", "shared"),
  path.join(rootDir, "projects", "schema-ng16", "src", "lib", "shared"),
];

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else if (ent.isFile()) fs.copyFileSync(s, d);
  }
}

for (const t of targets) {
  fs.rmSync(t, { recursive: true, force: true });
  copyDir(sharedRoot, t);
}

console.log("Synced schema-shared into schema-ng19 and schema-ng16.");
