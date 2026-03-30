"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createContactSchema,
  updateContactSchema,
  type CreateContactInput,
  type UpdateContactInput,
} from "@/validations/contact";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { hash } from "bcryptjs";
import { sendNewUserEmail } from "@/lib/email";

export async function createContact(
  societyId: string,
  input: CreateContactInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createContactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const contact = await prisma.contact.create({
      data: {
        societyId,
        contactType: parsed.data.contactType,
        name: parsed.data.name,
        company: parsed.data.company ?? null,
        specialty: parsed.data.specialty ?? null,
        email: parsed.data.email || null,
        phone: parsed.data.phone ?? null,
        mobile: parsed.data.mobile ?? null,
        addressLine1: parsed.data.addressLine1 ?? null,
        city: parsed.data.city ?? null,
        postalCode: parsed.data.postalCode ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Contact",
      entityId: contact.id,
      details: { name: parsed.data.name, contactType: parsed.data.contactType },
    });

    revalidatePath("/contacts");
    return { success: true, data: { id: contact.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createContact]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateContact(
  societyId: string,
  input: UpdateContactInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateContactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, email, ...rest } = parsed.data;

    const existing = await prisma.contact.findFirst({
      where: { id, societyId },
    });
    if (!existing) return { success: false, error: "Contact introuvable" };

    await prisma.contact.update({
      where: { id },
      data: { ...rest, email: email || null },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Contact",
      entityId: id,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateContact]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function getContacts(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.contact.findMany({
    where: { societyId, isActive: true },
    orderBy: [{ contactType: "asc" }, { name: "asc" }],
  });
}

export async function getContactById(societyId: string, contactId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.contact.findFirst({
    where: { id: contactId, societyId },
    include: { contactNotes: { orderBy: { createdAt: "desc" } } },
  });
}


export async function inviteContactAsUser(
  societyId: string,
  contactId: string,
  role: string = "LECTURE"
): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    // Récupérer le contact
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, societyId },
    });
    if (!contact) return { success: false, error: "Contact introuvable" };
    if (!contact.email) return { success: false, error: "Le contact n'a pas d'adresse email" };

    const email = contact.email.toLowerCase();

    // Vérifier si un utilisateur existe déjà avec cet email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Vérifier s'il est déjà associé à cette société
      const membership = await prisma.userSociety.findUnique({
        where: { userId_societyId: { userId: existing.id, societyId } },
      });
      if (membership) {
        return { success: false, error: "Cet utilisateur est déjà membre de cette société" };
      }
      // L'associer à la société
      await prisma.userSociety.create({
        data: { userId: existing.id, societyId, role: role as "ADMIN_SOCIETE" | "GESTIONNAIRE" | "COMPTABLE" | "LECTURE" },
      });
      await createAuditLog({
        societyId,
        userId: session.user.id,
        action: "CREATE",
        entity: "UserSociety",
        entityId: existing.id,
        details: { email, role, source: "contact_invite" },
      });
      revalidatePath("/contacts");
      revalidatePath("/administration/utilisateurs");
      return { success: true, data: { userId: existing.id } };
    }

    // Créer un nouvel utilisateur avec un mot de passe temporaire
    const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
    const passwordHash = await hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: contact.name,
        passwordHash,
      },
    });

    // L'associer à la société
    await prisma.userSociety.create({
      data: { userId: user.id, societyId, role: role as "ADMIN_SOCIETE" | "GESTIONNAIRE" | "COMPTABLE" | "LECTURE" },
    });

    // Envoyer l'email d'invitation
    await sendNewUserEmail({
      to: email,
      name: contact.name,
      email,
      password: tempPassword,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    }).catch((err) => console.error("[inviteContactAsUser] email error", err));

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      details: { email, role, source: "contact_invite", contactId },
    });

    revalidatePath("/contacts");
    revalidatePath("/administration/utilisateurs");
    return { success: true, data: { userId: user.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[inviteContactAsUser]", error);
    return { success: false, error: "Erreur lors de l'invitation" };
  }
}
