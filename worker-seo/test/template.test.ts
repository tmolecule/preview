import { test, expect } from "bun:test";
import { renderArticle } from "../src/template.js";

const ENV = { SITE_NAME: "TMolecule", SHOP_ORIGIN: "https://tmolecule.com", LOGO_URL: "https://tmolecule.com/logo.png" };

test("renderArticle emits a Dataset node when seed.dataset present", () => {
  const seed = {
    title: "t", h1: "t", meta_description: "m", body_html: "<p>x</p>",
    dataset: {
      name: "Matcha caffeine",
      description: "mg per serving",
      variableMeasured: [{ name: "Matcha 2g", value: "60-70", unitText: "mg" }]
    }
  };
  const html = renderArticle(seed, "matcha-caffeine", "https://tmolecule.com", ENV, "/learn");
  expect(html).toContain('"@type":"Dataset"');
  expect(html).toContain("Matcha caffeine");
});

test("no Dataset node when seed.dataset absent", () => {
  const seed = { title: "t", h1: "t", meta_description: "m", body_html: "<p>x</p>" };
  const html = renderArticle(seed, "s", "https://tmolecule.com", ENV, "/learn");
  expect(html).not.toContain('"@type":"Dataset"');
});
