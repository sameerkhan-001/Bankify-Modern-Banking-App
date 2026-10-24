import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startSmoothScroll } from './utils/smoothScroll.js';
import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/pages.css';

startSmoothScroll();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
