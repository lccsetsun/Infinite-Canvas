export type TextNodeViewKind = "idle" | "ready" | "running" | "error" | "success";

interface TextNodeViewStateInput {
  errorText: string;
  isRunning: boolean;
  promptText: string;
  responseText: string;
}

interface TextNodeViewState {
  accentClass: string;
  description: string;
  kind: TextNodeViewKind;
  label: string;
  shortLabel: string;
}

export function getTextNodeViewState({
  errorText,
  isRunning,
  promptText,
  responseText,
}: TextNodeViewStateInput): TextNodeViewState {
  if (isRunning) {
    return {
      accentClass: "text-cyan-200 border-cyan-300/30 bg-cyan-300/10",
      description: "正在请求远程模型，等待返回结果",
      kind: "running",
      label: "请求中",
      shortLabel: "RUN",
    };
  }

  if (errorText.trim()) {
    return {
      accentClass: "text-amber-200 border-amber-300/35 bg-amber-300/10",
      description: "请求失败，检查接口配置或输入内容后重试",
      kind: "error",
      label: "异常",
      shortLabel: "ERR",
    };
  }

  if (responseText.trim()) {
    return {
      accentClass: "text-emerald-200 border-emerald-300/30 bg-emerald-300/10",
      description: "已生成文本输出，可复制、预览或继续串联下游节点",
      kind: "success",
      label: "成功",
      shortLabel: "OK",
    };
  }

  if (promptText.trim()) {
    return {
      accentClass: "text-indigo-100 border-indigo-300/28 bg-indigo-300/10",
      description: "输入已就绪，点击运行发送到远程模型",
      kind: "ready",
      label: "已输入",
      shortLabel: "READY",
    };
  }

  return {
    accentClass: "text-white/55 border-white/12 bg-white/[0.04]",
    description: "等待输入一段提示词或接入上游文本",
    kind: "idle",
    label: "默认",
    shortLabel: "IDLE",
  };
}
