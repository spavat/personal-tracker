import { Helmet } from "react-helmet-async";

export default function PageTitle({ title }: { title?: string }) {
	const fullTitle = title ? `${title} | Personal Tracker` : "Personal Tracker";
	return (
		<Helmet>
			<title>{fullTitle}</title>
		</Helmet>
	);
}
