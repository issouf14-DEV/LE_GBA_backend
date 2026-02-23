import sgMail from '@sendgrid/mail';

/**
 * Configuration SendGrid
 * Plus fiable que Gmail SMTP pour les services cloud comme Render
 */
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Fonction utilitaire pour envoyer des emails via SendGrid
 * @param {Object} emailData - Les données de l'email
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendEmail = async (emailData) => {
  try {
    const msg = {
      from: {
        email: process.env.EMAIL_USER || 'noreply@gba.com',
        name: 'GBA Location'
      },
      ...emailData
    };

    const response = await sgMail.send(msg);
    console.log('✅ Email envoyé avec succès via SendGrid');
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      accepted: [emailData.to]
    };
  } catch (error) {
    console.error('❌ Erreur SendGrid:', error.response?.body || error.message);
    throw new Error(`Échec d'envoi email: ${error.message}`);
  }
};

/**
 * Envoie un email de notification à l'admin lors d'une nouvelle commande
 * @param {Object} orderData - Les données de la commande
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export const sendNewOrderEmail = async (orderData) => {
  try {
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

    const emailData = {
      to: process.env.ADMIN_EMAIL || 'fofanaissouf179@gmail.com',
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
            <p><strong>Téléphone:</strong> ${customerPhone || 'Non renseigné'}</p>
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

    return await sendEmail(emailData);

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email admin:', error);
    throw error;
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
    
    const emailData = {
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
              📧 Email: ${process.env.ADMIN_EMAIL || 'fofanaissouf179@gmail.com'}<br>
              📞 Téléphone: +33 X XX XX XX XX
            </p>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            Cet email a été envoyé automatiquement par le système GBA Location.
          </p>
        </div>
      `,
    };

    return await sendEmail(emailData);

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation:', error);
    throw error;
  }
};

/**
 * Envoie un email de bienvenue au nouvel utilisateur
 * @param {Object} userData - Les données de l'utilisateur
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export const sendWelcomeEmail = async (userData) => {
  try {
    const { name, email } = userData;

    const emailData = {
      to: email,
      subject: `🎉 Bienvenue chez GBA Location, ${name} !`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3498db; margin: 0;">🚗 GBA Location</h1>
            <p style="color: #7f8c8d; margin: 10px 0 0 0;">Votre partenaire location de véhicules</p>
          </div>

          <h2 style="color: #2c3e50; text-align: center;">Bienvenue ${name} !</h2>
          
          <p style="font-size: 16px; color: #34495e; line-height: 1.6;">
            Nous sommes ravis de vous accueillir dans la famille GBA Location ! 🎉
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #3498db; margin-top: 0;">Ce que nous vous offrons :</h3>
            <ul style="color: #34495e; line-height: 1.8;">
              <li>🚗 Large gamme de véhicules</li>
              <li>💰 Prix compétitifs</li>
              <li>📞 Support client 7j/7</li>
              <li>🔧 Véhicules entretenus et assurés</li>
              <li>⚡ Réservation en ligne simple</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://gba-location.com'}/vehicles" 
               style="display: inline-block; background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              🚗 Découvrir nos véhicules
            </a>
          </div>

          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; border-left: 4px solid #27ae60; margin: 20px 0;">
            <p style="color: #27ae60; margin: 0;">
              <strong>Astuce :</strong> Réservez à l'avance pour bénéficier de nos meilleurs tarifs !
            </p>
          </div>

          <div style="margin-top: 30px; padding: 15px; background-color: #ecf0f1; border-radius: 5px;">
            <p style="margin: 0; color: #34495e; text-align: center;">
              Des questions ? Nous sommes là pour vous aider !<br>
              📧 ${process.env.ADMIN_EMAIL || 'fofanaissouf179@gmail.com'} | 📞 +33 X XX XX XX XX
            </p>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            Cet email a été envoyé automatiquement suite à votre inscription sur GBA Location.
          </p>
        </div>
      `,
    };

    return await sendEmail(emailData);

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de bienvenue:', error);
    throw error;
  }
};

/**
 * Envoie un rappel de paiement au client
 * @param {Object} orderData - Les données de la commande
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export const sendPaymentReminderEmail = async (orderData) => {
  try {
    const {
      orderId,
      customerName,
      customerEmail,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      totalPrice,
      dueDate,
      daysRemaining
    } = orderData;

    const emailData = {
      to: customerEmail,
      subject: `⏰ Rappel de paiement - Commande #${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #e67e22; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">
            ⏰ Rappel de paiement
          </h2>
          
          <p style="font-size: 16px; color: #34495e;">
            Bonjour <strong>${customerName}</strong>,
          </p>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="color: #856404; font-weight: bold; margin: 0;">
              ⚠️ Votre paiement pour la commande #${orderId} est en attente.
            </p>
          </div>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #e67e22; margin-top: 0;">Détails de votre commande</h3>
            <p><strong>Véhicule:</strong> ${vehicleMake} ${vehicleModel} (${vehicleYear})</p>
            <p><strong>Montant à payer:</strong> <span style="font-size: 20px; font-weight: bold; color: #e67e22;">${totalPrice} €</span></p>
            <p><strong>Date limite:</strong> ${new Date(dueDate).toLocaleDateString('fr-FR')}</p>
            <p><strong>Jours restants:</strong> <span style="color: ${daysRemaining <= 2 ? '#e74c3c' : '#e67e22'}; font-weight: bold;">${daysRemaining} jour(s)</span></p>
          </div>

          <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #2980b9; margin-top: 0;">💳 Moyens de paiement acceptés:</h4>
            <ul style="color: #34495e; line-height: 1.6;">
              <li>Carte bancaire (Visa, MasterCard)</li>
              <li>Virement bancaire</li>
              <li>PayPal</li>
              <li>Espèces (en agence)</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://gba-location.com'}/payment/${orderId}" 
               style="display: inline-block; background-color: #e67e22; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              💳 Payer maintenant
            </a>
          </div>

          ${daysRemaining <= 2 ? `
            <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #e74c3c; margin: 20px 0;">
              <p style="color: #e74c3c; font-weight: bold; margin: 0;">
                🚨 Attention : Si le paiement n'est pas effectué sous 48h, votre réservation sera annulée.
              </p>
            </div>
          ` : ''}

          <div style="margin-top: 30px; padding: 15px; background-color: #ecf0f1; border-radius: 5px;">
            <p style="margin: 0; color: #34495e;">
              Questions ? Contactez-nous:<br>
              📧 Email: ${process.env.ADMIN_EMAIL || 'fofanaissouf179@gmail.com'}<br>
              📞 Téléphone: +33 X XX XX XX XX
            </p>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            Cet email a été envoyé automatiquement par le système GBA Location.
          </p>
        </div>
      `,
    };

    return await sendEmail(emailData);

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du rappel de paiement:', error);
    throw error;
  }
};

/**
 * Envoie un récapitulatif de location après restitution
 * @param {Object} rentalData - Les données de la location
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export const sendRentalSummaryEmail = async (rentalData) => {
  try {
    const {
      orderId,
      customerName,
      customerEmail,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      startDate,
      endDate,
      startKm,
      endKm,
      kmTraveled,
      fuelLevelStart,
      fuelLevelEnd,
      vehicleCondition,
      rentalPrice,
      additionalCharges,
      additionalChargesReason,
      totalPrice
    } = rentalData;

    const emailData = {
      to: customerEmail,
      subject: `📄 Récapitulatif de location - Commande #${orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">
            📄 Récapitulatif de votre location
          </h2>
          
          <p style="font-size: 16px; color: #34495e;">
            Bonjour <strong>${customerName}</strong>,
          </p>

          <p style="color: #34495e;">
            Merci d'avoir choisi GBA Location ! Voici le récapitulatif de votre location.
          </p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">🚗 Détails du véhicule</h3>
            <p><strong>Véhicule:</strong> ${vehicleMake} ${vehicleModel} (${vehicleYear})</p>
            <p><strong>Période de location:</strong> ${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}</p>
            <p><strong>Durée:</strong> ${Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} jour(s)</p>
          </div>

          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">📊 État du véhicule</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <p><strong>Kilométrage initial:</strong> ${startKm ? startKm.toLocaleString() : 'N/A'} km</p>
                <p><strong>Kilométrage final:</strong> ${endKm ? endKm.toLocaleString() : 'N/A'} km</p>
                <p><strong>Distance parcourue:</strong> <span style="color: #27ae60; font-weight: bold;">${kmTraveled ? kmTraveled.toLocaleString() : 'N/A'} km</span></p>
              </div>
              <div>
                <p><strong>Carburant (début):</strong> ${fuelLevelStart || 'N/A'}</p>
                <p><strong>Carburant (fin):</strong> ${fuelLevelEnd || 'N/A'}</p>
                <p><strong>État général:</strong> <span style="color: #27ae60;">${vehicleCondition || 'Bon état'}</span></p>
              </div>
            </div>
          </div>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2980b9; margin-top: 0;">💰 Facturation</h3>
            <p><strong>Prix de location:</strong> ${rentalPrice} €</p>
            ${additionalCharges > 0 ? `
              <p><strong>Frais supplémentaires:</strong> ${additionalCharges} €</p>
              <p style="font-size: 14px; color: #7f8c8d;"><em>Raison: ${additionalChargesReason}</em></p>
            ` : ''}
            <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
            <p><strong>Total final:</strong> <span style="font-size: 20px; font-weight: bold; color: #27ae60;">${totalPrice} €</span></p>
          </div>

          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #1565c0; margin-top: 0;">⭐ Votre avis nous intéresse !</h4>
            <p style="color: #34495e; margin-bottom: 15px;">
              Aidez-nous à améliorer nos services en laissant un avis sur votre expérience.
            </p>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://gba-location.com'}/review/${orderId}" 
                 style="display: inline-block; background-color: #1565c0; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                ⭐ Laisser un avis
              </a>
            </div>
          </div>

          <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800; margin: 20px 0;">
            <h4 style="color: #e65100; margin-top: 0;">🎁 Offre spéciale fidélité</h4>
            <p style="color: #e65100; margin: 0;">
              <strong>Code promo:</strong> <code style="background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px;">FIDELE10</code><br>
              <em>10% de réduction sur votre prochaine location !</em>
            </p>
          </div>

          <div style="margin-top: 30px; padding: 15px; background-color: #ecf0f1; border-radius: 5px;">
            <p style="margin: 0; color: #34495e;">
              Merci de votre confiance ! Pour toute question:<br>
              📧 Email: ${process.env.ADMIN_EMAIL || 'fofanaissouf179@gmail.com'}<br>
              📞 Téléphone: +33 X XX XX XX XX
            </p>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
            Cet email a été envoyé automatiquement par le système GBA Location.
          </p>
        </div>
      `,
    };

    return await sendEmail(emailData);

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du récapitulatif de location:', error);
    throw error;
  }
};

/**
 * Teste la configuration email SendGrid
 * @returns {Promise<Object>} Résultat du test
 */
export const testEmailConfiguration = async () => {
  try {
    console.log('🧪 Test de configuration SendGrid...');

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY non configurée');
    }

    if (!process.env.EMAIL_USER) {
      throw new Error('EMAIL_USER non configurée');
    }

    // Test simple
    const testEmail = {
      to: process.env.ADMIN_EMAIL || 'fofanaissouf179@gmail.com',
      subject: '🧪 Test SendGrid - GBA Location',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #27ae60;">✅ Test SendGrid réussi !</h2>
          <p>Si vous recevez cet email, la configuration SendGrid fonctionne parfaitement.</p>
          <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
          <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
          <hr>
          <p style="color: #7f8c8d; font-size: 12px;">Test automatique - GBA Location</p>
        </div>
      `,
    };

    const result = await sendEmail(testEmail);
    
    console.log('✅ Configuration SendGrid validée avec succès');
    return {
      success: true,
      message: 'Configuration SendGrid opérationnelle',
      result
    };

  } catch (error) {
    console.error('❌ Échec du test SendGrid:', error.message);
    return {
      success: false,
      message: 'Échec de la configuration SendGrid',
      error: error.message
    };
  }
};