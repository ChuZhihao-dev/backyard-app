import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type VariantNode = {
  id: string;
  title: string;
  sku: string | null;
  product: { id: string; title: string };
};

type VariantNodesResponse = {
  data?: { nodes: Array<VariantNode | null> };
};

function validName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 80) throw new Error("请输入 1-80 个字符的组合名称。");
  return name;
}

function parseVariantIds(formData: FormData) {
  return [...new Set(formData.getAll("variantGid").map(String))].filter((id) =>
    id.startsWith("gid://shopify/ProductVariant/"),
  );
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intentValues = formData.getAll("intent");
  const intent = String(intentValues.at(-1) ?? "save");

  if (intent === "delete") {
    const id = String(formData.get("setId") ?? "");
    if (id) {
      await prisma.recommendationSet.deleteMany({
        where: { id, shopDomain: session.shop },
      });
    }
    return redirect("/app/recommendations?notice=deleted");
  }

  try {
    const name = validName(formData.get("name"));
    const description = String(formData.get("description") ?? "").trim().slice(0, 240) || null;
    const enabled = formData.get("enabled") === "on";
    const variantGids = parseVariantIds(formData);
    if (!variantGids.length) throw new Error("至少选择一个已加入设计器的商品。");

    const bindings = await prisma.designerProduct.findMany({
      where: {
        shopDomain: session.shop,
        enabled: true,
        variantGid: { in: variantGids },
      },
      select: { variantGid: true },
    });
    const validVariantGids = new Set(bindings.map((binding) => binding.variantGid));
    const selectedVariantGids = variantGids.filter((id) => validVariantGids.has(id));
    if (!selectedVariantGids.length) throw new Error("所选商品都不是当前启用的设计器商品。");

    const setId = String(formData.get("setId") ?? "");
    if (setId) {
      const existing = await prisma.recommendationSet.findFirst({
        where: { id: setId, shopDomain: session.shop },
        select: { id: true },
      });
      if (!existing) throw new Error("推荐组合不存在或不属于当前店铺。");
      await prisma.$transaction([
        prisma.recommendationSet.update({
          where: { id: setId },
          data: { name, description, enabled },
        }),
        prisma.recommendationItem.deleteMany({ where: { recommendationSetId: setId } }),
        prisma.recommendationItem.createMany({
          data: selectedVariantGids.map((variantGid) => ({
            recommendationSetId: setId,
            variantGid,
            quantity: 1,
          })),
        }),
      ]);
    } else {
      await prisma.recommendationSet.create({
        data: {
          shopDomain: session.shop,
          name,
          description,
          enabled,
          items: {
            create: selectedVariantGids.map((variantGid) => ({ variantGid, quantity: 1 })),
          },
        },
      });
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "推荐组合保存失败。",
    };
  }

  return redirect("/app/recommendations?notice=saved");
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const bindings = await prisma.designerProduct.findMany({
    where: { shopDomain: session.shop, enabled: true },
    select: { variantGid: true },
    orderBy: { createdAt: "asc" },
  });
  const sets = await prisma.recommendationSet.findMany({
    where: { shopDomain: session.shop },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: { items: { select: { variantGid: true } } },
  });
  const response = bindings.length
    ? await admin.graphql(
        `#graphql
          query RecommendationVariants($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on ProductVariant {
                id
                title
                sku
                product { id title }
              }
            }
          }`,
        { variables: { ids: bindings.map((binding) => binding.variantGid) } },
      )
    : null;
  const result = response ? ((await response.json()) as VariantNodesResponse) : null;
  const variants = (result?.data?.nodes ?? []).filter((node): node is VariantNode => Boolean(node));
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return {
    variants,
    sets: sets.map((set) => ({
      id: set.id,
      name: set.name,
      description: set.description,
      enabled: set.enabled,
      itemVariantGids: set.items.map((item) => item.variantGid),
    })),
    variantById: Object.fromEntries(variantById),
    notice: new URL(request.url).searchParams.get("notice"),
  };
};

function variantLabel(variant: VariantNode) {
  return `${variant.product.title} · ${variant.title === "Default Title" ? "默认款" : variant.title}${variant.sku ? ` · ${variant.sku}` : ""}`;
}

export default function RecommendationsPage() {
  const { variants, sets, variantById, notice } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const saving = navigation.state !== "idle";

  const variantCheckboxes = (selected: string[] = []) =>
    variants.length ? (
      <s-box padding="base" background="subdued" border="base" borderRadius="base">
        <s-stack direction="block" gap="small">
        {variants.map((variant) => (
          <label className="recommendation-product-option" key={variant.id} style={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "10px 8px", borderBottom: "1px solid #e1e5e3" }}>
            <input type="checkbox" name="variantGid" value={variant.id} defaultChecked={selected.includes(variant.id)} />
            <span className="recommendation-product-copy" style={{ minWidth: 0 }}>
              <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{variant.product.title}</strong>
              <small style={{ display: "block", color: "#616a67", marginTop: 2 }}>{variantLabel(variant).replace(`${variant.product.title} · `, "")}</small>
            </span>
            <s-badge tone="neutral">1 件</s-badge>
          </label>
        ))}
        </s-stack>
      </s-box>
    ) : (
      <s-banner tone="info">请先在 Products 页面启用至少一个商品。</s-banner>
    );

  return (
    <s-page heading="推荐组合">
      <s-section heading="创建推荐组合">
        <s-paragraph color="subdued">
          将多个已加入 3D 设计器的商品绑定为一个组合，客户可在 3D Preview 中一键添加整组商品。
        </s-paragraph>
        {actionData?.error ? <s-banner tone="critical">{actionData.error}</s-banner> : null}
        {notice === "saved" ? <s-banner tone="success">推荐组合已保存。</s-banner> : null}
        {notice === "deleted" ? <s-banner tone="info">推荐组合已删除。</s-banner> : null}
        <s-box padding="base" background="subdued" border="base" borderRadius="base">
        <Form method="post">
          <input type="hidden" name="intent" value="save" />
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
              <s-text-field label="组合名称" name="name" required maxLength={80} placeholder="例如：户外用餐组合" />
              <s-text-field label="组合说明" name="description" maxLength={240} placeholder="例如：餐桌、座椅和遮阳伞" />
            </s-grid>
            <s-checkbox label="在 3D Preview 中显示" name="enabled" value="on" checked></s-checkbox>
            <s-stack direction="block" gap="small">
              <s-heading>组合商品</s-heading>
              <s-text color="subdued">选择已加入设计器的商品，Preview 会按此顺序自动布置。</s-text>
              {variantCheckboxes()}
            </s-stack>
            <s-button type="submit" variant="primary" icon="plus" disabled={saving || !variants.length}>创建组合</s-button>
          </s-stack>
        </Form>
        </s-box>
      </s-section>

      <s-section heading="已配置组合">
        {sets.length ? sets.map((set) => (
          <s-box key={set.id} padding="base" background="subdued" border="base" borderRadius="base">
            <Form method="post">
              <input type="hidden" name="intent" value="save" />
              <input type="hidden" name="setId" value={set.id} />
              <s-stack direction="block" gap="base">
                <s-grid gridTemplateColumns="1fr 1fr auto" gap="base" alignItems="end">
                  <s-text-field label="组合名称" name="name" required maxLength={80} value={set.name} />
                  <s-text-field label="组合说明" name="description" maxLength={240} value={set.description ?? ""} />
                  <s-badge tone={set.enabled ? "success" : "neutral"}>{set.enabled ? "已启用" : "已停用"}</s-badge>
                </s-grid>
                <s-checkbox label="在 3D Preview 中显示" name="enabled" value="on" checked={set.enabled}></s-checkbox>
                <s-stack direction="block" gap="small">
                  <s-heading>组合商品</s-heading>
                  {variantCheckboxes(set.itemVariantGids)}
                </s-stack>
                <s-stack direction="inline" gap="base">
                  <s-button type="submit" variant="primary" icon="save" disabled={saving}>保存修改</s-button>
                  <button type="submit" name="intent" value="delete" style={{ padding: "7px 12px" }}>删除组合</button>
                </s-stack>
              </s-stack>
            </Form>
            <s-text color="subdued">当前商品：{set.itemVariantGids.map((id) => variantById[id]?.product.title ?? id).join("、")}</s-text>
          </s-box>
        )) : <s-text color="subdued">还没有推荐组合。</s-text>}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
