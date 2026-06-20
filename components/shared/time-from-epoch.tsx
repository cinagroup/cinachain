import { HTMLAttributes, useEffect, useState } from "react"

interface TimeFromEpochProps extends HTMLAttributes<HTMLSpanElement> {
  epoch?: number | string
}

export const TimeFromEpoch = ({
  className,
  epoch,
  ...props
}: TimeFromEpochProps) => {
  const [timestamp, setTimestamp] = useState<string>()
  useEffect(() => {
    if (epoch) {
      const d = new Date(Number(epoch) * 1000)
      setTimestamp(d.toLocaleString())
    }
  }, [epoch])
  return (
    <span className={className} {...props}>
      {timestamp}
    </span>
  )
}

export default TimeFromEpoch
