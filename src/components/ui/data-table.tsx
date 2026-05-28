"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
};

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "Keine Daten vorhanden.",
  initialPageSize = 10,
  pageSizeOptions = [10, 20, 50],
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: initialPageSize,
      },
    },
  });

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader className="bg-[#f2f4f8]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-[#4b5563]">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-1 text-sm text-[#374151]">
        <div className="flex items-center gap-2">
          <span>Zeilen pro Seite</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="rounded-md border border-black/20 bg-white px-2 py-1 text-sm"
            aria-label="Zeilen pro Seite"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>
            Seite {table.getState().pagination.pageIndex + 1} von {table.getPageCount() || 1}
          </span>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-black/20 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zuruck
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-black/20 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}