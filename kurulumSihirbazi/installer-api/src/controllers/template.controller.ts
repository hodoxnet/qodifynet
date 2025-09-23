import { Router } from "express";
import { TemplateService } from "../services/template.service";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs-extra";

export const templateRouter = Router();
const templateService = new TemplateService();

// Multer setup for ZIP uploads
const uploadDir = path.join(os.tmpdir(), "qodify-installer");
fs.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith(".zip")) return cb(null, true);
    return cb(new Error("Sadece .zip dosyaları yüklenebilir"));
  },
});

templateRouter.get("/", async (req, res) => {
  try {
    const templates = await templateService.getAvailableTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

templateRouter.get("/:version", async (req, res) => {
  try {
    const template = await templateService.getTemplateInfo(req.params.version);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch template info" });
  }
});

templateRouter.post("/check", async (req, res) => {
  try {
    const { version = "latest" } = req.body;
    const [availability, files] = await Promise.all([
      templateService.checkTemplateAvailability(version),
      templateService.getComponentsStatus(version),
    ]);

    if (!availability.available) {
      return res.status(404).json({
        available: false,
        missing: availability.missing,
        message: availability.message,
        files,
      });
    }

    res.json({ ...availability, files });
  } catch (error) {
    console.error("Template check error:", error);
    res.status(500).json({ error: "Failed to check template availability" });
  }
});

templateRouter.post("/upload", upload.single("template"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Dosya yüklenmedi" });
    }

    const providedName = String(req.body.name || req.file.originalname || "");
    const requestedVersion = req.body.version || "2.4.0";

    // Extract component name from the provided name
    const componentMatch = providedName.match(/^(backend|admin|store)/);

    if (!componentMatch) {
      await fs.remove(req.file.path).catch(() => {});
      return res.status(400).json({
        error: "Dosya adı hatalı",
        message: "backend-<versiyon>.zip, admin-<versiyon>.zip veya store-<versiyon>.zip formatında olmalı",
      });
    }

    const component = componentMatch[1];
    const version = requestedVersion;

    // Doğrulama
    const validation = await templateService.validateTemplate(req.file.path);
    if (!validation.valid) {
      await fs.remove(req.file.path).catch(() => {});
      return res.status(400).json({ error: "Geçersiz template", details: validation.errors });
    }

    // İçe aktarım (templates/<category>/<component>-<version>.zip)
    await templateService.importTemplate(req.file.path, version, "stable");

    // Geçici dosyayı sil
    await fs.remove(req.file.path).catch(() => {});

    // Durumu döndür
    const availability = await templateService.checkTemplateAvailability(version);
    return res.json({ success: true, version, ...availability });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Upload failed" });
  }
});
