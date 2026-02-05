import ModalPortal from "./ModalPortal";

const ShareLinkSheet = ({
    open,
    text,
    onClose,
    onShareImage,
  }: {
    open: boolean;
    text: string;
    onClose: () => void;
    onShareImage: () => Promise<void>;
  })   => {
  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/40 z-[9999] flex items-end"
        onClick={onClose}
      >
        <div
          className="
            w-full
            bg-white dark:bg-slate-900
            rounded-t-2xl
            p-4
            shadow-2xl
          "
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-semibold mb-2">
            Add link if needed
          </h3>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Some apps don’t show links with images.  
            Paste this below the image if it’s missing.
          </p>

          <textarea
            readOnly
            value={text}
            className="
              w-full
              text-sm
              p-3
              rounded-xl
              border border-slate-200 dark:border-white/10
              bg-slate-50 dark:bg-slate-800
              resize-none
              h-32
            "
          />

<button
  onClick={() => {
    navigator.clipboard.writeText(text);
  }}
  className="mt-4 w-full py-2 rounded-xl bg-blue-600 text-white font-medium"
>
  📋 Copy caption & link
</button>

<button
  onClick={async () => {
    await onShareImage();
  }}
  className="mt-3 w-full py-2 rounded-xl
             bg-slate-100 dark:bg-slate-800
             text-slate-800 dark:text-slate-200
             font-medium"
>
  📤 Share image
</button>

        </div>
      </div>
    </ModalPortal>
  );
};

export default ShareLinkSheet;
