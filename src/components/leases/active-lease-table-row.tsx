"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type ActiveLeaseTableRowData = {
  id: number;
  leasedAt: string;
  item: {
    id: string;
    book: {
      id: number;
      name: string;
    };
  };
};

type ActiveLeaseTableRowProps = {
  lease: ActiveLeaseTableRowData;
  onOpenItemHistory: (itemId: string) => void;
  actionCell?: ReactNode;
};

export function ActiveLeaseTableRow({ lease, onOpenItemHistory, actionCell }: ActiveLeaseTableRowProps) {
  return (
    <tr>
      <td className="px-3 py-2">
        <Link href={`/books/${lease.item.book.id}?itemId=${lease.item.id}`} className="text-[#006b2d] hover:underline">
          {lease.item.book.name}
        </Link>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          className="font-mono text-xs text-[#006b2d] hover:underline"
          onClick={() => onOpenItemHistory(lease.item.id)}
        >
          {lease.item.id}
        </button>
      </td>
      <td className="px-3 py-2">{new Date(lease.leasedAt).toLocaleDateString("de-DE")}</td>
      {actionCell ? <td className="px-3 py-2 text-right">{actionCell}</td> : null}
    </tr>
  );
}
