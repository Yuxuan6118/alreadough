# AlreaDough mobile AI UX research — source report

Date: 2026-09-04

## Scope

This report compares the mobile product patterns documented by ChatGPT, Claude, Gemini, Grok, Perplexity, and Apple’s iOS design guidance. It focuses on interaction architecture that can be applied to AlreaDough without copying another company’s visual identity.

## Sources and supported claims

- OpenAI, “Introducing the ChatGPT app for iOS” — https://openai.com/index/introducing-the-chatgpt-app-for-ios/
  - Supports: conversation sync, voice input, and a mobile-first ChatGPT experience.
- OpenAI Help, “Voice Mode FAQ” — https://help.openai.com/en/articles/20001274/
  - Supports: voice is entered from the composer and remains integrated with the same conversation.
- ChatGPT App Store listing — https://apps.apple.com/us/app/chatgpt/id6448311069
  - Supports: ChatGPT’s current mobile feature positioning and social proof.
- Anthropic Help, “Using voice mode on Claude mobile apps” — https://support.anthropic.com/en/articles/11101966-using-voice-mode-on-claude-mobile-apps
  - Supports: voice entry is adjacent to the message input and voice/text can be used in one conversation.
- Claude App Store listing — https://apps.apple.com/us/app/claude-by-anthropic/id6473753684
  - Supports: Claude’s current mobile positioning.
- Google, “The next evolution of the Gemini app” — https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/
  - Supports: expressive typography, fluid animation, haptics, richer response formats, and seamless text/voice interaction.
- Google, “The Gemini app is now available on iPhone” — https://blog.google/products-and-platforms/products/gemini/gemini-iphone-app/
  - Supports: native mobile entry points for text, voice, and camera.
- Perplexity App Store listing — https://apps.apple.com/us/app/perplexity-ai-search-chat/id1668000334
  - Supports: follow-up threads, citations, voice, discovery, and library/history as primary mobile capabilities.
- Grok App Store listing — https://apps.apple.com/us/app/grok-ai/id6670324846
  - Supports: multimodal chat, voice, image, and video capability positioning.
- Apple Human Interface Guidelines, Layout — https://developer.apple.com/design/human-interface-guidelines/layout
  - Supports: safe areas, readable hierarchy, device adaptation, and progressive disclosure.
- Apple UI Design Dos and Don’ts — https://developer.apple.com/design/tips/
  - Supports: avoid horizontal scrolling and overlap, use at least 44 × 44 pt touch targets, and maintain readable text sizing.

## Cross-product patterns

1. Mobile AI products are conversation-first and single-column. The conversation and the composer form the stable shell; complex capabilities open from concise controls, sheets, or separate focused screens.
2. The composer is the dominant persistent action. It spans the usable width, respects the bottom safe area, and never competes with another sticky control.
3. Text, voice, and attachments are adjacent entry modes rather than independent dashboard cards.
4. Long-form replies use generous line-height, one readable measure, and horizontally scrollable action rows when needed.
5. Secondary product areas use progressive disclosure. Desktop side-by-side summaries become stacked mobile sections.
6. A small number of high-frequency destinations can remain in a bottom navigation bar, provided the bar and all fixed actions share one safe-area system.

## AlreaDough diagnosis

- Dreamscape retained a late desktop two-column rule on mobile, creating a clipped half-card.
- The chat composer competed with the bottom navigation and inherited a two-row desktop control layout, producing a narrow text field.
- Settings used a sticky save bar without enough reserved content space, covering fields and colliding with navigation.
- Several desktop-sized headings and cards increased scroll length while reducing usable density.
- Mobile touch targets and text hierarchy were inconsistent across the studio, chat actions, and settings.

## Implementation direction

- Preserve AlreaDough’s cream/rose editorial visual language, but rebuild mobile layout as a true single-column product.
- Use one 16 px page gutter, 44 px minimum touch targets, 16 px conversation body text, and 1.65–1.75 line height for long Chinese replies.
- Keep the five primary destinations because AlreaDough is a multi-tool companion, but make the bottom bar compact, safe-area aware, and non-overlapping.
- Make the chat composer full width above the navigation and constrain its model selector instead of forcing it below the input.
- Stack Dreamscape player and session controls; reduce ornamental dead space; make every mixer row fit without horizontal overflow.
- Turn settings tabs into a horizontal segmented strip and reserve space for a compact fixed save action above navigation.
