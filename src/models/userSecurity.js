// Mots de passe et verrouillage des comptes (méthodes ajoutées au schéma User)
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;
// Filet de sécurité derrière les limites par compte + IP : 20 échecs en 15 minutes,
// depuis de nombreuses adresses, verrouillent le compte 15 minutes
const MAX_FAILED_LOGINS = 20;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export function applySecurityMethods(schema) {
  schema.pre("save", async function hashPassword() {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, BCRYPT_COST);
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
      this.tokenVersion = (this.tokenVersion || 0) + 1;
    }
  });

  schema.methods.matchPassword = function matchPassword(candidate) {
    return bcrypt.compare(String(candidate), this.password);
  };

  schema.methods.isLocked = function isLocked() {
    return Boolean(this.lockUntil && this.lockUntil > Date.now());
  };

  // Verrouillage temporaire après trop d'échecs (force brute distribuée sur plusieurs IP)
  schema.methods.registerFailedLogin = async function registerFailedLogin() {
    // Les échecs anciens sont oubliés : le compteur ne grimpe pas indéfiniment
    const recent = this.lastFailedLogin && Date.now() - this.lastFailedLogin < FAILURE_WINDOW_MS;
    this.failedLogins = (recent ? this.failedLogins || 0 : 0) + 1;
    this.lastFailedLogin = new Date();
    if (this.failedLogins >= MAX_FAILED_LOGINS) {
      this.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      this.failedLogins = 0;
    }
    await this.save({ validateModifiedOnly: true });
  };

  schema.methods.clearFailedLogins = async function clearFailedLogins() {
    if (!this.failedLogins && !this.lockUntil) return;
    this.failedLogins = 0;
    this.lockUntil = undefined;
    await this.save({ validateModifiedOnly: true });
  };
}
