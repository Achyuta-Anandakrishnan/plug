import { execFileSync } from "child_process";
import fs from "fs";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in environment.`);
  return value;
}

function runGit(args, extraEnv = {}) {
  return execFileSync("git", args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

async function githubRequest(path, init = {}) {
  const token = requireEnv("GITHUB_TOKEN");
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message ? String(data.message) : `HTTP ${res.status}`;
    throw new Error(`GitHub API error: ${msg}`);
  }
  return data;
}

function getRepoNameFromPackageJson() {
  try {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    return typeof pkg.name === "string" && pkg.name.trim() ? pkg.name.trim() : null;
  } catch {
    return null;
  }
}

function makeAskpassScript(tmpPath) {
  // Provide username + token non-interactively for HTTPS pushes.
  const script = `#!/bin/sh
case "$1" in
  *Username*) echo "x-access-token" ;;
  *Password*) echo "$GITHUB_TOKEN" ;;
  *) echo "" ;;
esac
`;
  fs.writeFileSync(tmpPath, script, { mode: 0o700 });
}

async function main() {
  const repo = process.env.GITHUB_REPO || getRepoNameFromPackageJson() || "plug";
  const isPrivate = process.env.GITHUB_PRIVATE
    ? process.env.GITHUB_PRIVATE !== "0"
    : true;

  const me = await githubRequest("/user");
  const owner = process.env.GITHUB_OWNER || me?.login;
  if (!owner) throw new Error("Unable to determine GitHub owner.");

  const full = `${owner}/${repo}`;
  console.log(`Target repo: ${full}`);

  // Create repo if missing.
  try {
    await githubRequest(`/repos/${owner}/${repo}`);
    console.log("Repo exists.");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes("Not Found")) throw e;
    console.log("Creating repo...");
    await githubRequest("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: repo,
        private: isPrivate,
        auto_init: false,
      }),
    });
    console.log("Repo created.");
  }

  // Ensure we're on main.
  runGit(["branch", "-M", "main"]);

  // Set origin to tokenless URL.
  const originUrl = `https://github.com/${owner}/${repo}.git`;
  try {
    execFileSync("git", ["remote", "add", "origin", originUrl], { stdio: "inherit" });
  } catch {
    execFileSync("git", ["remote", "set-url", "origin", originUrl], { stdio: "inherit" });
  }

  // Push without storing token in git config.
  const askpass = ".git/.askpass-github.sh";
  makeAskpassScript(askpass);
  try {
    runGit(["push", "-u", "origin", "main"], {
      GIT_ASKPASS: askpass,
      GIT_TERMINAL_PROMPT: "0",
    });
  } finally {
    try {
      fs.unlinkSync(askpass);
    } catch {
      // ignore
    }
  }

  console.log("Pushed main to origin.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

