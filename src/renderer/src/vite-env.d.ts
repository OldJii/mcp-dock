/// <reference types="vite/client" />

interface Window {
  electronAPI: import('./lib/electron').ElectronAPI;
}
