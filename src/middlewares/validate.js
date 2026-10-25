// Valide req.body (ou req.params / req.query) avec un schéma Zod et remplace les données
// par la version nettoyée : seuls les champs prévus atteignent les contrôleurs
export const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      return res.status(400).json({
        message: issue?.message || "Données invalides",
        field: issue?.path?.join("."),
      });
    }
    if (source === "body") req.body = result.data;
    else req.validated = { ...req.validated, [source]: result.data };
    return next();
  };
