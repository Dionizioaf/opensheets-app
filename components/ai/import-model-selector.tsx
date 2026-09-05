"use client";

import { AVAILABLE_MODELS } from "@/app/(dashboard)/insights/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface ImportModelSelectorProps {
    value: "gpt-5.1" | "gpt-5.1-chat" | "gpt-5" | "gpt-5-mini" | "gpt-5-nano" | "claude-4.5-haiku" | "claude-4.5-sonnet" | "claude-opus-4.1" | "gemini-2.5-pro" | "gemini-2.5-flash";
    onValueChange: (value: string) => void;
    disabled?: boolean;
}

const CUSTOM_MODEL_VALUE = "__custom__";
const AVAILABLE_MODEL_IDS = new Set(AVAILABLE_MODELS.map((model) => model.id));

export function ImportModelSelector({
    value,
    onValueChange,
    disabled,
}: ImportModelSelectorProps) {
    const [customSelectedWithEmptyValue, setCustomSelectedWithEmptyValue] = useState(
        value.length > 0 && !AVAILABLE_MODEL_IDS.has(value),
    );
    const isKnownModel = AVAILABLE_MODEL_IDS.has(value);
    const isCustomSelected =
        (value.length > 0 && !isKnownModel) ||
        (value.length === 0 && customSelectedWithEmptyValue);
    const selectValue = isCustomSelected ? CUSTOM_MODEL_VALUE : value;

    const handleSelectChange = (nextValue: string) => {
        if (nextValue === CUSTOM_MODEL_VALUE) {
            setCustomSelectedWithEmptyValue(true);
            if (isKnownModel) {
                onValueChange("");
            }
            return;
        }

        setCustomSelectedWithEmptyValue(false);
        onValueChange(nextValue);
    };

    const handleCustomModelChange = (model: string) => {
        onValueChange(model);
    };

    return (
        <div className="space-y-2">
            <Label htmlFor="import-model-select" className="text-xs font-medium">
                Modelo de IA
            </Label>
            <Select
                value={selectValue}
                onValueChange={handleSelectChange}
                disabled={disabled}
            >
                <SelectTrigger
                    id="import-model-select"
                    disabled={disabled}
                    className="h-8 border-muted-foreground/20 bg-background"
                >
                    <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                            {model.name}
                        </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_MODEL_VALUE}>Modelo customizado</SelectItem>
                </SelectContent>
            </Select>

            {selectValue === CUSTOM_MODEL_VALUE && (
                <Input
                    id="import-model-custom"
                    value={isKnownModel ? "" : value}
                    onChange={(e) => handleCustomModelChange(e.target.value)}
                    placeholder="Ex: anthropic/claude-3.5-sonnet"
                    disabled={disabled}
                    className="h-8"
                />
            )}
        </div>
    );
}
