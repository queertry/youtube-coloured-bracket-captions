(async () => {
  const { Settings, Matchers, HighlightRenderer, CaptionObserver } = window.YCBC;

  if (!HighlightRenderer.isSupported()) {
    console.error('YCBC: The CSS Custom Highlight API is not available, captions will not be coloured.');
    return;
  }

  // Add new matchers here, each one gets its own colour setting
  const matchers = [
    Matchers.SquareBrackets
  ];

  await Settings.loadAll();

  const renderer = new HighlightRenderer(matchers);
  const observer = new CaptionObserver(container => renderer.render(container));

  for (const matcher of matchers) {
    renderer.setColour(matcher, Settings.getValue(matcher.colourKey));
  }

  function applyEnabled(enabled) {
    if (enabled) {
      observer.start();
      return;
    }

    observer.stop();
    renderer.clear();
  }

  Settings.onChange((key, value) => {
    if (key === 'ENABLED') {
      applyEnabled(value);
      return;
    }

    const matcher = matchers.find(m => m.colourKey === key);
    if (matcher) renderer.setColour(matcher, value);
  });

  applyEnabled(Settings.getValue('ENABLED'));
})();
