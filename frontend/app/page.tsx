// page.tsx — the main page. Phase 2 layout: voice panel (left) + code editor (right).
//
// "use client" is needed here because we use useState to hold the `code` value
// that is shared between VoiceSession (sends it to the agent) and CodeEditor
// (where the user types). State can only live in client components.
"use client";

import { useState } from "react";
import VoiceSession from "@/components/VoiceSession";
import CodeEditor from "@/components/CodeEditor";

// The default starter code shown when the page loads.
// Pre-filled with the Two Sum function signature so the student isn't staring at a blank editor.
const DEFAULT_CODE = `def two_sum(nums: list[int], target: int) -> list[int]:
    # Write your solution here
    pass


# Test case — feel free to change this
print(two_sum([2, 7, 11, 15], 9))  # Expected: [0, 1]
`;

export default function Home() {
  // code — the current content of the Monaco editor.
  // Lifted up to page.tsx so both VoiceSession (needs it to send to agent)
  // and CodeEditor (needs it to display and edit) can share the same value.
  const [code, setCode] = useState<string>(DEFAULT_CODE);

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col p-6 gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DSA Voice Tutor</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Problem: <span className="text-indigo-400 font-medium">Two Sum</span>
          </p>
        </div>
        <p className="text-zinc-600 text-xs text-right max-w-xs">
          Start a session, explain your approach, then write and run your code.
        </p>
      </div>

      {/* Two-column layout: voice on left, editor on right */}
      {/* grid-cols-[300px_1fr] — left column is fixed 300px, right takes remaining space */}
      <div className="grid grid-cols-[300px_1fr] gap-6 flex-1">

        {/* Left: voice session panel */}
        {/* code is passed so VoiceSession can send it to the agent when the Analyze button is clicked */}
        <VoiceSession code={code} />

        {/* Right: code editor panel */}
        {/* onCodeChange updates the shared code state in this parent component */}
        <CodeEditor code={code} onCodeChange={setCode} />

      </div>
    </main>
  );
}
