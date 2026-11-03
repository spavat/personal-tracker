import { Link, useLocation } from "@tanstack/react-router";

export type SubmenuLink = {
	link: string;
	label: string;
	partial?: boolean;
	icon?: string;
};

export default function Submenu({ links }: { links: Array<SubmenuLink> }) {
	const location = useLocation();

	return (
		<div className="menu">
			{links.map((link) =>
				(link.partial && location.pathname.startsWith(link.link)) || location.pathname === link.link ? (
					<b key={link.link}>
						{link.icon && <i className={link.icon} />} {link.label}
					</b>
				) : (
					<Link to={link.link} key={link.link}>
						{link.icon && <i className={link.icon} />} {link.label}
					</Link>
				),
			)}
		</div>
	);
}
