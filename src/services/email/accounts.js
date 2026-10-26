// Emails liés aux comptes créés par l'équipe (invitations)
import { button, escapeHtml, layout } from "./layout.js";
import { sendEmail } from "./sender.js";

const ROLE_TEXT = {
  gestionnaire: "Vous avez été ajouté(e) à l'équipe de gestion de LE-GBA.",
  client: "Un compte client LE-GBA a été créé pour vous.",
};

// Le jeton est placé après # : il n'est jamais envoyé au serveur ni écrit dans ses journaux
export const sendInvitationEmail = (user, token) =>
  sendEmail({
    kind: "invitation",
    to: user.email,
    subject: "Votre compte LE-GBA : choisissez votre mot de passe",
    html: layout(
      `Bienvenue ${user.name}`,
      `<p>${escapeHtml(ROLE_TEXT[user.role] || ROLE_TEXT.client)}</p><p>Pour activer votre compte, choisissez votre mot de passe. Ce lien est valable 72 heures et ne sert qu'une fois.</p>${button("Choisir mon mot de passe", `/activate#${token}`)}`
    ),
  });
