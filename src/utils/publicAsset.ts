/** Путь к файлу из `public/` с учётом Vite `base` (важно для деплоя не в корень домена). */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${clean}`;
}
