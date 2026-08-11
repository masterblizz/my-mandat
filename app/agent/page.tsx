"use client";

import { useState, useRef } from "react";

export default function AgentPage() {
  const [secret, setSecret] = useState("");
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function submit() {
    setRunning(true);
    setLog("Starting sandbox task...\n");
    setBranch(null);

    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json();
      setLog((l) => l + `\nError: ${err.error}`);
      setRunning(false);
      return;
    }

    const data = await res.json();
    setBranch(data.branch);
    setLog((l) => l + `Sandbox: ${data.sandboxId}\nBranch: ${data.branch}\n\n`);

    pollRef.current = setInterval(async () => {
      const statusRes = await fetch(
        `/api/agent/status?sandboxId=${data.sandboxId}&commandId=${data.commandId}`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const status = await statusRes.json();
      setLog(
        (l) =>
          `${l.split("--- live output ---")[0]}--- live output ---\n${status.stdout}\n${status.stderr}`
      );

      if (status.done) {
        clearInterval(pollRef.current!);
        setRunning(false);
      }
    }, 3000);
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Dev Agent</h1>

      <input
        type="password"
        placeholder="Agent secret"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />

      <textarea
        placeholder="e.g. Add rate limiting to the /api/chat route"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />

      <button onClick={submit} disabled={running || !prompt || !secret}>
        {running ? "Running..." : "Send to agent"}
      </button>

      {branch && (
        <p style={{ marginTop: 12 }}>
          Branch: <code>{branch}</code>
        </p>
      )}

      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: 12,
          marginTop: 16,
          minHeight: 200,
          whiteSpace: "pre-wrap",
        }}
      >
        {log}
      </pre>
    </div>
  );
}
