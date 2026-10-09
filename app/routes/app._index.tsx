import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  findFileReferenceUrl,
  getModel3dAvailability,
  type MetafieldFileReference,
  type ShopifyMediaNode,
} from "../shopify-model3d";

const PAGE_SIZE = 25;

type DesignerVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
};

type DesignerProduct = {
  id: string;
  title: string;
  status: string;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  modelFile: {
    reference: MetafieldFileReference;
  } | null;
  variants: {
    nodes: DesignerVariant[];
  };
  media: {
    nodes: ShopifyMediaNode[];
  };
};

type ProductsQueryResponse = {
  data?: {
    shop: {
      currencyCode: string;
    };
    products: {
      nodes: DesignerProduct[];
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string | null;
        endCursor: string | null;
      };
    };
  };
};

type VariantLookupResponse = {
  data?: {
    node: {
      id: string;
      product: { id: string };
    } | null;
  };
};

function positiveDimension(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new Error(`${name} must be between 0 and 100 metres.`);
  }
  return value;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const productGid = String(formData.get("productGid") ?? "");
  const variantGid = String(formData.get("variantGid") ?? "");
  const enabled = formData.get("disable") !== "on";

  if (
    !productGid.startsWith("gid://shopify/Product/") ||
    !variantGid.startsWith("gid://shopify/ProductVariant/")
  ) {
    return { error: "Invalid Shopify product or variant ID." };
  }

  const response = await admin.graphql(
    `#graphql
      query DesignerVariant($id: ID!) {
        node(id: $id) {
          ... on ProductVariant {
            id
            product { id }
          }
        }
      }`,
    { variables: { id: variantGid } },
  );
  const result = (await response.json()) as VariantLookupResponse;
  if (!result.data?.node || result.data.node.product.id !== productGid) {
    return { error: "This variant no longer belongs to the selected product." };
  }

  try {
    await prisma.designerProduct.upsert({
      where: {
        shopDomain_variantGid: { shopDomain: session.shop, variantGid },
      },
      create: {
        shopDomain: session.shop,
        productGid,
        variantGid,
        widthM: positiveDimension(formData, "widthM"),
        heightM: positiveDimension(formData, "heightM"),
        depthM: positiveDimension(formData, "depthM"),
        modelUrl: null,
        enabled,
      },
      update: {
        productGid,
        widthM: positiveDimension(formData, "widthM"),
        heightM: positiveDimension(formData, "heightM"),
        depthM: positiveDimension(formData, "depthM"),
        modelUrl: null,
        enabled,
      },
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to save product binding.",
    };
  }

  return redirect(`/app?binding=${enabled ? "enabled" : "disabled"}`);
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const after = before ? null : url.searchParams.get("after");

  const response = await admin.graphql(
    `#graphql
      query DesignerProducts(
        $first: Int
        $after: String
        $last: Int
        $before: String
      ) {
        shop {
          currencyCode
        }
        products(
          first: $first
          after: $after
          last: $last
          before: $before
          sortKey: UPDATED_AT
          reverse: true
        ) {
          nodes {
            id
            title
            status
            featuredImage {
              url
              altText
            }
            modelFile: metafield(namespace: "custom", key: "glb") {
              reference {
                __typename
                ... on GenericFile {
                  url
                }
                ... on Model3d {
                  sources {
                    url
                    format
                  }
                }
                ... on MediaImage {
                  image {
                    url
                  }
                }
              }
            }
            variants(first: 20) {
              nodes {
                id
                title
                sku
                price
              }
            }
            media(first: 20) {
              nodes {
                mediaContentType
                status
                ... on Model3d {
                  sources {
                    format
                    mimeType
                    url
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }`,
    {
      variables: before
        ? { first: null, after: null, last: PAGE_SIZE, before }
        : { first: PAGE_SIZE, after, last: null, before: null },
    },
  );
  const responseJson = (await response.json()) as ProductsQueryResponse;
  const bindings = await prisma.designerProduct.findMany({
    where: { shopDomain: session.shop },
    select: {
      variantGid: true,
      widthM: true,
      heightM: true,
      depthM: true,
      enabled: true,
    },
  });

  return {
    currencyCode: responseJson.data?.shop.currencyCode ?? "USD",
    products: responseJson.data?.products.nodes ?? [],
    pageInfo: responseJson.data?.products.pageInfo ?? {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
    bindings,
    bindingNotice: url.searchParams.get("binding"),
  };
};

function formatMoney(value: string, currencyCode: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(value));
}

function statusLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "DRAFT":
      return "Draft";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

export default function Index() {
  const { currencyCode, products, pageInfo, bindings, bindingNotice } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const variantCount = products.reduce(
    (total, product) => total + product.variants.nodes.length,
    0,
  );
  const bindingByVariant = new Map(
    bindings.map((binding) => [binding.variantGid, binding]),
  );

  const goToNextPage = () => {
    if (pageInfo.endCursor) {
      navigate(`?after=${encodeURIComponent(pageInfo.endCursor)}`);
    }
  };

  const goToPreviousPage = () => {
    if (pageInfo.startCursor) {
      navigate(`?before=${encodeURIComponent(pageInfo.startCursor)}`);
    }
  };

  return (
    <s-page heading="3D Backyard Designer">
      <s-section heading="Shopify products">
        <s-paragraph color="subdued">
          Products and prices come directly from Shopify. Enable a variant and
          configure its real-world dimensions before using it in the designer.
        </s-paragraph>

        {actionData?.error ? (
          <s-banner tone="critical" heading="Binding could not be saved">
            {actionData.error}
          </s-banner>
        ) : null}

        {bindingNotice === "enabled" ? (
          <s-banner tone="success" heading="Product added to the designer">
            Open 3D Preview to place this Shopify product in the yard.
          </s-banner>
        ) : bindingNotice === "disabled" ? (
          <s-banner tone="info" heading="Product removed from the designer" />
        ) : null}

        {products.length === 0 ? (
          <s-box padding="large" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="base" alignItems="center">
              <s-heading>No products found</s-heading>
              <s-text color="subdued">
                Add an active product with a variant in Shopify, then reload
                this page.
              </s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-table
            variant="auto"
            paginate
            hasNextPage={pageInfo.hasNextPage}
            hasPreviousPage={pageInfo.hasPreviousPage}
            loading={navigation.state !== "idle"}
            onNextPage={goToNextPage}
            onPreviousPage={goToPreviousPage}
          >
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="secondary">Variant</s-table-header>
              <s-table-header listSlot="labeled">SKU</s-table-header>
              <s-table-header listSlot="labeled" format="currency">
                Price
              </s-table-header>
              <s-table-header listSlot="inline">Status</s-table-header>
              <s-table-header listSlot="labeled">
                Designer binding
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {products.flatMap((product) =>
                product.variants.nodes.map((variant) => {
                  const binding = bindingByVariant.get(variant.id);
                  const modelStatus = findFileReferenceUrl(
                    product.modelFile?.reference ?? null,
                  )
                    ? ("ready" as const)
                    : getModel3dAvailability(product.media.nodes);
                  return (
                    <s-table-row key={variant.id}>
                      <s-table-cell>
                        <s-stack
                          direction="inline"
                          gap="base"
                          alignItems="center"
                        >
                          {product.featuredImage ? (
                            <s-thumbnail
                              src={product.featuredImage.url}
                              alt={
                                product.featuredImage.altText ?? product.title
                              }
                              size="small"
                            />
                          ) : (
                            <s-icon type="product" color="subdued" />
                          )}
                          <s-text type="strong">{product.title}</s-text>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>{variant.title}</s-table-cell>
                      <s-table-cell>{variant.sku || "-"}</s-table-cell>
                      <s-table-cell>
                        {formatMoney(variant.price, currencyCode)}
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge
                          tone={
                            product.status === "ACTIVE" ? "success" : "neutral"
                          }
                        >
                          {statusLabel(product.status)}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <Form method="post" style={{ minWidth: 420 }}>
                          <input
                            type="hidden"
                            name="productGid"
                            value={product.id}
                          />
                          <input
                            type="hidden"
                            name="variantGid"
                            value={variant.id}
                          />
                          <div
                            style={{
                              display: "flex",
                              alignItems: "end",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            {(["widthM", "depthM", "heightM"] as const).map(
                              (name) => (
                                <label
                                  key={name}
                                  style={{
                                    display: "grid",
                                    gap: 3,
                                    fontSize: 12,
                                  }}
                                >
                                  {name === "widthM"
                                    ? "W (m)"
                                    : name === "depthM"
                                      ? "D (m)"
                                      : "H (m)"}
                                  <input
                                    name={name}
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    required
                                    defaultValue={binding?.[name] ?? 1}
                                    style={{ width: 68, padding: 6 }}
                                  />
                                </label>
                              ),
                            )}
                            <div
                              style={{
                                display: "grid",
                                gap: 3,
                                minWidth: 116,
                                fontSize: 12,
                              }}
                            >
                              Shopify 3D media
                              <s-badge
                                tone={
                                  modelStatus === "ready"
                                    ? "success"
                                    : modelStatus === "processing"
                                      ? "caution"
                                      : "neutral"
                                }
                              >
                                {modelStatus === "ready"
                                  ? "GLB ready"
                                  : modelStatus === "processing"
                                    ? "Processing"
                                    : "No GLB"}
                              </s-badge>
                            </div>
                            <s-button
                              type="submit"
                              variant="primary"
                              icon="save"
                            >
                              {binding?.enabled
                                ? "Save settings"
                                : "Add to designer"}
                            </s-button>
                            {binding?.enabled ? (
                              <button
                                name="disable"
                                value="on"
                                type="submit"
                                style={{ padding: "7px 12px", marginBottom: 1 }}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </Form>
                      </s-table-cell>
                    </s-table-row>
                  );
                }),
              )}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Catalog status">
        <s-stack direction="block" gap="base">
          <s-text>
            Products on this page:{" "}
            <s-text type="strong">{products.length}</s-text>
          </s-text>
          <s-text>
            Variants on this page: <s-text type="strong">{variantCount}</s-text>
          </s-text>
          <s-text>
            Currency: <s-text type="strong">{currencyCode}</s-text>
          </s-text>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Next step">
        <s-paragraph color="subdued">
          Open 3D Preview after saving. Only enabled variants are sent to the
          designer; Shopify remains the source of truth for price and product
          data.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
