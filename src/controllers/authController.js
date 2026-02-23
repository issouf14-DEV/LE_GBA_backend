import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail } from "../services/emailService.js";

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ message: "Email déjà utilisé" });

    const user = await User.create({ name, email, password });
    
    // Envoyer l'email de bienvenue (non-bloquant)
    sendWelcomeEmail({ name: user.name, email: user.email })
      .then(() => console.log('✅ Email de bienvenue envoyé à', email))
      .catch(err => console.error('❌ Erreur email de bienvenue:', err.message));

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, user.role),
      });
    } else {
      res.status(401).json({ message: "Email ou mot de passe invalide" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/send-welcome-email
 * Envoie manuellement un email de bienvenue (pour tests ou renvoi)
 */
export const sendManualWelcomeEmail = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Nom et email requis" });
    }

    const result = await sendWelcomeEmail({ name, email });

    res.status(200).json({
      message: "Email de bienvenue envoyé avec succès",
      result,
    });
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi de l'email de bienvenue:", err);
    res.status(500).json({ 
      message: "Échec de l'envoi de l'email de bienvenue",
      error: err.message 
    });
  }
};
