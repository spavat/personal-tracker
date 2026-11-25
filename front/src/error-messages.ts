import type { ErrorBody, ErrorParams } from "@personal-tracker/shared/errors";

// The French text of an API error, from its code and params (see .scratch/error-codes/spec.md)

const RESOURCES: Record<string, string> = {
	account: "Compte",
	activity: "Activité",
	artist: "Artiste",
	author: "Auteur·ice",
	bank: "Banque",
	book: "Livre",
	category: "Catégorie",
	context_tag: "Tag de contexte",
	edition: "Édition",
	entity: "Entité",
	episode: "Épisode",
	format: "Format",
	event: "Événement",
	game: "Jeu",
	genre: "Genre",
	image: "Image",
	lifespan_category: "Catégorie",
	listening: "Écoute",
	manga: "Manga",
	media: "Média",
	model: "Modèle",
	object: "Objet",
	payment_type: "Moyen de paiement",
	performance: "Représentation",
	place: "Salle",
	play: "Partie",
	program: "Programme",
	proposal: "Proposition",
	reading: "Lecture",
	season: "Saison",
	series: "Série",
	spectacle: "Spectacle",
	tag: "Tag",
	transaction: "Transaction",
	view: "Écoute",
	work: "Œuvre",
};

type Text = (params: ErrorParams) => string;

// has_dependents: `${resource}.${dependent}`
const DEPENDENTS: Record<string, Text> = {
	"account.history": ({ count }) => `Le compte a un historique (${count})`,
	"account.payment_types": ({ count }) => `Le compte a des moyens de paiement (${count})`,
	"bank.accounts": ({ count }) => `La banque a encore des comptes (${count})`,
	"category.children": () => "La catégorie a des sous-catégories : impossible de la supprimer",
	"category.transactions": () => "La catégorie a des transactions : impossible de la supprimer",
	"payment_type.transactions": ({ count }) => `Le moyen de paiement est encore utilisé par ${count} transactions`,
	"tag.children": () => "Le tag a des sous-tags : impossible de le supprimer",
	"tag.transactions": ({ count }) => `Le tag est encore utilisé par ${count} transactions`,
	"lifespan_category.children": () =>
		"Cette catégorie a des sous-catégories. Supprimez-les ou déplacez-les avant de continuer.",
	"lifespan_category.objects": () =>
		"Des objets sont encore rattachés à cette catégorie. Déplacez-les avant de continuer.",
	"model.readings": () => "Ce modèle est utilisé par une édition qui a des lectures",
	"edition.readings": () => "Cette édition a des lectures : supprimez-les d'abord",
	"media.uses": () => "Média utilisé (représentation, rôle ou photo principale) : retirez-le d'abord",
};

// by resource
const INVALID_IMAGE: Record<string, string> = {
	portrait: "Portrait illisible",
	cover: "Image de couverture illisible",
	media: "Format non supporté : image ou PDF uniquement",
};
const INVALID_REFERENCE: Record<string, Text> = {
	book: () => "Livre inconnu",
	series: () => "Série inconnue",
	model: () => "Ce modèle n'est pas un modèle du livre",
	poster: () => "L'affiche doit être un média « affiche » de ce spectacle",
	store: ({ value }) => `Magasin inconnu : ${value}`,
	person: () => "Personne inconnue",
	organization: () => "Organisation inconnue",
};
const CYCLE: Record<string, string> = {
	lifespan_category: "Une catégorie ne peut pas être rangée sous une de ses sous-catégories",
	series: "Une série ne peut pas se contenir elle-même, même par une sous-série",
};
const DUPLICATE_ITEMS: Record<string, string> = {
	series: "Un livre ou une série n'est qu'une fois dans une série",
	media: "La liste doit contenir chaque média une seule fois",
};
const EXTERNAL_SOURCE_NAMES: Record<string, string> = {
	openLibrary: "Open Library",
	feed: "de flux", // a broadcast episode's RSS guid / YouTube id
};
const SYNC_IN_PROGRESS: Record<string, string> = {
	stores: "Une synchronisation des magasins est déjà en cours",
	podcasts: "Une synchronisation est déjà en cours",
};

const TEXTS: Record<ErrorBody["code"], Text> = {
	not_found: ({ resource }) => `${RESOURCES[resource] ?? "Élément"} introuvable`,
	has_dependents: (params) =>
		DEPENDENTS[`${params.resource}.${params.dependent}`]?.(params) ?? "Suppression impossible : élément utilisé",
	sync_in_progress: ({ service }) => SYNC_IN_PROGRESS[service] ?? "Une synchronisation est déjà en cours",
	upstream_unavailable: ({ service, status, reason }) =>
		service === "feed"
			? "Impossible de récupérer les derniers épisodes"
			: service === "catalog"
				? "Impossible de lire le flux du catalogue"
				: service === "openLibrary"
					? status
						? `Open Library a répondu ${status}`
						: reason === "unexpected_body"
							? "Open Library a donné une réponse illisible"
							: "Open Library est injoignable"
					: status
						? `${service} a répondu ${status}`
						: `${service} n'est pas configuré`,
	invalid_image: ({ resource }) => INVALID_IMAGE[resource] ?? "Image illisible",
	invalid_reference: (params) => INVALID_REFERENCE[params.resource]?.(params) ?? "Référence inconnue",
	cycle: ({ resource }) => CYCLE[resource] ?? "Un élément ne peut pas se contenir lui-même",
	duplicate_items: ({ resource }) => DUPLICATE_ITEMS[resource] ?? "Un élément est en double",
	external_id_taken: ({ source }) => `Cet identifiant ${EXTERNAL_SOURCE_NAMES[source] ?? source} est déjà utilisé`,
	"book.last_edition": () => "Un livre garde au moins une édition",
	"edition.model_locked": () => "Le modèle d'une édition qui a des lectures ne peut pas changer",
	"game.merge_self": () => "Impossible de fusionner un jeu avec lui-même",
	"game.replay_too_old": () => "Jour trop ancien : la récupération qui l'ouvrait n'est plus gardée (30 jours)",
	"broadcast.no_feed": () => "Config invalide",
	"sport.gpx_no_date": () => "Le fichier GPX n'a pas de date",
	"sport.date_required": () => "Une nouvelle activité a besoin d'une date ou d'un fichier GPX",
	"sport.no_gpx": () => "Pas de fichier GPX pour cette activité",
	"sport.crop_out_of_range": () => "endIndex hors limites",
	validation: () => "Données invalides",
	unauthorized: () => "Connexion requise",
	http_error: () => "Une erreur est survenue",
	internal: () => "Une erreur est survenue",
};

export function errorText({ code, params, statusCode }: ErrorBody) {
	const text = TEXTS[code]?.(params ?? {});
	return code === "http_error" || code === "internal" || !text
		? `${text ?? "Une erreur est survenue"} (${statusCode})`
		: text;
}
