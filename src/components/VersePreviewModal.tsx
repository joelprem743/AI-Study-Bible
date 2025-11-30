import React from "react";
import { createPortal } from "react-dom";

interface VersePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: string;
  text: string;
}

export function VersePreviewModal({
  isOpen,
  onClose,
  reference,
  text
}: VersePreviewModalProps) {
  if (!isOpen) return null;

  const root = document.getElementById("modal-root");
  if (!root) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">{reference}</h2>
        <p className="text-sm whitespace-pre-wrap">{text}</p>

        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>,
    root
  );
}
