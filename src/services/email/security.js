// Emails de sécurité du compte : code de réinitialisation, alerte de changement de mot de passe
import { button, escapeHtml, layout } from "./layout.js";
import { sendEmail } from "./sender.js";

const duration = (seconds) =>
  seconds < 120 ? `${seconds} secondes` : `${Math.round(seconds / 60)} minutes`;

// Aucun lien contenant un secret : l'utilisateur tape ce code sur le site, avec son adresse
export const sendPasswordResetCodeEmail = (user, code, ttlSeconds) =>
  sendEmail({
    kind: "code de réinitialisation",
    to: user.email,
    // Pas de code dans l'objet : il s'affiche dans les notifications, même écran verrouillé
    subject: "Votre code de réinitialisation LE-GBA",
    html: layout(
      "Réinitialisation du mot de passe",
      `<p>Voici votre code pour choisir un nouveau mot de passe :</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;text-align:center;margin:24px 0">${escapeHtml(code)}</p>
      <p>Il est valable <strong>${escapeHtml(duration(ttlSeconds))}</strong> et ne sert qu'une fois. Tapez-le sur la page « Mot de passe oublié » du site.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé. Ne communiquez jamais ce code, même à LE-GBA.</p>`
    ),
  });

export const sendPasswordChangedEmail = (user) =>
  sendEmail({
    kind: "mot de passe modifié",
    to: user.email,
    subject: "Votre mot de passe LE-GBA a été modifié",
    html: layout(
      "Mot de passe modifié",
      `<p>Le mot de passe de votre compte vient d'être modifié, et toutes vos sessions ont été fermées.</p>
      <p>Si ce n'est pas vous, choisissez immédiatement un nouveau mot de passe et contactez-nous.</p>${button("Choisir un nouveau mot de passe", "/forgot-password")}`
    ),
  });
