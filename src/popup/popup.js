(() => {
  const pickers = new Map();
  const pendingSaves = new Map();
  let saveFrame = 0;

  // Saves at most once per frame, a dragged colour picker fires far more often than that
  function queueSave(key, value) {
    pendingSaves.set(key, value);
    if (saveFrame) return;

    saveFrame = requestAnimationFrame(() => {
      saveFrame = 0;
      for (const [ pendingKey, pendingValue ] of pendingSaves) window.YCBC.Settings.setValue(pendingKey, pendingValue);
      pendingSaves.clear();
    });
  }

  function toElementId(key) {
    return key.toLowerCase().replace(/_/g, '-');
  }

  function resolveInputType(def) {
    if (def.inputType) return def.inputType;
    if (def.type === 'boolean') return 'checkbox';
    if (def.type === 'color') return 'color';
    return 'number';
  }

  function buildPreview(elementId, sample) {
    const preview = document.createElement('div');
    preview.className = 'caption-preview';
    preview.setAttribute('aria-hidden', 'true');

    // Same structure as YouTube: each line is a block, its text an inline-block with the background
    for (const text of sample.split('\n')) {
      const line = document.createElement('div');
      line.className = 'caption-preview-line';

      const segment = document.createElement('span');
      segment.className = 'caption-preview-segment';

      // Mirrors the content script: "[...]" is coloured, brackets included
      for (const part of text.split(/(\[[^\]]*\])/)) {
        if (!part) continue;

        const span = document.createElement('span');
        span.textContent = part;
        if (part.startsWith('[')) span.dataset.colourFor = elementId;
        segment.appendChild(span);
      }

      line.appendChild(segment);
      preview.appendChild(line);
    }

    return preview;
  }

  function updatePreview(elementId, colour) {
    for (const span of document.querySelectorAll(`[data-colour-for="${elementId}"]`)) {
      span.style.color = colour;
    }
  }

  function buildSettingsUI() {
    const schema = window.YCBC.Settings.schema;

    for (const [ key, def ] of Object.entries(schema)) {
      const elementId = toElementId(key);
      const hintId    = `${elementId}-hint`;
      const inputType = resolveInputType(def);

      const section = document.getElementById(def.section);
      if (!section) {
        console.error(`YCBC: Section "${def.section}" not found for setting ${key}`);
        continue;
      }

      const label = document.createElement('label');
      label.className = 'setting-label';
      label.setAttribute('aria-describedby', hintId);

      if (inputType === 'color') {
        label.htmlFor = elementId;
        label.appendChild(document.createTextNode(def.label));
        section.appendChild(label);

        pickers.set(elementId, new window.YCBC.ColourPicker(section, { id: elementId, label: def.label }));

        const reset = document.createElement('button');

        reset.type        = 'button';
        reset.className   = 'reset';
        reset.id          = `${elementId}-reset`;
        reset.textContent = 'Reset to default';

        section.appendChild(reset);
        if (def.preview) section.appendChild(buildPreview(elementId, def.preview));
      } else {
        const input = document.createElement('input');
        input.type  = inputType;
        input.id    = elementId;

        label.appendChild(input);
        label.appendChild(document.createTextNode(def.label));

        section.appendChild(label);
      }

      const hint = document.createElement('div');

      hint.id          = hintId;
      hint.className   = 'hint';
      hint.textContent = def.hint;

      section.appendChild(hint);
    }
  }

  function loadIntoUI() {
    const schema = window.YCBC.Settings.schema;

    for (const [ key, def ] of Object.entries(schema)) {
      const elementId = toElementId(key);
      const input     = document.getElementById(elementId);

      if (!input) {
        console.error(`YCBC: Failed to load setting ${key} into element #${elementId} because the element could not be found.`);
        continue;
      }

      const inputType = resolveInputType(def);
      const value     = window.YCBC.Settings.getValue(key);

      if (inputType === 'color') {
        pickers.get(elementId).setValue(value);
        updatePreview(elementId, value);
      } else if (inputType === 'checkbox') {
        input.checked = !!value;
      } else {
        input.value = String(value);
      }
    }
  }

  function bindUI() {
    const schema = window.YCBC.Settings.schema;

    for (const [ key, def ] of Object.entries(schema)) {
      const elementId = toElementId(key);
      const element   = document.getElementById(elementId);

      if (!element) {
        console.error(`YCBC: Failed to bind event listener for setting ${key} and element #${elementId} because the element could not be found.`);
        continue;
      }

      const inputType = resolveInputType(def);

      if (inputType === 'color') {
        const picker = pickers.get(elementId);

        // 'input' fires while the picker is being dragged, so open videos update live
        picker.addEventListener('input', () => {
          updatePreview(elementId, picker.value);
          queueSave(key, picker.value);
        });

        document.getElementById(`${elementId}-reset`)?.addEventListener('click', () => {
          picker.setValue(def.default);
          updatePreview(elementId, def.default);
          queueSave(key, def.default);
        });

        continue;
      }

      element.addEventListener('change', async () => {
        if (inputType === 'checkbox') {
          await window.YCBC.Settings.setValue(key, !!element.checked);
        } else {
          await window.YCBC.Settings.setValue(key, element.value);
        }
      });
    }
  }

  function setupData() {
    const manifest = browser.runtime.getManifest();
    document.getElementById('version-number').textContent = manifest.version;
    document.getElementById('copyright-link').setAttribute('href', manifest.homepage_url);
  }

  async function init() {
    setupData();
    await window.YCBC.Settings.loadAll();

    buildSettingsUI();
    bindUI();
    loadIntoUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
