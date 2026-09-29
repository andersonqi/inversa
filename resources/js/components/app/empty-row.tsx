import { TableCell, TableRow } from '@/components/ui/table';

export function EmptyRow({
    colSpan,
    children = 'Sin registros.',
}: {
    colSpan: number;
    children?: React.ReactNode;
}) {
    return (
        <TableRow className="hover:bg-transparent">
            <TableCell
                colSpan={colSpan}
                className="py-10 text-center text-sm text-muted-foreground"
            >
                {children}
            </TableCell>
        </TableRow>
    );
}
