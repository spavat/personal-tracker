import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import "../../node_modules/flag-icons/css/flag-icons.min.css";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";

import { HeaderSlotProvider } from "./components/HeaderSlotProvider";
import { router } from "./router";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<HelmetProvider>
			<QueryClientProvider client={queryClient}>
				<HeaderSlotProvider>
					<RouterProvider router={router} context={{ queryClient }} />
				</HeaderSlotProvider>
			</QueryClientProvider>
		</HelmetProvider>
	</React.StrictMode>,
);
