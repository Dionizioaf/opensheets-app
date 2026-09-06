"use client";

import {
  AVAILABLE_MODELS,
  DEFAULT_PROVIDER,
  PROVIDERS,
  type AIProvider,
} from "@/app/(dashboard)/insights/data";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RiExternalLinkLine } from "@remixicon/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const PROVIDER_ICON_PATHS: Record<
  AIProvider,
  { light: string; dark?: string }
> = {
  openai: {
    light: "/providers/chatgpt.svg",
    dark: "/providers/chatgpt_dark_mode.svg",
  },
  anthropic: {
    light: "/providers/claude.svg",
  },
  google: {
    light: "/providers/gemini.svg",
  },
  openrouter: {
    light: "/providers/openrouter_light.svg",
    dark: "/providers/openrouter_dark.svg",
  },
  openollama: {
    light: "/providers/ollama.svg",
  },
};

export function ModelSelector({
  value,
  onValueChange,
  disabled,
}: ModelSelectorProps) {
  // Estado para armazenar o provider selecionado manualmente
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
    null
  );
  const [customModel, setCustomModel] = useState(value);
  const [openOllamaModels, setOpenOllamaModels] = useState<string[]>([]);

  // Sincronizar customModel quando value mudar (importante para pré-carregamento)
  useEffect(() => {
    // Prefixos explícitos distinguem modelos customizados entre providers.
    if (value.startsWith("openollama/")) {
      setCustomModel(value.slice("openollama/".length));
      setSelectedProvider("openollama");
    } else if (value.includes("/")) {
      setCustomModel(value);
      setSelectedProvider("openrouter");
    } else {
      setCustomModel(value);
      // Keep a manually selected provider while the user types a custom model.
      // Otherwise an unknown model such as "llama3.1:8b" falls back to OpenAI
      // and the custom input disappears on every keystroke.
      if (AVAILABLE_MODELS.some((model) => model.id === value)) {
        setSelectedProvider(null);
      }
    }
  }, [value]);

  // Determinar provider atual baseado no modelo selecionado ou provider manual
  const currentProvider = useMemo(() => {
    // Se há um provider selecionado manualmente, use-o
    if (selectedProvider) {
      return selectedProvider;
    }

    // Se o modelo tem "/" é OpenRouter
    if (value.includes("/")) {
      return "openrouter";
    }

    // Caso contrário, tente detectar baseado no modelo
    const model = AVAILABLE_MODELS.find((m) => m.id === value);
    return model?.provider ?? DEFAULT_PROVIDER;
  }, [value, selectedProvider]);

  useEffect(() => {
    if (currentProvider !== "openollama") {
      return;
    }

    let cancelled = false;
    fetch("/api/ai/openollama/models")
      .then(async (response) => {
        if (!response.ok) {
          return { models: [] };
        }
        return (await response.json()) as { models?: unknown };
      })
      .then((result) => {
        if (cancelled) {
          return;
        }

        const models = Array.isArray(result.models)
          ? result.models.filter(
              (model): model is string => typeof model === "string"
            )
          : [];
        setOpenOllamaModels(models);
      })
      .catch(() => {
        if (!cancelled) {
          setOpenOllamaModels([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentProvider]);

  // Agrupar modelos por provider
  const modelsByProvider = useMemo(() => {
    const grouped: Record<
      AIProvider,
      Array<(typeof AVAILABLE_MODELS)[number]>
    > = {
      openai: [],
      anthropic: [],
      google: [],
      openrouter: [],
      openollama: [],
    };

    AVAILABLE_MODELS.forEach((model) => {
      grouped[model.provider].push(model);
    });

    return grouped;
  }, []);

  // Atualizar provider (seleciona primeiro modelo daquele provider)
  const handleProviderChange = (newProvider: AIProvider) => {
    setSelectedProvider(newProvider);

    if (newProvider === "openrouter") {
      onValueChange(customModel.includes("/") ? customModel : "");
      return;
    }

    if (newProvider === "openollama") {
      const firstModel = modelsByProvider.openollama[0];
      onValueChange(firstModel?.id ?? "");
      return;
    }

    const firstModel = modelsByProvider[newProvider][0];
    if (firstModel) {
      onValueChange(firstModel.id);
    }
  };

  // Atualizar modelo customizado do OpenRouter/OpenOllama
  const handleCustomModelChange = (modelName: string) => {
    setCustomModel(modelName);
    onValueChange(
      currentProvider === "openollama"
        ? modelName.length > 0
          ? `openollama/${modelName}`
          : ""
        : modelName
    );
  };

  return (
    <Card className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-6 items-start p-6">
      {/* Descrição */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Definir modelo de análise</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Escolha o provedor de IA e o modelo específico que será utilizado para
          gerar insights sobre seus dados financeiros. <br />
          Diferentes modelos podem oferecer perspectivas variadas na análise.
        </p>
      </div>

      {/* Seletor */}
      <div className="flex flex-col gap-4 min-w-xs">
        <RadioGroup
          value={currentProvider}
          onValueChange={(v) => handleProviderChange(v as AIProvider)}
          disabled={disabled}
          className="gap-3"
        >
          {(Object.keys(PROVIDERS) as AIProvider[]).map((providerId) => {
            const provider = PROVIDERS[providerId];
            const iconPaths = PROVIDER_ICON_PATHS[providerId];

            return (
              <div key={providerId} className="flex items-center gap-3">
                <RadioGroupItem
                  value={providerId}
                  id={`provider-${providerId}`}
                  disabled={disabled}
                />
                <div className="size-6 relative">
                  <Image
                    src={iconPaths.light}
                    alt={provider.name}
                    width={22}
                    height={22}
                    className={iconPaths.dark ? "dark:hidden" : ""}
                  />
                  {iconPaths.dark && (
                    <Image
                      src={iconPaths.dark}
                      alt={provider.name}
                      width={22}
                      height={22}
                      className="hidden dark:block"
                    />
                  )}
                </div>
                <Label
                  htmlFor={`provider-${providerId}`}
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  {provider.name}
                </Label>
              </div>
            );
          })}
        </RadioGroup>

        {/* Seletor de Modelo */}
        {currentProvider === "openrouter" || currentProvider === "openollama" ? (
          <div className="space-y-2">
            <Input
              value={customModel}
              onChange={(e) => handleCustomModelChange(e.target.value)}
              list={currentProvider === "openollama" ? "openollama-models" : undefined}
              placeholder={
                currentProvider === "openollama"
                  ? "Ex: openollama/llama3.2"
                  : "Ex: anthropic/claude-3.5-sonnet"
              }
              disabled={disabled}
              className="border-none bg-neutral-200 dark:bg-neutral-800"
            />
            {currentProvider === "openollama" && (
              <datalist id="openollama-models">
                {openOllamaModels.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            )}
            {currentProvider === "openollama" && openOllamaModels.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {openOllamaModels.length} modelo(s) disponível(is) no Ollama local.
              </p>
            )}
            <a
              href="https://openrouter.ai/models"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RiExternalLinkLine className="h-3 w-3" />
              Ver modelos disponíveis no OpenRouter
            </a>
          </div>
        ) : (
          <Select
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
          >
            <SelectTrigger
              disabled={disabled}
              className="border-none bg-neutral-200 dark:bg-neutral-800"
            >
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              {modelsByProvider[currentProvider].map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </Card>
  );
}
