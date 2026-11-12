import Badge from "./Badge";

type ContextTagBadgeProps = { name: string } & React.HTMLAttributes<HTMLSpanElement>;

export default function ContextTagBadge({ name, ...props }: ContextTagBadgeProps) {
	return <Badge icon="fa-solid fa-tag" name={name} color="white" backgroundColor="darkgrey" {...props} />;
}
