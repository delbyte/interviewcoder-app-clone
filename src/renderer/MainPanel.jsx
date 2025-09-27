import React, { useState, useEffect } from 'react';

function MainPanel() {
  const [screenshots, setScreenshots] = useState([]);
  const [view, setView] = useState('queue');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [language, setLanguage] = useState('python');

  useEffect(() => {
    // Load initial data
    loadScreenshots();
    loadSettings();

    // Set up IPC listeners
    const removeListeners = [];
    removeListeners.push(window.api.on('screenshot-taken', () => loadScreenshots()));
    removeListeners.push(window.api.on('start-over', () => {
      setScreenshots([]);
      setView('queue');
      setStreamText('');
    }));
    removeListeners.push(window.api.on('initial-start', () => setIsStreaming(true)));
    removeListeners.push(window.api.on('solution-success', (data) => {
      setView('solutions');
      setIsStreaming(false);
    }));
    removeListeners.push(window.api.on('initial-solution-error', (error) => {
      setIsStreaming(false);
      alert('Error: ' + error);
    }));
    removeListeners.push(window.api.on('streaming-update', (text) => {
      setStreamText(prev => prev + text);
    }));
    removeListeners.push(window.api.on('streaming-end', () => setIsStreaming(false)));

    return () => {
      removeListeners.forEach(remove => remove());
    };
  }, []);

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
      await window.api.showFloatingWindow();
      // The screenshot will be triggered by shortcut
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSolve = async () => {
    if (screenshots.length === 0) {
      alert('Please take at least one screenshot first');
      return;
    }
    try {
      setIsStreaming(true);
      setStreamText('');
      // This will trigger the processing
      // The actual solve is handled by IPC
    } catch (error) {
      console.error('Error:', error);
      setIsStreaming(false);
    }
  };

  const handleStartOver = async () => {
    try {
      await window.api.setStorageValue('language', language);
      setScreenshots([]);
      setView('queue');
      setStreamText('');
      setIsStreaming(false);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSettings = () => {
    window.api.openMainPanel();
  };

  const handleQuit = () => {
    window.api.quitApp();
  };

  return (
    <div className="min-h-screen bg-black/80 text-white p-4">
      {/* Command Bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 p-2 bg-black/60 rounded-lg">
          <button
            onClick={handleTakeScreenshot}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Take Screenshot (Ctrl+H)
          </button>
          <button
            onClick={handleSolve}
            disabled={isStreaming || screenshots.length === 0}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
          >
            {isStreaming ? 'Solving...' : 'Solve (Ctrl+Enter)'}
          </button>
          <button
            onClick={handleStartOver}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Start Over (Ctrl+G)
          </button>
          <button
            onClick={handleSettings}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            Settings
          </button>
          <button
            onClick={handleQuit}
            className="px-3 py-1 bg-red-800 hover:bg-red-900 rounded text-sm"
          >
            Quit
          </button>
        </div>
      </div>

      {/* Language Selector */}
      <div className="mb-4">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-gray-800 text-white px-3 py-1 rounded"
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>
      </div>

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-bold mb-2">Screenshots ({screenshots.length})</h3>
          <div className="grid grid-cols-2 gap-2">
            {screenshots.map((screenshot, index) => (
              <img
                key={index}
                src={screenshot.preview}
                alt={`Screenshot ${index + 1}`}
                className="w-full h-32 object-cover rounded border"
              />
            ))}
          </div>
        </div>
      )}

      {/* Streaming Response */}
      {isStreaming && (
        <div className="mb-4">
          <h3 className="text-lg font-bold mb-2">AI Response:</h3>
          <div className="bg-gray-800 p-4 rounded min-h-32 whitespace-pre-wrap">
            {streamText || 'Processing...'}
          </div>
        </div>
      )}

      {/* Solution Display */}
      {view === 'solutions' && !isStreaming && streamText && (
        <div className="mb-4">
          <h3 className="text-lg font-bold mb-2">Solution:</h3>
          <div className="bg-gray-800 p-4 rounded whitespace-pre-wrap">
            {streamText}
          </div>
        </div>
      )}
    </div>
  );
}

export default MainPanel;