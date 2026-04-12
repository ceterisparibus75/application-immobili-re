"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description?: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

/**
 * Indicateur de progression multi-étapes avec animation.
 * currentStep est 0-indexed.
 */
export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={cn("flex items-center gap-0", className)}>
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full border-2 text-xs font-semibold transition-all duration-300",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground animate-scale-in"
                    : isCurrent
                      ? "border-primary text-primary bg-primary/10"
                      : "border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  "mt-1.5 text-[10px] text-center max-w-[80px] leading-tight transition-colors duration-200",
                  isCurrent ? "text-foreground font-medium" : isCompleted ? "text-primary" : "text-muted-foreground/50",
                )}
              >
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {!isLast && (
              <div className="flex items-center mx-1 mb-5">
                <div
                  className={cn(
                    "h-0.5 w-8 sm:w-12 transition-colors duration-500",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
