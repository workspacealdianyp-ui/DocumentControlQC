import { useEffect, useState } from 'react'

export function useCalendarDate() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer
    const update = () => {
      clearTimeout(timer)
      const date = new Date()
      setNow(date)
      const next = new Date(date)
      next.setHours(24, 0, 0, 50)
      timer = setTimeout(update, next.getTime() - date.getTime())
    }
    const onVisible = () => { if (document.visibilityState === 'visible') update() }
    update()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return now
}
