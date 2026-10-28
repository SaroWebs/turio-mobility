import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning' | undefined, title?: string) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }, [])

  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' | undefined, title?: string) => {
    const id = Date.now().toString()
    const notificationType = type || 'info'
    
    const notification: Notification = {
      id,
      type: notificationType,
      title: title || (notificationType === 'success' ? 'Success' : notificationType === 'error' ? 'Error' : notificationType === 'warning' ? 'Warning' : 'Information'),
      message
    }

    setNotifications(prev => [...prev, notification])

    // Auto remove after 5 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 5000)
  }, [removeNotification])

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; type?: Notification['type']; title?: string }>).detail
      if (detail?.message) addNotification(detail.message, detail.type, detail.title)
    }
    window.addEventListener('app:notification', handleNotification)
    return () => window.removeEventListener('app:notification', handleNotification)
  }, [addNotification])

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications()

  const getNotificationStyles = (type: string) => {
    const baseStyles = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg max-w-sm z-50 transform transition-all duration-300 translate-x-0'
    
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
          className={getNotificationStyles(notification.type)}
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

// Export a function to show notifications globally
export const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:notification', {
      detail: { message, type },
    }))
  }
}

export default Notification
