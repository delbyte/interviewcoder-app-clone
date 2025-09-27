const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { app } = require('electron');

class ProcessingHelper {
  constructor(deps) {
    this.currentProcessingAbortController = null;
    this.currentExtraProcessingAbortController = null;
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();
    this.genAI = null;
    this.model = null;
  }

  setApiKey(apiKey) {
    if (!apiKey) {
      this.genAI = null;
      this.model = null;
      console.warn('API key was cleared.');
      return;
    }
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      console.log('Gemini AI model initialized successfully with new API key.');
    } catch (error) {
      console.error('Failed to initialize Gemini AI with the provided API key:', error);
      this.genAI = null;
      this.model = null;
    }
  }

  async compressImage(base64Data, attempt = 1) {
    try {
      const mainWindow = this.deps.getMainWindow();
      if (!mainWindow) {
        console.warn("Main window not available for image compression");
        return base64Data;
      }
      const compressionSettings = [
        { maxWidth: 1600, maxHeight: 900, quality: 0.7 },
        { maxWidth: 1200, maxHeight: 675, quality: 0.6 },
        { maxWidth: 800, maxHeight: 450, quality: 0.5 },
      ];
      const setting = compressionSettings[Math.min(attempt - 1, 2)];
      const compressedBase64 = await mainWindow.webContents.executeJavaScript(`
        (async function compressImageInRenderer() {
          try {
            const base64Data = "${base64Data}";
            const img = new Image();
            return new Promise((resolve, reject) => {
              img.onload = function() {
                try {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  let { width, height } = img;
                  const maxWidth = ${setting.maxWidth};
                  const maxHeight = ${setting.maxHeight};
                  if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                  }
                  canvas.width = width;
                  canvas.height = height;
                  ctx.drawImage(img, 0, 0, width, height);
                  const compressedDataUrl = canvas.toDataURL('image/jpeg', ${setting.quality});
                  const base64Result = compressedDataUrl.split(',')[1];
                  resolve(base64Result);
                } catch (err) {
                  reject(err);
                }
              };
              img.onerror = () => reject(new Error('Failed to load image'));
              img.src = 'data:image/jpeg;base64,' + base64Data;
            });
          } catch (error) {
            throw error;
          }
        })()
      `);
      return compressedBase64;
    } catch (error) {
      console.error(`Image compression failed on attempt ${attempt}:`, error);
      return base64Data;
    }
  }

  calculatePayloadSize(screenshots) {
    return screenshots.reduce((total, screenshot) => {
      return total + Math.ceil((screenshot.data.length * 3) / 4);
    }, 0);
  }

  async compressScreenshotsUntilLimit(screenshots) {
    const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024;
    const MAX_ATTEMPTS = 3;
    let currentScreenshots = [...screenshots];
    let attempt = 1;
    while (attempt <= MAX_ATTEMPTS) {
      const payloadSize = this.calculatePayloadSize(currentScreenshots);
      if (payloadSize <= MAX_PAYLOAD_SIZE) {
        return { success: true, screenshots: currentScreenshots };
      }
      if (attempt > MAX_ATTEMPTS) {
        break;
      }
      try {
        const compressedScreenshots = await Promise.all(screenshots.map(async (screenshot) => {
          const compressedData = await this.compressImage(screenshot.data, attempt);
          return {
            ...screenshot,
            data: compressedData
          };
        }));
        currentScreenshots = compressedScreenshots;
      } catch (error) {
        console.error(`Compression attempt ${attempt} failed:`, error);
        break;
      }
      attempt++;
    }
    const finalSize = this.calculatePayloadSize(currentScreenshots);
    console.error(`Failed to compress screenshots to acceptable size after ${MAX_ATTEMPTS} attempts. Final size: ${(finalSize / 1024 / 1024).toFixed(2)}MB`);
    return {
      success: false,
      error: "Images are too large. Please try taking smaller screenshots or reduce the number of images."
    };
  }

  async waitForInitialization(mainWindow) {
    let attempts = 0;
    const maxAttempts = 50;
    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript("window.__IS_INITIALIZED__");
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  async getLanguage() {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return "python";
    try {
      await this.waitForInitialization(mainWindow);
      const language = await mainWindow.webContents.executeJavaScript("window.__LANGUAGE__");
      if (typeof language !== "string" || language === undefined || language === null) {
        console.warn("Language not properly initialized");
        return "python";
      }
      return language;
    } catch (error) {
      console.error("Error getting language:", error);
      return "python";
    }
  }

  async processScreenshots() {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    const view = this.deps.getView();
    console.log(`processScreenshots called with view: ${view}`);

    if (view === "queue") {
      mainWindow.webContents.send('initial-start');
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send('no-screenshots');
        return;
      }

      try {
        this.currentProcessingAbortController = new AbortController();
        const initialScreenshots = await Promise.all(screenshotQueue.map(async (path) => {
          const rawBase64 = fs.readFileSync(path).toString("base64");
          return { path, preview: await this.screenshotHelper.getImagePreview(path), data: rawBase64 };
        }));

        const compressionResult = await this.compressScreenshotsUntilLimit(initialScreenshots);
        if (!compressionResult.success) {
          mainWindow.webContents.send('initial-solution-error', compressionResult.error);
          this.deps.setView("queue");
          return;
        }

        const result = await this.processScreenshotsHelper(compressionResult.screenshots);
        if (!result.success) {
          mainWindow.webContents.send('initial-solution-error', result.error);
          this.deps.setView("queue");
          return;
        }

        if (typeof result.data === 'string') {
          try {
            let jsonString = result.data;
            const match = jsonString.match(/```json\n([\s\S]*?)\n```/);
            if (match && match[1]) {
              jsonString = match[1];
            }
            const parsedData = JSON.parse(jsonString);
            mainWindow.webContents.send('solution-success', parsedData);
            this.deps.setView("solutions");
          } catch (parseError) {
            console.error('Failed to parse solution JSON:', parseError, 'Raw data:', result.data);
            mainWindow.webContents.send('initial-solution-error', 'Invalid response format from server.');
            this.deps.setView("queue");
          }
        } else {
            mainWindow.webContents.send('solution-success', result.data);
            this.deps.setView("solutions");
        }
      } catch (error) {
        mainWindow.webContents.send('initial-solution-error', error.message || "Server error. Please try again.");
        this.deps.setView("queue");
      } finally {
        this.currentProcessingAbortController = null;
      }
    } else if (view === "solutions") {
      console.log(`Processing in solutions view - checking extra screenshots`);
      const extraScreenshotQueue = this.screenshotHelper.getExtraScreenshotQueue();
      console.log(`Extra screenshots found: ${extraScreenshotQueue.length}`);
      if (extraScreenshotQueue.length === 0) {
        console.log(`No extra screenshots, sending no-screenshots event`);
        mainWindow.webContents.send('no-screenshots');
        return;
      }
      mainWindow.webContents.send('debug-start');
      this.currentExtraProcessingAbortController = new AbortController();
      try {
        const initialScreenshots = await Promise.all([
          ...this.screenshotHelper.getScreenshotQueue(),
          ...extraScreenshotQueue
        ].map(async (path) => {
          const rawBase64 = fs.readFileSync(path).toString("base64");
          return {
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: rawBase64
          };
        }));
        const compressionResult = await this.compressScreenshotsUntilLimit(initialScreenshots);
        if (!compressionResult.success) {
          mainWindow.webContents.send('debug-error', compressionResult.error);
          return;
        }
        const screenshots = compressionResult.screenshots;
        console.log(`About to process extra screenshots with ${screenshots.length} screenshots`);
        const result = await this.processExtraScreenshotsHelper(screenshots);
        console.log(`processExtraScreenshotsHelper returned:`, result);
        if (result.success) {
          this.deps.setHasDebugged(true);
          console.log(`Calling clearExtraScreenshotQueue after successful debug processing`);
          this.screenshotHelper.clearExtraScreenshotQueue();
          let parsedData = result.data;
          if (typeof result.data === 'string') {
            try {
              parsedData = JSON.parse(result.data);
            } catch (parseError) {
              console.error('Failed to parse debug JSON:', parseError);
              mainWindow.webContents.send('debug-error', 'Invalid response format from server');
              return;
            }
          }
          console.log('Sending debug-success with parsed data:', parsedData);
          mainWindow.webContents.send('debug-success', parsedData);
        } else {
          mainWindow.webContents.send('debug-error', result.error);
        }
      } catch (error) {
        mainWindow.webContents.send('debug-error', error.message);
      } finally {
        this.currentExtraProcessingAbortController = null;
      }
    }
  }

  async processStreamResponse(stream, mainWindow) {
    return new Promise((resolve, reject) => {
      let isCleanedUp = false;
      let hasReceivedData = false;
      let streamData = '';
      const timeout = setTimeout(() => {
        if (!isCleanedUp) {
          console.log('Stream processing timeout after 5 minutes');
          cleanup();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('streaming-end', { success: true, message: 'Stream timeout' });
          }
          if (!hasReceivedData) {
            resolve({ success: false, error: 'Stream timeout with no data received' });
          } else {
            resolve({ success: true, data: streamData });
          }
        }
      }, 300000);
      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearTimeout(timeout);
        stream.removeAllListeners('data');
        stream.removeAllListeners('end');
        stream.removeAllListeners('error');
        stream.removeAllListeners('close');
        if (stream.destroy && typeof stream.destroy === 'function') {
          try {
            stream.destroy();
          } catch (e) {
            console.error('Error destroying stream:', e);
          }
        }
      };
      const dataHandler = (chunk) => {
        if (isCleanedUp) return;
        hasReceivedData = true;
        const chunkStr = chunk.toString();
        streamData += chunkStr;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('streaming-update', chunkStr);
        }
      };
      const endHandler = () => {
        if (isCleanedUp) return;
        console.log(`Stream ended, hasReceivedData: ${hasReceivedData}, totalData: ${streamData.length} chars`);
        cleanup();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('streaming-end', { success: true });
        }
        if (hasReceivedData && streamData.trim().length > 0) {
          resolve({ success: true, data: streamData });
        } else {
          resolve({ success: false, error: 'No data received from stream' });
        }
      };
      const errorHandler = (error) => {
        if (isCleanedUp) return;
        console.error('Stream error, forwarding to renderer:', error);
        cleanup();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('streaming-error', error.message);
        }
        reject(error);
      };
      const closeHandler = () => {
        if (isCleanedUp) return;
        console.warn('Stream closed unexpectedly');
        cleanup();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('streaming-end', { success: true, message: 'Stream closed' });
        }
        resolve({ success: true, data: null });
      };
      stream.on('data', dataHandler);
      stream.on('end', endHandler);
      stream.on('error', errorHandler);
      stream.on('close', closeHandler);
    });
  }

  async processScreenshotsHelper(screenshots, languageOverride = null) {
    if (!this.model) {
      return { success: false, error: "API key not set. Please enter your Gemini API key." };
    }
    try {
      const imageParts = screenshots.map((screenshot) => ({ inlineData: { data: screenshot.data, mimeType: 'image/jpeg' } }));
      const language = languageOverride || await this.getLanguage();
      const prompt = `You are an expert coding interviewer. Analyze the screenshot(s) of a coding problem and provide a complete solution in ${language}. 

Please provide:
1. Problem analysis
2. Solution approach
3. Complete code solution
4. Time/space complexity analysis

Format your response as a single raw JSON object with keys: "analysis", "approach", "code", and "complexity". The value for "complexity" should be another JSON object with keys "time_complexity" and "space_complexity".
IMPORTANT: Your entire response must be only the raw JSON object, without any Markdown formatting, code fences, or any other text outside the JSON structure.`;

      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();
      return { success: true, data: text };
    } catch (error) {
      return { success: false, error: error.message || "Failed to process. Please try again." };
    }
  }

  async processExtraScreenshotsHelper(screenshots) {
    if (!this.model) {
        return { success: false, error: "API key not set. Please enter your Gemini API key." };
    }
    try {
      const imageParts = screenshots.map((screenshot) => ({
        inlineData: {
          data: screenshot.data,
          mimeType: 'image/jpeg'
        }
      }));

      const language = await this.getLanguage();
      const prompt = `You are debugging a coding solution. Analyze the additional screenshot(s) and provide debugging insights or improvements to the existing solution in ${language}.

Please provide:
1. Additional analysis from new screenshots
2. Debugging suggestions
3. Improved code if applicable
4. Further recommendations

Format your response as JSON with keys: analysis, debugging, improved_code, recommendations`;

      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      return { success: true, data: text };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  cancelOngoingRequests() {
    let wasCancelled = false;
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }
    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }
    this.deps.setHasDebugged(false);
    this.deps.setProblemInfo(null);
    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('no-screenshots');
    }
  }
}

module.exports = { ProcessingHelper };