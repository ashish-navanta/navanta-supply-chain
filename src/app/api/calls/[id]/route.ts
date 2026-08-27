import { NextResponse } from "next/server";
import { callingConfig, readCall, readCallAudio } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

/**
 * Where the call has got to — and, with `?audio=1`, the recording itself.
 *
 * Both go through this app rather than the browser reaching ElevenLabs
 * directly, for the same reason: the key stays on the server. The audio is
 * streamed rather than buffered, so a long call does not have to be held in
 * memory here before it can start playing there.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const config = callingConfig();
  if (!config.ok) {
    return NextResponse.json({ error: "Live calling is not configured." }, { status: 501 });
  }

  const { id } = await ctx.params;
  const wantsAudio = new URL(request.url).searchParams.get("audio") === "1";

  try {
    if (wantsAudio) {
      /* Range passed through, so the browser can seek rather than refetch the
         whole recording every time somebody clicks a transcript turn. */
      const upstream = await readCallAudio(config, id, request.headers.get("Range"));
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: "No recording for this call." }, { status: 404 });
      }
      /* Length and range mirrored back.
         Without a Content-Length this route answers with chunked encoding, and
         a chunked audio response makes `HTMLAudioElement.duration` read
         Infinity — which the card rendered as a clock saying "Infinity:NaN"
         over a recording it otherwise had in full. */
      const headers = new Headers({
        "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg",
        "Cache-Control": "no-store",
        "Accept-Ranges": upstream.headers.get("Accept-Ranges") ?? "bytes",
      });
      for (const h of ["Content-Length", "Content-Range"]) {
        const v = upstream.headers.get(h);
        if (v) headers.set(h, v);
      }
      return new NextResponse(upstream.body, { status: upstream.status, headers });
    }

    return NextResponse.json(await readCall(config, id));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the call." },
      { status: 502 },
    );
  }
}
