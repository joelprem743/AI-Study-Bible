import React from "react";
import { createPortal } from "react-dom";

interface VersePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: string;
  text: string;
  backgroundUrl?: string;
}

export function VersePreviewModal({
  isOpen,
  onClose,
  reference,
  text,
  backgroundUrl
}: VersePreviewModalProps) {
  if (!isOpen) return null;

  const root = document.getElementById("modal-root");
  if (!root) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-4 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 🔥 IMAGE PREVIEW (fixed aspect ratio) */}
        <div className="relative w-full aspect-[4/5] rounded-lg overflow-hidden mb-4">

          {/* Background */}
          {backgroundUrl ? (
            <div
              className="absolute inset-0 bg-center bg-cover"
              style={{ backgroundImage: `url(${backgroundUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black" />
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Text content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center text-white">
            <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">
              {text}
            </p>

            <p className="mt-4 text-xs opacity-80 tracking-wide">
              {reference}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:underline"
          >
            ← Back
          </button>

          <div className="flex gap-2">
            <button className="px-4 py-2 border rounded-md text-sm">
              Copy
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">
              Share
            </button>
          </div>
        </div>
      </div>
    </div>,
    root
  );
}