import { vehicleAvailability } from "../services/availability.js";

// Public : périodes occupées d'un véhicule (dates seulement), mises en cache une minute
export async function getAvailability(req, res) {
  const result = await vehicleAvailability(req.validated.params.id, req.validated.query);
  res.set("Cache-Control", "public, max-age=60");
  res.json(result);
}
