import { StandardEvents } from '@shopify/events';

/**
 * Smooth free-shipping bar while keeping native <progress>.
 * Browsers don't interpolate <progress> when markup is replaced; we
 * tween progress.value with rAF after cart updates.
 */
(function () {
  const STORAGE_KEY = '__axFreeShipProgressPrev';
  let animId = 0;
  const DURATION_MS = 650;

  function getBar() {
    return document.querySelector('.cart-drawer__free-shipping progress.free-shipping-progress');
  }

  function readTarget(bar) {
    if (!bar) return null;
    let raw = bar.getAttribute('value');
    if (raw == null || raw === '') raw = String(bar.value);
    const n = parseFloat(raw);
    if (isNaN(n)) return null;
    return Math.min(100, Math.max(0, n));
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Approximates cubic-bezier(0.22, 1, 0.36, 1) */
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 2.15);
  }

  function runTween(bar, from, to) {
    const id = ++animId;
    const start = performance.now();
    bar.value = from;

    function frame(now) {
      if (id !== animId) return;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / DURATION_MS);
      bar.value = from + (to - from) * easeOut(t);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        bar.value = to;
        window[STORAGE_KEY] = to;
      }
    }

    requestAnimationFrame(frame);
  }

  function afterCartUpdate(event) {
    // The event payload might have the updated cart data, but since we are re-rendering the section,
    // the progress bar value attribute will be updated automatically by the new HTML.
    // However, if we're rendering it natively via section API, we need to schedule this AFTER DOM update.
    setTimeout(() => {
      const bar = getBar();
      if (!bar) return;

      const target = readTarget(bar);
      if (target == null) return;

      const prev = window[STORAGE_KEY];
      const shouldTween =
        typeof prev === 'number' &&
        !isNaN(prev) &&
        Math.abs(prev - target) > 0.01 &&
        !prefersReducedMotion();

      if (shouldTween) {
        runTween(bar, prev, target);
      } else {
        animId++;
        bar.value = target;
        window[STORAGE_KEY] = target;
      }
    }, 50); // small delay to let DOM settle from section rendering API
  }

  function init() {
    const bar = getBar();
    const t = readTarget(bar);
    if (t != null) window[STORAGE_KEY] = t;

    document.addEventListener(StandardEvents.cartLinesUpdate, afterCartUpdate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
