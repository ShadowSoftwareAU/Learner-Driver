import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Camera, Trash2, ImageIcon } from "lucide-react";
import { uploadFileToBucket, storageUrl } from "@/lib/upload";
import { useToast } from "@/hooks/use-toast";

interface PhotoCaptureFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  /** Stored object path, or null when nothing uploaded yet. */
  value: string | null;
  onChange: (objectPath: string | null) => void;
  /** Render the preview as a circle (used for headshots). */
  rounded?: boolean;
  disabled?: boolean;
}

/**
 * Single image field that supports both gallery upload and camera capture
 * (works on mobile and desktop), with an inline preview of the uploaded image.
 */
export function PhotoCaptureField({
  label,
  description,
  required,
  value,
  onChange,
  rounded = false,
  disabled,
}: PhotoCaptureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const previewUrl = storageUrl(value);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { objectPath } = await uploadFileToBucket(file);
      onChange(objectPath);
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-sm font-medium">{label}</p>
        {required && <span className="text-xs text-destructive">*</span>}
      </div>
      {description && <p className="text-xs text-muted-foreground mb-3">{description}</p>}

      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 overflow-hidden border border-border bg-muted flex items-center justify-center ${
            rounded ? "w-16 h-16 rounded-full" : "w-24 h-16 rounded-md"
          }`}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              className="h-8 px-3 text-xs"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span className="ml-1.5">{value ? "Replace" : "Upload"}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading || disabled}
              className="h-8 px-3 text-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="ml-1.5">Camera</span>
            </Button>
            {value && !disabled && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(null)}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
