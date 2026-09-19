import dynamic from "next/dynamic"
import Image from "next/image"

const SwipeableProductImages = dynamic(() => import("./SwipeableProductImages"))

export default function ProductCardImages({
  images,
  alt,
  imgClassName = "",
}: {
  images: string[]
  alt: string
  imgClassName?: string
}) {
  const safeImages = images.filter(Boolean)

  if (safeImages.length === 0) {
    return <div className="h-full w-full bg-[var(--surface)]" aria-label={alt} />
  }

  if (safeImages.length === 1) {
    return (
      <Image
        src={safeImages[0]}
        alt={alt}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className={imgClassName}
      />
    )
  }

  return (
    <SwipeableProductImages
      images={safeImages}
      alt={alt}
      imgClassName={imgClassName}
    />
  )
}
