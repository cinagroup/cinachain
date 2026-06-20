import { HTMLAttributes, useEffect, useState } from "react"

interface TimeFromUtcProps extends HTMLAttributes<HTMLSpanElement> {
  date: string
}

export const TimeFromUtc = ({
  className,
  date,
  ...props
}: TimeFromUtcProps) => {
  const [timestamp, setTimestamp] = useState<string>()
  useEffect(() => {
    if (date) {
      const d = new Date(date)
      setTimestamp(d.toLocaleString())
    }
  }, [date])
  return (
    <span className={className} {...props}>
      {timestamp}
    </span>
  )
}

export default TimeFromUtc
