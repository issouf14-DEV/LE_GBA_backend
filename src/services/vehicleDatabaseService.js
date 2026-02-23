// services/vehicleDatabaseService.js
import axios from "axios";
import Vehicle from "../models/Vehicle.js";

/**
 * 📸 Cherche une image pro de voiture sur Unsplash
 */
async function fetchUnsplashImage(query) {
  try {
    const { data } = await axios.get("https://api.unsplash.com/search/photos", {
      params: { query, per_page: 1, orientation: "landscape" },
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
    });

    if (data.results.length > 0) {
      return data.results[0].urls.regular; // ✅ image haute qualité
    }
    return null;
  } catch (err) {
    console.error("❌ Erreur Unsplash:", err.message);
    return null;
  }
}

/**
 * 🔍 Récupère dynamiquement les marques depuis NHTSA
 * et filtre pour ne garder que les vraies marques de voitures
 */
async function fetchAllMakes() {
  try {
    const { data } = await axios.get(
      "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json"
    );

    if (data.Results && Array.isArray(data.Results)) {
      return data.Results.map((m) => m.Make_Name?.toLowerCase()).filter(
        (name) =>
          name &&
          name.length > 2 &&
          /^[a-z0-9\s\-]+$/.test(name) &&
          !name.includes("trailer") &&
          !name.includes("golf") &&
          !name.includes("cart") &&
          !name.includes("coach") &&
          !name.includes("manufacturing") &&
          !name.includes("inc") &&
          !name.includes("llc")
      );
    }
    return [];
  } catch (err) {
    console.error("❌ Erreur récupération marques:", err.message);
    return [];
  }
}

/**
 * 🚗 Importer les voitures depuis Vehicle Database API (API Ninjas)
 */
export const importCarsFromVehicleDatabase = async () => {
  try {
    // ✅ Étape 1 : récupérer dynamiquement toutes les marques
    const makes = await fetchAllMakes();

    // ✅ On garde seulement les plus connues (top 15)
const popularMakes = makes.filter((m) =>
  [
    // Japon
    "toyota",
    "honda",
    "nissan",
    "lexus",
    "mazda",
    "mitsubishi",
    "subaru",
    "suzuki",

    // Corée
    "hyundai",
    "kia",
    "genesis",

    // USA
    "ford",
    "chevrolet",
    "tesla",
    "jeep",
    "dodge",
    "ram",
    "gmc",
    "cadillac",
    "chrysler",
    "lincoln",

    // Allemagne
    "bmw",
    "audi",
    "mercedes",
    "porsche",
    "volkswagen",
    "opel",

    // France
    "peugeot",
    "renault",
    "citroen",
    "ds",

    // Italie
    "fiat",
    "alfa romeo",
    "lancia",
    "ferrari",
    "lamborghini",
    "maserati",

    // UK
    "mini",
    "land rover",
    "range rover",
    "jaguar",
    "bentley",
    "rolls royce",
    "aston martin",

    // Autres Europe
    "skoda",
    "seat",
    "volvo",
    "bugatti",

    // Chine (de + en + présentes)
    "byd",
    "mg",
    "great wall",
  ].includes(m)
);

    console.log("✅ Marques détectées (filtrées):", popularMakes);

    let cars = [];
    for (const make of popularMakes) {
      try {
        const { data } = await axios.get(process.env.VEHICLE_DATABASE_API_URL, {
          headers: { "X-Api-Key": process.env.VEHICLE_DATABASE_API_KEY },
          params: { make, year: 2018 }, // ✅ voitures modernes
        });

        if (Array.isArray(data)) {
          const limitedData = data.slice(0, 20); // ✅ max 20 par marque
          cars = cars.concat(limitedData);
          console.log(
            `✅ ${limitedData.length} véhicules récupérés pour ${make}`
          );
        }
      } catch (err) {
        console.error(
          `❌ Erreur API Vehicle Database (${make}):`,
          err.response?.data || err.message
        );
      }
    }

    const results = [];
    for (const car of cars) {
      let image = car.image || null;

      // 🔍 si pas de photo → chercher sur Unsplash
      if (!image) {
        const query = `${car.make} ${car.model} car professional photo`;
        image = await fetchUnsplashImage(query);
      }

      const vehicleData = {
        vin: car.vin || `${car.make}-${car.model}-${Date.now()}`,
        brand: car.make || "Unknown",
        model: car.model || "Unknown",
        year: car.year || null,
        drivetrain: car.drivetrain || null,
        engine: car.engine || null,
        fuel: car.fuel_type || null,
        transmission: car.transmission || null,
        exteriorColor: car.exteriorColor || null,
        interiorColor: car.interiorColor || null,
        doors: car.doors || null,
        seats: car.seats || null,
        price: car.price || Math.floor(20000 + Math.random() * 80000), // 💰 prix réaliste
        miles: car.miles || Math.floor(Math.random() * 120000),
        image,
        photos: image ? [image] : [],
      };

      const vehicle = await Vehicle.findOneAndUpdate(
        { vin: vehicleData.vin },
        vehicleData,
        { upsert: true, new: true }
      );

      results.push(vehicle);
    }

    console.log(`🚗 Import terminé : ${results.length} véhicules ajoutés`);
    return { imported: results.length, vehicles: results };
  } catch (err) {
    console.error(
      "❌ Erreur API Vehicle Database:",
      err.response?.data || err.message
    );
    throw new Error("Erreur import: " + err.message);
  }
};
