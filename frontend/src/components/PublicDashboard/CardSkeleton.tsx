import { Skeleton } from '../../../components/ui/skeleton';

export function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <div className="flex gap-3 items-center">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex justify-between pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
        </div>
    );
}