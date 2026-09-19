import React, { type HTMLAttributes } from 'react';
import './gold-interactions.css';

// Adapted from React Bits interaction patterns. See docs/third-party/react-bits-license.md.
type CardProps = HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A decorative glow only: no React render, geometry change or pointer interception on movement. */
export function SpotlightCard({ as: Tag = 'section', className = '', children, onPointerMove, onPointerLeave, ...props }: CardProps) {
  return <Tag {...props} className={`eb-spotlight ${className}`} onPointerMove={event => {
    onPointerMove?.(event);
    if (event.pointerType !== 'mouse' || reducedMotion()) return;
    const node = event.currentTarget, rect = node.getBoundingClientRect();
    node.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    node.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    node.dataset.spotActive = 'true';
  }} onPointerLeave={event => {
    delete event.currentTarget.dataset.spotActive;
    event.currentTarget.style.removeProperty('--spot-x');
    event.currentTarget.style.removeProperty('--spot-y');
    onPointerLeave?.(event);
  }}>{children}</Tag>;
}

/** One thin animated perimeter; children retain their existing layout and semantics. */
export function StarBorder({ as: Tag = 'section', className = '', children, ...props }: CardProps) {
  return <Tag {...props} className={`eb-star-border ${className}`}><StarTrail />{children}</Tag>;
}

/** Place inside an existing button without changing its click or keyboard semantics. */
export function StarTrail() {
  return <span className="eb-star-trail" aria-hidden="true" />;
}
