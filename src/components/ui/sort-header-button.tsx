type SortHeaderButtonProps = {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  className?: string;
};

export function SortHeaderButton({ label, active, direction, onClick, className = "" }: SortHeaderButtonProps) {
  return (
    <button type="button" className={`flex items-center gap-1 hover:text-[#006b2d] ${className}`} onClick={onClick}>
      {label}
      <span className="text-xs">{active ? (direction === "asc" ? "↑" : "↓") : ""}</span>
    </button>
  );
}