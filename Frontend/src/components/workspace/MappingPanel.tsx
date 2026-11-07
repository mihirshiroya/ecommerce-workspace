import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SelectField, TextField, ErrorState, EmptyState } from "./Common";
import { fetcher, save, remove, errorMessage } from "../../api/workspace";
import {
  marketplaces,
  type Sku,
  type Mapping,
  type Account,
} from "../../types/workspace";
export default function MappingPanel({
  sku,
  onClose,
}: {
  sku: Sku;
  onClose: () => void;
}) {
  const { data: accounts = [] } = useSWR<Account[]>(
    "/workspace/accounts",
    fetcher,
  );
  const { data, mutate: refresh } = useSWR<Mapping[]>(
    `/workspace/mappings?sku=${sku.id}`,
    fetcher,
  );
  const [editing, setEditing] = useState<Mapping | undefined>(),
    [accountId, setAccountId] = useState(""),
    [accountSku, setAccountSku] = useState(""),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      await save(
        "/workspace/mappings",
        {
          global_sku_id: sku.id,
          account_id: accountId,
          account_sku: accountSku,
          marketplace_ref: reference,
          notes: editing?.notes || "",
        },
        editing?.id,
      );
      await refresh();
      setEditing(undefined);
      setAccountSku("");
      setReference("");
      toast.success(
        editing ? "Account SKU mapping updated" : "Account SKU mapping added",
      );
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function del(m: Mapping) {
    try {
      await remove("/workspace/mappings/" + m.id);
      await refresh();
      toast.success("Mapping removed");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Account SKU mappings</SheetTitle>
          <SheetDescription>
            {sku.name} · {sku.sku}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 p-4">
          <p className="text-sm text-muted-foreground">
            One global product, as many alternate account SKUs as you need.
            Choose the exact mapping when creating a listing.
          </p>
          {data?.length ? (
            <div className="flex flex-col gap-3">
              {data.map((m) => {
                const a = accounts.find((a) => a.id === m.account_id);
                return (
                  <div className="mapping-row" key={m.id}>
                    <div>
                      <strong className="font-mono text-sm">
                        {m.account_sku}
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {a?.name || "Seller account"}
                        {a ? ` · ${marketplaces[a.marketplace]}` : ""}
                      </p>
                      {m.marketplace_ref && (
                        <Badge variant="outline">{m.marketplace_ref}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit mapping ${m.account_sku}`}
                      onClick={() => {
                        setEditing(m);
                        setAccountId(m.account_id);
                        setAccountSku(m.account_sku);
                        setReference(m.marketplace_ref);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove mapping ${m.account_sku}`}
                      onClick={() => void del(m)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No account mappings yet"
              description="Add the SKU this seller account uses for this product."
            />
          )}
          <Separator />
          <form onSubmit={submit}>
            <FieldGroup>
              <SelectField
                id="mapping-account"
                label="Seller account"
                value={accountId}
                onChange={(v) => {
                  if (!editing) setAccountId(v);
                }}
                options={accounts
                  .filter((a) => a.status === "active")
                  .map((a) => ({
                    value: a.id,
                    label: `${a.name} · ${marketplaces[a.marketplace]}`,
                  }))}
              />
              <TextField
                id="mapping-sku"
                label="Account SKU"
                value={accountSku}
                onChange={setAccountSku}
                required
                placeholder="e.g. STORE-A-ER-001"
              />
              <TextField
                id="mapping-reference"
                label="Marketplace reference (optional)"
                value={reference}
                onChange={setReference}
                placeholder="FSN, listing ID, or catalog reference"
              />
              {failure && <ErrorState message={failure} />}
              <Button disabled={busy || !accountId}>
                <Plus data-icon="inline-start" />
                {busy
                  ? "Saving…"
                  : editing
                    ? "Save mapping"
                    : "Add alternate mapping"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(undefined);
                    setAccountSku("");
                    setReference("");
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </FieldGroup>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
