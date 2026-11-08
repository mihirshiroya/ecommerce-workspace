import { useState, type FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Plus, Search, Pencil, Trash2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
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
  TextField,
  SelectField,
  EmptyState,
  Loading,
  ErrorState,
} from "../components/workspace/Common";
import { fetcher, save, remove, errorMessage } from "../api/workspace";
import {
  marketplaces,
  type Account,
  type Marketplace,
} from "../types/workspace";
import { toast } from "sonner";
const blank = {
  name: "",
  marketplace: "meesho" as Marketplace,
  seller_id: "",
  business_name: "",
  contact_email: "",
  address: "",
  notes: "",
  status: "active" as Account["status"],
};
export default function Accounts() {
  const [q, setQ] = useState(""),
    [platform, setPlatform] = useState("all"),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Account | null>(null),
    [form, setForm] = useState(blank),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [deleting, setDeleting] = useState<Account | null>(null);
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR<Account[]>(
    "/workspace/accounts",
    fetcher,
  );
  const list =
    data?.filter(
      (a) =>
        (platform === "all" || a.marketplace === platform) &&
        `${a.name} ${a.seller_id} ${a.business_name}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    ) || [];
  function edit(a?: Account) {
    setEditing(a || null);
    setForm(a ? { ...a } : blank);
    setFailure("");
    setOpen(true);
  }
  function field<K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      await save("/workspace/accounts", form, editing?.id);
      await mutate("/workspace/accounts");
      await mutate("/workspace/dashboard");
      setOpen(false);
      toast.success(editing ? "Account updated" : "Seller account added");
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove("/workspace/accounts/" + deleting.id);
      setDeleting(null);
      await mutate("/workspace/accounts");
      await mutate("/workspace/dashboard");
      toast.success("Account removed");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR MARKETPLACE NETWORK"
        title="Ecommerce accounts"
        description="One home for every seller account. No marketplace credentials needed."
        action={
          <Button onClick={() => edit()}>
            <Plus data-icon="inline-start" />
            Add account
          </Button>
        }
      />
      <div className="filter-bar">
        <div className="search-input">
          <Search size={16} />
          <Input
            aria-label="Search accounts"
            placeholder="Search accounts or account IDs…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <SelectField
          label="Marketplace"
          id="filter-marketplace"
          value={platform}
          onChange={setPlatform}
          options={[
            { value: "all", label: "All marketplaces" },
            ...Object.entries(marketplaces).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            Seller accounts{" "}
            <span className="heading-count">{data?.length ?? "—"}</span>
          </CardTitle>
          <CardDescription>
            Manage account details, seller identities, and listing availability.
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
                  ? "No matching accounts"
                  : "Your marketplaces, connected"
              }
              description={
                data?.length
                  ? "Try another search or marketplace filter."
                  : "Add your first seller account to organize SKUs and generate account-specific listing files."
              }
              action={
                <Button variant="outline" onClick={() => edit()}>
                  <Store data-icon="inline-start" />
                  Add a seller account
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className={`market-letter ${a.marketplace}`}>
                          {a.marketplace.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{a.name}</strong>
                          <p className="text-xs text-muted-foreground">
                            {a.business_name ||
                              a.contact_email ||
                              "Seller account"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{marketplaces[a.marketplace]}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.seller_id || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          a.status === "active" ? "secondary" : "outline"
                        }
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${a.name}`}
                          onClick={() => edit(a)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${a.name}`}
                          onClick={() => setDeleting(a)}
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
        These are organizational accounts, not API connections. Amazon listing
        exports are not available without a supported template.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit seller account" : "Add seller account"}
            </DialogTitle>
            <DialogDescription>
              Keep the seller details you need for accurate account-specific
              exports.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <FieldGroup className="gap-4">
              <TextField
                id="account-name"
                label="Account name"
                value={form.name}
                onChange={(v) => field("name", v)}
                required
                placeholder="e.g. Studio jewellery — primary"
              />
              <div className="form-columns">
                <SelectField
                  id="account-marketplace"
                  label="Marketplace"
                  value={form.marketplace}
                  onChange={(v) => field("marketplace", v as Marketplace)}
                  options={Object.entries(marketplaces).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
                <SelectField
                  id="account-status"
                  label="Status"
                  value={form.status}
                  onChange={(v) => field("status", v as Account["status"])}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              </div>
              <TextField
                id="seller-id"
                label={`${marketplaces[form.marketplace]} Account ID`}
                value={form.seller_id}
                onChange={(v) => field("seller_id", v)}
                required
                placeholder={`Enter your ${marketplaces[form.marketplace]} account ID`}
                description={
                  form.marketplace === "flipkart"
                    ? "Enter the seller/account ID from Flipkart Seller Hub. Choose your Excel filename in the final bulk listing step. Use letters, numbers, underscores or hyphens."
                    : `Enter the seller/account ID from your ${marketplaces[form.marketplace]} seller account, not your login email or password.`
                }
              />
              <TextField
                id="business-name"
                label="Business name"
                value={form.business_name}
                onChange={(v) => field("business_name", v)}
              />
              <TextField
                id="account-email"
                label="Contact email"
                type="email"
                value={form.contact_email}
                onChange={(v) => field("contact_email", v)}
              />
              <TextField
                id="account-address"
                label="Business address"
                value={form.address}
                onChange={(v) => field("address", v)}
                multiline
              />
              <TextField
                id="account-notes"
                label="Notes"
                value={form.notes}
                onChange={(v) => field("notes", v)}
                multiline
              />
              {failure && <ErrorState message={failure} />}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={busy}>
                  {busy ? "Saving…" : editing ? "Save changes" : "Add account"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Referenced accounts cannot be deleted. You can deactivate the
              account instead to preserve its mappings and listing history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep account
            </Button>
            <Button variant="destructive" disabled={busy} onClick={del}>
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
