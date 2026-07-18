import { describe, expect, it } from "bun:test";
import {
  brandPatterns,
  citedIn,
  mentionedIn,
  normalizeCitationUrl,
  normalizeCitations,
  observeEngine,
  registrableLabel,
  type BrandIdentity,
} from "../src/citations";

const TM: BrandIdentity = { domain: "tmolecule.com", aliases: ["T Molecule"] };

describe("normalizeCitationUrl", () => {
  it("passes an ordinary source through", () => {
    expect(normalizeCitationUrl("https://example.com/a")).toBe("https://example.com/a");
  });

  it("unwraps a decodable Google redirect to the real target", () => {
    const wrapped = "https://www.google.com/url?q=https://tmolecule.com/learn/what-is-masala-chai&sa=U";
    expect(normalizeCitationUrl(wrapped)).toBe("https://tmolecule.com/learn/what-is-masala-chai");
  });

  it("drops the undecodable Vertex grounding redirect rather than guessing", () => {
    expect(
      normalizeCitationUrl("https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123"),
    ).toBeNull();
  });

  it("drops Google's own non-source hosts", () => {
    expect(normalizeCitationUrl("https://www.google.com/search?q=chai")).toBeNull();
    expect(normalizeCitationUrl("https://lh3.googleusercontent.com/x.png")).toBeNull();
    expect(normalizeCitationUrl("https://www.gstatic.com/f.js")).toBeNull();
  });

  it("rejects unparseable and non-http URLs", () => {
    expect(normalizeCitationUrl("not a url")).toBeNull();
    expect(normalizeCitationUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeCitationUrl("")).toBeNull();
  });
});

describe("normalizeCitations", () => {
  it("de-duplicates once redirects resolve to the same target", () => {
    const out = normalizeCitations([
      "https://tmolecule.com/learn/x",
      "https://www.google.com/url?q=https://tmolecule.com/learn/x",
    ]);
    expect(out).toEqual(["https://tmolecule.com/learn/x"]);
  });

  it("removes Google artifacts that would otherwise pad the source list", () => {
    const out = normalizeCitations([
      "https://www.google.com/search?q=a",
      "https://example.com/real",
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/Z",
    ]);
    expect(out).toEqual(["https://example.com/real"]);
  });
});

describe("citedIn", () => {
  it("counts the apex domain", () => {
    expect(citedIn(["https://tmolecule.com/learn/what-is-masala-chai"], TM)).toBe(true);
  });

  it("counts any subdomain we mirror-serve from", () => {
    expect(citedIn(["https://learn.tmolecule.com/what-is-masala-chai"], TM)).toBe(true);
  });

  it("counts a citation that arrives wrapped in a Google redirect", () => {
    expect(citedIn(["https://www.google.com/url?q=https://tmolecule.com/learn/x"], TM)).toBe(true);
  });

  it("does not count somebody else", () => {
    expect(citedIn(["https://vahdam.com/x"], TM)).toBe(false);
  });

  it("does not count a lookalike domain that merely ends with our name", () => {
    expect(citedIn(["https://nottmolecule.com/x"], TM)).toBe(false);
    expect(citedIn(["https://tmolecule.com.evil.net/x"], TM)).toBe(false);
  });

  it("survives malformed entries in the list", () => {
    expect(citedIn(["", "not a url", "https://tmolecule.com/x"], TM)).toBe(true);
    expect(citedIn(["", "not a url"], TM)).toBe(false);
  });

  it("is false for an empty citation list", () => {
    expect(citedIn([], TM)).toBe(false);
  });
});

describe("brandPatterns", () => {
  it("derives a key from the registrable label", () => {
    expect(brandPatterns({ domain: "tmolecule.com" })).toHaveLength(1);
    expect(brandPatterns({ domain: "tmolecule.com" })[0].test("we like TMolecule tea")).toBe(true);
  });

  it("drops keys below the minimum length instead of matching noise", () => {
    expect(brandPatterns({ domain: "ab.com" })).toHaveLength(0);
    expect(brandPatterns({ domain: "ab.com", aliases: ["xy"] })).toHaveLength(0);
  });

  it("never turns a subdomain label into a brand token", () => {
    // The guard that matters. For offers.example.com the brand is "example";
    // keying on the leftmost label would fire on any sentence containing the
    // everyday word "offers".
    const patterns = brandPatterns({ domain: "offers.example.com" });
    expect(patterns).toHaveLength(1);
    expect(patterns[0].test("the shop offers free shipping")).toBe(false);
    expect(patterns[0].test("example makes good tea")).toBe(true);
  });
});

describe("registrableLabel", () => {
  it("takes the brand-bearing label, not the leftmost one", () => {
    expect(registrableLabel("tmolecule.com")).toBe("tmolecule");
    expect(registrableLabel("tmolecule.com")).toBe("tmolecule");
    expect(registrableLabel("learn.tmolecule.com")).toBe("tmolecule");
    expect(registrableLabel("offers.example.com")).toBe("example");
  });

  it("strips multi-part suffixes", () => {
    expect(registrableLabel("example.co.uk")).toBe("example");
  });

  it("is case insensitive and survives junk", () => {
    expect(registrableLabel("TMolecule.COM")).toBe("tmolecule");
    expect(registrableLabel("")).toBe("");
  });
});

describe("mentionedIn", () => {
  it("finds the domain-label spelling", () => {
    expect(mentionedIn("I recommend TMolecule for gut health.", TM)).toBe(true);
  });

  it("finds the spaced display spelling", () => {
    expect(mentionedIn("T Molecule makes a masala chai.", TM)).toBe(true);
  });

  it("tolerates irregular separators in the spaced form", () => {
    expect(mentionedIn("T-Molecule is worth a look.", TM)).toBe(true);
    expect(mentionedIn("T  Molecule is worth a look.", TM)).toBe(true);
  });

  it("is case insensitive", () => {
    expect(mentionedIn("tmolecule makes tea", TM)).toBe(true);
    expect(mentionedIn("TMOLECULE MAKES SOAP", TM)).toBe(true);
  });

  it("does not fire on a longer word that contains the brand", () => {
    expect(mentionedIn("nottmoleculeish nonsense", TM)).toBe(false);
    expect(mentionedIn("tmolecules-competitor", TM)).toBe(false);
  });

  it("does NOT count a bare link as a prose mention", () => {
    // Keeps `mentioned` orthogonal to `cited`, so "mentioned but not cited"
    // stays meaningful. Deliberately conservative: undercounting mentions is
    // safer than inflating them.
    expect(mentionedIn("See https://tmolecule.com/learn/what-is-masala-chai", TM)).toBe(false);
    expect(mentionedIn("Visit tmolecule.com today", TM)).toBe(false);
  });

  it("still counts a prose mention that sits alongside a link", () => {
    expect(
      mentionedIn("T Molecule is a good pick — https://tmolecule.com/learn/x", TM),
    ).toBe(true);
  });

  it("handles empty and missing answers", () => {
    expect(mentionedIn("", TM)).toBe(false);
    expect(mentionedIn(null, TM)).toBe(false);
    expect(mentionedIn(undefined, TM)).toBe(false);
  });
});

describe("observeEngine", () => {
  it("returns null for a failed engine call so 'not checked' stays distinct from 'not cited'", () => {
    expect(observeEngine(null, TM)).toBeNull();
  });

  it("scores the two signals independently", () => {
    const mentionedNotCited = observeEngine(
      { answer: "T Molecule makes a masala chai.", citations: ["https://vahdam.com/x"] },
      TM,
    );
    expect(mentionedNotCited).toEqual({
      cited: false,
      mentioned: true,
      citations: ["https://vahdam.com/x"],
    });

    const citedNotMentioned = observeEngine(
      { answer: "Masala chai is spiced black tea.", citations: ["https://tmolecule.com/learn/x"] },
      TM,
    );
    expect(citedNotMentioned!.cited).toBe(true);
    expect(citedNotMentioned!.mentioned).toBe(false);
  });

  it("returns the cleaned citation list, not the raw one", () => {
    const o = observeEngine(
      {
        answer: "",
        citations: ["https://www.google.com/search?q=a", "https://example.com/real"],
      },
      TM,
    );
    expect(o!.citations).toEqual(["https://example.com/real"]);
  });
});
