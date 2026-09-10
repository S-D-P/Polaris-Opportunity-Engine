import { describe, expect, it } from "vitest";
import { assertSafeFetchUrl, UnsafeUrlError } from "@/lib/ingestion/url-safety";

describe("assertSafeFetchUrl", () => {
  it("allows a normal public https URL", () => {
    expect(() => assertSafeFetchUrl("https://example.org/feed.xml")).not.toThrow();
  });

  it("rejects localhost", () => {
    expect(() => assertSafeFetchUrl("http://localhost:3000/api/internal")).toThrow(UnsafeUrlError);
  });

  it("rejects loopback addresses", () => {
    expect(() => assertSafeFetchUrl("http://127.0.0.1:8080/")).toThrow(UnsafeUrlError);
  });

  it("rejects the cloud metadata endpoint", () => {
    expect(() => assertSafeFetchUrl("http://169.254.169.254/latest/meta-data/")).toThrow(UnsafeUrlError);
  });

  it("rejects private RFC1918 ranges", () => {
    expect(() => assertSafeFetchUrl("http://10.0.0.5/")).toThrow(UnsafeUrlError);
    expect(() => assertSafeFetchUrl("http://192.168.1.1/")).toThrow(UnsafeUrlError);
    expect(() => assertSafeFetchUrl("http://172.16.0.1/")).toThrow(UnsafeUrlError);
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => assertSafeFetchUrl("file:///etc/passwd")).toThrow(UnsafeUrlError);
    expect(() => assertSafeFetchUrl("ftp://example.org/")).toThrow(UnsafeUrlError);
  });

  it("rejects a malformed URL", () => {
    expect(() => assertSafeFetchUrl("not a url")).toThrow(UnsafeUrlError);
  });
});
