import React, { useState, useEffect } from 'react';
import Settings from './Settings';
import SolutionDisplay from './SolutionDisplay';

function MainPanel({ windowType = 'floating' }) {
  const [screenshots, setScreenshots] = useState([]);
  const [view, setView] = useState('queue');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [language, setLanguage] = useState('python');
  const [showSettings, setShowSettings] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [screenshotArray, setScreenshotArray] = useState([]); // Max 2 screenshots

  useEffect(() => {
    // Load initial data
    loadScreenshots();
    loadSettings();
    
    // Ensure click-through mode is enabled on startup
    if (window.api && window.api.setClickThrough) {
      window.api.setClickThrough(true);
    }

    // Set up IPC listeners
    const removeListeners = [];
    removeListeners.push(window.api.on('screenshot-taken', (screenshotData) => {
      loadScreenshots();
      handleNewScreenshot(screenshotData);
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

    return () => {
      removeListeners.forEach(remove => remove());
    };
  }, [streamText]);

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
  const handleNewScreenshot = async (screenshotData) => {
    try {
      // Get the latest screenshot data
      const result = await window.api.getScreenshots();
      if (result.success && result.previews.length > 0) {
        const newScreenshot = result.previews[result.previews.length - 1];
        
        setScreenshotArray(prev => {
          const newArray = [...prev];
          
          // If we already have 2 screenshots, remove the first one
          if (newArray.length >= 2) {
            newArray.shift(); // Remove first screenshot
          }
          
          // Add the new screenshot
          newArray.push({
            id: Date.now(),
            preview: newScreenshot.preview,
            path: newScreenshot.path
          });
          
          return newArray;
        });
      }
    } catch (error) {
      console.error('Error handling new screenshot:', error);
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

  // Simple hover handlers
  const handleSettingsEnter = () => {
    setShowSettings(true);
  };

  const handleSettingsLeave = () => {
    setShowSettings(false);
  };

  const handleQuit = () => {
    window.api.quitApp();
  };

  return (
    <div className="pointer-events-none w-full h-full">
      <div className="min-h-[200px] overflow-visible">
        <div className="w-full">
          <div className="relative">
            {/* Command Bar */}
            <div className="pt-2 w-fit z-[1000] relative">
              <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-start gap-1 flex-nowrap">
                
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

                {/* Settings Icon (NO HOVER LOGIC) */}
                <div className="flex items-center flex-shrink-0">
                  <div className="w-4 h-4 flex items-center justify-center text-white/70">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </div>
                </div>

                {/* Settings Hover Bounding Box - Square size of main bar height */}
                <div 
                  className="absolute right-0 top-0 w-10 h-full pointer-events-auto"
                  onMouseEnter={handleSettingsBoundingBoxEnter}
                />
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div
                onMouseLeave={handleSettingsPanelLeave}
              >
                <Settings 
                  language={language}
                  setLanguage={setLanguage}
                  onClose={() => {
                    setShowSettings(false);
                    setHasEnteredSettingsPanel(false);
                  }}
                  onQuit={handleQuit}
                />
              </div>
            )}

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