(() => {
  const HEX_6 = /^#[0-9a-f]{6}$/;
  const HEX_3 = /^#[0-9a-f]{3}$/;

  const KEY_STEP       = 0.01;
  const KEY_STEP_LARGE = 0.1;

  function normalizeHex(value) {
    const s = (value || '').toString().trim().toLowerCase();
    if (HEX_6.test(s)) return s;
    if (HEX_3.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return null;
  }

  function hexToHsv(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const d   = max - Math.min(r, g, b);

    let h = 0;
    if (d !== 0) {
      if (max === r)      h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
    }

    h *= 60;
    if (h < 0) h += 360;

    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  function hsvToHex({ h, s, v }) {
    const channel = n => {
      const k = (n + h / 60) % 6;
      const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
      return Math.round(value * 255).toString(16).padStart(2, '0');
    };

    return '#' + channel(5) + channel(3) + channel(1);
  }

  function clamp(n) {
    return Math.min(1, Math.max(0, n));
  }

  /**
   * A colour picker drawn inside the page: a saturation/brightness area, a hue strip and a hex
   * field. Dispatches an 'input' event whenever the user changes the colour; read `value`
   * for the new colour.
   */
  class ColourPicker extends EventTarget {
    /**
     * @param {Element} parent
     * @param {Object}  options
     * @param {string}  options.id     Id for the hex field, so a <label for> can point at it
     * @param {string}  options.label  Accessible name for the area and hue strip
     */
    constructor(parent, { id, label }) {
      super();

      this._hsv = { h: 0, s: 0, v: 0 };
      this._hex = '#000000';

      this._build(parent, id, label);
      this._bindEvents();
    }

    get value() {
      return this._hex;
    }

    /**
     * Shows a colour without dispatching 'input'. Invalid values are ignored.
     * @param {string} hex
     */
    setValue(hex) {
      const normalized = normalizeHex(hex);
      if (!normalized) return;

      this._setFromHex(normalized);
      this._hexInput.value = normalized;
    }

    _build(parent, id, label) {
      this._root = document.createElement('div');
      this._root.className = 'colour-picker';

      this._area = document.createElement('div');

      this._area.className = 'colour-picker-area';
      this._area.tabIndex  = 0;
      this._area.setAttribute('role', 'slider');
      this._area.setAttribute('aria-label', `${label}: saturation and brightness`);

      this._areaHandle = document.createElement('div');
      this._areaHandle.className = 'colour-picker-handle';
      this._area.appendChild(this._areaHandle);

      this._hue = document.createElement('div');

      this._hue.className = 'colour-picker-hue';
      this._hue.tabIndex  = 0;
      this._hue.setAttribute('role', 'slider');
      this._hue.setAttribute('aria-label', `${label}: hue`);
      this._hue.setAttribute('aria-valuemin', '0');
      this._hue.setAttribute('aria-valuemax', '360');

      this._hueHandle = document.createElement('div');
      this._hueHandle.className = 'colour-picker-handle';
      this._hue.appendChild(this._hueHandle);

      const row = document.createElement('div');
      row.className = 'colour-picker-row';

      this._swatch = document.createElement('div');
      this._swatch.className = 'colour-picker-swatch';

      this._hexInput = document.createElement('input');

      this._hexInput.type       = 'text';
      this._hexInput.id         = id;
      this._hexInput.className  = 'colour-picker-hex';
      this._hexInput.maxLength  = 7;
      this._hexInput.spellcheck = false;

      row.appendChild(this._swatch);
      row.appendChild(this._hexInput);

      this._root.appendChild(this._area);
      this._root.appendChild(this._hue);
      this._root.appendChild(row);

      parent.appendChild(this._root);
    }

    _bindEvents() {
      this._bindDrag(this._area, ({ x, y }) => {
        this._hsv.s = x;
        this._hsv.v = 1 - y;
      });

      this._bindDrag(this._hue, ({ y }) => {
        this._hsv.h = y * 360;
      });

      this._area.addEventListener('keydown', e => {
        const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
        const moves = {
          ArrowLeft:  () => this._hsv.s = clamp(this._hsv.s - step),
          ArrowRight: () => this._hsv.s = clamp(this._hsv.s + step),
          ArrowDown:  () => this._hsv.v = clamp(this._hsv.v - step),
          ArrowUp:    () => this._hsv.v = clamp(this._hsv.v + step)
        };

        this._handleKey(e, moves);
      });

      this._hue.addEventListener('keydown', e => {
        const step = (e.shiftKey ? KEY_STEP_LARGE : KEY_STEP) * 360;
        const moves = {
          ArrowUp:   () => this._hsv.h = Math.max(0, this._hsv.h - step),
          ArrowDown: () => this._hsv.h = Math.min(360, this._hsv.h + step)
        };

        this._handleKey(e, moves);
      });

      this._hexInput.addEventListener('input', () => {
        const normalized = normalizeHex(this._hexInput.value);
        if (!normalized) return;

        this._setFromHex(normalized);
        this.dispatchEvent(new Event('input'));
      });

      // Tidies up a half-typed or invalid value once the field is left
      this._hexInput.addEventListener('change', () => {
        this._hexInput.value = this._hex;
      });
    }

    /**
     * Calls onMove with the pointer position inside the element (0-1 on each axis) on press
     * and while dragging. Pointer capture keeps the drag going outside the element.
     */
    _bindDrag(element, onMove) {
      const move = e => {
        const rect = element.getBoundingClientRect();
        onMove({
          x: clamp((e.clientX - rect.left) / rect.width),
          y: clamp((e.clientY - rect.top) / rect.height)
        });
        this._changedByUser();
      };

      element.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;

        e.preventDefault();
        element.focus();
        element.setPointerCapture(e.pointerId);
        move(e);
      });

      element.addEventListener('pointermove', e => {
        if (element.hasPointerCapture(e.pointerId)) move(e);
      });
    }

    _handleKey(e, moves) {
      const action = moves[e.key];
      if (!action) return;

      e.preventDefault();
      action();
      this._changedByUser();
    }

    _changedByUser() {
      this._hex = hsvToHex(this._hsv);
      this._hexInput.value = this._hex;
      this._render();
      this.dispatchEvent(new Event('input'));
    }

    _setFromHex(hex) {
      const hsv = hexToHsv(hex);

      // Greys have no hue of their own, keep the current one so the hue strip doesn't jump
      if (hsv.s === 0 || hsv.v === 0) hsv.h = this._hsv.h;

      this._hsv = hsv;
      this._hex = hex;
      this._render();
    }

    _render() {
      const { h, s, v } = this._hsv;

      this._area.style.backgroundColor = `hsl(${h} 100% 50%)`;
      this._areaHandle.style.left = `${s * 100}%`;
      this._areaHandle.style.top  = `${(1 - v) * 100}%`;
      this._areaHandle.style.backgroundColor = this._hex;
      this._area.setAttribute('aria-valuetext', `${this._hex}, saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`);

      this._hueHandle.style.top = `${(h / 360) * 100}%`;
      this._hue.setAttribute('aria-valuenow', String(Math.round(h)));

      this._swatch.style.backgroundColor = this._hex;
    }
  }

  window.YCBC = window.YCBC || {};
  window.YCBC.ColourPicker = ColourPicker;
})();
