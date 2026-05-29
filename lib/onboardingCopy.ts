// Phase F.7 — Onboarding UI copy dictionary, en/fr/es.
//
// All static UI strings used by the four onboarding step components +
// the page shell + the StepIndicator live here, keyed by locale. The
// shape is enforced by the OnboardingCopy type so a missing or mistyped
// key surfaces at typecheck time across all three locales.
//
// What lives here: UI chrome — titles, field labels, placeholders,
// helper hints, button labels, status badges.
//
// What does NOT live here: legal disclaimer text. The signed contract
// PDF embeds the full executed agreement (already attorney-reviewed +
// versioned), and runtime legal-text translation goes through the
// legal-agent /generate-disclosures edge function — never hardcoded
// here. The dictionary intentionally has no field for the "Key terms"
// summary bullets that previously lived inline in ContractStep; if the
// product later wants an inline legal preview, it should be wired
// against legal-agent rather than this file.
//
// stores.preferred_language is the input (text, e.g. 'en' / 'fr' /
// 'es-MX'). pickLocale() normalizes to the supported set with an
// en fallback so any unrecognized value gracefully degrades rather
// than 500ing the onboarding page.

export type Locale = "en" | "fr" | "es";

export type OnboardingCopy = {
  page: {
    title: string;
  };
  steps: {
    business: string;
    operations: string;
    banking: string;
    contract: string;
  };
  common: {
    continue: string;
    saving: string;
  };
  business: {
    title: string;
    subtitle: string;
    legal_name: { label: string; placeholder: string };
    dba: { label: string; placeholder: string; hint: string };
    address: { label: string; placeholder: string };
    phone: { label: string; placeholder: string };
    tax_id: { label: string; placeholder: string; hint: string };
  };
  operations: {
    title: string;
    subtitle: string;
    cuisine: {
      label: string;
      placeholder: string;
      // Display labels for the cuisine options. The values posted to
      // the server stay English-canonical (Italian/French/...); only
      // the displayed label is localized.
      options: Record<
        | "Italian"
        | "French"
        | "Asian"
        | "American"
        | "Mexican"
        | "Indian"
        | "Other",
        string
      >;
    };
    capacity: {
      label: string;
      hint: string;
      unit: string;
      placeholder: string;
    };
    radius: {
      label: string;
      hint: string;
      unit: string;
      placeholder: string;
    };
  };
  banking: {
    title: string;
    subtitle: string;
    bullets: [string, string, string];
    privacy: string;
    cta_connect: string;
    busy_opening: string;
    auto_refreshing: string;
    connected_badge: string;
  };
  contract: {
    title: string;
    subtitle: string;
    counterparty_heading: string;
    counterparty_rows: {
      legal_name: string;
      dba: string;
      address: string;
      phone: string;
      tax_id: string;
      cuisine: string;
      email: string;
    };
    // Replaces the F.6 hardcoded "Key terms" bullets — per F.7 spec
    // legal text isn't dictionary-translated. The full agreement is in
    // the signed PDF, which is rendered in the merchant's locale via
    // legal-agent at PDF-generation time.
    pdf_note: string;
    signer_name: { label: string; placeholder: string };
    signer_title: { label: string; placeholder: string };
    signature_label: string;
    signature_clear: string;
    signature_hint: string;
    acceptance_esign: string;
    acceptance_authority: string;
    acceptance_info: string;
    cta_sign: string;
    busy_signing: string;
  };
  // Phase F.8 — post-onboarding "under review" screen, shown when
  // onboarding_status='completed' but stores.is_approved is still
  // false. Friendly waiting screen with email notification expectation.
  pending: {
    title: string;
    subtitle: string;
    timeline_heading: string;
    timeline_signed: string;
    timeline_payouts: string;
    timeline_review: string;
    email_notice: (email: string) => string;
    timing: string;
    sign_out: string;
  };
};

const en: OnboardingCopy = {
  page: { title: "Onboarding" },
  steps: {
    business: "Business",
    operations: "Operations",
    banking: "Banking",
    contract: "Contract",
  },
  common: { continue: "Continue", saving: "Saving…" },
  business: {
    title: "Business info",
    subtitle: "The legal entity that signs the partner agreement and receives payouts.",
    legal_name: { label: "Legal name", placeholder: "GoMiamm Test Kitchen LLC" },
    dba: {
      label: "Doing business as",
      placeholder: "The Kitchen",
      hint: "Trade name shown to customers, if different from the legal name.",
    },
    address: { label: "Business address", placeholder: "123 Main St, St Augustine FL 32084" },
    phone: { label: "Phone", placeholder: "+1 555 555 1234" },
    tax_id: {
      label: "Tax ID (EIN or SSN)",
      placeholder: "12-3456789",
      hint: "Used for 1099 / W-9 tax reporting. Never shown to customers.",
    },
  },
  operations: {
    title: "Operations",
    subtitle: "Helps GoMiamm route the right customers to your kitchen.",
    cuisine: {
      label: "Cuisine type",
      placeholder: "Pick one…",
      options: {
        Italian: "Italian",
        French: "French",
        Asian: "Asian",
        American: "American",
        Mexican: "Mexican",
        Indian: "Indian",
        Other: "Other",
      },
    },
    capacity: {
      label: "Kitchen capacity",
      hint: "Orders your kitchen can fulfill in one hour at peak.",
      unit: "orders / hr",
      placeholder: "20",
    },
    radius: {
      label: "Delivery radius",
      hint: "Maximum distance from your kitchen we'll route customers from.",
      unit: "km",
      placeholder: "5",
    },
  },
  banking: {
    title: "Set up payouts",
    subtitle: "Add a bank account so GoMiamm can deposit your weekly earnings.",
    bullets: [
      "Bank account or debit card for ACH + instant payouts.",
      "Automatic weekly payouts every Monday at 04:00 UTC.",
      "Trigger an instant manual payout any time from the Payouts page.",
    ],
    privacy:
      "You'll be handed off to Stripe's secure form to enter your bank details. GoMiamm never sees or stores your account number — Stripe holds it and pays you on our behalf.",
    cta_connect: "Set up payouts with Stripe",
    busy_opening: "Opening Stripe…",
    auto_refreshing: "Checking Stripe for your latest account status…",
    connected_badge: "Connected",
  },
  contract: {
    title: "Sign your partner contract",
    subtitle: "The executed PDF is delivered to your email and stored under your store profile.",
    counterparty_heading: "Counterparty information",
    counterparty_rows: {
      legal_name: "Legal name",
      dba: "DBA",
      address: "Address",
      phone: "Phone",
      tax_id: "Tax ID",
      cuisine: "Cuisine",
      email: "Email",
    },
    pdf_note:
      "The full agreement and disclosures are included in the contract PDF you'll receive after signing — rendered in your preferred language.",
    signer_name: { label: "Signer name", placeholder: "Your full name" },
    signer_title: { label: "Title", placeholder: "Owner, Manager, CFO…" },
    signature_label: "Signature",
    signature_clear: "Clear",
    signature_hint:
      "Draw with your mouse, trackpad, or finger. Clear and re-sign if you make a mistake.",
    acceptance_esign: "I consent to sign electronically (E-SIGN Act).",
    acceptance_authority: "I have authority to bind this business to the agreement.",
    acceptance_info: "The information above is accurate and current.",
    cta_sign: "Sign & complete onboarding",
    busy_signing: "Signing…",
  },
  pending: {
    title: "Your application is under review",
    subtitle:
      "Thanks for signing! Our team is reviewing your store before activating it on GoMiamm.",
    timeline_heading: "Where you are",
    timeline_signed: "Partner contract signed",
    timeline_payouts: "Stripe payouts connected",
    timeline_review: "Awaiting admin approval",
    email_notice: (email) =>
      `We'll email ${email} the moment your store goes live. No action needed on your end.`,
    timing: "Reviews usually finish within 1 business day.",
    sign_out: "Sign out",
  },
};

const fr: OnboardingCopy = {
  page: { title: "Intégration" },
  steps: {
    business: "Entreprise",
    operations: "Opérations",
    banking: "Banque",
    contract: "Contrat",
  },
  common: { continue: "Continuer", saving: "Enregistrement…" },
  business: {
    title: "Informations sur l'entreprise",
    subtitle:
      "L'entité juridique qui signe le contrat de partenariat et reçoit les versements.",
    legal_name: { label: "Raison sociale", placeholder: "GoMiamm Test Kitchen LLC" },
    dba: {
      label: "Nom commercial",
      placeholder: "La Cuisine",
      hint: "Nom commercial affiché aux clients, s'il diffère de la raison sociale.",
    },
    address: {
      label: "Adresse de l'entreprise",
      placeholder: "123 Rue Principale, St Augustine FL 32084",
    },
    phone: { label: "Téléphone", placeholder: "+1 555 555 1234" },
    tax_id: {
      label: "Numéro fiscal (EIN ou SSN)",
      placeholder: "12-3456789",
      hint: "Utilisé pour la déclaration fiscale 1099 / W-9. Jamais affiché aux clients.",
    },
  },
  operations: {
    title: "Opérations",
    subtitle: "Permet à GoMiamm d'envoyer les bons clients à votre cuisine.",
    cuisine: {
      label: "Type de cuisine",
      placeholder: "Choisissez…",
      options: {
        Italian: "Italienne",
        French: "Française",
        Asian: "Asiatique",
        American: "Américaine",
        Mexican: "Mexicaine",
        Indian: "Indienne",
        Other: "Autre",
      },
    },
    capacity: {
      label: "Capacité de la cuisine",
      hint: "Nombre de commandes que votre cuisine peut traiter par heure aux heures de pointe.",
      unit: "commandes / h",
      placeholder: "20",
    },
    radius: {
      label: "Rayon de livraison",
      hint: "Distance maximale depuis votre cuisine sur laquelle nous accepterons des clients.",
      unit: "km",
      placeholder: "5",
    },
  },
  banking: {
    title: "Configurer les versements",
    subtitle:
      "Ajoutez un compte bancaire pour que GoMiamm puisse vous verser vos revenus hebdomadaires.",
    bullets: [
      "Compte bancaire ou carte de débit pour les virements ACH et instantanés.",
      "Versements hebdomadaires automatiques chaque lundi à 04h00 UTC.",
      "Déclenchez un versement manuel instantané à tout moment depuis la page Versements.",
    ],
    privacy:
      "Vous serez redirigé vers le formulaire sécurisé de Stripe pour saisir vos coordonnées bancaires. GoMiamm ne voit ni ne conserve votre numéro de compte — Stripe le détient et vous paie en notre nom.",
    cta_connect: "Configurer avec Stripe",
    busy_opening: "Ouverture de Stripe…",
    auto_refreshing: "Vérification du statut de votre compte Stripe…",
    connected_badge: "Connecté",
  },
  contract: {
    title: "Signez votre contrat de partenariat",
    subtitle:
      "Le PDF signé est envoyé à votre adresse e-mail et conservé dans le profil de votre établissement.",
    counterparty_heading: "Informations sur la contrepartie",
    counterparty_rows: {
      legal_name: "Raison sociale",
      dba: "Nom commercial",
      address: "Adresse",
      phone: "Téléphone",
      tax_id: "Numéro fiscal",
      cuisine: "Cuisine",
      email: "E-mail",
    },
    pdf_note:
      "L'intégralité du contrat et des informations légales figure dans le PDF que vous recevrez après signature — rendu dans votre langue préférée.",
    signer_name: { label: "Nom du signataire", placeholder: "Votre nom complet" },
    signer_title: { label: "Fonction", placeholder: "Propriétaire, Gérant, Directeur…" },
    signature_label: "Signature",
    signature_clear: "Effacer",
    signature_hint:
      "Signez avec votre souris, votre pavé tactile ou votre doigt. Effacez et recommencez si nécessaire.",
    acceptance_esign:
      "Je consens à signer électroniquement (loi E-SIGN).",
    acceptance_authority:
      "Je dispose du pouvoir d'engager cette entreprise dans le présent contrat.",
    acceptance_info:
      "Les informations ci-dessus sont exactes et à jour.",
    cta_sign: "Signer et finaliser l'intégration",
    busy_signing: "Signature en cours…",
  },
  pending: {
    title: "Votre demande est en cours d'examen",
    subtitle:
      "Merci d'avoir signé ! Notre équipe vérifie votre établissement avant son activation sur GoMiamm.",
    timeline_heading: "Où vous en êtes",
    timeline_signed: "Contrat de partenariat signé",
    timeline_payouts: "Versements Stripe configurés",
    timeline_review: "En attente d'approbation administrative",
    email_notice: (email) =>
      `Nous enverrons un e-mail à ${email} dès l'activation de votre établissement. Aucune action requise de votre part.`,
    timing: "Les examens sont généralement traités sous 1 jour ouvré.",
    sign_out: "Se déconnecter",
  },
};

const es: OnboardingCopy = {
  page: { title: "Registro" },
  steps: {
    business: "Empresa",
    operations: "Operaciones",
    banking: "Banco",
    contract: "Contrato",
  },
  common: { continue: "Continuar", saving: "Guardando…" },
  business: {
    title: "Información de la empresa",
    subtitle:
      "La entidad legal que firma el contrato de partner y recibe los pagos.",
    legal_name: { label: "Nombre legal", placeholder: "GoMiamm Test Kitchen LLC" },
    dba: {
      label: "Nombre comercial",
      placeholder: "La Cocina",
      hint: "Nombre comercial mostrado a los clientes, si difiere del nombre legal.",
    },
    address: {
      label: "Dirección de la empresa",
      placeholder: "123 Calle Principal, St Augustine FL 32084",
    },
    phone: { label: "Teléfono", placeholder: "+1 555 555 1234" },
    tax_id: {
      label: "Identificación fiscal (EIN o SSN)",
      placeholder: "12-3456789",
      hint:
        "Usado para los formularios fiscales 1099 / W-9. Nunca se muestra a los clientes.",
    },
  },
  operations: {
    title: "Operaciones",
    subtitle: "Ayuda a GoMiamm a enviarte los clientes adecuados a tu cocina.",
    cuisine: {
      label: "Tipo de cocina",
      placeholder: "Elige una…",
      options: {
        Italian: "Italiana",
        French: "Francesa",
        Asian: "Asiática",
        American: "Americana",
        Mexican: "Mexicana",
        Indian: "India",
        Other: "Otra",
      },
    },
    capacity: {
      label: "Capacidad de la cocina",
      hint:
        "Pedidos que tu cocina puede atender en una hora en hora pico.",
      unit: "pedidos / h",
      placeholder: "20",
    },
    radius: {
      label: "Radio de entrega",
      hint:
        "Distancia máxima desde tu cocina desde la que enviaremos clientes.",
      unit: "km",
      placeholder: "5",
    },
  },
  banking: {
    title: "Configurar pagos",
    subtitle:
      "Añade una cuenta bancaria para que GoMiamm pueda depositar tus ingresos semanales.",
    bullets: [
      "Cuenta bancaria o tarjeta de débito para pagos ACH e instantáneos.",
      "Pagos semanales automáticos cada lunes a las 04:00 UTC.",
      "Solicita un pago manual instantáneo cuando quieras desde la página de Pagos.",
    ],
    privacy:
      "Te llevaremos al formulario seguro de Stripe para introducir tus datos bancarios. GoMiamm nunca ve ni almacena tu número de cuenta — lo guarda Stripe y te paga en nuestro nombre.",
    cta_connect: "Configurar pagos con Stripe",
    busy_opening: "Abriendo Stripe…",
    auto_refreshing: "Comprobando el estado de tu cuenta en Stripe…",
    connected_badge: "Conectado",
  },
  contract: {
    title: "Firma tu contrato de partner",
    subtitle:
      "El PDF firmado se envía a tu correo electrónico y se guarda en el perfil de tu tienda.",
    counterparty_heading: "Información de la contraparte",
    counterparty_rows: {
      legal_name: "Nombre legal",
      dba: "Nombre comercial",
      address: "Dirección",
      phone: "Teléfono",
      tax_id: "ID fiscal",
      cuisine: "Cocina",
      email: "Correo electrónico",
    },
    pdf_note:
      "El contrato completo y los avisos legales se incluyen en el PDF que recibirás tras firmar — generado en tu idioma preferido.",
    signer_name: { label: "Nombre del firmante", placeholder: "Tu nombre completo" },
    signer_title: { label: "Cargo", placeholder: "Propietario, Gerente, Director…" },
    signature_label: "Firma",
    signature_clear: "Borrar",
    signature_hint:
      "Firma con el ratón, el trackpad o el dedo. Borra y vuelve a firmar si te equivocas.",
    acceptance_esign:
      "Doy mi consentimiento para firmar electrónicamente (Ley E-SIGN).",
    acceptance_authority:
      "Tengo autoridad para vincular a esta empresa con el contrato.",
    acceptance_info:
      "La información anterior es correcta y está al día.",
    cta_sign: "Firmar y finalizar el registro",
    busy_signing: "Firmando…",
  },
  pending: {
    title: "Tu solicitud está en revisión",
    subtitle:
      "¡Gracias por firmar! Nuestro equipo está revisando tu tienda antes de activarla en GoMiamm.",
    timeline_heading: "En qué punto estás",
    timeline_signed: "Contrato de partner firmado",
    timeline_payouts: "Pagos de Stripe conectados",
    timeline_review: "A la espera de aprobación administrativa",
    email_notice: (email) =>
      `Enviaremos un correo a ${email} en cuanto tu tienda esté activa. No tienes que hacer nada más.`,
    timing: "Las revisiones suelen completarse en 1 día hábil.",
    sign_out: "Cerrar sesión",
  },
};

const COPY: Record<Locale, OnboardingCopy> = { en, fr, es };

// stores.preferred_language can be anything ('en', 'fr', 'es', 'es-MX',
// 'pt', null…). Normalize to the first two chars + lowercase and snap
// to one of the supported locales. Anything else falls back to en so
// the page renders rather than 500ing.
export function pickLocale(raw: string | null | undefined): Locale {
  const norm = (raw ?? "en").toLowerCase().slice(0, 2);
  if (norm === "fr") return "fr";
  if (norm === "es") return "es";
  return "en";
}

export function getOnboardingCopy(locale: Locale): OnboardingCopy {
  return COPY[locale];
}
