import {
  host,
  useValue,
  COMPOSER_AREAS
} from '@hermes/plugin-sdk'

import {
  useEffect,
  useState
} from 'react'

import {
  jsx
} from 'react/jsx-runtime'


function ContextMeter() {
  const sessionId = useValue(host.state.activeSessionId)

  const [usage, setUsage] = useState(null)
  const [failed, setFailed] = useState(false)


  useEffect(() => {
    if (!sessionId) {
      setUsage(null)
      setFailed(false)
      return
    }

    let alive = true

    async function refresh() {
      try {
        const result = await host.request(
          'session.context_breakdown',
          {
            session_id: sessionId
          }
        )

        if (alive) {
          setUsage(result)
          setFailed(false)
        }
      } catch (error) {
        console.warn(
          '[context-meter] context query failed',
          error
        )

        if (alive) {
          setFailed(true)
        }
      }
    }

    // Initial context value.
    refresh()

    // Refresh when generation/tool activity completes.
    const disposeMessage = host.onEvent(
      'message.complete',
      refresh
    )

    const disposeTool = host.onEvent(
      'tool.complete',
      refresh
    )

    // Low-frequency fallback in case an event is missed.
    // This is a local Hermes RPC, not a llama.cpp request.
    const timer = setInterval(
      refresh,
      15000
    )

    return () => {
      alive = false

      disposeMessage?.()
      disposeTool?.()

      clearInterval(timer)
    }
  }, [sessionId])


  if (!sessionId) {
    return null
  }


  if (!usage) {
    return jsx('span', {
      title: failed
        ? 'Context usage unavailable'
        : 'Reading context usage…',

      className:
        'px-1 text-[0.6875rem] ' +
        'tabular-nums text-(--ui-text-tertiary) ' +
        'select-none',

      children: failed
        ? '?'
        : '--'
    })
  }


  const used = Number(
    usage.context_used || 0
  )

  const max = Number(
    usage.context_max || 0
  )


  if (!max) {
    return jsx('span', {
      title:
        used > 0
          ? `${used.toLocaleString()} tokens used`
          : 'Context window unavailable',

      className:
        'px-1 text-[0.6875rem] ' +
        'tabular-nums text-(--ui-text-tertiary) ' +
        'select-none',

      children: '--'
    })
  }


  const percent = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        usage.context_percent != null
          ? Number(usage.context_percent)
          : (used / max) * 100
      )
    )
  )


  // Stay subtle normally and become more visible
  // only as the context window fills.
  let color = 'var(--ui-text-tertiary)'
  let opacity = 0.72

  if (percent >= 75) {
    color = 'var(--ui-text-secondary)'
    opacity = 0.9
  }

  if (percent >= 90) {
    color = 'var(--ui-warning, #d7a94a)'
    opacity = 1
  }

  if (percent >= 97) {
    color = 'var(--ui-danger, #df6b6b)'
    opacity = 1
  }


  return jsx('span', {
    title:
      `${used.toLocaleString()} / ` +
      `${max.toLocaleString()} tokens`,

    className:
      'px-1 text-[0.6875rem] ' +
      'tabular-nums select-none',

    style: {
      color,
      opacity
    },

    children: `CTX ${percent}%`
  })
}


export default {
  id: 'context-meter',
  name: 'Context Meter',
  defaultEnabled: true,

  register(ctx) {
    ctx.register({
      id: 'composer-context',

      area: COMPOSER_AREAS.actions,

      order: 90,

      render: () =>
        jsx(ContextMeter, {})
    })
  }
}