"use client"

import Image from "next/image"
import { useState } from "react"
import { getIpfsImageSources } from "@/lib/ipfs"

type Props = {
  ipfsCidUrl: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
}

/**
 * NFT 图片组件，内置多网关自动降级
 * 当主网关 ipfs.cinachain.com 加载失败时，自动切换备用网关
 */
export default function CinaNftImage({
  ipfsCidUrl,
  alt,
  fill = true,
  width,
  height,
  className,
}: Props) {
  const sourceList = getIpfsImageSources(ipfsCidUrl)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleImageError = () => {
    if (activeIndex < sourceList.length - 1) {
      setActiveIndex((prev) => prev + 1)
    }
  }

  return (
    <Image
      src={sourceList[activeIndex]}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes="(max-width:768px) 100vw, 420px"
      onError={handleImageError}
      className={className}
      unoptimized
    />
  )
}
