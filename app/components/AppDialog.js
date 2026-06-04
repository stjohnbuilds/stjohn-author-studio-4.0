'use client';
//
// AppDialog — shared accessible modal primitive (Block 9, audit fix
// SAS-AUD-20260602-021). Wrap any existing "fixed div with backdrop
// + inner panel" overlay in <AppDialog>. It adds:
//   - role="dialog" + aria-modal="true"
//   - aria-labelledby (via titleId) OR aria-label
//   - Escape closes
//   - Click-outside closes (configurable)
//   - Focus trap (Tab/Shift+Tab cycles within the panel)
//   - Focus returns to the trigger after close
//   - Auto-focus the first focusable element on open
//
// Style is intentionally pass-through: each overlay still picks its
// own backdrop/panel look via containerStyle/panelStyle. This avoids
// forcing a single visual style across modes (Marie's modes have
// distinct palettes) while making accessibility uniform.

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function getFocusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE))
    .filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
}

export default function AppDialog({
  open,
  onClose,
  titleId = null,
  ariaLabel = null,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  containerStyle = null,
  panelStyle = null,
  initialFocusRef = null,
  returnFocusRef = null,
  children,
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  // Remember the element that had focus when we opened, then move
  // focus into the dialog. On close, restore.
  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = (typeof document !== 'undefined') ? document.activeElement : null;
    // Wait one frame so the panel exists in the DOM.
    const raf = requestAnimationFrame(() => {
      const explicit = initialFocusRef?.current;
      if (explicit && typeof explicit.focus === 'function') {
        explicit.focus();
        return;
      }
      const first = getFocusables(panelRef.current)[0];
      if (first) first.focus();
      else if (panelRef.current) {
        // No focusables — focus the panel itself so the dialog is
        // still the active element (screen reader announces title).
        panelRef.current.setAttribute('tabindex', '-1');
        panelRef.current.focus();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (open) return undefined;
    // On close, restore focus to opener (or explicit return ref).
    const target = returnFocusRef?.current || restoreRef.current;
    if (target && typeof target.focus === 'function') {
      // Defer so the trigger button is actually back in the tree.
      const t = setTimeout(() => target.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, returnFocusRef]);

  // Escape closes. Capture-phase so nested overlays don't both fire.
  useEffect(() => {
    if (!open || !closeOnEscape) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, closeOnEscape, onClose]);

  // Focus trap: Tab/Shift+Tab cycles within the panel.
  const onPanelKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') return;
    const focusables = getFocusables(panelRef.current);
    if (!focusables.length) {
      e.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!open) return null;

  const backdropStyle = containerStyle || {
    position: 'fixed', inset: 0, background: 'rgba(28, 18, 44, 0.18)',
    backdropFilter: 'blur(4px)', zIndex: 1300,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
  };

  const ariaProps = titleId
    ? { 'aria-labelledby': titleId }
    : ariaLabel ? { 'aria-label': ariaLabel } : {};

  return (
    <div
      onClick={() => { if (closeOnOutsideClick) onClose?.(); }}
      style={backdropStyle}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...ariaProps}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
        style={panelStyle || undefined}
      >
        {children}
      </div>
    </div>
  );
}
