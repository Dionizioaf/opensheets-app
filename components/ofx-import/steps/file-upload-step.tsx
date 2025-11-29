"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/ui";
import { RiFileUploadLine, RiFileTextLine, RiCloseLine, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import * as React from "react";

export interface FileUploadStepProps {
  accountId: string;
  accountName: string;
  wizardData: Record<string, any>;
  onDataChange: (data: any) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ['.ofx', '.qfx'];

interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export function FileUploadStep({
  accountId,
  accountName,
  wizardData,
  onDataChange,
}: FileUploadStepProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load existing file from wizard data
  React.useEffect(() => {
    const existingFile = wizardData.upload?.file;
    if (existingFile) {
      setSelectedFile(existingFile);
    }
  }, [wizardData.upload]);

  const validateFile = React.useCallback((file: File): FileValidationResult => {
    // Check file type
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ACCEPTED_FILE_TYPES.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Tipo de arquivo não suportado. Use apenas arquivos ${ACCEPTED_FILE_TYPES.join(' ou ')}.`
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `Arquivo muito grande. O tamanho máximo é ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'O arquivo está vazio.'
      };
    }

    return { isValid: true };
  }, []);

  const processFile = React.useCallback(async (file: File) => {
    setIsProcessing(true);
    setValidationError(null);

    try {
      const validation = validateFile(file);
      if (!validation.isValid) {
        setValidationError(validation.error!);
        setSelectedFile(null);
        onDataChange({ file: null, error: validation.error });
        return;
      }

      // Simulate file processing (in real implementation, this would parse the OFX file)
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSelectedFile(file);
      onDataChange({
        file,
        parsed: true,
        error: null
      });
    } catch (error) {
      const errorMessage = 'Erro ao processar o arquivo. Tente novamente.';
      setValidationError(errorMessage);
      setSelectedFile(null);
      onDataChange({ file: null, error: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  }, [validateFile, onDataChange]);

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
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleBrowseClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveFile = React.useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    onDataChange({ file: null, error: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onDataChange]);

  const formatFileSize = React.useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium">Upload do Arquivo OFX</h3>
        <p className="text-sm text-muted-foreground">
          Selecione ou arraste um arquivo OFX para importar transações para a conta <strong>{accountName}</strong>.
        </p>
      </div>

      {/* File Upload Area */}
      <Card>
        <CardContent className="p-6">
          {!selectedFile ? (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                "hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25",
                validationError && "border-destructive/50 bg-destructive/5"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              role="button"
              tabIndex={0}
              aria-label="Selecionar arquivo OFX para upload"
              aria-describedby="file-upload-description"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBrowseClick();
                }
              }}
            >
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 text-muted-foreground">
                  <RiFileUploadLine className="w-full h-full" aria-hidden="true" />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {isDragOver ? "Solte o arquivo aqui" : "Arraste e solte um arquivo OFX aqui"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ou <button
                      type="button"
                      className="text-primary hover:underline focus:outline-none focus:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBrowseClick();
                      }}
                      aria-label="Abrir seletor de arquivos"
                    >
                      clique para procurar
                    </button>
                  </p>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Formatos aceitos: {ACCEPTED_FILE_TYPES.join(', ')}</p>
                  <p>Tamanho máximo: {MAX_FILE_SIZE / (1024 * 1024)}MB</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES.join(',')}
                onChange={handleFileSelect}
                className="sr-only"
                aria-label="Selecionar arquivo OFX"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                <div className="flex-shrink-0">
                  <RiFileTextLine className="w-8 h-8 text-primary" aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)} •
                    Modificado em {new Date(selectedFile.lastModified).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isProcessing ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      <span className="text-sm">Processando...</span>
                    </div>
                  ) : (
                    <RiCheckLine className="w-5 h-5 text-green-600" aria-hidden="true" />
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    disabled={isProcessing}
                    aria-label={`Remover arquivo ${selectedFile.name}`}
                  >
                    <RiCloseLine className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Processing Status */}
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Analisando arquivo e extraindo transações...
                </div>
              )}

              {/* Success Message */}
              {!isProcessing && !validationError && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <RiCheckLine className="w-4 h-4" aria-hidden="true" />
                  Arquivo processado com sucesso! Clique em "Próximo" para continuar.
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {validationError && (
            <div
              className="flex items-start gap-2 p-3 border border-destructive/50 rounded-lg bg-destructive/5 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              <RiErrorWarningLine className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium">Erro no arquivo</p>
                <p>{validationError}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <h4 className="font-medium">Como obter um arquivo OFX:</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Acesse o internet banking do seu banco</li>
              <li>Procure por "Extrato" ou "Exportar dados"</li>
              <li>Selecione o período desejado</li>
              <li>Escolha o formato OFX/QFX para download</li>
              <li>Arraste o arquivo baixado para esta área</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Hidden description for screen readers */}
      <div id="file-upload-description" className="sr-only">
        Área de upload para arquivos OFX. Arraste um arquivo para esta área ou clique para abrir o seletor de arquivos.
        Apenas arquivos com extensão .ofx ou .qfx são aceitos, com tamanho máximo de 10MB.
      </div>
    </div>
  );
}

export default FileUploadStep;