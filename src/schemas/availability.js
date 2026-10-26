import { z } from "zod";
import { isoDate } from "./common.js";

// Plage du calendrier de disponibilité (AAAA-MM-JJ, bornes comprises) : aucun autre paramètre
export const availabilityQuery = z.strictObject({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
