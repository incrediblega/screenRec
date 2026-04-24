let recorder;
let data = [];
const status = document.getElementById('status');
const recordButton = document.getElementById('btn');
const screenshotButton = document.getElementById('shotBtn');
const selectScreenshotButton = document.getElementById('selectShotBtn');

recordButton.onclick = async () => {
  const audioEnabled = document.getElementById('audioToggle').checked;
  const rawFileName = document.getElementById('fileName').value.trim();
  const fileName = rawFileName || 'video';

  // If we are already recording, stop it
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    recordButton.innerText = "🔴 Start Recording";
    status.innerText = "Saving recording...";
    return;
  }

  try {
    // 1. Get the screen stream (Built-in Browser Feature)
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: audioEnabled
    });

    // 2. Set up the recorder
    recorder = new MediaRecorder(stream);

    // 3. Collect the video data as it records
    recorder.ondataavailable = (e) => data.push(e.data);

    // 4. When you stop, save the file automatically
    recorder.onstop = () => {
      const blob = new Blob(data, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.webm`;
      a.click();

      // Stop the captured tracks so system capture indicator turns off.
      stream.getTracks().forEach((track) => track.stop());

      data = []; // reset for next time
      status.innerText = `Saved as ${fileName}.webm`;
    };

    recorder.start();
    recordButton.innerText = "⏹️ Stop & Save";
    status.innerText = "Recording in progress...";
  } catch (error) {
    status.innerText = "Capture cancelled or blocked.";
  }
};

screenshotButton.onclick = () => {
  const rawFileName = document.getElementById('fileName').value.trim();
  const fileName = rawFileName || 'screenshot';

  chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      status.innerText = "Screenshot failed on this page.";
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${fileName}.png`;
    link.click();
    status.innerText = `Saved as ${fileName}.png`;
  });
};

selectScreenshotButton.onclick = async () => {
  const rawFileName = document.getElementById('fileName').value.trim();
  const fileName = rawFileName || 'screenshot';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab?.windowId) {
    status.innerText = "No active tab found.";
    return;
  }

  chrome.runtime.sendMessage({
    type: 'START_ELEMENT_CAPTURE',
    tabId: tab.id,
    windowId: tab.windowId,
    fileName
  }, (response) => {
    if (chrome.runtime.lastError) {
      status.innerText = "Unable to start selection on this page.";
      return;
    }

    if (!response?.ok) {
      status.innerText = response?.error || "Selection not available here.";
      return;
    }

    status.innerText = "Hover and click an element on the page.";
    window.close();
  });
};