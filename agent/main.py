# main.py — the entry point for the LiveKit Agent (the Python backend).
# This file does three things:
#   1. Defines the TutorAgent class (our AI tutor's behavior)
#   2. Defines entrypoint() — called by LiveKit when a user joins a session
#   3. Starts the LiveKit worker process at the bottom

import logging
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.agents.voice import ConversationItemAddedEvent
from livekit.plugins import deepgram, groq, silero

from tutor import GREETING, TUTOR_INSTRUCTIONS

# A dedicated logger for the conversation transcript.
# Using a named logger ("tutor.conversation") instead of the root logger lets us
# distinguish these messages from LiveKit's internal DEBUG/INFO noise in the terminal.
conversation_log = logging.getLogger("tutor.conversation")

# load_dotenv() reads agent/.env and loads every key into environment variables.
# The Groq/Deepgram/LiveKit plugins look for their keys in os.environ automatically.
# This MUST run before any plugin is initialized — that's why it's at the top.
load_dotenv()

# Tells Python to print log messages (INFO level and above) to the terminal.
# When you run the agent, you'll see lines like "INFO: agent connected to room".
# Without this, the terminal is completely silent and debugging is impossible.
logging.basicConfig(level=logging.INFO)


# TutorAgent subclasses LiveKit's Agent base class.
# We subclass (instead of using Agent directly) because we need to override
# on_enter — the greeting behavior. A plain Agent() has no greeting.
class TutorAgent(Agent):
    def __init__(self) -> None:
        # super().__init__() calls the parent Agent constructor.
        # Passing instructions= registers the system prompt with LiveKit's
        # framework. It gets sent to the LLM at the start of every conversation.
        super().__init__(instructions=TUTOR_INSTRUCTIONS)

    # on_enter is a lifecycle hook — LiveKit calls it automatically when the
    # agent joins the room and the session is ready. Think of it as "on startup".
    #
    # async def — this function is asynchronous. "async" means it can pause
    # while waiting (e.g., for TTS to generate audio) without freezing everything.
    # LiveKit's entire framework is async Python.
    async def on_enter(self) -> None:
        # await pauses this function until say() finishes generating and
        # playing the audio. Without await, Python would start the greeting
        # but immediately move on, causing a race condition.
        #
        # self.session — once the Agent is running inside an AgentSession,
        # it gets a reference to it via self.session. This lets the agent
        # trigger actions like say().
        #
        # session.say() converts GREETING text → Deepgram TTS audio →
        # plays it into the LiveKit room. The student hears these words first.
        await self.session.say(GREETING)


# entrypoint is the function LiveKit calls when a new session is assigned
# to this worker. Think of it as: "a user just joined — set up the agent."
#
# JobContext — an object LiveKit passes in containing the room, user info,
# and methods to connect. It represents this specific session.
async def entrypoint(ctx: JobContext) -> None:
    # ctx.connect() makes this Python process actually join the LiveKit room
    # as a participant. Before this line, we know about the room but aren't in it.
    # After this line, we're joined and can send/receive audio.
    await ctx.connect()

    # AgentSession is the voice pipeline manager. It wires together all the
    # AI components into a single real-time loop:
    #   student speaks → VAD detects speech → STT transcribes → LLM responds → TTS speaks back
    #
    # stt=groq.STT()
    #   Speech-to-Text: converts the student's mic audio → text (uses Groq's Whisper).
    #
    # vad=silero.VAD.load()
    #   Voice Activity Detection: detects when the student starts/stops talking
    #   so STT only runs on real speech, not silence or background noise.
    #   Uses .load() (not just VAD()) because it loads an ONNX ML model from disk.
    #
    # llm=groq.LLM(model="llama-3.3-70b-versatile")
    #   The brain. Takes transcribed text → generates the tutor's text response.
    #   "llama-3.3-70b-versatile" = Meta's Llama 3.3, 70 billion parameters.
    #   70b matters — bigger model = better reasoning = better tutoring.
    #
    # tts=deepgram.TTS()
    #   Text-to-Speech: converts the LLM's text response → audio the student hears.
    session = AgentSession(
        stt=groq.STT(),
        vad=silero.VAD.load(),
        llm=groq.LLM(model="llama-3.3-70b-versatile"),
        tts=deepgram.TTS(),
    )

    # data_received fires when the browser sends a raw data packet to the room.
    # We use this for the "Analyze my code" button — the frontend publishes the
    # code as bytes with topic="code_snapshot". The agent picks it up here,
    # logs it, and calls generate_reply() to trigger a voice review response.
    #
    # Why a data channel instead of a chat message?
    #   Data channels are low-level, reliable, and topic-labelled — perfect for
    #   structured payloads like code. Chat messages are plain text and go through
    #   a different pipeline that might interfere with the voice turn detection.
    #
    # ctx.room — the LiveKit Room object. .on() registers an event listener.
    # rtc.DataPacket — the received packet with:
    #   .data    → the raw bytes (we decode to get the code string)
    #   .topic   → the label we set in the browser ("code_snapshot")
    @ctx.room.on("data_received")
    def on_data_received(data_packet: rtc.DataPacket) -> None:
        # Ignore any data packets not tagged as code snapshots.
        # This future-proofs the handler — we can add other topics later.
        if data_packet.topic != "code_snapshot":
            return

        code = data_packet.data.decode("utf-8")
        conversation_log.info("CODE SNAPSHOT received:\n%s", code)

        # generate_reply() is synchronous (not async) — it schedules the reply
        # and returns immediately. LiveKit handles the actual LLM call + TTS async.
        #
        # user_input — injected as a user turn so the LLM sees it in history.
        # instructions — extra guidance ONLY for this one reply, doesn't change
        #               the system prompt. We use it to steer the tutor toward
        #               a code review response rather than a general reply.
        session.generate_reply(
            user_input=f"Here is my current code:\n```python\n{code}\n```",
            instructions=(
                "Review the student's code. Identify what is correct, what is missing or wrong, "
                "and ask one guiding question to move them forward. Do not give the full solution."
            ),
        )

    # conversation_item_added fires every time a message is finalized and added
    # to the conversation history — both user turns (after STT) and agent turns
    # (after the LLM finishes generating). We use it to print both sides of the
    # conversation so you can see the full exchange in the terminal.
    #
    # @session.on("event_name") is a decorator that registers an event listener.
    # It's the same pattern as addEventListener in JavaScript.
    # The function runs synchronously each time the event fires.
    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent) -> None:
        # event.item is a ChatMessage with .role ("user" or "assistant") and
        # .text_content (the full text of the message as a string).
        # We skip system messages — those are the instructions, not conversation.
        item = event.item
        if not hasattr(item, "role") or not hasattr(item, "text_content"):
            return
        if item.role == "user":
            conversation_log.info("STUDENT : %s", item.text_content)
        elif item.role == "assistant":
            conversation_log.info("TUTOR   : %s", item.text_content)

    # session.start() kicks off the full pipeline.
    # TutorAgent() — a fresh instance per session means each student gets
    # clean, isolated state (no bleed between sessions).
    # room=ctx.room — tells AgentSession which LiveKit room to listen/speak into.
    await session.start(TutorAgent(), room=ctx.room)


# if __name__ == "__main__" — standard Python pattern.
# This block only runs when you execute this file directly (python main.py).
# It does NOT run if another file imports from this one. Prevents the agent
# from accidentally starting when imported.
#
# WorkerOptions(entrypoint_fnc=entrypoint) — registers our entrypoint function
# with LiveKit's worker system. Tells LiveKit: "when a session comes in, call this."
#
# cli.run_app() — starts the LiveKit worker process. It connects to LiveKit's
# dispatch server and waits for session assignments. The "dev" in
# "python main.py dev" is a CLI flag for development mode (auto-reload on save).
if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
