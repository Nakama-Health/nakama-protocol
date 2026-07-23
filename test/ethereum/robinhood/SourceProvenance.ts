import { expect } from "chai";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertRobinhoodSourceCommit,
  resolveRobinhoodSourceCommit,
} from "../../../scripts/lib/robinhood_source_provenance.mjs";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

describe("Robinhood artifact source provenance", function () {
  let repository: string;

  beforeEach(async function () {
    repository = await mkdtemp(join(tmpdir(), "nakama-robinhood-source-"));
    git(repository, "init", "--quiet");
    git(repository, "config", "user.email", "test@example.invalid");
    git(repository, "config", "user.name", "Nakama Test");
    await mkdir(join(repository, "contracts/robinhood"), { recursive: true });
    await writeFile(
      join(repository, "contracts/robinhood/Program.sol"),
      "contract Program {}\n"
    );
    await writeFile(
      join(repository, "hardhat.config.ts"),
      "export default {};\n"
    );
    git(repository, "add", "contracts/robinhood", "hardhat.config.ts");
    git(repository, "commit", "--quiet", "-m", "contract source");
  });

  afterEach(async function () {
    await rm(repository, { recursive: true, force: true });
  });

  it("resolves the latest committed source tree instead of self-referential HEAD", async function () {
    const sourceCommit = git(repository, "rev-parse", "HEAD");
    await writeFile(join(repository, "protocol_contract.json"), "{}\n");
    git(repository, "add", "protocol_contract.json");
    git(repository, "commit", "--quiet", "-m", "generated artifact");

    expect(resolveRobinhoodSourceCommit({ cwd: repository })).to.equal(
      sourceCommit
    );
    expect(sourceCommit).not.to.equal(git(repository, "rev-parse", "HEAD"));
  });

  it("rejects dirty or untracked contract sources", async function () {
    await writeFile(
      join(repository, "contracts/robinhood/Program.sol"),
      "contract Program { uint256 value; }\n"
    );
    expect(() => resolveRobinhoodSourceCommit({ cwd: repository })).to.throw(
      "must be committed"
    );

    git(repository, "restore", "contracts/robinhood/Program.sol");
    await writeFile(
      join(repository, "contracts/robinhood/Untracked.sol"),
      "contract Untracked {}\n"
    );
    expect(() => resolveRobinhoodSourceCommit({ cwd: repository })).to.throw(
      "must be committed"
    );
  });

  it("rejects ignored contract sources instead of silently omitting them", async function () {
    await writeFile(join(repository, ".gitignore"), "Ignored.sol\n");
    await writeFile(
      join(repository, "contracts/robinhood/Ignored.sol"),
      "contract Ignored {}\n"
    );

    expect(() => resolveRobinhoodSourceCommit({ cwd: repository })).to.throw(
      /must be tracked; ignored source files:\ncontracts\/robinhood\/Ignored\.sol/
    );
  });

  it("rejects null, abbreviated, uppercase, and zero provenance", function () {
    for (const value of [null, "abc123", "A".repeat(40), "0".repeat(40)]) {
      expect(() => assertRobinhoodSourceCommit(value)).to.throw(
        "nonzero full lowercase Git commit"
      );
    }
  });
});
