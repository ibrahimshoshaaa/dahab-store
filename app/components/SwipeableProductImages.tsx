"use client"

import { useRef, useState } from "react"
import Image from "next/image"

export default function SwipeableProductImages({
  images,
  alt,
  imgClassName = "",
}: {
  images: string[]
  alt: string
  imgClassName?: string
}) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const dragged = useRef(false)

  const safeImages = images.filter(Boolean)

  function goTo(nextIndex: number) {
    const total = safeImages.length
    setIndex(((nextIndex % total) + total) % total)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    dragged.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.touches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 8) dragged.current = true
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 35

    if (delta < -threshold) goTo(index + 1)
    else if (delta > threshold) goTo(index - 1)

    if (dragged.current) e.preventDefault()
    touchStartX.current = null
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (dragged.current) {
      e.preventDefault()
      e.stopPropagation()
      dragged.current = false
    }
  }

  return (
    <div
      className="relative h-full w-full touch-pan-y select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClickCapture={handleClickCapture}
    >
      <Image
        src={safeImages[index]}
        alt={alt}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className={imgClassName}
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {safeImages.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
          />
        ))}
      </div>
    </div>
  )
}
