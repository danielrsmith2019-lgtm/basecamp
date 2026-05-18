'use client';

/**
 * TrainingLogTable — horizontal-scroll wrapper with sticky first column
 * on mobile. Renders a full data table for workout history.
 */
export default function TrainingLogTable({ columns, rows, className = '' }) {
  return (
    <div className={`training-log-table-wrap ${className}`}>
      <table className="training-log-table w-full">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key || i}
                className="text-left text-xs font-medium uppercase tracking-wider py-3 px-3 sm:px-4"
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  whiteSpace: 'nowrap',
                  ...(i === 0
                    ? {
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        background: 'var(--bg-primary, #0a0a0a)',
                      }
                    : {}),
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              className="transition-colors"
              style={{
                background:
                  rowIdx % 2 === 0
                    ? 'transparent'
                    : 'rgba(255,255,255,0.015)',
              }}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={col.key || colIdx}
                  className="py-3 px-3 sm:px-4 text-sm"
                  style={{
                    color:
                      colIdx === 0
                        ? '#ffffff'
                        : 'rgba(255,255,255,0.7)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    whiteSpace: 'nowrap',
                    fontWeight: colIdx === 0 ? 500 : 400,
                    ...(colIdx === 0
                      ? {
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          background: 'var(--bg-primary, #0a0a0a)',
                        }
                      : {}),
                  }}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-12 text-sm"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                No workouts logged yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}