let pendingCapture = null;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

async function cropAndDownload(dataUrl, rect, dpr, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const sx = clamp(Math.round(rect.x * dpr), 0, bitmap.width);
  const sy = clamp(Math.round(rect.y * dpr), 0, bitmap.height);
  const sw = clamp(Math.round(rect.width * dpr), 1, bitmap.width - sx);
  const sh = clamp(Math.round(rect.height * dpr), 1, bitmap.height - sy);

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const croppedUrl = URL.createObjectURL(croppedBlob);

  try {
    await chrome.downloads.download({
      url: croppedUrl,
      filename: `${fileName}.png`,
      saveAs: false
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(croppedUrl), 5000);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'START_ELEMENT_CAPTURE') {
    pendingCapture = {
      tabId: message.tabId,
      windowId: message.windowId,
      fileName: message.fileName || 'screenshot'
    };

    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['selector.js']
    }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: 'Cannot inject selector on this page.' });
        return;
      }
      sendResponse({ ok: true });
    });

    return true;
  }

  if (message?.type === 'ELEMENT_SELECTION_CANCELLED') {
    pendingCapture = null;
    return;
  }

  if (message?.type === 'ELEMENT_SELECTED' && pendingCapture && sender.tab?.id === pendingCapture.tabId) {
    const { rect, devicePixelRatio } = message;
    const { windowId, fileName } = pendingCapture;
    pendingCapture = null;

    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, async (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        return;
      }

      try {
        await cropAndDownload(dataUrl, rect, devicePixelRatio || 1, fileName);
      } catch (error) {
        // Swallow error to keep service worker stable for next attempt.
      }
    });
  }
});
