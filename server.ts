import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";

dotenv.config();
console.log("DEBUG: GAS_ENDPOINT_URL is:", process.env.GAS_ENDPOINT_URL);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// #region agent log
const debugLog = (location: string, message: string, data: Record<string, unknown>, hypothesisId: string) => {
  fetch("http://127.0.0.1:7386/ingest/2c9c0a51-cd3c-406e-9273-0af96aff9294", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "314df0" },
    body: JSON.stringify({ sessionId: "314df0", location, message, data, hypothesisId, timestamp: Date.now(), runId: "pre-fix" }),
  }).catch(() => {});
};
// #endregion

app.use(express.json({ limit: "15mb" }));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ─── Shoescare Application API Proxy Routes ─────────────────────────────────

const getGasUrl = (req: any) => {
  const headerUrl = req.headers["x-gas-endpoint"] || req.headers["x-gas-endpoint-url"];
  if (headerUrl && typeof headerUrl === "string" && headerUrl.trim().startsWith("http")) {
    return headerUrl.trim();
  }
  const envUrl = process.env.GAS_ENDPOINT_URL || "";
  // #region agent log
  debugLog("server.ts:getGasUrl", "GAS URL resolved", { hasEnvUrl: !!envUrl, hasHeaderUrl: !!headerUrl, envUrlLength: envUrl.length }, "A");
  // #endregion
  return envUrl;
};

// GET settings
app.get("/api/settings", async (req, res) => {
  const fallbackPath = path.join(__dirname, "settings_fallback.json");
  let localSettings: any = {};
  try {
    if (fs.existsSync(fallbackPath)) {
      localSettings = JSON.parse(fs.readFileSync(fallbackPath, "utf-8"));
    }
  } catch (err) {
    console.error("Gagal membaca settings_fallback.json:", err);
  }

  try {
    const GAS_URL = getGasUrl(req);
    if (!GAS_URL) {
      return res.json({ success: true, data: localSettings });
    }
    const response = await fetch(`${GAS_URL}?action=getSettings`);
    const data = await response.json();
    
    if (data && typeof data === "object") {
      const finalData = data.success && data.data ? data.data : data;
      
      let localGalleryCount = 0;
      let gasGalleryCount = 0;
      try {
        const localParsed = JSON.parse(localSettings.Gallery || "[]");
        if (Array.isArray(localParsed)) localGalleryCount = localParsed.length;
      } catch (_) {}

      try {
        const gasParsed = JSON.parse(finalData.Gallery || "[]");
        if (Array.isArray(gasParsed)) gasGalleryCount = gasParsed.length;
      } catch (_) {}

      // If local has more data, use local to prevent losing user data
      if (localGalleryCount > gasGalleryCount) {
        finalData.Gallery = localSettings.Gallery;
      }

      if (!finalData.Logo && localSettings.Logo) {
        finalData.Logo = localSettings.Logo;
      }

      // Update the local fallback file with the rich-merged state
      try {
        fs.writeFileSync(fallbackPath, JSON.stringify(finalData, null, 2), "utf-8");
      } catch (err) {
        console.error("Gagal memperbarui settings_fallback.json saat sync:", err);
      }

      res.json({ success: true, data: finalData });
    } else {
      res.json({ success: true, data: localSettings });
    }
  } catch (err: any) {
    console.warn("Fetch settings dari GAS gagal, menggunakan fallback lokal:", err.message);
    res.json({ success: true, data: localSettings });
  }
});

// POST settings
app.post("/api/settings", async (req, res) => {
  const fallbackPath = path.join(__dirname, "settings_fallback.json");
  try {
    fs.writeFileSync(fallbackPath, JSON.stringify(req.body, null, 2), "utf-8");
  } catch (err) {
    console.error("Gagal menulis ke settings_fallback.json:", err);
  }

  try {
    const GAS_URL = getGasUrl(req);
    if (!GAS_URL) {
      return res.json({ success: true, warning: "Saved locally (No GAS URL configured)" });
    }
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateSettings", settings: req.body }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.warn("Post settings ke GAS gagal, tapi tersimpan secara lokal:", err.message);
    res.json({ success: true, warning: "Saved to local fallback", error: err.message });
  }
});

// GET services
app.get("/api/services", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    if (!GAS_URL) {
      // #region agent log
      debugLog("server.ts:GET /api/services", "No GAS URL - returning empty", {}, "A");
      // #endregion
      return res.json({ success: true, data: [] });
    }
    const response = await fetch(`${GAS_URL}?action=getServices`);
    const data = await response.json();
    // #region agent log
    debugLog("server.ts:GET /api/services", "GAS response", { success: data?.success, count: Array.isArray(data?.data) ? data.data.length : null }, "D");
    // #endregion
    res.json(data);
  } catch (err: any) {
    // #region agent log
    debugLog("server.ts:GET /api/services", "Fetch failed", { error: err.message }, "A");
    // #endregion
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST services
app.post("/api/services", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "createService", ...req.body }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH services
app.patch("/api/services/:id", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateService", id: req.params.id, ...req.body }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE services
app.delete("/api/services/:id", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "deleteService", id: req.params.id }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST auth
app.post("/api/auth", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const { email, password } = req.body;
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "authenticate", email, password }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET users
app.get("/api/users", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    if (!GAS_URL) {
      // #region agent log
      debugLog("server.ts:GET /api/users", "No GAS URL - returning empty", {}, "A");
      // #endregion
      return res.json({ success: true, data: [] });
    }
    const role = req.query.role || "";
    const response = await fetch(`${GAS_URL}?action=getUsers&role=${role}`);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST users
app.post("/api/users", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "createUser", ...req.body }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT users
app.put("/api/users", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateUser", ...req.body }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE users
app.delete("/api/users", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const id = req.query.id || "";
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "deleteUser", id }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST orders
app.post("/api/orders", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const body = req.body;
    if (!body.Nama || !body.WhatsApp || !body.Layanan || !body.Jadwal) {
      return res.status(400).json({ success: false, error: "Nama, WhatsApp, Layanan, dan Jadwal wajib diisi." });
    }

    // Backend Worker Overload Validation (maximum 6 active bookings of same package)
    if (GAS_URL && body.ID_Worker && body.Layanan) {
      try {
        const ordersRes = await fetch(`${GAS_URL}?action=getAllOrders`);
        const ordersData = await ordersRes.json();
        if (ordersData.success && Array.isArray(ordersData.data)) {
          const workerId = body.ID_Worker;
          const serviceName = body.Layanan;
          const datePart = body.Jadwal.split(" ")[0] || "";

          const workerIdClean = String(workerId || "").trim();
          const serviceNameClean = String(serviceName || "").trim().toLowerCase();

          // Count active orders (not completed/cancelled) with same worker and same package
          const activeSameDayCount = ordersData.data.filter((o: any) => {
            if (o.Status === "Done" || o.Status === "Cancelled" || o.Status === "Selesai" || o.Status === "Batal") return false;
            if (String(o.ID_Worker || "").trim() !== workerIdClean) return false;
            if (String(o.Layanan || "").trim().toLowerCase() !== serviceNameClean) return false;
            return o.Jadwal && o.Jadwal.includes(datePart);
          }).length;

          const activeTotalCount = ordersData.data.filter((o: any) => {
            if (o.Status === "Done" || o.Status === "Cancelled" || o.Status === "Selesai" || o.Status === "Batal") return false;
            if (String(o.ID_Worker || "").trim() !== workerIdClean) return false;
            return String(o.Layanan || "").trim().toLowerCase() === serviceNameClean;
          }).length;

          // General active orders check for this worker (max 4 shoes)
          const generalActiveCount = ordersData.data.filter((o: any) => {
            const s = o.Status;
            if (s === "Done" || s === "Cancelled" || s === "Selesai" || s === "Batal") return false;
            return String(o.ID_Worker || "").trim() === workerIdClean;
          }).length;

          if (generalActiveCount >= 4) {
            return res.status(400).json({
              success: false,
              error: `Pekerja ini sedang sibuk atau mengerjakan lebih dari 4 sepatu. Silakan pilih teknisi lain.`
            });
          }

          if (activeSameDayCount >= 6 || activeTotalCount >= 6) {
            return res.status(400).json({
              success: false,
              error: `Pekerja ini sudah menerima batas maksimal overload pengerjaan (maksimal 6 pesanan aktif) untuk layanan "${serviceName}". Silakan pilih teknisi lain.`
            });
          }
        }
      } catch (e) {
        console.warn("Backend overload check failed/skipped:", e);
      }
    }

    // Generate readable order ID (SC-XXXXXX)
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const ID_Order = `SC-${randomCode}`;
    const deliveryFee = body.Delivery_Method === "Pickup" ? (body.Delivery_Fee !== undefined ? Number(body.Delivery_Fee) : 15000) : 0;
    const deliveryPaymentType = body.Delivery_Method === "Pickup" ? body.Delivery_Payment_Type : "None";

    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "createOrder",
        ID_Order,
        Nama: body.Nama.trim(),
        WhatsApp: body.WhatsApp.trim(),
        Layanan: body.Layanan,
        Jadwal: body.Jadwal,
        Catatan: body.Catatan ?? "",
        ID_Worker: body.ID_Worker || "",
        Delivery_Method: body.Delivery_Method || "Drop-off",
        Delivery_Fee: deliveryFee,
        Delivery_Payment_Type: deliveryPaymentType,
      }),
    });

    const data = await response.json();
    if (data.success) {
      res.status(201).json({ success: true, data: { id: ID_Order } });
    } else {
      res.status(502).json(data);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET order by ID
app.get("/api/orders/:id", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const id = req.params.id;
    const response = await fetch(`${GAS_URL}?action=getOrder&id=${id}`);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all orders for admin
app.get("/api/admin/orders", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const response = await fetch(`${GAS_URL}?action=getAllOrders`);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH admin order status
app.patch("/api/admin/orders/:id/status", async (req, res) => {
  try {
    const GAS_URL = getGasUrl(req);
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "updateStatus",
        id: req.params.id,
        status: req.body.status,
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Vite & Static file handler
async function setupViteAndStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const tryListen = (port: number, attemptsLeft = 5) => {
    const server = app.listen(port, "0.0.0.0");
    server.once("listening", () => {
      // #region agent log
      debugLog("server.ts:listen", "Server bound", { port, gasConfigured: !!process.env.GAS_ENDPOINT_URL }, "C");
      // #endregion
      console.log(`Server running on http://localhost:${port}`);
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if ((err.code === "EADDRINUSE" || err.code === "EACCES") && attemptsLeft > 0) {
        console.warn(`Port ${port} tidak tersedia (${err.code}), mencoba port ${port + 1}...`);
        tryListen(port + 1, attemptsLeft - 1);
      } else {
        console.error("Gagal menjalankan server:", err.message);
        process.exit(1);
      }
    });
  };
  tryListen(PORT);
}

setupViteAndStatic();
