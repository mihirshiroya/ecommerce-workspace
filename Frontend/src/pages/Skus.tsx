import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Plus, Search, Pencil, Link2, Trash2, Package } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PageHeading,
  EmptyState,
  ErrorState,
  Loading,
  SelectField,
} from "../components/workspace/Common";
import SkuEditor from "../components/workspace/SkuEditor";
import MappingPanel from "../components/workspace/MappingPanel";
import { fetcher, errorMessage, remove } from "../api/workspace";
import { categories, type Sku } from "../types/workspace";
export default function Skus() {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("all"),
    [editor, setEditor] = useState<Sku | "new" | null>(null),
    [mapping, setMapping] = useState<Sku | null>(null),
    [deleting, setDeleting] = useState<Sku | null>(null),
    [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR<Sku[]>("/workspace/skus", fetcher);
  const list =
    data?.filter(
      (s) =>
        (category === "all" || s.category === category) &&
        `${s.sku} ${s.name}`.toLowerCase().includes(q.toLowerCase()),
    ) || [];
  async function del() {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove("/workspace/skus/" + deleting.id);
      setDeleting(null);
      await mutate("/workspace/skus");
      await mutate("/workspace/dashboard");
      toast.success("SKU removed");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ONE SOURCE OF TRUTH"
        title="Global SKUs"
        description="Your products, neatly organized. Map one global SKU to every seller account."
        action={
          <Button onClick={() => setEditor("new")}>
            <Plus data-icon="inline-start" />
            Create global SKU
          </Button>
        }
      />
      <div className="filter-bar">
        <div className="search-input">
          <Search size={16} />
          <Input
            aria-label="Search global SKUs"
            placeholder="Search by product name or global SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <SelectField
          id="catalog-category"
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "All categories" },
            ...Object.entries(categories).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            Product catalog{" "}
            <span className="heading-count">{data?.length ?? "—"}</span>
          </CardTitle>
          <CardDescription>
            Catalog details, image URLs, and alternate account SKU mappings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={errorMessage(error)} />
          ) : !list.length ? (
            <EmptyState
              title={
                data?.length
                  ? "No products found"
                  : "Great listings start with a great catalog"
              }
              description={
                data?.length
                  ? "Try a different search or category."
                  : "Create your first global SKU. Reuse product information across accounts without duplicate data entry."
              }
              action={
                <Button variant="outline" onClick={() => setEditor("new")}>
                  <Plus data-icon="inline-start" />
                  Create your first SKU
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Global SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {s.images[0] ? (
                          <img
                            src={s.images[0]}
                            alt=""
                            className="size-10 rounded-md object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="product-icon">
                            <Package size={20} />
                          </span>
                        )}
                        <div className="max-w-60">
                          <strong className="block truncate">{s.name}</strong>
                          <small className="block truncate text-muted-foreground">
                            {s.description || "No description yet"}
                          </small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.sku}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{categories[s.category]}</Badge>
                    </TableCell>
                    <TableCell>{s.images.length}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Map ${s.sku} to accounts`}
                          onClick={() => setMapping(s)}
                        >
                          <Link2 />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${s.sku}`}
                          onClick={() => setEditor(s)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${s.sku}`}
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="section-note">
        Account SKUs can differ from the global SKU. Add multiple alternate
        mappings per product and seller account.
      </p>
      {editor && (
        <SkuEditor
          key={typeof editor === "string" ? "new" : editor.id}
          sku={typeof editor === "string" ? undefined : editor}
          open
          onClose={() => setEditor(null)}
        />
      )}
      {mapping && (
        <MappingPanel
          key={mapping.id}
          sku={mapping}
          onClose={() => setMapping(null)}
        />
      )}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.sku}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. SKUs referenced by mappings or drafts
              cannot be deleted; remove those references first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep SKU
            </Button>
            <Button variant="destructive" disabled={busy} onClick={del}>
              Delete SKU
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
