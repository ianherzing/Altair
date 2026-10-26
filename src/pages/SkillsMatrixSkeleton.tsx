import { PageTitle } from '../components/ui'

/* Loading skeleton shaped like the Skills matrix (sticky-ish header + swatch-grid
   rows). Lives in src/pages (not src/components) so it can ship with the page;
   rendered inline on `loading`. */
const SK_SKILLS = 11

export function SkillsMatrixSkeleton() {
  const skRows = typeof window !== 'undefined'
    ? Math.max(14, Math.ceil((window.innerHeight - 200) / 48))
    : 16
  return (
    <div className="skm">
      <div className="skm-head">
        <div className="skm-titlewrap">
          <PageTitle title="Skills & Passion Areas" style={{ margin: 0 }} />
          <div className="skm-sk skm-sk--shimmer skm-sk-info" />
        </div>
      </div>

      <div className="skm-sk-filters">
        <div className="skm-sk skm-sk--shimmer skm-sk-tool" />
        <div className="skm-sk skm-sk--shimmer skm-sk-tool" />
        <div className="skm-sk skm-sk--shimmer skm-sk-tool sm" />
        <div className="skm-sk skm-sk--shimmer skm-sk-tool sm" />
        <div className="skm-sk-legend">
          <div className="skm-sk skm-sk--shimmer skm-sk-leg" />
          <div className="skm-sk skm-sk--shimmer skm-sk-leg" />
          <div className="skm-sk skm-sk--shimmer skm-sk-leg" />
        </div>
      </div>

      <div className="skm-sk-matrix">
        <div className="skm-sk-mhead">
          <div className="skm-sk-cn"><div className="skm-sk skm-sk--shimmer skm-sk-hh" /></div>
          <div className="skm-sk-cu"><div className="skm-sk skm-sk--shimmer skm-sk-hh" style={{ width: 36 }} /></div>
          <div className="skm-sk-cp"><div className="skm-sk skm-sk--shimmer skm-sk-hh" style={{ width: 80 }} /></div>
          {Array.from({ length: SK_SKILLS }).map((_, i) => (
            <div className="skm-sk-cs" key={i}><div className="skm-sk skm-sk--shimmer skm-sk-hsk" /></div>
          ))}
        </div>
        {Array.from({ length: skRows }).map((_, r) => (
          <div className={`skm-sk-mrow${r % 2 ? ' z' : ''}`} key={r}>
            <div className="skm-sk-cn" style={{ paddingBottom: 0, alignItems: 'center', height: 48 }}>
              <div className="skm-sk-nm">
                <div className="skm-sk skm-sk--shimmer skm-sk-l1" />
                <div className="skm-sk skm-sk--shimmer skm-sk-l2" />
                <div className="skm-sk skm-sk--shimmer skm-sk-l3" />
              </div>
            </div>
            <div className="skm-sk-cellbox"><div className="skm-sk skm-sk--shimmer skm-sk-uval" /></div>
            <div className="skm-sk-pbox"><div className="skm-sk skm-sk--shimmer skm-sk-pval" /></div>
            {Array.from({ length: SK_SKILLS }).map((_, c) => (
              <div className="skm-sk-cellbox" key={c}>
                {(r * 7 + c * 3) % 9 < 5 ? <div className="skm-sk skm-sk--shimmer skm-sk-swatch" /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
