import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { resolveVariant } from '../../lib/variants';

/**
 * ════════════════════════════════════════════════════════════
 * KUMO-STYLE CHARTS
 * SVG-based chart components with semantic tokens.
 * Inspired by @cloudflare/kumo statistical visualization patterns.
 * ════════════════════════════════════════════════════════════
 */

/** Chart color palette using kumo semantic tokens */
const CHART_COLORS = [
  'var(--kumo-brand)',
  'var(--kumo-info)',
  'var(--kumo-success)',
  'var(--kumo-warning)',
  'var(--kumo-danger)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
];

const CHART_LIGHT_COLORS = [
  'var(--kumo-brand)/15',
  'var(--kumo-info)/15',
  'var(--kumo-success)/15',
  'var(--kumo-warning)/15',
  'var(--kumo-danger)/15',
  '#8b5cf6/15',
  '#ec4899/15',
  '#14b8a6/15',
  '#f97316/15',
  '#6366f1/15',
];

/** @type {const} */
export const KUMO_CHART_VARIANTS = {
  size: {
    sm: { classes: '', height: 140, fontSize: 10, barWidth: 16, gap: 6 },
    base: { classes: '', height: 200, fontSize: 11, barWidth: 24, gap: 8 },
    lg: { classes: '', height: 280, fontSize: 12, barWidth: 32, gap: 10 },
  },
};

export const KUMO_CHART_DEFAULT_VARIANTS = {
  size: 'base',
};

function useChartSize(size) {
  return resolveVariant(KUMO_CHART_VARIANTS.size, size ?? KUMO_CHART_DEFAULT_VARIANTS.size, KUMO_CHART_DEFAULT_VARIANTS.size);
}

function formatNumber(n, compact) {
  if (!compact) return String(n);
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

/* ────────────────── BarChart ────────────────── */

/**
 * Kumo-style Bar Chart.
 *
 * @example
 * ```jsx
 * <BarChart
 *   data={[{ label: '中国', value: 42 }, { label: '日本', value: 18 }]}
 *   size="base"
 *   showValues
 * />
 * ```
 *
 * @param {{
 *   data: {label: string, value: number, color?: string}[]
 *   className?: string
 *   size?: 'sm' | 'base' | 'lg'
 *   showValues?: boolean
 *   horizontal?: boolean
 *   maxValue?: number
 *   colorScheme?: 'default' | 'single'
 *   singleColor?: string
 * }} props
 */
export function BarChart({
  data,
  className,
  size,
  showValues = true,
  horizontal = false,
  maxValue: maxValOverride,
  colorScheme = 'default',
  singleColor = 'var(--kumo-brand)',
}) {
  const s = useChartSize(size);
  const padding = { top: 8, right: showValues ? 40 : 16, bottom: 24, left: 4 };

  const maxValue = maxValOverride ?? Math.max(...data.map((d) => d.value), 1);
  const innerWidth = 600;
  const innerHeight = s.height - padding.top - padding.bottom;

  return (
    <div data-kumo-component="Chart" data-kumo-chart="BarChart" className={cn('tw-w-full tw-overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 600 ${s.height}`}
        className="tw-w-full"
        style={{ minWidth: 280, height: s.height }}
        role="img"
        aria-label="Bar chart"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padding.top + innerHeight * (1 - pct);
          return (
            <g key={pct}>
              <line x1={padding.left} x2={600 - padding.right} y1={y} y2={y} stroke="var(--kumo-hairline)" strokeWidth="0.5" />
              <text x={600 - padding.right + 4} y={y + 3} fontSize={10} fill="var(--kumo-muted)" textAnchor="start">
                {Math.round(maxValue * pct)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, i) => {
          const bw = s.barWidth;
          const gap = s.gap;
          const totalWidth = data.length * (bw + gap) - gap;
          const startX = (600 - totalWidth) / 2;
          const x = startX + i * (bw + gap);
          const barH = (item.value / maxValue) * innerHeight;
          const y = padding.top + innerHeight - barH;
          const color = colorScheme === 'single' ? singleColor : item.color ?? CHART_COLORS[i % CHART_COLORS.length];

          return (
            <g key={item.label + i}>
              <rect
                x={x}
                y={y}
                width={bw}
                height={Math.max(barH, 1)}
                rx={3}
                fill={color}
                opacity={0.85}
              >
                <title>{item.label}: {item.value}</title>
              </rect>
              {showValues && (
                <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize={s.fontSize} fill="var(--kumo-subtle)" fontWeight={500}>
                  {item.value}
                </text>
              )}
              <text x={x + bw / 2} y={s.height - 6} textAnchor="middle" fontSize={s.fontSize} fill="var(--kumo-subtle)">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ────────────────── PieChart / DonutChart ────────────────── */

/**
 * Kumo-style Pie / Donut Chart.
 *
 * @example
 * ```jsx
 * <PieChart data={[{ label: '中国', value: 42 }, { label: '日本', value: 18 }]} />
 * <DonutChart data={[...]} size="lg" showLegend />
 * ```
 *
 * @param {{
 *   data: {label: string, value: number, color?: string}[]
 *   className?: string
 *   size?: 'sm' | 'base' | 'lg'
 *   donut?: boolean
 *   donutWidth?: number
 *   showLegend?: boolean
 *   showValues?: boolean
 * }} props
 */
export function PieChart({
  data,
  className,
  size,
  donut = false,
  donutWidth = 28,
  showLegend = true,
  showValues = true,
}) {
  const s = useChartSize(size);
  const cx = 180;
  const cy = s.height / 2;
  const outerR = Math.min(cx - 30, s.height / 2 - 20);
  const innerR = donut ? outerR - donutWidth : 0;

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  const arcs = useMemo(() => {
    let cumulative = 0;
    return data.map((item, i) => {
      const startAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
      const sliceAngle = (item.value / total) * Math.PI * 2;
      cumulative += item.value;

      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(startAngle + sliceAngle);
      const y2 = cy + outerR * Math.sin(startAngle + sliceAngle);
      const x1i = innerR ? cx + innerR * Math.cos(startAngle) : cx;
      const y1i = innerR ? cy + innerR * Math.sin(startAngle) : cy;
      const x2i = innerR ? cx + innerR * Math.cos(startAngle + sliceAngle) : cx;
      const y2i = innerR ? cy + innerR * Math.sin(startAngle + sliceAngle) : cy;

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const color = item.color ?? CHART_COLORS[i % CHART_COLORS.length];
      const pct = total ? ((item.value / total) * 100).toFixed(1) : '0';

      return { ...item, largeArc, color, d: innerR
        ? `M ${x1i} ${y1i} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x2i} ${y2i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i} ${y1i} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        pct, index: i };
    });
  }, [data, total, cx, cy, outerR, innerR]);

  const legendWidth = showLegend ? 160 : 0;
  const totalWidth = 360 + legendWidth;

  return (
    <div data-kumo-component="Chart" data-kumo-chart={donut ? 'DonutChart' : 'PieChart'} className={cn('tw-w-full', className)}>
      <svg viewBox={`0 0 ${totalWidth} ${s.height}`} className="tw-w-full" style={{ height: s.height }} role="img">
        {/* Center label for donut */}
        {donut && (
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--kumo-default)">
            {total}
          </text>
        )}
        {donut && (
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--kumo-muted)}>总计</text>
        )}

        {arcs.map((arc) => (
          <g key={arc.label + arc.index}>
            <path d={arc.d} fill={arc.color} opacity={0.82} stroke="var(--kumo-base)" strokeWidth={1.5}>
              <title>{arc.label}: {arc.value} ({arc.pct}%)</title>
            </path>
          </g>
        ))}

        {/* Legend */}
        {showLegend && (
          <g transform={`translate(${360}, ${donutWidth + 6})`}>
            {arcs.slice(0, 8).map((arc, i) => (
              <g key={arc.label + i} transform={`translate(0, ${i * 22})`}>
                <rect x={0} y={4} width={10} height={10} rx={2} fill={arc.color} />
                <text x={16} y={12} fontSize={11} fill="var(--kumo-subtle)">
                  <tspan fontWeight={500}>{arc.label}</tspan>
                  <tspan dx={4} fill="var(--kumo-muted)">{arc.value}</tspan>
                  <tspan dx={4} fill="var(--kumo-muted)" fontSize={10}>{arc.pct}%</tspan>
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * Kumo-style Donut Chart (PieChart with hole).
 *
 * @example
 * ```jsx
 * <DonutChart data={[{ label: '中国', value: 42 }, { label: '日本', value: 18 }]} showLegend />
 * ```
 */
export function DonutChart(props) {
  return <PieChart {...props} donut />;
}

/* ────────────────── LineChart ────────────────── */

/**
 * Kumo-style Line Chart for time-series data.
 *
 * @example
 * ```jsx
 * <LineChart
 *   data={[{ label: '1月', value: 10 }, { label: '2月', value: 25 }]}
 *   size="base"
 *   showDots
 * />
 * ```
 *
 * @param {{
 *   data: {label: string, value: number}[]
 *   className?: string
 *   size?: 'sm' | 'base' | 'lg'
 *   showDots?: boolean
 *   showValues?: boolean
 *   color?: string
 *   fill?: boolean
 * }} props
 */
export function LineChart({
  data,
  className,
  size,
  showDots = true,
  showValues = false,
  color = 'var(--kumo-brand)',
  fill = true,
}) {
  const s = useChartSize(size);
  const padding = { top: 24, right: 20, bottom: 28, left: 4 };

  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  const innerWidth = 600 - padding.left - padding.right;
  const innerHeight = s.height - padding.top - padding.bottom;

  const points = useMemo(() => data.map((item, i) => {
    const x = padding.left + (data.length > 1 ? (i / (data.length - 1)) * innerWidth : innerWidth / 2);
    const y = padding.top + innerHeight * (1 - item.value / maxValue);
    return { ...item, x, y };
  }), [data, innerWidth, innerHeight, maxValue, padding]);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = linePath + ` L ${points[points.length - 1]?.x ?? 0} ${padding.top + innerHeight} L ${padding.left} ${padding.top + innerHeight} Z`;

  return (
    <div data-kumo-component="Chart" data-kumo-chart="LineChart" className={cn('tw-w-full', className)}>
      <svg viewBox={`0 0 600 ${s.height}`} className="tw-w-full" style={{ height: s.height }} role="img">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padding.top + innerHeight * (1 - pct);
          return (
            <g key={pct}>
              <line x1={padding.left} x2={600 - padding.right} y1={y} y2={y} stroke="var(--kumo-hairline)" strokeWidth="0.5" />
              <text x={padding.left - 4} y={y + 3} fontSize={10} fill="var(--kumo-muted)" textAnchor="end">
                {Math.round(maxValue * pct)}
              </text>
            </g>
          );
        })}

        {/* Fill area */}
        {fill && (
          <path d={fillPath} fill={color} opacity={0.08} />
        )}

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="var(--kumo-base)" stroke={color} strokeWidth={2} />
            <title>{p.label}: {p.value}</title>
          </g>
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          <g key={'label-' + i}>
            <text x={p.x} y={s.height - 6} textAnchor="middle" fontSize={s.fontSize} fill="var(--kumo-subtle)">
              {p.label}
            </text>
            {showValues && (
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={10} fill="var(--kumo-subtle)" fontWeight={500}>
                {p.value}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ────────────────── StatCard ────────────────── */

/**
 * Kumo-style Stat Card for showing a single metric.
 *
 * @example
 * ```jsx
 * <StatCard label="地图总数" value={stats.total} trend="+12" icon={<Map />} />
 * ```
 *
 * @param {{
 *   label: string
 *   value: React.ReactNode
 *   trend?: string
 *   trendUp?: boolean
 *   icon?: React.ReactNode
 *   variant?: 'default' | 'brand' | 'success' | 'warning'
 *   className?: string
 * }} props
 */
export function StatCard({ label, value, trend, trendUp, icon, variant = 'default', className }) {
  const variants = {
    default: 'tw-border-[var(--kumo-line)] tw-bg-[var(--kumo-panel-bg)]',
    brand: 'tw-border-[var(--kumo-brand)]/30 tw-bg-[var(--kumo-brand)]/5',
    success: 'tw-border-[var(--kumo-success)]/30 tw-bg-[var(--kumo-success)]/5',
    warning: 'tw-border-[var(--kumo-warning)]/30 tw-bg-[var(--kumo-warning)]/5',
  };

  return (
    <div
      data-kumo-component="StatCard"
      className={cn(
        'tw-rounded-xl tw-border tw-p-4 tw-transition-all hover:tw-shadow-md',
        variants[variant],
        className
      )}
    >
      <div className="tw-flex tw-items-start tw-justify-between">
        <div>
          <div className="tw-text-xs tw-text-[var(--kumo-muted)] tw-font-medium">{label}</div>
          <div className="tw-mt-1 tw-text-2xl tw-font-bold tw-text-[var(--kumo-default)] tw-leading-tight">{value}</div>
        </div>
        {icon && (
          <div className="tw-rounded-lg tw-bg-[var(--kumo-recessed)] tw-p-2 tw-text-[var(--kumo-brand)]">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className={cn('tw-mt-2 tw-text-xs tw-font-medium', trendUp ? 'tw-text-[var(--kumo-success)]' : 'tw-text-[var(--kumo-danger)]')}>
          {trend}
        </div>
      )}
    </div>
  );
}

/* ────────────────── ProgressBar ────────────────── */

/**
 * Kumo-style Progress Bar.
 *
 * @example
 * ```jsx
 * <ProgressBar value={75} max={100} label="OCR完成率" showValue color="var(--kumo-success)" />
 * ```
 *
 * @param {{
 *   value: number
 *   max: number
 *   label?: string
 *   showValue?: boolean
 *   color?: string
 *   size?: 'sm' | 'base'
 *   className?: string
 * }} props
 */
export function ProgressBar({ value, max, label, showValue = true, color = 'var(--kumo-brand)', size = 'base', className }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const heights = { sm: 'tw-h-1.5', base: 'tw-h-2.5' };

  return (
    <div data-kumo-component="ProgressBar" className={cn('tw-w-full', className)}>
      {(label || showValue) && (
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-1.5">
          {label && <span className="tw-text-xs tw-font-medium tw-text-[var(--kumo-subtle)]">{label}</span>}
          {showValue && <span className="tw-text-xs tw-text-[var(--kumo-muted)]">{pct}%</span>}
        </div>
      )}
      <div className={cn('tw-w-full tw-rounded-full tw-bg-[var(--kumo-recessed)] tw-overflow-hidden', heights[size])}>
        <div
          className={cn('tw-h-full tw-rounded-full tw-transition-all', heights[size])}
          style={{ width: `${pct}%`, background: color }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}

/* ────────────────── ColorScaleBar ────────────────── */

/**
 * Kumo-style stacked color bar for distribution data.
 *
 * @example
 * ```jsx
 * <ColorScaleBar
 *   segments={[{ value: 42, color: '#ef4444', label: '红条' }, { value: 18, color: '#22c55e', label: '绿条' }]}
 * />
 * ```
 *
 * @param {{
 *   segments: {value: number, color: string, label: string}[]
 *   className?: string
 *   size?: 'sm' | 'base'
 *   showLegend?: boolean
 * }} props
 */
export function ColorScaleBar({ segments, className, size = 'base', showLegend = true }) {
  const total = useMemo(() => segments.reduce((sum, s) => sum + s.value, 0), [segments]);
  const heights = { sm: 'tw-h-3', base: 'tw-h-4' };

  return (
    <div data-kumo-component="ColorScaleBar" className={cn('tw-w-full', className)}>
      <div className={cn('tw-flex tw-w-full tw-rounded-full tw-overflow-hidden', heights[size])}>
        {segments.map((seg, i) => (
          <div
            key={seg.label + i}
            className={cn('tw-h-full tw-transition-all', heights[size])}
            style={{ width: `${total ? (seg.value / total) * 100 : 0}%`, background: seg.color, minWidth: seg.value > 0 ? 2 : 0 }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="tw-flex tw-flex-wrap tw-gap-3 tw-mt-2">
          {segments.map((seg, i) => (
            <div key={seg.label + i} className="tw-flex tw-items-center tw-gap-1.5 tw-text-xs">
              <span className="tw-size-2 tw-rounded-full tw-shrink-0" style={{ background: seg.color }} />
              <span className="tw-text-[var(--kumo-subtle)]">{seg.label}</span>
              <span className="tw-font-medium tw-text-[var(--kumo-default)]">{seg.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
