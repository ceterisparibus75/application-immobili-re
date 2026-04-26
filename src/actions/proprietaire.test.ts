import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import {
  getProprietaires,
  createProprietaire,
  deleteProprietaire,
  getProprietaire,
  updateProprietaire,
  migrateOwnerToProprietaire,
  getProprietairesWithSocieties,
} from "@/actions/proprietaire"
import { UserRole } from "@/generated/prisma/client"
import { prismaMock } from "@/test/mocks/prisma"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const buildProprietaire = (overrides = {}) => ({
  id: "prop-1",
  userId: "user-1",
  label: "SCI Test",
  entityType: "PERSONNE_MORALE",
  email: "sci@test.com",
  firstName: null,
  lastName: null,
  phone: null,
  birthDate: null,
  birthPlace: null,
  address: "1 rue du Test",
  postalCode: "75001",
  city: "Paris",
  profession: null,
  nationality: null,
  companyName: "SCI Test",
  legalForm: "SCI",
  siret: null,
  siren: null,
  vatNumber: null,
  shareCapital: null,
  registrationCity: null,
  representativeName: null,
  representativeRole: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { societies: 0 },
  ...overrides,
})

describe("getProprietaires", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getProprietaires()
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("retourne une liste vide si aucun propriétaire", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findMany.mockResolvedValue([] as never)
    const r = await getProprietaires()
    expect(r.success).toBe(true)
    expect(r.data).toEqual([])
  })

  it("retourne les propriétaires accessibles", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findMany.mockResolvedValue([
      buildProprietaire({ _count: { societies: 2 } }),
    ] as never)
    const r = await getProprietaires()
    expect(r.success).toBe(true)
    expect(r.data).toHaveLength(1)
    expect(r.data![0].label).toBe("SCI Test")
  })
})

describe("createProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await createProprietaire({ label: "Test" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si label vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createProprietaire({ label: "" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("libellé")
  })

  it("erreur si label est uniquement des espaces", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createProprietaire({ label: "   " })
    expect(r.success).toBe(false)
    expect(r.error).toContain("libellé")
  })

  it("crée un propriétaire avec un label valide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.create.mockResolvedValue(buildProprietaire() as never)
    const r = await createProprietaire({ label: "SCI Test" })
    expect(r.success).toBe(true)
    expect(r.data?.id).toBe("prop-1")
    expect(prismaMock.proprietaire.create).toHaveBeenCalled()
  })

  it("crée un propriétaire personne physique", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.create.mockResolvedValue(
      buildProprietaire({ id: "prop-2", entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Martin" }) as never
    )
    const r = await createProprietaire({
      label: "Jean Martin",
      entityType: "PERSONNE_PHYSIQUE" as never,
      firstName: "Jean",
      lastName: "Martin",
    })
    expect(r.success).toBe(true)
  })
})

describe("deleteProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await deleteProprietaire("prop-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si propriétaire introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    const r = await deleteProprietaire("prop-999")
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("erreur si des sociétés sont rattachées", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(
      buildProprietaire({ _count: { societies: 2 } }) as never
    )
    const r = await deleteProprietaire("prop-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("sociétés rattachées")
  })

  it("supprime un propriétaire sans sociétés", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(
      buildProprietaire({ _count: { societies: 0 } }) as never
    )
    prismaMock.proprietaire.delete.mockResolvedValue(buildProprietaire() as never)
    const r = await deleteProprietaire("prop-1")
    expect(r.success).toBe(true)
    expect(prismaMock.proprietaire.delete).toHaveBeenCalled()
  })
})

// ── getProprietaire ───────────────────────────────────────────────

describe("getProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getProprietaire("prop-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("retourne une erreur si introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    const r = await getProprietaire("prop-999")
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("retourne le propriétaire si trouvé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({
      ...buildProprietaire(),
      associes: [],
    } as never)
    const r = await getProprietaire("prop-1")
    expect(r.success).toBe(true)
    expect(r.data?.id).toBe("prop-1")
    expect(r.data?.label).toBe("SCI Test")
    expect(r.data?.associes).toEqual([])
  })
})

// ── updateProprietaire ────────────────────────────────────────────

describe("updateProprietaire", () => {
  const validInput = { id: "prop-1", label: "SCI Modifiée" }

  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await updateProprietaire(validInput)
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si label vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await updateProprietaire({ id: "prop-1", label: "" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("libellé")
  })

  it("erreur si propriétaire introuvable ou accès refusé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    const r = await updateProprietaire(validInput)
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("met à jour le propriétaire avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never)
    prismaMock.proprietaire.update.mockResolvedValue(buildProprietaire({ label: "SCI Modifiée" }) as never)
    const r = await updateProprietaire(validInput)
    expect(r.success).toBe(true)
    expect(prismaMock.proprietaire.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "prop-1" }, data: expect.objectContaining({ label: "SCI Modifiée" }) })
    )
  })
})

// ── migrateOwnerToProprietaire ────────────────────────────────────

describe("migrateOwnerToProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await migrateOwnerToProprietaire()
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("crée un propriétaire et migre les sociétés si aucun n'existe", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    prismaMock.user.findUnique.mockResolvedValue({
      firstName: "Jean", lastName: "Martin", phone: null,
      birthDate: null, birthPlace: null, address: null,
      postalCode: null, ownerCity: null, profession: null, nationality: null,
    } as never)
    prismaMock.proprietaire.create.mockResolvedValue({ id: "prop-new" } as never)
    prismaMock.society.updateMany.mockResolvedValue({ count: 2 } as never)

    const r = await migrateOwnerToProprietaire()
    expect(r.success).toBe(true)
    expect(r.data?.proprietaireId).toBe("prop-new")
    expect(prismaMock.proprietaire.create).toHaveBeenCalledOnce()
    expect(prismaMock.society.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { proprietaireId: "prop-new" } })
    )
  })

  it("utilise le propriétaire existant s'il en existe un", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-existing" } as never)
    prismaMock.society.updateMany.mockResolvedValue({ count: 0 } as never)

    const r = await migrateOwnerToProprietaire()
    expect(r.success).toBe(true)
    expect(r.data?.proprietaireId).toBe("prop-existing")
    expect(prismaMock.proprietaire.create).not.toHaveBeenCalled()
  })
})

// ── getProprietairesWithSocieties ─────────────────────────────────

describe("getProprietairesWithSocieties", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getProprietairesWithSocieties()
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("retourne la liste avec displayName calculé pour personne morale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never)
    prismaMock.society.findMany.mockResolvedValue([] as never)
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-1", label: "SCI Test", entityType: "PERSONNE_MORALE",
        firstName: null, lastName: null, companyName: "SCI Test SARL", legalForm: "SARL",
        societies: [{ id: "soc-1", name: "Société A", legalForm: "SCI", city: "Paris", isActive: true, logoUrl: null }],
      },
    ] as never)

    const r = await getProprietairesWithSocieties()
    expect(r.success).toBe(true)
    expect(r.data).toHaveLength(1)
    expect(r.data![0].displayName).toBe("SCI Test SARL")
    expect(r.data![0].societies).toHaveLength(1)
  })

  it("calcule le displayName pour personne physique", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never)
    prismaMock.society.findMany.mockResolvedValue([] as never)
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-2", label: "Jean Martin", entityType: "PERSONNE_PHYSIQUE",
        firstName: "Jean", lastName: "Martin", companyName: null, legalForm: null,
        societies: [],
      },
    ] as never)

    const r = await getProprietairesWithSocieties()
    expect(r.success).toBe(true)
    expect(r.data![0].displayName).toBe("Jean Martin")
  })
})


// ─── createProprietaire — avec associes ──────────────────────────────────────

describe("createProprietaire — avec associes (ligne 277)", () => {
  it("cree un proprietaire avec des associes", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.proprietaire.create.mockResolvedValue({ id: "prop-new" } as never);

    const r = await createProprietaire({
      label: "SCI Test",
      entityType: "PERSONNE_MORALE",
      associes: [
        { firstName: "Alice", lastName: "Durand", email: "alice@test.com" },
        { firstName: "Bob", lastName: "Martin" },
      ],
    });
    expect(r.success).toBe(true);
    expect(prismaMock.proprietaire.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          associes: expect.objectContaining({ create: expect.any(Array) }),
        }),
      })
    );
  });
});

// ─── updateProprietaire — branches associes (lignes 363-415) ─────────────────

describe("updateProprietaire — associes delete + update + create", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never);
    prismaMock.proprietaire.update.mockResolvedValue({} as never);
  });

  it("supprime les associes retires et cree les nouveaux (lignes 373-415)", async () => {
    prismaMock.proprietaireAssocie.findMany.mockResolvedValue([
      { id: "assoc-old" },
    ] as never);
    prismaMock.proprietaireAssocie.deleteMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.proprietaireAssocie.update.mockResolvedValue({} as never);
    prismaMock.proprietaireAssocie.create.mockResolvedValue({} as never);

    const r = await updateProprietaire({
      id: "prop-1",
      label: "SCI Modifiee",
      associes: [
        // nouvel associe (pas d'id -> create)
        { firstName: "Alice", lastName: "Durand" },
      ],
    });
    expect(r.success).toBe(true);
    // assoc-old est supprime (pas dans la liste de mise a jour)
    expect(prismaMock.proprietaireAssocie.deleteMany).toHaveBeenCalled();
    // Le nouvel associe est cree
    expect(prismaMock.proprietaireAssocie.create).toHaveBeenCalled();
  });

  it("met a jour un associe existant (ligne 384)", async () => {
    prismaMock.proprietaireAssocie.findMany.mockResolvedValue([
      { id: "assoc-1" },
    ] as never);
    prismaMock.proprietaireAssocie.update.mockResolvedValue({} as never);

    const r = await updateProprietaire({
      id: "prop-1",
      label: "SCI Modifiee",
      associes: [
        // associe existant avec id -> update
        { id: "assoc-1", firstName: "Alice", lastName: "Durand" },
      ],
    });
    expect(r.success).toBe(true);
    expect(prismaMock.proprietaireAssocie.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "assoc-1" } })
    );
  });
});

// ─── migrateOwnerToProprietaire — orphans avec proprietaire existant ──────────

describe("migrateOwnerToProprietaire — orphan societies avec proprietaire existant", () => {
  it("rattache les societes orphelines si un proprietaire existe deja (lignes 529-530)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    // proprietaire existe deja
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-existing" } as never);
    // societés orphelines trouvées pour l'associer
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-orphan" }] as never);
    prismaMock.society.updateMany.mockResolvedValue({ count: 1 } as never);

    const r = await migrateOwnerToProprietaire();
    expect(r.success).toBe(true);
    expect(prismaMock.society.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { proprietaireId: "prop-existing" } })
    );
  });
});


// ─── getProprietairesWithSocieties — auto-migration branches ─────────────────

describe("getProprietairesWithSocieties — auto-migration", () => {
  it("declenche migrateOwnerToProprietaire si pas de proprietaire et societes orphelines (lignes 525,529,530)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    // Pas de proprietaire existant
    prismaMock.proprietaire.findFirst.mockResolvedValue(null);
    // Societes orphelines trouvees
    prismaMock.society.findMany
      .mockResolvedValueOnce([{ id: "soc-orphan" }] as never) // orphanSocieties check
      .mockResolvedValueOnce([] as never); // inside migrateOwnerToProprietaire
    prismaMock.proprietaire.create.mockResolvedValue({ id: "prop-new", societies: [] } as never);
    prismaMock.society.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.proprietaire.findMany.mockResolvedValue([] as never);

    const r = await getProprietairesWithSocieties();
    expect(r.success).toBe(true);
  });

  it("rattache les societes orphelines si proprietaire existe deja (lignes 538-539)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    // Proprietaire existant
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-existing" } as never);
    // Societes orphelines trouvees pour le proprietaire existant
    prismaMock.society.findMany
      .mockResolvedValueOnce([{ id: "soc-orphan" }] as never) // orphans check
      .mockResolvedValueOnce([] as never); // second findMany call
    prismaMock.society.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.proprietaire.findMany.mockResolvedValue([] as never);

    const r = await getProprietairesWithSocieties();
    expect(r.success).toBe(true);
    expect(prismaMock.society.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { proprietaireId: "prop-existing" } })
    );
  });
});

// ─── birthDate truthy → new Date() (B10, B30, B44, B66, B74 arm0) ────────────

describe("createProprietaire — birthDate fournie (B10 arm0 L256)", () => {
  it("convertit birthDate en Date si fournie", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.proprietaire.create.mockResolvedValue({ id: "prop-bd" } as never);
    const r = await createProprietaire({ label: "Jean Dupont", birthDate: "1990-05-15" });
    expect(r.success).toBe(true);
    expect(prismaMock.proprietaire.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthDate: new Date("1990-05-15") }),
      })
    );
  });
});

describe("createProprietaire — associé avec birthDate (B30 arm0 L282)", () => {
  it("convertit birthDate de l'associé en Date si fournie", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.proprietaire.create.mockResolvedValue({ id: "prop-bd2" } as never);
    const r = await createProprietaire({
      label: "SCI Test",
      entityType: "PERSONNE_MORALE",
      associes: [{ firstName: "Alice", lastName: "Durand", birthDate: "1985-03-10" }],
    });
    expect(r.success).toBe(true);
    const createCall = prismaMock.proprietaire.create.mock.calls[0][0] as { data: { associes: { create: Array<{ birthDate: Date }> } } };
    expect(createCall.data.associes.create[0].birthDate).toEqual(new Date("1985-03-10"));
  });
});

describe("updateProprietaire — birthDate fournie (B44 arm0 L342)", () => {
  it("convertit birthDate en Date si fournie lors de la mise à jour", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never);
    prismaMock.proprietaire.update.mockResolvedValue({} as never);
    const r = await updateProprietaire({ id: "prop-1", label: "Jean", birthDate: "1988-07-20" });
    expect(r.success).toBe(true);
    expect(prismaMock.proprietaire.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthDate: new Date("1988-07-20") }),
      })
    );
  });
});

describe("updateProprietaire — associé update avec birthDate (B66 arm0 L391)", () => {
  it("convertit birthDate de l'associé lors de la mise à jour", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never);
    prismaMock.proprietaire.update.mockResolvedValue({} as never);
    prismaMock.proprietaireAssocie.findMany.mockResolvedValue([{ id: "assoc-1" }] as never);
    prismaMock.proprietaireAssocie.update.mockResolvedValue({} as never);
    const r = await updateProprietaire({
      id: "prop-1",
      label: "SCI",
      associes: [{ id: "assoc-1", firstName: "Alice", lastName: "Durand", birthDate: "1980-01-01" }],
    });
    expect(r.success).toBe(true);
    expect(prismaMock.proprietaireAssocie.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthDate: new Date("1980-01-01") }),
      })
    );
  });
});

describe("updateProprietaire — nouvel associé avec birthDate (B74 arm0 L408)", () => {
  it("convertit birthDate du nouvel associé lors de la création", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never);
    prismaMock.proprietaire.update.mockResolvedValue({} as never);
    prismaMock.proprietaireAssocie.findMany.mockResolvedValue([] as never);
    prismaMock.proprietaireAssocie.create.mockResolvedValue({} as never);
    const r = await updateProprietaire({
      id: "prop-1",
      label: "SCI",
      associes: [{ firstName: "Bob", lastName: "Martin", birthDate: "1975-12-25" }],
    });
    expect(r.success).toBe(true);
    expect(prismaMock.proprietaireAssocie.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthDate: new Date("1975-12-25") }),
      })
    );
  });
});

describe("getProprietairesWithSocieties — pas de propriétaire, pas d'orphelins (B99 arm1 L529)", () => {
  it("ne déclenche pas la migration si pas de sociétés orphelines", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.proprietaire.findFirst.mockResolvedValue(null);
    prismaMock.society.findMany.mockResolvedValue([] as never);
    prismaMock.proprietaire.findMany.mockResolvedValue([] as never);
    const r = await getProprietairesWithSocieties();
    expect(r.success).toBe(true);
    expect(prismaMock.proprietaire.create).not.toHaveBeenCalled();
  });
});

describe("getProprietairesWithSocieties — displayName fallbacks (B102 arm1, B103 arm1)", () => {
  it("PERSONNE_MORALE sans companyName → utilise label (B102 arm1 L584)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never);
    prismaMock.society.findMany.mockResolvedValue([] as never);
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-1", label: "SCI Fallback", entityType: "PERSONNE_MORALE",
        firstName: null, lastName: null, companyName: null, legalForm: null, societies: [],
      },
    ] as never);
    const r = await getProprietairesWithSocieties();
    expect(r.success).toBe(true);
    expect(r.data![0].displayName).toBe("SCI Fallback");
  });

  it("PERSONNE_PHYSIQUE sans nom ni prénom → utilise label (B103 arm1 L585)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-2" } as never);
    prismaMock.society.findMany.mockResolvedValue([] as never);
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-2", label: "Propriétaire Inconnu", entityType: "PERSONNE_PHYSIQUE",
        firstName: null, lastName: null, companyName: null, legalForm: null, societies: [],
      },
    ] as never);
    const r = await getProprietairesWithSocieties();
    expect(r.success).toBe(true);
    expect(r.data![0].displayName).toBe("Propriétaire Inconnu");
  });
});

