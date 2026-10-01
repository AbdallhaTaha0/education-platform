import { apiFetch } from '../../auth';
export interface SchoolPackage {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  pricePiastres: number;
  endsAt: string;
  version: number;
  available: boolean;
  courses: {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    position: number;
    published: boolean;
    grade: string | null;
    academicYear: string | null;
    term: number | null;
    teachingMonth: string | null;
  }[];
}
export interface AdminPackage {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  pricePiastres: number;
  endsAt: string;
  version: number;
  status: string;
  members: { courseId: string; position: number }[];
}
export interface PackageReceipt {
  id: string;
  packageId: string;
  titleAr: string;
  titleEn: string;
  pricePiastres: number;
  endsAt: string;
  createdAt: string;
  items: { courseId: string; titleAr: string; titleEn: string; position: number }[];
}
export async function publicPackages(): Promise<SchoolPackage[]> {
  return (
    await apiFetch<{ data: { packages: SchoolPackage[] } }>('/catalog/packages', {
      retryOnAuth: false,
    })
  ).data.packages;
}
export async function adminPackages(): Promise<AdminPackage[]> {
  return (
    await apiFetch<{ data: { packages: AdminPackage[] } }>('/admin/catalog/packages', {
      retryOnAuth: true,
    })
  ).data.packages;
}
export async function saveSchoolPackage(
  id: string | null,
  body: Record<string, unknown>,
): Promise<void> {
  await apiFetch(
    id ? `/admin/catalog/packages/${encodeURIComponent(id)}` : '/admin/catalog/packages',
    { method: id ? 'PATCH' : 'POST', retryOnAuth: false, body },
  );
}
export async function packageReview(id: string) {
  return (
    await apiFetch<{
      data: {
        packageId: string;
        version: number;
        pricePiastres: number;
        endsAt: string;
        warnings: { code: string; courseIds: string[] }[];
      };
    }>(`/wallet/packages/${encodeURIComponent(id)}/review`, { retryOnAuth: true })
  ).data;
}
export async function buySchoolPackage(
  packageId: string,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<PackageReceipt> {
  return (
    await apiFetch<{ data: PackageReceipt }>('/wallet/package-purchases', {
      method: 'POST',
      retryOnAuth: false,
      body: { packageId, expectedVersion, idempotencyKey },
    })
  ).data;
}
export async function packageHistory(): Promise<PackageReceipt[]> {
  return (
    await apiFetch<{ data: { purchases: PackageReceipt[] } }>('/wallet/package-purchases', {
      retryOnAuth: true,
    })
  ).data.purchases;
}
