import "react";

declare module "react" {
	interface ButtonHTMLAttributes<T> {
		commandfor?: string;
		command?: string;
	}
}
