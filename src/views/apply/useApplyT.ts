import { useLanguage } from "@/contexts/LanguageContext";

/** 申请域双语 hook：zh 内联文案 + en 映射 */
export function useApplyT() {
  const { language } = useLanguage();
  return (k: string, e: string) => (language === "en" && e ? e : k);
}
