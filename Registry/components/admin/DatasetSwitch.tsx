"use client";

import { Check, ChevronsUpDown, FolderOpen, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createDataset, renameDataset, setDataset } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCRIPT_LABEL, type Script } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DatasetOption {
  id: string;
  name: string;
}

/** Sidebar picker for the script's datasets: switch, create a new one, or rename the current one. */
export function DatasetSwitch({ script, dataset, datasets }: { script: Script; dataset: string; datasets: DatasetOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<"new" | "rename" | null>(null);
  const [name, setName] = useState("");
  const current = datasets.find((d) => d.id === dataset);

  function choose(id: string) {
    if (id === dataset) return;
    start(async () => {
      const r = await setDataset(id);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  function openDialog(kind: "new" | "rename") {
    setName(kind === "rename" ? (current?.name ?? "") : "");
    setDialog(kind);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = dialog === "new" ? await createDataset(script, name) : await renameDataset(dataset, name);
      if (!r.ok) return void toast.error(r.error);
      toast.success(dialog === "new" ? `Created "${name.trim()}". New uploads go into it.` : "Dataset renamed");
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={pending}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left text-sm transition hover:bg-muted",
              pending && "opacity-60",
            )}
          >
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] leading-tight text-muted-foreground">{SCRIPT_LABEL[script]} dataset</span>
              <span className="block truncate font-medium">{current?.name ?? "Choose a dataset"}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{SCRIPT_LABEL[script]} datasets</DropdownMenuLabel>
          {datasets.map((d) => (
            <DropdownMenuItem key={d.id} onSelect={() => choose(d.id)}>
              <Check className={cn(d.id !== dataset && "invisible")} />
              <span className="truncate">{d.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openDialog("new")}>
            <Plus /> New dataset…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog("rename")} disabled={!current}>
            <Pencil /> Rename this dataset…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && !pending && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{dialog === "new" ? `New ${SCRIPT_LABEL[script]} dataset` : "Rename dataset"}</DialogTitle>
              <DialogDescription>
                {dialog === "new"
                  ? "A separate set of scans with its own surveys. Writers and their consent are shared across datasets."
                  : "Only the name changes; scans and surveys stay as they are."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="dataset-name">Name</Label>
              <Input
                id="dataset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. School visit, March 2027"
                maxLength={80}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                {dialog === "new" ? "Create dataset" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
