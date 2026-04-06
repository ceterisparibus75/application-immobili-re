"use client";

import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { DashboardAlert } from "@/actions/dashboard";

const alertConfig = {
  danger: {
    icon: AlertTriangle,
    bgColor: "bg-[var(--color-status-negative-bg)] dark:bg-red-950/30",
    borderColor: "border-[var(--color-status-negative)]/30 dark:border-red-800",
    iconColor: "text-[var(--color-status-negative)] dark:text-red-400",
    badgeVariant: "destructive" as const,
  },
  warning: {
    icon: AlertCircle,
    bgColor: "bg-[var(--color-status-caution-bg)] dark:bg-orange-950/30",
    borderColor: "border-[var(--color-status-caution)]/30 dark:border-orange-800",
    iconColor: "text-[var(--color-status-caution)] dark:text-orange-400",
    badgeVariant: "outline" as const,
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
    badgeVariant: "secondary" as const,
  },
} as const;

interface AlertsPanelProps {
  alerts: DashboardAlert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alertes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucune alerte en cours</p>
        </CardContent>
      </Card>
    );
  }

  const dangerCount = alerts.filter((a) => a.type === "danger").length;
  const warningCount = alerts.filter((a) => a.type === "warning").length;
  const infoCount = alerts.filter((a) => a.type === "info").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Alertes</CardTitle>
        <div className="flex gap-2">
          {dangerCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {dangerCount}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="gap-1 border-[var(--color-status-caution)]/30 text-[var(--color-status-caution)] dark:border-orange-700 dark:text-orange-400">
              <AlertCircle className="h-3 w-3" />
              {warningCount}
            </Badge>
          )}
          {infoCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Info className="h-3 w-3" />
              {infoCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto">
          <div className="space-y-1 px-6 pb-6">
            {alerts.map((alert) => {
              const config = alertConfig[alert.type];
              const Icon = config.icon;
              return (
                <Link
                  key={alert.id}
                  href={alert.link}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 ${config.bgColor} ${config.borderColor}`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-tight">{alert.title}</p>
                      <Badge variant={config.badgeVariant} className="text-[10px] px-1.5 py-0 shrink-0">
                        {alert.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.message}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
