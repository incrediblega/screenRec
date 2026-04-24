(() => {
  if (window.__screenSnapSelectorActive) {
    return;
  }
  window.__screenSnapSelectorActive = true;

  let highlightedElement = null;
  let previousOutline = '';
  let previousOutlineOffset = '';
  let previousCursor = document.body.style.cursor;

  const clearHighlight = () => {
    if (!highlightedElement) {
      return;
    }
    highlightedElement.style.outline = previousOutline;
    highlightedElement.style.outlineOffset = previousOutlineOffset;
    highlightedElement = null;
  };

  const cleanup = () => {
    clearHighlight();
    document.body.style.cursor = previousCursor;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.__screenSnapSelectorActive = false;
  };

  const onMouseMove = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target === highlightedElement) {
      return;
    }

    clearHighlight();
    highlightedElement = target;
    previousOutline = highlightedElement.style.outline;
    previousOutlineOffset = highlightedElement.style.outlineOffset;
    highlightedElement.style.outline = '2px solid #7c3aed';
    highlightedElement.style.outlineOffset = '2px';
  };

  const onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!highlightedElement) {
      return;
    }

    const rect = highlightedElement.getBoundingClientRect();
    cleanup();
    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTED',
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      devicePixelRatio: window.devicePixelRatio
    });
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'ELEMENT_SELECTION_CANCELLED' });
    }
  };

  document.body.style.cursor = 'crosshair';
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
})();
