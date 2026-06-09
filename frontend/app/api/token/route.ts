import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

// POST /api/token
// Returns a signed LiveKit token so the browser can join the tutoring room.
export async function POST() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit credentials not configured" },
      { status: 500 }
    );
  }

  // Each user gets a unique identity for this session.
  // In Phase 1 we generate a random one — no auth needed.
  const identity = `student-${Math.random().toString(36).slice(2, 8)}`;
  const roomName = "dsa-tutor-room";

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: "1h", // token expires in 1 hour
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,      // student can send audio
    canSubscribe: true,    // student can hear the AI
  });

  return NextResponse.json({
    token: await token.toJwt(),
    wsUrl,
    roomName,
    identity,
  });
}
