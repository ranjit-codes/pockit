import { type ReactNode, useEffect } from "react";

type Props = {
  title: string;
  onClose: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
};

export function Sheet({ title, onClose, leading, trailing, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass" role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <header className="sheet-header">
          <div className="sheet-side">{leading}</div>
          <h2>{title}</h2>
          <div className="sheet-side end">{trailing}</div>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
