// route.ts — a Next.js API route that generates a signed LiveKit room token.
//
// How Next.js API routes work (App Router):
//   Any file named route.ts inside app/api/... becomes a backend endpoint.
//   The exported function name determines the HTTP method.
//   This file handles POST /api/token.
//
// Why POST and not GET?
//   GET requests can be cached, logged, or bookmarked by browsers/proxies.
//   Token generation is a side-effect (creates a credential), so POST is correct.

import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function POST() {
  // process.env holds all environment variables loaded from .env.local.
  //
  // CRITICAL SECURITY RULE:
  //   Variable names WITHOUT the "NEXT_PUBLIC_" prefix are server-only.
  //   They are never sent to the browser. Your LIVEKIT_API_SECRET stays
  //   safe here. If you accidentally used these in a client component,
  //   Next.js would expose them to anyone who opens DevTools.
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  // Always validate env vars on startup. A missing key should fail loudly
  // with a clear error, not silently produce a broken token.
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit credentials not configured" },
      { status: 500 }
    );
  }

  // In Phase 1 we have no auth, so we generate a random anonymous identity.
  // .toString(36) converts a number to base-36 (digits + letters) for short strings.
  // .slice(2, 8) cuts the "0." prefix and takes 6 characters → e.g. "student-x4f9ab"
  // In Phase 3 (auth), this becomes the real user's ID from their session.
  const identity = `student-${Math.random().toString(36).slice(2, 8)}`;

  // All Phase 1 sessions share one room. In Phase 3 we'll create per-user rooms.
  const roomName = "dsa-tutor-room";

  // AccessToken is LiveKit's token builder from livekit-server-sdk.
  // It creates a JWT (JSON Web Token) signed with your apiSecret.
  //
  // What a JWT is: a compact, signed string that encodes claims (permissions).
  // LiveKit's server verifies the signature using your apiKey/apiSecret pair.
  // If the signature is valid → the token is trusted. If tampered → rejected.
  //
  // ttl: "1h" — token expires in 1 hour. Limits damage if a token is ever leaked.
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: "1h",
  });

  // addGrant() sets permissions baked into the token.
  // These are checked by LiveKit's server every time the client does something.
  //   roomJoin: true    → allowed to enter the room
  //   canPublish: true  → allowed to send audio (the student's mic)
  //   canSubscribe: true → allowed to receive audio (hearing the AI tutor)
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  // token.toJwt() serializes the token into the final JWT string.
  // This long encoded string is what the browser's LiveKit SDK needs to connect.
  // It's async because the signing operation uses the Web Crypto API internally.
  //
  // NextResponse.json() returns a proper JSON HTTP response with the correct
  // Content-Type header — the browser's fetch() will parse this automatically.
  return NextResponse.json({
    token: await token.toJwt(),
    wsUrl,
    roomName,
    identity,
  });
}
