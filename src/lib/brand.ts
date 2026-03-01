export const BRAND = {
  // Nom affiché dans l'UI
  name: 'Pyke Stock',
  // Petite baseline courte (utilisée dans les titres)
  tagline: 'Stock RP (FiveM)',
  // Titre complet affiché dans le header
  fullTitle: 'Pyke Stock — Stock RP (FiveM)',
  // Description (SEO / meta)
  description:
    "Tableau de bord moderne pour gérer le stock d'un groupe RP sur FiveM : catalogue d'objets, images, transactions, armes et prêts."
} as const

export const GROUP = {
  // Nom affiché dans la sidebar (tablette par groupe)
  name: process.env.NEXT_PUBLIC_GROUP_NAME ?? 'Nom du groupe',
  // Petit label optionnel (ex: type, rang, etc.)
  badge: process.env.NEXT_PUBLIC_GROUP_BADGE ?? 'GROUPE'
} as const
