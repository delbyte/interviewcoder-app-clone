import React, { useState, useEffect, useRef } from 'react';

function Settings({ language, setLanguage, onClose, onQuit }) {
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const languages = [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
  ];

  const shortcuts = [
    {
      name: 'Toggle Window',
      keys: ['Ctrl', 'B'],
      description: 'Show or hide this window.'
    },
    {
      name: 'Take Screenshot',
      keys: ['Ctrl', 'H'],
      description: 'Take a screenshot of the problem description.'
    },
    {
      name: 'Start Over',
      keys: ['Ctrl', 'G'],
      description: 'Reset the current problem and start over.'
    },
    {
      name: 'Move Window',
      keys: ['Ctrl', '↑↓←→'],
      description: 'Move the window around the screen using arrow keys.'
    },
    {
      name: 'Solve',
      keys: ['Ctrl', '↵'],
      description: 'Generate a solution based on the current problem.'
    }
  ];

  const handleLanguageSelect = (langValue) => {
    setLanguage(langValue);
    setIsLanguageDropdownOpen(false);
    // Release focus after selection
    if (window.api && window.api.releaseFocus) {
      window.api.releaseFocus();
    }
  };

  const handleLanguageButtonClick = () => {
    // Take focus when clicking language button
    if (window.api && window.api.takeFocus) {
      window.api.takeFocus();
    }
    setIsLanguageDropdownOpen(!isLanguageDropdownOpen);
  };

  const handleTryLeetCode = () => {
    // Open LeetCode in browser
    if (window.api && window.api.openExternal) {
      window.api.openExternal('https://leetcode.com');
    }
  };

  const handleLogout = () => {
    // For now, just close the app since we don't have auth
    onQuit();
  };

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (isLanguageDropdownOpen) {
          setIsLanguageDropdownOpen(false);
          // Release focus when clicking outside
          if (window.api && window.api.releaseFocus) {
            window.api.releaseFocus();
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLanguageDropdownOpen]);

  return (
    <div className="fixed z-[10000] transition-opacity duration-200" 
         style={{ top: '12px', left: '285.859px', opacity: 1 }}>
      <div className="w-80 p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg pointer-events-auto">
        <div className="space-y-4">
          {/* Keyboard Shortcuts Section */}
          <h3 className="font-medium whitespace-nowrap">Keyboard Shortcuts</h3>
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="rounded px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="truncate">{shortcut.name}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span 
                        key={keyIndex}
                        className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                  {shortcut.description}
                </p>
              </div>
            ))}
          </div>

          {/* Settings Section */}
          <div className="pt-3 mt-3 border-t border-white/10">
            <div>
              {/* Language Selector */}
              <div className="mb-3 px-2 space-y-1">
                <div className="flex items-center justify-between text-[13px] font-medium text-white/90">
                  <span>Language</span>
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      className="flex items-center justify-between bg-white/10 rounded px-3 py-1.5 text-sm outline-none border border-white/10 focus:border-white/20 min-w-[100px] w-auto hover:bg-white/20 transition-colors"
                      onClick={handleLanguageButtonClick}
                    >
                      <span className="whitespace-nowrap">
                        {languages.find(lang => lang.value === language)?.label || 'Python'}
                      </span>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className={`lucide lucide-chevron-down text-white/70 ml-2 flex-shrink-0 transition-transform duration-200 ${isLanguageDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
                      >
                        <path d="m6 9 6 6 6-6"></path>
                      </svg>
                    </button>

                    {/* Language Dropdown */}
                    {isLanguageDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-black/90 border border-white/10 rounded shadow-lg z-50">
                        {languages.map((lang) => (
                          <div
                            key={lang.value}
                            className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm transition-colors"
                            onClick={() => handleLanguageSelect(lang.value)}
                          >
                            {lang.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-2 text-[11px] text-white/70 mt-3 mb-1">
                <div className="w-4 h-4 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <span className="truncate">Using local API integration</span>
              </div>

              {/* Action Buttons */}
              <button 
                className="flex items-center gap-2 text-[11px] text-white/80 hover:text-white transition-colors w-full cursor-pointer mb-1 py-1"
                onClick={handleTryLeetCode}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                    <path d="M9 9h6v6H9z"></path>
                  </svg>
                </div>
                Try with LeetCode Problem
              </button>

              <button 
                className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 transition-colors w-full cursor-pointer mb-1 py-1"
                onClick={handleLogout}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </div>
                Log Out
              </button>

              <button 
                className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-white transition-colors w-full cursor-pointer py-1"
                onClick={onQuit}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <path d="M18 6L6 18"></path>
                    <path d="M6 6l12 12"></path>
                  </svg>
                </div>
                Quit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;