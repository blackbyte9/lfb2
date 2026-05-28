import { useRef, useState } from "react";

type FileUploadConfig = {
  endpoint: string;
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
  acceptedTypes?: string;
};

export function useFileUpload({ endpoint, onSuccess, onError, acceptedTypes = "*" }: FileUploadConfig) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(null);
    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        const errorMsg = data.error ?? "Upload fehlgeschlagen";
        setError(errorMsg);
        onError?.(errorMsg);
      } else {
        const successMsg = data.message ?? "Upload abgeschlossen";
        setStatus(successMsg);
        onSuccess?.(data);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  function clearStatus() {
    setStatus(null);
    setError(null);
  }

  return {
    fileInputRef,
    handleFileChange,
    triggerFileInput,
    status,
    error,
    isLoading,
    clearStatus,
    acceptedTypes,
  };
}
