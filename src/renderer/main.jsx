import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Set global variables for main process
window.__IS_INITIALIZED__ = true;
window.__LANGUAGE__ = 'python';
window.__AUTH_TOKEN__ = null; // No auth for clone

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)