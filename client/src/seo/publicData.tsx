import { createContext, useContext, type ReactNode } from 'react';
import type { PublicCourse } from '../features/catalog/types/models';
import type { SchoolPackage } from '../features/academic/api';
import type { Lang } from '../i18n';

export interface PublicPageData {
  lang: Lang;
  path: string;
  page: 'home' | 'courses' | 'course-detail' | 'package' | 'support' | 'not-found';
  pageNumber: number;
  pageSize: number;
  courses?: PublicCourse[];
  packages?: SchoolPackage[];
  course?: PublicCourse;
  pkg?: SchoolPackage;
  contact?: { email: string; phone: string; version: number } | null;
  origin?: string;
  indexing: boolean;
}
const Context = createContext<PublicPageData | null>(null);
export function PublicDataProvider({
  data,
  children,
}: {
  data: PublicPageData | null;
  children: ReactNode;
}): JSX.Element {
  return <Context.Provider value={data}>{children}</Context.Provider>;
}
export function usePublicData(): PublicPageData | null {
  return useContext(Context);
}
export function readPublicData(): PublicPageData | null {
  const node = document.getElementById('public-page-data');
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as PublicPageData;
  } catch {
    return null;
  }
}
