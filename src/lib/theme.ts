/**
 * Dev-only theme toggle. Hidden from PMO users until redesign rollout.
 *
 * Enable in dev console:
 *   localStorage.setItem('altair-theme-toggle-enabled', '1'); location.reload()
 * Toggle:
 *   window.__altairToggleTheme()
 */
export function initThemeToggle(): void {
  if (localStorage.getItem('altair-theme-toggle-enabled') !== '1') return

  const apply = (theme: string) => {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }

  apply(localStorage.getItem('altair-theme') ?? 'dark')

  ;(window as unknown as { __altairToggleTheme: () => string }).__altairToggleTheme = () => {
    const next = localStorage.getItem('altair-theme') === 'light' ? 'dark' : 'light'
    localStorage.setItem('altair-theme', next)
    apply(next)
    console.log(`[altair] theme = ${next}`)
    return next
  }
}
