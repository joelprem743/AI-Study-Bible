  //src/VerseImageShare.tsx
  import React, { useEffect, useState } from "react";
  import { generateVerseImage } from "../utils/verseImage";
  import { VerseReference } from "..";
  import { buildVerseShareCaption, buildVerseShareUrl } from "../utils/share";
  import { TELUGU_BOOK_NAMES } from "../data/teluguBookNames";
  type ShareLayout = "portrait" | "square";

  type Props = {
    verseRef: VerseReference;
    verseText: string | string[];
    language: "EN" | "TE";
  
    meaning?: string;
    verseUrl?: string;
  
    layout: ShareLayout;
    setLayout: (layout: ShareLayout) => void;
  
    backgroundUrl?: string | null;
    gradient?: { from: string; to: string } | null;
    churchName?: string;
    rangeEnd?: number;
  
    onClose: () => void;
    onBack: () => void;
  };




    
    export default function VerseImageShare({
      verseRef,
      verseText,
      meaning,
      language,
      verseUrl,
      layout,
      setLayout,
      backgroundUrl,
      gradient: initialGradient,
      churchName,
      rangeEnd,   // 🔥 ADD
      onClose,
      onBack,
    }: Props) {  
      const [activeGradient] = useState(initialGradient ?? null);
    
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
            rangeEnd,
            layout,
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
    }, [
      verseRef,
      verseText,
      language,
      backgroundUrl,
      activeGradient,
      churchName,
      rangeEnd,
      layout   // ✅ ADD THIS
    ]);
    




    const resolvedVerseUrl =
    verseUrl ??
    buildVerseShareUrl(
      verseRef.book,
      verseRef.chapter,
      verseRef.verse
    );
  

  const handleCopyToClipboard = async () => {
    const displayBook =
    language === "TE"
      ? TELUGU_BOOK_NAMES[verseRef.book] || verseRef.book
      : verseRef.book;
  
  const caption = buildVerseShareCaption(
    displayBook,
    verseRef.chapter,
    verseRef.verse,
    Array.isArray(verseText) ? verseText.join(" ") : verseText,
    language
  );
  
    const textToCopy = `${caption}\n\n${resolvedVerseUrl}`;
  
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
      <>
        {/* Modal card */}
        <div
className="
bg-white dark:bg-slate-900
rounded-2xl
w-[95vw] max-w-md
max-h-[90vh]
flex flex-col
shadow-2xl
border border-slate-200 dark:border-white/10
relative
"
  onClick={(e) => e.stopPropagation()}
>
    
          {/* Header */}
          <div
  className={`
    px-5
    py-4
    rounded-t-2xl
    bg-gradient-to-b from-slate-900 to-slate-800
    text-white
    flex items-center justify-between
  `}
>

            <div>
              <h3 className="text-sm font-semibold tracking-wide">
                {language === "TE" ? "వాక్యాన్ని షేర్ చేయండి" : "Share verse"}
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
              "
            >
              ✕
            </button>
          </div>
    
{/* Layout Toggle */}
<div className="px-5 py-4 border-b border-slate-200 dark:border-white/10">

  <div className="relative bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 flex">

    {/* Sliding background */}
    <div
  className={`
    absolute top-1 bottom-1 left-1
    w-[calc(50%-4px)]
    rounded-xl
    bg-white dark:bg-slate-700
    shadow-md
    transition-transform duration-300 ease-in-out
    ${layout === "portrait" ? "translate-x-full" : "translate-x-0"}
  `}
/>

    {/* Square Button */}
    <button
      onClick={() => setLayout("square")}
      className={`
        relative z-10 flex-1
        py-2 text-sm font-semibold rounded-xl
        transition-colors duration-200
        ${
          layout === "square"
            ? "text-slate-900 dark:text-white"
            : "text-slate-500 dark:text-slate-400"
        }
      `}
    >
      Square (1:1)
    </button>
    {/* Portrait Button */}
    <button
      onClick={() => setLayout("portrait")}
      className={`
        relative z-10 flex-1
        py-2 text-sm font-semibold rounded-xl
        transition-colors duration-200
        ${
          layout === "portrait"
            ? "text-slate-900 dark:text-white"
            : "text-slate-500 dark:text-slate-400"
        }
      `}
    >
      Portrait (4:5)
    </button>


  </div>
</div>
          {/* Content wrapper (THIS FIXES ALL PADDING) */}
          <div className="p-4 pt-3 overflow-y-auto flex-1">
            {/* Preview */}
            <div className="p-4 flex justify-center">
            <div
  className={`
    w-full
    rounded-2xl
    overflow-hidden
    bg-slate-100
    flex items-center justify-center
    ${
      layout === "square"
        ? "aspect-square"
        : "aspect-[4/5]"
    }
  `}
>
  {loading ? (
    <span className="text-xs text-slate-500">Generating…</span>
  ) : previewUrl ? (
<img
  src={previewUrl}
  className="w-full h-full object-contain"
/>
  ) : (
    <span className="text-xs text-red-500">Failed</span>
  )}
</div>
</div>
    
    
            {/* Actions */}
            <div
  className={`
    flex items-center justify-between gap-3
    ${layout === "portrait" ? "mt-4" : "mt-3"}
  `}
>
    
              <button
                onClick={onBack}
                className="text-sm text-slate-500 hover:underline"
              >
                ← {language === "TE" ? "వెనక్కి" : "Back"}
              </button>
    
              <div className="flex gap-2 ml-auto">
    
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
    
        </div>
    
    
        {/* Toast */}
        {toast && (
          <div
            className="
              fixed bottom-6 left-1/2 -translate-x-1/2
              px-4 py-2 rounded-xl shadow-lg
              text-sm font-semibold
              bg-green-600 text-white
            "
          >
            {toast.message}
          </div>
        )}
    
      </>
    );
    
  }    