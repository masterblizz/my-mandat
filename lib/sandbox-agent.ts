import { Sandbox } from "@vercel/sandbox";

// NOTE: Vercel Sandbox's SDK is new and evolving quickly (GA Jan 2026).
// Before deploying, cross-check method names (runCommand, detached command
// status/logs retrieval, writeFiles) against the current docs:
// https://vercel.com/docs/sandbox/sdk-reference

const AGENT_SANDBOX_NAME = "my-mandat-agent";

const REPO_URL = process.env.AGENT_REPO_URL!; // e.g. https://github.com/gerhana-studio/my-mandat.git
const REPO_SLUG = process.env.AGENT_REPO_SLUG!; // e.g. gerhana-studio/my-mandat
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

// Reuse the same sandbox across requests so repo state + git history persist.
async function getOrCreateSandbox() {
  try {
    return await Sandbox.get({ name: AGENT_SANDBOX_NAME });
  } catch {
    const sandbox = await Sandbox.create({
      name: AGENT_SANDBOX_NAME,
      runtime: "node22",
      timeout: 45 * 60_000, // 45 min = max allowed on Hobby plan
      source: { url: REPO_URL, type: "git" },
    });

    await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "-g", "@anthropic-ai/claude-code"],
      stdout: process.stdout,
      stderr: process.stderr,
    });

    return sandbox;
  }
}

export async function startAgentTask(prompt: string) {
  const sandbox = await getOrCreateSandbox();
  const branch = `agent/${Date.now()}`;
  const safePrompt = prompt.replace(/"/g, '\\"');

  const script = [
    "set -e",
    "cd /vercel/sandbox",
    "git fetch origin main",
    "git checkout main",
    "git pull origin main",
    `git checkout -b ${branch}`,
    `claude -p "${safePrompt}" --dangerously-skip-permissions`,
    "git add -A",
    `git -c user.email="agent@my-mandat.dev" -c user.name="My Mandat Agent" commit -m "agent: ${safePrompt.slice(0, 60)}" || echo "no changes to commit"`,
    `git push https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git ${branch}`,
    // open a PR via GitHub API (falls back silently if no changes were pushed)
    `curl -s -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" ` +
      `-H "Accept: application/vnd.github+json" ` +
      `https://api.github.com/repos/${REPO_SLUG}/pulls ` +
      `-d '{"title":"agent: ${safePrompt.slice(0, 60)}","head":"${branch}","base":"main","body":"Automated change requested via agent dashboard.\\n\\nPrompt: ${safePrompt}"}'`,
  ].join("\n");

  await sandbox.writeFiles([
    { path: "run-task.sh", content: Buffer.from(script) },
  ]);

  // Run detached so the API route can return immediately; the sandbox keeps
  // working in the background (up to its own timeout) independent of the
  // invoking function's duration limit.
  const command = await sandbox.runCommand({
    cmd: "bash",
    args: ["run-task.sh"],
    detached: true,
    env: { ANTHROPIC_API_KEY },
  });

  return { sandboxId: sandbox.sandboxId, commandId: command.cmdId, branch };
}

export async function getTaskStatus(sandboxId: string, commandId: string) {
  const sandbox = await Sandbox.get({ sandboxId });
  // Verify against current SDK: retrieving a detached command's live status
  // and accumulated stdout/stderr. As of the sandbox SDK reference, commands
  // expose a way to await/poll completion and stream logs — confirm the
  // exact call (e.g. sandbox.getCommand(commandId) or command.wait()).
  const command = await sandbox.getCommand(commandId);
  return {
    done: command.exitCode !== null,
    exitCode: command.exitCode,
    stdout: await command.stdout(),
    stderr: await command.stderr(),
  };
}
