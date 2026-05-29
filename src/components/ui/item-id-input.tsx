"use client";

import { useEffect, useRef, useState } from "react";

import { itemIdSchema } from "@/lib/book-schemas";

export type ItemIdInputFlavor = "return" | "lease" | "search";

type Props = {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: (normalizedItemId: string) => void | Promise<void>;
  submitTrigger?: number;
  clearOnSubmit?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  flavor: ItemIdInputFlavor;
  disabled?: boolean;
  autoSubmitOnValid?: boolean;
  keepFocus?: boolean;
  clearOnInvalidPrefix?: boolean;
  className?: string;
};

type ValidationState = "idle" | "valid" | "invalid";

function getInputClass(validationState: ValidationState) {
  if (validationState === "valid") {
    return "border-green-600 bg-green-200 text-green-950 placeholder:text-green-800 focus:border-green-700";
  }
  if (validationState === "invalid") {
    return "border-red-600 bg-red-200 text-red-950 placeholder:text-red-800 focus:border-red-700";
  }
  return "border-black/20 bg-white text-[#111827] focus:border-[#006b2d]";
}

export function ItemIdInput({
  id,
  label,
  value,
  onValueChange,
  onSubmit,
  submitTrigger,
  clearOnSubmit = false,
  placeholder = "RSV0010000",
  ariaLabel,
  flavor,
  disabled = false,
  autoSubmitOnValid = false,
  keepFocus = false,
  clearOnInvalidPrefix = false,
  className = "w-48",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const validationResetTimerRef = useRef<number | null>(null);
  const lastSubmitTriggerRef = useRef<number | undefined>(submitTrigger);
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shouldClearOnInvalidPrefix = clearOnInvalidPrefix || flavor === "search";

  function scheduleValidationReset(delayMs = 450) {
    if (validationResetTimerRef.current !== null) {
      window.clearTimeout(validationResetTimerRef.current);
    }
    validationResetTimerRef.current = window.setTimeout(() => {
      setValidationState("idle");
      validationResetTimerRef.current = null;
    }, delayMs);
  }

  function focusInput() {
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!keepFocus) {
      return;
    }

    focusInput();

    const onWindowFocus = () => focusInput();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        focusInput();
      }
    };

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [keepFocus]);

  useEffect(() => {
    return () => {
      if (validationResetTimerRef.current !== null) {
        window.clearTimeout(validationResetTimerRef.current);
      }
    };
  }, []);

  async function submit(normalized: string) {
    if (!onSubmit || isSubmitting || disabled) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(normalized);
      if (clearOnSubmit) {
        onValueChange("");
        setValidationState("idle");
      }
    } finally {
      setIsSubmitting(false);
      scheduleValidationReset(550);
      if (keepFocus) {
        focusInput();
      }
    }
  }

  function submitCurrentValue() {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    if (!itemIdSchema.safeParse(normalized).success) {
      if (shouldClearOnInvalidPrefix) {
        onValueChange("");
      }
      setValidationState("invalid");
      scheduleValidationReset();
      return;
    }

    setValidationState("valid");
    void submit(normalized);
  }

  useEffect(() => {
    if (submitTrigger === undefined || submitTrigger === lastSubmitTriggerRef.current) {
      return;
    }

    lastSubmitTriggerRef.current = submitTrigger;
    submitCurrentValue();
  }, [submitTrigger, value]);

  function handleChange(rawValue: string) {
    const normalized = rawValue.toUpperCase();
    const trimmed = normalized.trim();

    const isProgressivePrefix = /^(|R|RS|RSV|RSV\d{0,7})$/.test(trimmed);
    if (!isProgressivePrefix) {
      if (shouldClearOnInvalidPrefix) {
        onValueChange("");
      } else {
        onValueChange(normalized);
      }
      setValidationState("invalid");
      scheduleValidationReset(flavor === "search" ? 350 : 450);
      return;
    }

    onValueChange(normalized);

    if (!trimmed) {
      setValidationState("idle");
      return;
    }

    const isValid = itemIdSchema.safeParse(trimmed).success;
    if (isValid) {
      setValidationState("valid");
      if (autoSubmitOnValid) {
        void submit(trimmed);
      }
      return;
    }

    setValidationState("idle");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    submitCurrentValue();
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-[#364152]">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (keepFocus) {
            window.setTimeout(() => focusInput(), 0);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled || isSubmitting}
        className={`${className} rounded border px-2 py-1 font-mono text-sm outline-none transition-colors duration-150 ${getInputClass(validationState)}`}
        aria-label={ariaLabel ?? label}
      />
    </div>
  );
}
