import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@prisma/client";

export const ROLES_KEY = "roles";

/** يقيّد المسار على أدوار محددة. يُستخدم مع RolesGuard بعد JwtAuthGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
