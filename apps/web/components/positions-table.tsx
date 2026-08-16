import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JsonPosition } from "@/lib/api";
import { asString, decimalMetadata, formatTokenRaw, shortenHex } from "@/lib/format";

export function PositionsTable({ positions }: { positions: JsonPosition[] }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        title="No supported Moonwell positions"
        description="This address has no open supported Moonwell Core supply or borrow at the current Base safe head. Unsupported markets are omitted rather than estimated."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supported positions</CardTitle>
        <CardDescription>
          Raw Comptroller snapshots. Amounts are integer token units, not estimated USD.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Supplied</TableHead>
              <TableHead>Borrowed</TableHead>
              <TableHead>Collateral</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => {
              const symbol = asString(position.metadata.underlyingSymbol) ?? shortenHex(position.underlying);
              const decimals = decimalMetadata(position.metadata);
              return (
                <TableRow key={position.market}>
                  <TableCell>
                    <div className="font-medium">{symbol}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {shortenHex(position.market)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatTokenRaw(position.suppliedRaw, decimals)}
                    <div className="text-xs text-muted-foreground">{position.suppliedRaw}</div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatTokenRaw(position.borrowedRaw, decimals)}
                    <div className="text-xs text-muted-foreground">{position.borrowedRaw}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={position.collateralEnabled ? "default" : "outline"}>
                      {position.collateralEnabled ? "enabled" : "off"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
