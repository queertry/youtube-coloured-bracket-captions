(() => {
  window.YCBC = window.YCBC || {};
  window.YCBC.Resources = window.YCBC.Resources || {};

  const BASE = browser.runtime.getURL(typeof RESOURCES_BASE !== 'undefined' ? RESOURCES_BASE : 'src/resources/');

  async function load({ name, label }) {
    if (!name.endsWith('.json')) {
      throw new Error('YCBC ResourceLoader: Cannot load non-json resource file');
    }

    const resp = await fetch(BASE + name);
    if (!resp.ok) throw new Error(`YCBC ResourceLoader: Failed to load "${name}" (${resp.status})`);

    const data = await resp.json();
    window.YCBC.Resources[label] = data;

    return data;
  }

  const _readyPromise = fetch(BASE + 'index.json')
    .then(r => r.json()).then(contents => Promise.all(contents.files.map(load).filter(x => !!x)));

  window.YCBC.ResourceLoader = {
    ready: () => _readyPromise
  };
})();
