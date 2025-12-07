import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state para a página de relatório de categorias
 * Mantém o mesmo layout da página final
 */
export default function RelatoriosCategoriasLoading() {
    return (
        <main className="flex flex-col gap-6">
            {/* Header com título e descrição */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-96 rounded-2xl bg-foreground/10" />
                <Skeleton className="h-5 w-64 rounded-2xl bg-foreground/10" />
            </div>

            {/* Filtros */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <Skeleton className="h-10 w-64 rounded-2xl bg-foreground/10" />
                    <Skeleton className="h-10 w-40 rounded-2xl bg-foreground/10" />
                    <Skeleton className="h-10 w-40 rounded-2xl bg-foreground/10" />
                </div>
                <Skeleton className="h-10 w-32 rounded-2xl bg-foreground/10" />
            </div>

            {/* Tabela */}
            <div className="rounded-lg border">
                <div className="overflow-x-auto">
                    <div className="min-w-full">
                        {/* Header da tabela */}
                        <div className="flex border-b bg-muted/50 p-4">
                            <Skeleton className="h-6 w-32 rounded bg-foreground/10" />
                            <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                            <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                            <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                            <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                        </div>

                        {/* Linhas da tabela */}
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex border-b p-4">
                                <Skeleton className="h-6 w-32 rounded bg-foreground/10" />
                                <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                                <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                                <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                                <Skeleton className="ml-4 h-6 w-24 rounded bg-foreground/10" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
