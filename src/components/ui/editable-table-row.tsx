import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

type EditableTableRowProps = {
  isEditing: boolean;
  isDeleting: boolean;
  canManage: boolean;
  canDelete?: boolean;
  onRowClick?: () => void;
  rowClassName?: string;
  actionsColumnClassName?: string;
  renderViewCells: () => ReactNode;
  renderEditCells: () => ReactNode;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

export function EditableTableRow({
  isEditing,
  isDeleting,
  canManage,
  canDelete = true,
  onRowClick,
  rowClassName = "",
  actionsColumnClassName = "",
  renderViewCells,
  renderEditCells,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
}: EditableTableRowProps) {
  return (
    <TableRow onClick={onRowClick} className={rowClassName}>
      {isEditing ? renderEditCells() : renderViewCells()}
      {canManage && (
        <TableCell className={actionsColumnClassName}>
          {isEditing ? (
            <div className="flex gap-1">
              <Button
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveEdit();
                }}
              >
                Speichern
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEdit();
                }}
              >
                Abbrechen
              </Button>
            </div>
          ) : isDeleting ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#364152]">Sicher?</span>
              <Button
                size="xs"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmDelete();
                }}
              >
                Ja, löschen
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelDelete();
                }}
              >
                Abbrechen
              </Button>
            </div>
          ) : (
            <div className="flex gap-1">
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit();
                }}
              >
                Bearbeiten
              </Button>
              {canDelete ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartDelete();
                  }}
                >
                  Löschen
                </Button>
              ) : null}
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}