import logging
from dotenv import load_dotenv

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, groq, silero

from tutor import GREETING, TUTOR_INSTRUCTIONS

load_dotenv()
logging.basicConfig(level=logging.INFO)


class TutorAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=TUTOR_INSTRUCTIONS)

    async def on_enter(self) -> None:
        await self.session.say(GREETING)


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    session = AgentSession(
        stt=groq.STT(),
        vad=silero.VAD.load(),
        llm=groq.LLM(model="llama-3.3-70b-versatile"),
        tts=deepgram.TTS(),
    )

    await session.start(TutorAgent(), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
