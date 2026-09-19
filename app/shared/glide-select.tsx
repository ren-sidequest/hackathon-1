import React, { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './glide-select.css';

// Adapted from the user-supplied React Bits GlideSelect interaction reference.
// Uses native popover positioning and existing React, without an icon dependency.
export type GlideOption = { value: string; label: string; tag?: string };
type Props = { options: GlideOption[]; value: string; onChange: (value: string) => void; ariaLabel: string; disabled?: boolean; className?: string };
export function GlideSelect({ options, value, onChange, ariaLabel, disabled = false, className = '' }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const pendingPick = useRef<number | null>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const selected = options.findIndex(option => option.value === value);
  const close = () => { menu.current?.hidePopover(); setOpen(false); drag.current = null; };
  const pick = (index: number) => {
    const option = options[index];
    if (!option || disabled) return;
    if (option.value !== value) onChange(option.value);
    close(); trigger.current?.focus({ preventScroll: true });
  };
  const show = () => {
    if (disabled || !options.length) return;
    setActive(Math.max(0, selected)); setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const popup = menu.current;
    popup.showPopover();
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const margin = 10, gap = 6;
      const below = window.innerHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      const desired = Math.min(options.length * 44 + 10, 340);
      const useAbove = below < desired && above > below;
      const height = Math.max(44, Math.min(desired, useAbove ? above : below));
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - margin * 2);
      setPosition({ left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
        top: Math.max(margin, useAbove ? rect.top - height - gap : rect.bottom + gap),
        width, maxHeight: height, visibility: 'visible' });
    };
    place();
    const onScroll = (event: Event) => { if (!popup.contains(event.target as Node)) place(); };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', onScroll, true); };
  }, [open, options.length]);
  useEffect(() => {
    if (disabled) close();
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!trigger.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);
  useEffect(() => {
    if (open) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  const rowAt = (y: number) => {
    const el = menu.current;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    if (y < rect.top || y > rect.bottom) return -1;
    return Math.floor((y - rect.top - 5 + el.scrollTop) / 44);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); close(); } return; }
    if (e.key === 'Tab') { close(); return; }
    if (!open) {
      if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); show(); }
      return; // Enter/Space use the button's native click when closed.
    }
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '];
    if (keys.includes(e.key)) e.preventDefault();
    if (e.key === 'Enter' || e.key === ' ') { pick(active); return; }
    let next = active;
    if (e.key === 'ArrowDown') next++;
    else if (e.key === 'ArrowUp') next--;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const match = options.map((_, offset) => (active + offset + 1) % options.length)
        .find(index => options[index].label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (match !== undefined) next = match;
    }
    setActive(Math.max(0, Math.min(options.length - 1, next)));
  };
  return <span className={`eb-glide ${className}`}>
    <button ref={trigger} type="button" role="combobox" aria-label={ariaLabel} aria-expanded={open} data-value={value}
      aria-haspopup="listbox" aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${active}` : undefined}
      disabled={disabled || !options.length} className="eb-glide-trigger" onClick={() => open ? close() : show()} onKeyDown={onKey}>
      <span>{options[selected]?.label ?? 'Select…'}</span><span className="eb-glide-chevron" aria-hidden="true" />
    </button>
    <div ref={menu} id={`${id}-list`} popover="manual" role="listbox" aria-label={ariaLabel} className="eb-glide-menu" style={position} onClick={e=>{e.preventDefault(); const row=(e.target as HTMLElement).closest<HTMLElement>('[data-index]'); const index=pendingPick.current ?? (row?Number(row.dataset.index):-1); pendingPick.current=null; pick(index);}}
      onPointerDown={e => {
        // Touch scrolls normally; mouse supports press-drag-release selection.
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        e.preventDefault(); pendingPick.current = null; drag.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId); setActive(Math.max(0, rowAt(e.clientY)));
      }}
      onPointerMove={e => { if (drag.current === e.pointerId) { const index = rowAt(e.clientY); if (index >= 0 && index < options.length) setActive(index); } }}
      onPointerUp={e => { if (drag.current === e.pointerId) { const index = rowAt(e.clientY); drag.current = null; const rect=e.currentTarget.getBoundingClientRect(); pendingPick.current=e.clientX >= rect.left && e.clientX <= rect.right ? index : -1; } }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <span className="eb-glide-pill" aria-hidden="true" style={{ transform: `translateY(${active * 44}px)` }} />
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={index === selected}
        data-index={index} data-value={option.value} className="eb-glide-option" onPointerEnter={e => { if (e.pointerType === 'mouse' && drag.current === null) setActive(index); }}>
        <span>{option.label}</span>{option.tag && <small>{option.tag}</small>}<span className={`eb-glide-check ${index === selected ? 'is-selected' : ''}`} aria-hidden="true" />
      </div>)}
    </div>
  </span>;
}
