'use client';
// TEMPORARY sandbox page — battery test for the Download-clip popup.
// Created by Claude 2026-07-08. DELETE ME before release.
import { useEffect, useState } from 'react';
import ProofingReader from '../components/ProofingReader';

const WORDS = (
  'The dragon kept its receipts and filed them in triplicate every ' +
  'single morning before tea. Nobody dared to ask why the hoard was ' +
  'organised alphabetically by grievance.'
).split(' ');

const SECTION = {
  id: 'clip-test',
  title: 'Clip Test Chapter',
  chapterTitle: 'Clip Test Chapter',
  html: `<p>${WORDS.slice(0, 15).join(' ')}</p><p>${WORDS.slice(15).join(' ')}</p>`,
  whisperAlignment: WORDS.map((w, i) => ({ wordObj: { start: i * 0.5 }, confidence: 1 })),
};

export default function ClipTest() {
  const [verdict, setVerdict] = useState('running…');

  useEffect(() => {
    const results = [];
    function log(name, pass, detail) { results.push(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); }

    async function run() {
      await new Promise((r) => setTimeout(r, 900));
      const units = Array.from(document.querySelectorAll('[data-cr-unit]'));
      log('words rendered', units.length >= 20, `${units.length} units`);
      if (units.length < 20) { setVerdict(results.join(' | ')); return; }

      function selectUnits(a, b) {
        const range = document.createRange();
        range.setStartBefore(units[a]);
        range.setEndAfter(units[b]);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const rect = units[b].getBoundingClientRect();
        units[b].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left, clientY: rect.top }));
      }

      // Test 1: multi-word selection across both paragraphs → popup with times
      selectUnits(10, 22);
      await new Promise((r) => setTimeout(r, 250));
      let pop = document.querySelector('.reader-clip-action');
      log('popup opens on long selection', !!pop);
      if (pop) {
        const txt = pop.textContent || '';
        log('shows word count', /13 words/.test(txt), txt.slice(0, 80));
        log('shows time range', /0:0\d–0:1\d/.test(txt) || /~\d+s/.test(txt));
        const btn = pop.querySelector('button');
        log('Download clip enabled', !!btn && !btn.disabled);
        if (btn) {
          btn.click();
          await new Promise((r) => setTimeout(r, 250));
          const msg = document.querySelector('.reader-clip-action')?.textContent || '';
          log('browser fallback message', /desktop app/.test(msg), msg.slice(-60));
        }
      }

      // Test 2: dismiss, then single-word selection → NO clip popup
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
      selectUnits(5, 5);
      await new Promise((r) => setTimeout(r, 250));
      pop = document.querySelector('.reader-clip-action');
      log('no popup for single word', !pop);

      const fails = results.filter((r) => r.startsWith('✗')).length;
      setVerdict(`${fails === 0 ? 'ALL PASS' : fails + ' FAILED'} :: ${results.join(' | ')}`);
    }
    run();
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div id="clip-test-verdict" style={{ padding: 8, fontSize: 12, fontWeight: 700, background: '#eee', zIndex: 2000 }}>{verdict}</div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ProofingReader section={SECTION} audioUrl="" narratorColors={[]} onSaveFlags={() => {}} onBack={() => {}} />
      </div>
    </div>
  );
}
