import path from "path";

import { expect, OWNER, test as setup } from "../fixtures";

setup("log the owner in", async ({ page }) => {
	await page.goto("/login");
	await page.getByLabel("Email").fill(OWNER.email);
	await page.getByLabel("Mot de passe").fill(OWNER.password);
	await page.getByRole("button", { name: "Se connecter" }).click();
	await expect(page.getByRole("link", { name: "Se déconnecter" })).toBeVisible();
	await page.context().storageState({ path: path.resolve(__dirname, "../.auth/owner.json") });
});
