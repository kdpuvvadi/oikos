import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { money, formatLongDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import {
  CHART_PALETTE,
  sumBy,
  sortedTotals,
  monthKey,
  shiftMonthKey,
  formatMonthLabel,
  smoothPath,
  donutArc
} from '@/lib/charts';
import { PageHeader } from '@/components/PageHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

function DashKpis({ transactions }) {
  const current = monthKey();
  const previous = shiftMonthKey(current, -1);
  let total = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount || 0);
    total += amount;
    const key = String(transaction.date || '').slice(0, 7);
    if (key === current) thisMonth += amount;
    if (key === previous) lastMonth += amount;
  });
  const count = transactions.length;
  const average = count ? total / count : 0;
  const delta = lastMonth === 0
    ? (thisMonth > 0 ? 100 : 0)
    : ((thisMonth - lastMonth) / lastMonth) * 100;
  const deltaLabel = `${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs last month`;

  const cards = [
    {
      label: 'This month',
      value: money.format(thisMonth),
      hint: deltaLabel,
      hintClass: delta > 0 ? 'text-[var(--chart-3)]' : delta < 0 ? 'text-[var(--chart-2)]' : ''
    },
    { label: 'Last month', value: money.format(lastMonth), hint: formatMonthLabel(previous) },
    { label: 'All time', value: money.format(total), hint: `${count} transaction${count === 1 ? '' : 's'}` },
    { label: 'Average expense', value: money.format(average), hint: 'Per transaction' }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4" id="dashKpis">
      {cards.map((card) => (
        <Card key={card.label} size="sm" className="min-w-0">
          <CardHeader className="gap-1">
            <CardDescription className="truncate text-xs sm:text-sm">{card.label}</CardDescription>
            <CardTitle className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {card.value}
            </CardTitle>
            <p className={cn('truncate text-xs text-muted-foreground', card.hintClass)}>
              {card.hint || ''}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function MonthTrendChart({ transactions }) {
  const byMonth = sumBy(transactions, (transaction) => String(transaction.date || '').slice(0, 7));
  const keys = Object.keys(byMonth).filter(Boolean).sort();

  if (!keys.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No expense data yet.</p>;
  }

  const end = keys[keys.length - 1];
  const start = keys.length >= 12 ? shiftMonthKey(end, -(Math.min(keys.length, 12) - 1)) : keys[0];
  const months = [];
  let cursor = start;
  while (cursor <= end) {
    months.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  const values = months.map((key) => byMonth[key] || 0);
  const max = Math.max(...values, 1);
  const width = 640;
  const height = 220;
  const pad = { top: 24, right: 16, bottom: 36, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const points = values.map((value, index) => ({
    x: pad.left + (months.length === 1 ? plotW / 2 : (index / (months.length - 1)) * plotW),
    y: pad.top + plotH - (value / max) * plotH,
    value,
    label: months[index]
  }));
  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} ${pad.top + plotH} L ${points[0].x} ${pad.top + plotH} Z`;
  const labelStep = months.length > 8 ? 2 : 1;

  return (
    <div id="monthTrendChart" className="chart-canvas">
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly spending trend">
        <defs>
          <linearGradient id="monthAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad.top + plotH * (1 - ratio);
          const label = money.format(max * ratio).replace(/\.00$/, '');
          return (
            <g key={ratio}>
              <line className="chart-grid" x1={pad.left} y1={y} x2={width - pad.right} y2={y} />
              <text className="chart-axis" x={pad.left - 8} y={y + 4} textAnchor="end">{label}</text>
            </g>
          );
        })}
        <path className="chart-area" d={area} fill="url(#monthAreaFill)" />
        <path className="chart-line" d={line} />
        {points.map((point) => (
          <circle key={point.label} className="chart-dot" cx={point.x} cy={point.y} r="4">
            <title>{`${formatMonthLabel(point.label)}: ${money.format(point.value)}`}</title>
          </circle>
        ))}
        {points.map((point, index) => {
          if (index % labelStep !== 0 && index !== points.length - 1) return null;
          return (
            <text key={`label-${point.label}`} className="chart-axis" x={point.x} y={height - 10} textAnchor="middle">
              {formatMonthLabel(point.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function CategoryDonut({ transactions }) {
  const totals = sumBy(transactions, (transaction) => transaction.category || 'Uncategorized');
  const entries = sortedTotals(totals, 6);
  const rest = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(6)
    .reduce((sum, [, total]) => sum + total, 0);
  if (rest > 0) entries.push(['Other', rest]);
  const grand = entries.reduce((sum, [, total]) => sum + total, 0);

  if (!grand) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No expense data yet.</p>;
  }

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 72;
  let angle = 0;
  const arcs = entries.map(([name, total], index) => {
    const sweep = (total / grand) * 360;
    const color = CHART_PALETTE[index % CHART_PALETTE.length];
    if (sweep >= 359.9) {
      return (
        <circle key={name} className="donut-slice" cx={cx} cy={cy} r={radius} stroke={color} strokeWidth="28" fill="none">
          <title>{`${name}: ${money.format(total)}`}</title>
        </circle>
      );
    }
    const start = angle;
    const end = angle + Math.max(sweep, 0.8);
    angle += sweep;
    return (
      <path
        key={name}
        className="donut-slice"
        d={donutArc(cx, cy, radius, start, end)}
        stroke={color}
        strokeWidth="28"
        fill="none"
      >
        <title>{`${name}: ${money.format(total)}`}</title>
      </path>
    );
  });

  return (
    <div id="categoryDonut" className="chart-canvas">
      <div className="grid items-center gap-4 md:grid-cols-[minmax(140px,200px)_minmax(0,1fr)]">
        <svg className="chart-svg mx-auto max-w-[220px]" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending by category">
          <circle cx={cx} cy={cy} r={radius} className="donut-track" />
          {arcs}
          <text className="donut-center-label" x={cx} y={cy - 6} textAnchor="middle">Total</text>
          <text className="donut-center-value" x={cx} y={cy + 16} textAnchor="middle">{money.format(grand)}</text>
        </svg>
        <ul className="m-0 grid list-none gap-2 p-0">
          {entries.map(([name, total], index) => (
            <li key={name} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <span
                className="size-3 rounded-full"
                style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }}
              />
              <span className="truncate text-muted-foreground">{name}</span>
              <strong>{money.format(total)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DailyChart({ transactions }) {
  const current = monthKey();
  const daysInMonth = new Date(Number(current.slice(0, 4)), Number(current.slice(5, 7)), 0).getDate();
  const byDay = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    byDay[String(day).padStart(2, '0')] = 0;
  }
  transactions.forEach((transaction) => {
    const date = String(transaction.date || '');
    if (!date.startsWith(current)) return;
    const day = date.slice(8, 10);
    if (byDay[day] === undefined) return;
    byDay[day] += Number(transaction.amount || 0);
  });
  const entries = Object.entries(byDay);
  const max = Math.max(...entries.map(([, total]) => total), 1);
  const today = new Date().getDate();
  const width = 520;
  const height = 180;
  const pad = { top: 12, right: 8, bottom: 28, left: 8 };
  const gap = 2;
  const barW = (width - pad.left - pad.right - gap * (entries.length - 1)) / entries.length;
  const monthTotal = entries.reduce((sum, [, total]) => sum + total, 0);

  return (
    <div id="dailyChart" className="chart-canvas space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <strong>{money.format(monthTotal)}</strong>
        <span className="text-sm text-muted-foreground">{formatMonthLabel(current)}</span>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily spending this month">
        {entries.map(([day, total], index) => {
          const h = total > 0 ? Math.max((total / max) * (height - pad.top - pad.bottom), 3) : 0;
          const x = pad.left + index * (barW + gap);
          const y = height - pad.bottom - h;
          const isToday = Number(day) === today;
          return (
            <rect
              key={day}
              className={`daily-bar${isToday ? ' is-today' : ''}${total ? '' : ' is-empty'}`}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="2"
            >
              <title>{`Day ${Number(day)}: ${money.format(total)}`}</title>
            </rect>
          );
        })}
        {[1, Math.round(daysInMonth / 2), daysInMonth].map((day) => {
          const index = day - 1;
          const x = pad.left + index * (barW + gap) + barW / 2;
          return (
            <text key={day} className="chart-axis" x={x} y={height - 8} textAnchor="middle">{day}</text>
          );
        })}
      </svg>
    </div>
  );
}

function BarChart({ id, totals, limit = 6, colors = false }) {
  const entries = sortedTotals(totals, limit);
  const max = Math.max(...entries.map(([, total]) => total), 1);
  const grand = entries.reduce((sum, [, total]) => sum + total, 0) || 1;

  if (!entries.length) {
    return <p id={id} className="py-8 text-center text-sm text-muted-foreground">No expense data yet.</p>;
  }

  return (
    <div id={id} className="grid gap-3">
      {entries.map(([name, total], index) => {
        const tint = colors ? CHART_PALETTE[index % CHART_PALETTE.length] : null;
        return (
          <div key={name} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <strong className="truncate">{name}</strong>
              <span className="shrink-0 text-muted-foreground">{Math.round((total / grand) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.max((total / max) * 100, 4)}%`,
                  ...(tint ? { background: tint } : {})
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{money.format(total)}</span>
          </div>
        );
      })}
    </div>
  );
}

function TopExpenses({ transactions, summaryStoreLabel }) {
  const top = useMemo(
    () => [...transactions]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 8),
    [transactions]
  );

  if (!top.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No expense data yet.</p>;
  }

  return (
    <div id="topExpenses" className="grid gap-2">
      {top.map((transaction, index) => (
        <Link
          key={transaction.id}
          className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-inherit no-underline transition-colors hover:bg-muted/40"
          to={`/transactions/${encodeURIComponent(transaction.id)}`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm">
              {summaryStoreLabel(transaction) || transaction.category || 'Expense'}
            </strong>
            <span className="block truncate text-xs text-muted-foreground">
              {formatLongDate(transaction.date)} · {transaction.category || 'Uncategorized'}
            </span>
          </span>
          <strong className="shrink-0 text-sm">{money.format(transaction.amount || 0)}</strong>
        </Link>
      ))}
    </div>
  );
}

function Panel({ title, description, children, className }) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { toast } = useToast();
  const {
    summaryTransactions,
    loadSummaryTransactions,
    summaryStoreLabel
  } = useData();

  useEffect(() => {
    void loadSummaryTransactions().catch((error) => toast(error.message));
  }, [loadSummaryTransactions, toast]);

  const transactions = summaryTransactions || [];
  const paymentTotals = sumBy(transactions, (transaction) => transaction.paymentMethod || 'Not set');
  const storeTotals = sumBy(
    transactions.filter((transaction) => summaryStoreLabel(transaction)),
    summaryStoreLabel
  );

  return (
    <section id="dashboardPage" className="space-y-6">
      <PageHeader eyebrow="Insights" title="Spending overview" />

      <DashKpis transactions={transactions} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Monthly trend" description="Spend by month">
          <MonthTrendChart transactions={transactions} />
        </Panel>
        <Panel title="Categories" description="Share of total spend">
          <CategoryDonut transactions={transactions} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="This month" description="Daily spend">
          <DailyChart transactions={transactions} />
        </Panel>
        <Panel title="Payment methods" description="How you pay">
          <BarChart id="paymentChart" totals={paymentTotals} limit={6} colors />
        </Panel>
        <Panel title="Top stores" description="Highest spend">
          <BarChart id="storeChart" totals={storeTotals} limit={6} colors />
        </Panel>
      </div>

      <Panel title="Largest expenses" description="Top individual transactions">
        <TopExpenses transactions={transactions} summaryStoreLabel={summaryStoreLabel} />
      </Panel>
    </section>
  );
}
