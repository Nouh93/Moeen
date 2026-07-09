import { BadRequestException, Module } from "@nestjs/common";
import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { randomBytes } from "crypto";
import { JwtAuthGuard } from "../auth/jwt.guard";

export const UPLOADS_DIR = join(process.cwd(), "uploads");

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB — صور الجوالات

/**
 * رفع صور المنتجات والشعارات (القسم 5.2).
 * التخزين حالياً على قرص السيرفر ويُخدَم كملفات ثابتة؛
 * في الإنتاج يُستبدل بتخزين S3-compatible + CDN (القسم 17.1) دون تغيير الواجهة.
 */
@UseGuards(JwtAuthGuard)
@Controller("uploads")
class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED.includes(ext)) {
          return cb(
            new BadRequestException(
              "نوع الملف غير مدعوم — ارفع صورة (JPG أو PNG أو WebP)",
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        "الصورة كبيرة الحجم — جرب صورة أصغر أو بجودة أقل",
      );
    }
    return { url: `/uploads/${file.filename}` };
  }
}

@Module({ controllers: [UploadsController] })
export class UploadsModule {}
