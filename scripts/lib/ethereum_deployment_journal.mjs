// SPDX-License-Identifier: AGPL-3.0-or-later

import { lstat, open, rename } from "node:fs/promises";
import { dirname } from "node:path";

function serialized(value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (content.trim() === "") throw new Error("Deployment journal content cannot be empty");
  return content;
}

async function syncDirectory(path) {
  const directory = await open(dirname(path), "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export async function assertPathAbsent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Refusing deployment while unreconciled operator state exists: ${path}`);
}

export async function createDeploymentIntent(path, intent) {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(serialized(intent), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(path);
}

export async function replaceDeploymentJournal(path, value) {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  const handle = await open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(serialized(value), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, path);
  await syncDirectory(path);
}

export async function writeExclusiveDeploymentRecord(path, value) {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(serialized(value), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(path);
}
