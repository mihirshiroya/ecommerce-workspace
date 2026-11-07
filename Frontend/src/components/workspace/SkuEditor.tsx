import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TextField, SelectField, ErrorState } from "./Common";
import { save, errorMessage } from "../../api/workspace";
import { categories, type Category, type Sku } from "../../types/workspace";
export default function SkuEditor({
  sku,
  open,
  onClose,
  onSaved,
  initialCategory = "earring",
}: {
  sku?: Sku;
  open: boolean;
  onClose: () => void;
  onSaved?: (sku: Sku) => void;
  initialCategory?: Category;
}) {
  const [form, setForm] = useState({
      sku: sku?.sku || "",
      name: sku?.name || "",
      category: sku?.category || initialCategory,
      description: sku?.description || "",
      notes: sku?.notes || "",
      images: sku?.images.join("\n") || "",
      attributes: JSON.stringify(sku?.attributes || {}, null, 2),
    }),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const { mutate } = useSWRConfig();
  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      let attributes: unknown;
      try {
        attributes = JSON.parse(form.attributes);
      } catch {
        throw new Error("Common attributes must be valid JSON.");
      }
      if (
        !attributes ||
        typeof attributes !== "object" ||
        Array.isArray(attributes)
      )
        throw new Error(
          "Common attributes must be a JSON object with text, number, or boolean values.",
        );
      const row = await save<Sku>(
        "/workspace/skus",
        {
          ...form,
          attributes,
          images: form.images
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean),
        },
        sku?.id,
      );
      await mutate("/workspace/skus");
      await mutate("/workspace/dashboard");
      onSaved?.(row);
      onClose();
      toast.success(sku ? "Global SKU updated" : "Global SKU created");
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {sku ? "Edit global SKU" : "Create global SKU"}
          </DialogTitle>
          <DialogDescription>
            Your catalog is the source of truth. Listing-specific edits stay
            separate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <div className="form-columns">
              <TextField
                id="sku-code"
                label="Global SKU"
                value={form.sku}
                onChange={(v) => field("sku", v)}
                placeholder="e.g. ER-GOLD-001"
                required
              />
              <SelectField
                id="sku-category"
                label="Category"
                value={form.category}
                onChange={(v) => field("category", v)}
                options={Object.entries(categories).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
            <TextField
              id="sku-name"
              label="Product name"
              value={form.name}
              onChange={(v) => field("name", v)}
              required
            />
            <TextField
              id="sku-description"
              label="Description"
              value={form.description}
              onChange={(v) => field("description", v)}
              multiline
            />
            <TextField
              id="sku-images"
              label="Product image URLs"
              value={form.images}
              onChange={(v) => field("images", v)}
              multiline
              description="One public HTTPS URL per line, up to 8. First URL is the primary image. Only URLs are saved; images are not uploaded or copied. Use direct publicly accessible image links, not cloud storage share pages."
            />
            <TextField
              id="sku-attributes"
              label="Common attributes (advanced JSON)"
              value={form.attributes}
              onChange={(v) => field("attributes", v)}
              multiline
              description="Optional template field IDs mapped to text, numbers, or booleans. Listing-specific edits do not change these catalog values."
            />
            <TextField
              id="sku-notes"
              label="Internal notes"
              value={form.notes}
              onChange={(v) => field("notes", v)}
              multiline
            />
            {failure && <ErrorState message={failure} />}
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy}>
                {busy ? "Saving…" : sku ? "Save changes" : "Create SKU"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
