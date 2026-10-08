import prisma from "./db.server";

export type RecommendationSetPayload = {
  id: string;
  name: string;
  description: string | null;
  items: Array<{
    variantId: string;
    quantity: number;
  }>;
};

export async function loadRecommendationSets(
  shopDomain: string,
  enabledVariantGids?: Set<string>,
): Promise<RecommendationSetPayload[]> {
  const sets = await prisma.recommendationSet.findMany({
    where: { shopDomain, enabled: true },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: { id: "asc" },
        select: { variantGid: true, quantity: true },
      },
    },
  });

  return sets
    .map((set) => ({
      id: set.id,
      name: set.name,
      description: set.description,
      items: set.items
        .filter((item) => !enabledVariantGids || enabledVariantGids.has(item.variantGid))
        .map((item) => ({ variantId: item.variantGid, quantity: item.quantity })),
    }))
    .filter((set) => set.items.length > 0);
}
