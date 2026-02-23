// controllers/adminController.js
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Order from "../models/Order.js";
import { importCarsFromVehicleDatabase } from "../services/vehicleDatabaseService.js";

/**
 * 📊 Stats du Dashboard Admin
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Comptes de base
    const clientCount = await User.countDocuments({ role: "user" });
    const vehicleCount = await Vehicle.countDocuments();
    const orderCount = await Order.countDocuments();

    // Total des ventes confirmées (payées)
    const paidOrders = await Order.aggregate([
      { $match: { status: "payée" } },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$totalPrice" },
          count: { $sum: 1 }
        } 
      },
    ]);

    // Commandes en attente
    const pendingOrders = await Order.countDocuments({ status: "en attente" });

    // Répartition des commandes par statut
    const orderStatus = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Stats par marque de véhicule
    const vehiclesByBrand = await Vehicle.aggregate([
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Revenus des 30 derniers jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRevenue = await Order.aggregate([
      { 
        $match: { 
          status: "payée",
          createdAt: { $gte: thirtyDaysAgo }
        } 
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    // Commandes récentes (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Nouveaux clients (30 derniers jours)
    const newClients = await User.countDocuments({
      role: "user",
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Commandes par jour (7 derniers jours)
    const ordersByDay = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          revenue: { $sum: "$totalPrice" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      clients: clientCount,
      newClients,
      vehicles: vehicleCount,
      orders: orderCount,
      recentOrders,
      pendingOrders,
      paidOrders: paidOrders[0]?.count || 0,
      totalSales: paidOrders[0]?.total || 0,
      recentRevenue: recentRevenue[0]?.total || 0,
      orderStatus,
      vehiclesByBrand,
      ordersByDay
    });
  } catch (err) {
    console.error("Erreur getDashboardStats:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 👤 Lister tous les utilisateurs
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🗑️ Supprimer un utilisateur
 */
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    await user.deleteOne();
    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * ✏️ Mettre à jour un utilisateur
 */
export const updateUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🚗 Importer les voitures depuis Vehicle Database
 */
export const importVehicleDatabase = async (req, res) => {
  try {
    console.log("🔄 Début importation manuelle des véhicules par admin...");

    const result = await importCarsFromVehicleDatabase();

    res.status(200).json({
      success: true,
      message: `Importation réussie : ${result.imported} véhicules importés`,
      data: {
        imported: result.imported,
        totalVehicles: result.vehicles.length,
      },
    });

    console.log(
      `✅ Importation terminée par admin : ${result.imported} véhicules`
    );
  } catch (error) {
    console.error(
      "❌ Erreur import Vehicle Database:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'importation des véhicules",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * 🚗 Obtenir tous les véhicules pour l'admin (avec pagination)
 */
export const getAdminVehicles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filtres optionnels
    const filters = {};
    if (req.query.brand) {
      filters.brand = new RegExp(req.query.brand, "i");
    }
    if (req.query.model) {
      filters.model = new RegExp(req.query.model, "i");
    }
    if (req.query.year) {
      filters.year = req.query.year;
    }

    const vehicles = await Vehicle.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalVehicles = await Vehicle.countDocuments(filters);
    const totalPages = Math.ceil(totalVehicles / limit);

    res.json({
      vehicles,
      pagination: {
        currentPage: page,
        totalPages,
        totalVehicles,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🗑️ Vider toute la base de données des véhicules
 */
export const clearAllVehicles = async (req, res) => {
  try {
    const result = await Vehicle.deleteMany({});

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} véhicules supprimés`,
      deletedCount: result.deletedCount,
    });

    console.log(
      `🗑️ Admin a vidé la base : ${result.deletedCount} véhicules supprimés`
    );
  } catch (error) {
    console.error("❌ Erreur lors de la suppression:", error);

    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression des véhicules",
      error: error.message,
    });
  }
};

/**
 * 🔄 Obtenir le statut de l'importation
 */
export const getImportStatus = async (req, res) => {
  try {
    const vehicleCount = await Vehicle.countDocuments();
    const lastVehicle = await Vehicle.findOne().sort({ createdAt: -1 });

    res.json({
      totalVehicles: vehicleCount,
      lastImportDate: lastVehicle?.createdAt || null,
      isEmpty: vehicleCount === 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
