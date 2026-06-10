// CodeEditor.tsx — Monaco code editor + Run button + output display.
//
// Monaco is the same editor that powers VS Code. We use @monaco-editor/react
// which wraps it as a React component. No WebRTC or LiveKit here — this component
// is purely about writing and running code. Sending code to the agent is handled
// by VoiceSession via the Analyze button.
"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";

// ExecutionResult — the shape of data we get back from our /api/execute route.
// TypeScript interfaces define the shape of an object, like a contract.
// This lets TypeScript warn us if we try to access a field that doesn't exist.
interface ExecutionResult {
  stdout: string;
  stderr: string;
  code: number; // exit code: 0 = success, anything else = error
}

// Props — what CodeEditor expects from its parent (page.tsx).
// code: the current code string (controlled by parent)
// onCodeChange: callback to update the code in the parent when the user types
interface Props {
  code: string;
  onCodeChange: (code: string) => void;
}

export default function CodeEditor({ code, onCodeChange }: Props) {
  // result — the output from the last code execution. null means "never run yet".
  const [result, setResult] = useState<ExecutionResult | null>(null);

  // running — true while waiting for Piston API to respond. Used to disable the Run button.
  const [running, setRunning] = useState(false);

  // runCode — sends the current code to our /api/execute backend route,
  // which proxies it to the Piston API (free sandboxed code execution).
  async function runCode() {
    if (!code.trim() || running) return;
    setRunning(true);
    setResult(null); // clear previous output

    try {
      // POST to our own Next.js API route.
      // We don't call Piston directly from the browser because:
      //   1. We may want to add rate limiting later
      //   2. Keeps the Piston URL configurable server-side
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error("Execution service unavailable");
      const data: ExecutionResult = await res.json();
      setResult(data);
    } catch {
      // If the API route itself fails (not the user's code), show a friendly error.
      setResult({ stdout: "", stderr: "Could not reach execution service.", code: 1 });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">

      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">solution.py</span>
        <button
          onClick={runCode}
          disabled={running}
          className="px-4 py-1.5 text-sm bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-white font-medium transition-colors"
        >
          {running ? "Running..." : "▶ Run"}
        </button>
      </div>

      {/* Monaco editor — the actual code editor.
          height="400px"     — fixed height for now
          language="python"  — enables Python syntax highlighting
          theme="vs-dark"    — dark theme to match the rest of the UI
          value={code}       — controlled: editor displays whatever `code` contains
          onChange           — called on every keystroke, updates `code` in parent
          options            — Monaco configuration:
            minimap disabled  — the tiny code preview on the right is distracting here
            fontSize 14       — readable default
            scrollBeyondLastLine false — don't add blank space after last line */}
      <Editor
        height="400px"
        language="python"
        theme="vs-dark"
        value={code}
        onChange={(value) => onCodeChange(value ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          padding: { top: 12 },
        }}
      />

      {/* Output panel — only shown after at least one run */}
      {result !== null && (
        <div className="border-t border-zinc-800 p-4 font-mono text-xs max-h-40 overflow-y-auto">

          {/* stdout — normal program output (print statements) */}
          {result.stdout && (
            <pre className="text-emerald-400 whitespace-pre-wrap">{result.stdout}</pre>
          )}

          {/* stderr — error messages, tracebacks */}
          {result.stderr && (
            <pre className="text-red-400 whitespace-pre-wrap">{result.stderr}</pre>
          )}

          {/* If both are empty, the code ran but printed nothing */}
          {!result.stdout && !result.stderr && (
            <p className="text-zinc-500">
              {result.code === 0 ? "Ran successfully (no output)" : "Exited with error"}
            </p>
          )}

          {/* Exit code badge — green for 0 (success), red for anything else */}
          <p className={`mt-2 ${result.code === 0 ? "text-zinc-500" : "text-red-500"}`}>
            Exit code: {result.code}
          </p>
        </div>
      )}
    </div>
  );
}
