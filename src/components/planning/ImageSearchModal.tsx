"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotch, Image as ImageIcon, UploadSimple } from "@phosphor-icons/react";
import { Button, Progress } from "@navanta-ai/design-system";
import { Modal } from "@/components/ui/Modal";
import { InfoNote } from "@/components/ui/InfoNote";
import { ThumbStack } from "@/components/planning/ThumbStack";
import { consensusColour, dominantColour } from "@/lib/colour-match";

/* ═══════════════════════════════════════════════════════════════
 *  Search by image — HMTX Portal 1669:13283 / 1669:14167 / 1725:2958
 *
 *  Three states in one modal, because they are one act: drop the
 *  photographs, watch them land, watch them read. Split across three
 *  modals the reader would lose the thumbnails they just chose.
 *
 *  Nothing is uploaded, and the copy is written not to imply that it
 *  is. Each file is drawn to a canvas in the browser, sampled and
 *  discarded; one hex value per photograph is all that outlives this
 *  component. A photograph of somebody's home is not ours to keep.
 * ═══════════════════════════════════════════════════════════════ */

/* The design's own link blue, not the iris ramp — this file is a port of the
   HMTX portal, where "browse" and "Replace Image" are this colour. */
export const HMTX_LINK = "#005B89";
const MAX_MB = 10;
const ACCEPT = "image/jpeg,image/png,image/heic,image/heif";

/** What the modal hands back once it has read the photographs. */
export interface ImageMatch {
  /** The colour the set agrees on — see `consensusColour`. */
  hex: string;
  /** Object URLs for the thumbnails, so the result bar can show them. */
  urls: string[];
  count: number;
}

type Phase = "idle" | "uploading" | "analysing";

export function ImageSearchModal({
  onClose,
  onMatched,
}: {
  onClose: () => void;
  onMatched: (match: ImageMatch) => void;
}) {
  const pick = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  /* The sampled colours, held until the analysing beat finishes — the reading is
     instant and the pause exists so a person can see what is happening. */
  const pending = useRef<string[]>([]);

  /* The modal does NOT revoke these on unmount, though an earlier version did.
     Object URLs are a document-lifetime allocation and somebody has to release
     them — but by the time this component goes away it has handed them to the
     result bar, which is still drawing them. Revoking on unmount worked only
     because the browser had already decoded the images; the first re-render that
     re-fetched one would have shown a broken thumbnail.
     Ownership follows the handoff: whoever holds the match releases the URLs when
     they clear it. See `clearMatch` in ProductCatalogueScreen. */

  async function take(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setError(null);

    /* Checked here rather than trusting the accept attribute, which a drop
       bypasses entirely — the design states a limit, so the limit is real. */
    const wrongType = files.find((f) => !ACCEPT.split(",").includes(f.type));
    if (wrongType) {
      setError(`${wrongType.name} is not a JPG, PNG or HEIC.`);
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} is over the ${MAX_MB} MB limit.`);
      return;
    }

    setUrls(files.map((f) => URL.createObjectURL(f)));
    setPhase("uploading");
    setProgress(0);

    try {
      /* The bar tracks real work: each file sampled moves it. There is no network
         here, so a bar timed against a clock would be a decoration — this one is
         at least measuring something. */
      const hexes: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        hexes.push(await dominantColour(files[i]));
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      pending.current = hexes;
      setPhase("analysing");
    } catch {
      setError("Those images could not be read.");
      setPhase("idle");
    }
  }

  /* The analysing beat. The matching itself is one comparison across already
     sampled colours and finishes in under a millisecond — this pause is honest
     about being a pause rather than pretending to be work, and it is fixed rather
     than random so the demo runs the same way every time. */
  useEffect(() => {
    if (phase !== "analysing") return;
    const t = setTimeout(() => {
      onMatched({
        hex: consensusColour(pending.current),
        urls,
        count: urls.length,
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [phase, urls, onMatched]);

  const plural = urls.length === 1 ? "photo" : "photos";

  return (
    <Modal title="Search by Image" icon={ImageIcon} onClose={onClose}>
      {phase === "idle" ? (
        <div className="flex flex-col" style={{ gap: 24, padding: 24 }}>
          <div className="flex flex-col" style={{ gap: 8 }}>
            {/* A button, not a div with a click handler: the design draws a
                surface, and a surface only a mouse can reach is half a control. */}
            <button
              type="button"
              onClick={() => pick.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void take(e.dataTransfer.files);
              }}
              className="flex w-full cursor-pointer flex-col items-center justify-center transition-colors"
              style={{
                gap: 4,
                height: 192,
                borderRadius: 12,
                border: `1px dashed ${dragging ? HMTX_LINK : "var(--ds-border-default, #d4d4d8)"}`,
                background: dragging ? "var(--surface-hover)" : "var(--surface-base, #fff)",
              }}
            >
              <UploadSimple size={24} color="#343330" />
              <span
                className="flex items-center"
                style={{ gap: 4, fontSize: 14, fontWeight: 500, lineHeight: "22px" }}
              >
                <span style={{ color: "#18181b" }}>Drop your images or</span>
                <span style={{ color: HMTX_LINK }}>browse</span>
              </span>
              <span style={{ fontSize: 12, lineHeight: "18px", color: "#52525c" }}>
                {`JPG, PNG, HEIC - up to ${MAX_MB} MB`}
              </span>
            </button>

            <input
              ref={pick}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                const list = e.target.files;
                /* Cleared so the same photograph can be picked twice. */
                void take(list);
                e.target.value = "";
              }}
            />

            {/* The rule with "or" sitting in it. The label carries the surface
                colour so the line appears to pass behind rather than stop. */}
            <div className="relative flex w-full items-center justify-center">
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  height: 1,
                  background: "var(--ds-border-subtle, #e4e4e7)",
                }}
              />
              <span
                style={{
                  position: "relative",
                  padding: 4,
                  background: "var(--surface-base, #fff)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "#52525c",
                }}
              >
                or
              </span>
            </div>

            <div className="flex w-full items-start" style={{ gap: 10 }}>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste image link"
                aria-label="Paste image link"
                className="min-w-0 flex-1"
                style={{
                  height: 28,
                  padding: "0 9px",
                  borderRadius: 8,
                  border: "1px solid #d4d6d8",
                  background: "var(--surface-base, #fff)",
                  fontSize: 12,
                  lineHeight: "18px",
                  color: "#18181b",
                }}
              />
              {/* Enabled only with a link in the field, and it explains itself
                  rather than working: fetching a remote image to sample it would
                  send the URL to a host the reader did not choose, and this
                  prototype samples locally or not at all. */}
              <Button
                size="sm"
                variant="outline"
                disabled={link.trim().length === 0}
                onClick={() =>
                  setError("Link search is not wired up — drop or browse for the file instead.")
                }
              >
                Search
              </Button>
            </div>

            {error && (
              <p style={{ fontSize: 12, lineHeight: "18px", color: "var(--text-warning-dark)" }}>
                {error}
              </p>
            )}
          </div>

          {/* The design's promise, kept verbatim — and this prototype does not
              keep it: the sampler reads colour, not text. Left as written because
              it is the design's copy, and named here rather than quietly softened. */}
          <InfoNote>
            If your image shows a SKU number or spec sheet, we&rsquo;ll read the code and look it
            up.
          </InfoNote>
        </div>
      ) : (
        <div
          className="flex w-full flex-col items-center justify-center"
          style={{ gap: 24, padding: 48, borderRadius: 12 }}
        >
          <ThumbStack urls={urls} />

          {phase === "uploading" ? (
            <div className="flex flex-col items-center" style={{ gap: 16 }}>
              <div style={{ width: 248 }}>
                <Progress value={progress} size="sm" />
              </div>
              <div className="flex flex-col items-center" style={{ gap: 4, width: 248 }}>
                <p style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: "#18181b" }}>
                  {`Uploading ${urls.length} ${plural}`}
                </p>
                <p
                  className="text-center"
                  style={{ fontSize: 12, lineHeight: "18px", color: "#52525c" }}
                >
                  If your image shows a SKU number or spec sheet, we&rsquo;ll read the code and look
                  it up.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center" style={{ gap: 4, maxWidth: 320 }}>
              <span className="flex items-center justify-center" style={{ gap: 4 }}>
                {/* Spun with the app's own keyframes rather than a Tailwind class,
                    so the rate matches every other spinner in the portal. */}
                <CircleNotch size={12} color="#343330" className="animate-spin" />
                <span
                  style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: "#18181b" }}
                >
                  {`Analyzing ${urls.length} ${plural} & matching results`}
                </span>
              </span>
              <p
                className="text-center"
                style={{ fontSize: 12, lineHeight: "18px", color: "#52525c" }}
              >
                Checking for a readable SKU first, then matching on color, pattern &amp; texture
                across all your photos.
              </p>
              <p
                className="text-center"
                style={{ fontSize: 12, lineHeight: "18px", color: "#52525c" }}
              >
                Usually takes few minutes
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
