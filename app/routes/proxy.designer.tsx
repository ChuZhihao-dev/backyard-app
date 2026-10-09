import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LoaderFunctionArgs } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { designerDemoDir } from "../designer-demo.server";
import { loadRecommendationSets } from "../recommendations.server";
import {
  findReadyGlbUrl,
  type ShopifyMediaNode,
} from "../shopify-model3d";

type VariantNodesResponse = {
  data?: {
    nodes: Array<{
      id: string;
      title: string;
      sku: string | null;
      price: string;
      product: {
        id: string;
        title: string;
        featuredImage: { url: string } | null;
        onlineStoreUrl: string | null;
        modelFile: {
          reference: { url: string } | null;
        } | null;
        media: {
          nodes: ShopifyMediaNode[];
        };
      };
    } | null>;
  };
};

function safeJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.shopify.com https://*.myshopify.com",
    "font-src 'self' data: https://cdn.shopify.com",
    "connect-src 'self' https://cdn.shopify.com https://*.myshopify.com",
    "worker-src 'self' blob:",
    "media-src 'self' https://cdn.shopify.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com",
  ].join("; ");
}

async function renderDesigner(config: unknown, proxyPath: string) {
  const indexPath = path.join(await designerDemoDir(), "index.html");
  let html = await readFile(indexPath, "utf8");
  const nonce = randomBytes(16).toString("base64");
  const normalizedProxyPath = `/${proxyPath.replace(/^\/+|\/+$/g, "")}`;
  html = html
    .replaceAll("/designer-demo/assets/", `${normalizedProxyPath}/assets/`)
    .replace(
      "</head>",
      `<script nonce="${nonce}">window.__BACKYARD_CONFIG__=${safeJson(config)};</script></head>`,
    );
  return { html, nonce };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await authenticate.public.appProxy(request);
  if (!context.session || !context.admin) {
    return new Response("Backyard Designer is not connected to this store.", {
      status: 503,
    });
  }

  const bindings = await prisma.designerProduct.findMany({
    where: { shopDomain: context.session.shop, enabled: true },
  });
  const recommendationSets = await loadRecommendationSets(
    context.session.shop,
    new Set(bindings.map((binding) => binding.variantGid)),
  );
  let products: Array<Record<string, unknown>> = [];

  if (bindings.length) {
    const response = await context.admin.graphql(
      `#graphql
        query DesignerVariantNodes($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              title
              sku
              price
              product {
                id
                title
                featuredImage { url }
                onlineStoreUrl
                modelFile: metafield(namespace: "$app", key: "glb") {
                  reference {
                    __typename
                    ... on GenericFile {
                      url
                    }
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
            }
          }
        }`,
      { variables: { ids: bindings.map((binding) => binding.variantGid) } },
    );
    const result = (await response.json()) as VariantNodesResponse;
    const variantById = new Map(
      (result.data?.nodes ?? [])
        .filter((node) => node)
        .map((node) => [node!.id, node!]),
    );
    products = bindings.flatMap((binding) => {
      const variant = variantById.get(binding.variantGid);
      if (!variant) return [];
      return [
        {
          id: binding.id,
          productId: variant.product.id,
          variantId: variant.id,
          title: variant.product.title,
          variantTitle: variant.title,
          sku: variant.sku ?? "",
          price: Number(variant.price),
          imageUrl: variant.product.featuredImage?.url ?? null,
          productUrl: variant.product.onlineStoreUrl,
          width: binding.widthM,
          depth: binding.depthM,
          height: binding.heightM,
          modelUrl:
            variant.product.modelFile?.reference?.url ??
            findReadyGlbUrl(variant.product.media.nodes) ??
            binding.modelUrl,
        },
      ];
    });
  }

  const url = new URL(request.url);
  const proxyPath =
    url.searchParams.get("path_prefix") ?? "/apps/backyard-designer";
  const { html, nonce } = await renderDesigner(
    { products, recommendationSets, cartMode: "shopify" },
    proxyPath,
  );
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": buildCsp(nonce),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
};
