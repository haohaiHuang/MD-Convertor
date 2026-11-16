import { describe, expect, it } from "vitest";
import {
  auditRuntime,
  electronStatus,
  parseAuditReport,
  PROD_AUDIT_ERROR,
  severityCounts,
} from "./audit-runtime.mjs";

function report(vulnerabilities) {
  return { auditReportVersion: 2, vulnerabilities };
}

const PROD_CLEAN = report({});
const FULL_WITH_ELECTRON = report({
  electron: {
    name: "electron",
    severity: "high",
    isDirect: true,
    range: "<43.5.0",
    via: [{ title: "Electron ASAR integrity bypass" }, { title: "Electron heap overflow" }],
    fixAvailable: { name: "electron", version: "43.8.10", isSemVerMajor: false },
  },
  "some-tool": { name: "some-tool", severity: "low", isDirect: false, range: "*", via: ["electron"] },
});

describe("severityCounts", () => {
  it("counts vulnerable packages per severity, the way `npm audit` does", () => {
    const counts = severityCounts(FULL_WITH_ELECTRON);

    expect(counts).toEqual({ critical: 0, high: 1, moderate: 0, low: 1, info: 0, total: 2 });
  });

  it("treats a clean report as zero", () => {
    expect(severityCounts(PROD_CLEAN)).toMatchObject({ total: 0 });
  });
});

describe("electronStatus", () => {
  it("reads the advisory titles and the fix version from the audit entry", () => {
    expect(electronStatus(FULL_WITH_ELECTRON)).toEqual({
      severity: "high",
      advisoryCount: 2,
      fixAvailable: "43.8.10",
    });
  });

  it("reports no advisories when electron is clean", () => {
    expect(electronStatus(PROD_CLEAN)).toEqual({ severity: null, advisoryCount: 0, fixAvailable: null });
  });
});

describe("parseAuditReport", () => {
  it("rejects output that is not an audit report", () => {
    expect(() => parseAuditReport("npm ERR! network timeout")).toThrow("npm audit");
    expect(() => parseAuditReport(JSON.stringify({ error: { code: "ENETWORK" } }))).toThrow("npm audit");
  });
});

describe("auditRuntime", () => {
  function fakeExec({ failProd = false } = {}) {
    const calls = [];
    return {
      calls,
      exec: (command, args) => {
        calls.push([command, ...args].join(" "));
        const body = args.includes("--omit=dev") && failProd
          ? report({ next: { name: "next", severity: "critical", isDirect: true, via: [], range: "<1" } })
          : args.includes("--omit=dev")
            ? PROD_CLEAN
            : FULL_WITH_ELECTRON;
        const text = JSON.stringify(body);
        if (Object.keys(body.vulnerabilities).length > 0 && args.includes("--omit=dev")) {
          throw Object.assign(new Error("npm audit exited 1"), { stdout: text });
        }
        return text;
      },
    };
  }

  it("audits the production tree and reports the Electron advisories as a warning", () => {
    const { calls, exec } = fakeExec();
    const lines = [];

    const summary = auditRuntime({ exec, log: (line) => lines.push(line) });

    expect(calls).toEqual(["npm audit --omit=dev --json", "npm audit --json"]);
    expect(summary.prod.total).toBe(0);
    expect(summary.electron).toMatchObject({ severity: "high", advisoryCount: 2 });
    expect(lines.join("\n")).toContain("生产依赖（--omit=dev）：0 个漏洞");
    expect(lines.join("\n")).toContain("electron");
  });

  // npm exits 1 whenever it finds anything, so the gate must judge the report, not the exit code.
  it("still reads the report when npm exits non-zero", () => {
    const { exec } = fakeExec({ failProd: true });

    expect(() => auditRuntime({ exec, log: () => {} })).toThrow(PROD_AUDIT_ERROR);
  });

  it("fails when a production dependency has an advisory", () => {
    const { exec } = fakeExec({ failProd: true });
    const lines = [];

    expect(() => auditRuntime({ exec, log: (line) => lines.push(line) })).toThrow(PROD_AUDIT_ERROR);
    expect(lines.join("\n")).toContain("生产依赖（--omit=dev）：1 个漏洞");
  });

  it("fails with a readable message when npm audit itself cannot run", () => {
    const exec = () => {
      throw new Error("ENOENT npm");
    };

    expect(() => auditRuntime({ exec, log: () => {} })).toThrow("npm audit 无法执行");
  });
});
