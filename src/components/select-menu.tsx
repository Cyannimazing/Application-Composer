"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };
export default function SelectMenu({ value, options, onChange, label, placeholder = "Choose an option", disabled = false, id }: { value: string; options: Option[]; onChange: (value: string) => void; label: string; placeholder?: string; disabled?: boolean; id?: string }) {
  const uid = useId(), listId = uid + "-list";
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const chosen = options.find(option => option.value === value);
  const choose = (option: Option) => { onChange(option.value); setOpen(false); trigger.current?.focus(); };
  useEffect(() => { if (!open) return; const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (open) document.getElementById(listId + "-" + active)?.scrollIntoView({ block: "nearest" }); }, [active, listId, open]);
  return <div className="select-menu" ref={root}><button ref={trigger} id={id} data-value={value} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-activedescendant={open ? listId + "-" + active : undefined} disabled={disabled} className={`select-trigger ${chosen ? "" : "is-placeholder"}`} onClick={() => { setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(!open); }} onKeyDown={event => {
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) event.preventDefault();
    if (event.key === "Escape" || event.key === "Tab") { setOpen(false); return; }
    if (event.key === "Enter" || event.key === " ") { if (open && options[active]) choose(options[active]); else setOpen(true); return; }
    if (event.key === "ArrowDown") { setOpen(true); setActive(index => open ? Math.min(options.length - 1, index + 1) : Math.max(0, options.findIndex(option => option.value === value))); }
    else if (event.key === "ArrowUp") { setOpen(true); setActive(index => open ? Math.max(0, index - 1) : Math.max(0, options.findIndex(option => option.value === value))); }
    else if (event.key === "Home") { setOpen(true); setActive(0); }
    else if (event.key === "End") { setOpen(true); setActive(options.length - 1); }
    else if (event.key.length === 1 && /\S/.test(event.key)) { const found = options.findIndex(option => option.label.toLowerCase().startsWith(event.key.toLowerCase())); if (found >= 0) { setOpen(true); setActive(found); } }
  }}><span>{chosen?.label || placeholder}</span><ChevronDown size={15} className={open ? "chevron-open" : ""} /></button>{open && <div className="select-options" role="listbox" aria-label={label + " options"} id={listId}>{options.map((option, index) => <div key={option.value} id={listId + "-" + index} role="option" aria-selected={option.value === value} className={`select-option ${active === index ? "is-active" : ""}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}><span>{option.label}</span>{option.value === value && <Check size={14} />}</div>)}</div>}</div>;
}
