/**
 * Runtime dependency audit for the release gate.
 *
 * `npm audit --omit=dev` covers the production tree, but the packaged app also ships `electron`,
 * which is a devDependency that becomes the runtime. Auditing only the production tree therefore
 * reports "0" about a binary the user actually runs, so this script reports both: production
 * advisories fail the gate, Electron advisories are printed as a tracked warning (QA-DEV).
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PROD_AUDIT_ERROR = "生产依赖存在安全公告（npm audit --omit=dev），发布门禁不得放行";
export const AUDIT_UNAVAILABLE_ERROR = "npm audit 无法执行，发布门禁需要联网复核依赖";

const EMPTY_COUNTS = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };

export function parseAuditReport(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("npm audit 没有返回 JSON，无法判断依赖状态");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.vulnerabilities || typeof parsed.vulnerabilities !== "object") {
    throw new Error("npm audit 没有返回 vulnerabilities，无法判断依赖状态");
  }
  return parsed;
}

/** Counts vulnerable packages per severity, which is the unit `npm audit` reports. */
export function severityCounts(report) {
  const counts = { ...EMPTY_COUNTS };
  const entries = Object.values(report.vulnerabilities ?? {});
  for (const entry of entries) {
    const severity = String(entry?.severity ?? "").toLowerCase();
    if (severity in counts) counts[severity] += 1;
  }
  counts.total = entries.length;
  return counts;
}

export function electronStatus(fullReport) {
  const entry = fullReport.vulnerabilities?.electron;
  if (!entry) return { severity: null, advisoryCount: 0, fixAvailable: null };
  const advisories = (entry.via ?? []).filter((item) => item && typeof item === "object");
  return {
    severity: entry.severity ?? null,
    advisoryCount: advisories.length,
    fixAvailable: entry.fixAvailable?.version ?? null,
  };
}

function formatCounts(counts) {
  return `critical ${counts.critical} / high ${counts.high} / moderate ${counts.moderate} / low ${counts.low}`;
}

// npm exits non-zero as soon as it finds anything; the report on stdout is still the answer.
function runAudit(args, exec) {
  try {
    return exec("npm", ["audit", ...args, "--json"], { encoding: "utf8" });
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout : error?.stdout?.toString?.("utf8");
    if (stdout?.trim()) return stdout;
    throw new Error(`${AUDIT_UNAVAILABLE_ERROR}：${error?.message ?? String(error)}`);
  }
}

export function auditRuntime({ exec = execFileSync, log = console.log } = {}) {
  const prod = parseAuditReport(runAudit(["--omit=dev"], exec));
  const full = parseAuditReport(runAudit([], exec));
  const prodCounts = severityCounts(prod);
  const electron = electronStatus(full);

  log(`依赖审计 · 生产依赖（--omit=dev）：${prodCounts.total} 个漏洞（${formatCounts(prodCounts)}）`);
  if (electron.severity === null) {
    log("依赖审计 · 打包运行时 electron：无公告");
  } else {
    const fix = electron.fixAvailable ? `，修复版本 ${electron.fixAvailable}` : "";
    log(
      `依赖审计 · 打包运行时 electron：${electron.severity} ${electron.advisoryCount} 条公告${fix}`
        + "（devDependency 但随包交付，见 docs/QUALITY-AUDIT.md 的 QA-DEV）",
    );
  }

  if (prodCounts.total > 0) throw new Error(PROD_AUDIT_ERROR);
  return { prod: prodCounts, electron };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    auditRuntime();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
