import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type PromptField = { key: string; label: string; initial?: string; placeholder?: string; optional?: boolean; type?: string };

export type PromptRequest = { title: string; description?: string; fields: PromptField[]; submitLabel?: string };

type Resolver = (values: Record<string, string> | null) => void;

/**
 * Promise 化的自定义输入对话框，用于替代浏览器原生 window.prompt。
 * 原生 prompt 弹窗顶部会强制展示站点域名，无法去除；此组件提供同等的输入能力且样式与系统一致。
 */
export function useFormPrompt() {
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const resolverRef = useRef<Resolver | null>(null);

  const open = (req: PromptRequest) => {
    setValues(Object.fromEntries(req.fields.map(field => [field.key, field.initial ?? String(field.type === "number" ? "" : "")])));
    setRequest(req);
    return new Promise<Record<string, string> | null>(resolve => {
      resolverRef.current = resolve;
    });
  };

  const settle = (result: Record<string, string> | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  };

  const missingRequired = (request?.fields ?? []).some(field => !field.optional && !(values[field.key] ?? "").trim());

  const host = (
    <Dialog open={request !== null} onOpenChange={isOpen => { if (!isOpen) settle(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          {request?.description ? <DialogDescription>{request.description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-3">
          {(request?.fields ?? []).map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium">
                {field.label}
                {field.optional ? <span className="ml-1 text-xs font-normal text-[#829081]">（可留空）</span> : null}
              </label>
              <Input
                type={field.type ?? "text"}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
                autoFocus={field === request?.fields[0]}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(null)}>取消</Button>
          <Button
            disabled={missingRequired}
            onClick={() => {
              if (!request) return;
              const filled = Object.fromEntries(request.fields.map(field => [field.key, (values[field.key] ?? "").trim()]));
              settle(filled);
            }}
            className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"
          >
            {request?.submitLabel ?? "确定"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { open, host };
}
