import React from "react";

export function LoadingSkeleton({ rows = 4, className = "" }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      <div className="h-6 w-1/3 rounded bg-line" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-surface border border-line" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 animate-pulse space-y-3">
      <div className="h-4 w-1/4 rounded bg-line" />
      <div className="h-8 w-1/2 rounded bg-line" />
      <div className="h-3 w-3/4 rounded bg-line" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, actionText, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/50 p-10 text-center">
      {Icon && (
        <div className="mb-3 rounded-full bg-canvas p-3 text-muted">
          <Icon size={24} />
        </div>
      )}
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      {actionText && onAction && (
        <button type="button" onClick={onAction} className="btn-primary mt-4 text-xs py-1.5 px-3">
          {actionText}
        </button>
      )}
    </div>
  );
}
