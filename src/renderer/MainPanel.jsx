import React, { useState, useEffect, useRef } from 'react';
import Settings from './Settings';
import SolutionDisplay from './SolutionDisplay';

function MainPanel({ windowType = 'floating' }) {
  const [screenshots, setScreenshots] = useState([]);
  const [view, setView] = useState('queue');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [language, setLanguage] = useState('python');
  const [aiResponse, setAiResponse] = useState(null);
  const [screenshotArray, setScreenshotArray] = useState([]); // Max 2 screenshots
  
  // API Key management
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    // Disable click-through on startup so user can enter API key
    window.api.setClickThrough(false);

    loadScreenshots();
    loadSettings();

    // Set up IPC listeners
    const removeListeners = [];
    removeListeners.push(window.api.on('screenshot-taken', (_event, newScreenshot) => {
      console.log('Received new screenshot in renderer:', newScreenshot);
      if (!newScreenshot || !newScreenshot.preview) {
        console.error('Invalid screenshot data received:', newScreenshot);
        return;
      }
      setScreenshotArray(prev => {
        const newArray = [...prev];
        if (newArray.length >= 2) {
          newArray.shift();
        }
        const newScreenshotObj = {
          id: newScreenshot.id || Date.now(),
          preview: newScreenshot.preview,
          path: newScreenshot.path 
        };
        newArray.push(newScreenshotObj);
        return newArray;
      });
    }));
    removeListeners.push(window.api.on('start-over', () => {
      setScreenshots([]);
      setView('queue');
      setStreamText('');
      setAiResponse(null);
      setScreenshotArray([]);
    }));
    removeListeners.push(window.api.on('initial-start', () => {
      setIsStreaming(true);
      setAiResponse(null);
    }));
    removeListeners.push(window.api.on('solution-success', (data) => {
      setView('solutions');
      setIsStreaming(false);
      if (data.thoughts && data.solution) {
        setAiResponse(data);
      }
    }));
    removeListeners.push(window.api.on('initial-solution-error', (error) => {
      setIsStreaming(false);
      alert('Error: ' + error);
    }));
    removeListeners.push(window.api.on('streaming-update', (text) => {
      setStreamText(prev => prev + text);
    }));
    removeListeners.push(window.api.on('streaming-end', () => {
      setIsStreaming(false);
      parseStreamedResponse(streamText);
    }));
    removeListeners.push(window.api.on('shortcut-solve', () => {
      // This still has a stale closure issue, but it's not what the user reported.
      if (hasApiKey && screenshotArray.length > 0 && !isStreaming) {
        handleSolve();
      }
    }));

    return () => {
      removeListeners.forEach(remove => remove());
    };
  }, []); // Empty dependency array is crucial for correct behavior

  // Update global language variable when language changes
  useEffect(() => {
    window.__LANGUAGE__ = language;
  }, [language]);

  const parseStreamedResponse = (text) => {
    if (text && text.includes('# My Thoughts') && text.includes('# Solution')) {
      const thoughtsMatch = text.match(/# My Thoughts\n([\s\S]*?)(?=# Solution|$)/);
      const solutionMatch = text.match(/# Solution\n([\s\S]*?)$/);
      
      if (thoughtsMatch && solutionMatch) {
        setAiResponse({
          thoughts: thoughtsMatch[1].trim(),
          solution: solutionMatch[1].trim(),
          complexity: extractComplexity(text)
        });
      }
    }
  };

  const extractComplexity = (text) => {
    const complexityMatch = text.match(/# Complexity\n([\s\S]*?)(?=# |$)/);
    return complexityMatch ? complexityMatch[1].trim() : null;
  };

  const loadScreenshots = async () => {
    try {
      const result = await window.api.getScreenshots();
      if (result.success) {
        setScreenshots(result.previews);
      }
    } catch (error) {
      console.error('Error loading screenshots:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedLanguage = await window.api.getStorageValue('language');
      if (savedLanguage) {
        setLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleTakeScreenshot = async () => {
    try {
      if (window.api.takeFocus) await window.api.takeFocus();
      await window.api.takeScreenshot();
      setTimeout(() => {
        if (window.api.releaseFocus) window.api.releaseFocus();
      }, 100);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSolve = async () => {
    if (screenshotArray.length === 0) return;
    try {
      if (window.api.takeFocus) await window.api.takeFocus();
      setIsStreaming(true);
      setStreamText('');
      setAiResponse(null);
      
      const screenshotPaths = screenshotArray.map(s => s.path);
      await window.api.solve(screenshotPaths, language);
      
      setTimeout(() => {
        if (window.api.releaseFocus) window.api.releaseFocus();
      }, 100);
    } catch (error) {
      console.error('Error:', error);
      setIsStreaming(false);
    }
  };

  const handleStartOver = async () => {
    try {
      if (window.api.takeFocus) await window.api.takeFocus();
      await window.api.startOver();
      setScreenshots([]);
      setView('queue');
      setStreamText('');
      setIsStreaming(false);
      setAiResponse(null);
      setScreenshotArray([]);
      setTimeout(() => {
        if (window.api.releaseFocus) window.api.releaseFocus();
      }, 100);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const settingsPanelRef = useRef(null);

  const handleQuit = () => {
    window.api.quitApp();
  };

  const handleApiKeySubmit = async (e) => {
    if (e.key === 'Enter' && apiKeyInput.trim()) {
      const key = apiKeyInput.trim();
      await window.api.setApiKey(key);
      setApiKey(key);
      setHasApiKey(true);
      console.log('API key set for session and sent to main process.');
      
      try {
        await window.api.setClickThrough(true);
        console.log('Click-through enabled after API key submission');
      } catch (error) {
        console.error('Error enabling click-through:', error);
      }
    }
  };

  const handleSettingsHover = async () => {
    setSettingsPanelOpen(true);
    try {
      await window.api.setClickThrough(false);
    } catch (error) {
      console.error('Error disabling click-through:', error);
    }
  };

  const handleSettingsLeave = async () => {
    setSettingsPanelOpen(false);
    if (hasApiKey) {
      try {
        await window.api.setClickThrough(true);
      } catch (error) {
        console.error('Error enabling click-through:', error);
      }
    }
  };

  useEffect(() => {
    if (!settingsPanelOpen && hasApiKey) {
      const enableClickThrough = async () => {
        try {
          await window.api.setClickThrough(true);
        } catch (error) {
          console.error('Error ensuring click-through enabled:', error);
        }
      };
      enableClickThrough();
    }
  }, [settingsPanelOpen, hasApiKey]);

  return (
    <div className="pointer-events-none w-full h-full">
      <div className="min-h-[200px] overflow-visible">
        <div className="w-full">
          <div className="relative">
            {/* Command Bar */}
            <div className="pt-2 w-fit z-[1000] relative">
              <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-start gap-1 flex-nowrap">
                
                {!hasApiKey ? (
                  // API Key Input
                  <div className="flex items-center gap-3 pointer-events-auto">
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
                    <div className="flex gap-1">
                      <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">↵</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Take Screenshot */}
                    <div 
                      className="flex items-center gap-2 rounded px-2 py-1.5 pointer-events-auto cursor-pointer"
                      onClick={handleTakeScreenshot}
                    >
                      <span className="text-[11px] leading-none truncate">
                        {screenshotArray.length === 0 ? 'Take first screenshot' : 
                         screenshotArray.length === 1 ? 'Take second screenshot' : 
                         'Reset first screenshot'}
                      </span>
                      <div className="flex gap-1">
                        <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div>
                        <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">H</div>
                      </div>
                    </div>

                    {/* Start Over */}
                    <div 
                      className={`flex items-center gap-2 rounded px-2 py-1.5 ${screenshotArray.length > 0 ? 'pointer-events-auto cursor-pointer' : 'opacity-50'}`}
                      onClick={screenshotArray.length > 0 ? handleStartOver : undefined}
                    >
                      <span className="text-[11px] leading-none truncate">Start over</span>
                      <div className="flex gap-1">
                        <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div>
                        <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">G</div>
                      </div>
                    </div>

                    {/* Solve */}
                    <div 
                      className={`flex flex-col rounded px-2 py-1.5 ${screenshotArray.length > 0 && !isStreaming ? 'pointer-events-auto cursor-pointer' : 'opacity-50'}`}
                      onClick={screenshotArray.length > 0 && !isStreaming ? handleSolve : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] leading-none">
                          {isStreaming ? 'Solving...' : 'Solve'}
                        </span>
                        <div className="flex gap-1 ml-2">
                          <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div>
                          <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">↵</div>
                        </div>
                      </div>
                    </div>

                    {/* Show/Hide */}
                    <div className="flex items-center gap-2 rounded px-2 py-1.5 pointer-events-auto cursor-pointer">
                      <span className="text-[11px] leading-none">Show/Hide</span>
                      <div className="flex gap-1">
                        <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">Ctrl</div>
                        <div className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">B</div>
                      </div>
                    </div>

                    {/* Settings - Opens on hover, closes on mouse leave */}
                    <div 
                      className="flex items-center flex-shrink-0 relative" 
                      ref={settingsPanelRef}
                      onMouseLeave={handleSettingsLeave}
                    >
                      {/* Settings Icon */}
                      <div className="inline-block">
                        <div 
                          className="w-4 h-4 flex items-center justify-center text-white/70 hover:text-white/90 transition-colors pointer-events-auto cursor-pointer"
                          onMouseEnter={handleSettingsHover}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </div>
                      </div>

                      {/* Settings Panel - Positioned absolutely */}
                      {settingsPanelOpen && (
                        <div className="absolute top-0 right-0 z-50">
                          <Settings 
                            language={language}
                            setLanguage={setLanguage}
                            onClose={() => setSettingsPanelOpen(false)}
                            onQuit={handleQuit}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Screenshot Display */}
            {screenshotArray.length > 0 && (
              <div className="px-4 py-3">
                <div className="space-y-3 w-fit">
                  <div className="flex gap-4 interactive">
                    {screenshotArray.map((screenshot, index) => (
                      <div key={screenshot.id} className="border border-white relative w-[128px] h-[72px] group">
                        <div className="w-full h-full relative">
                          <img 
                            src={screenshot.preview}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 cursor-pointer interactive"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Response Display */}
      {(isStreaming || aiResponse || streamText) && (
        <div className="pointer-events-auto">
          <SolutionDisplay
            isStreaming={isStreaming}
            streamText={streamText}
            aiResponse={aiResponse}
            language={language}
          />
        </div>
      )}
    </div>
  );
}

export default MainPanel;
