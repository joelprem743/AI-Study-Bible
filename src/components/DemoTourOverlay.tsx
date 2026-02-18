import React from "react";

export type DemoStep = {
  index: number;
  title: string;
  description: string;
};

type Props = {
  step: DemoStep;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  behindModal?: boolean;
};
const DemoTourOverlay: React.FC<Props> = ({
    step,
    totalSteps,
    onNext,
    onSkip,
    behindModal = false, // ← REQUIRED FIX
  }) => {  
  return (
<div
  className={`fixed
    bottom-0 md:bottom-6
    left-0 md:left-auto
    right-0 md:right-6
    w-full md:w-[380px]
    px-3 md:px-0
    animate-[slideUp_.3s_ease]
    ${behindModal ? "z-[8000]" : "z-[999999]"}
  `}
>

        <div className="pointer-events-auto">

      <div
        className="
          bg-white dark:bg-slate-900
          rounded-xl shadow-2xl
          border border-slate-200 dark:border-slate-700
          p-4
        "
      >
        {/* Step indicator */}
        <div className="text-xs text-gray-500 mb-1">
          Feature {step.index + 1} of {totalSteps}
        </div>

        {/* Title */}
        <div className="text-lg font-semibold mb-1 text-slate-800 dark:text-white">
          {step.title}
        </div>

        {/* Description */}
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {step.description}
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 mb-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i === step.index ? "bg-blue-600" : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex justify-between items-center">
        <button
  onClick={() => {
    window.dispatchEvent(new Event("demo-next-step"));
    onSkip();
  }}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Skip
          </button>

          <button
  onClick={() => {
    window.dispatchEvent(new Event("demo-next-step"));
    onNext();
  }}
            className="
              bg-blue-600 text-white
              px-4 py-1.5
              rounded-lg text-sm
              hover:bg-blue-700
            "
          >
            Next →
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default DemoTourOverlay;
