import type { EntityBookRole } from "@personal-tracker/shared/reading-book";

import { useSuspenseQuery } from "@tanstack/react-query";

import { entityBooksQuery } from "../../reading-book/api";
import AuthorBooks from "../../reading-book/components/AuthorBooks";

const ROLE_LABELS: Record<EntityBookRole, string> = {
	author: "Auteur·ice",
	illustrator: "Illustration",
	preface: "Préface",
	translator: "Traduction",
	publisher: "Éditeur",
};

// The books the entity is credited on, one part per role, each under its series as on the author page. A book can
// show in several roles: only the first role's covers move to the book page.
export default function BooksSection({ entityId }: { entityId: string }) {
	const { data: roles } = useSuspenseQuery(entityBooksQuery(entityId));

	return (
		<section className="reading-book">
			<h2>📖 Livres</h2>
			{roles.map(({ role, books }, index) => (
				<div key={role}>
					<h3>{ROLE_LABELS[role]}</h3>
					<AuthorBooks books={books} seriesHeading="h4" coverTransition={index === 0} />
				</div>
			))}
		</section>
	);
}
