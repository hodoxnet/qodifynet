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

templateRouter.get("/", authorize("SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const templates = await templateService.getAvailableTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// NOTE: More specific routes (e.g., /demo-*) must be defined before this.
templateRouter.get("/version/:version", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
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

templateRouter.post("/check", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { version = "latest" } = req.body;
    const [availability, files] = await Promise.all([
      templateService.checkTemplateAvailability(version),
      templateService.getComponentsStatus(version),
    ]);

    // Her zaman 200 status döndür, eksik dosyalar olsa bile
    // UI tarafı available flag'ine bakarak durumu anlayacak
    res.json({
      available: availability.available,
      missing: availability.missing,
      message: availability.message,
      files,
      uploaded: availability.missing?.length === 0 ? [] : Object.keys(files).filter(f => files[f].uploaded),
    });
  } catch (error) {
    console.error("Template check error:", error);
    res.status(500).json({ error: "Failed to check template availability" });
  }
});

templateRouter.post("/upload", authorize("SUPER_ADMIN"), upload.single("template"), async (req, res): Promise<void> => {
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

// ============ DEMO PACKS MANAGEMENT ============
// List demo packs for a version
templateRouter.get("/demo-packs", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const version = String((req.query.version as string) || '2.4.0');
    const list = await templateService.listDemoPacks(version);
    res.json({ version, packs: list });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Demo pack listesi alınamadı" });
  }
});

// Upload demo pack under stable/<version>/demo
templateRouter.post("/demo/upload", authorize("SUPER_ADMIN"), upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "Dosya yüklenmedi" }); return; }
    const version = String((req.body.version as string) || '2.4.0');
    await templateService.importDemoPack(req.file.path, version, 'stable');
    try { await fs.remove(req.file.path); } catch {}
    const list = await templateService.listDemoPacks(version);
    res.json({ success: true, version, packs: list });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Demo pack yükleme başarısız" });
  }
});

// Delete a demo pack by version and filename
templateRouter.delete("/demo/:version/:filename", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const version = String(req.params.version);
    const filename = String(req.params.filename);
    const result = await templateService.deleteDemoPack(version, filename);
    if (!result.success) { res.status(404).json({ error: result.message || 'Silinemedi' }); return; }
    const list = await templateService.listDemoPacks(version);
    res.json({ success: true, version, packs: list, message: result.message });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Demo pack silme başarısız" });
  }
});

templateRouter.delete("/:filename", authorize("SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!filename) {
      res.status(400).json({ error: "Dosya adı belirtilmedi" });
      return;
    }

    const result = await templateService.deleteTemplate(filename);

    if (!result.success) {
      res.status(404).json({ error: result.message || "Template silinemedi" });
      return;
    }

    res.json({
      success: true,
      message: result.message || `${filename} başarıyla silindi`
    });
  } catch (error: any) {
    console.error("Template delete error:", error);
    res.status(500).json({ error: error?.message || "Template silme işlemi başarısız" });
  }
});
