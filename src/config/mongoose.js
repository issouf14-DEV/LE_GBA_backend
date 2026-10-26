// Réglages globaux de Mongoose, chargés par l'application elle-même (et donc aussi par les tests,
// qui tournent ainsi exactement comme la production)
import mongoose from "mongoose";

// Refuse les opérateurs MongoDB ($gt, $ne…) cachés dans les filtres : bloque l'injection NoSQL.
// Les requêtes écrites entièrement par le serveur lèvent cette protection explicitement.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export default mongoose;
