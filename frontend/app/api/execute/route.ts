// route.ts — POST /api/execute
// Proxies the student's Python code to the Piston API for sandboxed execution.
//
// Why proxy instead of calling Piston directly from the browser?
//   1. Keeps the Piston URL in one place (easy to swap later)
//   2. Lets us add rate limiting per user in the future
//   3. Avoids CORS issues (browsers restrict cross-origin fetch in some cases)
//
// What is Piston?
//   A free, open-source code execution engine. It runs code in isolated Docker
//   containers so user code can never touch our server. Supports 50+ languages.
//   Free public instance at emkc.org — no API key needed.

import { NextRequest, NextResponse } from "next/server";

// Piston API request shape — what we send to emkc.org
interface PistonRequest {
  language: string;
  version: string;
  files: { content: string }[];
}

// Piston API response shape — what we get back
interface PistonResponse {
  run: {
    stdout: string;
    stderr: string;
    code: number;   // exit code: 0 = success
    signal: string | null;
  };
}

export async function POST(req: NextRequest) {
  // Parse the code from the request body sent by CodeEditor.tsx
  const { code } = await req.json();

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  // Build the Piston API request.
  // version: "3.10.0" — specific Python version. Piston requires an exact version string.
  // files: array of file objects — Piston supports multi-file programs, but we only need one.
  const pistonPayload: PistonRequest = {
    language: "python",
    version: "3.10.0",
    files: [{ content: code }],
  };

  try {
    const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pistonPayload),
    });

    if (!pistonRes.ok) {
      return NextResponse.json(
        { error: "Piston API returned an error" },
        { status: 502 }
      );
    }

    const pistonData: PistonResponse = await pistonRes.json();

    // Return just the fields CodeEditor.tsx needs — stdout, stderr, exit code.
    // We don't forward the full Piston response to keep the contract clean.
    return NextResponse.json({
      stdout: pistonData.run.stdout,
      stderr: pistonData.run.stderr,
      code: pistonData.run.code,
    });
  } catch {
    // Network error reaching Piston (e.g. emkc.org is down)
    return NextResponse.json(
      { stdout: "", stderr: "Could not reach execution service.", code: 1 },
      { status: 200 } // return 200 so CodeEditor shows the error message, not a crash
    );
  }
}
