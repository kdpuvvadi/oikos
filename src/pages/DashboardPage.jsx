import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { money, formatLongDate } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import {
  CHART_PALETTE,
  sumBy,
  sortedTotals,
  monthKey,
  shiftMonthKey,
  formatMonthLabel,
  smoothPath,
  donutArc
} from '../lib/charts';

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
  const deltaClass = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : '';

  const cards = [
    { label: 'This month', value: money.format(thisMonth), hint: deltaLabel, hintClass: deltaClass },
    { label: 'Last month', value: money.format(lastMonth), hint: formatMonthLabel(previous) },
    { label: 'All time', value: money.format(total), hint: `${count} transaction${count === 1 ? '' : 's'}` },
    { label: 'Average expense', value: money.format(average), hint: 'Per transaction' }
  ];

  return (
    <div className="dash-kpi-grid" id="dashKpis">
      {cards.map((card) => (
        <article key={card.label} className="stat-card dash-kpi">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <em className={`dash-kpi-hint ${card.hintClass || ''}`}>{card.hint || ''}</em>
        </article>
      ))}
    </div>
  );
}

function MonthTrendChart({ transactions }) {
  const byMonth = sumBy(transactions, (transaction) => String(transaction.date || '').slice(0, 7));
  const keys = Object.keys(byMonth).filter(Boolean).sort();

  if (!keys.length) {
    return <div id="monthTrendChart" className="chart-canvas"><p className="dash-empty">No expense data yet.</p></div>;
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
    return <div id="categoryDonut" className="chart-canvas"><p className="dash-empty">No expense data yet.</p></div>;
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
      <div className="donut-layout">
        <svg className="chart-svg donut-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending by category">
          <circle cx={cx} cy={cy} r={radius} className="donut-track" />
          {arcs}
          <text className="donut-center-label" x={cx} y={cy - 6} textAnchor="middle">Total</text>
          <text className="donut-center-value" x={cx} y={cy + 16} textAnchor="middle">{money.format(grand)}</text>
        </svg>
        <ul className="donut-legend">
          {entries.map(([name, total], index) => (
            <li key={name}>
              <span className="donut-swatch" style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }} />
              <span className="donut-legend-label">{name}</span>
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
    <div id="dailyChart" className="chart-canvas">
      <div className="daily-chart-meta">
        <strong>{money.format(monthTotal)}</strong>
        <span>{formatMonthLabel(current)}</span>
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
    return <div id={id} className="bars dash-bars"><p className="dash-empty">No expense data yet.</p></div>;
  }

  return (
    <div id={id} className="bars dash-bars">
      {entries.map(([name, total], index) => {
        const tint = colors ? CHART_PALETTE[index % CHART_PALETTE.length] : null;
        return (
          <div key={name} className="bar-row dash-bar-row">
            <div className="dash-bar-meta">
              <strong>{name}</strong>
              <span className="dash-bar-pct">{Math.round((total / grand) * 100)}%</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max((total / max) * 100, 4)}%`,
                  ...(tint ? { background: tint } : {})
                }}
              />
            </div>
            <span className="dash-bar-amount">{money.format(total)}</span>
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
    return <div id="topExpenses" className="dash-expense-list"><p className="dash-empty">No expense data yet.</p></div>;
  }

  return (
    <div id="topExpenses" className="dash-expense-list">
      {top.map((transaction, index) => (
        <Link
          key={transaction.id}
          className="dash-expense-item"
          to={`/transactions/${encodeURIComponent(transaction.id)}`}
        >
          <span className="dash-expense-rank">{index + 1}</span>
          <span className="dash-expense-body">
            <strong>{summaryStoreLabel(transaction) || transaction.category || 'Expense'}</strong>
            <span>{formatLongDate(transaction.date)} · {transaction.category || 'Uncategorized'}</span>
          </span>
          <strong className="dash-expense-amount">{money.format(transaction.amount || 0)}</strong>
        </Link>
      ))}
    </div>
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
    <section id="dashboardPage">
      <div className="page-title">
        <p className="eyebrow">Insights</p>
        <h1>Spending overview</h1>
      </div>

      <DashKpis transactions={transactions} />

      <div className="dash-main-grid">
        <section className="panel dash-panel dash-panel-wide">
          <div className="dash-panel-head">
            <div>
              <h2>Monthly trend</h2>
              <p className="dash-panel-sub">Spend by month</p>
            </div>
          </div>
          <MonthTrendChart transactions={transactions} />
        </section>

        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Categories</h2>
              <p className="dash-panel-sub">Share of total spend</p>
            </div>
          </div>
          <CategoryDonut transactions={transactions} />
        </section>
      </div>

      <div className="dash-secondary-grid">
        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <div>
              <h2>This month</h2>
              <p className="dash-panel-sub">Daily spend</p>
            </div>
          </div>
          <DailyChart transactions={transactions} />
        </section>

        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Payment methods</h2>
              <p className="dash-panel-sub">How you pay</p>
            </div>
          </div>
          <BarChart id="paymentChart" totals={paymentTotals} limit={6} colors />
        </section>

        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <div>
              <h2>Top stores</h2>
              <p className="dash-panel-sub">Highest spend</p>
            </div>
          </div>
          <BarChart id="storeChart" totals={storeTotals} limit={6} colors />
        </section>
      </div>

      <section className="panel dash-panel">
        <div className="dash-panel-head">
          <div>
            <h2>Largest expenses</h2>
            <p className="dash-panel-sub">Top individual transactions</p>
          </div>
        </div>
        <TopExpenses transactions={transactions} summaryStoreLabel={summaryStoreLabel} />
      </section>
    </section>
  );
}
