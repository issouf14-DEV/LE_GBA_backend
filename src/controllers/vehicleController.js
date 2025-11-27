import Vehicle from "../models/Vehicle.js";

// [Client + Admin] Voir tous les véhicules (avec pagination + tri)
export const getVehicles = async (req, res) => {
  try {
    const {
      minPrice,
      maxPrice,
      year,
      brand,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (year) query.year = Number(year);
    if (brand) query.brand = { $regex: brand, $options: "i" };

    // Pagination
    const skip = (page - 1) * limit;

    let vehicles = Vehicle.find(query).skip(skip).limit(Number(limit));

    // Tri
    if (sort) {
      if (sort === "priceAsc") vehicles = vehicles.sort({ price: 1 });
      if (sort === "priceDesc") vehicles = vehicles.sort({ price: -1 });
      if (sort === "yearAsc") vehicles = vehicles.sort({ year: 1 });
      if (sort === "yearDesc") vehicles = vehicles.sort({ year: -1 });
    }

    // Exécuter la requête
    const results = await vehicles.select(
      "brand model year price image photos vin"
    );

    // Compter le total pour la pagination
    const total = await Vehicle.countDocuments(query);

    res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      vehicles: results,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [Client + Admin] Voir un véhicule par ID
export const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle)
      return res.status(404).json({ message: "Véhicule introuvable" });
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [Admin] Ajouter un véhicule
export const createVehicle = async (req, res) => {
  try {
    const { brand, model, year, price, image, photos, vin } = req.body;

    const vehicle = await Vehicle.create({
      brand,
      model,
      year,
      price,
      image,
      photos,
      vin,
    });

    res.status(201).json(vehicle);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// [Admin] Modifier un véhicule
export const updateVehicle = async (req, res) => {
  try {
    const { brand, model, year, price, image, photos, vin } = req.body;

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { brand, model, year, price, image, photos, vin },
      { new: true }
    );

    if (!vehicle)
      return res.status(404).json({ message: "Véhicule introuvable" });
    res.json(vehicle);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// [Client + Admin] Rechercher véhicules (par modèle, marque, année)
export const searchVehicles = async (req, res) => {
  try {
    const { q } = req.query;

    let query;
    if (isNaN(q)) {
      query = {
        $or: [
          { model: { $regex: q, $options: "i" } },
          { brand: { $regex: q, $options: "i" } },
        ],
      };
    } else {
      query = { year: Number(q) };
    }

    const vehicles = await Vehicle.find(query).select(
      "brand model year price image photos vin"
    );

    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// [Admin] Supprimer un véhicule
export const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
    if (!vehicle)
      return res.status(404).json({ message: "Véhicule introuvable" });
    res.json({ message: "Véhicule supprimé" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
