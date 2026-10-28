(() => {
  const STYLE_ID = 'ycbc-highlight-style';
  const LINE_SELECTOR = '.caption-visual-line';

  /**
   * Colours caption text through the CSS Custom Highlight API.
   */
  class HighlightRenderer {
    constructor(matchers) {
      this._matchers = matchers;
      this._highlights = new Map();
      this._colours = new Map();
      this._style = null;

      for (const matcher of matchers) {
        const highlight = new Highlight();
        this._highlights.set(matcher.id, highlight);
        CSS.highlights.set(this._highlightName(matcher), highlight);
      }
    }

    /**
     * Re-renders every caption window inside the container. Called once per mutation batch.
     * @param {Element} container
     */
    render(container) {
      this.clear();

      for (const captionWindow of container.children) {
        const { text, nodes } = this._collectText(captionWindow);
        if (!text) continue;

        for (const matcher of this._matchers) {
          const spans = matcher.find(text);
          if (!spans.length) continue;

          const highlight = this._highlights.get(matcher.id);
          for (const span of spans) {
            const range = this._toRange(nodes, span);
            if (range) highlight.add(range);
          }
        }
      }
    }

    static isSupported() {
      return typeof Highlight === 'function' && typeof CSS !== 'undefined' && !!CSS.highlights;
    }

    setColour(matcher, colour) {
      this._colours.set(matcher.id, colour);
      this._writeStyle();
    }

    clear() {
      for (const highlight of this._highlights.values()) highlight.clear();
    }

    _highlightName(matcher) {
      return `ycbc-${matcher.id}`;
    }

    _writeStyle() {
      if (!this._style || !this._style.isConnected) {
        this._style = document.getElementById(STYLE_ID) || document.createElement('style');
        this._style.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(this._style);
      }

      let css = '';
      for (const matcher of this._matchers) {
        const colour = this._colours.get(matcher.id);
        if (colour) css += `::highlight(${this._highlightName(matcher)}) { color: ${colour}; }\n`;
      }

      this._style.textContent = css;
    }

    /**
     * Joins the text of a caption window, one '\n' between visual lines, and records where
     * each text node starts in that joined string.
     */
    _collectText(captionWindow) {
      const nodes = [];
      let text = '';

      const lines = captionWindow.querySelectorAll(LINE_SELECTOR);
      const roots = lines.length ? lines : [ captionWindow ];

      for (const root of roots) {
        if (text) text += '\n';

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.data) continue;
          nodes.push({ node, start: text.length });
          text += node.data;
        }
      }

      return { text, nodes };
    }

    _toRange(nodes, { start, end }) {
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;

      for (const { node, start: nodeStart } of nodes) {
        const nodeEnd = nodeStart + node.data.length;

        // A span starting on a line separator begins at the start of the next node
        if (!startNode && start < nodeEnd) {
          startNode = node;
          startOffset = Math.max(0, start - nodeStart);
        }

        if (startNode && end <= nodeEnd) {
          endNode = node;
          endOffset = Math.max(0, end - nodeStart);
          break;
        }

        if (startNode) {
          endNode = node;
          endOffset = node.data.length;
        }
      }

      if (!startNode || !endNode) return null;

      const range = new Range();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      return range;
    }
  }

  window.YCBC = window.YCBC || {};
  window.YCBC.HighlightRenderer = HighlightRenderer;
})();
