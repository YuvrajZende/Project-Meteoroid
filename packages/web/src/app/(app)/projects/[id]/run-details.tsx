import { Info } from "lucide-react";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { Run } from "@/lib/generation";
import type { OutputDetail } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function RunDetails({ run, meta }: { run?: Run; meta?: OutputDetail["meta"] }) {
  const result = run?.result;

  if (!result && !meta) {
    return <EmptyState icon={Info} title="No Details Yet" description="Details appear when the generation finishes." />;
  }

  return (
    <div className="flex flex-col gap-8">
      {result?.isQuestion && result.answer && (
        <section className="space-y-3">
          <h2 className="heading-16">Answer</h2>
          <div className="max-w-[68ch] rounded-lg p-4 text-sm leading-6 whitespace-pre-wrap shadow-border">{result.answer}</div>
          {result.suggestion && <p className="text-xs text-muted-foreground">{result.suggestion}</p>}
        </section>
      )}

      <dl className="divide-y border-y">
        {(meta?.language || result?.intentAnalysis) && (
          <Field label="Stack">
            <span className="font-mono text-[13px]" translate="no">
              {[result?.intentAnalysis?.language ?? meta?.language, result?.intentAnalysis?.framework ?? meta?.framework]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Field>
        )}
        {result?.intentAnalysis && (
          <Field label="Intent">
            <div className="space-y-1">
              <div>
                {result.intentAnalysis.intent}{" "}
                <span className="text-muted-foreground tabular">
                  ({Math.round(result.intentAnalysis.confidence * 100)}% confidence)
                </span>
              </div>
              {result.intentAnalysis.reasoning && (
                <p className="text-pretty text-muted-foreground">{result.intentAnalysis.reasoning}</p>
              )}
            </div>
          </Field>
        )}
        {result?.totalDuration !== undefined && (
          <Field label="Duration">
            <span className="tabular">{formatDuration(result.totalDuration)}</span>
          </Field>
        )}
        {!!result?.agentsExecuted?.length && (
          <Field label="Agents">
            <div className="flex flex-wrap gap-1.5">
              {result.agentsExecuted.map((a) => (
                <Badge key={a} variant="secondary" className="font-mono">
                  {a}
                </Badge>
              ))}
            </div>
          </Field>
        )}
        {result?.vectorLearningUsed !== undefined && (
          <Field label="Learned Context">{result.vectorLearningUsed ? "Used similar past projects" : "Not used"}</Field>
        )}
        {meta?.createdAt && <Field label="Created">{formatDateTime(meta.createdAt)}</Field>}
        {meta?.taskId && (
          <Field label="Task ID">
            <span className="font-mono text-[13px]">{meta.taskId}</span>
          </Field>
        )}
      </dl>

      {!!result?.generatedCode?.length && (
        <section className="space-y-3">
          <h2 className="heading-16">Subtasks</h2>
          <ol className="divide-y rounded-lg shadow-border">
            {result.generatedCode.map((g, i) => (
              <li key={i} className="space-y-1 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{g.subtask}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{g.agent}</span>
                </div>
                {g.explanation && <p className="text-sm text-pretty text-muted-foreground">{g.explanation}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {!!result?.errors?.length && (
        <section className="space-y-3">
          <h2 className="heading-16">Warnings</h2>
          <ul className="space-y-1 font-mono text-[13px] text-warning">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
