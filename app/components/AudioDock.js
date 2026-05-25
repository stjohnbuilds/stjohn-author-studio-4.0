'use client';

// Shared bottom-of-reader audio dock. Sits in ChapterReader's bottomDock
// slot. Native <audio> element with controls, plus speed slider and jump
// chips. Optional slots so modes can add their own buttons (Proof:
// flag, transcription toggle, follow text, manual sync; Quill: pick
// audio file).
//
// Marie's rule: ONE audio dock everywhere. Same look, same controls.
// Used by: Quill (file picker + simple playback), Proof (whisper sync
// + flag + follow text + manual sync extras via the slots).
//
// Speed can be controlled (parent passes speed + onSpeedChange) or
// uncontrolled (internal state seeded from defaultSpeed). Proof uses
// controlled mode because it persists listenSpeed per book.

import React, { useEffect, useRef, useState } from 'react';

export default function AudioDock({
  audioUrl = null,
  label = '',
  audioRef: audioRefProp,
  onTimeUpdate,
  onLoadedMetadata,
  defaultSpeed = 1,
  // Controlled speed mode — if both are provided, parent owns the value.
  speed: speedProp,
  onSpeedChange,
  // Left, right, and extra-row slots for mode-specific buttons (Quill's
  // pick-audio, Proof's flag / transcription / follow / manual sync).
  leftActions = null,
  rightActions = null,
  extraRow = null,
  // Show the speed slider? Default yes.
  showSpeed = true,
  // Show the ±10s / ±30s jump chips? Default yes.
  showJumps = true,
  // Compact width inside the dock — defaults to the reader paper width.
  contentWidth = 'min(740px, calc(100vw - 40px))',
  // Float fixed at viewport bottom (Quill via ChapterReader.bottomDock)
  // or sit in normal document flow (Proof's flex column).
  floating = true,
}) {
  const internalRef = useRef(null);
  const audioRef = audioRefProp || internalRef;
  const isControlled = typeof speedProp === 'number' && typeof onSpeedChange === 'function';
  const [internalSpeed, setInternalSpeed] = useState(defaultSpeed);
  const speed = isControlled ? speedProp : internalSpeed;
  const setSpeed = isControlled
    ? (next) => onSpeedChange(typeof next === 'function' ? next(speed) : next)
    : setInternalSpeed;

  // Keep the <audio> element's playbackRate in sync with the slider.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed, audioUrl, audioRef]);

  function jumpSec(delta) {
    const el = audioRef.current;
    if (!el) return;
    const next = Math.max(0, (el.currentTime || 0) + delta);
    el.currentTime = next;
  }

  function stepSpeed(delta) {
    setSpeed((v) => Math.max(0.5, Math.min(3, +(v + delta).toFixed(2))));
  }

  return (
    <div
      style={{
        ...(floating
          ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000 }
          : { flexShrink: 0 }),
        borderTop: '1px solid var(--border-light)',
        background: 'rgba(250,250,248,0.94)',
        padding: '8px 16px 10px',
        boxShadow: '0 -10px 28px rgba(15,18,35,0.05)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: contentWidth,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {label && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>
            {label}
          </div>
        )}
        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            preload="auto"
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            style={{ width: '100%', height: 38, borderRadius: 16 }}
          />
        ) : (
          <div
            style={{
              padding: '8px 14px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              border: '1px dashed var(--border)',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
            }}
          >
            No audio loaded yet
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            flexWrap: 'wrap',
          }}
        >
          {leftActions}
          {showSpeed && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 9px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid var(--border-light)',
                minWidth: 220,
                maxWidth: '100%',
              }}
            >
              <span
                style={{
                  fontSize: '0.66rem',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Speed
              </span>
              <button
                onClick={() => stepSpeed(-0.1)}
                aria-label="Slower"
                title="Slower"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0 2px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                −
              </button>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
                aria-label="Playback speed"
              />
              <button
                onClick={() => stepSpeed(0.1)}
                aria-label="Faster"
                title="Faster"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0 2px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                +
              </button>
              <span
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 38,
                  textAlign: 'right',
                }}
              >
                {speed.toFixed(2)}×
              </span>
            </div>
          )}
          {showJumps && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 8px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid var(--border-light)',
              }}
            >
              {[[-30, '«30'], [-10, '‹10'], [10, '10›'], [30, '30»']].map(([s, l]) => (
                <button
                  key={s}
                  onClick={() => jumpSec(s)}
                  title={`Jump ${s > 0 ? '+' : ''}${s} seconds`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 4px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {rightActions}
        </div>
        {extraRow}
      </div>
    </div>
  );
}
