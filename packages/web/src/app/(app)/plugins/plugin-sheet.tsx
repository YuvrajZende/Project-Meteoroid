"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, Package, Plug, Variable } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { pluginSelection, usePluginSelection } from "@/lib/plugin-selection";
import type { PluginConfigItem, PluginDefinition } from "@/lib/types";
import { CATEGORY_META, PluginTile } from "./plugin-catalog";

function inputType(type: string) {
  if (type === "password" || type === "secret") return "password";
  if (type === "url") return "url";
  if (type === "number") return "number";
  return "text";
}

export function PluginSheet({ plugin, onOpenChange }: { plugin: PluginDefinition | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!plugin} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        {plugin && <PluginForm key={plugin.id} plugin={plugin} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

/** What attaching this plugin injects into the build, computed by the API's plugin registry. */
function BuildPreview({ item }: { item: PluginConfigItem }) {
  // Only the shape matters for the preview; send placeholder values instead of real secrets.
  const shape: PluginConfigItem = { ...item, config: Object.fromEntries(Object.keys(item.config).map((k) => [k, "preview"])) };
  const deferred = useDeferredValue(JSON.stringify(shape));
  const preview = useQuery({
    queryKey: ["plugin-context", deferred],
    queryFn: () => api.pluginContext([JSON.parse(deferred) as PluginConfigItem]),
    staleTime: 60_000,
  });

  const packages = Object.values(preview.data?.context.packages ?? {}).flat();
  const envVars = Object.keys(preview.data?.context.envVars ?? {});

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-3 rounded-[12px] bg-hover p-3.5">
      <h3 id="preview-heading" className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <Plug className="size-3.5" aria-hidden="true" /> Adds to your build
      </h3>
      {preview.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : preview.isError ? (
        <p className="text-[12.5px] text-ink-3">Preview unavailable. The plugin still applies at build time.</p>
      ) : (
        <dl className="flex flex-col gap-2.5 text-[12.5px]">
          <div className="flex gap-2">
            <dt className="flex w-24 shrink-0 items-center gap-1.5 text-ink-3">
              <Package className="size-3.5" aria-hidden="true" /> Packages
            </dt>
            <dd className="flex min-w-0 flex-wrap gap-1">
              {packages.length ? (
                packages.map((p) => (
                  <code key={p} className="rounded-chip bg-surface px-1.5 py-0.5 font-mono text-[11.5px] shadow-hairline">
                    {p}
                  </code>
                ))
              ) : (
                <span className="text-ink-3">None</span>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="flex w-24 shrink-0 items-center gap-1.5 text-ink-3">
              <Variable className="size-3.5" aria-hidden="true" /> Env vars
            </dt>
            <dd className="flex min-w-0 flex-wrap gap-1">
              {envVars.length ? (
                envVars.map((v) => (
                  <code key={v} className="rounded-chip bg-surface px-1.5 py-0.5 font-mono text-[11.5px] shadow-hairline">
                    {v}
                  </code>
                ))
              ) : (
                <span className="text-ink-3">None</span>
              )}
            </dd>
          </div>
          <p className="text-ink-3">Agents also write the client setup and wire it into your routes.</p>
        </dl>
      )}
    </section>
  );
}

function PluginForm({ plugin, onDone }: { plugin: PluginDefinition; onDone: () => void }) {
  const selection = usePluginSelection();
  const existing = selection[plugin.id];
  const [values, setValues] = useState<Record<string, string>>(existing?.config ?? {});
  const [errors, setErrors] = useState<string[]>([]);
  const meta = CATEGORY_META[plugin.category];

  const item = (): PluginConfigItem => ({
    pluginId: plugin.id,
    name: plugin.name,
    category: plugin.category,
    config: Object.fromEntries(
      Object.entries(values)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v),
    ),
  });

  const test = useMutation({
    mutationFn: () => api.testPlugins([item()]),
    onSuccess: (res) => {
      const r = res.results[0];
      if (r?.reachable) toast.success(`Connected in ${r.latencyMs} ms`);
      else toast.error(r?.error ? `Connection failed: ${r.error}` : "Connection failed. Check the values and try again.");
    },
    onError: (error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: () => api.validatePlugins([item()]),
    onSuccess: (res) => {
      const r = res.results[0];
      if (r && !r.valid) {
        setErrors(r.errors);
        return;
      }
      pluginSelection.set({ ...item(), pluginId: plugin.id });
      toast.success(`${plugin.name} attached to your next build`);
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        setErrors([]);
        save.mutate();
      }}
    >
      <SheetHeader className="flex-row items-center gap-3">
        <PluginTile plugin={plugin} className="size-11" />
        <div className="min-w-0">
          <SheetTitle className="flex items-center gap-2">
            {plugin.name}
            {existing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11.5px] font-medium text-brand-ink">
                <Check className="size-3" aria-hidden="true" /> Attached
              </span>
            )}
          </SheetTitle>
          <SheetDescription>{meta?.label ?? plugin.category}</SheetDescription>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        <p className="text-[14px] text-pretty text-ink-2">{plugin.description}</p>

        {plugin.fields.length > 0 && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 text-[13px] font-medium">Settings</legend>
            {plugin.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`plugin-${field.key}`}>
                  {field.label}
                  {!field.required && <span className="font-normal text-muted-foreground"> (optional)</span>}
                </Label>
                <Input
                  id={`plugin-${field.key}`}
                  name={field.key}
                  type={inputType(field.type)}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder ? `${field.placeholder.replace(/…$|\.\.\.$/, "")}…` : undefined}
                  autoComplete={field.type === "password" || field.type === "secret" ? "new-password" : "off"}
                  spellCheck={false}
                />
              </div>
            ))}
            <p className="text-xs text-ink-3">Credentials stay in this browser tab and are sent only with your build request.</p>
          </fieldset>
        )}

        <BuildPreview item={item()} />

        {!!errors.length && (
          <ul role="alert" className="space-y-1 text-sm text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t">
        {existing && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto"
            onClick={() => {
              pluginSelection.remove(plugin.id);
              toast.success(`${plugin.name} detached`);
              onDone();
            }}
          >
            Detach
          </Button>
        )}
        {plugin.connectionTest && plugin.fields.length > 0 && (
          <Button type="button" variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending && <Loader2 className="animate-spin" />} Test Connection
          </Button>
        )}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />} {existing ? "Save Plugin" : "Attach Plugin"}
        </Button>
      </SheetFooter>
    </form>
  );
}
