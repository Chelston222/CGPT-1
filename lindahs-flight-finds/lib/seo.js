import { appConfig } from "../data/deals";

export function absoluteUrl(pathname = "/") {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalized, appConfig.baseUrl).toString();
}

export function titleWithBrand(title) {
  return `${title} | ${appConfig.name}`;
}
