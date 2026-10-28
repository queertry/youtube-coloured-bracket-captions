(() => {
  const OPEN_BRACKET = 0x5B;   // [
  const CLOSED_BRACKET = 0x5D; // ]

  /**
   * Colours "[...]" including the brackets themselves. Only brackets that are closed are
   * coloured. Nested brackets are treated as part of the outer span.
   */
  class SquareBracketsMatcher extends window.YCBC.BaseMatcher {
    constructor() {
      super({ id: 'square-brackets', colourKey: 'BRACKET_COLOUR' });
    }

    find(text) {
      const spans = [];
      const open = [];

      for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);

        if (ch === OPEN_BRACKET) {
          open.push(i);
        } else if (ch === CLOSED_BRACKET && open.length) {
          const start = open.pop();

          // Spans nested inside this one are replaced by it
          while (spans.length && spans[spans.length - 1].start > start) spans.pop();
          spans.push({ start, end: i + 1 });
        }
      }

      return spans;
    }
  }

  window.YCBC.Matchers.SquareBrackets = new SquareBracketsMatcher();
})();
