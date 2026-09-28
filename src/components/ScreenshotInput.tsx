"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

/**
 * File input for chart screenshots. Also accepts images pasted anywhere on the page
 * (e.g. TradingView's "Copy chart image") and drag-and-drop.
 */
export default function ScreenshotInput({
  existing = [],
}: {
  existing?: { id: number; filename: string }[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [dragging, setDragging] = useState(false);

  // Keep the real <input type=file> in sync so the files submit with the form.
  useEffect(() => {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    inputRef.current.files = dt.files;
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const add = (list: FileList | File[] | null) => {
    const images = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (images.length) setFiles((prev) => [...prev, ...images]);
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (items.length) {
        e.preventDefault();
        setFiles((prev) => [
          ...prev,
          ...items.map((f, i) => new File([f], f.name && f.name !== "image.png" ? f.name : `pasted-${Date.now()}-${i}.png`, { type: f.type })),
        ]);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div>
      <input ref={inputRef} type="file" name="screenshots" multiple accept="image/*" className="hidden" />
      {[...removed].map((id) => (
        <input key={id} type="hidden" name="remove_screenshot" value={id} />
      ))}
      <div
        onClick={() => {
          const picker = document.createElement("input");
          picker.type = "file";
          picker.accept = "image/*";
          picker.multiple = true;
          picker.onchange = () => add(picker.files);
          picker.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center text-sm transition ${
          dragging ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:border-muted/60 hover:text-ink-2"
        }`}
      >
        <ImagePlus className="size-5" />
        <span>Click, drop, or paste (Ctrl/⌘+V) chart screenshots</span>
      </div>

      {(existing.length > 0 || files.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {existing.map((s) => (
            <Thumb
              key={`e${s.id}`}
              src={`/api/uploads/${s.filename}`}
              dimmed={removed.has(s.id)}
              onRemove={() =>
                setRemoved((prev) => {
                  const n = new Set(prev);
                  if (n.has(s.id)) n.delete(s.id);
                  else n.add(s.id);
                  return n;
                })
              }
            />
          ))}
          {previews.map((src, i) => (
            <Thumb key={src} src={src} onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ src, onRemove, dimmed }: { src: string; onRemove: () => void; dimmed?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-line bg-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`aspect-video w-full object-cover ${dimmed ? "opacity-25" : ""}`} />
      <button
        type="button"
        onClick={onRemove}
        title={dimmed ? "Keep" : "Remove"}
        className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/70 text-white opacity-80 hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
