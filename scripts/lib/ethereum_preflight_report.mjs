// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalImmutableReferences } from "./ethereum_bytecode.mjs";

function required(value, field) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Preflight report field ${field} is unavailable`);
  }
  return value;
}

export function buildEthereumPreflightReport(config, release, runtime, chainId) {
  return {
    ok: true,
    mode: "preflight-only-no-transaction",
    chainId: Number(chainId),
    caip2: "eip155:1",
    deployer: required(runtime.deployer, "deployer"),
    balanceRequirementMet: true,
    runtimeBytecodeBytes: required(runtime.runtimeBytecodeBytes, "runtimeBytecodeBytes"),
    sourceCommit: required(config.sourceCommit, "sourceCommit"),
    auditReportSha256: required(config.auditReportSha256, "auditReportSha256"),
    releaseApprovalSha256: required(config.releaseApprovalSha256, "releaseApprovalSha256"),
    creationBytecodeHash: required(release.protocolCreationBytecodeHash, "creationBytecodeHash"),
    runtimeBytecodeTemplateHash: required(
      release.protocolRuntimeBytecodeTemplateHash,
      "runtimeBytecodeTemplateHash",
    ),
    immutableReferences: canonicalImmutableReferences(
      required(release.protocolImmutableReferences, "immutableReferences"),
    ),
    protocolArtifactSha256: required(release.protocolArtifactSha256, "protocolArtifactSha256"),
    confirmations: required(config.confirmations, "confirmations"),
  };
}
