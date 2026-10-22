import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// The reload-once guard in index.html (for a stale cached index.html
// pointing at a deleted JS/CSS chunk) only needs to fire once per bad
// load - clear it once the app actually mounts so a later, unrelated
// stale-asset failure in this same tab can still trigger a reload.
try {
  sessionStorage.removeItem('gms-stale-asset-reload')
} catch {
  // ignore - sessionStorage can throw in private/locked-down browsing
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
