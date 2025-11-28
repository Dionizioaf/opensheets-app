"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/ui";
import { RiFileUploadLine, RiFileTextLine } from "@remixicon/react";
import * as React from "react";

export interface FileUploadStepProps {
  accountId: string;
  accountName: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

export function FileUploadStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: FileUploadStepProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = React.useCallback((file: File) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.ofx')) {
      alert('Por favor, selecione um arquivo OFX válido.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 10MB.');
      return;
    }

    setSelectedFile(file);
    onDataChange({ file });
  }, [onDataChange]);

  const handleFileInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleBrowseClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Upload do Arquivo OFX</h3>
        <p className="text-sm text-muted-foreground">
          Selecione ou arraste um arquivo OFX exportado do seu banco para importar as transações para a conta <strong>{accountName}</strong>.
        </p>
      </div>

      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          selectedFile ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full">
                <RiFileTextLine className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-700 dark:text-green-300">
                  Arquivo selecionado
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button variant="outline" onClick={handleBrowseClick}>
                Escolher outro arquivo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-full">
                <RiFileUploadLine className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  Arraste e solte seu arquivo OFX aqui
                </p>
                <p className="text-sm text-muted-foreground">
                  ou clique para procurar no seu computador
                </p>
              </div>
              <Button onClick={handleBrowseClick}>
                Procurar arquivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Formatos aceitos: .ofx • Tamanho máximo: 10MB
        </p>
        <p className="text-xs text-muted-foreground">
          Certifique-se de que o arquivo foi exportado recentemente do seu banco
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ofx"
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}