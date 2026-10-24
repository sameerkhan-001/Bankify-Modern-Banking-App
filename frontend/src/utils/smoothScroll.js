import Lenis from 'lenis';

/**
 * Lenis smooth scrolling for the whole page. Skipped for users who prefer reduced
 * motion. Scrollable containers (modal, mobile drawer) opt out with `data-lenis-prevent`
 * so they keep native scrolling. Exposed as window.__lenis so the router can reset
 * the scroll position on navigation.
 */
export function startSmoothScroll() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  window.__lenis = lenis;

  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
