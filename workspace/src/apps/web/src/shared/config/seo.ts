import type { MetaDescriptor } from "react-router";

interface CreateMetaOptions {
  title: string;
  description: string;
  noIndex?: boolean;
}

export function createMeta({
  title,
  description,
  noIndex = false,
}: CreateMetaOptions): MetaDescriptor[] {
  const descriptors: MetaDescriptor[] = [
    { title: `${title} | BLUE` },
    { name: "description", content: description },
  ];

  if (noIndex) {
    descriptors.push({ name: "robots", content: "noindex, nofollow" });
  }

  return descriptors;
}
