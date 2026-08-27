import { useEffect, useRef, useState } from 'react'

/* Watches a zero-height sentinel and reports whether it has passed above
   the top of the viewport. Used to swap a sticky toolbar out for the
   sticky table header underneath it.

   An observer rather than a scroll listener: nothing runs per frame, and
   the browser only wakes us on the one crossing we care about. */
export function useStuck(rootMargin = '0px') {
  const sentinel = useRef(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0),
      { rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return [sentinel, stuck]
}

