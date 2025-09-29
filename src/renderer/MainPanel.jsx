import React, { useState, useEffect, useRef } from 'react';
import Settings from './Settings';
import SolutionDisplay from './SolutionDisplay';

function MainPanel() {
  const [view, setView] = useState('queue');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [screenshotArray, setScreenshotArray] = useState([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [language, setLanguage] = useState('python');
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Synchronize language changes with main process
  useEffect(() => {
    if (language !== 'python') {
      window.__LANGUAGE__ = language;
    }
  }, [language]);

  const mainPanelRef = useRef(null);
  const settingsAreaRef = useRef(null);

  // --- EFFECTS ---
  useEffect(() => {
    // Start interactive for API key input
    window.api.setClickThrough(false);

    const removeListeners = [];
    
    // Define handlers to prevent recreation on every render
    const handleScreenshotTaken = (_event, newScreenshot) => {
      if (!newScreenshot || !newScreenshot.preview) return;
      setScreenshotArray(prev => {
        const newArray = [...prev];
        if (newArray.length >= 2) newArray.shift();
        newArray.push({ id: newScreenshot.id || Date.now(), preview: newScreenshot.preview, path: newScreenshot.path });
        return newArray;
      });
    };

    const handleNoScreenshots = () => {
      setToast('You have to take a screenshot first.');
      setTimeout(() => setToast(''), 3000);
    };

    const handleStartOver = () => {
      console.log('Renderer: Starting over, resetting all state');
      setView('queue');
      setStreamText('');
      setAiResponse(null);
      setScreenshotArray([]);
      setIsStreaming(false);
    };

    const handleInitialStart = () => {
      setIsStreaming(true);
      setAiResponse(null);
      setStreamText('');
    };

    const handleSolutionSuccess = (_event, data) => {
      setView('solutions');
      setIsStreaming(false);
      if (data && data.analysis && data.code) {
        setAiResponse(data);
      } else {
        setToast('Failed to receive a valid solution from the AI.');
        setTimeout(() => setToast(''), 3000);
      }
    };

    const handleSolutionError = (_event, error) => {
      setIsStreaming(false);
      let errorMessage = "An unknown error occurred.";
      if (typeof error === 'string') errorMessage = error;
      else if (error && typeof error === 'object' && error.message) errorMessage = error.message;
      else if (error) try { errorMessage = JSON.stringify(error); } catch {}
      setToast('Error: ' + errorMessage);
      setTimeout(() => setToast(''), 5000);
    };

    const handleStreamingUpdate = (_event, text) => setStreamText(prev => prev + text);
    const handleStreamingEnd = () => setIsStreaming(false);

    const handleDebugStart = () => {
      setIsStreaming(true);
      setStreamText('');
    };

    const handleDebugSuccess = (_event, data) => {
      setIsStreaming(false);
      if (data && (data.analysis || data.debugging)) {
        // Merge debug results with existing response
        setAiResponse(prev => ({
          ...prev,
          debugging: data.debugging || data.analysis,
          improved_code: data.improved_code || data.code
        }));
      }
    };

    const handleDebugError = (_event, error) => {
      setIsStreaming(false);
      let errorMessage = "Debug failed: ";
      if (typeof error === 'string') errorMessage += error;
      else if (error && typeof error === 'object' && error.message) errorMessage += error.message;
      else errorMessage += "Unknown error occurred";
      setToast(errorMessage);
      setTimeout(() => setToast(''), 5000);
    };

    // Register all listeners
    removeListeners.push(window.api.on('screenshot-taken', handleScreenshotTaken));
    removeListeners.push(window.api.on('no-screenshots', handleNoScreenshots));
    removeListeners.push(window.api.on('start-over', handleStartOver));
    removeListeners.push(window.api.on('initial-start', handleInitialStart));
    removeListeners.push(window.api.on('solution-success', handleSolutionSuccess));
    removeListeners.push(window.api.on('initial-solution-error', handleSolutionError));
    removeListeners.push(window.api.on('debug-start', handleDebugStart));
    removeListeners.push(window.api.on('debug-success', handleDebugSuccess));
    removeListeners.push(window.api.on('debug-error', handleDebugError));
    removeListeners.push(window.api.on('streaming-update', handleStreamingUpdate));
    removeListeners.push(window.api.on('streaming-end', handleStreamingEnd));
    
    return () => {
      removeListeners.forEach(remove => {
        if (typeof remove === 'function') {
          remove();
        }
      });
    };
  }, []);

  useEffect(() => {
    const resizeWindow = () => {
      if (mainPanelRef.current) {
        const width = mainPanelRef.current.scrollWidth;
        const height = mainPanelRef.current.scrollHeight;
        const paddedWidth = Math.round(width) + 40;
        const paddedHeight = Math.round(height) + 20;
        const maxWidth = 1400;
        const minWidth = 350;
        const finalWidth = Math.max(minWidth, Math.min(paddedWidth, maxWidth));
        window.api.updateContentDimensions({ width: finalWidth, height: paddedHeight });
      }
    };
    const timeoutId = setTimeout(resizeWindow, 150);
    return () => clearTimeout(timeoutId);
  }, [aiResponse, isStreaming, screenshotArray, streamText, hasApiKey, view]);

  // --- HANDLERS ---
  const handleApiKeySubmit = async (e) => {
    if (e.key === 'Enter' && apiKeyInput.trim()) {
      const key = apiKeyInput.trim();
      await window.api.setApiKey(key);
      setHasApiKey(true);
      window.api.setClickThrough(true); // Become click-through after key is submitted
    }
  };

  const handleSettingsEnter = () => {
    window.api.setClickThrough(false); // Become interactive
    setSettingsPanelOpen(true);
  };

  const handleSettingsLeave = () => {
    setSettingsPanelOpen(false);
    if (hasApiKey) {
        window.api.setClickThrough(true); // Become click-through again
    }
  };

  // --- RENDER LOGIC ---
  const renderCommandBar = () => {
    if (!hasApiKey) {
      return (
        <div className="flex items-center gap-3">
          <span className="text-[11px] leading-none text-white/70">Enter your Gemini API Key:</span>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={handleApiKeySubmit}
            placeholder="API Key..."
            className="bg-white/10 border border-white/20 rounded-md px-3 py-1 text-[11px] text-white placeholder-white/50 focus:outline-none focus:border-white/40 min-w-[200px]"
            autoFocus
          />
          <div className="flex gap-1"><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">↵</div></div>
        </div>
      );
    }

    const screenshotText = view === 'solutions' ? 'Screenshot your code' : (screenshotArray.length === 0 ? 'Take first screenshot' : 'Take second screenshot');

    return (
      <>
        <div className="flex items-center gap-2 rounded px-2 py-1.5">
          <span className="text-[11px] leading-none truncate">{screenshotText}</span>
          <div className="flex gap-1"><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">H</div></div>
        </div>

        {isStreaming ? (
          <div className="flex items-center gap-2 text-blue-400 px-2 py-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
            <span className="text-[11px] leading-none">Solving...</span>
          </div>
        ) : view === 'solutions' ? (
          <div className="flex items-center gap-2 rounded px-2 py-1.5">
            <span className="text-[11px] leading-none">Debug</span>
            <div className="flex gap-1"><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">↵</div></div>
          </div>
        ) : (
          <div className={`flex flex-col rounded px-2 py-1.5 ${screenshotArray.length > 0 ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] leading-none">Solve</span>
              <div className="flex gap-1 ml-2"><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">↵</div></div>
            </div>
          </div>
        )}

        <div className={`flex items-center gap-2 rounded px-2 py-1.5 ${screenshotArray.length > 0 ? '' : 'opacity-50'}`}>
          <span className="text-[11px] leading-none truncate">Start over</span>
          <div className="flex gap-1"><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">G</div></div>
        </div>

        <div className="flex items-center gap-2 rounded px-2 py-1.5">
          <span className="text-[11px] leading-none">Show/Hide</span>
          <div className="flex gap-1"><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div><div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">B</div></div>
        </div>
        
        <div ref={settingsAreaRef} onMouseLeave={handleSettingsLeave} className="flex items-center flex-shrink-0">
            <div className="inline-block" onMouseEnter={handleSettingsEnter}>
                <div className="w-4 h-4 flex items-center justify-center text-white/70 hover:text-white/90 transition-colors interactive cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </div>
            </div>
            {settingsPanelOpen && (
                <div className="absolute top-full right-0 z-50">
                    <Settings language={language} setLanguage={setLanguage} onClose={handleSettingsLeave} onQuit={() => window.api.quitApp()} />
                </div>
            )}
        </div>
      </>
    );
  };

  return (
    <div className="w-full h-full" ref={mainPanelRef}>
        <div className="relative space-y-3 px-4 py-3">
            {screenshotArray.length > 0 && (
                <div className="bg-transparent screenshot-container">
                    <div className="pb-3">
                        <div className="space-y-3 screenshot-container flex gap-4">
                            {screenshotArray.map((screenshot) => (
                                <div key={screenshot.id} className="border border-white/20 rounded-md relative w-[128px] h-[72px] group screenshot-container">
                                    <img src={screenshot.preview} alt="Screenshot" className="w-full h-full object-cover rounded-md screenshot-container" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full">
                <div className="relative">
                    <div className="pt-2 w-fit z-[1000] relative">
                        <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-start gap-1 flex-nowrap">
                            {renderCommandBar()}
                        </div>
                    </div>
                    {toast && (
                        <div className="absolute top-full left-0 w-full flex justify-center pt-2 pointer-events-none">
                            <div className="text-xs bg-red-500/80 text-white rounded-full px-3 py-1">
                                {toast}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {(isStreaming || aiResponse) && (
                <div className="pt-3">
                    <SolutionDisplay isStreaming={isStreaming} streamText={streamText} aiResponse={aiResponse} language={language} />
                </div>
            )}
        </div>
    </div>
  );
}

export default MainPanel;