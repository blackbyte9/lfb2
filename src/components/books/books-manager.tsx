"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EditableTableRow } from "@/components/ui/editable-table-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeaderButton } from "@/components/ui/sort-header-button";
import { bookCreateSchema } from "@/lib/book-schemas";
import { useFileUpload } from "@/lib/useFileUpload";

export type BookRow = {
  id: number;
  isbn: string;
  name: string;
  itemCount: number;
  createdAt: string;
};

type Props = {
  initialBooks: BookRow[];
  canManage: boolean;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function BooksManager({ initialBooks, canManage }: Props) {
  const router = useRouter();
  const [books, setBooks] = useState<BookRow[]>(initialBooks);
  const [searchItemId, setSearchItemId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editIsbn, setEditIsbn] = useState("");
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newIsbn, setNewIsbn] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<"isbn" | "name" | "itemCount">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { fileInputRef, handleFileChange, triggerFileInput, status, error: uploadError, clearStatus, acceptedTypes } =
    useFileUpload({
      endpoint: "/api/books/import",
      onSuccess: async () => {
        const booksRes = await fetch("/api/books");
        if (booksRes.ok) {
          const refreshed = (await booksRes.json()) as BookRow[];
          setBooks(refreshed);
          setPageIndex(0);
        }
      },
      onError: (err) => setError(err),
      acceptedTypes: ".json",
    });

  const pageCount = Math.max(1, Math.ceil(books.length / pageSize));
  const sortedBooks = useMemo(() => {
    const sorted = [...books].sort((a, b) => {
      const cmp =
        sortBy === "itemCount"
          ? a.itemCount - b.itemCount
          : (sortBy === "isbn" ? a.isbn : a.name).localeCompare(sortBy === "isbn" ? b.isbn : b.name, "de");
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [books, sortBy, sortOrder]);

  const pagedBooks = useMemo(
    () => sortedBooks.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [sortedBooks, pageIndex, pageSize],
  );

  function startEdit(book: BookRow) {
    setEditingId(book.id);
    setEditIsbn(book.isbn);
    setEditName(book.name);
    setConfirmDeleteId(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(id: number) {
    setError(null);
    const parsed = bookCreateSchema.safeParse({ isbn: editIsbn, name: editName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten");
      return;
    }

    const res = await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Fehler beim Speichern");
      return;
    }
    const updated = (await res.json()) as BookRow;
    setBooks((prev) =>
      prev
        .map((b) => (b.id === id ? { ...b, isbn: updated.isbn, name: updated.name } : b))
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    );
    setEditingId(null);
  }

  async function handleAdd() {
    setError(null);
    const parsed = bookCreateSchema.safeParse({ isbn: newIsbn, name: newName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Eingabedaten");
      return;
    }

    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Fehler beim Hinzufügen");
      return;
    }
    const created = (await res.json()) as BookRow;
    setBooks((prev) =>
      [...prev, { ...created, createdAt: created.createdAt }].sort((a, b) => a.name.localeCompare(b.name, "de")),
    );
    setIsAdding(false);
    setNewIsbn("");
    setNewName("");
  }

  async function handleDelete(id: number) {
    setError(null);
    const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Fehler beim Löschen");
      setConfirmDeleteId(null);
      return;
    }
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setConfirmDeleteId(null);
  }

  async function handleSearchItem() {
    const trimmedItemId = searchItemId.trim().toUpperCase();
    if (!trimmedItemId) {
      setError("Bitte eine Item-ID eingeben");
      return;
    }

    setError(null);
    const res = await fetch(`/api/items/${trimmedItemId}`);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Item nicht gefunden");
      return;
    }

    const item = (await res.json()) as { id: string; bookId: number };
    router.push(`/books/${item.bookId}?itemId=${item.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-black/10 bg-[#f2f4f8] p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="search-item-id" className="text-xs font-medium text-[#364152]">
            Item-ID suchen
          </label>
          <input
            id="search-item-id"
            type="text"
            placeholder="RSV0010000"
            value={searchItemId}
            onChange={(e) => setSearchItemId(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSearchItem();
              }
            }}
            className="w-48 rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
            aria-label="Item-ID suchen"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => void handleSearchItem()}>
          Zu Item springen
        </Button>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setIsAdding(true);
              setError(null);
              clearStatus();
            }}
          >
            + Buch hinzufügen
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearStatus();
              setError(null);
              triggerFileInput();
            }}
          >
            Aus Datei importieren
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            className="hidden"
            onChange={handleFileChange}
            aria-label="JSON-Datei zum Importieren von Büchern"
            title="JSON-Datei mit Büchereinträgen hochladen"
          />
        </div>
      )}

      <p className="text-sm text-[#364152]">Zeile anklicken, um zur Item-Liste dieses Buchs zu wechseln.</p>

      {status && <p className="text-sm text-green-700">{status}</p>}
      {(error || uploadError) && <p className="text-sm text-red-600">{error || uploadError}</p>}

      {canManage && isAdding && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-[#f2f4f8] p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="new-isbn" className="text-xs font-medium text-[#364152]">
              ISBN
            </label>
            <input
              id="new-isbn"
              type="text"
              placeholder="z.B. 9783060649068"
              value={newIsbn}
              onChange={(e) => setNewIsbn(e.target.value)}
              className="w-40 rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
              aria-label="ISBN für neues Buch"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-name" className="text-xs font-medium text-[#364152]">
              Titel
            </label>
            <input
              id="new-name"
              type="text"
              placeholder="Buchtitel"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="min-w-60 flex-1 rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
              aria-label="Titel für neues Buch"
            />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newIsbn.trim() || !newName.trim()}>
            Speichern
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsAdding(false);
              setError(null);
            }}
          >
            Abbrechen
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-black/10">
        <Table>
          <TableHeader className="bg-[#f2f4f8]">
            <TableRow>
              <TableHead className="w-44">
                <SortHeaderButton
                  label="ISBN"
                  active={sortBy === "isbn"}
                  direction={sortOrder}
                  onClick={() => {
                    if (sortBy === "isbn") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("isbn");
                      setSortOrder("asc");
                    }
                  }}
                />
              </TableHead>
              <TableHead>
                <SortHeaderButton
                  label="Titel"
                  active={sortBy === "name"}
                  direction={sortOrder}
                  onClick={() => {
                    if (sortBy === "name") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("name");
                      setSortOrder("asc");
                    }
                  }}
                />
              </TableHead>
              <TableHead className="w-28 text-right">
                <SortHeaderButton
                  label="Items"
                  active={sortBy === "itemCount"}
                  direction={sortOrder}
                  className="ml-auto"
                  onClick={() => {
                    if (sortBy === "itemCount") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("itemCount");
                      setSortOrder("asc");
                    }
                  }}
                />
              </TableHead>
              {canManage && <TableHead className="w-52">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedBooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="py-6 text-center text-[#364152]">
                  Keine Bücher vorhanden
                </TableCell>
              </TableRow>
            ) : (
              pagedBooks.map((book) => (
                <EditableTableRow
                  key={book.id}
                  isEditing={editingId === book.id}
                  isDeleting={confirmDeleteId === book.id}
                  canManage={canManage}
                  onRowClick={editingId === book.id || confirmDeleteId === book.id ? undefined : () => router.push(`/books/${book.id}`)}
                  rowClassName={editingId === book.id || confirmDeleteId === book.id ? "" : "cursor-pointer"}
                  actionsColumnClassName="w-52"
                  renderViewCells={() => (
                    <>
                      <TableCell>{book.isbn}</TableCell>
                      <TableCell>{book.name}</TableCell>
                      <TableCell className="text-right font-medium text-[#364152]">{book.itemCount}</TableCell>
                    </>
                  )}
                  renderEditCells={() => (
                    <>
                      <TableCell>
                        <input
                          type="text"
                          value={editIsbn}
                          onChange={(e) => setEditIsbn(e.target.value)}
                          className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
                          aria-label={`ISBN für Buch ${book.id}`}
                          placeholder="ISBN"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-black/20 bg-white px-2 py-1 text-sm outline-none focus:border-[#006b2d]"
                          aria-label={`Titel für Buch ${book.id}`}
                          placeholder="Titel"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium text-[#364152]">{book.itemCount}</TableCell>
                    </>
                  )}
                  onStartEdit={() => startEdit(book)}
                  onSaveEdit={() => void saveEdit(book.id)}
                  onCancelEdit={cancelEdit}
                  onStartDelete={() => {
                    setConfirmDeleteId(book.id);
                    setEditingId(null);
                  }}
                  onConfirmDelete={() => void handleDelete(book.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-[#364152]">
        <div className="flex items-center gap-2">
          <label htmlFor="page-size-select" className="font-medium">
            Zeilen pro Seite:
          </label>
          <select
            id="page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
            }}
            className="rounded border border-black/20 px-2 py-1"
            aria-label="Anzahl der Zeilen pro Seite"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Seite {pageIndex + 1} von {pageCount}
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
          >
            Zurück
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
            disabled={pageIndex >= pageCount - 1}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
}
