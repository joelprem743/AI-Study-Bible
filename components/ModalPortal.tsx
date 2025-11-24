import { createPortal } from "react-dom";

export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const root = document.getElementById("modal-root");
  return root ? createPortal(children, root) : null;
}
