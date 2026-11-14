import { Bell, ShoppingBasket } from 'lucide-react'
import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import type { TabId } from './components/BottomNav'
import Layout from './components/Layout'
import PlaceholderScreen from './components/PlaceholderScreen'
import ReceiptScanner from './components/ReceiptScanner'

function App() {
  const [tab, setTab] = useState<TabId>('scanner')

  return (
    <AppProvider>
      <Layout tab={tab} onTabChange={setTab}>
        {/* Scanner stays mounted so an in-progress scan survives tab switches. */}
        <div hidden={tab !== 'scanner'}>
          <ReceiptScanner />
        </div>
        {tab === 'basket' && (
          <PlaceholderScreen
            icon={ShoppingBasket}
            title="basketTitle"
            description="basketDesc"
            featureNumber={2}
          />
        )}
        {tab === 'alerts' && (
          <PlaceholderScreen icon={Bell} title="alertsTitle" description="alertsDesc" featureNumber={3} />
        )}
      </Layout>
    </AppProvider>
  )
}

export default App
