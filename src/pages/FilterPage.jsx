import { useEffect, useMemo, useState } from 'react';
import { money } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';

export default function FilterPage() {
  const { toast } = useToast();
  const { summaryTransactions, loadSummaryTransactions, summaryLabelFor } = useData();
  const [row, setRow] = useState('month');
  const [column, setColumn] = useState('category');
  const [applied, setApplied] = useState({ row: 'month', column: 'category' });

  useEffect(() => {
    void loadSummaryTransactions().catch((error) => toast(error.message));
  }, [loadSummaryTransactions, toast]);

  const { rowLabels, columnLabels, matrix } = useMemo(() => {
    const rowLabels = [...new Set(
      summaryTransactions
        .map((transaction) => summaryLabelFor(transaction, applied.row))
        .filter((label) => label != null && label !== '')
    )].sort();
    const columnLabels = [...new Set(
      summaryTransactions
        .map((transaction) => summaryLabelFor(transaction, applied.column))
        .filter((label) => label != null && label !== '')
    )].sort();
    const matrix = {};

    summaryTransactions.forEach((transaction) => {
      const rowKey = summaryLabelFor(transaction, applied.row);
      const columnKey = summaryLabelFor(transaction, applied.column);
      if (rowKey == null || rowKey === '' || columnKey == null || columnKey === '') return;
      matrix[rowKey] = matrix[rowKey] || {};
      matrix[rowKey][columnKey] = (matrix[rowKey][columnKey] || 0) + Number(transaction.amount);
    });

    return { rowLabels, columnLabels, matrix };
  }, [summaryTransactions, summaryLabelFor, applied]);

  function handleSubmit(event) {
    event.preventDefault();
    setApplied({ row, column });
  }

  return (
    <section id="filterPage">
      <div className="page-title">
        <p className="eyebrow">Filter</p>
        <h1>Pivot filter</h1>
      </div>
      <form id="pivotForm" className="panel inline-form" onSubmit={handleSubmit}>
        <label>
          Rows
          <select name="row" value={row} onChange={(event) => setRow(event.target.value)}>
            <option value="month">Month</option>
            <option value="category">Category</option>
            <option value="subcategory">Subcategory</option>
            <option value="store">Store</option>
            <option value="paymentMethod">Payment mode</option>
          </select>
        </label>
        <label>
          Columns
          <select name="column" value={column} onChange={(event) => setColumn(event.target.value)}>
            <option value="category">Category</option>
            <option value="month">Month</option>
            <option value="subcategory">Subcategory</option>
            <option value="store">Store</option>
            <option value="paymentMethod">Payment mode</option>
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>
      <div className="table-wrap">
        <table id="pivotTable">
          <thead>
            <tr>
              <th>{applied.row}</th>
              {columnLabels.map((label) => (
                <th key={label}>{label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rowLabels.length ? rowLabels.map((rowLabel) => {
              const total = columnLabels.reduce(
                (sum, columnLabel) => sum + (matrix[rowLabel]?.[columnLabel] || 0),
                0
              );
              return (
                <tr key={rowLabel}>
                  <th>{rowLabel}</th>
                  {columnLabels.map((columnLabel) => (
                    <td key={columnLabel}>{money.format(matrix[rowLabel]?.[columnLabel] || 0)}</td>
                  ))}
                  <td>{money.format(total)}</td>
                </tr>
              );
            }) : (
              <tr>
                <td>No transaction data yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
