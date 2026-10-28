(() => {
  let _schema = null;

  const cache = Object.create(null);
  const changeCallbacks = new Set();

  let loaded = false;
  let loadPromise = null;

  function coerce(key, value) {
    const setting = _schema?.[key];
    if (!setting) return value;

    if (setting.type === 'boolean') return !!value;
    if (setting.type === 'string') return (value || '').toString();

    // Normalized to #rrggbb, the format the colour picker and CSS work with
    if (setting.type === 'color') {
      const s = (value || '').toString().toLowerCase();
      if (/^#[0-9a-f]{6}$/.test(s)) return s;
      if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      return setting.default;
    }

    if (setting.type === 'number') {
      const n = Number(value);
      return Number.isFinite(n) ? n : setting.default;
    }

    return value;
  }

  function getDefaultSettings() {
    const obj = {};
    for (const [ key, definition ] of Object.entries(_schema)) {
      obj[key] = definition.default;
    }

    return obj;
  }

  async function loadAll() {
    if (loadPromise) return loadPromise;
    if (loaded) return Promise.resolve();

    loadPromise = (async () => {
      await window.YCBC.ResourceLoader.ready();
      _schema = window.YCBC.Resources.Settings;

      const defaults = getDefaultSettings();
      const stored = await browser.storage.local.get(Object.keys(_schema));

      for (const key of Object.keys(_schema)) {
        const raw = Object.prototype.hasOwnProperty.call(stored, key)
          ? stored[key]
          : defaults[key];

        cache[key] = coerce(key, raw);
      }

      loaded = true;
      return Promise.resolve();
    })();

    return loadPromise;
  }

  function getValue(key) {
    if (!loaded) return undefined;
    return cache[key];
  }

  function getDefinition(key) {
    return _schema?.[key];
  }

  async function setValue(key, value) {
    if (!_schema?.[key]) return;

    const coercedValue = coerce(key, value);
    cache[key] = coercedValue;

    await browser.storage.local.set({ [key]: coercedValue });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    for (const [ key, change ] of Object.entries(changes)) {
      if (!_schema?.[key]) continue;

      const value = coerce(key, change.newValue);
      cache[key] = value;

      for (const cb of changeCallbacks) {
        try { cb(key, value); } catch (e) { /* ignore */ }
      }
    }
  });

  function onChange(callback) {
    if (typeof callback !== 'function') return () => {};
    changeCallbacks.add(callback);
    return () => changeCallbacks.delete(callback);
  }

  window.YCBC = window.YCBC || {};
  window.YCBC.Settings = {
    get schema() { return _schema; },
    getDefinition,
    loadAll,
    getValue,
    setValue,
    onChange
  };
})();
