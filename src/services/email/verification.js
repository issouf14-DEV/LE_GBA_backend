// Emails de vérification de l'adresse et d'alerte sur la double authentification
import { button, escapeHtml, layout } from "./layout.js";
import { sendEmail } from "./sender.js";

const codeBlock = (code) =>
  `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;text-align:center;margin:24px 0">${escapeHtml(code)}</p>`;

// Envoyé à l'inscription (et sur demande) : le code prouve que l'adresse appartient au client
export const sendEmailCodeEmail = (user, code, minutes) =>
  sendEmail({
    kind: "vérification de l'adresse",
    to: user.email,
    // Pas de code dans l'objet : il s'affiche dans les notifications, même écran verrouillé
    subject: "Confirmez votre adresse email LE-GBA",
    html: layout(
      `Bienvenue ${user.name}`,
      `<p>Pour confirmer votre adresse email et pouvoir réserver, tapez ce code sur le site :</p>${codeBlock(code)}
      <p>Il est valable <strong>${escapeHtml(String(minutes))} minutes</strong>. Vous pouvez en demander un nouveau depuis votre espace.</p>
      <p>Si vous n'avez pas créé de compte LE-GBA, ignorez cet email. Ne communiquez jamais ce code.</p>`
    ),
  });

export const sendMfaEnabledEmail = (user) =>
  sendEmail({
    kind: "2FA activée",
    to: user.email,
    subject: "Double authentification activée sur votre compte LE-GBA",
    html: layout(
      "Double authentification activée",
      `<p>Votre compte est désormais protégé par un code de votre application d'authentification à chaque connexion.</p>
      <p>Gardez vos codes de secours en lieu sûr : ils vous permettent de vous connecter si vous perdez votre téléphone.</p>
      <p>Si ce n'est pas vous, prévenez immédiatement le super-administrateur.</p>`
    ),
  });

export const sendMfaResetEmail = (user) =>
  sendEmail({
    kind: "2FA réinitialisée",
    to: user.email,
    subject: "Votre double authentification LE-GBA a été réinitialisée",
    html: layout(
      "Double authentification réinitialisée",
      `<p>Le super-administrateur a réinitialisé la double authentification de votre compte, et toutes vos sessions ont été fermées.</p>
      <p>À votre prochaine connexion, vous configurerez à nouveau votre application d'authentification.</p>
      <p>Si vous n'avez rien demandé, contactez-le immédiatement.</p>${button("Me connecter", "/login")}`
    ),
  });
