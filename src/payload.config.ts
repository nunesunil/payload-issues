import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "node:path";
import { buildConfig } from "payload";
import { fileURLToPath } from "node:url";

import { Pages } from "./collections/Pages";
import { Tenants } from "./collections/Tenants";
import Users from "./collections/Users";
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant";
import { isSuperAdmin } from "./access/isSuperAdmin";
import type { Config } from "./payload-types";
import { getUserTenantIDs } from "./utilities/getUserTenantIDs";
import { seed } from "./migrations/seed";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// eslint-disable-next-line no-restricted-exports
export default buildConfig({
	admin: {
		user: "users",
	},
	collections: [Pages, Users, Tenants],
	db: sqliteAdapter({
		client: {
			url: process.env.DATABASE_URI as string,
		},
	}),
	editor: lexicalEditor({}),
	secret: process.env.PAYLOAD_SECRET as string,
	typescript: {
		outputFile: path.resolve(dirname, "payload-types.ts"),
	},
	onInit: async (payload) => {
		const existingUsers = await payload.find({
			collection: "users",
			limit: 1,
		});

		if (existingUsers.docs.length === 0) {
			await seed(payload);
		}
	},
	plugins: [
		multiTenantPlugin<Config>({
			collections: {
				pages: {},
			},
			tenantField: {
				access: {
					read: () => true,
					update: ({ req }) => {
						if (isSuperAdmin(req.user)) {
							return true;
						}
						return getUserTenantIDs(req.user).length > 0;
					},
				},
			},
			tenantsArrayField: {
				includeDefaultField: false,
			},
			userHasAccessToAllTenants: (user) => isSuperAdmin(user),
		}),
	],
});
