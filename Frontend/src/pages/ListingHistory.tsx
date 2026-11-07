import { useState } from "react";
import { date } from "../lib/date";
import useSWR from "swr";
import { Download, Search, FileSpreadsheet, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  PageHeading,
  EmptyState,
  Loading,
  ErrorState,
} from "../components/workspace/Common";
import { fetcher, errorMessage, downloadFile } from "../api/workspace";
import api from "../api/config";
import type { ExportFile, Account } from "../types/workspace";
export default function ListingHistory() {
  const { data, error, isLoading, mutate } = useSWR<ExportFile[]>(
    "/workspace/history",
    fetcher,
  );
  const { data: accounts } = useSWR<Account[]>("/workspace/accounts", fetcher);
  const [q, setQ] = useState(""),
    [busy, setBusy] = useState("");
  async function download(f: ExportFile) {
    setBusy(f.id);
    try {
      await downloadFile(f);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function retry(file: ExportFile) {
    setBusy(file.id);
    try {
      const response = await api.post(
        `/workspace/history/${file.id}/retry`,
        {},
      );
      await mutate();
      if (response.data.data.status === "completed")
        toast.success(
          "A new workbook was generated from the original snapshot.",
        );
      else
        toast.error(
          response.data.data.failure || "This export is still unavailable.",
        );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  const files =
    data?.filter((f) => f.filename.toLowerCase().includes(q.toLowerCase())) ||
    [];
  return (
    <>
      <PageHeading
        eyebrow="EVERY EXPORT, ACCOUNTED FOR"
        title="Listing history"
        description="Reproducible files, immutable snapshots. Your export trail stays intact."
        action={
          <Button asChild>
            <Link to="/listing">
              <Plus data-icon="inline-start" />
              New bulk listing
            </Link>
          </Button>
        }
      />
      <div className="filter-bar">
        <div className="search-input">
          <Search size={16} />
          <Input
            aria-label="Search export history"
            placeholder="Search exported filenames…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Badge variant="outline">{data?.length ?? "—"} files</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Exported workbooks</CardTitle>
          <CardDescription>
            One account, one file. Downloads are authenticated and checksum
            verified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={errorMessage(error)} />
          ) : !files.length ? (
            <EmptyState
              title="Your next export belongs here"
              description="Generate a bulk listing to keep an account-specific workbook, its template version, and an immutable snapshot."
              action={
                <Button variant="outline" asChild>
                  <Link to="/listing">Create a listing</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workbook</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet size={21} className="text-primary" />
                        <div className="max-w-72">
                          <strong className="block truncate">
                            {f.filename}
                          </strong>
                          <small className="text-muted-foreground">
                            {f.template_key} · {Math.ceil(f.size / 1024)} KB
                          </small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {accounts?.find((a) => a.id === f.account_id)?.name ||
                        "Seller account"}
                    </TableCell>
                    <TableCell>{f.row_count}</TableCell>
                    <TableCell>{date(f.created_at)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          f.status === "completed" ? "secondary" : "destructive"
                        }
                      >
                        {f.status}
                      </Badge>
                      {f.failure && (
                        <p className="mt-1 max-w-60 text-xs text-muted-foreground">
                          {f.failure}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.status === "failed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === f.id}
                          onClick={() => void retry(f)}
                        >
                          Retry
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={busy === f.id || f.status !== "completed"}
                          aria-label={`Download ${f.filename}`}
                          onClick={() => void download(f)}
                        >
                          <Download />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="section-note">
        Changing a product or seller account does not change an existing export.
        Files are not submitted to marketplaces automatically.
      </p>
    </>
  );
}
