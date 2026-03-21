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
