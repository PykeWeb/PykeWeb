export const copy = {
  common: {
    cancel: 'Annuler',
    save: 'Enregistrer',
    createItem: 'Créer un item',
    allCategories: 'Toutes catégories',
    allTypes: 'Tous les types',
  },
  itemForm: {

    labels: {
      name: 'Nom',
      category: 'Catégorie',
      type: 'Type',
      weaponId: 'ID (arme)',
      image: 'Image',
      buyPrice: 'Prix achat',
      sellPrice: 'Prix vente',
      initialStock: 'Stock initial',
      description: 'Description',
      unifiedSubtitle: 'Formulaire unifié',
    },
    sections: {
      infos: 'Infos',
      economy: 'Économie',
      stock: 'Stock',
    },
    fields: {
      name: 'Nom *',
      category: 'Catégorie *',
      type: 'Type *',
      internalId: 'ID interne (unique)',
      description: 'Description',
      buyPrice: 'Prix achat',
      sellPrice: 'Prix vente',
      internalValue: 'Valeur interne',
      stockInitial: 'Stock initial',
      stockLow: 'Seuil stock bas',
      weight: 'Poids',
      maxStack: 'Max stack',
    },
    toggles: {
      showInFinance: 'Afficher dans Finance',
      active: 'Actif',
      stackable: 'Empilable',
    },
    errors: {
      createFailed: 'Impossible de créer l’item.',
      nameRequired: 'Le nom est obligatoire.',
      typeRequired: 'Le type est obligatoire.',
    },
  },
  finance: {

    stockFlow: {
      stockOutTitle: 'Sortie du stock',
      stockOutSubtitle: 'Sortie des items du stock par les membres pour des raisons diverses.',
      stockOutReasonRequired: 'Raison obligatoire pour une sortie de stock.',
      stockOutSaved: 'Sortie de stock enregistrée.',
      stockOutModeLabel: 'Sortie',
      stockInTitle: 'Entrée du stock',
      stockInSubtitle: 'Entrée des items en stock par les membres pour des raisons diverses.',
      stockInReasonRequired: 'Raison obligatoire pour une entrée de stock.',
      stockInSaved: 'Entrée de stock enregistrée.',
      stockInModeLabel: 'Entrée',
      stockInOutButton: 'Entrée / Sortie',
    },

    trade: {
      title: 'Achat / Vente (Items)',
      subtitle: 'Formulaire unifié',
      modeBuy: 'Achat',
      modeSell: 'Vente / Sortie',
      typeOptional: 'Type (optionnel)',
      selectedItem: 'Item sélectionné',
      stockNow: 'Stock actuel',
      noItem: 'Aucun item sélectionné',
      saveInProgress: 'Validation…',
    },
    actions: {
      buy: 'Achat',
      sell: 'Vente / Sortie',
      validate: 'Valider',
    },
    labels: {
      counterparty: 'Interlocuteur',
      notes: 'Notes',
      paymentMode: 'Mode de paiement',
      quantity: 'Quantité',
      unitPrice: 'Prix unitaire (override)',
      total: 'Total',
      item: 'Item *',
      category: 'Catégorie',
    },
    errors: {
      loadItemsFailed: 'Impossible de charger les items.',
      saveFailed: 'Impossible d’enregistrer la transaction.',
      stockInsufficient: 'Stock insuffisant pour cette vente/sortie.',
      loadFailed: 'Impossible de charger la finance.',
    },
    toastSaved: 'Transaction enregistrée.',
  },
  activities: {
    title: 'Preuve de Dépense',
    subtitle: 'Choisis les objets/équipements du groupe avec image et quantité, puis calcule automatiquement le salaire.',
  }
} as const

const PAGE_LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: '/admin/dashboard', label: 'Dashboard' },
  { prefix: '/admin/groupes', label: 'Groupes' },
  { prefix: '/admin/catalogue-global', label: 'Catalogue global' },
  { prefix: '/admin/tablette', label: 'Tablette' },
  { prefix: '/admin/service/achat-service-tablette', label: 'Achat service' },
  { prefix: '/admin/patch-notes', label: 'Patch notes' },
  { prefix: '/admin/support', label: 'Support' },
  { prefix: '/admin/logs', label: 'Logs' },
  { prefix: '/finance/stats-interlocuteurs', label: 'Stats' },
  { prefix: '/finance/depense', label: 'Dépense' },
  { prefix: '/finance', label: 'Finance' },
  { prefix: '/activites/depense', label: 'Dépense' },
  { prefix: '/items', label: 'Items' },
  { prefix: '/drogues', label: 'Drogues' },
  { prefix: '/tablette', label: 'Tablette' },
  { prefix: '/group', label: 'Gestion groupe' },
  { prefix: '/activites', label: 'Activités' },
  { prefix: '/armes', label: 'Armes' },
  { prefix: '/objets', label: 'Objets' },
  { prefix: '/equipement', label: 'Équipement' },
  { prefix: '/depenses', label: 'Dépenses' },
  { prefix: '/transactions', label: 'Transactions' },
  { prefix: '/logs', label: 'Logs' },
  { prefix: '/patch-notes', label: 'Patch notes' },
  { prefix: '/pwr/commandes', label: 'Commande' },
]

type PageContext = {
  label: string
}

type PreciseMode = 'buy' | 'sell' | null

function normalizeMode(mode?: string | null): PreciseMode {
  if (mode === 'buy') return 'buy'
  if (mode === 'sell') return 'sell'
  return null
}

function resolvePreciseLabel(pathname: string, mode?: string | null) {
  const preciseMode = normalizeMode(mode)

  if (pathname === '/finance/achat-vente' || pathname.startsWith('/finance/achat-vente/')) {
    if (preciseMode === 'sell') return 'Vente'
    return 'Achat'
  }

  if (pathname === '/finance/entree-sortie' || pathname.startsWith('/finance/entree-sortie/')) {
    if (preciseMode === 'sell') return 'Sortie'
    return 'Entrée'
  }

  if (pathname === '/items/achat-vente' || pathname.startsWith('/items/achat-vente/')) {
    if (preciseMode === 'sell') return 'Vente'
    return 'Achat'
  }

  return null
}

export function resolvePageContext(pathname: string, mode?: string | null): PageContext {
  if (pathname === '/') return { label: 'Dashboard' }

  const preciseLabel = resolvePreciseLabel(pathname, mode)
  if (preciseLabel) return { label: preciseLabel }

  const match = PAGE_LABELS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return {
    label: match?.label || 'Page',
  }
}

export function resolvePageLabel(pathname: string, mode?: string | null) {
  return resolvePageContext(pathname, mode).label
}
