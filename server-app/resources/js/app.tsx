import '../css/app.css';
import '@mantine/core/styles.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { useState, useCallback, useContext, createContext } from 'react';
import { AuthProvider } from './context/AuthContext';
import echo from './lib/echo';

if (typeof window !== 'undefined') {
  (window as any).Echo = echo;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Simple notification system
interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
}

const NotificationContext = createContext<{
  notifications: Notification[]
  addNotification: (message: string, type: string) => void
  removeNotification: (id: string) => void
}>({
  notifications: [],
  addNotification: () => {},
  removeNotification: () => {}
})

const useNotifications = () => {
  return useContext(NotificationContext)
}

// Export hook for components
export const useAppNotifications = () => {
  const { addNotification } = useContext(NotificationContext)
  return addNotification
}

// Global notification function
if (typeof window !== 'undefined') {
  ;(window as any).showNotification = (message: string, type: string = 'info') => {
    console.log(`${type}: ${message}`)
    // This will be overridden when components use the hook
  }
}

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((message: string, type: string) => {
    const id = Date.now().toString()
    const notificationType = type || 'info'
    
    const notification: Notification = {
      id,
      type: notificationType as any,
      title: notificationType === 'success' ? 'Success' : notificationType === 'error' ? 'Error' : notificationType === 'warning' ? 'Warning' : 'Information',
      message
    }

    setNotifications(prev => [...prev, notification])

    // Auto remove after 5 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 5000)
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications()

  const getStyles = (type: string) => {
    const baseStyles = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg max-w-sm z-50 transform transition-all duration-300'
    
    const typeStyles = {
      success: 'bg-green-100 border border-green-400 text-green-700',
      error: 'bg-red-100 border border-red-400 text-red-700',
      info: 'bg-blue-100 border border-blue-400 text-blue-700',
      warning: 'bg-yellow-100 border border-yellow-400 text-yellow-700'
    }

    return `${baseStyles} ${typeStyles[type as keyof typeof typeStyles]}`
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={getStyles(notification.type)}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-sm">{notification.title}</h4>
              <p className="text-sm mt-1">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

createInertiaApp({
    title: (title) => title ? `${title} - ${appName}` : appName,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <MantineProvider>
                <AuthProvider>
                    <NotificationProvider>
                        <App {...props} />
                    </NotificationProvider>
                </AuthProvider>
            </MantineProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});
