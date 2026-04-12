/**
 * OpenAPI 3.1 specification for MyGestia Public API
 */

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: `${APP_NAME} API`,
    version: "1.0.0",
    description: `API publique ${APP_NAME} pour l'intégration avec des systèmes tiers. Nécessite un plan Institutionnel avec accès API activé.`,
    contact: {
      name: "Support API",
      email: "api@mygestia.immo",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1",
    },
  ],
  security: [
    { bearerAuth: [] },
    { apiKey: [] },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token JWT obtenu via /api/v1/auth/token",
      },
      apiKey: {
        type: "apiKey" as const,
        in: "header" as const,
        name: "X-API-Key",
        description: "Clé API générée dans les paramètres de la société",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object" },
            },
          },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      Building: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          addressLine1: { type: "string" },
          city: { type: "string" },
          postalCode: { type: "string" },
          lotsCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Lot: {
        type: "object",
        properties: {
          id: { type: "string" },
          number: { type: "string" },
          type: { type: "string" },
          area: { type: "number" },
          currentRent: { type: "number" },
          buildingId: { type: "string" },
        },
      },
      Tenant: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          entityType: { type: "string", enum: ["PERSONNE_PHYSIQUE", "PERSONNE_MORALE"] },
        },
      },
      Lease: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          status: { type: "string" },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          currentRentHT: { type: "number" },
          tenantId: { type: "string" },
          lotId: { type: "string" },
        },
      },
      Invoice: {
        type: "object",
        properties: {
          id: { type: "string" },
          number: { type: "string" },
          status: { type: "string" },
          totalHT: { type: "number" },
          totalTTC: { type: "number" },
          issueDate: { type: "string", format: "date" },
          dueDate: { type: "string", format: "date" },
          tenantId: { type: "string" },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          isActive: { type: "boolean" },
          secret: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/buildings": {
      get: {
        summary: "Lister les immeubles",
        tags: ["Patrimoine"],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "Liste des immeubles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Building" } },
                    meta: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          "401": { description: "Non authentifié", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/buildings/{id}": {
      get: {
        summary: "Détail d'un immeuble",
        tags: ["Patrimoine"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Immeuble", content: { "application/json": { schema: { $ref: "#/components/schemas/Building" } } } },
          "404": { description: "Non trouvé" },
        },
      },
    },
    "/lots": {
      get: {
        summary: "Lister les lots",
        tags: ["Patrimoine"],
        parameters: [
          { name: "buildingId", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: {
          "200": { description: "Liste des lots", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Lot" } } } } } } },
        },
      },
    },
    "/tenants": {
      get: {
        summary: "Lister les locataires",
        tags: ["Locataires"],
        responses: {
          "200": { description: "Liste", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Tenant" } } } } } } },
        },
      },
    },
    "/leases": {
      get: {
        summary: "Lister les baux",
        tags: ["Baux"],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["EN_COURS", "RESILIE", "A_VENIR"] } },
        ],
        responses: {
          "200": { description: "Liste", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Lease" } } } } } } },
        },
      },
    },
    "/invoices": {
      get: {
        summary: "Lister les factures",
        tags: ["Facturation"],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["BROUILLON", "EN_ATTENTE", "PAYEE", "EN_RETARD", "ANNULEE"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          "200": { description: "Liste", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Invoice" } } } } } } },
        },
      },
    },
    "/webhooks": {
      get: {
        summary: "Lister les webhooks configurés",
        tags: ["Webhooks"],
        responses: {
          "200": { description: "Liste", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Webhook" } } } } } } },
        },
      },
      post: {
        summary: "Créer un webhook",
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "events"],
                properties: {
                  url: { type: "string", format: "uri" },
                  events: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "invoice.created", "invoice.paid", "invoice.overdue",
                        "lease.created", "lease.terminated",
                        "tenant.created", "tenant.updated",
                        "payment.received",
                        "building.created",
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Webhook créé" },
        },
      },
    },
  },
  tags: [
    { name: "Patrimoine", description: "Immeubles et lots" },
    { name: "Locataires", description: "Gestion des locataires" },
    { name: "Baux", description: "Gestion des baux" },
    { name: "Facturation", description: "Factures et paiements" },
    { name: "Webhooks", description: "Notifications en temps réel" },
  ],
};
