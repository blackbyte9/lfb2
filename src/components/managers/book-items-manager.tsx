"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeaderButton } from "@/components/ui/sort-header-button";
import { ItemIdInput } from "@/components/ui/item-id-input";
import { itemCreateSchema } from "@/lib/book-schemas";

type ItemStatus = "NEW" | "USED" | "DAMAGED" | "REMOVED";

export type ItemRow = {
  id: string;
  status: ItemStatus;
  bookId: number;
  isLeased: boolean;
  hasAnyLeases: boolean;
  leasedStudentId: number | null;
  leasedStudentName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookOption = {
  id: number;
  isbn: string;
  name: string;
};

type ItemHistoryLease = {
  id: number;
  leasedAt: string;
  returnedAt: string | null;
  student: {
    id: number;
    idOld: string | null;
    firstname: string;
    lastname: string;
    course: string;
  };
};

type ItemHistoryResponse = {
  item: {
    id: string;
    status: ItemStatus;
  };
  leases: ItemHistoryLease[];
};

type ItemHistoryEvent = {
  leaseId: number;
  type: "LEASED" | "RETURNED";
  date: string;
  student: ItemHistoryLease["student"];
};

type Props = {
  book: BookOption;
  books: BookOption[];
  initialItems: ItemRow[];
  canManage: boolean;
  canReturn: boolean;
  highlightItemId?: string | null;
};

const ITEM_STATUSES: ItemStatus[] = ["NEW", "USED", "DAMAGED", "REMOVED"];

export function BookItemsManager({ book, books, initialItems, canManage, canReturn, highlightItemId = null }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>(initialItems);
  const [sortBy, setSortBy] = useState<"id" | "status" | "leased">("leased");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsInfo, setItemsInfo] = useState<string | null>(null);
  const [newItemId, setNewItemId] = useState("");
  const [newItemStatus, setNewItemStatus] = useState<ItemStatus>("NEW");
  const [searchItemId, setSearchItemId] = useState("");
  const [searchSubmitTrigger, setSearchSubmitTrigger] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetBookId, setTargetBookId] = useState(book.id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyEvents, setHistoryEvents] = useState<ItemHistoryEvent[]>([]);
  const itemRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const sortedBooks = useMemo(() => [...books].sort((a, b) => a.name.localeCompare(b.name, "de")), [books]);
  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      let comparison: number;
      if (sortBy === "id") {
        comparison = left.id.localeCompare(right.id, "de");
      } else if (sortBy === "leased") {
        comparison = Number(left.isLeased) - Number(right.isLeased);
      } else {
        comparison = left.status.localeCompare(right.status, "de");
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [items, sortBy, sortOrder]);

  useEffect(() => {
    if (!highlightItemId) {
      return;
    }

    const row = itemRowRefs.current[highlightItemId];
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightItemId, sortedItems]);

  async function handleCreateItem() {
    setItemsError(null);
    setItemsInfo(null);

    const parsed = itemCreateSchema.safeParse({
      id: newItemId,
      status: newItemStatus,
      bookId: book.id,
    });

    if (!parsed.success) {
      setItemsError(parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten");
      return;
    }

    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setItemsError(data.error ?? "Item konnte nicht erstellt werden");
      return;
    }

    const created = (await res.json()) as ItemRow;
    setItems((prev) => [...prev, created].sort((a, b) => a.id.localeCompare(b.id, "de")));
    setItemsInfo(`Item ${created.id} wurde hinzugefügt`);
    setNewItemId("");
  }

  async function handleDeleteItem(itemId: string) {
    setItemsError(null);
    setItemsInfo(null);

    const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setItemsError(data.error ?? "Item konnte nicht gelöscht werden");
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setItemsInfo(`Item ${itemId} wurde gelöscht`);
  }

  async function handleReturnItem(itemId: string) {
    setItemsError(null);
    setItemsInfo(null);
    setUpdatingItemId(itemId);

    const res = await fetch(`/api/items/${itemId}/return`, { method: "POST" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setItemsError(data.error ?? "Rückgabe konnte nicht durchgeführt werden");
      setUpdatingItemId(null);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isLeased: false, leasedStudentId: null, leasedStudentName: null } : item,
      ),
    );
    setItemsInfo(`Item ${itemId} wurde zurückgegeben`);
    setUpdatingItemId(null);
  }

  async function handleUpdateItemStatus(itemId: string, status: ItemStatus) {
    setItemsError(null);
    setItemsInfo(null);
    setUpdatingItemId(itemId);

    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setItemsError(data.error ?? "Status konnte nicht aktualisiert werden");
      setUpdatingItemId(null);
      return;
    }

    const updated = (await res.json()) as ItemRow;
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: updated.status } : item)));
    setItemsInfo(`Status für ${itemId} wurde aktualisiert`);
    setUpdatingItemId(null);
  }

  async function handleSearchItem() {
    const trimmedItemId = searchItemId.trim().toUpperCase();
    if (!trimmedItemId) {
      setItemsError("Bitte eine Item-ID eingeben");
      return;
    }

    setItemsError(null);
    setItemsInfo(null);

    const res = await fetch(`/api/items/${trimmedItemId}`);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setItemsError(data.error ?? "Item nicht gefunden");
      return;
    }

    const foundItem = (await res.json()) as ItemRow;
    router.push(`/books/${foundItem.bookId}?itemId=${foundItem.id}`);
  }

  function handleSwitchBook() {
    if (targetBookId === book.id) {
      setModalOpen(false);
      return;
    }
    router.push(`/books/${targetBookId}`);
  }

  function toggleSort(column: "id" | "status" | "leased") {
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortOrder("asc");
  }

  async function handleOpenItemHistory(itemId: string) {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryItemId(itemId);
    setHistoryEvents([]);

    const res = await fetch(`/api/items/${encodeURIComponent(itemId)}/history`);
    const payload = (await res.json()) as ItemHistoryResponse | { error?: string };

    if (!res.ok) {
      setHistoryError((payload as { error?: string }).error ?? "Verlauf konnte nicht geladen werden");
      setHistoryLoading(false);
      return;
    }

    const historyPayload = payload as ItemHistoryResponse;
    const events = historyPayload.leases.flatMap((lease) => {
      const leasedEvent: ItemHistoryEvent = {
        leaseId: lease.id,
        type: "LEASED",
        date: lease.leasedAt,
        student: lease.student,
      };

      if (!lease.returnedAt) {
        return [leasedEvent];
      }

      const returnedEvent: ItemHistoryEvent = {
        leaseId: lease.id,
        type: "RETURNED",
        date: lease.returnedAt,
        student: lease.student,
      };

      return [leasedEvent, returnedEvent];
    });

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setHistoryEvents(events);
    setHistoryLoading(false);
  }

  function handleCloseItemHistory() {
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryError(null);
    setHistoryItemId(null);
    setHistoryEvents([]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-[#131820]">{book.name}</h2>
          <p className="text-sm text-[#364152]">ISBN: {book.isbn}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push("/books")}>
            Zur Buchliste
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTargetBookId(book.id);
              setModalOpen(true);
            }}
          >
            Buch wechseln
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-black/10 bg-[#f2f4f8] p-3">
        <ItemIdInput
          id="search-item-id"
          label="Item-ID suchen"
          value={searchItemId}
          onValueChange={(value) => setSearchItemId(value)}
          onSubmit={() => handleSearchItem()}
          submitTrigger={searchSubmitTrigger}
          clearOnSubmit
          flavor="search"
          ariaLabel="Item-ID suchen"
        />
        <Button size="sm" variant="outline" onClick={() => setSearchSubmitTrigger((current) => current + 1)}>
          Zu Item springen
        </Button>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-black/10 bg-[#f2f4f8] p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="new-item-id" className="text-xs font-medium text-[#364152]">
              Barcode / Item-ID
            </label>
            <input
              id="new-item-id"
              type="text"
              placeholder="RSV0010000"
              value={newItemId}
              onChange={(e) => setNewItemId(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreateItem();
                }
              }}
              className="w-48 rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
              aria-label="Barcode fur neues Item"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="new-item-status" className="text-xs font-medium text-[#364152]">
              Status
            </label>
            <select
              id="new-item-status"
              value={newItemStatus}
              onChange={(e) => setNewItemStatus(e.target.value as ItemStatus)}
              className="rounded border border-black/20 bg-white px-2 py-1 text-sm"
              aria-label="Status fur neues Item"
            >
              {ITEM_STATUSES.map((statusValue) => (
                <option key={statusValue} value={statusValue}>
                  {statusValue}
                </option>
              ))}
            </select>
          </div>

          <Button size="sm" onClick={() => void handleCreateItem()} disabled={!newItemId.trim()}>
            Item anlegen
          </Button>
        </div>
      )}

      {itemsInfo && <p className="text-sm text-green-700">{itemsInfo}</p>}
      {itemsError && <p className="text-sm text-red-600">{itemsError}</p>}

      <div className="rounded-lg border border-black/10">
        <Table>
          <TableHeader className="bg-[#f2f4f8]">
            <TableRow>
              <TableHead>
                <SortHeaderButton label="Item-ID" active={sortBy === "id"} direction={sortOrder} onClick={() => toggleSort("id")} />
              </TableHead>
              <TableHead>
                <SortHeaderButton label="Status" active={sortBy === "status"} direction={sortOrder} onClick={() => toggleSort("status")} />
              </TableHead>
              <TableHead>
                <SortHeaderButton label="Verfügbarkeit" active={sortBy === "leased"} direction={sortOrder} onClick={() => toggleSort("leased")} />
              </TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead className="w-28">Verlauf</TableHead>
              {canManage && <TableHead className="w-40">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="py-6 text-center text-[#364152]">
                  Keine Items fur dieses Buch vorhanden
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item) => (
                <TableRow
                  key={item.id}
                  ref={(element) => {
                    itemRowRefs.current[item.id] = element;
                  }}
                  className={`${highlightItemId === item.id ? "bg-[#e4f6ea]" : ""} cursor-pointer hover:bg-[#f9fafb]`}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("button, select, a, input")) {
                      return;
                    }
                    void handleOpenItemHistory(item.id);
                  }}
                >
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>
                    {item.isLeased && item.leasedStudentId !== null ? (
                      <button
                        type="button"
                        className="font-medium text-amber-700 hover:underline text-left"
                        onClick={() => router.push(`/lease/${item.leasedStudentId}`)}
                      >
                        {item.leasedStudentName ?? "Ausgeliehen"}
                      </button>
                    ) : (
                      <span className="font-medium text-green-700">Verfügbar</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    <Button size="xs" variant="outline" onClick={() => void handleOpenItemHistory(item.id)}>
                      Verlauf
                    </Button>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.status}
                          onChange={(e) => void handleUpdateItemStatus(item.id, e.target.value as ItemStatus)}
                          disabled={updatingItemId === item.id}
                          className="rounded border border-black/20 bg-white px-2 py-1 text-xs"
                          aria-label={`Status für Item ${item.id} ändern`}
                        >
                          {ITEM_STATUSES.map((statusValue) => (
                            <option key={statusValue} value={statusValue}>
                              {statusValue}
                            </option>
                          ))}
                        </select>
                        {item.isLeased && canReturn && (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={updatingItemId === item.id}
                            onClick={() => void handleReturnItem(item.id)}
                          >
                            Zurückgeben
                          </Button>
                        )}
                        {!item.hasAnyLeases ? (
                          <Button size="xs" variant="outline" onClick={() => void handleDeleteItem(item.id)}>
                            Löschen
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#131820]">Buch auswählen</h3>
            <p className="mt-1 text-sm text-[#364152]">Für welches Buch sollen die Items angezeigt werden?</p>

            <div className="mt-3">
              <label htmlFor="switch-book-select" className="mb-1 block text-xs font-medium text-[#364152]">
                Buch
              </label>
              <select
                id="switch-book-select"
                value={targetBookId}
                onChange={(e) => setTargetBookId(Number(e.target.value))}
                className="w-full rounded border border-black/20 px-2 py-1"
                aria-label="Buch für Items auswählen"
              >
                {sortedBooks.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.isbn})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setModalOpen(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleSwitchBook}>
                Öffnen
              </Button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#131820]">Item-Verlauf</h3>
                <p className="mt-1 text-sm text-[#364152]">{historyItemId ? `Item: ${historyItemId}` : "Item"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleCloseItemHistory}>
                Schließen
              </Button>
            </div>

            <div className="mt-3 max-h-96 overflow-auto rounded border border-black/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#f2f4f8] text-left">
                  <tr>
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Aktion</th>
                    <th className="px-3 py-2">Schüler</th>
                    <th className="px-3 py-2">Klasse</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Verlauf wird geladen...
                      </td>
                    </tr>
                  ) : historyError ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-red-600">
                        {historyError}
                      </td>
                    </tr>
                  ) : historyEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[#364152]">
                        Keine Ausleih- oder Rückgabehistorie vorhanden.
                      </td>
                    </tr>
                  ) : (
                    historyEvents.map((event) => (
                      <tr key={`${event.leaseId}-${event.type}-${event.date}`} className="border-t border-black/10">
                        <td className="px-3 py-2">{new Date(event.date).toLocaleString("de-DE")}</td>
                        <td className="px-3 py-2">
                          {event.type === "LEASED" ? (
                            <span className="font-medium text-amber-700">Ausleihe</span>
                          ) : (
                            <span className="font-medium text-green-700">Rückgabe</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {event.student.lastname}, {event.student.firstname}
                          {event.student.idOld ? ` (ID: ${event.student.idOld})` : ""}
                        </td>
                        <td className="px-3 py-2">{event.student.course}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
