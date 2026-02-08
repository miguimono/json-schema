#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const rootPkgPath = path.join(rootDir, "package.json");
const schemaPkgPath = path.join(rootDir, "projects", "schema-ng19", "package.json");
const schemaNg16PkgPath = path.join(rootDir, "projects", "schema-ng16", "package.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const rootPkg = readJson(rootPkgPath);
const version = rootPkg.version;

if (!version || typeof version !== "string") {
  console.error("ERROR: root package.json has no valid version.");
  process.exit(1);
}

const schemaPkg = readJson(schemaPkgPath);
const schemaNg16Pkg = readJson(schemaNg16PkgPath);

schemaPkg.version = version;
schemaNg16Pkg.version = version;

writeJson(schemaPkgPath, schemaPkg);
writeJson(schemaNg16PkgPath, schemaNg16Pkg);

console.log(`Synced versions to ${version}`);
