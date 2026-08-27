"use client";

/* ═══════════════════════════════════════════════════════════════
 *  The uploaded photographs, overlapped
 *
 *  The same block appears in three of the four HMTX frames — the
 *  uploading state, the analysing state and the result bar above
 *  the table — so it is one component rather than three copies that
 *  drift on the second edit.
 *
 *  These are the reader's own photographs, drawn from object URLs
 *  made in the browser. Nothing is uploaded: `dominantColour` draws
 *  each file to a canvas, samples it and throws it away, and one hex
 *  value per photo is all that outlives the modal.
 * ═══════════════════════════════════════════════════════════════ */

export function ThumbStack({
  urls,
  size = 56,
  max = 3,
}: {
  urls: string[];
  size?: number;
  /** Tiles drawn at most. The last one carries the overflow count. */
  max?: number;
}) {
  const shown = urls.slice(0, max);
  const rest = urls.length - shown.length;
  const overlap = Math.round((size * 25) / 56);
  return (
    <span className="flex shrink-0 items-center">
      {shown.map((url, i) => {
        const last = i === shown.length - 1;
        return (
          <span
            key={url}
            className="relative shrink-0"
            style={{
              width: size,
              height: size,
              /* Overlapped by 25px at 56, the design's own figure — except on the
                 last tile, which would otherwise pull the stack 25px narrower
                 than it draws and shove the text beside it leftwards. */
              marginRight: last ? 0 : -overlap,
              borderRadius: 8,
              border: "1px solid #fff",
              boxShadow: "2px 0px 4px 0px rgba(0,0,0,0.25)",
              zIndex: i,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- an object URL
                from the reader's own file; next/image wants a loader and a remote
                host, and this never leaves the tab. */}
            <img
              alt=""
              src={url}
              className="absolute inset-0 size-full object-cover"
              style={{ borderRadius: 7 }}
            />
            {/* The count rides the last tile, which is the design's shape: three
                at most, however many were dropped. Under three there is no
                overflow and no scrim, so one upload draws one photograph. */}
            {last && rest > 0 && (
              <>
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "rgba(0,0,0,0.26)", borderRadius: 7 }}
                />
                <span
                  className="absolute inset-0 flex items-center justify-center font-medium"
                  style={{ fontSize: 14, lineHeight: "22px", color: "#fff" }}
                >
                  {`+${rest}`}
                </span>
              </>
            )}
          </span>
        );
      })}
    </span>
  );
}
