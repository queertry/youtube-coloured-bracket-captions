(() => {
  const CONTAINER_SELECTOR = '#ytp-caption-window-container';

  /**
   * Watches YouTube's caption container and calls onChange once per mutation batch.
   *
   * YouTube keeps #ytp-caption-window-container alive while captions are toggled and
   * replaces the .caption-window inside it on every cue, so only that subtree is observed.
   * The container itself is replaced when a new video loads, so its parent's direct children
   * are watched too.
   * MutationObserver callbacks run before the next paint, so the caption is coloured on its
   * very first frame.
   */
  class CaptionObserver {
    constructor(onChange) {
      this._onChange = onChange;
      this._container = null;
      this._running = false;

      this._captionObserver = new MutationObserver(() => this._onChange(this._container));
      this._parentObserver = new MutationObserver(() => {
        if (!this._container?.isConnected) this._bind();
      });
      this._finder = null;

      this._onNavigate = () => this._bind();
    }

    start() {
      if (this._running) return;
      this._running = true;

      document.addEventListener('yt-navigate-finish', this._onNavigate);
      this._bind();
    }

    stop() {
      if (!this._running) return;
      this._running = false;

      document.removeEventListener('yt-navigate-finish', this._onNavigate);
      this._captionObserver.disconnect();
      this._parentObserver.disconnect();
      this._stopFinder();
      this._container = null;
    }

    _bind() {
      if (!this._running) return;
      if (this._container?.isConnected) return;

      this._captionObserver.disconnect();
      this._parentObserver.disconnect();
      this._container = document.querySelector(CONTAINER_SELECTOR);

      if (!this._container) {
        this._startFinder();
        return;
      }

      this._stopFinder();
      this._captionObserver.observe(this._container, { childList: true, subtree: true, characterData: true });
      this._parentObserver.observe(this._container.parentElement, { childList: true });
      this._onChange(this._container);
    }

    // Only runs until the player has created its caption container
    _startFinder() {
      if (this._finder) return;

      this._finder = new MutationObserver(() => {
        if (document.querySelector(CONTAINER_SELECTOR)) this._bind();
      });

      this._finder.observe(document.documentElement, { childList: true, subtree: true });
    }

    _stopFinder() {
      this._finder?.disconnect();
      this._finder = null;
    }
  }

  window.YCBC = window.YCBC || {};
  window.YCBC.CaptionObserver = CaptionObserver;
})();
