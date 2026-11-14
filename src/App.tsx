import { useState } from 'react'
import { isApiMode } from './api/client'
import { AppProvider } from './context/AppContext'
import AlertsContainer from './components/alerts/AlertsContainer'
import PriceAlerts from './components/alerts/PriceAlerts'
import { useAlertTrigger } from './components/alerts/useAlertTrigger'
import { useLocalUnseenAlertCount } from './components/alerts/useLocalUnseenAlertCount'
import { useUnseenAlertCount } from './components/alerts/useUnseenAlertCount'
import AutoScanner from './components/AutoScanner'
import BasketContainer from './components/basket/BasketContainer'
import type { TabId } from './components/BottomNav'
import Layout from './components/Layout'
import BasketOptimizer from './components/optimizer/BasketOptimizer'
import ReceiptScanner from './components/ReceiptScanner'

/**
 * Automatic mode (VITE_API_BASE set): the server scans, matches, saves and learns — no confirmation step,
 * plus the Basket Optimizer and Price Alerts. Without VITE_API_BASE the original local/manual app runs, with the
 * Basket Optimizer and Price Alerts evaluated in the browser on the local data.
 */
function AppShell() {
  const [tab, setTab] = useState<TabId>('scanner')
  const [serverUnseen, refreshUnseen] = useUnseenAlertCount(isApiMode)
  const [localUnseen] = useLocalUnseenAlertCount(!isApiMode)
  // Always mounted (not only on the Alerts tab) so a scan in Feature 1 fires alerts and updates the badge instantly.
  useAlertTrigger(!isApiMode)

  return (
    <Layout tab={tab} onTabChange={setTab} alertsBadge={isApiMode ? serverUnseen : localUnseen}>
      {/* Scanner stays mounted so an in-progress scan survives tab switches. */}
      <div hidden={tab !== 'scanner'}>{isApiMode ? <AutoScanner onViewAlerts={() => setTab('alerts')} /> : <ReceiptScanner />}</div>
      {/* API mode uses the server optimiser; otherwise the in-browser Smart Basket Optimizer runs on the local data. */}
      {tab === 'basket' && (isApiMode ? <BasketContainer /> : <BasketOptimizer />)}
      {tab === 'alerts' && (isApiMode ? <AlertsContainer onBadgeChange={refreshUnseen} /> : <PriceAlerts />)}
    </Layout>
  )
}

function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}

export default App
