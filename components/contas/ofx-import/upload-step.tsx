"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { RiUploadCloudLine, RiFileTextLine, RiErrorWarningLine } from "@remixicon/react";
import { cn } from "@/lib/utils/ui";
import type { FileValidationResult } from "./types";

interface UploadStepProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const ALLOWED_EXTENSION = ".ofx";
const ALLOWED_MIME_TYPES = [
  "application/x-ofx",
  "application/ofx",
  "text/plain",
  "application/octet-stream",
];

export function UploadStep({ onFileSelected, isLoading, error }: UploadStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Validate file before processing
   */
  const validateFile = useCallback((file: File): FileValidationResult => {
    // Check if file is empty
    if (file.size === 0) {
      return {
        isValid: false,
        error: "O arquivo está vazio",
        errorCode: "FILE_EMPTY",
      };
    }

    // Check file size (max 5MB)
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
      return {
        isValid: false,
        error: `O arquivo é muito grande. Tamanho máximo: ${sizeMB}MB`,
        errorCode: "FILE_TOO_LARGE",
      };
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(ALLOWED_EXTENSION)) {
      return {
        isValid: false,
        error: "Apenas arquivos .ofx são permitidos",
        errorCode: "INVALID_EXTENSION",
      };
    }

    // Check MIME type (more lenient since OFX files can have various MIME types)
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      // Don't reject, just warn - OFX files often have incorrect MIME types
      console.warn("Unexpected MIME type:", file.type);
    }

    return { isValid: true };
  }, []);

  /**
   * Handle file selection from input or drag-and-drop
   */
  const handleFileSelect = useCallback(
    (file: File) => {
      setValidationError(null);

      const validation = validateFile(file);
      if (!validation.isValid) {
        setValidationError(validation.error!);
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [validateFile, onFileSelected]
  );

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  /**
   * Trigger file input click
   */
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const displayError = validationError || error;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Importar extrato OFX</h3>
        <p className="text-sm text-muted-foreground">
          Faça upload do arquivo OFX exportado do seu banco (Itaú, Bradesco, etc.)
        </p>
      </div>

      {/* Upload Area */}
      <div className="space-y-4">
        <Label htmlFor="file-upload">Arquivo OFX</Label>
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 transition-colors",
            "flex flex-col items-center justify-center gap-4 text-center",
            "hover:border-primary/50 hover:bg-accent/50 cursor-pointer",
            isDragOver && "border-primary bg-accent",
            displayError && "border-destructive/50 bg-destructive/5",
            isLoading && "pointer-events-none opacity-50"
          )}
          onClick={handleBrowseClick}
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            {isLoading ? (
              <Spinner className="w-8 h-8 text-primary" />
            ) : (
              <RiUploadCloudLine className="w-8 h-8 text-primary" />
            )}
          </div>

          {/* Upload text */}
          {isLoading ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Processando arquivo...</p>
              <p className="text-xs text-muted-foreground">
                Isso pode levar alguns segundos
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Arraste e solte seu arquivo aqui, ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Arquivos .ofx até 5MB
                </p>
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBrowseClick}
              >
                Selecionar arquivo
              </Button>
            </>
          )}

          {/* Hidden file input */}
          <Input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept={ALLOWED_EXTENSION}
            onChange={handleInputChange}
            className="hidden"
            disabled={isLoading}
          />
        </div>

        {/* Selected file info */}
        {selectedFile && !displayError && (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-accent/50">
            <RiFileTextLine className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {displayError && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
            <RiErrorWarningLine className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Erro ao processar arquivo</p>
              <p className="text-xs text-destructive/80 mt-1">{displayError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <p className="font-medium">Como obter o arquivo OFX:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Acesse o site ou aplicativo do seu banco</li>
          <li>Vá para a seção de extratos ou histórico de transações</li>
          <li>Procure a opção "Exportar" ou "Baixar extrato"</li>
          <li>Selecione o formato OFX (também conhecido como Money ou Quicken)</li>
          <li>Escolha o período desejado e faça o download</li>
        </ul>
      </div>
    </div>
  );
}
