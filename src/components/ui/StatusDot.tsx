interface StatusDotProps {
  color: string
  alwaysHalo?: boolean
  ariaLabel?: string
}

export function StatusDot({ color, alwaysHalo = false, ariaLabel }: StatusDotProps) {
  return (
    <span
      className={`ui-statusdot${alwaysHalo ? ' ui-statusdot--always-halo' : ''}`}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      <span className="ui-statusdot__halo" style={{ background: color }} />
      <span className="ui-statusdot__core" style={{ background: color }} />
    </span>
  )
}
