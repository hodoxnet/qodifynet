import { Router } from "express";
import { TemplateService } from "../services/template.service";
import { authorize } from "../middleware/authorize";
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

templateRouter.get("/", async (_req, res): Promise<void> => {
  try {
    const templates = await templateService.getAvailableTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

templateRouter.get("/:version", async (req, res): Promise<void> => {
  try {
    const template = await templateService.getTemplateInfo(req.params.version);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch template info" });
  }
});

templateRouter.post("/check", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { version = "latest" } = req.body;
    const [availability, files] = await Promise.all([
      templateService.checkTemplateAvailability(version),
      templateService.getComponentsStatus(version),
    ]);

    if (!availability.available) {
      res.status(404).json({
        available: false,
        missing: availability.missing,
        message: availability.message,
        files,
      });
      return;
    }

    res.json({ ...availability, files });
  } catch (error) {
    console.error("Template check error:", error);
    res.status(500).json({ error: "Failed to check template availability" });
  }
});

templateRouter.post("/upload", authorize("ADMIN", "SUPER_ADMIN"), upload.single("template"), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Dosya yüklenmedi" });
      return;
    }

    const providedName = String(req.body.name || req.file.originalname || "");
    const requestedVersion = req.body.version || "2.4.0";

    // Extract component name from the provided name
    const componentMatch = providedName.match(/^(backend|admin|store)/);

    if (!componentMatch) {
      await fs.remove(req.file.path).catch(() => {});
      res.status(400).json({
        error: "Dosya adı hatalı",
        message: "backend-<versiyon>.zip, admin-<versiyon>.zip veya store-<versiyon>.zip formatında olmalı",
      });
      return;
    }

    // const component = componentMatch[1]; // currently not used
    const version = requestedVersion;

    // Doğrulama
    const validation = await templateService.validateTemplate(req.file.path);
    if (!validation.valid) {
      await fs.remove(req.file.path).catch(() => {});
      res.status(400).json({ error: "Geçersiz template", details: validation.errors });
      return;
    }

    // İçe aktarım (templates/<category>/<component>-<version>.zip)
    await templateService.importTemplate(req.file.path, version, "stable");

    // Geçici dosyayı sil
    await fs.remove(req.file.path).catch(() => {});

    // Durumu döndür
    const availability = await templateService.checkTemplateAvailability(version);
    res.json({ success: true, version, ...availability });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Upload failed" });
  }
});
