import { useEffect, useMemo, useState } from 'react';
import { money } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

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
    const nextRowLabels = [...new Set(
      summaryTransactions
        .map((transaction) => summaryLabelFor(transaction, applied.row))
        .filter((label) => label != null && label !== '')
    )].sort();
    const nextColumnLabels = [...new Set(
      summaryTransactions
        .map((transaction) => summaryLabelFor(transaction, applied.column))
        .filter((label) => label != null && label !== '')
    )].sort();
    const nextMatrix = {};

    summaryTransactions.forEach((transaction) => {
      const rowKey = summaryLabelFor(transaction, applied.row);
      const columnKey = summaryLabelFor(transaction, applied.column);
      if (rowKey == null || rowKey === '' || columnKey == null || columnKey === '') return;
      nextMatrix[rowKey] = nextMatrix[rowKey] || {};
      nextMatrix[rowKey][columnKey] = (nextMatrix[rowKey][columnKey] || 0) + Number(transaction.amount);
    });

    return { rowLabels: nextRowLabels, columnLabels: nextColumnLabels, matrix: nextMatrix };
  }, [summaryTransactions, summaryLabelFor, applied]);

  function handleSubmit(event) {
    event.preventDefault();
    setApplied({ row, column });
  }

  return (
    <section id="filterPage" className="space-y-6">
      <PageHeader eyebrow="Filter" title="Pivot filter" />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Dimensions</CardTitle>
          <CardDescription>Choose what appears on rows and columns</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="pivotForm" className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={handleSubmit}>
            <div className="grid min-w-[180px] flex-1 gap-1.5">
              <Label htmlFor="pivot-row">Rows</Label>
              <NativeSelect
                id="pivot-row"
                name="row"
                value={row}
                onChange={(event) => setRow(event.target.value)}
              >
                <option value="month">Month</option>
                <option value="category">Category</option>
                <option value="subcategory">Subcategory</option>
                <option value="store">Store</option>
                <option value="paymentMethod">Payment mode</option>
              </NativeSelect>
            </div>
            <div className="grid min-w-[180px] flex-1 gap-1.5">
              <Label htmlFor="pivot-column">Columns</Label>
              <NativeSelect
                id="pivot-column"
                name="column"
                value={column}
                onChange={(event) => setColumn(event.target.value)}
              >
                <option value="category">Category</option>
                <option value="month">Month</option>
                <option value="subcategory">Subcategory</option>
                <option value="store">Store</option>
                <option value="paymentMethod">Payment mode</option>
              </NativeSelect>
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Pivot table</CardTitle>
          <CardDescription>
            {applied.row} × {applied.column}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table id="pivotTable">
            <TableHeader>
              <TableRow>
                <TableHead>{applied.row}</TableHead>
                {columnLabels.map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowLabels.length ? rowLabels.map((rowLabel) => {
                const total = columnLabels.reduce(
                  (sum, columnLabel) => sum + (matrix[rowLabel]?.[columnLabel] || 0),
                  0
                );
                return (
                  <TableRow key={rowLabel}>
                    <TableHead scope="row">{rowLabel}</TableHead>
                    {columnLabels.map((columnLabel) => (
                      <TableCell key={columnLabel}>
                        {money.format(matrix[rowLabel]?.[columnLabel] || 0)}
                      </TableCell>
                    ))}
                    <TableCell className="font-medium">{money.format(total)}</TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={Math.max(columnLabels.length + 2, 2)} className="text-muted-foreground">
                    No transaction data yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
