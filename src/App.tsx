import { Bell } from 'lucide-react'
import { useState } from 'react'
import { isApiMode } from './api/client'
import { AppProvider } from './context/AppContext'
import AlertsContainer from './components/alerts/AlertsContainer'
import { useUnseenAlertCount } from './components/alerts/useUnseenAlertCount'
import AutoScanner from './components/AutoScanner'
import BasketContainer from './components/basket/BasketContainer'
import type { TabId } from './components/BottomNav'
import Layout from './components/Layout'
import BasketOptimizer from './components/optimizer/BasketOptimizer'
import PlaceholderScreen from './components/PlaceholderScreen'
import ReceiptScanner from './components/ReceiptScanner'

/**
 * Automatic mode (VITE_API_BASE set): the server scans, matches, saves and learns — no confirmation step,
 * plus the Basket Optimizer and Price Alerts. Without VITE_API_BASE the original local/manual app runs unchanged.
 */
function App() {
  const [tab, setTab] = useState<TabId>('scanner')
  const [unseenAlerts, refreshUnseen] = useUnseenAlertCount(isApiMode)

  return (
    <AppProvider>
      <Layout tab={tab} onTabChange={setTab} alertsBadge={isApiMode ? unseenAlerts : undefined}>
        {/* Scanner stays mounted so an in-progress scan survives tab switches. */}
        <div hidden={tab !== 'scanner'}>{isApiMode ? <AutoScanner onViewAlerts={() => setTab('alerts')} /> : <ReceiptScanner />}</div>
        {/* API mode uses the server optimiser; otherwise the in-browser Smart Basket Optimizer runs on the local data. */}
        {tab === 'basket' && (isApiMode ? <BasketContainer /> : <BasketOptimizer />)}
        {tab === 'alerts' &&
          (isApiMode ? <AlertsContainer onBadgeChange={refreshUnseen} /> : <PlaceholderScreen icon={Bell} title="alertsTitle" description="alertsDesc" featureNumber={3} />)}
      </Layout>
    </AppProvider>
  )
}

export default App
