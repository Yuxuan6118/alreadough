import { useEffect, useRef, useState } from "react";

const drawerWidth = () => Math.min(window.innerWidth * 0.82, 330);
const shellTransform = (x: number) => (x > 0 ? `translate3d(${Math.round(x)}px, var(--vv-top, 0px), 0)` : "");
const DRAWER_EASE = "transform .32s cubic-bezier(.32,.72,0,1)";

/**
 * Side panel on phones, like ChatGPT and Claude: swipe right to pull it out (the page follows the finger and
 * slides over), swipe left or tap the page to put it away. The panel lives outside the app shell and only the
 * shell moves. While it moves the shell gets a plain inline transform (cheap, one write per frame) and the
 * expensive effects (blur, grain) are switched off by the .drawer-moving class.
 *
 * Give `attachShell` to the app shell's `ref`; `moveSidebar(true/false)` opens or closes the panel from a button.
 */
export function useSwipeDrawer() {
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);
  /** The same element, for event handlers that move it (the state copy re-runs the effects that wire it up). */
  const shellRef = useRef<HTMLElement | null>(null);
  const attachShell = (node: HTMLElement | null) => { shellRef.current = node; setShellEl(node); };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarOpenRef = useRef(false);

  const moveSidebar = (open: boolean) => {
    const shell = shellRef.current;
    if (shell) {
      shell.classList.add("drawer-moving");
      shell.style.transition = DRAWER_EASE;
      window.setTimeout(() => { shell.style.transition = ""; shell.classList.remove("drawer-moving"); }, 360);
    }
    setSidebarOpen(open);
  };
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
    document.documentElement.style.setProperty("--drawer-w", `${Math.round(drawerWidth())}px`);
    if (shellRef.current) shellRef.current.style.transform = shellTransform(sidebarOpen ? drawerWidth() : 0);
  }, [sidebarOpen, shellEl]);
  useEffect(() => {
    const shell = shellEl;
    if (!shell) return;
    const phone = window.matchMedia("(max-width: 820px)");
    let startX = 0, startY = 0, lastX = 0, lastT = 0, base = 0, velocity = 0, currentX = 0, frame = 0;
    let decided = false, dragging = false, ignore = false;
    const paint = () => { frame = 0; shell.style.transform = shellTransform(currentX); };
    const setX = (x: number) => { currentX = x; if (!frame) frame = window.requestAnimationFrame(paint); };
    const settle = (open: boolean) => {
      if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
      shell.classList.add("drawer-moving");
      shell.style.transition = DRAWER_EASE;
      window.setTimeout(() => { shell.style.transition = ""; shell.classList.remove("drawer-moving"); }, 360);
      currentX = open ? drawerWidth() : 0;
      shell.style.transform = shellTransform(currentX);
      setSidebarOpen(open);
    };
    // a swipe that begins in a field or a sideways-scrolling strip belongs to that control
    const owned = (target: EventTarget | null) => {
      let node = target as HTMLElement | null;
      while (node && node !== shell) {
        if (node.matches?.("textarea, input, select, [data-no-drawer]")) return true;
        const style = getComputedStyle(node);
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 2) return true;
        node = node.parentElement;
      }
      return false;
    };
    const onStart = (event: TouchEvent) => {
      if (!phone.matches || event.touches.length !== 1) { ignore = true; return; }
      const touch = event.touches[0];
      startX = lastX = touch.clientX; startY = touch.clientY; lastT = Date.now();
      decided = false; dragging = false; velocity = 0;
      base = currentX = sidebarOpenRef.current ? drawerWidth() : 0;
      ignore = !sidebarOpenRef.current && owned(event.target);
    };
    const onMove = (event: TouchEvent) => {
      if (ignore) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX, dy = touch.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        decided = true;
        const open = sidebarOpenRef.current;
        dragging = Math.abs(dx) > Math.abs(dy) * 1.4 && ((!open && dx > 0) || (open && dx < 0));
        if (dragging) { shell.style.transition = "none"; shell.classList.add("drawer-moving"); }
      }
      if (!dragging) return;
      const now = Date.now();
      velocity = (touch.clientX - lastX) / Math.max(1, now - lastT);
      lastX = touch.clientX; lastT = now;
      setX(Math.max(0, Math.min(drawerWidth(), base + dx)));
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      settle(velocity > 0.4 ? true : velocity < -0.4 ? false : currentX > drawerWidth() / 2);
    };
    // while the panel is out, a tap on the page only puts the panel away
    const onTap = (event: Event) => {
      if (!sidebarOpenRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      settle(false);
    };
    shell.addEventListener("touchstart", onStart, { passive: true });
    shell.addEventListener("touchmove", onMove, { passive: true });
    shell.addEventListener("touchend", onEnd);
    shell.addEventListener("touchcancel", onEnd);
    shell.addEventListener("click", onTap, true);
    // The panel is a sibling of the shell, not inside it, so a swipe that starts on the panel
    // needs the same handlers; otherwise it only closes when the finger starts on the page.
    const panel = document.querySelector<HTMLElement>(".swipe-sidebar");
    panel?.addEventListener("touchstart", onStart, { passive: true });
    panel?.addEventListener("touchmove", onMove, { passive: true });
    panel?.addEventListener("touchend", onEnd);
    panel?.addEventListener("touchcancel", onEnd);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      panel?.removeEventListener("touchstart", onStart);
      panel?.removeEventListener("touchmove", onMove);
      panel?.removeEventListener("touchend", onEnd);
      panel?.removeEventListener("touchcancel", onEnd);
      shell.removeEventListener("touchstart", onStart);
      shell.removeEventListener("touchmove", onMove);
      shell.removeEventListener("touchend", onEnd);
      shell.removeEventListener("touchcancel", onEnd);
      shell.removeEventListener("click", onTap, true);
    };
  }, [shellEl]);

  return { sidebarOpen, moveSidebar, attachShell };
}
