import type { ReactNode, ThHTMLAttributes, HTMLAttributes } from 'react'

interface DataTableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

export function DataTable({ children, className, ...rest }: DataTableProps) {
  return <table className={['ui-table', className].filter(Boolean).join(' ')} {...rest}>{children}</table>
}

interface DataHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
  sortable?: boolean
  sortDirection?: 'asc' | 'desc' | null
}

export function DataHeaderCell({ children, sortable, sortDirection, className, ...rest }: DataHeaderCellProps) {
  const classes = [sortable && 'ui-table__col-sortable', className].filter(Boolean).join(' ')
  return (
    <th className={classes} {...rest}>
      {children}
      {sortable && (
        <span className={[
          'ui-table__sort-icon',
          sortDirection === 'desc' && 'ui-table__sort-icon--desc',
          !sortDirection && 'ui-table__sort-icon--idle',
        ].filter(Boolean).join(' ')}>↑</span>
      )}
    </th>
  )
}
