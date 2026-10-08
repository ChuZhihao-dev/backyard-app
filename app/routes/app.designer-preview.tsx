import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useEffect, useRef } from "react";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
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
        media: {
          nodes: ShopifyMediaNode[];
        };
      };
    } | null>;
  };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const bindings = await prisma.designerProduct.findMany({
    where: { shopDomain: session.shop, enabled: true },
  });

  const recommendationSets = await loadRecommendationSets(
    session.shop,
    new Set(bindings.map((binding) => binding.variantGid)),
  );

  if (!bindings.length) return { products: [], recommendationSets };

  const response = await admin.graphql(
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

  return {
    products: bindings.flatMap((binding) => {
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
            findReadyGlbUrl(variant.product.media.nodes) ?? binding.modelUrl,
        },
      ];
    }),
    recommendationSets,
  };
};

export default function DesignerPreview() {
  const { products, recommendationSets } = useLoaderData<typeof loader>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const sendCatalog = () =>
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "backyard:catalog:v1",
          products,
          recommendationSets,
          cartMode: "preview",
        },
        window.location.origin,
      );
    const iframe = iframeRef.current;
    iframe?.addEventListener("load", sendCatalog);
    sendCatalog();
    return () => iframe?.removeEventListener("load", sendCatalog);
  }, [products, recommendationSets]);

  return (
    <div
      style={{
        background: "#f7f7f4",
        height: "calc(100vh - 48px)",
        minHeight: "620px",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <iframe
        ref={iframeRef}
        title="3D Backyard Designer preview"
        src="/designer-demo/index.html?shopify-preview=1"
        allow="clipboard-read; clipboard-write; fullscreen"
        style={{
          border: 0,
          display: "block",
          height: "100%",
          width: "100%",
        }}
      />
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
