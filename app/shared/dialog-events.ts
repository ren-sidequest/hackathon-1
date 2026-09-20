type DialogBounds = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;
type DialogTarget = { getBoundingClientRect: () => DialogBounds };

/** A native dialog is also the event target for clicks in its own padding. */
export function isDialogBackdropClick(event: { target: unknown; currentTarget: DialogTarget; clientX: number; clientY: number }): boolean {
  if (event.target !== event.currentTarget) return false;
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
}
