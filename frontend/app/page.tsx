import VoiceSession from "@/components/VoiceSession";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">DSA Voice Tutor</h1>
        <p className="text-zinc-400 text-sm">
          Problem: <span className="text-indigo-400 font-medium">Two Sum</span>
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6">
        <VoiceSession />
      </div>

      <p className="text-zinc-600 text-xs text-center max-w-xs">
        Click Start Session, allow microphone access, and talk to your tutor.
      </p>
    </main>
  );
}
