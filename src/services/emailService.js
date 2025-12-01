import nodemailer from 'nodemailer';

/**
 * Configuration du transporteur Nodemailer
 * Utilise Gmail avec authentification par mot de passe d'application
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

/**
 * Envoie un email de notification à l'admin lors d'une nouvelle commande
 * @param {Object} orderData - Les données de la commande
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export const sendNewOrderEmail = async (orderData) => {
  try {
    const transporter = createTransporter();

    const {
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      pickupDate,
      returnDate,
      totalPrice,
    } = orderData;

    const mailOptions = {
      from: `"GBA Location" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `🚗 Nouvelle commande #${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            Nouvelle commande de location
          </h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #3498db; margin-top: 0;">Informations Client</h3>
            <p><strong>Nom:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customerEmail}</p>
            <p><strong>Téléphone:</strong> ${customerPhone}</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #3498db; margin-top: 0;">Détails du Véhicule</h3>
            <p><strong>Véhicule:</strong> ${vehicleMake} ${vehicleModel} (${vehicleYear})</p>
            <p><strong>Date de récupération:</strong> ${new Date(pickupDate).toLocaleDateString('fr-FR')}</p>
            <p><strong>Date de retour:</strong> ${new Date(returnDate).toLocaleDateString('fr-FR')}</p>
          </div>

          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">Prix Total</h3>
            <p style="font-size: 24px; font-weight: bold; color: #27ae60; margin: 0;">${totalPrice} €</p>
          </div>

          <div style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border-radius: 5px;">
            <p style="margin: 0; color: #856404;">
              ⚠️ Veuillez vérifier cette commande et la valider ou la rejeter depuis le panneau d'administration.
            </p>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            Cet email a été envoyé automatiquement par le système GBA Location.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé à l\'admin:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      message: 'Email envoyé avec succès à l\'administrateur',
    };
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email à l\'admin:', error);
    throw new Error(`Échec de l'envoi de l'email: ${error.message}`);
  }
};

/**
 * Envoie un email de confirmation au client selon le statut de sa commande
 * @param {Object} orderData - Les données de la commande
 * @param {String} status - Le statut de la commande (approved/rejected)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export const sendOrderConfirmation = async (orderData, status) => {
  try {
    const transporter = createTransporter();

    const {
      orderId,
      customerName,
      customerEmail,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      pickupDate,
      returnDate,
      totalPrice,
    } = orderData;

    const isApproved = status === 'approved';
    
    const mailOptions = {
      from: `"GBA Location" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: isApproved 
        ? `✅ Commande confirmée #${orderId}` 
        : `❌ Commande refusée #${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid ${isApproved ? '#27ae60' : '#e74c3c'}; padding-bottom: 10px;">
            ${isApproved ? '✅ Commande Confirmée' : '❌ Commande Refusée'}
          </h2>
          
          <p style="font-size: 16px; color: #34495e;">
            Bonjour <strong>${customerName}</strong>,
          </p>

          ${isApproved ? `
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; border-left: 4px solid #27ae60; margin: 20px 0;">
              <p style="color: #27ae60; font-weight: bold; margin: 0;">
                🎉 Bonne nouvelle ! Votre commande a été confirmée.
              </p>
            </div>
            
            <p style="color: #34495e;">
              Nous avons le plaisir de vous informer que votre réservation a été validée. 
              Votre véhicule sera prêt à la date convenue.
            </p>
          ` : `
            <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #e74c3c; margin: 20px 0;">
              <p style="color: #e74c3c; font-weight: bold; margin: 0;">
                Nous sommes désolés, votre commande n'a pas pu être validée.
              </p>
            </div>
            
            <p style="color: #34495e;">
              Malheureusement, nous ne pouvons pas donner suite à votre réservation. 
              Le véhicule n'est peut-être plus disponible aux dates demandées.
            </p>
          `}

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #3498db; margin-top: 0;">Récapitulatif de votre commande</h3>
            <p><strong>Numéro de commande:</strong> #${orderId}</p>
            <p><strong>Véhicule:</strong> ${vehicleMake} ${vehicleModel} (${vehicleYear})</p>
            <p><strong>Date de récupération:</strong> ${new Date(pickupDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Date de retour:</strong> ${new Date(returnDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Prix total:</strong> <span style="font-size: 18px; font-weight: bold; color: #27ae60;">${totalPrice} €</span></p>
          </div>

          ${isApproved ? `
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">📋 Prochaines étapes:</h4>
              <ul style="color: #856404; line-height: 1.8;">
                <li>Préparez vos documents (permis de conduire, pièce d'identité)</li>
                <li>Présentez-vous à notre agence à la date convenue</li>
                <li>Le paiement sera effectué lors de la récupération du véhicule</li>
              </ul>
            </div>
          ` : `
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #1565c0; margin: 0;">
                💡 N'hésitez pas à nous contacter pour trouver une alternative ou réserver à d'autres dates.
              </p>
            </div>
          `}

          <div style="margin-top: 30px; padding: 15px; background-color: #ecf0f1; border-radius: 5px;">
            <p style="margin: 0; color: #34495e;">
              Pour toute question, contactez-nous:<br>
              📧 Email: ${process.env.ADMIN_EMAIL}<br>
              📞 Téléphone: +33 X XX XX XX XX
            </p>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            Merci de votre confiance.<br>
            L'équipe GBA Location
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmation (${status}) envoyé au client:`, info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      message: `Email de confirmation (${status}) envoyé avec succès au client`,
    };
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation:', error);
    throw new Error(`Échec de l'envoi de l'email de confirmation: ${error.message}`);
  }
};

/**
 * Teste la configuration du service email
 * @returns {Promise<Boolean>} True si la configuration est valide
 */
export const testEmailConfiguration = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Configuration email valide');
    return true;
  } catch (error) {
    console.error('❌ Configuration email invalide:', error);
    return false;
  }
};
