(() => {
  /**
   * @typedef {Object} MatchSpan
   * @property {number} start Offset of the first coloured character
   * @property {number} end   Offset after the last coloured character
   */

  /**
   * Interface all matchers implement. A matcher receives the full text of one caption
   * window (all of its lines joined with '\n') and returns the spans that should be coloured.
   * Spans may cross line boundaries.
   */
  class BaseMatcher {
    /**
     * @param {Object} config
     * @param {string} config.id         Unique id, used to name the CSS highlight
     * @param {string} config.colourKey  Settings key holding this matcher's colour
     */
    constructor({ id, colourKey }) {
      this.id = id;
      this.colourKey = colourKey;
    }

    /**
     * @param {string} text
     * @returns {MatchSpan[]}
     */
    find(text) {
      throw new Error(`YCBC: ${this.constructor.name}.find() is not implemented`);
    }
  }

  window.YCBC = window.YCBC || {};
  window.YCBC.BaseMatcher = BaseMatcher;
  window.YCBC.Matchers = window.YCBC.Matchers || {};
})();
