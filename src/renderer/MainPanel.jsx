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
    // Load initial data
    const initializeApp = async () => {
      // First, always disable click-through during initialization
      try {
        await window.api.setClickThrough(false);
        console.log('Click-through disabled during initialization');
      } catch (error) {
        console.error('Error disabling click-through during initialization:', error);
      }

      const apiKeyResult = await window.api.getApiKey();
      if (apiKeyResult.success && apiKeyResult.apiKey) {
        setHasApiKey(true);
        try {
          await window.api.setClickThrough(true);
          console.log('Click-through enabled - API key available');
        } catch (error) {
          console.error('Error enabling click-through:', error);
        }
      } else {
        // Keep click-through disabled if no API key
        console.log('Click-through remains disabled - waiting for API key');
      }
      loadScreenshots();
      loadSettings();
    };

    initializeApp();

    // Set up IPC listeners
    const removeListeners = [];
    removeListeners.push(window.api.on('screenshot-taken', (newScreenshot) => {
      console.log('Received new screenshot in renderer');
      handleNewScreenshot(newScreenshot);
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
      // Parse the streamed response if needed
      parseStreamedResponse(streamText);
    }));
    removeListeners.push(window.api.on('shortcut-solve', () => {
      console.log('Shortcut-solve IPC message received');
      console.log('hasApiKey:', hasApiKey, 'screenshotArray.length:', screenshotArray.length, 'isStreaming:', isStreaming);
      // Handle Ctrl+Enter shortcut - same as clicking solve button
      if (hasApiKey && screenshotArray.length > 0 && !isStreaming) {
        console.log('Executing handleSolve() via shortcut');
        handleSolve();
      } else {
        console.log('Shortcut solve blocked - conditions not met');
      }
    }));

    return () => {
      removeListeners.forEach(remove => remove());
    };
  }, [streamText, hasApiKey]);

  // Update global language variable when language changes
  useEffect(() => {
    window.__LANGUAGE__ = language;
  }, [language]);

  const parseStreamedResponse = (text) => {
    // Try to parse the response into thoughts and solution sections
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

  // Handle new screenshot with cycling logic
  const handleNewScreenshot = (newScreenshot) => {
    if (!newScreenshot || !newScreenshot.preview) {
      console.error('Invalid screenshot data received');
      return;
    }
    setScreenshotArray(prev => {
      const newArray = [...prev];
      
      // If we already have 2 screenshots, remove the first one
      if (newArray.length >= 2) {
        newArray.shift();
      }
      
      // Add the new screenshot
      newArray.push({
        id: newScreenshot.id || Date.now(),
        preview: newScreenshot.preview,
      });
      
      return newArray;
    });
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
      // Temporarily take focus for screenshot action
      if (window.api.takeFocus) {
        await window.api.takeFocus();
      }
      await window.api.takeScreenshot();
      // Release focus after action
      setTimeout(() => {
        if (window.api.releaseFocus) {
          window.api.releaseFocus();
        }
      }, 100);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSolve = async () => {
    if (screenshotArray.length === 0) {
      return;
    }
    try {
      // Temporarily take focus for solve action
      if (window.api.takeFocus) {
        await window.api.takeFocus();
      }
      setIsStreaming(true);
      setStreamText('');
      setAiResponse(null);
      
      console.log("Solving with screenshots:", screenshotArray, "language:", language);
      await window.api.solve(screenshotArray, language);
      
      // Release focus after action
      setTimeout(() => {
        if (window.api.releaseFocus) {
          window.api.releaseFocus();
        }
      }, 100);
    } catch (error) {
      console.error('Error:', error);
      setIsStreaming(false);
    }
  };

  const handleStartOver = async () => {
    try {
      // Temporarily take focus for start over action
      if (window.api.takeFocus) {
        await window.api.takeFocus();
      }
      await window.api.startOver();
      setScreenshots([]);
      setView('queue');
      setStreamText('');
      setIsStreaming(false);
      setAiResponse(null);
      setScreenshotArray([]);
      // Release focus after action
      setTimeout(() => {
        if (window.api.releaseFocus) {
          window.api.releaseFocus();
        }
      }, 100);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Settings panel state - opens on hover, closes on outside click
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const settingsPanelRef = useRef(null);

  const handleQuit = () => {
    window.api.quitApp();
  };

  // Handle API key submission
  const handleApiKeySubmit = async (e) => {
    if (e.key === 'Enter' && apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setHasApiKey(true);
      console.log('API key set for session');
      
      // Enable click-through after API key is set
      try {
        await window.api.setClickThrough(true);
        console.log('Click-through enabled after API key submission');
      } catch (error) {
        console.error('Error enabling click-through:', error);
      }
    }
  };

  // Handle settings hover to open panel
  const handleSettingsHover = async () => {
    setSettingsPanelOpen(true);
    // Disable click-through when settings panel opens
    try {
      await window.api.setClickThrough(false);
      console.log('Click-through disabled for settings panel');
    } catch (error) {
      console.error('Error disabling click-through:', error);
    }
  };

  // Handle mouse leave from settings area to close panel
  const handleSettingsLeave = async () => {
    console.log('Mouse left settings area, closing panel...');
    setSettingsPanelOpen(false);
    // Only re-enable click-through when settings panel closes AND we have an API key
    if (hasApiKey) {
      try {
        await window.api.setClickThrough(true);
        console.log('Click-through re-enabled after mouse left settings');
      } catch (error) {
        console.error('Error enabling click-through:', error);
      }
    } else {
      console.log('Click-through remains disabled - no API key available');
    }
  };



  // Ensure click-through is properly managed when panel state changes
  useEffect(() => {
    if (!settingsPanelOpen && hasApiKey) {
      // Only enable click-through when panel is closed AND we have API key
      const enableClickThrough = async () => {
        try {
          await window.api.setClickThrough(true);
          console.log('Click-through ensured enabled when panel closed and API key available');
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
                        Take screenshot
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