import { BrowserRouter } from 'react-router-dom'
import { CustomerAuthProvider } from './contexts/CustomerAuthContext'
import { CustomerLayout } from './layouts/CustomerLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <CustomerAuthProvider>
          <CustomerLayout />
        </CustomerAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
