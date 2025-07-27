const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const downloadButton = document.getElementById('downloadButton');
const statusMessage = document.getElementById('statusMessage');
const previewVideo = document.getElementById('previewVideo');
const recordedVideo = document.getElementById('recordedVideo');

let mediaRecorder;
let recordedChunks = [];
let mediaStream; // To hold the active media stream

// Function to update button states
function updateButtons(recording) {
    startButton.disabled = recording;
    stopButton.disabled = !recording;
    downloadButton.disabled = recording || !recordedChunks.length;
}

// --- Start Recording Function ---
startButton.addEventListener('click', async () => {
    statusMessage.textContent = 'Requesting screen and audio permissions...';
    recordedChunks = []; // Clear previous recordings

    try {
        // Request screen and audio. 'preferCurrentTab' is a hint for some browsers.
        // The user will see a dialog to choose screen, window, or tab, and to include audio.
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                mediaSource: 'screen', // 'screen', 'window', or 'application'
                cursor: 'always' // Show cursor
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100 // Standard audio sample rate
            }
        });

        // Try to get microphone audio if requested or desired
        // You can combine multiple tracks into one stream if needed
        // For simplicity, we'll try to get mic audio and add it to the display stream
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStream.getTracks().forEach(track => mediaStream.addTrack(track));
            statusMessage.textContent = 'Screen and microphone access granted. Starting recording...';
        } catch (micError) {
            console.warn('Microphone access denied or not available, recording screen audio only (if chosen).', micError);
            statusMessage.textContent = 'Screen access granted (microphone access denied or not available). Starting recording...';
        }

        // Display preview (optional)
        previewVideo.srcObject = mediaStream;
        previewVideo.onloadedmetadata = () => {
            previewVideo.play();
        };

        // Initialize MediaRecorder
        // Check for supported MIME types for better compatibility (e.g., 'video/webm; codecs=vp8')
        let options = { mimeType: 'video/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn(`${options.mimeType} is not supported. Trying 'video/webm;codecs=vp8'`);
            options = { mimeType: 'video/webm;codecs=vp8' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} is not supported. Trying 'video/webm;codecs=h264'`);
                options = { mimeType: 'video/webm;codecs=h264' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    console.error('No supported video MIME type found for MediaRecorder.');
                    statusMessage.textContent = 'Error: No supported video recording format found.';
                    mediaStream.getTracks().forEach(track => track.stop()); // Stop stream if error
                    updateButtons(false);
                    return;
                }
            }
        }

        mediaRecorder = new MediaRecorder(mediaStream, options);

        // Event handler for when data is available
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        // Event handler for when recording stops
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, {
                type: mediaRecorder.mimeType
            });
            recordedVideo.src = URL.createObjectURL(blob);
            recordedVideo.controls = true; // Enable controls for the recorded video
            statusMessage.textContent = 'Recording stopped. Video ready to download.';
            updateButtons(false); // Update button states after stop
        };

        mediaRecorder.start();
        statusMessage.textContent = 'Recording... Click Stop to finish.';
        updateButtons(true);

        // Listen for user stopping screen sharing directly from browser controls
        mediaStream.getVideoTracks()[0].onended = () => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                statusMessage.textContent = 'Screen sharing stopped by user. Recording finished.';
            }
        };

    } catch (err) {
        console.error('Error starting screen recording:', err);
        statusMessage.textContent = `Error: ${err.name}. Please grant permissions.`;
        updateButtons(false);
    }
});

// --- Stop Recording Function ---
stopButton.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        // Stop all tracks in the stream to release camera/mic
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        previewVideo.srcObject = null; // Clear preview
        statusMessage.textContent = 'Stopping recording...';
        updateButtons(false);
    }
});

// --- Download Function ---
downloadButton.addEventListener('click', () => {
    if (recordedChunks.length > 0) {
        const blob = new Blob(recordedChunks, {
            type: mediaRecorder.mimeType
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up the object URL
        statusMessage.textContent = 'Video downloaded!';
    } else {
        statusMessage.textContent = 'No recorded video to download.';
    }
});

// Initial button state
updateButtons(false);