import { useEffect, useRef, useState } from "react";

type ChatMessage = { role: string };

/**
 * Chat position, like any messenger: opening a conversation lands on the newest message, new messages follow
 * along while she is at the bottom, and a small down arrow appears when she has scrolled up.
 * `active` is true while the chat is on screen.
 */
export function useChatScroll({ active, conversationId, messages, isTyping }: { active: boolean; conversationId: string; messages: ChatMessage[]; isTyping: boolean }) {
  const openedChatRef = useRef("");
  const lastMessageCountRef = useRef(0);
  const [showJump, setShowJump] = useState(false);

  const chatScroller = () => {
    const stage = document.querySelector<HTMLElement>(".app-stage");
    if (stage && getComputedStyle(stage).overflowY === "auto" && stage.scrollHeight > stage.clientHeight) return stage; // phones: the stage scrolls inside the shell
    return (document.scrollingElement || document.documentElement) as HTMLElement; // desktop: the page scrolls
  };
  const scrollChatToBottom = (smooth: boolean) => {
    const scroller = chatScroller();
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };
  const distanceFromBottom = () => {
    const scroller = chatScroller();
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  };

  useEffect(() => {
    if (!active) { openedChatRef.current = ""; return; }
    if (!messages.length) return;
    const key = conversationId || "none";
    if (openedChatRef.current === key) return;
    openedChatRef.current = key;
    const land = () => scrollChatToBottom(false);
    window.requestAnimationFrame(() => window.requestAnimationFrame(land));
    const later = window.setTimeout(land, 300); // fonts and layout may still be settling
    return () => window.clearTimeout(later);
  }, [active, conversationId, messages.length]);

  useEffect(() => {
    const previous = lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;
    if (!active || previous === 0 || messages.length <= previous) return;
    if (distanceFromBottom() < 420 || messages[messages.length - 1]?.role === "user") window.requestAnimationFrame(() => scrollChatToBottom(true));
  }, [messages.length, active]);

  useEffect(() => {
    if (isTyping && active && distanceFromBottom() < 420) window.requestAnimationFrame(() => scrollChatToBottom(true));
  }, [isTyping, active]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the arrow shows or hides from the scroll position */
    if (!active) { setShowJump(false); return; }
    const update = () => setShowJump(messages.length > 0 && distanceFromBottom() > 240);
    update();
    const stage = document.querySelector(".app-stage");
    stage?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // the thread grows while a reply streams in; otherwise scrolling, resizing and new messages are enough
    const timer = isTyping ? window.setInterval(update, 800) : 0;
    return () => {
      stage?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (timer) window.clearInterval(timer);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [active, messages.length, isTyping]);

  return { showJump, scrollChatToBottom };
}
