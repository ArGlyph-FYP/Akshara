"use client";

import { GitBranchPlus, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/admin/Confirm";
import { EmptyState } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { act } from "@/lib/client-action";
import { LEVELS, SCRIPT_LABEL, type Criterion, type Level, type Script } from "@/lib/types";
import { addCriterion, newRubricVersion, updateCriterion } from "./criteria-actions";

type Draft = {
  id?: string;
  key: string;
  labelEn: string;
  labelLocal: string;
  description: string;
  level: Level;
  scaleMin: number;
  scaleMax: number;
  order: number;
  active: boolean;
};

const EMPTY: Draft = { key: "", labelEn: "", labelLocal: "", description: "", level: "line", scaleMin: 1, scaleMax: 5, order: 0, active: true };

export function CriteriaEditor({ script, criteria, version }: { script: Script; criteria: Criterion[]; version: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDialog, ask] = useConfirm();
  const current = criteria.filter((c) => c.rubricVersion === version).sort((a, b) => a.order - b.order);
  const older = criteria.filter((c) => c.rubricVersion !== version);

  async function save() {
    if (!draft) return;
    const fields = { ...draft, script, active: draft.active ? "1" : "0" };
    const ok = draft.id ? await act(updateCriterion, fields) : await act(addCriterion, fields);
    if (ok) {
      setDraft(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-brand-soft text-primary">
          {SCRIPT_LABEL[script]} rubric · version {version}
        </Badge>
        <span className="text-sm text-muted-foreground">Raters score every active criterion. A started main study keeps the version it began with.</span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              ask({
                title: `Start rubric version ${version + 1}?`,
                description: `The active criteria are copied into v${version + 1}. Existing studies and ratings keep v${version}.`,
                confirmLabel: "Start new version",
                onConfirm: async () => (await act(newRubricVersion, { script })) && router.refresh(),
              })
            }
          >
            <GitBranchPlus /> New version
          </Button>
          <Button size="sm" onClick={() => setDraft({ ...EMPTY, order: current.length + 1 })}>
            <Plus /> Add criterion
          </Button>
        </div>
      </div>

      {current.length === 0 ? (
        <EmptyState title="No criteria yet">
          Add the criteria that come out of the perception study, e.g. letter formation, spacing, baseline alignment.
        </EmptyState>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {current.map((c) => (
            <div key={c.id} className={`flex items-start gap-3 px-4 py-3 ${c.active ? "" : "opacity-55"}`}>
              <span className="mt-0.5 w-6 text-right text-xs text-muted-foreground tabular-nums">{c.order}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.labelEn}</span>
                  {c.labelLocal && <span className="text-muted-foreground">{c.labelLocal}</span>}
                  <Badge variant="outline" className="font-normal">
                    {c.level}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {c.scaleMin}–{c.scaleMax}
                  </span>
                  {!c.active && <Badge variant="outline">inactive</Badge>}
                </div>
                <div className="font-mono text-xs text-muted-foreground">{c.key}</div>
                {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.labelEn}`} onClick={() => setDraft({ ...c })}>
                <Pencil />
              </Button>
            </div>
          ))}
        </div>
      )}

      {older.length > 0 && (
        <details className="rounded-xl border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Earlier versions ({older.length} criteria)</summary>
          <ul className="mt-2 space-y-1">
            {older.map((c) => (
              <li key={c.id}>
                v{c.rubricVersion} · <span className="font-mono">{c.key}</span> · {c.labelEn}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit criterion" : "Add criterion"}</DialogTitle>
            <DialogDescription>Raters see the label and guidance next to the score buttons.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="English label" className="col-span-2 sm:col-span-1">
                <Input value={draft.labelEn} onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })} placeholder="Baseline alignment" />
              </Field>
              <Field label={`${SCRIPT_LABEL[script]} label`} className="col-span-2 sm:col-span-1">
                <Input value={draft.labelLocal} onChange={(e) => setDraft({ ...draft, labelLocal: e.target.value })} />
              </Field>
              <Field label="Key (for exports)">
                <Input className="font-mono" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="baseline" />
              </Field>
              <Field label="Level">
                <Select value={draft.level} onValueChange={(v) => setDraft({ ...draft, level: v as Level })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Scale">
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={draft.scaleMin} onChange={(e) => setDraft({ ...draft, scaleMin: Number(e.target.value) })} />
                  <span className="text-muted-foreground">–</span>
                  <Input type="number" value={draft.scaleMax} onChange={(e) => setDraft({ ...draft, scaleMax: Number(e.target.value) })} />
                </div>
              </Field>
              <Field label="Order">
                <Input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })} />
              </Field>
              <Field label="Guidance for raters" className="col-span-2">
                <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              {draft.id && (
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <Switch checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} /> Active
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
