import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const themeEditorUrl = `https://${session.shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/designer-launcher`;
  const storefrontUrl = `https://${session.shop}/apps/backyard-designer`;

  return { themeEditorUrl, storefrontUrl };
};

export default function DesignerSettings() {
  const { themeEditorUrl, storefrontUrl } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Designer settings">
      <s-section heading="在主题中启用设计器">
        <s-paragraph>
          点击下面的按钮，在主题编辑器的「应用嵌入」中打开本设计器。启用并保存后，
          前台会出现一个悬浮按钮，客户点击即可打开 3D 后院设计器。
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button
            href={themeEditorUrl}
            target="_blank"
            variant="primary"
            icon="theme-edit"
          >
            在主题编辑器中启用
          </s-button>
          <s-button href={storefrontUrl} target="_blank">
            在前台预览
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="启用步骤">
        <s-unordered-list>
          <s-list-item>
            点击「在主题编辑器中启用」，主题编辑器会自动打开并定位到该 app embed。
          </s-list-item>
          <s-list-item>在编辑器中开启开关并点击「保存」。</s-list-item>
          <s-list-item>刷新前台，点击右下角的悬浮按钮即可打开设计器。</s-list-item>
        </s-unordered-list>
        <s-paragraph color="subdued">
          悬浮按钮位置、颜色和文案都可以在主题编辑器里调整。
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
