"use client";

import Calculator from "@/components/calculadora/calculator";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/ui";
import { RiCalculatorFill, RiCalculatorLine } from "@remixicon/react";
import * as React from "react";

type Variant = React.ComponentProps<typeof Button>["variant"];
type Size = React.ComponentProps<typeof Button>["size"];

type CalculatorDialogButtonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: React.ReactNode;
  withTooltip?: boolean;
};

export function CalculatorDialogButton({
  variant = "ghost",
  size = "sm",
  className,
  children,
  withTooltip = false,
}: CalculatorDialogButtonProps) {
  // Client-side only rendering to avoid hydration issues
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [open, setOpen] = React.useState(false);

  // Prevent hydration issues by only rendering on client
  if (!mounted) {
    return null;
  }

  // Se withTooltip for true, usa o estilo do header
  if (withTooltip) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Calculadora"
                aria-expanded={open}
                data-state={open ? "open" : "closed"}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "group relative text-muted-foreground transition-all duration-200",
                  "hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40",
                  "data-[state=open]:bg-accent/60 data-[state=open]:text-foreground border",
                  className
                )}
              >
                <RiCalculatorLine
                  className={cn(
                    "size-4 transition-transform duration-200",
                    open ? "scale-90" : "scale-100"
                  )}
                />
                <span className="sr-only">Calculadora</span>
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Calculadora
          </TooltipContent>
        </Tooltip>
        <DialogContent className="p-4 sm:max-w-sm">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <RiCalculatorLine className="h-5 w-5" />
              Calculadora
            </DialogTitle>
          </DialogHeader>
          <Calculator />
        </DialogContent>
      </Dialog>
    );
  }

  // Estilo padrão para outros usos
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={cn(className)}>
          {children ?? (
            <RiCalculatorFill className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="p-4 sm:max-w-sm">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <RiCalculatorLine className="h-5 w-5" />
            Calculadora
          </DialogTitle>
        </DialogHeader>
        <Calculator />
      </DialogContent>
    </Dialog>
  );
}
