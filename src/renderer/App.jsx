import React, { useEffect, useState } from 'react';
import MainPanel from './MainPanel.jsx';

function App() {
  const [windowType, setWindowType] = useState('floating');

  useEffect(() => {
    // Detect window type from URL parameters or window properties
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('window') || 'floating';
    setWindowType(type);

    // Apply global styles based on window type
    if (type === 'floating') {
      document.body.style.backgroundColor = 'transparent';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.backgroundColor = 'transparent';
    }
  }, []);

  return (
    <div className={`App ${windowType === 'floating' ? 'floating-window' : ''}`}>
      <MainPanel windowType={windowType} />
    </div>
  );
}

export default App;