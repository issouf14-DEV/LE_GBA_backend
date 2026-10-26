import { z } from "zod";

// Liste paginée des notifications : seuls page et limit sont acceptés
export const notificationListQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
