//src/VerseImageShare.tsx
import React, { useEffect, useState } from "react";
import { generateVerseImage } from "../utils/verseImage";
import { VerseReference } from "..";

type Props = {
  verseRef: VerseReference;
  verseText: string;
  language: "EN" | "TE";

  meaning?: string;
  verseUrl?: string;

  backgroundUrl?: string | null;
  gradient?: { from: string; to: string } | null;
  churchName?: string;

  rangeEnd?: number;   // 🔥 ADD THIS

  onClose: () => void;
  onBack: () => void;
};



  const GRADIENTS = [
    { id: "mist", from: "#f8fafc", to: "#e2e8f0" },
    { id: "sky", from: "#e0f2fe", to: "#bae6fd" },
    { id: "meadow", from: "#ecfdf5", to: "#bbf7d0" },
    { id: "sand", from: "#fffbeb", to: "#fde68a" },
    { id: "lavender", from: "#f5f3ff", to: "#ddd6fe" },
    { id: "stone", from: "#f1f5f9", to: "#cbd5e1" },
  ];
  
  
  export default function VerseImageShare({
    verseRef,
    verseText,
    meaning,
    language,
    verseUrl,
    backgroundUrl,
    gradient: initialGradient,
    churchName,
    rangeEnd,   // 🔥 ADD
    onClose,
    onBack,
  }: Props) {  
  const [activeGradient, setActiveGradient] = useState(
    initialGradient ?? GRADIENTS[0]
  );
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reference = rangeEnd
  ? `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}-${rangeEnd}`
  : `${verseRef.book} ${verseRef.chapter}:${verseRef.verse}`;


  
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  


  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
  
    const run = async () => {
      try {
        setLoading(true);
        setPreviewUrl(null);
  
        const blob = await generateVerseImage(
          verseRef,
          verseText,
          language,
          backgroundUrl ?? null,
          activeGradient ?? null,
          churchName,
          rangeEnd
        );
  
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
  
    run();
  
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [verseRef, verseText, language, backgroundUrl, activeGradient, churchName, rangeEnd]);
  



  const resolvedVerseUrl =
  verseUrl ??
  `${window.location.origin}/#/${verseRef.book}/${verseRef.chapter}/${verseRef.verse}`;

const handleCopyToClipboard = async () => {
  const textToCopy = `
  ${reference}
  
  ${verseText}
  
  📖 Bible Companion — read with context
  
  ${resolvedVerseUrl}
  `.trim();
  


  try {
    await navigator.clipboard.writeText(textToCopy);

    setToast({
      message:
        language === "TE"
          ? "వాక్యం కాపీ అయ్యింది"
          : "Verse copied",
      type: "success",
    });
  } catch {
    setToast({
      message:
        language === "TE"
          ? "కాపీ చేయలేకపోయింది"
          : "Copy failed",
      type: "error",
    });
  }

  setTimeout(() => setToast(null), 2500);
};

  

  
  const handleShare = async () => {
    if (!previewUrl) return;
  
    const blob = await fetch(previewUrl).then(r => r.blob());
    const file = new File([blob], "daily-verse.png", {
      type: "image/png",
    });
  
    if ((navigator as any).canShare?.({ files: [file] })) {
      try {
        await (navigator as any).share({
          files: [file],
          text: `${reference}\n\n${verseText}\n\n${resolvedVerseUrl}`,
        });
        
        onClose();
        return;
      } catch {}
    }
  
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = "daily-verse.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-11/12 max-w-md p-4">
  
{/* Header */}
<div
  className="
    -mx-4 -mt-4 mb-4
    px-5 py-4
    rounded-t-2xl
    bg-gradient-to-b from-slate-900 to-slate-800
    text-white
    flex items-center justify-between
  "
>
  <div>
    <h3 className="text-sm font-semibold tracking-wide">
      {language === "TE"
        ? "వాక్యాన్ని షేర్ చేయండి"
        : "Share verse"}
    </h3>
    <p className="text-xs text-slate-300 mt-0.5">
      {language === "TE"
        ? "చిత్రం లేదా వచనం కాపీ చేయండి"
        : "Copy text or share image"}
    </p>
  </div>

  <button
    onClick={onClose}
    className="
      w-9 h-9 rounded-full
      bg-white/10 hover:bg-white/20
      flex items-center justify-center
      transition
    "
    aria-label="Close"
  >
    ✕
  </button>
</div>

  
        {/* Preview */}
        <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
          {loading ? (
            <span className="text-xs text-slate-500">Generating…</span>
          ) : previewUrl ? (
            <img src={previewUrl} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-red-500">Failed</span>
          )}
        </div>
{/* Action Row */}
<div className="flex items-center justify-between gap-3 mt-4">
  
  {/* Back */}
  <button
    onClick={onBack}
    className="text-sm text-slate-500 hover:underline"
  >
    ← {language === "TE" ? "వెనక్కి" : "Back"}
  </button>

  <div className="flex gap-2 ml-auto">
    
    {/* Copy */}
    <button
      disabled={!previewUrl}
      onClick={handleCopyToClipboard}
      className="
        px-4 py-2 rounded-lg
        border border-slate-300 dark:border-slate-700
        text-sm font-semibold
        hover:bg-slate-100 dark:hover:bg-slate-800
        disabled:opacity-50
      "
    >
      {language === "TE" ? "కాపీ" : "Copy"}
    </button>

    {/* Share */}
    <button
      disabled={!previewUrl}
      onClick={handleShare}
      className="
        px-5 py-2 rounded-lg
        bg-blue-600 text-white
        text-sm font-semibold
        hover:bg-blue-700
        disabled:opacity-50
      "
    >
      {language === "TE" ? "షేర్" : "Share"}
    </button>

  </div>
</div>

      </div>
      {toast && (
  <div
    className={`
      fixed bottom-6 left-1/2 -translate-x-1/2
      px-4 py-2 rounded-xl shadow-lg
      text-sm font-semibold
      transition
      ${
        toast.type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }
    `}
  >
    {toast.message}
  </div>
)}

    </div>
  );
}  