import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { TemplateField, Values } from "../../types/workspace";
export default function SchemaFields({
  fields,
  values,
  onChange,
  prefix,
  overrides = false,
}: {
  fields: TemplateField[];
  values: Values;
  onChange: (id: string, value: string) => void;
  prefix: string;
  overrides?: boolean;
}) {
  const groups = [...new Set(fields.map((f) => f.group))];
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <details
          className="schema-group"
          key={group}
          open={group === "Pricing & tax"}
        >
          <summary>
            <span>{group}</span>
            <Badge variant="outline">
              {fields.filter((f) => f.group === group && f.required).length}{" "}
              required
            </Badge>
          </summary>
          <FieldGroup className="schema-fields">
            {fields
              .filter((f) => f.group === group)
              .map((f) => {
                const id = `${prefix}-${f.id}`;
                return (
                  <Field key={f.id}>
                    <FieldLabel htmlFor={id}>
                      {f.label}
                      {f.required && !overrides && (
                        <span className="text-primary">*</span>
                      )}
                      <span className="field-column">{f.column}</span>
                    </FieldLabel>
                    {f.options.length && !f.multiValue ? (
                      <Select
                        value={
                          values[f.id] === undefined || values[f.id] === ""
                            ? "__inherit"
                            : String(values[f.id])
                        }
                        onValueChange={(v) =>
                          onChange(f.id, v === "__inherit" ? "" : v)
                        }
                      >
                        <SelectTrigger id={id} className="w-full">
                          <SelectValue
                            placeholder={
                              overrides
                                ? "Use common value"
                                : "Choose a template value"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="__inherit">
                              {overrides ? "Use common value" : "Not selected"}
                            </SelectItem>
                            {f.options.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
                        <Input
                          id={id}
                          list={
                            f.multiValue && f.options.length
                              ? `${id}-options`
                              : undefined
                          }
                          aria-describedby={
                            f.multiValue ? `${id}-multi-help` : undefined
                          }
                          maxLength={f.maxLength}
                          type={
                            f.type === "number"
                              ? "number"
                              : f.type === "url"
                                ? "url"
                                : "text"
                          }
                          min={
                            f.type === "number" ? (f.minimum ?? 0) : undefined
                          }
                          step={
                            f.type === "number"
                              ? f.integer
                                ? 1
                                : "any"
                              : undefined
                          }
                          value={String(values[f.id] ?? "")}
                          onChange={(e) => onChange(f.id, e.target.value)}
                          placeholder={
                            overrides
                              ? "Use common value"
                              : f.type === "url"
                                ? "https://…"
                                : ""
                          }
                        />
                        {f.multiValue && f.options.length > 0 && (
                          <datalist id={`${id}-options`}>
                            {f.options.map((value) => (
                              <option key={value} value={value} />
                            ))}
                          </datalist>
                        )}
                        {f.multiValue && (
                          <FieldDescription id={`${id}-multi-help`}>
                            Separate values with {"::"}.
                            {f.options.length > 0 &&
                              ` Allowed values: ${f.options.join(", ")}`}
                          </FieldDescription>
                        )}
                      </>
                    )}
                    {f.description && (
                      <FieldDescription
                        className="line-clamp-2"
                        title={f.description}
                      >
                        {f.description}
                      </FieldDescription>
                    )}
                  </Field>
                );
              })}
          </FieldGroup>
        </details>
      ))}
    </div>
  );
}
