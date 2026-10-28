import { Children, useState, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { A11y, Keyboard } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperCore } from 'swiper'
import { Icon } from '../Icon'
import 'swiper/css'

type ContentSwiperProps = {
  children: ReactNode
  emptyMessage: string
  label: string
  loading?: boolean
}

function LoadingCard() {
  return (
    <div aria-hidden="true" className="hm-swiper-skeleton rounded-lg border border-[#e5dfd2]">
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

export function ContentSwiper({ children, emptyMessage, label, loading = false }: ContentSwiperProps) {
  const prefersReducedMotion = useReducedMotion()
  const swiperRef = useRef<SwiperCore | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isBeginning, setIsBeginning] = useState(true)
  const [isEnd, setIsEnd] = useState(false)

  const content = Children.toArray(children)
  const slides = content.length ? content : loading ? [<LoadingCard key="1" />, <LoadingCard key="2" />, <LoadingCard key="3" />] : []

  if (!slides.length) {
    return (
      <div
        className="rounded-lg border border-dashed border-[#dcd7cc] bg-[#faf8f5] px-5 py-10 text-center text-xs font-light text-[#65716a]"
        role="status"
      >
        {emptyMessage}
      </div>
    )
  }

  const progressPercent = slides.length > 1 ? ((activeIndex + 1) / slides.length) * 100 : 100

  return (
    <div aria-label={label} className="relative w-full" role="region">
      {/* Slider viewport */}
      <Swiper
        a11y={{ containerMessage: label, itemRoleDescriptionMessage: 'slide' }}
        breakpoints={{
          0: { slidesPerView: 1.08, spaceBetween: 14 },
          640: { slidesPerView: 2.05, spaceBetween: 18 },
          1024: { slidesPerView: 3, spaceBetween: 20 },
        }}
        className="overflow-visible pb-3 pt-1"
        grabCursor
        keyboard={{ enabled: true, onlyInViewport: true }}
        modules={[A11y, Keyboard]}
        onInit={(swiper) => {
          swiperRef.current = swiper
          setIsBeginning(swiper.isBeginning)
          setIsEnd(swiper.isEnd)
        }}
        onSlideChange={(swiper) => {
          setActiveIndex(swiper.realIndex)
          setIsBeginning(swiper.isBeginning)
          setIsEnd(swiper.isEnd)
        }}
        slidesPerView={1.08}
        spaceBetween={14}
        watchOverflow
      >
        {slides.map((slide, index) => (
          <SwiperSlide className="h-auto" key={index}>
            <motion.div
              className="h-full"
              transition={{ damping: 24, stiffness: 320, type: 'spring' }}
              whileHover={prefersReducedMotion || loading ? undefined : { y: -4 }}
            >
              {slide}
            </motion.div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Creative bottom control strip */}
      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4 pt-1">
          {/* Progress bar + Slide counter */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-light tracking-wider text-[#65716a]">
              <strong className="font-medium text-[#1c2723]">
                {String(activeIndex + 1).padStart(2, '0')}
              </strong>
              <span className="text-[#a8b3ac]"> / {String(slides.length).padStart(2, '0')}</span>
            </span>

            {/* Continuous thin progress bar with pastel rainbow cosmetic gradient */}
            <div className="h-[2.5px] w-24 overflow-hidden rounded-full bg-[#e8e3d8] sm:w-36">
              <div
                className="h-full bg-gradient-to-r from-rose-300 via-amber-300 to-teal-400 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Clean sleek navigation buttons */}
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Previous slide"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#ded8ca] bg-white text-[#46534c] shadow-2xs transition-all hover:border-[#0f766e] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={isBeginning}
              onClick={() => swiperRef.current?.slidePrev()}
              type="button"
            >
              <span className="rotate-180 inline-block"><Icon name="arrow" /></span>
            </button>
            <button
              aria-label="Next slide"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#ded8ca] bg-white text-[#46534c] shadow-2xs transition-all hover:border-[#0f766e] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={isEnd}
              onClick={() => swiperRef.current?.slideNext()}
              type="button"
            >
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
