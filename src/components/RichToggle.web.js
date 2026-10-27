import { useEffect, useState } from "react";
import { TOGGLE_CSS } from "../lib/toggleCss";

export default function RichToggle({ title, children }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (document.querySelector("style[data-activecard-toggles]")) return;
    const style = document.createElement("style");
    style.dataset.activecardToggles = "";
    style.textContent = TOGGLE_CSS;
    document.head.appendChild(style);
  }, []);
  const toggle = (event) => { event.stopPropagation(); setOpen((value) => !value); };
  return (
    <div className={`ac-toggle${open ? " is-open" : ""}`}>
      <div className="ac-toggle-title" role="button" tabIndex={0} aria-expanded={open}
        data-study-action="toggle" onClick={toggle}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          if (!event.repeat) setOpen((value) => !value);
        }}>
        <span className="ac-toggle-arrow" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 4 4 4-4 4" /></svg>
        </span>
        {title}
      </div>
      {open && <div className="ac-toggle-content">{children}</div>}
    </div>
  );
}
