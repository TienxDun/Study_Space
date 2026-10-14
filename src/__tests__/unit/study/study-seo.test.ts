import { describe, it, expect } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import manifest from "@/app/manifest";
import { StudyJsonLd } from "@/components/study/seo/StudyJsonLd";
import { StudySeoSemanticContent } from "@/components/study/seo/StudySeoSemanticContent";
import React from "react";
import { renderToString } from "react-dom/server";

describe("SEO - Robots Configuration", () => {
  it("should generate robots config allowing root and disallowing private endpoints", () => {
    const config = robots();
    expect(config.rules).toBeDefined();
    expect(Array.isArray(config.rules)).toBe(true);

    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcardRule = rules.find((r) => r.userAgent === "*");
    expect(wildcardRule).toBeDefined();
    expect(wildcardRule?.allow).toBe("/");
    expect(wildcardRule?.disallow).toContain("/admin/");
    expect(wildcardRule?.disallow).toContain("/api/");
    expect(config.sitemap).toContain("zenstudy.space/sitemap.xml");
  });
});

describe("SEO - Sitemap Configuration", () => {
  it("should generate valid sitemap containing canonical zenstudy.space URL", () => {
    const map = sitemap();
    expect(Array.isArray(map)).toBe(true);
    expect(map.length).toBeGreaterThan(0);

    const rootEntry = map.find((item) => item.url.includes("zenstudy.space") || item.url.endsWith("/"));
    expect(rootEntry).toBeDefined();
    expect(rootEntry?.priority).toBe(1.0);
    expect(rootEntry?.changeFrequency).toBe("weekly");
    expect(rootEntry?.lastModified).toBeDefined();
  });
});

describe("SEO - Manifest Configuration", () => {
  it("should generate valid web app manifest for PWA with ZenStudy Space", () => {
    const pwaManifest = manifest();
    expect(pwaManifest.name).toBe("ZenStudy Space - Không Gian Học Tập Tương Tác & Tập Trung");
    expect(pwaManifest.short_name).toBe("ZenStudy");
    expect(pwaManifest.display).toBe("standalone");
    expect(pwaManifest.icons?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("SEO - JSON-LD Structured Data Schema", () => {
  it("should output valid JSON-LD containing ZenStudy Space WebApplication, WebSite, and FAQPage", () => {
    const html = renderToString(React.createElement(StudyJsonLd, { siteUrl: "https://zenstudy.space" }));
    expect(html).toContain('type="application/ld+json"');

    const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    if (match) {
      const data = JSON.parse(match[1]);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(3);

      const webApp = data.find((item: any) => item["@type"] === "WebApplication");
      expect(webApp).toBeDefined();
      expect(webApp.name).toBe("ZenStudy Space");
      expect(webApp.applicationCategory).toContain("EducationalApplication");
      expect(webApp.featureList.length).toBeGreaterThanOrEqual(5);

      const faq = data.find((item: any) => item["@type"] === "FAQPage");
      expect(faq).toBeDefined();
      expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("SEO - Semantic HTML Content Component", () => {
  it("should render accessible H1, H2, and crawlable feature content with ZenStudy Space", () => {
    const html = renderToString(React.createElement(StudySeoSemanticContent));
    expect(html).toContain("<h1");
    expect(html).toContain("ZenStudy Space");
    expect(html).toContain("<h2");
    expect(html).toContain("sr-only");
    expect(html).toContain("30+ Bối cảnh Sống Động");
    expect(html).toContain("20 âm thanh");
    expect(html).toContain("Pomodoro");
  });
});
