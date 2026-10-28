import { useEffect, useState } from 'react'
import { useCustomerAuth } from '../../contexts/customerAuth'
import { toggleWishlist, toggleWishlistService } from '../../utils/customerApi'
import {
  isGuestWishlisted,
  saveGuestWishlistItem,
  removeGuestWishlistItem,
} from '../../utils/wishlistStorage'
import { Icon } from '../Icon'

export interface WishlistButtonProps {
  id?: string
  tourId?: string // backward compatibility
  title?: string
  tourTitle?: string // backward compatibility
  image?: string
  tourImage?: string // backward compatibility
  duration?: string
  price?: number
  serviceType?: 'tour' | 'rental' | 'destination'
  className?: string
}

export function WishlistButton({
  id,
  tourId,
  title,
  tourTitle,
  image,
  tourImage,
  duration,
  price,
  serviceType = 'tour',
  className = '',
}: WishlistButtonProps) {
  const targetId = (id || tourId || '').trim()
  const targetTitle = title || tourTitle || 'Saved item'
  const targetImage = image || tourImage
  const { isAuthenticated } = useCustomerAuth()
  const [isInWishlist, setIsInWishlist] = useState(() => (targetId ? isGuestWishlisted(targetId, serviceType) : false))
  const [prevTarget, setPrevTarget] = useState({ targetId, serviceType })
  const [loading, setLoading] = useState(false)

  if (prevTarget.targetId !== targetId || prevTarget.serviceType !== serviceType) {
    setPrevTarget({ targetId, serviceType })
    setIsInWishlist(targetId ? isGuestWishlisted(targetId, serviceType) : false)
  }

  // Sync state from server when authenticated
  useEffect(() => {
    if (!targetId || !isAuthenticated) return
    let active = true

    async function checkStatus() {
      try {
        setLoading(true)
        if (serviceType === 'tour') {
          const result = await toggleWishlist({ tourId: targetId, action: 'check' })
          if (!active) return
          const serverIn = result.data?.data?.inWishlist ?? false
          setIsInWishlist(serverIn)
          if (serverIn) {
            saveGuestWishlistItem({
              id: targetId,
              service_type: serviceType,
              title: targetTitle,
              image: targetImage,
              duration,
              price,
            })
          }
        } else {
          const result = await toggleWishlistService({
            service_type: serviceType,
            service_id: targetId,
            action: 'check',
          })
          if (!active) return
          const serverIn = result.data?.data?.inWishlist ?? false
          setIsInWishlist(serverIn)
          if (serverIn) {
            saveGuestWishlistItem({
              id: targetId,
              service_type: serviceType,
              title: targetTitle,
              image: targetImage,
              duration,
              price,
            })
          }
        }
      } catch {
        // Keep local state
      } finally {
        if (active) setLoading(false)
      }
    }

    void checkStatus()
    return () => { active = false }
  }, [isAuthenticated, targetId, serviceType, targetTitle, targetImage, duration, price])

  // Listen to cross-component wishlist events
  useEffect(() => {
    function handleStorageUpdate() {
      if (targetId) {
        setIsInWishlist(isGuestWishlisted(targetId, serviceType))
      }
    }

    window.addEventListener('wishlist-updated', handleStorageUpdate)
    return () => window.removeEventListener('wishlist-updated', handleStorageUpdate)
  }, [targetId, serviceType])

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!targetId || loading) return

    const nextState = !isInWishlist
    setIsInWishlist(nextState)

    // 1. Always update local storage mirror for instant responsiveness & guest mode
    if (nextState) {
      saveGuestWishlistItem({
        id: targetId,
        service_type: serviceType,
        title: targetTitle,
        image: targetImage,
        duration,
        price,
      })
    } else {
      removeGuestWishlistItem(targetId, serviceType)
    }

    // 2. If authenticated, synchronize with backend
    if (isAuthenticated) {
      setLoading(true)
      try {
        if (serviceType === 'tour') {
          await toggleWishlist({ tourId: targetId, action: nextState ? 'add' : 'remove' })
        } else {
          await toggleWishlistService({
            service_type: serviceType,
            service_id: targetId,
            action: nextState ? 'add' : 'remove',
          })
        }
      } catch (error) {
        console.error('Failed to sync wishlist with server', error)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex min-h-8 min-w-8 items-center justify-center rounded-full border-2 transition-colors ${
        isInWishlist
          ? 'border-[#0f766e] bg-[#0f766e] text-white shadow-sm'
          : 'border-[#ded8ca] bg-white text-[#65716a] hover:border-[#0f766e] hover:text-[#0f766e]'
      } ${className}`}
      aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      type="button"
    >
      <span className="flex items-center justify-center">
        <Icon name={isInWishlist ? 'heart' : 'heart-outline'} />
      </span>
      <span className="sr-only">{isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}</span>
    </button>
  )
}