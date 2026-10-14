import { useEffect, useRef } from 'react';

/**
 * Publishes the element's rendered height as a CSS custom property on <html>
 * (e.g. --trial-banner-h: 44px) and clears it on unmount. Used to stack the
 * new-version notice under banners whose height depends on content and width.
 */
export function useHeightVar(name) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el) return undefined;
    const write = () => root.style.setProperty(name, `${el.offsetHeight}px`);
    write();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(name);
    };
  }, [name]);

  return ref;
}
