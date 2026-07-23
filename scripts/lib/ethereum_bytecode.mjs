// SPDX-License-Identifier: AGPL-3.0-or-later

import { keccak256 } from "ethers";

const BYTECODE_PATTERN = /^0x(?:[0-9a-fA-F]{2})*$/;

function assertBytecode(bytecode) {
  if (typeof bytecode !== "string" || !BYTECODE_PATTERN.test(bytecode)) {
    throw new Error("Runtime bytecode must be an even-length 0x-prefixed hex string");
  }
}

export function canonicalImmutableReferences(references = []) {
  const flattened = Array.isArray(references)
    ? references
    : Object.values(references).flatMap((entries) => entries);
  const canonical = flattened.map((entry) => {
    if (
      entry === null
      || typeof entry !== "object"
      || !Number.isSafeInteger(entry.start)
      || entry.start < 0
      || !Number.isSafeInteger(entry.length)
      || entry.length <= 0
    ) {
      throw new Error("Immutable references must contain non-negative byte starts and positive byte lengths");
    }
    return { start: entry.start, length: entry.length };
  }).sort((left, right) => left.start - right.start || left.length - right.length);

  for (let index = 1; index < canonical.length; index += 1) {
    const previous = canonical[index - 1];
    if (canonical[index].start < previous.start + previous.length) {
      throw new Error("Immutable reference byte ranges must not overlap");
    }
  }
  return canonical;
}

export function normalizeRuntimeBytecode(bytecode, references) {
  assertBytecode(bytecode);
  const canonical = canonicalImmutableReferences(references);
  const bytes = Buffer.from(bytecode.slice(2), "hex");
  for (const { start, length } of canonical) {
    if (start + length > bytes.length) {
      throw new Error("Immutable reference byte range exceeds runtime bytecode length");
    }
    bytes.fill(0, start, start + length);
  }
  return `0x${bytes.toString("hex")}`;
}

export function runtimeBytecodeTemplateHash(bytecode, references) {
  return keccak256(normalizeRuntimeBytecode(bytecode, references));
}

export function runtimeBytecodeBytes(bytecode) {
  assertBytecode(bytecode);
  return (bytecode.length - 2) / 2;
}
