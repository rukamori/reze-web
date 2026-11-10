/// <reference types="vite/client" />

/* Minimal YouTube IFrame API surface (no @types package). */
interface Window {
  YT?: any;
  onYouTubeIframeAPIReady?: () => void;
}
