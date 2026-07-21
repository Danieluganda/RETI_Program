import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const uploadDir = join(dataDir, "uploads");
const recordsFile = join(dataDir, "consents.json");
const port = Number(process.env.PORT || 3015);

const users = [
  {
    id: "usr-demo",
    name: "Demo Collector",
    email: "collector@reti.local",
    password: "password123",
    role: "Data Collector",
  },
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

async function ensureStorage() {
  await mkdir(uploadDir, { recursive: true });

  try {
    await stat(recordsFile);
  } catch {
    await writeFile(recordsFile, "[]\n", "utf8");
  }
}

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  if (Buffer.isBuffer(body) || typeof body === "string") {
    res.end(body);
    return;
  }

  res.end(JSON.stringify(body));
}

function collectJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

async function readRecords() {
  const file = await readFile(recordsFile, "utf8");
  return JSON.parse(file || "[]");
}

async function saveRecords(records) {
  await writeFile(recordsFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

function makeReference(records) {
  const year = new Date().getFullYear();
  const next = String(records.length + 1).padStart(5, "0");
  return `CNS-${year}-${next}`;
}

function sanitizeFilePart(value) {
  return String(value || "file")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function saveDataImage(reference, fieldName, dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return "";

  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) return "";

  const extension = match[1] === "jpeg" ? "jpg" : "png";
  const fileName = `${reference}-${sanitizeFilePart(fieldName)}.${extension}`;
  const filePath = join(uploadDir, fileName);
  await writeFile(filePath, Buffer.from(match[2], "base64"));
  return `/uploads/${fileName}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(records) {
  const headers = [
    "referenceNumber",
    "participantName",
    "participantPhone",
    "programName",
    "consentDecision",
    "signingMethod",
    "interpreterUsed",
    "interpreterName",
    "interpreterLanguage",
    "collectorName",
    "consentDate",
    "createdAt",
  ];
  const lines = [headers.join(",")];

  records.forEach((record) => {
    lines.push(headers.map((header) => csvCell(record[header])).join(","));
  });

  return lines.join("\n");
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const base = pathname.startsWith("/uploads/") ? dataDir : publicDir;
  const filePath = normalize(join(base, pathname.replace(/^\//, "")));

  if (relative(base, filePath).startsWith("..")) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const file = await readFile(filePath);
    send(res, 200, file, mimeTypes[extname(filePath)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await collectJson(req);
    const user = users.find((item) => item.email === body.email && item.password === body.password);

    if (!user) {
      send(res, 401, { error: "Invalid email or password" });
      return;
    }

    send(res, 200, {
      token: `demo-token-${user.id}`,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    const records = await readRecords();
    const consented = records.filter((record) => record.consentDecision === "consented").length;
    const declined = records.filter((record) => record.consentDecision === "declined").length;

    send(res, 200, {
      total: records.length,
      consented,
      declined,
      withInterpreter: records.filter((record) => record.interpreterUsed).length,
      recent: records.slice(-5).reverse(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/consents") {
    send(res, 200, await readRecords());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/consents") {
    const body = await collectJson(req);
    const records = await readRecords();
    const referenceNumber = makeReference(records);
    const signatureFile = await saveDataImage(referenceNumber, "participant-signature", body.participantSignatureData);
    const interpreterSignatureFile = await saveDataImage(
      referenceNumber,
      "interpreter-signature",
      body.interpreterSignatureData,
    );

    if (!body.participantName || !body.consentDecision || !signatureFile) {
      send(res, 422, { error: "Participant name, consent decision, and signature/thumbprint are required" });
      return;
    }

    const record = {
      id: randomUUID(),
      referenceNumber,
      participantName: body.participantName,
      participantPhone: body.participantPhone || "",
      programName: body.programName || "10X Program",
      consentDecision: body.consentDecision,
      informationUnderstood: Boolean(body.informationUnderstood),
      signingMethod: body.signingMethod || "drawn",
      signatureFile,
      interpreterUsed: Boolean(body.interpreterUsed),
      interpreterName: body.interpreterName || "",
      interpreterOrganization: body.interpreterOrganization || "",
      interpreterLanguage: body.interpreterLanguage || "",
      interpreterSignatureFile,
      collectorName: body.collectorName || "Demo Collector",
      consentDate: body.consentDate || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };

    records.push(record);
    await saveRecords(records);
    send(res, 201, record);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/reports/consents.csv") {
    const records = await readRecords();
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"reti-consents.csv\"",
    });
    res.end(toCsv(records));
    return;
  }

  send(res, 404, { error: "API route not found" });
}

await ensureStorage();

createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    send(res, 500, { error: error.message || "Server error" });
  }
}).listen(port, () => {
  console.log(`RETI consent app running at http://localhost:${port}`);
});
