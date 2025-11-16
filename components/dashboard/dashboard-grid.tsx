import WidgetCard from "@/components/widget-card";
import type { DashboardData } from "@/lib/dashboard/fetch-dashboard-data";
import { widgetsConfig } from "@/lib/dashboard/widgets/widgets-config";

type DashboardGridProps = {
  data: DashboardData;
  period: string;
};

export function DashboardGrid({ data, period }: DashboardGridProps) {
  return (
    <section className="grid grid-cols-1 gap-3 @4xl/main:grid-cols-2 @6xl/main:grid-cols-3">
      {widgetsConfig.map((widget) => (
        <WidgetCard
          key={widget.id}
          title={widget.title}
          subtitle={widget.subtitle}
          icon={widget.icon}
          action={widget.action}
        >
          {widget.component({ data, period })}
        </WidgetCard>
      ))}
    </section>
  );
}
