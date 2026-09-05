import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RouterApp from './RouterApp';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterApp />
  </StrictMode>
);
