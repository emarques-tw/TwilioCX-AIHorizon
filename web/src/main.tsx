import React from 'react';
import ReactDOM from 'react-dom/client';
import { Theme } from '@twilio-paste/core/theme';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme.Provider theme="default">
      <App />
    </Theme.Provider>
  </React.StrictMode>
);
