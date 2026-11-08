import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import type { Account } from "../../types/workspace";

import { filenameError } from "../../lib/exportFilename";

export default function ExportFilenames({
  accounts,
  filenames,
  onChange,
  disabled,
}: {
  accounts: Account[];
  filenames: Record<string, string>;
  onChange: (accountId: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <section
      className="mt-6 flex flex-col gap-4"
      aria-labelledby="export-filenames-title"
    >
      <div>
        <h3 id="export-filenames-title" className="font-medium">
          Flipkart Excel filenames
        </h3>
        <p className="text-muted-foreground text-sm mt-1">
          Enter the filename for each account. We add .xlsx if needed and save
          the name with your draft and export history. No automatic ID or date
          will be added.
        </p>
      </div>
      <FieldGroup>
        {accounts.map((account) => {
          const value = filenames[account.id] || "";
          const error = value ? filenameError(value) : "";
          const id = `export-filename-${account.id}`;
          return (
            <Field key={account.id} data-invalid={!!error}>
              <FieldLabel htmlFor={id}>
                {account.name} — Excel filename *
              </FieldLabel>
              <Input
                id={id}
                value={value}
                required
                disabled={disabled}
                maxLength={200}
                placeholder="C_earring_your-account-id_FK_REQ123.xlsx"
                autoComplete="off"
                aria-invalid={!!error}
                aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
                onChange={(event) => onChange(account.id, event.target.value)}
              />
              <FieldDescription id={`${id}-description`}>
                {error || !value.trim()
                  ? "Use the exact filename you want to download."
                  : `Download as: ${/\.xlsx$/i.test(value.trim()) ? value.trim() : `${value.trim()}.xlsx`}`}
              </FieldDescription>
              {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
            </Field>
          );
        })}
      </FieldGroup>
    </section>
  );
}
