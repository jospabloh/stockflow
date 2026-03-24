import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-10 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-2">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={`cell-${rowIdx}-${colIdx}`} className="h-12 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}