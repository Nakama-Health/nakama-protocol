// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";

export const ROBINHOOD_SOURCE_PATHS = Object.freeze([
  ":(glob)contracts/robinhood/**/*.sol",
  "hardhat.config.ts",
]);

const FULL_GIT_COMMIT = /^[0-9a-f]{40}$/;

export function assertRobinhoodSourceCommit(value) {
  if (
    typeof value !== "string" ||
    !FULL_GIT_COMMIT.test(value) ||
    /^0{40}$/.test(value)
  ) {
    throw new Error(
      "Robinhood sourceCommit must be a nonzero full lowercase Git commit."
    );
  }
  return value;
}

export function resolveRobinhoodSourceCommit({
  cwd = process.cwd(),
  sourcePaths = ROBINHOOD_SOURCE_PATHS,
  runGit = defaultRunGit,
} = {}) {
  if (
    !Array.isArray(sourcePaths) ||
    sourcePaths.length === 0 ||
    sourcePaths.some(
      (value) =>
        typeof value !== "string" ||
        value.trim() === "" ||
        value.startsWith("-")
    )
  ) {
    throw new Error("Robinhood source paths must be a non-empty safe list.");
  }

  const status = runGit(
    ["status", "--porcelain=v1", "--untracked-files=all", "--", ...sourcePaths],
    cwd
  ).trim();
  if (status !== "") {
    throw new Error(
      "Robinhood contract sources must be committed before artifact generation."
    );
  }

  const ignoredSources = runGit(
    [
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "--",
      ...sourcePaths,
    ],
    cwd
  ).trim();
  if (ignoredSources !== "") {
    throw new Error(
      `Robinhood contract sources must be tracked; ignored source files:\n${ignoredSources}`
    );
  }

  const sourceCommit = assertRobinhoodSourceCommit(
    runGit(["log", "-1", "--format=%H", "--", ...sourcePaths], cwd).trim()
  );
  runGit(["cat-file", "-e", `${sourceCommit}^{commit}`], cwd);
  runGit(["merge-base", "--is-ancestor", sourceCommit, "HEAD"], cwd);
  runGit(["diff", "--quiet", sourceCommit, "--", ...sourcePaths], cwd);
  return sourceCommit;
}

function defaultRunGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
